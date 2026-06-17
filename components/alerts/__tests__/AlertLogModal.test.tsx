import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { AlertLogModal } from '../AlertLogModal';
import { apiGet } from '@/lib/api';

const mockApiGet = apiGet as jest.Mock;

function fixtureLog(overrides: any = {}) {
  return {
    id: 100,
    scheduled_for: '2026-06-11T09:00:00Z',
    evaluated_at: '2026-06-11T09:00:01Z',
    value: 42,
    fired: true,
    rag_status: null,
    condition_pretty: 'value > 30',
    sql_executed: 'SELECT count(*) FROM events',
    message: 'Sample alert fired with value 42',
    deliveries: [
      {
        channel: 'email',
        target: 'recipient@example.com',
        status: 'sent',
        error_reason: null,
        http_status: null,
        sent_at: '2026-06-11T09:00:02Z',
      },
      {
        channel: 'slack',
        target: 'slack:webhook',
        status: 'sent',
        error_reason: null,
        http_status: 200,
        sent_at: '2026-06-11T09:00:03Z',
      },
    ],
    ...overrides,
  };
}

function renderModal(alertId: number = 5, alertName: string = 'Latency') {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <AlertLogModal open onOpenChange={() => {}} alertId={alertId} alertName={alertName} />
    </SWRConfig>
  );
}

describe('AlertLogModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the modal title, table header columns and the alert name subtitle', async () => {
    mockApiGet.mockResolvedValue({
      data: [fixtureLog()],
      total: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });
    renderModal(5, 'Latency');
    expect(await screen.findByText('Alert log')).toBeInTheDocument();
    expect(screen.getByText('Latency')).toBeInTheDocument();
    const header = screen.getByTestId('alert-log-table-header');
    expect(header).toHaveTextContent('Time');
    expect(header).toHaveTextContent('Current value');
    expect(header).toHaveTextContent('Alert condition');
    expect(header).toHaveTextContent('Delivery channel');
    expect(header).toHaveTextContent('Recipients');
    expect(header).toHaveTextContent('Action');
  });

  it('renders the row with value, minimal condition, channel label and recipient summary', async () => {
    mockApiGet.mockResolvedValue({
      data: [fixtureLog()],
      total: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });
    renderModal();
    const row = await screen.findByTestId(/log-row-/);
    // Numeric current value
    expect(row).toHaveTextContent('42');
    // Minimal condition (leading "value " stripped)
    expect(row).toHaveTextContent('> 30');
    // Channel summary
    expect(row).toHaveTextContent('Email · Slack');
    // First recipient is in the visible summary
    expect(row).toHaveTextContent('recipient@example.com');
  });

  it('expands a log row to show message body, deliveries and SQL toggle', async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue({
      data: [fixtureLog()],
      total: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });
    renderModal();
    const row = await screen.findByTestId(/log-row-/);
    await user.click(row);

    expect(screen.getByText('Sample alert fired with value 42')).toBeInTheDocument();
    expect(screen.getByText('slack:webhook')).toBeInTheDocument();

    // SQL is hidden by default
    expect(screen.queryByText(/SELECT count/)).not.toBeInTheDocument();
    await user.click(screen.getByTestId(/toggle-sql-/));
    expect(screen.getByText(/SELECT count/)).toBeInTheDocument();
  });

  it('shows "+N" overflow when more than 2 recipients', async () => {
    mockApiGet.mockResolvedValue({
      data: [
        fixtureLog({
          deliveries: [
            {
              channel: 'email',
              target: 'a@org.com',
              status: 'sent',
              sent_at: '2026-06-11T09:00:02Z',
            },
            {
              channel: 'email',
              target: 'b@org.com',
              status: 'sent',
              sent_at: '2026-06-11T09:00:02Z',
            },
            {
              channel: 'email',
              target: 'c@org.com',
              status: 'sent',
              sent_at: '2026-06-11T09:00:02Z',
            },
            {
              channel: 'email',
              target: 'd@org.com',
              status: 'sent',
              sent_at: '2026-06-11T09:00:02Z',
            },
          ],
        }),
      ],
      total: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });
    renderModal();
    const row = await screen.findByTestId(/log-row-/);
    expect(row).toHaveTextContent('a@org.com, b@org.com');
    expect(row).toHaveTextContent('+2');
  });

  it('shows the no-fire callout when the row is expanded for a non-firing evaluation', async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue({
      data: [fixtureLog({ fired: false, value: 5, deliveries: [] })],
      total: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });
    renderModal();
    const row = await screen.findByTestId(/log-row-/);
    await user.click(row);
    expect(screen.getByText(/did not fire/i)).toBeInTheDocument();
  });

  it('shows an empty message when no logs exist', async () => {
    mockApiGet.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      page_size: 10,
      total_pages: 0,
    });
    renderModal();
    expect(await screen.findByText(/No evaluations yet/)).toBeInTheDocument();
  });
});
