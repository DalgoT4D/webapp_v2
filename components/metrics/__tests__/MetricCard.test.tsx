import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MetricCard } from '../MetricCard';
import type { MetricDefinition } from '@/types/metrics';

jest.mock('../MetricSparkline', () => ({
  MetricSparkline: () => <div data-testid="metric-sparkline" />,
}));

jest.mock('../RAGBadge', () => ({
  RAGBadge: () => <div data-testid="rag-badge" />,
}));

const metric: MetricDefinition = {
  id: 9,
  name: 'Attendance Rate',
  schema_name: 'analytics',
  table_name: 'student_progress_quarterly',
  column: 'attendance_rate',
  aggregation: 'avg',
  time_column: 'period',
  time_grain: 'month',
  direction: 'increase',
  target_value: 90,
  amber_threshold_pct: 80,
  green_threshold_pct: 100,
  program_tag: 'Education',
  metric_type_tag: 'Outcome',
  trend_periods: 12,
  display_order: 1,
  created_at: '2026-04-14T12:00:00Z',
  updated_at: '2026-04-14T12:00:00Z',
};

describe('MetricCard', () => {
  it('shows edit, create alert, and view alerts actions in the overflow menu', async () => {
    const user = userEvent.setup();
    const onEdit = jest.fn();
    const onCreateAlert = jest.fn();
    const onViewAlerts = jest.fn();
    const onDelete = jest.fn();

    render(
      <MetricCard
        metric={metric}
        canEdit
        canCreateAlert
        canViewAlerts
        onEdit={onEdit}
        onCreateAlert={onCreateAlert}
        onViewAlerts={onViewAlerts}
        onDelete={onDelete}
      />
    );

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('menuitem', { name: 'Edit metric' }));
    expect(onEdit).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('menuitem', { name: 'Create alert' }));
    expect(onCreateAlert).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('menuitem', { name: 'View alerts' }));
    expect(onViewAlerts).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
