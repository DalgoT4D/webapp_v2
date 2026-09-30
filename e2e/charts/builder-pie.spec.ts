import { test, expect } from '../support/fixtures';
import { e2eTitle } from '../support/env';
import {
  type StylingCase,
  ChartBuilderPage,
  clickTestId,
  NUMBER_FORMATS,
  runStylingCase,
  selectOption,
} from './helpers-builder';

/**
 * MATRIX §1.3 styling — Pie (inventory §8.3). One test per option:
 * PAY on the chart-data request (when the option is sent to the API) + SHOT of the preview + PAY on save.
 * Baseline: dimension = statename (6 slices), SUM(students), sorted by statename.
 * numberFormat / decimalPlaces / dateFormat are frontend-only for pie (stripped from chart-data).
 */

const baseline = (b: ChartBuilderPage) => b.statenameBaseline();
const valueLabels = selectOption('chart-styling-label-format', 'value');

const CASES: StylingCase[] = [
  { title: 'legend off', id: 'pie-legend-off', apply: clickTestId('chart-styling-show-legend') },
  // Pie create defaults already carry legendPosition:'right', so nothing is lost here (unlike bar/line)
  {
    title: 'legend display all',
    id: 'pie-legend-display-all',
    apply: clickTestId('chart-styling-legend-display-all'),
  },
  {
    title: 'legend display paginated after all',
    id: 'pie-legend-display-paginated',
    prepare: clickTestId('chart-styling-legend-display-all'),
    apply: clickTestId('chart-styling-legend-display-paginated'),
  },
  ...(['top', 'bottom', 'left'] as const).map((pos) => ({
    title: `legend position ${pos}`,
    id: `pie-legend-position-${pos}`,
    apply: selectOption('chart-styling-legend-position', pos),
  })),
  {
    title: 'legend position right after top (create default is right)',
    id: 'pie-legend-position-right',
    // Back to the baseline value → payload already fetched, SWR serves it from cache (no request)
    chartData: false,
    prepare: selectOption('chart-styling-legend-position', 'top'),
    apply: selectOption('chart-styling-legend-position', 'right'),
  },
  {
    title: 'chart style full pie',
    id: 'pie-style-full',
    apply: clickTestId('chart-styling-chart-style-pie'),
  },
  {
    title: 'chart style donut after full pie',
    id: 'pie-style-donut',
    // Back to the baseline value → payload already fetched, SWR serves it from cache (no request)
    chartData: false,
    prepare: clickTestId('chart-styling-chart-style-pie'),
    apply: clickTestId('chart-styling-chart-style-donut'),
  },
  {
    title: 'tooltip off',
    id: 'pie-tooltip-off',
    apply: clickTestId('chart-styling-show-tooltip'),
    shot: false,
  },
  ...(['3', '5', '10'] as const).map((n) => ({
    title: `slice limit top ${n} (rest grouped as Other)`,
    id: `pie-max-slices-${n}`,
    apply: selectOption('chart-styling-max-slices', n),
  })),
  {
    title: 'slice limit all after top 3',
    id: 'pie-max-slices-all',
    prepare: selectOption('chart-styling-max-slices', '3'),
    apply: selectOption('chart-styling-max-slices', 'all'),
  },
  {
    title: 'data labels off',
    id: 'pie-data-labels-off',
    apply: clickTestId('chart-styling-show-data-labels'),
  },
  ...(['value', 'name_percentage', 'name_value'] as const).map((fmt) => ({
    title: `label format ${fmt}`,
    id: `pie-label-format-${fmt}`,
    apply: selectOption('chart-styling-label-format', fmt),
  })),
  {
    title: 'label format percentage after value',
    id: 'pie-label-format-percentage',
    // Back to the baseline value → payload already fetched, SWR serves it from cache (no request)
    chartData: false,
    prepare: valueLabels,
    apply: selectOption('chart-styling-label-format', 'percentage'),
  },
  {
    title: 'label position inside',
    id: 'pie-label-position-inside',
    apply: selectOption('chart-styling-data-label-position', 'inside'),
  },
  {
    title: 'label position outside after inside',
    id: 'pie-label-position-outside',
    // Back to the baseline value → payload already fetched, SWR serves it from cache (no request)
    chartData: false,
    prepare: selectOption('chart-styling-data-label-position', 'inside'),
    apply: selectOption('chart-styling-data-label-position', 'outside'),
  },
  // Number format: labels switched to raw values so the format is visible
  ...NUMBER_FORMATS.map((fmt) => ({
    title: `number format ${fmt}`,
    id: `pie-number-format-${fmt}`,
    prepare: valueLabels,
    apply: selectOption('pieNumberFormat', fmt),
    chartData: false,
  })),
  {
    title: 'decimal places',
    id: 'pie-decimals',
    prepare: async (b) => {
      await valueLabels(b);
      await b.pickSelect('pieNumberFormat', 'adaptive_international');
    },
    apply: (b) => b.page.getByTestId('pieDecimalPlaces').fill('2'),
    chartData: false,
  },
  ...(['dd_mm_yyyy', 'yyyy_mm_dd'] as const).map((fmt) => ({
    title: `date format ${fmt} (date dimension)`,
    id: `pie-date-format-${fmt}`,
    setup: (b: ChartBuilderPage) => b.setXAxis('date'),
    // 26 monthly dates → top 5 keeps the labels readable
    prepare: selectOption('chart-styling-max-slices', '5'),
    apply: selectOption('pieDateFormat', fmt),
    chartData: false,
  })),
];

test.describe('pie styling', () => {
  for (const c of CASES) {
    test(`pie: ${c.title}`, async ({ page, track }) => {
      const b = new ChartBuilderPage(page);
      await runStylingCase(b, track, 'pie', baseline, c, e2eTitle(c.id));
    });
  }

  test('pie: date formatting section only for a date dimension, names the column', async ({
    page,
  }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('pie');
    await b.statenameBaseline();
    await b.stylingTab();
    await expect(page.getByTestId('pieDateFormat')).toHaveCount(0);
    await b.dataTab();
    await b.setXAxis('date');
    await b.stylingTab();
    await expect(page.getByTestId('pieDateFormat')).toBeVisible();
    await expect(page.getByText('Format dates in slice labels (date)')).toBeVisible();
  });

  test('pie: label format / position hidden when data labels are off', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('pie');
    await b.stylingTab();
    await expect(page.getByTestId('chart-styling-label-format')).toBeVisible();
    await page.getByTestId('chart-styling-show-data-labels').click();
    await expect(page.getByTestId('chart-styling-label-format')).toHaveCount(0);
    await expect(page.getByTestId('chart-styling-data-label-position')).toHaveCount(0);
  });

  test('pie: styling panel defaults in create', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('pie');
    await b.stylingTab();
    await expect(page.getByTestId('chart-styling-show-legend')).toHaveAttribute(
      'data-state',
      'checked'
    );
    await expect(page.getByTestId('chart-styling-legend-display-paginated')).toHaveAttribute(
      'data-state',
      'checked'
    );
    await expect(page.getByTestId('chart-styling-legend-position')).toHaveText('Right');
    await expect(page.getByTestId('chart-styling-chart-style-donut')).toHaveAttribute(
      'data-state',
      'checked'
    );
    await expect(page.getByTestId('chart-styling-show-tooltip')).toHaveAttribute(
      'data-state',
      'checked'
    );
    await expect(page.getByTestId('chart-styling-max-slices')).toHaveText('Show All Slices');
    await expect(page.getByTestId('chart-styling-show-data-labels')).toHaveAttribute(
      'data-state',
      'checked'
    );
    await expect(page.getByTestId('chart-styling-label-format')).toHaveText(/Percentage/);
    await expect(page.getByTestId('chart-styling-data-label-position')).toHaveText(/Outside/);
    await expect(page.getByTestId('pieNumberFormat')).toHaveText('No Formatting');
  });

  test('pie: single metric — no add-metric button; labels read Metric / Dimension', async ({
    page,
  }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('pie');
    await expect(page.getByTestId('add-metric-button')).toHaveCount(0);
    await expect(page.getByText('Dimension', { exact: true }).first()).toBeVisible();
    await b.expandMetric(0);
    await expect(page.getByText('Metric *')).toBeVisible();
    await expect(page.getByText('Dimension *')).toBeVisible();
  });
});
