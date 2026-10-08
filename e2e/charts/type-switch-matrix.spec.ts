import { test, expect } from '../support/fixtures';
import { e2eTitle } from '../support/env';
import { expectPayloadSnapshot } from '../support/payload';
import { ChartBuilderPage, type BuilderChartType } from './helpers-builder';
import {
  buildCreateSource,
  DataRequests,
  type DataEndpoint,
  MATRIX_TEST_TIMEOUT_MS,
  matrixTitle,
  readFormState,
  saveCreate,
  state,
  STATE_POLL,
  SWITCH_TYPES,
  type SwitchExpectation,
} from './helpers-switch';

/**
 * MATRIX §1.3 "Type switch", full matrix — CREATE builder (/charts/new/configure).
 * Every type → every other type (42) from a fully configured source (buildCreateSource).
 * Pins, per transition: visible Data Configuration fields, the next data request, Save state and
 * the POST /api/charts/ payload (which customizations carry over).
 * Logic under test: ChartDataConfigurationV3.handleChartTypeChange + sanitizeCustomizationsForChartType;
 * from a map source the MapDataConfigurationV3 selector only sets chart_type.
 * type-switch.spec.ts covers the chained / time-grain variants.
 */

/** The request the create builder fetches for a chart of each type. */
const CREATE_ENDPOINT: Record<BuilderChartType, DataEndpoint> = {
  bar: 'chart-data',
  line: 'chart-data',
  pie: 'chart-data',
  number: 'chart-data',
  pivot_table: 'chart-data',
  table: 'chart-data-preview',
  map: 'map-data-overlay',
};

type Matrix = Record<BuilderChartType, Partial<Record<BuilderChartType, SwitchExpectation>>>;

const EXPECT: Matrix = {
  bar: {
    line: {
      state: state({
        xAxis: 'statename',
        extraDim: 'climate_event',
        addMetric: true,
        metrics: ['SUM(students)', 'AVG(male_score)'],
      }),
      request: true,
      saveEnabled: true,
    },
    pie: {
      state: state({ xAxis: 'statename', extraDim: 'climate_event', metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
    },
    // aggregate_column/function are only mirrored from the metric on a metric edit (number MetricsSelector onChange)
    number: {
      state: state({ metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
      pinned: 'legacy aggregate_func count sent with the kept metric',
    },
    // handleChartTypeChange spreads generateAutoPrefilledConfig('table') dimensions [id]; only dimension_column is copied over it
    table: {
      state: state({
        tableDims: ['id'],
        tableDrill: false,
        addMetric: true,
        metrics: ['SUM(students)', 'AVG(male_score)'],
      }),
      request: true,
      saveEnabled: true,
      pinned: 'table dimension comes from auto-prefill (id), not the source dimension',
    },
    // sanitizeCustomizationsForChartType only coerces dataLabelPosition; map legendPosition must be top-left|top-right|bottom-left|bottom-right
    map: {
      state: state({ mapState: 'statename', metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
      saveStatus: 422,
      pinned: 'save rejected 422: source legendPosition carried into map customizations',
    },
    // the pivot branch overwrites extra_config with row_dimensions: [] / column_dimensions: []
    pivot_table: {
      state: state({
        pivotRows: [''],
        pivotCols: [],
        pivotTotals: [],
        addMetric: true,
        metrics: ['SUM(students)', 'AVG(male_score)'],
      }),
      request: false,
      saveEnabled: false,
      pinned: 'row/column dimensions reset → Save disabled',
    },
  },
  line: {
    bar: {
      state: state({
        xAxis: 'statename',
        extraDim: 'climate_event',
        addMetric: true,
        metrics: ['SUM(students)', 'AVG(male_score)'],
      }),
      request: true,
      saveEnabled: true,
    },
    pie: {
      state: state({ xAxis: 'statename', extraDim: 'climate_event', metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
    },
    // aggregate_column/function are only mirrored from the metric on a metric edit (number MetricsSelector onChange)
    number: {
      state: state({ metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
      pinned: 'legacy aggregate_func count sent with the kept metric',
    },
    // handleChartTypeChange spreads generateAutoPrefilledConfig('table') dimensions [id]; only dimension_column is copied over it
    table: {
      state: state({
        tableDims: ['id'],
        tableDrill: false,
        addMetric: true,
        metrics: ['SUM(students)', 'AVG(male_score)'],
      }),
      request: true,
      saveEnabled: true,
      pinned: 'table dimension comes from auto-prefill (id), not the source dimension',
    },
    // sanitizeCustomizationsForChartType only coerces dataLabelPosition; map legendPosition must be top-left|top-right|bottom-left|bottom-right
    map: {
      state: state({ mapState: 'statename', metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
      saveStatus: 422,
      pinned: 'save rejected 422: source legendPosition carried into map customizations',
    },
    // the pivot branch overwrites extra_config with row_dimensions: [] / column_dimensions: []
    pivot_table: {
      state: state({
        pivotRows: [''],
        pivotCols: [],
        pivotTotals: [],
        addMetric: true,
        metrics: ['SUM(students)', 'AVG(male_score)'],
      }),
      request: false,
      saveEnabled: false,
      pinned: 'row/column dimensions reset → Save disabled',
    },
  },
  pie: {
    bar: {
      state: state({
        xAxis: 'statename',
        extraDim: 'climate_event',
        addMetric: true,
        metrics: ['SUM(students)'],
      }),
      request: true,
      saveEnabled: true,
    },
    line: {
      state: state({
        xAxis: 'statename',
        extraDim: 'climate_event',
        addMetric: true,
        metrics: ['SUM(students)'],
      }),
      request: true,
      saveEnabled: true,
    },
    // aggregate_column/function are only mirrored from the metric on a metric edit (number MetricsSelector onChange)
    number: {
      state: state({ metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
      pinned: 'legacy aggregate_func count sent with the kept metric',
    },
    // handleChartTypeChange spreads generateAutoPrefilledConfig('table') dimensions [id]; only dimension_column is copied over it
    table: {
      state: state({
        tableDims: ['id'],
        tableDrill: false,
        addMetric: true,
        metrics: ['SUM(students)'],
      }),
      request: true,
      saveEnabled: true,
      pinned: 'table dimension comes from auto-prefill (id), not the source dimension',
    },
    // sanitizeCustomizationsForChartType only coerces dataLabelPosition; map legendPosition must be top-left|top-right|bottom-left|bottom-right
    map: {
      state: state({ mapState: 'statename', metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
      saveStatus: 422,
      pinned: 'save rejected 422: source legendPosition carried into map customizations',
    },
    // the pivot branch overwrites extra_config with row_dimensions: [] / column_dimensions: []
    pivot_table: {
      state: state({
        pivotRows: [''],
        pivotCols: [],
        pivotTotals: [],
        addMetric: true,
        metrics: ['SUM(students)'],
      }),
      request: false,
      saveEnabled: false,
      pinned: 'row/column dimensions reset → Save disabled',
    },
  },
  number: {
    // the bar/line/pie branch copies the unset dimension_column over auto-prefill's dimension
    bar: {
      state: state({ xAxis: '', extraDim: 'None', addMetric: true, metrics: ['SUM(students)'] }),
      request: false,
      saveEnabled: false,
      pinned: 'X axis left empty → Save disabled',
    },
    // the bar/line/pie branch copies the unset dimension_column over auto-prefill's dimension
    line: {
      state: state({ xAxis: '', extraDim: 'None', addMetric: true, metrics: ['SUM(students)'] }),
      request: false,
      saveEnabled: false,
      pinned: 'X axis left empty → Save disabled',
    },
    // the bar/line/pie branch copies the unset dimension_column over auto-prefill's dimension
    pie: {
      state: state({ xAxis: '', extraDim: 'None', metrics: ['SUM(students)'] }),
      request: false,
      saveEnabled: false,
      pinned: 'X axis left empty → Save disabled',
    },
    // handleChartTypeChange spreads generateAutoPrefilledConfig('table') dimensions [id]; only dimension_column is copied over it
    table: {
      state: state({
        tableDims: ['id'],
        tableDrill: false,
        addMetric: true,
        metrics: ['SUM(students)'],
      }),
      request: true,
      saveEnabled: true,
      pinned: 'table dimension comes from auto-prefill (id), not the source dimension',
    },
    map: {
      state: state({ mapState: 'statename', metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
    },
    // the pivot branch overwrites extra_config with row_dimensions: [] / column_dimensions: []
    pivot_table: {
      state: state({
        pivotRows: [''],
        pivotCols: [],
        pivotTotals: [],
        addMetric: true,
        metrics: ['SUM(students)'],
      }),
      request: false,
      saveEnabled: false,
      pinned: 'row/column dimensions reset → Save disabled',
    },
  },
  table: {
    bar: {
      state: state({
        xAxis: 'statename',
        extraDim: 'None',
        addMetric: true,
        metrics: ['SUM(students)', 'AVG(male_score)'],
      }),
      request: true,
      saveEnabled: true,
    },
    line: {
      state: state({
        xAxis: 'statename',
        extraDim: 'None',
        addMetric: true,
        metrics: ['SUM(students)', 'AVG(male_score)'],
      }),
      request: true,
      saveEnabled: true,
    },
    pie: {
      state: state({ xAxis: 'statename', extraDim: 'None', metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
    },
    // aggregate_column/function are only mirrored from the metric on a metric edit (number MetricsSelector onChange)
    number: {
      state: state({ metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
      pinned: 'legacy aggregate_func count sent with the kept metric',
    },
    map: {
      state: state({ mapState: 'statename', metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
    },
    // the pivot branch overwrites extra_config with row_dimensions: [] / column_dimensions: []
    pivot_table: {
      state: state({
        pivotRows: [''],
        pivotCols: [],
        pivotTotals: [],
        addMetric: true,
        metrics: ['SUM(students)', 'AVG(male_score)'],
      }),
      request: false,
      saveEnabled: false,
      pinned: 'row/column dimensions reset → Save disabled',
    },
  },
  map: {
    // MapDataConfigurationV3's type selector only sets chart_type (no handleChartTypeChange); auto-prefill is skipped because geographic_column is set
    bar: {
      state: state({ xAxis: '', extraDim: 'None', addMetric: true, metrics: ['SUM(students)'] }),
      request: false,
      saveEnabled: false,
      pinned: 'X axis left empty → Save disabled',
    },
    // MapDataConfigurationV3's type selector only sets chart_type (no handleChartTypeChange); auto-prefill is skipped because geographic_column is set
    line: {
      state: state({ xAxis: '', extraDim: 'None', addMetric: true, metrics: ['SUM(students)'] }),
      request: false,
      saveEnabled: false,
      pinned: 'X axis left empty → Save disabled',
    },
    // MapDataConfigurationV3's type selector only sets chart_type (no handleChartTypeChange); auto-prefill is skipped because geographic_column is set
    pie: {
      state: state({ xAxis: '', extraDim: 'None', metrics: ['SUM(students)'] }),
      request: false,
      saveEnabled: false,
      pinned: 'X axis left empty → Save disabled',
    },
    // MapDataConfigurationV3's type selector only sets chart_type (no handleChartTypeChange); auto-prefill is skipped because geographic_column is set
    number: {
      state: state({ metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
      pinned: 'saves map-only fields and map customizations on the number chart',
    },
    // MapDataConfigurationV3's type selector only sets chart_type (no handleChartTypeChange); auto-prefill is skipped because geographic_column is set
    table: {
      state: state({
        tableDims: [''],
        tableDrill: false,
        addMetric: true,
        metrics: ['SUM(students)'],
      }),
      request: true,
      saveEnabled: true,
      pinned: 'no table dimension; saves the map fields and map customizations',
    },
    // MapDataConfigurationV3's type selector only sets chart_type (no handleChartTypeChange); auto-prefill is skipped because geographic_column is set
    pivot_table: {
      state: state({
        pivotRows: [''],
        pivotCols: [],
        pivotTotals: [],
        addMetric: true,
        metrics: ['SUM(students)'],
      }),
      request: false,
      saveEnabled: false,
      pinned: 'no pivot dimensions → Save disabled',
    },
  },
  pivot_table: {
    // the bar/line/pie branch copies the unset dimension_column over auto-prefill's dimension
    bar: {
      state: state({
        xAxis: '',
        extraDim: 'None',
        addMetric: true,
        metrics: ['SUM(students)', 'AVG(male_score)'],
      }),
      request: false,
      saveEnabled: false,
      pinned: 'X axis left empty → Save disabled',
    },
    // the bar/line/pie branch copies the unset dimension_column over auto-prefill's dimension
    line: {
      state: state({
        xAxis: '',
        extraDim: 'None',
        addMetric: true,
        metrics: ['SUM(students)', 'AVG(male_score)'],
      }),
      request: false,
      saveEnabled: false,
      pinned: 'X axis left empty → Save disabled',
    },
    // the bar/line/pie branch copies the unset dimension_column over auto-prefill's dimension
    pie: {
      state: state({ xAxis: '', extraDim: 'None', metrics: ['SUM(students)'] }),
      request: false,
      saveEnabled: false,
      pinned: 'X axis left empty → Save disabled',
    },
    // aggregate_column/function are only mirrored from the metric on a metric edit (number MetricsSelector onChange)
    number: {
      state: state({ metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
      pinned: 'legacy aggregate_func count sent with the kept metric',
    },
    // handleChartTypeChange spreads generateAutoPrefilledConfig('table') dimensions [id]; only dimension_column is copied over it
    table: {
      state: state({
        tableDims: ['id'],
        tableDrill: false,
        addMetric: true,
        metrics: ['SUM(students)', 'AVG(male_score)'],
      }),
      request: true,
      saveEnabled: true,
      pinned: 'table dimension comes from auto-prefill (id), not the source dimension',
    },
    map: {
      state: state({ mapState: 'statename', metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
    },
  },
};

for (const src of SWITCH_TYPES) {
  test.describe(`TS-create from ${src}`, () => {
    for (const tgt of SWITCH_TYPES.filter((t) => t !== src)) {
      const e = EXPECT[src][tgt]!;
      test(matrixTitle('TS-create', src, tgt, e), async ({ page, track }) => {
        test.setTimeout(MATRIX_TEST_TIMEOUT_MS);
        const b = new ChartBuilderPage(page);
        const reqs = new DataRequests(page);
        await buildCreateSource(b, reqs, src, e2eTitle(`ts-create-${src}-${tgt}`));

        reqs.mark();
        await page.getByTestId(`chart-type-switch-${tgt}`).click();
        await b.settle();

        // (1) visible fields
        await expect.poll(() => readFormState(page), STATE_POLL).toEqual(e.state);

        // (2) next data request
        if (e.request) {
          // map overlays only fire once the map config has resolved the GeoJSON
          await expect
            .poll(() => reqs.since(CREATE_ENDPOINT[tgt], tgt).length, {
              ...STATE_POLL,
              message: `${CREATE_ENDPOINT[tgt]} after switch`,
            })
            .toBeGreaterThan(0);
        }
        await page.waitForLoadState('networkidle');
        const fired = reqs.since(CREATE_ENDPOINT[tgt], tgt);
        if (e.request) {
          expectPayloadSnapshot(fired[fired.length - 1], `create-${src}-to-${tgt}-data`);
        } else {
          expect(fired, `no ${CREATE_ENDPOINT[tgt]} after switch`).toHaveLength(0);
        }

        // (3) Save state, (4) save payload
        if (!e.saveEnabled) {
          await expect(b.saveButton).toBeDisabled();
          return;
        }
        await expect(b.saveButton).toBeEnabled();
        const saved = await saveCreate(page, track);
        expectPayloadSnapshot(saved.request, `create-${src}-to-${tgt}-save`);
        expect(saved.status).toBe(e.saveStatus ?? 200);
      });
    }
  });
}
