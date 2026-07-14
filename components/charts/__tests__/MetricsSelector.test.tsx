/**
 * MetricsSelector — orchestrator tests (unified accordion design).
 * Each metric is a collapsible accordion item; "+ ADD ANOTHER METRIC" appends a default COUNT(*).
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MetricsSelector } from '../MetricsSelector';
import type { ChartMetric } from '@/types/charts';

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

describe('MetricsSelector', () => {
  const mockOnChange = jest.fn();
  const mockColumns = [
    { column_name: 'category', data_type: 'varchar' },
    { column_name: 'amount', data_type: 'numeric' },
    { column_name: 'quantity', data_type: 'integer' },
  ];

  beforeEach(() => jest.clearAllMocks());

  describe('Empty state', () => {
    it('shows the Metrics label and the add button, no accordion', () => {
      render(<MetricsSelector metrics={[]} onChange={mockOnChange} columns={mockColumns} />);
      expect(screen.getByText('Metrics')).toBeInTheDocument();
      expect(screen.getByTestId('add-metric-button')).toBeInTheDocument();
      expect(screen.queryByTestId('metric-trigger-0')).not.toBeInTheDocument();
    });

    it('appends a default COUNT(*) metric when the add button is clicked', async () => {
      const user = userEvent.setup();
      render(<MetricsSelector metrics={[]} onChange={mockOnChange} columns={mockColumns} />);
      await user.click(screen.getByTestId('add-metric-button'));
      expect(mockOnChange).toHaveBeenCalledWith([
        expect.objectContaining({ aggregation: 'count', column: null }),
      ]);
    });
  });

  describe('Metric accordion', () => {
    const metrics: ChartMetric[] = [{ column: 'amount', aggregation: 'sum', alias: 'Total' }];

    it('renders existing metrics collapsed (form hidden until expanded)', () => {
      render(<MetricsSelector metrics={metrics} onChange={mockOnChange} columns={mockColumns} />);
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Simple' })).not.toBeInTheDocument();
    });

    it('expanding a metric reveals the Simple/Calculated/Saved tabs', async () => {
      const user = userEvent.setup();
      render(<MetricsSelector metrics={metrics} onChange={mockOnChange} columns={mockColumns} />);
      await user.click(screen.getByTestId('metric-trigger-0'));
      expect(screen.getByRole('tab', { name: 'Simple' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Calculated' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Saved' })).toBeInTheDocument();
    });

    it('removes a metric when its X is clicked', async () => {
      const user = userEvent.setup();
      const two: ChartMetric[] = [
        { column: 'amount', aggregation: 'sum', alias: 'A' },
        { column: 'quantity', aggregation: 'avg', alias: 'B' },
      ];
      render(<MetricsSelector metrics={two} onChange={mockOnChange} columns={mockColumns} />);
      await user.click(screen.getAllByRole('button', { name: /remove metric/i })[0]);
      expect(mockOnChange).toHaveBeenCalledWith([
        { column: 'quantity', aggregation: 'avg', alias: 'B' },
      ]);
    });

    it('hides the add button when maxMetrics is reached', () => {
      render(
        <MetricsSelector
          metrics={metrics}
          onChange={mockOnChange}
          columns={mockColumns}
          maxMetrics={1}
        />
      );
      expect(screen.queryByTestId('add-metric-button')).not.toBeInTheDocument();
    });
  });

  describe('Auto-expand (isNewChart)', () => {
    const one: ChartMetric[] = [{ column: 'amount', aggregation: 'sum', alias: 'Total' }];

    it('auto-expands the prefilled metric on a new chart', () => {
      render(
        <MetricsSelector metrics={one} onChange={mockOnChange} columns={mockColumns} isNewChart />
      );
      expect(screen.getByRole('tab', { name: 'Simple' })).toBeInTheDocument();
    });

    it('does NOT auto-expand in edit flow', () => {
      render(<MetricsSelector metrics={one} onChange={mockOnChange} columns={mockColumns} />);
      expect(screen.queryByRole('tab', { name: 'Simple' })).not.toBeInTheDocument();
    });

    it('auto-expands a metric added asynchronously after mount (real prefill path)', async () => {
      const { rerender } = render(
        <MetricsSelector metrics={[]} onChange={mockOnChange} columns={mockColumns} isNewChart />
      );
      expect(screen.queryByRole('tab', { name: 'Simple' })).not.toBeInTheDocument();
      rerender(
        <MetricsSelector metrics={one} onChange={mockOnChange} columns={mockColumns} isNewChart />
      );
      expect(await screen.findByRole('tab', { name: 'Simple' })).toBeInTheDocument();
    });
  });
});
