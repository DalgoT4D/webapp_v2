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
 * MATRIX §1.3 styling — Bar (inventory §8.1). One test per option:
 * PAY on the chart-data request (when the option is sent to the API) + SHOT of the preview + PAY on save.
 * Baseline: X = statename, SUM(students), sorted by statename.
 */

const baseline = (b: ChartBuilderPage) => b.statenameBaseline();
const dataLabelsOn = clickTestId('chart-styling-show-data-labels');

const CASES: StylingCase[] = [
  // Display options
  {
    title: 'orientation horizontal',
    id: 'bar-orientation-horizontal',
    apply: clickTestId('chart-styling-orientation-horizontal'),
  },
  {
    title: 'orientation vertical after horizontal',
    id: 'bar-orientation-vertical',
    // Back to the baseline value → payload already fetched, SWR serves it from cache (no request)
    chartData: false,
    prepare: clickTestId('chart-styling-orientation-horizontal'),
    apply: clickTestId('chart-styling-orientation-vertical'),
  },
  {
    title: 'stacked bars (with extra dimension)',
    id: 'bar-stacked',
    setup: (b) => b.setExtraDimension('climate_event'),
    apply: clickTestId('chart-styling-stacked'),
  },
  {
    title: 'tooltip off',
    id: 'bar-tooltip-off',
    apply: clickTestId('chart-styling-show-tooltip'),
    shot: false,
  },
  { title: 'legend off', id: 'bar-legend-off', apply: clickTestId('chart-styling-show-legend') },
  {
    // Pinned: onValueChange calls updateCustomization twice from the same stale snapshot, so the
    // defaulted legendPosition:'right' is overwritten by the legendDisplay update
    title: '[pinned] legend display all drops the defaulted legendPosition',
    id: 'bar-legend-display-all',
    apply: clickTestId('chart-styling-legend-display-all'),
  },
  {
    title: 'legend display paginated after all',
    id: 'bar-legend-display-paginated',
    prepare: clickTestId('chart-styling-legend-display-all'),
    apply: clickTestId('chart-styling-legend-display-paginated'),
  },
  ...(['top', 'bottom', 'left'] as const).map((pos) => ({
    title: `legend position ${pos}`,
    id: `bar-legend-position-${pos}`,
    apply: selectOption('chart-styling-legend-position', pos),
  })),
  {
    // The dropdown already shows Right while unset, so re-picking it would not fire a change
    title: 'legend position right after top',
    id: 'bar-legend-position-right',
    prepare: selectOption('chart-styling-legend-position', 'top'),
    apply: selectOption('chart-styling-legend-position', 'right'),
  },
  // Data labels
  { title: 'data labels on (default position top)', id: 'bar-data-labels-on', apply: dataLabelsOn },
  ...(['inside', 'insideBottom'] as const).map((pos) => ({
    title: `data label position ${pos}`,
    id: `bar-data-label-position-${pos}`,
    prepare: dataLabelsOn,
    apply: selectOption('chart-styling-data-label-position', pos),
  })),
  {
    title: 'data label position top after inside',
    id: 'bar-data-label-position-top',
    // Back to the baseline value → payload already fetched, SWR serves it from cache (no request)
    chartData: false,
    prepare: async (b) => {
      await dataLabelsOn(b);
      await b.pickSelect('chart-styling-data-label-position', 'inside');
    },
    apply: selectOption('chart-styling-data-label-position', 'top'),
  },
  // X axis
  {
    title: 'x-axis title',
    id: 'bar-x-axis-title',
    apply: fillTestId('chart-styling-x-axis-title', 'State'),
  },
  ...(['horizontal', 'vertical'] as const).map((rot) => ({
    title: `x label rotation ${rot}`,
    id: `bar-x-rotation-${rot}`,
    apply: selectOption('chart-styling-x-axis-label-rotation', rot),
  })),
  {
    title: 'x label rotation 45 after vertical (create default is 45)',
    id: 'bar-x-rotation-45',
    // Back to the baseline value → payload already fetched, SWR serves it from cache (no request)
    chartData: false,
    prepare: selectOption('chart-styling-x-axis-label-rotation', 'vertical'),
    apply: selectOption('chart-styling-x-axis-label-rotation', '45'),
  },
  {
    title: 'x number format + decimals (numeric X axis)',
    id: 'bar-x-number-format',
    setup: (b) => b.setXAxis('population'),
    prepare: selectOption('xAxisNumberFormat', 'adaptive_international'),
    apply: fillTestId('xAxisDecimalPlaces', '1'),
    chartData: false,
  },
  ...(['dd_mm_yyyy', 'yyyy_mm_dd'] as const).map((fmt) => ({
    title: `x date format ${fmt} (date X axis)`,
    id: `bar-x-date-format-${fmt}`,
    setup: async (b: ChartBuilderPage) => {
      await b.setXAxis('date');
      await b.setTimeGrain('month');
    },
    apply: selectOption('xAxisDateFormat', fmt),
    chartData: false,
  })),
  // Y axis
  {
    title: 'y-axis title',
    id: 'bar-y-axis-title',
    apply: fillTestId('chart-styling-y-axis-title', 'Students'),
  },
  ...(['45', 'vertical'] as const).map((rot) => ({
    title: `y label rotation ${rot}`,
    id: `bar-y-rotation-${rot}`,
    apply: selectOption('chart-styling-y-axis-label-rotation', rot),
  })),
  ...NUMBER_FORMATS.map((fmt) => ({
    title: `y number format ${fmt}`,
    id: `bar-y-number-format-${fmt}`,
    prepare: dataLabelsOn,
    apply: selectOption('yAxisNumberFormat', fmt),
    chartData: false,
  })),
  {
    title: 'y decimal places',
    id: 'bar-y-decimals',
    prepare: async (b) => {
      await dataLabelsOn(b);
      await b.pickSelect('yAxisNumberFormat', 'adaptive_indian');
    },
    apply: fillTestId('yAxisDecimalPlaces', '3'),
    chartData: false,
  },
];

test.describe('bar styling', () => {
  for (const c of CASES) {
    test(`bar: ${c.title}`, async ({ page, track }) => {
      const b = new ChartBuilderPage(page);
      await runStylingCase(b, track, 'bar', baseline, c, e2eTitle(c.id));
    });
  }

  test('bar: stacked switch only appears with an extra dimension', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.statenameBaseline();
    await b.stylingTab();
    await expect(page.getByTestId('chart-styling-stacked')).toHaveCount(0);
    await b.dataTab();
    await b.setExtraDimension('climate_event');
    await b.stylingTab();
    await expect(page.getByTestId('chart-styling-stacked')).toBeVisible();
  });

  test('bar: styling panel defaults in create', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.stylingTab();
    await expect(page.getByTestId('chart-styling-orientation-vertical')).toHaveAttribute(
      'data-state',
      'checked'
    );
    await expect(page.getByTestId('chart-styling-show-tooltip')).toHaveAttribute(
      'data-state',
      'checked'
    );
    await expect(page.getByTestId('chart-styling-show-legend')).toHaveAttribute(
      'data-state',
      'checked'
    );
    await expect(page.getByTestId('chart-styling-legend-display-paginated')).toHaveAttribute(
      'data-state',
      'checked'
    );
    // Dropdown shows "Right" although legendPosition is unset in create
    await expect(page.getByTestId('chart-styling-legend-position')).toHaveText('Right');
    await expect(page.getByTestId('chart-styling-show-data-labels')).toHaveAttribute(
      'data-state',
      'unchecked'
    );
    await expect(page.getByTestId('chart-styling-data-label-position')).toHaveCount(0);
    await expect(page.getByTestId('chart-styling-x-axis-label-rotation')).toHaveText('45 degrees');
    await expect(page.getByTestId('chart-styling-y-axis-label-rotation')).toHaveText(
      'Horizontal (0°)'
    );
    // X number/date format only for numeric/date X axes (prefilled X is text `id`)
    await expect(page.getByTestId('xAxisNumberFormat')).toHaveCount(0);
    await expect(page.getByTestId('xAxisDateFormat')).toHaveCount(0);
    await expect(page.getByTestId('yAxisNumberFormat')).toHaveText('No Formatting');
    await expect(page.getByTestId('yAxisDecimalPlaces')).toHaveValue('0');
  });
});
