import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MetricConfigDialog } from '../MetricConfigDialog';
import * as chartHooks from '@/hooks/api/useChart';
import type { MetricDefinition } from '@/types/metrics';

jest.mock('@/hooks/api/useChart');
jest.mock('@/components/charts/DatasetSelector', () => ({
  DatasetSelector: () => <div data-testid="dataset-selector">Dataset selector</div>,
}));

const metric: MetricDefinition = {
  id: 4,
  name: 'Attendance metric',
  schema_name: 'analytics',
  table_name: 'attendance_fact',
  column: 'attendance',
  aggregation: 'sum',
  time_column: 'captured_at',
  time_grain: 'month',
  direction: 'increase' as const,
  target_value: 100,
  amber_threshold_pct: 80,
  green_threshold_pct: 100,
  program_tag: 'Health',
  metric_type_tag: 'Output',
  trend_periods: 12,
  display_order: 1,
  created_at: '2026-04-14T12:00:00Z',
  updated_at: '2026-04-14T12:00:00Z',
};

describe('MetricConfigDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (chartHooks.useColumns as jest.Mock).mockReturnValue({
      data: [
        { name: 'attendance', data_type: 'integer' },
        { name: 'captured_at', data_type: 'timestamp' },
      ],
    });
  });

  it('updates the metric without showing a save-and-alert action', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <MetricConfigDialog
        open
        onOpenChange={jest.fn()}
        metric={metric}
        existingProgramTags={['Health']}
        onSave={onSave}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Attendance metric')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Save & Add Alert' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Update Metric' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Attendance metric',
        schema_name: 'analytics',
        table_name: 'attendance_fact',
        column: 'attendance',
        aggregation: 'sum',
        direction: 'increase',
        metric_type_tag: 'Output',
      })
    );
  });
});
