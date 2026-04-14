import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AlertList } from '../AlertList';
import * as alertsHooks from '@/hooks/api/useAlerts';

const mockPush = jest.fn();

jest.mock('@/hooks/api/useAlerts');
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/components/ui/confirmation-dialog', () => ({
  useConfirmationDialog: () => ({
    confirm: jest.fn().mockResolvedValue(true),
    DialogComponent: (): null => null,
  }),
}));
jest.mock('@/lib/toast', () => ({
  toastSuccess: { deleted: jest.fn() },
  toastError: { delete: jest.fn() },
}));

describe('AlertList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (alertsHooks.useAlerts as jest.Mock).mockReturnValue({
      alerts: [
        {
          id: 1,
          name: 'Attendance threshold alert',
          metric_id: 11,
          metric_name: 'Attendance Metric',
          query_config: {
            schema_name: 'analytics',
            table_name: 'attendance_fact',
            filters: [],
            filter_connector: 'AND',
            aggregation: 'SUM',
            measure_column: 'attendance',
            group_by_column: 'district_name',
            condition_operator: '<',
            condition_value: 10,
          },
          recipients: ['ops@example.com'],
          message: 'Alert message',
          group_message: '{{group_by_value}} {{alert_value}}',
          message_placeholders: [],
          is_active: true,
          created_at: '2026-04-14T12:00:00Z',
          updated_at: '2026-04-14T12:00:00Z',
          last_evaluated_at: '2026-04-14T12:00:00Z',
          last_fired_at: '2026-04-14T12:00:00Z',
          fire_streak: 2,
        },
      ],
      total: 1,
      isLoading: false,
      mutate: jest.fn(),
    });
    (alertsHooks.useTriggeredAlerts as jest.Mock).mockReturnValue({
      events: [
        {
          id: 21,
          alert_id: 1,
          alert_name: 'Attendance threshold alert',
          metric_id: 11,
          metric_name: 'Attendance Metric',
          rows_returned: 2,
          num_recipients: 1,
          rendered_message: 'North attendance: 8',
          result_preview: [{ district_name: 'North', alert_value: 8 }],
          trigger_flow_run_id: 'flow-run-123',
          created_at: '2026-04-14T12:00:00Z',
        },
      ],
      total: 1,
      isLoading: false,
    });
  });

  it('renders configured alerts by default', () => {
    render(<AlertList />);

    expect(screen.getByText('Attendance threshold alert')).toBeInTheDocument();
    expect(screen.getByText('Attendance Metric')).toBeInTheDocument();
    expect(
      screen.getByText(/SUM < 10 on attendance · Group by district_name/i)
    ).toBeInTheDocument();
  });

  it('renders grouped triggered alerts and opens an instance detail route', async () => {
    const user = userEvent.setup();

    render(<AlertList />);
    await user.click(screen.getByRole('tab', { name: 'Triggered' }));
    await user.click(screen.getByRole('button', { name: /attendance threshold alert/i }));

    expect(screen.getByText('North attendance: 8')).toBeInTheDocument();
    await user.click(screen.getByText('North attendance: 8'));
    expect(mockPush).toHaveBeenCalledWith('/alerts/1/fired/21');
  });
});
