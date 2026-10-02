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
 * MATRIX §1.3 styling — Line (inventory §8.2). One test per option:
 * PAY on the chart-data request (when the option is sent to the API) + SHOT of the preview + PAY on save.
 * Baseline: X = statename, SUM(students), sorted by statename.
 */

const baseline = (b: ChartBuilderPage) => b.statenameBaseline();
const dataLabelsOn = clickTestId('chart-styling-show-data-labels');

const CASES: StylingCase[] = [
  {
    title: 'line style straight',
    id: 'line-style-straight',
    apply: clickTestId('chart-styling-line-style-straight'),
  },
  {
    title: 'line style smooth after straight',
    id: 'line-style-smooth',
    // Back to the baseline value → payload already fetched, SWR serves it from cache (no request)
    chartData: false,
    prepare: clickTestId('chart-styling-line-style-straight'),
    apply: clickTestId('chart-styling-line-style-smooth'),
  },
  {
    title: 'data points off',
    id: 'line-data-points-off',
    apply: clickTestId('chart-styling-show-data-points'),
  },
  {
    title: 'tooltip off',
    id: 'line-tooltip-off',
    apply: clickTestId('chart-styling-show-tooltip'),
    shot: false,
  },
  { title: 'legend off', id: 'line-legend-off', apply: clickTestId('chart-styling-show-legend') },
  {
    // Pinned: two updateCustomization calls from one stale snapshot → the defaulted legendPosition is lost
    title: '[pinned] legend display all drops the defaulted legendPosition',
    id: 'line-legend-display-all',
    apply: clickTestId('chart-styling-legend-display-all'),
  },
  {
    title: 'legend display paginated after all',
    id: 'line-legend-display-paginated',
    prepare: clickTestId('chart-styling-legend-display-all'),
    apply: clickTestId('chart-styling-legend-display-paginated'),
  },
  ...(['top', 'bottom', 'left'] as const).map((pos) => ({
    title: `legend position ${pos}`,
    id: `line-legend-position-${pos}`,
    apply: selectOption('chart-styling-legend-position', pos),
  })),
  {
    title: 'legend position right after top',
    id: 'line-legend-position-right',
    prepare: selectOption('chart-styling-legend-position', 'top'),
    apply: selectOption('chart-styling-legend-position', 'right'),
  },
  {
    title: 'data labels on (default position top)',
    id: 'line-data-labels-on',
    apply: dataLabelsOn,
  },
  ...(['bottom', 'left', 'right'] as const).map((pos) => ({
    title: `data label position ${pos}`,
    id: `line-data-label-position-${pos}`,
    prepare: dataLabelsOn,
    apply: selectOption('chart-styling-data-label-position', pos),
  })),
  {
    title: 'data label position top after bottom',
    id: 'line-data-label-position-top',
    // Back to the baseline value → payload already fetched, SWR serves it from cache (no request)
    chartData: false,
    prepare: async (b) => {
      await dataLabelsOn(b);
      await b.pickSelect('chart-styling-data-label-position', 'bottom');
    },
    apply: selectOption('chart-styling-data-label-position', 'top'),
  },
  {
    title: 'x-axis title',
    id: 'line-x-axis-title',
    apply: fillTestId('chart-styling-x-axis-title', 'State'),
  },
  ...(['45', 'vertical'] as const).map((rot) => ({
    title: `x label rotation ${rot}`,
    id: `line-x-rotation-${rot}`,
    apply: selectOption('chart-styling-x-axis-label-rotation', rot),
  })),
  {
    title: 'x label rotation horizontal after 45 (create default is horizontal)',
    id: 'line-x-rotation-horizontal',
    // Back to the baseline value → payload already fetched, SWR serves it from cache (no request)
    chartData: false,
    prepare: selectOption('chart-styling-x-axis-label-rotation', '45'),
    apply: selectOption('chart-styling-x-axis-label-rotation', 'horizontal'),
  },
  {
    title: 'x number format + decimals (numeric X axis)',
    id: 'line-x-number-format',
    setup: (b) => b.setXAxis('population'),
    prepare: selectOption('xAxisNumberFormat', 'indian'),
    apply: fillTestId('xAxisDecimalPlaces', '2'),
    chartData: false,
  },
  ...(['mm_dd_yyyy', 'iso_datetime'] as const).map((fmt) => ({
    title: `x date format ${fmt} (date X axis)`,
    id: `line-x-date-format-${fmt}`,
    setup: async (b: ChartBuilderPage) => {
      await b.setXAxis('date');
      await b.setTimeGrain('month');
    },
    apply: selectOption('xAxisDateFormat', fmt),
    chartData: false,
  })),
  {
    title: 'y-axis title',
    id: 'line-y-axis-title',
    apply: fillTestId('chart-styling-y-axis-title', 'Students'),
  },
  ...(['45', 'vertical'] as const).map((rot) => ({
    title: `y label rotation ${rot}`,
    id: `line-y-rotation-${rot}`,
    apply: selectOption('chart-styling-y-axis-label-rotation', rot),
  })),
  ...NUMBER_FORMATS.map((fmt) => ({
    title: `y number format ${fmt}`,
    id: `line-y-number-format-${fmt}`,
    prepare: dataLabelsOn,
    apply: selectOption('yAxisNumberFormat', fmt),
    chartData: false,
  })),
  {
    title: 'y decimal places',
    id: 'line-y-decimals',
    prepare: async (b) => {
      await dataLabelsOn(b);
      await b.pickSelect('yAxisNumberFormat', 'international');
    },
    apply: fillTestId('yAxisDecimalPlaces', '2'),
    chartData: false,
  },
];

test.describe('line styling', () => {
  for (const c of CASES) {
    test(`line: ${c.title}`, async ({ page, track }) => {
      const b = new ChartBuilderPage(page);
      await runStylingCase(b, track, 'line', baseline, c, e2eTitle(c.id));
    });
  }

  test('line: multi-line with extra dimension', async ({ page, track }) => {
    const b = new ChartBuilderPage(page);
    await runStylingCase(
      b,
      track,
      'line',
      baseline,
      {
        title: 'multi-line',
        id: 'line-multi-line-extra-dimension',
        // Extra-dimension placeholder says "multi-line chart" for line
        setup: async (b2) => {
          await b2.setXAxis('date');
          await b2.setTimeGrain('month');
          await b2.setExtraDimension('statename');
        },
        apply: clickTestId('chart-styling-show-data-points'),
      },
      e2eTitle('line-multi-line')
    );
  });

  test('line: styling panel defaults in create', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('line');
    await b.stylingTab();
    await expect(page.getByTestId('chart-styling-line-style-smooth')).toHaveAttribute(
      'data-state',
      'checked'
    );
    await expect(page.getByTestId('chart-styling-show-data-points')).toHaveAttribute(
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
    await expect(page.getByTestId('chart-styling-legend-position')).toHaveText('Right');
    await expect(page.getByTestId('chart-styling-show-data-labels')).toHaveAttribute(
      'data-state',
      'unchecked'
    );
    await expect(page.getByTestId('chart-styling-x-axis-label-rotation')).toHaveText(
      'Horizontal (0°)'
    );
    await expect(page.getByTestId('chart-styling-y-axis-label-rotation')).toHaveText(
      'Horizontal (0°)'
    );
    await expect(page.getByTestId('yAxisNumberFormat')).toHaveText('No Formatting');
  });
});
