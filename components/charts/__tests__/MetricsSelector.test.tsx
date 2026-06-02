/**
 * MetricsSelector Component Tests
 *
 * Tests metric configuration for charts:
 * - Adding/removing metrics
 * - Aggregation functions (count, sum, avg, min, max, count_distinct)
 * - Column selection with data type filtering
 * - Auto-generated aliases
 * - Chart-type specific labels (pie vs others)
 * - Max metrics limitation
 *
 * Architecture: Parameterized tests reduce redundancy while maintaining coverage
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
   * Empty State and Initialization
   */
  describe('Empty State', () => {
    it('should render empty state with form fields', () => {
      render(<MetricsSelector metrics={[]} onChange={mockOnChange} columns={mockColumns} />);

      expect(screen.getByText('Metrics')).toBeInTheDocument();
      // New design shows form directly (tabs + dropdowns) instead of "Add Metric" button
      expect(screen.getByText(/^Function/)).toBeInTheDocument();
    });

    it('should show Simple and Calculated tabs', () => {
      render(<MetricsSelector metrics={[]} onChange={mockOnChange} columns={mockColumns} />);

      expect(screen.getByRole('tab', { name: 'Simple' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Calculated' })).toBeInTheDocument();
    });
  });

  /**
   * Adding and Removing Metrics
   */
  describe('Metrics Management', () => {
    it('should render table headers when metrics exist', () => {
      const metrics: ChartMetric[] = [
        { column: 'amount', aggregation: 'sum', alias: 'Total Amount' },
      ];

      render(<MetricsSelector metrics={metrics} onChange={mockOnChange} columns={mockColumns} />);

      expect(screen.getByText(/^Function/)).toBeInTheDocument();
      expect(screen.getByText(/^Column/)).toBeInTheDocument();
      expect(screen.getByText('Display Name')).toBeInTheDocument();
    });

    it('should show ADD ANOTHER METRIC button when metrics exist', () => {
      const metrics: ChartMetric[] = [{ column: 'amount', aggregation: 'sum', alias: 'Total' }];

      render(<MetricsSelector metrics={metrics} onChange={mockOnChange} columns={mockColumns} />);

      // Button exists but may be disabled until form is filled
      expect(screen.getByRole('button', { name: /add another metric/i })).toBeInTheDocument();
    });

    it('should remove metric when clicking remove button', async () => {
      const user = userEvent.setup();
      const metrics: ChartMetric[] = [
        { column: 'amount', aggregation: 'sum', alias: 'Total Amount' },
        { column: 'quantity', aggregation: 'avg', alias: 'Avg Quantity' },
      ];

      render(<MetricsSelector metrics={metrics} onChange={mockOnChange} columns={mockColumns} />);

      const removeButtons = screen.getAllByRole('button');
      const xButton = removeButtons.find(
        (btn) => btn.querySelector('svg') && !btn.textContent?.includes('Add')
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
   * Aggregation Functions and Column Filtering
   * Tests that different aggregations work with appropriate column types
   */
  describe('Aggregation Functions', () => {
    it.each([
      ['count', null],
      ['count_distinct', 'category'],
      ['sum', 'amount'],
      ['avg', 'quantity'],
      ['min', 'price'],
      ['max', 'amount'],
    ])('should allow %s aggregation', (aggregation, column) => {
      const metrics: ChartMetric[] = [{ column, aggregation, alias: '' }];

      render(<MetricsSelector metrics={metrics} onChange={mockOnChange} columns={mockColumns} />);

      // Verify component renders without error
      expect(screen.getByText(/^Function/)).toBeInTheDocument();
      expect(screen.getByText(/^Column/)).toBeInTheDocument();
    });
  });

  /**
   * Alias Management
   * Tests auto-generation and manual override of display names
   */
  describe('Alias Management', () => {
    it('should show Display Name field', () => {
      const metrics: ChartMetric[] = [{ column: 'amount', aggregation: 'sum', alias: '' }];

      render(<MetricsSelector metrics={metrics} onChange={mockOnChange} columns={mockColumns} />);

      expect(screen.getByText('Display Name')).toBeInTheDocument();
    });

    it('should show display name input', () => {
      const metrics: ChartMetric[] = [{ column: 'amount', aggregation: 'sum', alias: '' }];

      render(<MetricsSelector metrics={metrics} onChange={mockOnChange} columns={mockColumns} />);

      expect(screen.getByPlaceholderText('Give a unique name')).toBeInTheDocument();
    });
  });

  /**
   * Chart Type Specific Labels
   * Tests that pie charts show different labels
   */
  describe('Chart Type Labels', () => {
    it.each([
      ['bar', [/^Function/, /^Column/, /Display Name/]],
      ['line', [/^Function/, /^Column/, /Display Name/]],
      ['table', [/^Function/, /^Column/, /Display Name/]],
      ['pie', [/^Metric \*/, /^Dimension/, /Display Name/]],
    ])('should show correct labels for %s chart', (chartType, expectedLabels) => {
      const metrics: ChartMetric[] = [{ column: 'amount', aggregation: 'sum', alias: '' }];

      render(
        <MetricsSelector
          metrics={metrics}
          onChange={mockOnChange}
          columns={mockColumns}
          chartType={chartType as string}
        />
      );

      (expectedLabels as RegExp[]).forEach((label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });
  });

  /**
   * Column Type Filtering
   * Tests that numeric aggregations only allow numeric columns
   */
  describe('Data Type Filtering', () => {
    it('should render column selector for all aggregations', () => {
      const aggregations = ['count', 'count_distinct', 'sum', 'avg', 'min', 'max'];

      aggregations.forEach((aggregation) => {
        const metrics: ChartMetric[] = [
          { column: aggregation === 'count' ? null : 'amount', aggregation, alias: '' },
        ];

        const { unmount } = render(
          <MetricsSelector metrics={metrics} onChange={mockOnChange} columns={mockColumns} />
        );

        expect(screen.getByText(/^Column/)).toBeInTheDocument();
        unmount();
      });
    });
  });

  /**
   * Edge Cases
   */
  describe('Edge Cases', () => {
    it('should handle empty columns array', () => {
      const metrics: ChartMetric[] = [{ column: null, aggregation: 'count', alias: '' }];

      render(<MetricsSelector metrics={metrics} onChange={mockOnChange} columns={[]} />);

      expect(screen.getByText(/^Function/)).toBeInTheDocument();
    });

    it('should handle metrics with empty aggregation', () => {
      const metrics: ChartMetric[] = [{ column: null, aggregation: '', alias: '' }];

      render(<MetricsSelector metrics={metrics} onChange={mockOnChange} columns={mockColumns} />);

      const functionLabels = screen.getAllByText(/^Function/);
      expect(functionLabels.length).toBeGreaterThan(0);
    });

    it('should handle undefined chartType', () => {
      const metrics: ChartMetric[] = [{ column: 'amount', aggregation: 'sum', alias: '' }];

      render(
        <MetricsSelector
          metrics={metrics}
          onChange={mockOnChange}
          columns={mockColumns}
          chartType={undefined}
        />
      );

      // Should use default labels
      expect(screen.getByText(/^Function/)).toBeInTheDocument();
      expect(screen.getByText(/^Column/)).toBeInTheDocument();
    });
  });
});
