import { expect, type Page } from '@playwright/test';
import type { CapturedRequest } from '../support/payload';
import type { BuilderChartType, ChartBuilderPage } from './helpers-builder';
import { API, field, RequestLog, toCaptured } from './helpers-mtp';

/**
 * Helpers for the type-switch matrix specs (type-switch-matrix*.spec.ts): every chart type → every
 * other type, in the create builder (ChartDataConfigurationV3.handleChartTypeChange) and in the
 * edit builder (same handler + the edit page's own handleFormChange mapping on top).
 */

export const SWITCH_TYPES: BuilderChartType[] = [
  'bar',
  'line',
  'pie',
  'number',
  'table',
  'map',
  'pivot_table',
];

const REQUEST_TIMEOUT_MS = 30_000;
export const PAGE_LOAD_TIMEOUT_MS = 30_000;
// Single reads inside a poll: a field can unmount between count() and the read
const READ_TIMEOUT_MS = 1_000;
/** Poll options for post-switch state: map config waits for region types + GeoJSON list. */
export const STATE_POLL = { timeout: REQUEST_TIMEOUT_MS };
/** A fully configured source + one switch + save is ~15 builder interactions. */
export const MATRIX_TEST_TIMEOUT_MS = 150_000;

// Customization values the sources set away from their defaults (so carry-over is visible)
export const BAR_LABEL_POSITION = 'inside';
export const LINE_LABEL_POSITION = 'bottom';
export const PIE_LABEL_POSITION = 'inside';
export const LEGEND_POSITION = 'bottom';
export const NUMBER_SUBTITLE = 'Across all states';
export const NUMBER_PREFIX = '~';
export const MAP_COLOR_SCHEME = 'Greens';

// ---------------------------------------------------------------------------
// Visible form state
// ---------------------------------------------------------------------------

/**
 * What the Data Configuration panel shows. `null` = the field is not rendered for this type.
 * `metrics` = the alias line of every metric row (MetricAccordionItem trigger, first line).
 */
export interface FormState {
  xAxis: string | null;
  extraDim: string | null;
  timeGrain: string | null;
  tableDims: string[] | null;
  tableDrill: boolean | null;
  pivotRows: string[] | null;
  pivotCols: string[] | null;
  /** Checked pivot total switches, in UI order (rowSub, colSub, rowGrand, colGrand) */
  pivotTotals: string[] | null;
  mapState: string | null;
  metrics: string[];
  addMetric: boolean;
}

async function inputValue(page: Page, testId: string): Promise<string | null> {
  const loc = page.getByTestId(testId);
  if ((await loc.count()) === 0) return null;
  return loc.inputValue({ timeout: READ_TIMEOUT_MS });
}

async function listValues(page: Page, prefix: string): Promise<string[]> {
  const values: string[] = [];
  for (let i = 0; ; i++) {
    const v = await inputValue(page, `${prefix}-${i}-input`);
    if (v === null) return values;
    values.push(v);
  }
}

const PIVOT_TOTALS = [
  ['rowSub', 'pivot-show-row-subtotals'],
  ['colSub', 'pivot-show-column-subtotals'],
  ['rowGrand', 'pivot-show-row-grand-total'],
  ['colGrand', 'pivot-show-column-grand-total'],
] as const;

export async function readFormState(page: Page): Promise<FormState> {
  const timeGrain = page.getByTestId('chart-time-grain-select');
  const drill = page.getByTestId('chart-table-drill-down-switch');
  const pivotShown = (await page.getByTestId('pivot-data-configuration').count()) > 0;
  const tableShown = (await page.getByTestId('chart-table-dimension-add-btn').count()) > 0;

  let pivotTotals: string[] | null = null;
  if (pivotShown) {
    pivotTotals = [];
    for (const [name, testId] of PIVOT_TOTALS) {
      const sw = page.getByTestId(testId);
      if (
        (await sw.count()) &&
        (await sw.getAttribute('data-state', { timeout: READ_TIMEOUT_MS })) === 'checked'
      ) {
        pivotTotals.push(name);
      }
    }
  }

  const metrics: string[] = [];
  for (let i = 0; ; i++) {
    const trigger = page.getByTestId(`metric-trigger-${i}`);
    if ((await trigger.count()) === 0) break;
    metrics.push(
      ((await trigger.innerText({ timeout: READ_TIMEOUT_MS })).split('\n')[0] ?? '').trim()
    );
  }

  return {
    xAxis: await inputValue(page, 'chart-x-axis-select-input'),
    extraDim: await inputValue(page, 'chart-extra-dimension-select-input'),
    timeGrain: (await timeGrain.count())
      ? (await timeGrain.innerText({ timeout: READ_TIMEOUT_MS })).trim()
      : null,
    tableDims: tableShown ? await listValues(page, 'chart-table-dimension') : null,
    tableDrill: (await drill.count())
      ? (await drill.getAttribute('data-state', { timeout: READ_TIMEOUT_MS })) === 'checked'
      : null,
    pivotRows: pivotShown ? await listValues(page, 'pivot-row-dimension') : null,
    pivotCols: pivotShown ? await listValues(page, 'pivot-col-dimension') : null,
    pivotTotals,
    mapState: await inputValue(page, 'chart-map-state-column-select-input'),
    metrics,
    addMetric: (await page.getByTestId('add-metric-button').count()) > 0,
  };
}

/** Field defaults for a FormState literal — expectations list only what a type renders. */
export function state(partial: Partial<FormState> & { metrics: string[] }): FormState {
  return {
    xAxis: null,
    extraDim: null,
    timeGrain: null,
    tableDims: null,
    tableDrill: null,
    pivotRows: null,
    pivotCols: null,
    pivotTotals: null,
    mapState: null,
    addMetric: false,
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// Data requests
// ---------------------------------------------------------------------------

export type DataEndpoint = 'chart-data' | 'chart-data-preview' | 'map-data-overlay';

/** Records the three builder data endpoints from page load on. Create before `goto`. */
export class DataRequests {
  readonly chartData: RequestLog;
  readonly preview: RequestLog;
  readonly overlay: RequestLog;

  constructor(readonly page: Page) {
    this.chartData = new RequestLog(page, API.chartData);
    this.preview = new RequestLog(page, API.chartDataPreview);
    this.overlay = new RequestLog(page, API.mapOverlay);
  }

  mark() {
    this.chartData.mark();
    this.preview.mark();
    this.overlay.mark();
  }

  /** Requests to `endpoint` since `mark()` that belong to a chart of type `type`. */
  since(endpoint: DataEndpoint, type: BuilderChartType): CapturedRequest[] {
    if (endpoint === 'map-data-overlay') return this.overlay.since();
    const log = endpoint === 'chart-data' ? this.chartData : this.preview;
    return log.since().filter(
      (c) =>
        field(c.body, 'chart_type') === type &&
        // the map filter-value picker sends raw previews too
        field(c.body, 'computation_type') === 'aggregated'
    );
  }
}

// ---------------------------------------------------------------------------
// Create-builder sources (fully configured, production.mart_education_program)
// ---------------------------------------------------------------------------

/**
 * Open the create builder and wait for the auto-prefilled config's first data request.
 * The first navigation of a test can sit on "Checking authentication..." while staging is busy,
 * hence the page-load timeout.
 */
async function openCreateAndWait(b: ChartBuilderPage, reqs: DataRequests, type: BuilderChartType) {
  await b.page.goto(b.configureUrl(type));
  await expect(b.saveButton).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT_MS });
  if (type === 'table') {
    await reqs.preview.next((c) => field(c.body, 'computation_type') === 'aggregated');
  } else if (type === 'map') {
    await reqs.overlay.next();
  } else {
    await reqs.chartData.next();
  }
  await b.settle();
}

async function twoMetrics(b: ChartBuilderPage) {
  await b.setSimpleMetric(0, 'sum', 'students');
  await b.page.getByTestId('add-metric-button').click();
  await b.setSimpleMetric(1, 'avg', 'male_score');
}

/**
 * Build the fully configured source chart of `type` in the create builder.
 * - bar/line: X statename, SUM(students) + AVG(male_score), extra dim climate_event, data labels on
 *   at a non-default position, legend at the bottom
 * - pie: dimension statename, extra dim climate_event, SUM(students), labels inside, legend bottom
 * - number: SUM(students), subtitle + prefix
 * - table: dims statename + districtname with drill-down, SUM(students) + AVG(male_score)
 * - pivot: rows statename + districtname, cols climate_event, 2 metrics, row subtotals + grand totals
 * - map: state column statename, SUM(students), Greens colour scheme
 */
export async function buildCreateSource(
  b: ChartBuilderPage,
  reqs: DataRequests,
  type: BuilderChartType,
  title: string
) {
  const page = b.page;
  await openCreateAndWait(b, reqs, type);
  await b.setTitle(title);

  switch (type) {
    case 'bar':
    case 'line':
      await b.setXAxis('statename');
      await twoMetrics(b);
      await b.setExtraDimension('climate_event');
      await b.stylingTab();
      await page.getByTestId('chart-styling-show-data-labels').click();
      await b.pickSelect(
        'chart-styling-data-label-position',
        type === 'bar' ? BAR_LABEL_POSITION : LINE_LABEL_POSITION
      );
      await b.pickSelect('chart-styling-legend-position', LEGEND_POSITION);
      await b.dataTab();
      break;

    case 'pie':
      await b.setXAxis('statename');
      await b.setSimpleMetric(0, 'sum', 'students');
      await b.setExtraDimension('climate_event');
      await b.stylingTab();
      await b.pickSelect('chart-styling-data-label-position', PIE_LABEL_POSITION);
      await b.pickSelect('chart-styling-legend-position', LEGEND_POSITION);
      await b.dataTab();
      break;

    case 'number':
      await b.setSimpleMetric(0, 'sum', 'students');
      await b.stylingTab();
      await b.fillAndWait('chart-styling-subtitle', NUMBER_SUBTITLE);
      await b.fillAndWait('chart-styling-number-prefix', NUMBER_PREFIX);
      await b.dataTab();
      break;

    case 'table':
      await b.pickCombo('chart-table-dimension-0', 'statename', 'statename');
      await page.getByTestId('chart-table-dimension-add-btn').click();
      await b.pickCombo('chart-table-dimension-1', 'districtname', 'districtname');
      await page.getByTestId('chart-table-drill-down-switch').click();
      await expect(page.getByTestId('chart-table-drill-down-switch')).toHaveAttribute(
        'data-state',
        'checked'
      );
      await twoMetrics(b);
      break;

    case 'pivot_table':
      await b.pickCombo('pivot-row-dimension-0', 'statename', 'statename');
      await page.getByTestId('add-row-dimension-btn').click();
      await b.pickCombo('pivot-row-dimension-1', 'districtname', 'districtname');
      await b.pickCombo('pivot-col-dimension-0', 'climate_event', 'climate_event');
      await twoMetrics(b);
      for (const testId of [
        'pivot-show-row-subtotals',
        'pivot-show-row-grand-total',
        'pivot-show-column-grand-total',
      ]) {
        await page.getByTestId(testId).click();
        await expect(page.getByTestId(testId)).toHaveAttribute('data-state', 'checked');
      }
      break;

    case 'map':
      await b.setSimpleMetric(0, 'sum', 'students');
      await expect(b.comboInput('chart-map-state-column-select')).toHaveValue('statename');
      await b.stylingTab();
      await b.pickSelect(
        'chart-styling-color-scheme',
        MAP_COLOR_SCHEME,
        `chart-styling-color-scheme-option-${MAP_COLOR_SCHEME}`
      );
      await b.dataTab();
      break;
  }
  await b.settle();
}

// ---------------------------------------------------------------------------
// Save (status-aware: some switched configs are rejected by the backend)
// ---------------------------------------------------------------------------

// POST /api/charts/ exactly (not /api/charts/chart-data/ etc.)
const CHART_CREATE_PATH = API.charts;

export interface SaveResult {
  request: CapturedRequest;
  status: number;
  id?: number;
  /** Response body of a rejected save (validation message) */
  error?: string;
}

/** Create page: click Save Chart, capture POST /api/charts/ + status; tracks the created id. */
export async function saveCreate(
  page: Page,
  track: (resource: 'charts', id: number) => void
): Promise<SaveResult> {
  const isCreate = (method: string, url: string) =>
    method === 'POST' && new URL(url).pathname === CHART_CREATE_PATH;
  const reqP = page.waitForRequest((r) => isCreate(r.method(), r.url()), {
    timeout: REQUEST_TIMEOUT_MS,
  });
  const resP = page.waitForResponse((r) => isCreate(r.request().method(), r.url()), {
    timeout: REQUEST_TIMEOUT_MS,
  });
  await page.getByTestId('chart-edit-save-button').click();
  const request = toCaptured(await reqP);
  const res = await resP;
  if (!res.ok()) return { request, status: res.status(), error: await res.text() };
  const { id } = (await res.json()) as { id: number };
  track('charts', id);
  await expect(page).toHaveURL(new RegExp(`/charts/${id}$`), { timeout: REQUEST_TIMEOUT_MS });
  return { request, status: res.status(), id };
}

/** Edit page: Save → "Update existing chart" → capture PUT /api/charts/<id>/ + status. */
export async function saveUpdate(page: Page, id: number): Promise<SaveResult> {
  const path = `${API.charts}${id}/`;
  const isPut = (method: string, url: string) => method === 'PUT' && new URL(url).pathname === path;
  await page.getByTestId('chart-edit-save-button').click();
  const reqP = page.waitForRequest((r) => isPut(r.method(), r.url()), {
    timeout: REQUEST_TIMEOUT_MS,
  });
  const resP = page.waitForResponse((r) => isPut(r.request().method(), r.url()), {
    timeout: REQUEST_TIMEOUT_MS,
  });
  await page.getByTestId('chart-save-update-existing-btn').click();
  const request = toCaptured(await reqP);
  const res = await resP;
  if (!res.ok()) return { request, status: res.status(), id, error: await res.text() };
  await expect(page).toHaveURL(new RegExp(`/charts/${id}$`), { timeout: REQUEST_TIMEOUT_MS });
  return { request, status: res.status(), id };
}

// ---------------------------------------------------------------------------
// Per-transition expectation
// ---------------------------------------------------------------------------

export interface SwitchExpectation {
  /** Visible Data Configuration fields right after the switch */
  state: FormState;
  /** Whether the target's data request fires after the switch (false: not data-ready / cached) */
  request: boolean;
  /** Save button enabled after the switch */
  saveEnabled: boolean;
  /** HTTP status of the save when enabled (default 200) */
  saveStatus?: number;
  /** Title suffix `[pinned] …` for surprising behavior (with the reason in `why`) */
  pinned?: string;
}

/** Title: `TS-create bar → line` (+ ` [pinned] …`). */
export function matrixTitle(prefix: string, src: string, tgt: string, e?: SwitchExpectation) {
  return `${prefix} ${src} → ${tgt}${e?.pinned ? ` [pinned] ${e.pinned}` : ''}`;
}

// ---------------------------------------------------------------------------
// Edit-builder sources: the extra_config the create builder saves for the sources above
// (captured from buildCreateSource + Save), created through the API
// ---------------------------------------------------------------------------

const TWO_METRICS = [
  { aggregation: 'sum', alias: 'SUM(students)', column: 'students' },
  { aggregation: 'avg', alias: 'AVG(male_score)', column: 'male_score' },
];
const SUM_STUDENTS = [TWO_METRICS[0]];

export const EDIT_SOURCE_CONFIG: Record<BuilderChartType, Record<string, unknown>> = {
  bar: {
    aggregate_function: 'count',
    dimension_column: 'statename',
    extra_dimension_column: 'climate_event',
    metrics: TWO_METRICS,
    customizations: {
      dataLabelPosition: BAR_LABEL_POSITION,
      legendPosition: LEGEND_POSITION,
      orientation: 'vertical',
      showDataLabels: true,
      showLegend: true,
      showTooltip: true,
      stacked: false,
      xAxisLabelRotation: '45',
      xAxisTitle: '',
      yAxisLabelRotation: 'horizontal',
      yAxisTitle: '',
    },
  },
  line: {
    aggregate_function: 'count',
    dimension_column: 'statename',
    extra_dimension_column: 'climate_event',
    metrics: TWO_METRICS,
    customizations: {
      dataLabelPosition: LINE_LABEL_POSITION,
      legendPosition: LEGEND_POSITION,
      lineStyle: 'smooth',
      showDataLabels: true,
      showDataPoints: true,
      showLegend: true,
      showTooltip: true,
      xAxisLabelRotation: 'horizontal',
      xAxisTitle: '',
      yAxisLabelRotation: 'horizontal',
      yAxisTitle: '',
    },
  },
  pie: {
    aggregate_function: 'count',
    dimension_column: 'statename',
    extra_dimension_column: 'climate_event',
    metrics: SUM_STUDENTS,
    customizations: {
      chartStyle: 'donut',
      dataLabelPosition: PIE_LABEL_POSITION,
      labelFormat: 'percentage',
      legendPosition: LEGEND_POSITION,
      showDataLabels: true,
      showLegend: true,
      showTooltip: true,
    },
  },
  number: {
    aggregate_column: 'students',
    aggregate_function: 'sum',
    metrics: SUM_STUDENTS,
    customizations: {
      decimalPlaces: 0,
      numberFormat: 'default',
      numberPrefix: NUMBER_PREFIX,
      numberSize: 'medium',
      numberSuffix: '',
      subtitle: NUMBER_SUBTITLE,
    },
  },
  map: {
    aggregate_column: 'students',
    aggregate_function: 'sum',
    geographic_column: 'statename',
    value_column: 'students',
    // Default India-states GeoJSON on staging (auto-selected by the create builder)
    selected_geojson_id: 35,
    metrics: SUM_STUDENTS,
    customizations: {
      colorScheme: MAP_COLOR_SCHEME,
      nullValueLabel: 'No Data',
      showLegend: true,
      showTooltip: true,
      title: '',
    },
  },
  table: {
    aggregate_function: 'count',
    dimension_column: 'statename',
    dimension_columns: ['statename', 'districtname'],
    dimensions: [
      { column: 'statename', enable_drill_down: true },
      { column: 'districtname', enable_drill_down: true },
    ],
    metrics: TWO_METRICS,
    // What the create builder's table auto-prefill leaves behind (first 6 columns)
    table_columns: ['id', 'country', 'statename', 'districtname', 'districtcode', 'date'],
    customizations: {},
  },
  pivot_table: {
    aggregate_function: 'count',
    row_dimensions: ['statename', 'districtname'],
    column_dimensions: ['climate_event'],
    metrics: TWO_METRICS,
    show_row_subtotals: true,
    show_column_subtotals: false,
    show_row_grand_total: true,
    show_column_grand_total: true,
    row_subtotal_label: 'Subtotal',
    column_subtotal_label: 'Subtotal',
    row_grand_total_label: 'Grand Total',
    column_grand_total_label: 'Grand Total',
    customizations: { decimalPlaces: 0, numberFormat: 'default' },
  },
};
