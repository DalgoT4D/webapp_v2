import { test, expect } from '../support/fixtures';
import { e2eTitle } from '../support/env';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { ChartBuilderPage } from './helpers-builder';

/**
 * MATRIX §1.3 "Type switch" — ChartDataConfigurationV3.handleChartTypeChange keep/trim rules:
 * bar/line keep all metrics; pie/number/map keep the first metric only; number/map clear X + extra
 * dimension; filters/sort/pagination/customizations always carry over (customizations sanitized:
 * dataLabelPosition coerced to a value valid for the new type, dropped when the type has none).
 */

const TITLE = e2eTitle('type-switch');

/** Bar with 2 metrics, extra dimension, filter, pagination, sort and data labels at "inside" (Middle). */
async function richBar(b: ChartBuilderPage) {
  await b.openCreate('bar');
  await b.setTitle(TITLE);
  await b.setXAxis('statename');
  await b.setSimpleMetric(0, 'sum', 'students');
  await b.page.getByTestId('add-metric-button').click();
  await b.setSimpleMetric(1, 'avg', 'male_score');
  await b.setExtraDimension('climate_event');
  await b.addFilter();
  await b.setFilterColumn(0, 'students');
  await b.setFilterOperator(0, 'greater_than');
  await b.fillAndWait('chart-filter-value-0-text', '0');
  await b.setPagination('50');
  await b.setSortColumn('statename');
  await b.stylingTab();
  await b.page.getByTestId('chart-styling-show-data-labels').click();
  await b.pickSelect('chart-styling-data-label-position', 'inside');
  await b.dataTab();
  await b.settle();
}

function switchTo(b: ChartBuilderPage, type: string) {
  return () => b.page.getByTestId(`chart-type-switch-${type}`).click();
}

test.describe('type switch keep/trim rules', () => {
  test('bar → line keeps all metrics, dimensions, filters, sort, pagination; label position inside → top ("Above Point")', async ({
    page,
  }) => {
    const b = new ChartBuilderPage(page);
    await richBar(b);
    await b.expectChartDataPayload('switch-bar-to-line', switchTo(b, 'line'));
    await expect(b.metricTrigger(1)).toContainText('AVG(male_score)');
    await expect(b.comboInput('chart-x-axis-select')).toHaveValue('statename');
    await expect(b.comboInput('chart-extra-dimension-select')).toHaveValue('climate_event');
    await expect(b.filterTextValue(0)).toHaveValue('0');
    await expect(page.getByTestId('chart-pagination-select')).toHaveText('50 items');
    await expect(b.comboInput('chart-sort-column-select')).toHaveValue('statename');
    await expect(page.getByText('Display trends over time')).toBeVisible();
    await b.stylingTab();
    await expect(page.getByTestId('chart-styling-data-label-position')).toHaveText('Above Point');
  });

  test('bar → pie keeps only the first metric; label position inside stays (valid for pie)', async ({
    page,
  }) => {
    const b = new ChartBuilderPage(page);
    await richBar(b);
    await b.expectChartDataPayload('switch-bar-to-pie', switchTo(b, 'pie'));
    await expect(b.metricTrigger(0)).toContainText('SUM(students)');
    await expect(b.metricTrigger(1)).toHaveCount(0);
    await expect(page.getByTestId('add-metric-button')).toHaveCount(0);
    await expect(b.comboInput('chart-extra-dimension-select')).toHaveValue('climate_event');
    await b.stylingTab();
    await expect(page.getByTestId('chart-styling-data-label-position')).toHaveText('Inside (Mid)');
  });

  test('[pinned] bar → number keeps first metric, clears X/extra dimension, keeps legacy aggregate_func count', async ({
    page,
  }) => {
    // Pinned: aggregate_column/function are only mirrored from the metric on a metric edit, so right
    // after the switch the payload carries aggregate_func:'count' next to metrics:[SUM(students)]
    const b = new ChartBuilderPage(page);
    await richBar(b);
    await b.expectChartDataPayload('switch-bar-to-number', switchTo(b, 'number'));
    await expect(b.metricTrigger(0)).toContainText('SUM(students)');
    await expect(b.metricTrigger(1)).toHaveCount(0);
    await expect(page.getByTestId('chart-x-axis-select-input')).toHaveCount(0);
    await expect(page.getByTestId('chart-extra-dimension-select-input')).toHaveCount(0);
    await expect(page.getByTestId('chart-pagination-select')).toHaveCount(0);
    await expect(b.filterTextValue(0)).toHaveValue('0');
  });

  test('pie → bar keeps the single metric and re-enables + ADD ANOTHER METRIC', async ({
    page,
  }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('pie');
    await b.setXAxis('statename');
    await b.setSimpleMetric(0, 'max', 'students');
    await b.expectChartDataPayload('switch-pie-to-bar', switchTo(b, 'bar'));
    await expect(b.metricTrigger(0)).toContainText('MAX(students)');
    await expect(b.metricTrigger(1)).toHaveCount(0);
    await expect(page.getByTestId('add-metric-button')).toBeVisible();
    await expect(b.comboInput('chart-x-axis-select')).toHaveValue('statename');
  });

  test('[pinned] bar → table keeps all metrics but table dimensions come from auto-prefill (id)', async ({
    page,
  }) => {
    // Pinned: auto-prefill's `dimensions:[id]` is not overridden by the kept dimension_column (statename)
    const b = new ChartBuilderPage(page);
    await richBar(b);
    const preview = captureRequest(page, {
      method: 'POST',
      url: /\/api\/charts\/chart-data-preview\/\?/,
    });
    await switchTo(b, 'table')();
    expectPayloadSnapshot(await preview, 'switch-bar-to-table-preview');
    await expect(b.metricTrigger(0)).toContainText('SUM(students)');
    await expect(b.metricTrigger(1)).toContainText('AVG(male_score)');
    await expect(b.comboInput('chart-table-dimension-0')).toHaveValue('id');
    await expect(page.getByTestId('chart-x-axis-select-input')).toHaveCount(0);
    await expect(b.saveButton).toBeEnabled();
  });

  test('bar → map keeps first metric only and shows the map config', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await richBar(b);
    await switchTo(b, 'map')();
    await expect(b.metricTrigger(0)).toContainText('SUM(students)');
    await expect(b.metricTrigger(1)).toHaveCount(0);
    await expect(page.getByTestId('chart-x-axis-select-input')).toHaveCount(0);
    await expect(page.getByText('Visualize geographic data')).toBeVisible();
  });

  test('[pinned] bar → pivot table keeps metrics but resets row/column dimensions → Save disabled', async ({
    page,
  }) => {
    // Pinned: the switch overrides auto-prefill's pivot dimensions with empty lists
    const b = new ChartBuilderPage(page);
    await richBar(b);
    await switchTo(b, 'pivot_table')();
    await expect(b.metricTrigger(0)).toContainText('SUM(students)');
    await expect(b.metricTrigger(1)).toContainText('AVG(male_score)');
    // Only the empty placeholder slot is left
    await expect(page.getByTestId('pivot-row-dimension-0-input')).toHaveValue('');
    await expect(page.getByTestId('pivot-row-dimension-1-input')).toHaveCount(0);
    await expect(b.saveButton).toBeDisabled();
  });

  test('bar (date X, month grain) → pie clears the time grain', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.setXAxis('date');
    await b.setTimeGrain('month');
    await switchTo(b, 'pie')();
    await expect(page.getByTestId('chart-time-grain-select')).toHaveCount(0);
    await b.settle();
    // The grain reset lands in a follow-up update — the next request carries time_grain: null
    await b.expectChartDataPayload('switch-bar-to-pie-time-grain-cleared', () =>
      b.setPagination('20')
    );
  });

  test('[pinned] bar → line then save persists bar-only customizations (orientation, stacked)', async ({
    page,
    track,
  }) => {
    // Pinned: customizations are carried over whole (only dataLabelPosition is sanitized)
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.setXAxis('statename');
    await b.stylingTab();
    await page.getByTestId('chart-styling-orientation-horizontal').click();
    await b.dataTab();
    await switchTo(b, 'line')();
    await b.settle();
    await b.saveAndSnapshot(track, e2eTitle('switch-bar-line-save'), 'switch-bar-to-line-save');
  });

  test('chain bar → line → pie → number → table → map keeps/trims per rules', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await richBar(b);

    await b.expectChartDataPayload('chain-1-line', switchTo(b, 'line'));
    await expect(b.metricTrigger(1)).toBeVisible();

    await b.expectChartDataPayload('chain-2-pie', switchTo(b, 'pie'));
    await expect(b.metricTrigger(1)).toHaveCount(0);
    await expect(b.comboInput('chart-x-axis-select')).toHaveValue('statename');

    await b.expectChartDataPayload('chain-3-number', switchTo(b, 'number'));
    await expect(page.getByTestId('chart-x-axis-select-input')).toHaveCount(0);
    await expect(b.metricTrigger(0)).toContainText('SUM(students)');

    await switchTo(b, 'table')();
    await expect(b.metricTrigger(0)).toContainText('SUM(students)');
    await expect(b.comboInput('chart-table-dimension-0')).toHaveValue('id');

    await switchTo(b, 'map')();
    await expect(b.metricTrigger(0)).toContainText('SUM(students)');
    await expect(b.metricTrigger(1)).toHaveCount(0);

    // Title survives every switch
    await expect(b.nameInput).toHaveValue(TITLE);
  });
});
