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

      const removeButtons = screen.getAllByRole('button', { name: /remove metric/i });

      if (removeButtons[0]) {
        await user.click(removeButtons[0]);
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
      render(
        <MetricsSelector
          metrics={[]}
          onChange={mockOnChange}
          columns={mockColumns}
          schemaName="public"
          tableName="orders"
        />
      );

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

  /**
   * Live draft — the open Simple-mode form is mirrored into the payload as a trailing metric
   * WITHOUT requiring an explicit "+ ADD ANOTHER METRIC" click. Regression coverage for the
   * "metrics: Field required" / "At least one metric is required" save & preview failures.
   */
  describe('Live draft in payload', () => {
    // Controlled wrapper that echoes onChange back into the metrics prop (mirrors real usage in
    // ChartDataConfigurationV3, where formData.metrics is the source of truth).
    function Harness({
      initial = [],
      chartType = 'bar',
      maxMetrics,
    }: {
      initial?: ChartMetric[];
      chartType?: string;
      maxMetrics?: number;
    }) {
      const [metrics, setMetrics] = React.useState<ChartMetric[]>(initial);
      return (
        <>
          <MetricsSelector
            metrics={metrics}
            onChange={setMetrics}
            columns={mockColumns}
            chartType={chartType}
            maxMetrics={maxMetrics}
          />
          <div data-testid="metrics-json">{JSON.stringify(metrics)}</div>
        </>
      );
    }

    const readMetrics = (): ChartMetric[] =>
      JSON.parse(screen.getByTestId('metrics-json').textContent || '[]');

    it('adds a count draft to the payload as soon as the form opens', async () => {
      render(<MetricsSelector metrics={[]} onChange={mockOnChange} columns={mockColumns} />);

      await userEvent.setup().click(screen.getByRole('button', { name: /add another metric/i }));

      expect(mockOnChange).toHaveBeenCalledWith([
        expect.objectContaining({ aggregation: 'count', column: null }),
      ]);
    });

    it('pre-fills the Display Name field with the auto-generated label (matches the legend)', async () => {
      const user = userEvent.setup();
      render(<MetricsSelector metrics={[]} onChange={mockOnChange} columns={mockColumns} />);

      await user.click(screen.getByRole('button', { name: /add another metric/i }));

      // Default count draft → field shows "COUNT(*)" rather than being blank.
      expect(screen.getByDisplayValue('COUNT(*)')).toBeInTheDocument();
    });

    it('keeps the draft out of the committed list while the form is open', async () => {
      const user = userEvent.setup();
      render(<Harness initial={[{ column: null, aggregation: 'count', alias: 'Total Count' }]} />);

      await user.click(screen.getByRole('button', { name: /add another metric/i }));

      // Draft is in the payload (2 metrics) ...
      expect(readMetrics()).toHaveLength(2);
      // ... but only the committed metric renders as a removable pill.
      expect(screen.getAllByRole('button', { name: /remove metric/i })).toHaveLength(1);
    });

    it('discards the draft when the form is cancelled with X', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(screen.getByRole('button', { name: /add another metric/i }));
      expect(readMetrics()).toHaveLength(1);

      const xButton = screen
        .getAllByRole('button')
        .find((btn) => btn.querySelector('svg') && !btn.textContent);
      if (xButton) await user.click(xButton);

      expect(readMetrics()).toHaveLength(0);
    });

    it('keeps the form open and editable for capped charts (pie) so the single metric stays changeable', async () => {
      const user = userEvent.setup();
      // Capped chart with no committed metric (e.g. user removed the default).
      render(<Harness chartType="pie" maxMetrics={1} />);

      await user.click(screen.getByRole('button', { name: /add another metric/i }));

      // The metric is live in the payload immediately ...
      expect(readMetrics()).toHaveLength(1);
      // ... the draft shows in the open form (Metric field visible), NOT collapsed into a pill,
      // so Function/Column remain changeable — the cap must not hide the edit form mid-edit.
      expect(screen.getByText(/^Metric \*/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /remove metric/i })).not.toBeInTheDocument();
      // No "+ ADD ANOTHER METRIC" commit button while at the single-metric cap.
      expect(screen.queryByRole('button', { name: /add another metric/i })).not.toBeInTheDocument();
    });

    it('shows the single metric as a committed pill (no form) when it is not a draft', () => {
      // A loaded/prefilled capped chart: one committed metric, form closed, cap reached.
      render(
        <MetricsSelector
          metrics={[{ column: null, aggregation: 'count', alias: 'Total Count' }]}
          onChange={mockOnChange}
          columns={mockColumns}
          chartType="pie"
          maxMetrics={1}
        />
      );

      expect(screen.getByRole('button', { name: /remove metric/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /add another metric/i })).not.toBeInTheDocument();
    });

    it('commits the draft and opens a fresh one on "+ ADD ANOTHER METRIC"', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      const openBtn = screen.getByRole('button', { name: /add another metric/i });
      await user.click(openBtn); // opens form + count draft → 1 metric
      await user.click(screen.getByRole('button', { name: /add another metric/i })); // commit + fresh draft

      // One committed metric + one fresh draft = 2 in payload, 1 committed pill rendered.
      expect(readMetrics()).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: /remove metric/i })).toHaveLength(1);
    });
  });
});
