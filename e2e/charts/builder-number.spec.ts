import { test, expect } from '../support/fixtures';
import { e2eTitle } from '../support/env';
import {
  type StylingCase,
  ChartBuilderPage,
  clickTestId,
  fillTestId,
  NUMBER_FORMATS,
  runStylingCase,
  selectOption,
} from './helpers-builder';

/**
 * MATRIX §1.3 styling — Number / KPI (inventory §8.4). One test per option:
 * PAY on the chart-data request (when the option is sent to the API) + SHOT of the preview + PAY on save.
 * Baseline: SUM(students). numberFormat / decimalPlaces are frontend-only (stripped from chart-data).
 */

const baseline = async (b: ChartBuilderPage) => {
  await b.setSimpleMetric(0, 'sum', 'students');
  await b.settle();
};

const CASES: StylingCase[] = [
  {
    title: 'size small',
    id: 'number-size-small',
    apply: clickTestId('chart-styling-number-size-small'),
  },
  {
    title: 'size large',
    id: 'number-size-large',
    apply: clickTestId('chart-styling-number-size-large'),
  },
  {
    title: 'size medium after small',
    id: 'number-size-medium',
    // Back to the baseline value → payload already fetched, SWR serves it from cache (no request)
    chartData: false,
    prepare: clickTestId('chart-styling-number-size-small'),
    apply: clickTestId('chart-styling-number-size-medium'),
  },
  {
    title: 'subtitle',
    id: 'number-subtitle',
    apply: fillTestId('chart-styling-subtitle', 'Across all states'),
  },
  ...NUMBER_FORMATS.map((fmt) => ({
    title: `number format ${fmt}`,
    id: `number-format-${fmt}`,
    apply: selectOption('numberNumberFormat', fmt),
    chartData: false,
  })),
  {
    title: 'decimal places',
    id: 'number-decimals',
    prepare: selectOption('numberNumberFormat', 'adaptive_indian'),
    apply: fillTestId('numberDecimalPlaces', '2'),
    chartData: false,
  },
  { title: 'prefix', id: 'number-prefix', apply: fillTestId('chart-styling-number-prefix', '~') },
  {
    title: 'suffix',
    id: 'number-suffix',
    apply: fillTestId('chart-styling-number-suffix', ' students'),
  },
  {
    title: 'prefix + suffix + format together',
    id: 'number-prefix-suffix-format',
    prepare: async (b) => {
      await b.pickSelect('numberNumberFormat', 'international');
      await b.fillAndWait('chart-styling-number-prefix', '≈');
    },
    apply: fillTestId('chart-styling-number-suffix', ' kids'),
  },
];

test.describe('number styling', () => {
  for (const c of CASES) {
    test(`number: ${c.title}`, async ({ page, track }) => {
      const b = new ChartBuilderPage(page);
      await runStylingCase(b, track, 'number', baseline, c, e2eTitle(c.id));
    });
  }

  test('number: styling panel defaults in create', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('number');
    await b.stylingTab();
    await expect(page.getByTestId('chart-styling-number-size-medium')).toHaveAttribute(
      'data-state',
      'checked'
    );
    await expect(page.getByTestId('chart-styling-subtitle')).toHaveValue('');
    await expect(page.getByTestId('numberNumberFormat')).toHaveText('No Formatting');
    await expect(page.getByTestId('numberDecimalPlaces')).toHaveValue('0');
    await expect(page.getByTestId('chart-styling-number-prefix')).toHaveValue('');
    await expect(page.getByTestId('chart-styling-number-suffix')).toHaveValue('');
  });

  test('number: data config — one metric, no X axis / extra dimension / pagination / sort / display name', async ({
    page,
  }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('number');
    await expect(page.getByTestId('chart-x-axis-select-input')).toHaveCount(0);
    await expect(page.getByTestId('chart-extra-dimension-select-input')).toHaveCount(0);
    await expect(page.getByTestId('chart-pagination-select')).toHaveCount(0);
    await expect(page.getByTestId('chart-sort-column-select-input')).toHaveCount(0);
    await expect(page.getByTestId('add-metric-button')).toHaveCount(0);
    // Filters stay available
    await expect(page.getByTestId('chart-add-filter-btn')).toBeVisible();
    await b.expandMetric(0);
    await expect(page.getByTestId('metric-alias-0')).toHaveCount(0);
  });

  test('number: removing the metric disables Save and brings back + ADD ANOTHER METRIC', async ({
    page,
    track,
  }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('number');
    await page.getByTestId('remove-metric-0').click();
    await expect(b.metricTrigger(0)).toHaveCount(0);
    await expect(b.saveButton).toBeDisabled();
    await expect(page.getByTestId('add-metric-button')).toBeVisible();
    await page.getByTestId('add-metric-button').click();
    await expect(b.metricTrigger(0)).toHaveCount(1);
    await expect(b.saveButton).toBeEnabled();
    // Re-adding restores the prefill config, so the preview is usually served from SWR cache (no
    // request) — assert the metric → aggregate_* mirroring on the save payload instead
    await b.saveAndSnapshot(track, e2eTitle('number-metric-readded'), 'number-metric-readded-save');
  });

  test('number: filter applies to the big number', async ({ page, track }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('number');
    await baseline(b);
    await b.addFilter();
    await b.setFilterColumn(0, 'statename');
    await b.expectChartDataPayload('number-filter-chart-data', () =>
      b.filterTextValue(0).fill('Assam')
    );
    await b.expectPreviewShot('number-filter');
    await b.saveAndSnapshot(track, e2eTitle('number-filter'), 'number-filter-save');
  });
});
