import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertsTable, AllAlertsEmptyState } from '../AlertsTable';
import type { AlertListItem } from '@/types/alerts';

// Stub next/link so jsdom doesn't need router context.
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}));

function makeAlert(overrides: Partial<AlertListItem> = {}): AlertListItem {
  return {
    id: 1,
    name: 'Sample',
    alert_type: 'metric_threshold',
    source_kind: 'metric',
    source_id: 10,
    source_name: 'Revenue',
    condition_pretty: 'value > 100',
    rag_states: null,
    kpi_rag_context: null,
    schedule_frequency: 'daily',
    schedule_cron: '30 3 * * *',
    is_active: true,
    last_fire_at: null,
    fire_streak: 0,
    ...overrides,
  };
}

const baseProps = {
  isLoading: false,
  emptyState: <div data-testid="empty">empty</div>,
  canEdit: true,
  canDelete: true,
  onEdit: jest.fn(),
  onDelete: jest.fn(),
  onToggle: jest.fn(),
  onOpenLog: jest.fn(),
};

describe('AlertsTable', () => {
  beforeEach(() => {
    baseProps.onEdit.mockClear();
    baseProps.onDelete.mockClear();
    baseProps.onToggle.mockClear();
    baseProps.onOpenLog.mockClear();
  });

  it('renders an empty state when alerts is empty', () => {
    render(<AlertsTable {...baseProps} alerts={[]} />);
    expect(screen.getByTestId('empty')).toBeInTheDocument();
  });

  it('renders alert rows with name, condition, frequency, last fire', () => {
    const alerts = [
      makeAlert({
        id: 1,
        name: 'Alpha',
        condition_pretty: 'count(*) > 100',
        schedule_frequency: 'weekly',
        fire_streak: 3,
      }),
      makeAlert({
        id: 2,
        name: 'Beta',
        source_kind: 'kpi',
        condition_pretty: 'RAG = red',
        schedule_frequency: 'daily',
      }),
    ];
    render(<AlertsTable {...baseProps} alerts={alerts} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('count(*) > 100')).toBeInTheDocument();
    expect(screen.getByText('RAG = red')).toBeInTheDocument();
  });

  it('dims disabled alert rows', () => {
    const alerts = [makeAlert({ id: 1, name: 'Paused', is_active: false })];
    render(<AlertsTable {...baseProps} alerts={alerts} />);
    const row = screen.getByTestId('alert-row-1');
    expect(row.className).toMatch(/text-gray-400/);
  });

  it('sorts alphabetically when Name header clicked', async () => {
    const user = userEvent.setup();
    const alerts = [
      makeAlert({ id: 1, name: 'Bravo', last_fire_at: '2026-06-11T00:00:00Z' }),
      makeAlert({ id: 2, name: 'Alpha', last_fire_at: '2026-06-10T00:00:00Z' }),
    ];
    render(<AlertsTable {...baseProps} alerts={alerts} />);

    // Default sort = last_fire_at desc → Bravo first
    let rows = screen.getAllByRole('row').filter((r) => r.getAttribute('data-testid'));
    expect(rows[0]).toHaveAttribute('data-testid', 'alert-row-1');

    await user.click(screen.getByTestId('sort-name'));
    rows = screen.getAllByRole('row').filter((r) => r.getAttribute('data-testid'));
    // First click → desc → Bravo first; second click → asc → Alpha first
    expect(rows[0]).toHaveAttribute('data-testid', 'alert-row-1');
    await user.click(screen.getByTestId('sort-name'));
    rows = screen.getAllByRole('row').filter((r) => r.getAttribute('data-testid'));
    expect(rows[0]).toHaveAttribute('data-testid', 'alert-row-2');
  });

  it('invokes onToggle when Switch is clicked', async () => {
    const user = userEvent.setup();
    const alerts = [makeAlert()];
    render(<AlertsTable {...baseProps} alerts={alerts} />);
    await user.click(screen.getByRole('switch'));
    expect(baseProps.onToggle).toHaveBeenCalledWith(alerts[0]);
  });

  it('shows Alert log menu item that calls onOpenLog', async () => {
    const user = userEvent.setup();
    const alerts = [makeAlert()];
    render(<AlertsTable {...baseProps} alerts={alerts} />);
    // The dropdown trigger lives in the actions cell — find via the row.
    const row = screen.getByTestId('alert-row-1');
    const triggers = row.querySelectorAll('[aria-haspopup="menu"]');
    await user.click(triggers[triggers.length - 1] as HTMLElement);
    const logItem = await screen.findByText('Alert log');
    await user.click(logItem);
    expect(baseProps.onOpenLog).toHaveBeenCalledWith(alerts[0]);
  });

  it('renders source subtitle as a link for Metric/KPI', () => {
    const alerts = [
      makeAlert({ id: 1, name: 'Metric alert', source_kind: 'metric', source_id: 42 }),
      makeAlert({
        id: 2,
        name: 'KPI alert',
        source_kind: 'kpi',
        source_id: 99,
        source_name: 'Retention',
      }),
      makeAlert({
        id: 3,
        name: 'Standalone alert',
        source_kind: 'dataset',
        source_id: null,
        source_name: 'analytics.events',
      }),
    ];
    render(<AlertsTable {...baseProps} alerts={alerts} />);

    expect(screen.getByText(/Metric: Revenue/).closest('a')).toHaveAttribute(
      'href',
      '/metrics?highlight=42'
    );
    expect(screen.getByText(/KPI: Retention/).closest('a')).toHaveAttribute(
      'href',
      '/kpis?open=99'
    );
    // Standalone shows plain text, no link
    expect(screen.getByText(/Dataset: analytics.events/).closest('a')).toBeNull();
  });
});

describe('AlertsTable permission gating', () => {
  it('disables the row toggle when canEdit is false', () => {
    const alerts = [makeAlert()];
    render(<AlertsTable {...baseProps} alerts={alerts} canEdit={false} />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('disables the Delete menu item when canDelete is false', async () => {
    const user = userEvent.setup();
    const alerts = [makeAlert()];
    render(<AlertsTable {...baseProps} alerts={alerts} canDelete={false} />);
    const row = screen.getByTestId('alert-row-1');
    const triggers = row.querySelectorAll('[aria-haspopup="menu"]');
    await user.click(triggers[triggers.length - 1] as HTMLElement);
    const del = await screen.findByText('Delete');
    expect(del.closest('[role="menuitem"]')).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('AlertsTable empty states', () => {
  it('AllAlertsEmptyState shows Create Alert dropdown when allowed', async () => {
    const user = userEvent.setup();
    const onCreate = jest.fn();
    render(<AllAlertsEmptyState canCreate={true} onCreate={onCreate} />);
    expect(screen.getByText('No alerts yet')).toBeInTheDocument();

    // The trigger opens the dropdown; menu items dispatch onCreate(type).
    const trigger = screen.getByTestId('empty-create-alert');
    expect(trigger).toBeInTheDocument();
    await user.click(trigger);

    const customItem = await screen.findByTestId('create-standalone-alert');
    await user.click(customItem);
    expect(onCreate).toHaveBeenCalledWith('standalone');
  });

  it('AllAlertsEmptyState hides Create Alert when not allowed', () => {
    render(<AllAlertsEmptyState canCreate={false} onCreate={() => {}} />);
    expect(screen.queryByTestId('empty-create-alert')).not.toBeInTheDocument();
  });
});
