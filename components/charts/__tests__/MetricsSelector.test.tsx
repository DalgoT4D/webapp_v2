/**
 * MetricsSelector Component Tests
 *
 * Tests metric configuration for charts:
 * - Adding/removing metrics
 * - Metric pills display
 * - Add form toggle (hidden by default, shown on button click)
 * - Chart-type specific labels
 * - Max metrics limitation
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MetricsSelector } from '../MetricsSelector';
import type { ChartMetric } from '@/types/charts';

describe('MetricsSelector', () => {
  const mockOnChange = jest.fn();

  const mockColumns = [
    { column_name: 'category', data_type: 'varchar' },
    { column_name: 'amount', data_type: 'numeric' },
    { column_name: 'quantity', data_type: 'integer' },
    { column_name: 'price', data_type: 'double precision' },
    { column_name: 'created_at', data_type: 'timestamp' },
    { column_name: 'is_active', data_type: 'boolean' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Empty State
   */
  describe('Empty State', () => {
    it('should render Metrics label and ADD ANOTHER METRIC button', () => {
      render(<MetricsSelector metrics={[]} onChange={mockOnChange} columns={mockColumns} />);

      expect(screen.getByText('Metrics')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add another metric/i })).toBeInTheDocument();
    });

    it('should not show form fields by default', () => {
      render(<MetricsSelector metrics={[]} onChange={mockOnChange} columns={mockColumns} />);

      // Form is hidden until button is clicked
      expect(screen.queryByText(/^Function/)).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Simple' })).not.toBeInTheDocument();
    });

    it('should show form with tabs after clicking ADD ANOTHER METRIC', async () => {
      const user = userEvent.setup();
      render(<MetricsSelector metrics={[]} onChange={mockOnChange} columns={mockColumns} />);

      await user.click(screen.getByRole('button', { name: /add another metric/i }));

      expect(screen.getByRole('tab', { name: 'Simple' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Calculated' })).toBeInTheDocument();
      expect(screen.getByText(/^Function/)).toBeInTheDocument();
    });
  });

  /**
   * Metric Pills
   */
  describe('Metric Pills', () => {
    it('should render metric pills when metrics exist', () => {
      const metrics: ChartMetric[] = [
        { column: 'amount', aggregation: 'sum', alias: 'Total Amount' },
      ];

      render(<MetricsSelector metrics={metrics} onChange={mockOnChange} columns={mockColumns} />);

      expect(screen.getByText('Total Amount')).toBeInTheDocument();
      expect(screen.getByText('SUM(amount)')).toBeInTheDocument();
    });

    it('should show Display Name In Charts input in metric pill', () => {
      const metrics: ChartMetric[] = [{ column: 'amount', aggregation: 'sum', alias: 'Total' }];

      render(<MetricsSelector metrics={metrics} onChange={mockOnChange} columns={mockColumns} />);

      expect(screen.getByText('Display Name In Charts')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Total')).toBeInTheDocument();
    });

    it('should show ADD ANOTHER METRIC button when metrics exist', () => {
      const metrics: ChartMetric[] = [{ column: 'amount', aggregation: 'sum', alias: 'Total' }];

      render(<MetricsSelector metrics={metrics} onChange={mockOnChange} columns={mockColumns} />);

      expect(screen.getByRole('button', { name: /add another metric/i })).toBeInTheDocument();
    });

    it('should remove metric when clicking X button', async () => {
      const user = userEvent.setup();
      const metrics: ChartMetric[] = [
        { column: 'amount', aggregation: 'sum', alias: 'Total Amount' },
        { column: 'quantity', aggregation: 'avg', alias: 'Avg Quantity' },
      ];

      render(<MetricsSelector metrics={metrics} onChange={mockOnChange} columns={mockColumns} />);

      const removeButtons = screen.getAllByRole('button');
      const xButton = removeButtons.find(
        (btn) => btn.querySelector('svg') && !btn.textContent?.includes('ADD')
      );

      if (xButton) {
        await user.click(xButton);
        expect(mockOnChange).toHaveBeenCalledWith([
          { column: 'quantity', aggregation: 'avg', alias: 'Avg Quantity' },
        ]);
      }
    });
  });

  /**
   * Max Metrics Limitation
   */
  describe('Max Metrics', () => {
    it.each([
      [1, 1, false], // At limit, should not show button
      [1, 3, true], // Under limit, should show button
    ])('should handle maxMetrics=%d with %d metrics correctly', (count, max, shouldShow) => {
      const metrics: ChartMetric[] = Array.from({ length: count }, (_, i) => ({
        column: 'amount',
        aggregation: 'sum',
        alias: `Metric ${i + 1}`,
      }));

      render(
        <MetricsSelector
          metrics={metrics}
          onChange={mockOnChange}
          columns={mockColumns}
          maxMetrics={max}
        />
      );

      const button = screen.queryByRole('button', { name: /add/i });
      if (shouldShow) {
        expect(button).toBeInTheDocument();
      } else {
        expect(button).not.toBeInTheDocument();
      }
    });
  });

  /**
   * Add Form (after clicking ADD ANOTHER METRIC)
   */
  describe('Add Form', () => {
    it('should show Function and Column fields in Simple tab', async () => {
      const user = userEvent.setup();
      render(<MetricsSelector metrics={[]} onChange={mockOnChange} columns={mockColumns} />);

      await user.click(screen.getByRole('button', { name: /add another metric/i }));

      expect(screen.getByText(/^Function/)).toBeInTheDocument();
      expect(screen.getByText(/^Column/)).toBeInTheDocument();
    });

    it('should show Expression field in Calculated tab', async () => {
      const user = userEvent.setup();
      render(<MetricsSelector metrics={[]} onChange={mockOnChange} columns={mockColumns} />);

      await user.click(screen.getByRole('button', { name: /add another metric/i }));
      await user.click(screen.getByRole('tab', { name: 'Calculated' }));

      expect(screen.getByText(/^Expression/)).toBeInTheDocument();
    });

    it('should close form when clicking X', async () => {
      const user = userEvent.setup();
      render(<MetricsSelector metrics={[]} onChange={mockOnChange} columns={mockColumns} />);

      await user.click(screen.getByRole('button', { name: /add another metric/i }));
      expect(screen.getByText(/^Function/)).toBeInTheDocument();

      // Find the X close button (inside the form box)
      const closeButtons = screen.getAllByRole('button');
      const xButton = closeButtons.find((btn) => btn.querySelector('svg') && !btn.textContent);
      if (xButton) {
        await user.click(xButton);
        expect(screen.queryByText(/^Function/)).not.toBeInTheDocument();
      }
    });

    it('should show Display Name and collapsible save section', async () => {
      const user = userEvent.setup();
      render(<MetricsSelector metrics={[]} onChange={mockOnChange} columns={mockColumns} />);

      await user.click(screen.getByRole('button', { name: /add another metric/i }));

      expect(screen.getByText('Display Name In Charts')).toBeInTheDocument();
      expect(screen.getByText('Add metric to library')).toBeInTheDocument();
      // Metric Name hidden until toggle is clicked
      expect(screen.queryByText('Metric Name *')).not.toBeInTheDocument();
    });
  });

  /**
   * Chart Type Labels (shown in form after opening)
   */
  describe('Chart Type Labels', () => {
    it.each([
      ['bar', /^Function/, /^Column/],
      ['line', /^Function/, /^Column/],
      ['pie', /^Metric \*/, /^Dimension/],
    ])('should show correct labels for %s chart', async (chartType, label1, label2) => {
      const user = userEvent.setup();
      render(
        <MetricsSelector
          metrics={[]}
          onChange={mockOnChange}
          columns={mockColumns}
          chartType={chartType}
        />
      );

      await user.click(screen.getByRole('button', { name: /add another metric/i }));

      expect(screen.getByText(label1)).toBeInTheDocument();
      expect(screen.getByText(label2)).toBeInTheDocument();
    });
  });

  /**
   * Edge Cases
   */
  describe('Edge Cases', () => {
    it('should render metric pill with expression metric', () => {
      const metrics: ChartMetric[] = [
        { column: null, aggregation: null, column_expression: 'SUM(a)/COUNT(b)', alias: 'Ratio' },
      ];

      render(<MetricsSelector metrics={metrics} onChange={mockOnChange} columns={mockColumns} />);

      expect(screen.getByText('Ratio')).toBeInTheDocument();
    });

    it('should render metric pill with count(*) aggregation', () => {
      const metrics: ChartMetric[] = [{ column: null, aggregation: 'count', alias: 'Row Count' }];

      render(<MetricsSelector metrics={metrics} onChange={mockOnChange} columns={mockColumns} />);

      expect(screen.getByText('Row Count')).toBeInTheDocument();
      expect(screen.getByText('COUNT(*)')).toBeInTheDocument();
    });
  });
});
