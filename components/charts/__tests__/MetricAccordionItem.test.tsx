/**
 * MetricAccordionItem — the per-metric expandable editor (unified tabbed form).
 * Every row shows Simple/Calculated/Saved tabs. A row linked to a library metric opens on the
 * Saved tab (metric preselected, swappable); switching to Simple/Calculated detaches it to a
 * local metric. The chart display name stays editable in every mode.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Accordion } from '@/components/ui/accordion';
import { MetricAccordionItem, MetricAccordionItemProps } from '../MetricAccordionItem';
import type { ChartMetric } from '@/types/charts';

jest.mock('@/hooks/api/useMetrics', () => ({ validateMetric: jest.fn() }));
import { validateMetric } from '@/hooks/api/useMetrics';

const columns = [
  { column_name: 'amount', data_type: 'numeric' },
  { column_name: 'category', data_type: 'varchar' },
];

// Render the item already expanded (defaultValue) so the form content is visible.
function renderItem(
  metric: Partial<ChartMetric>,
  overrides: Partial<MetricAccordionItemProps> = {}
) {
  const onUpdate = overrides.onUpdate || jest.fn();
  const onRemove = overrides.onRemove || jest.fn();
  render(
    <Accordion type="multiple" defaultValue={['u1']}>
      <MetricAccordionItem
        metric={metric as ChartMetric}
        uid="u1"
        index={0}
        columns={columns}
        onUpdate={onUpdate}
        onRemove={onRemove}
        {...overrides}
      />
    </Accordion>
  );
  return { onUpdate, onRemove };
}

describe('MetricAccordionItem — inline metric (full tabbed form)', () => {
  it('shows the Simple/Calculated/Saved tabs with Function + Column', () => {
    renderItem({ column: 'amount', aggregation: 'sum', alias: 'Total' });
    expect(screen.getByRole('tab', { name: 'Simple' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Calculated' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Saved' })).toBeInTheDocument();
    expect(screen.getByText(/^Function/)).toBeInTheDocument();
    expect(screen.getByText(/^Column/)).toBeInTheDocument();
  });

  it('calls onUpdate when the aggregation changes', async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderItem({ column: 'amount', aggregation: 'sum', alias: 'Total' });
    await user.click(screen.getByTestId('metric-agg-0'));
    await user.click(screen.getByRole('option', { name: 'Average' }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ aggregation: 'avg' }));
  });

  it('auto-syncs the display name to the definition when the alias is not customized', async () => {
    const user = userEvent.setup();
    // alias === autoLabel(count, *) → the friendly "Total Count" default, treated as auto-generated,
    // so it should follow the new function.
    const { onUpdate } = renderItem({ column: null, aggregation: 'count', alias: 'Total Count' });
    await user.click(screen.getByTestId('metric-agg-0'));
    await user.click(screen.getByRole('option', { name: 'Sum' }));
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ aggregation: 'sum', alias: 'SUM(*)' })
    );
  });

  it('keeps a customized display name when the function changes', async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderItem({ column: 'amount', aggregation: 'sum', alias: 'My Revenue' });
    await user.click(screen.getByTestId('metric-agg-0'));
    await user.click(screen.getByRole('option', { name: 'Average' }));
    expect(onUpdate).toHaveBeenCalledWith(
      expect.not.objectContaining({ alias: expect.anything() })
    );
  });
});

describe('MetricAccordionItem — calculated tab', () => {
  it('updates on blur when the expression is valid', async () => {
    (validateMetric as jest.Mock).mockResolvedValue({ valid: true });
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    renderItem(
      { column_expression: 'SUM(amount)', alias: 'X' },
      { onUpdate, schemaName: 's', tableName: 't' }
    );
    const box = screen.getByTestId('metric-expr-0');
    await user.clear(box);
    await user.type(box, 'SUM(amount)/2');
    await user.tab();
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ column_expression: 'SUM(amount)/2' })
      )
    );
  });

  it('auto-follows the display name to the expression on a valid change', async () => {
    // Regression: editing a calculated expression must re-align the Display Name to the new
    // expression (unless the user customized it). Previously a DebouncedInput echo of the old
    // alias marked the name "customized" and left the label stuck on the prior value.
    (validateMetric as jest.Mock).mockResolvedValue({ valid: true });
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    renderItem(
      { column_expression: 'SUM(amount)', alias: 'SUM(amount)' },
      { onUpdate, schemaName: 's', tableName: 't' }
    );
    const box = screen.getByTestId('metric-expr-0');
    await user.clear(box);
    await user.type(box, 'AVG(amount)');
    await user.tab();
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ column_expression: 'AVG(amount)', alias: 'AVG(amount)' })
      )
    );
  });

  it('does NOT update and shows an error when the expression is invalid', async () => {
    (validateMetric as jest.Mock).mockResolvedValue({ valid: false, error: 'bad expr' });
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    renderItem(
      { column_expression: 'SUM(amount)', alias: 'X' },
      { onUpdate, schemaName: 's', tableName: 't' }
    );
    const box = screen.getByTestId('metric-expr-0');
    await user.clear(box);
    await user.type(box, 'INVALID(');
    await user.tab();
    expect(await screen.findByText('bad expr')).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe('MetricAccordionItem — saved tab (convert to library)', () => {
  it('converts the metric to a library reference when a saved metric is picked', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    renderItem(
      { column: 'amount', aggregation: 'sum', alias: 'Total' },
      {
        onUpdate,
        savedMetrics: [{ id: 7, name: 'Revenue', column: 'amount', aggregation: 'sum' }],
        isSavedMetricAdded: () => false,
      }
    );
    await user.click(screen.getByRole('tab', { name: 'Saved' }));
    // Searchable Combobox: focus its search input to open, then pick the option.
    await user.click(screen.getByTestId('metric-saved-0-input'));
    await user.click(await screen.findByRole('option', { name: /Revenue/ }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ saved_metric_id: 7 }));
  });
});

describe('MetricAccordionItem — library metric (editable)', () => {
  const lib = { saved_metric_id: 7, column: 'amount', aggregation: 'sum', alias: 'Revenue' };
  const savedMetrics = [
    { id: 7, name: 'Revenue', column: 'amount', aggregation: 'sum' },
    { id: 8, name: 'Cost', column: 'amount', aggregation: 'avg' },
  ];

  it('opens on the Saved tab with the library icon and an editable display name', () => {
    renderItem(lib, { savedMetrics, isSavedMetricAdded: (id) => id === 7 });
    expect(screen.getByTestId('metric-library-icon-0')).toBeInTheDocument();
    expect(screen.getByTestId('metric-alias-0')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Saved', selected: true })).toBeInTheDocument();
  });

  it('swaps to a different saved metric from the dropdown', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    renderItem(lib, { onUpdate, savedMetrics, isSavedMetricAdded: (id) => id === 7 });
    await user.click(screen.getByTestId('metric-saved-0-input'));
    await user.click(await screen.findByRole('option', { name: /Cost/ }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ saved_metric_id: 8 }));
  });

  it('detaches to a local Simple metric — clears saved_metric_id, keeps column/function', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    renderItem(lib, { onUpdate, savedMetrics, isSavedMetricAdded: (id) => id === 7 });
    await user.click(screen.getByRole('tab', { name: 'Simple' }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ saved_metric_id: undefined }));
    // A simple saved def keeps its column/aggregation (no reset to COUNT).
    expect(onUpdate).toHaveBeenCalledWith(
      expect.not.objectContaining({ aggregation: expect.anything() })
    );
  });

  it('allows editing the display name on the Saved tab', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    renderItem(lib, { onUpdate, savedMetrics, isSavedMetricAdded: (id) => id === 7 });
    await user.type(screen.getByTestId('metric-alias-0'), '!');
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ alias: expect.any(String) }))
    );
  });
});
