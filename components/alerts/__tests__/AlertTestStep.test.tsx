import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertTestStep } from '../AlertTestStep';
import { apiPost } from '@/lib/api';
import type { AlertTestPayload } from '@/types/alerts';

const mockApiPost = apiPost as jest.Mock;

function basePayload(): AlertTestPayload {
  return {
    name: 'My alert',
    alert_type: 'standalone',
    metric_id: null,
    kpi_id: null,
    standalone_config: {
      schema_name: 'analytics',
      table_name: 'events',
      column: 'id',
      aggregation: 'count',
    },
    condition: { operator: 'lt', value: 50 },
    delivery_channels: ['email'],
    message_template: '{{alert_name}}: {{current_value}}',
  };
}

describe('AlertTestStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a would-fire banner with the rendered message', async () => {
    mockApiPost.mockResolvedValueOnce({
      would_fire: true,
      current_value: 42,
      sql_executed: 'SELECT COUNT(id) FROM analytics.events',
      message: 'My alert: 42',
      error: null,
    });

    render(<AlertTestStep payload={basePayload()} />);

    await waitFor(() => {
      expect(screen.getByTestId('test-step-would-fire')).toBeInTheDocument();
    });
    expect(screen.getByText('My alert: 42')).toBeInTheDocument();
    expect(screen.getByTestId('test-step-would-fire')).toHaveTextContent(/will fire/i);
    expect(screen.getByTestId('test-step-outcome')).toHaveTextContent('Current value: 42');
    expect(mockApiPost).toHaveBeenCalledWith('/api/alerts/test/', expect.anything());
  });

  it('renders a would-not-fire banner when the condition is unmet', async () => {
    mockApiPost.mockResolvedValueOnce({
      would_fire: false,
      current_value: 999,
      sql_executed: 'SELECT COUNT(id) FROM analytics.events',
      message: 'My alert: 999',
      error: null,
    });

    render(<AlertTestStep payload={basePayload()} />);

    await waitFor(() => {
      expect(screen.getByTestId('test-step-would-not-fire')).toBeInTheDocument();
    });
    expect(screen.getByTestId('test-step-would-not-fire')).toHaveTextContent(/will not fire/i);
    expect(screen.getByTestId('test-step-outcome')).toHaveTextContent('Current value: 999');
  });

  it('renders empty-result banner when current_value is null', async () => {
    mockApiPost.mockResolvedValueOnce({
      would_fire: false,
      current_value: null,
      sql_executed: 'SELECT COUNT(id) FROM analytics.events',
      message: '',
      error: null,
    });

    render(<AlertTestStep payload={basePayload()} />);

    await waitFor(() => {
      expect(screen.getByTestId('test-step-empty')).toBeInTheDocument();
    });
  });

  it('renders backend-error block when result.error is set', async () => {
    mockApiPost.mockResolvedValueOnce({
      would_fire: false,
      current_value: null,
      sql_executed: '',
      message: '',
      error: 'No warehouse configured for this org',
    });

    render(<AlertTestStep payload={basePayload()} />);

    await waitFor(() => {
      expect(screen.getByTestId('test-step-backend-error')).toBeInTheDocument();
    });
    expect(screen.getByText(/No warehouse configured/i)).toBeInTheDocument();
  });

  it('renders network-error block when the request itself throws', async () => {
    mockApiPost.mockRejectedValueOnce(new Error('Network down'));

    render(<AlertTestStep payload={basePayload()} />);

    await waitFor(() => {
      expect(screen.getByTestId('test-step-error')).toBeInTheDocument();
    });
    expect(screen.getByText(/Network down/i)).toBeInTheDocument();
  });

  it('expands SQL when the toggle is clicked', async () => {
    mockApiPost.mockResolvedValueOnce({
      would_fire: true,
      current_value: 42,
      sql_executed: 'SELECT 1',
      message: 'M',
      error: null,
    });

    const user = userEvent.setup();
    render(<AlertTestStep payload={basePayload()} />);

    await waitFor(() => {
      expect(screen.getByTestId('test-step-outcome')).toBeInTheDocument();
    });

    expect(screen.queryByText('SELECT 1')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('test-step-sql-toggle'));
    expect(screen.getByText('SELECT 1')).toBeInTheDocument();
  });

  it('re-runs the dry-run when payload changes', async () => {
    mockApiPost.mockResolvedValue({
      would_fire: false,
      current_value: 0,
      sql_executed: 'SELECT 1',
      message: '',
      error: null,
    });

    const { rerender } = render(<AlertTestStep payload={basePayload()} />);
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledTimes(1));

    const p2 = basePayload();
    p2.condition = { operator: 'gt', value: 100 };
    rerender(<AlertTestStep payload={p2} />);
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledTimes(2));
  });
});
