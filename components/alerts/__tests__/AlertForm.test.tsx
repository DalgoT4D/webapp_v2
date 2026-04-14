import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AlertForm } from '../AlertForm';
import * as metricsHooks from '@/hooks/api/useMetrics';
import * as warehouseHooks from '@/hooks/api/useWarehouse';
import type { Alert } from '@/types/alert';
import type { MetricDefinition } from '@/types/metrics';

jest.mock('@/hooks/api/useMetrics');
jest.mock('@/hooks/api/useWarehouse');
jest.mock('@/components/charts/DatasetSelector', () => ({
  DatasetSelector: () => <div data-testid="dataset-selector">Dataset selector</div>,
}));
jest.mock('@/components/alerts/FilterRow', () => ({
  FilterRow: () => <div data-testid="filter-row">Filter row</div>,
}));
jest.mock('@/components/alerts/AlertTestPreview', () => ({
  AlertTestPreview: () => <div data-testid="alert-test-preview">Alert preview</div>,
}));

const mockMetric: MetricDefinition = {
  id: 1,
  name: 'Attendance Metric',
  schema_name: 'analytics',
  table_name: 'attendance_fact',
  column: 'attendance',
  aggregation: 'sum',
  time_column: null,
  time_grain: 'month',
  direction: 'increase' as const,
  target_value: 100,
  amber_threshold_pct: 80,
  green_threshold_pct: 100,
  program_tag: 'Health',
  metric_type_tag: 'Output',
  trend_periods: 12,
  display_order: 0,
  created_at: '2026-04-14T12:00:00Z',
  updated_at: '2026-04-14T12:00:00Z',
};

const baseAlert: Alert = {
  id: 7,
  name: 'Grouped attendance alert',
  metric_id: null,
  metric_name: null,
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
  message: 'The following {{group_by_column}} values failed {{alert_name}}.',
  group_message: '{{group_by_value}} {{alert_value}}',
  message_placeholders: [],
  is_active: true,
  created_at: '2026-04-14T12:00:00Z',
  updated_at: '2026-04-14T12:00:00Z',
  last_evaluated_at: null,
  last_fired_at: null,
  fire_streak: 0,
};

describe('AlertForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (metricsHooks.useMetrics as jest.Mock).mockReturnValue({ data: [mockMetric] });
    (warehouseHooks.useTableColumns as jest.Mock).mockReturnValue({
      data: [
        { name: 'attendance', data_type: 'integer' },
        { name: 'district_name', data_type: 'text' },
        { name: 'enrolled', data_type: 'integer' },
      ],
    });
  });

  it('renders metric-backed mode when a metric is preselected', async () => {
    render(
      <AlertForm
        initialMetricId={mockMetric.id}
        onSave={jest.fn().mockResolvedValue(undefined)}
        onCancel={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('analytics.attendance_fact')).toBeInTheDocument();
    });

    expect(screen.getByText('Metric-backed')).toBeInTheDocument();
    expect(screen.getByDisplayValue('analytics.attendance_fact')).toBeInTheDocument();
    expect(screen.getByDisplayValue('attendance')).toBeInTheDocument();
    expect(screen.queryByTestId('dataset-selector')).not.toBeInTheDocument();
  });

  it('adds a dataset token without auto-inserting it, then inserts on click', async () => {
    const user = userEvent.setup();

    render(<AlertForm onSave={jest.fn().mockResolvedValue(undefined)} onCancel={jest.fn()} />);

    const messageBox = screen.getByLabelText('Email body');
    await user.click(screen.getByRole('button', { name: /add dataset token/i }));
    expect(screen.getByRole('heading', { name: 'Add dataset token' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add token' }));

    expect(
      screen.getByRole('button', { name: 'Insert SUM(attendance) token' })
    ).toBeInTheDocument();
    expect((messageBox as HTMLTextAreaElement).value).not.toContain('{{sum_attendance}}');

    await user.click(messageBox);
    await user.click(screen.getByRole('button', { name: 'Insert SUM(attendance) token' }));

    await waitFor(() => {
      expect((messageBox as HTMLTextAreaElement).value).toContain('{{sum_attendance}}');
    });
  });

  it('shows grouped message fields and per-group tokens when group_by_column is configured', async () => {
    render(
      <AlertForm
        alert={baseAlert}
        onSave={jest.fn().mockResolvedValue(undefined)}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByLabelText('Email body')).toBeInTheDocument();
    expect(screen.getByLabelText('Per failing group section')).toBeInTheDocument();
    expect(screen.getByText('Group tokens')).toBeInTheDocument();
    expect(screen.getAllByText('Group by Column', { exact: false }).length).toBeGreaterThan(0);
  });
});
