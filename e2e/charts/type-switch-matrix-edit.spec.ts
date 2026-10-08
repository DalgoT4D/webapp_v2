import { test, expect } from '../support/fixtures';
import { e2eTitle } from '../support/env';
import { expectPayloadSnapshot } from '../support/payload';
import { EDU, type BuilderChartType } from './helpers-builder';
import { redactIds } from './helpers-core';
import {
  DataRequests,
  EDIT_SOURCE_CONFIG,
  type DataEndpoint,
  MATRIX_TEST_TIMEOUT_MS,
  matrixTitle,
  PAGE_LOAD_TIMEOUT_MS,
  readFormState,
  saveUpdate,
  state,
  STATE_POLL,
  SWITCH_TYPES,
  type SwitchExpectation,
} from './helpers-switch';

/**
 * MATRIX §1.3 "Type switch", full matrix — EDIT builder (/charts/<id>/edit).
 * Source charts are created through the API with the extra_config the create builder saves
 * (EDIT_SOURCE_CONFIG), then switched and saved with "Update existing" (PUT payload pinned).
 * Logic under test: handleChartTypeChange + the edit page's handleFormChange type-switch block,
 * which remaps columns (map ↔ bar/line/pie/number, table → others) and rebuilds customizations
 * from the new type's defaults (keeping tooltip/legend/data-label flags, titles, dataLabelPosition).
 */

/** The request the edit builder fetches for a chart of each type (tables use chart-data here). */
const EDIT_ENDPOINT: Record<BuilderChartType, DataEndpoint> = {
  bar: 'chart-data',
  line: 'chart-data',
  pie: 'chart-data',
  number: 'chart-data',
  pivot_table: 'chart-data',
  table: 'chart-data',
  map: 'map-data-overlay',
};

type Matrix = Record<BuilderChartType, Partial<Record<BuilderChartType, SwitchExpectation>>>;

const EXPECT: Matrix = {
  bar: {
    // edit handleFormChange re-applies prev dataLabelPosition over the sanitized value when the new type has one
    line: {
      state: state({
        xAxis: 'statename',
        extraDim: 'climate_event',
        addMetric: true,
        metrics: ['SUM(students)', 'AVG(male_score)'],
      }),
      request: true,
      saveEnabled: true,
      saveStatus: 422,
      pinned: 'update rejected 422: previous dataLabelPosition kept',
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
    // edit handleFormChange copies prev.metrics (all of them) for bar/line/pie/number → map, undoing the first-metric trim
    map: {
      state: state({ mapState: 'statename', metrics: ['SUM(students)', 'AVG(male_score)'] }),
      request: true,
      saveEnabled: true,
      pinned: 'map keeps both metric rows',
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
    // edit handleFormChange re-applies prev dataLabelPosition over the sanitized value when the new type has one
    bar: {
      state: state({
        xAxis: 'statename',
        extraDim: 'climate_event',
        addMetric: true,
        metrics: ['SUM(students)', 'AVG(male_score)'],
      }),
      request: true,
      saveEnabled: true,
      saveStatus: 422,
      pinned: 'update rejected 422: previous dataLabelPosition kept',
    },
    // edit handleFormChange re-applies prev dataLabelPosition over the sanitized value when the new type has one
    pie: {
      state: state({ xAxis: 'statename', extraDim: 'climate_event', metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
      saveStatus: 422,
      pinned: 'update rejected 422: previous dataLabelPosition kept',
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
    // edit handleFormChange copies prev.metrics (all of them) for bar/line/pie/number → map, undoing the first-metric trim
    map: {
      state: state({ mapState: 'statename', metrics: ['SUM(students)', 'AVG(male_score)'] }),
      request: true,
      saveEnabled: true,
      pinned: 'map keeps both metric rows',
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
    // edit handleFormChange re-applies prev dataLabelPosition over the sanitized value when the new type has one
    line: {
      state: state({
        xAxis: 'statename',
        extraDim: 'climate_event',
        addMetric: true,
        metrics: ['SUM(students)'],
      }),
      request: true,
      saveEnabled: true,
      saveStatus: 422,
      pinned: 'update rejected 422: previous dataLabelPosition kept',
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
    // edit handleFormChange table → aggregated maps table_columns[0] → dimension_column, [1] → aggregate_column
    bar: {
      state: state({
        xAxis: 'id',
        extraDim: 'None',
        addMetric: true,
        metrics: ['SUM(students)', 'AVG(male_score)'],
      }),
      request: true,
      saveEnabled: true,
      pinned: 'dimension/aggregate column taken from table_columns (id, country)',
    },
    // edit handleFormChange table → aggregated maps table_columns[0] → dimension_column, [1] → aggregate_column
    line: {
      state: state({
        xAxis: 'id',
        extraDim: 'None',
        addMetric: true,
        metrics: ['SUM(students)', 'AVG(male_score)'],
      }),
      request: true,
      saveEnabled: true,
      pinned: 'dimension/aggregate column taken from table_columns (id, country)',
    },
    // edit handleFormChange table → aggregated maps table_columns[0] → dimension_column, [1] → aggregate_column
    pie: {
      state: state({ xAxis: 'id', extraDim: 'None', metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
      pinned: 'dimension/aggregate column taken from table_columns (id, country)',
    },
    // edit handleFormChange table → aggregated maps table_columns[0] → dimension_column, [1] → aggregate_column
    number: {
      state: state({ metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
      pinned: 'dimension/aggregate column taken from table_columns (id, country)',
    },
    // edit handleFormChange table → map maps table_columns[0] → geographic_column, [1] → value_column
    map: {
      state: state({ mapState: 'id', metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
      pinned: 'state column id / value column country taken from table_columns',
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
    bar: {
      state: state({
        xAxis: 'statename',
        extraDim: 'None',
        addMetric: true,
        metrics: ['SUM(students)'],
      }),
      request: true,
      saveEnabled: true,
    },
    line: {
      state: state({
        xAxis: 'statename',
        extraDim: 'None',
        addMetric: true,
        metrics: ['SUM(students)'],
      }),
      request: true,
      saveEnabled: true,
    },
    pie: {
      state: state({ xAxis: 'statename', extraDim: 'None', metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
    },
    number: {
      state: state({ metrics: ['SUM(students)'] }),
      request: true,
      saveEnabled: true,
    },
    // edit handleFormChange map → table fills table_columns, TableDimensionsSelector reads dimensions/dimension_column
    table: {
      state: state({
        tableDims: [''],
        tableDrill: false,
        addMetric: true,
        metrics: ['SUM(students)'],
      }),
      request: true,
      saveEnabled: true,
      pinned: 'no table dimension; state column only lands in table_columns/x_axis_column',
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
  test.describe(`TS-edit from ${src}`, () => {
    for (const tgt of SWITCH_TYPES.filter((t) => t !== src)) {
      const e = EXPECT[src][tgt]!;
      test(matrixTitle('TS-edit', src, tgt, e), async ({ page, api, track }) => {
        test.setTimeout(MATRIX_TEST_TIMEOUT_MS);
        const title = e2eTitle(`ts-edit-${src}-${tgt}`);
        const chart = await api.post<{ id: number }>('/api/charts/', {
          title,
          chart_type: src,
          computation_type: 'aggregated',
          schema_name: EDU.schema,
          table_name: EDU.table,
          extra_config: EDIT_SOURCE_CONFIG[src],
        });
        track('charts', chart.id);

        const reqs = new DataRequests(page);
        await page.goto(`/charts/${chart.id}/edit`);
        await expect(page.getByTestId('chart-name-input')).toHaveValue(title, {
          timeout: PAGE_LOAD_TIMEOUT_MS,
        });
        if (src === 'map') await reqs.overlay.next();
        else await reqs.chartData.next();
        await page.waitForLoadState('networkidle');

        reqs.mark();
        await page.getByTestId(`chart-type-switch-${tgt}`).click();
        await page.waitForLoadState('networkidle');
        const save = page.getByTestId('chart-edit-save-button');

        // (1) visible fields
        await expect.poll(() => readFormState(page), STATE_POLL).toEqual(e.state);

        // (2) next data request (the map overlay carries the chart id)
        if (e.request) {
          // map overlays only fire once the map config has resolved the GeoJSON
          await expect
            .poll(() => reqs.since(EDIT_ENDPOINT[tgt], tgt).length, {
              ...STATE_POLL,
              message: `${EDIT_ENDPOINT[tgt]} after switch`,
            })
            .toBeGreaterThan(0);
        }
        await page.waitForLoadState('networkidle');
        const fired = reqs.since(EDIT_ENDPOINT[tgt], tgt);
        if (e.request) {
          expectPayloadSnapshot(
            redactIds(fired[fired.length - 1], { chart: chart.id }),
            `edit-${src}-to-${tgt}-data`
          );
        } else {
          expect(fired, `no ${EDIT_ENDPOINT[tgt]} after switch`).toHaveLength(0);
        }

        // (3) Save state, (4) PUT payload
        if (!e.saveEnabled) {
          await expect(save).toBeDisabled();
          return;
        }
        await expect(save).toBeEnabled();
        const saved = await saveUpdate(page, chart.id);
        expectPayloadSnapshot(saved.request, `edit-${src}-to-${tgt}-save`);
        expect(saved.status).toBe(e.saveStatus ?? 200);
      });
    }
  });
}
