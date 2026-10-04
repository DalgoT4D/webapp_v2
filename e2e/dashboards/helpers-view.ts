import { expect, type Locator, type Page, type Request } from '@playwright/test';
import { ApiClient } from '../support/api-client';
import { e2eTitle, SEED } from '../support/env';
import type { CapturedRequest } from '../support/payload';
import { waitForEChart } from '../support/render';

/**
 * Page objects + API setup for dashboard view / filters / share specs.
 * (helpers-builder.ts belongs to the builder specs — intentionally not shared.)
 */

// ---------------------------------------------------------------------------
// Seed ids (read-only) used as widgets on e2e dashboards

/** Seed widgets we place on e2e dashboards. All read-only; only referenced, never edited. */
export const SEED_WIDGETS = {
  /** line chart on production.mart_education_program (dimension: date) */
  educationLineChart: 1246,
  /** bar chart on production.mart_health_menstrual_distribution — a table no education filter matches */
  menstrualBarChart: 1238,
  /** KPI "Average Male Scores" on production.mart_education_program */
  educationKpi: 443,
} as const;

/** Seed 412 widgets / filters (read-only). */
export const SEED_412 = {
  lineChart: 1246,
  kpi: 443,
  kpiTitle: 'Male Average Score',
  statenameFilter: 243,
  dateFilter: 245,
} as const;

export const EDUCATION = SEED.datasets.education;

/** Values present in mart_education_program.statename (filter preview returns all 6). */
export const EDUCATION_STATES = [
  'Assam',
  'Karnataka',
  'Maharashtra',
  'Odisha',
  'Rajasthan',
  'Uttar Pradesh',
] as const;

// Title override used for the factory bar chart so screenshots don't contain the run id
export const BAR_TITLE = 'Students by State';

// ---------------------------------------------------------------------------
// API setup

export interface FilterPayload {
  name: string;
  filter_type: 'value' | 'numerical' | 'datetime';
  schema_name: string;
  table_name: string;
  column_name: string;
  settings: Record<string, unknown>;
  order?: number;
}

export const FILTERS = {
  stateMulti: (): FilterPayload => ({
    name: 'Statename',
    filter_type: 'value',
    schema_name: EDUCATION.schema,
    table_name: EDUCATION.table,
    column_name: 'statename',
    settings: { has_default_value: false, can_select_multiple: true },
  }),
  stateSingle: (): FilterPayload => ({
    name: 'Statename',
    filter_type: 'value',
    schema_name: EDUCATION.schema,
    table_name: EDUCATION.table,
    column_name: 'statename',
    settings: { has_default_value: false, can_select_multiple: false },
  }),
  // Same shape the modal saves for a datetime filter (numerical-shaped settings — see D-F3)
  date: (): FilterPayload => ({
    name: 'Date',
    filter_type: 'datetime',
    schema_name: EDUCATION.schema,
    table_name: EDUCATION.table,
    column_name: 'date',
    settings: { ui_mode: 'slider', default_min: 0, default_max: 100, step: 1 },
  }),
  studentsInput: (): FilterPayload => ({
    name: 'Students',
    filter_type: 'numerical',
    schema_name: EDUCATION.schema,
    table_name: EDUCATION.table,
    column_name: 'students',
    settings: { ui_mode: 'input', default_min: 0, default_max: 100, step: 1 },
  }),
};

interface CreatedFilter {
  id: number;
  name: string;
}

export function createFilter(api: ApiClient, dashboardId: number, payload: FilterPayload) {
  return api.post<CreatedFilter>(`/api/dashboards/${dashboardId}/filters/`, payload);
}

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Widget {
  id: string;
  type: 'chart' | 'kpi';
  config: Record<string, unknown>;
  layout: Omit<LayoutItem, 'i'>;
}

// Fixed component ids (not Date.now()-style) so saved tabs never need normalizing
const TAB_ID = 'tab-e2e-main';

/** PUT a single tab containing `widgets` onto an existing dashboard. */
export async function putWidgets(api: ApiClient, dashboardId: number, widgets: Widget[]) {
  const layout_config = widgets.map((w) => ({
    i: w.id,
    ...w.layout,
    minW: 1,
    minH: 1,
    maxW: 12,
    moved: false,
    static: false,
  }));
  const components = Object.fromEntries(
    widgets.map((w) => [w.id, { id: w.id, type: w.type, config: w.config }])
  );
  await api.put(`/api/dashboards/${dashboardId}/`, {
    grid_columns: 12,
    target_screen_size: 'desktop',
    filter_layout: 'vertical',
    tabs: [{ id: TAB_ID, title: 'Main', layout_config, components }],
  });
}

export interface FilterDashboard {
  id: number;
  title: string;
  /** factory bar chart: education statename × SUM(students) — the SHOT target */
  barChartId: number;
  lineChartId: number;
  otherChartId: number;
  kpiId: number;
}

interface Factoryish {
  barChart(name?: string): Promise<{ id: number; title: string }>;
  dashboard(name?: string): Promise<{ id: number; title: string }>;
}

/**
 * e2e dashboard with: factory bar (education), seed line (education),
 * seed bar on another table (menstrual) and an education KPI. No filters.
 */
export async function buildFilterDashboard(
  api: ApiClient,
  factory: Factoryish,
  name = 'dash-view'
): Promise<FilterDashboard> {
  const bar = await factory.barChart(`${name}-bar`);
  const dash = await factory.dashboard(name);
  await putWidgets(api, dash.id, defaultWidgets(bar.id));
  return {
    id: dash.id,
    title: dash.title,
    barChartId: bar.id,
    lineChartId: SEED_WIDGETS.educationLineChart,
    otherChartId: SEED_WIDGETS.menstrualBarChart,
    kpiId: SEED_WIDGETS.educationKpi,
  };
}

export function defaultWidgets(barChartId: number): Widget[] {
  return [
    {
      id: 'kpi-e2e-education',
      type: 'kpi',
      config: { kpiId: SEED_WIDGETS.educationKpi, title: 'Male Average Score' },
      layout: { x: 0, y: 0, w: 4, h: 12 },
    },
    {
      id: 'chart-e2e-bar',
      type: 'chart',
      config: {
        chartId: barChartId,
        chartType: 'bar',
        title: BAR_TITLE,
        titleOverride: BAR_TITLE,
        showTitle: true,
      },
      layout: { x: 4, y: 0, w: 8, h: 17 },
    },
    {
      id: 'chart-e2e-line',
      type: 'chart',
      config: { chartId: SEED_WIDGETS.educationLineChart, chartType: 'line' },
      layout: { x: 0, y: 17, w: 6, h: 17 },
    },
    {
      id: 'chart-e2e-other',
      type: 'chart',
      config: { chartId: SEED_WIDGETS.menstrualBarChart, chartType: 'bar' },
      layout: { x: 6, y: 17, w: 6, h: 17 },
    },
  ];
}

/** Short-lived admin client for the share API (ApiClient refreshes an expired access token). */
async function patch<T>(path: string, data: unknown): Promise<T> {
  const api = await ApiClient.create();
  try {
    return await api.patch<T>(path, data);
  } finally {
    await api.dispose();
  }
}

export interface GeneralAccessResponse {
  mode: string;
  public_url?: string;
  public_share_token?: string;
}

export function setGeneralAccess(dashboardId: number, mode: 'internal' | 'private' | 'public') {
  return patch<GeneralAccessResponse>(`/api/access/dashboard/${dashboardId}/general-access`, {
    mode,
  });
}

/** Make an e2e dashboard public and return its share token. */
export async function makePublic(dashboardId: number): Promise<string> {
  const res = await setGeneralAccess(dashboardId, 'public');
  const token = res.public_share_token ?? res.public_url?.split('/').pop();
  if (!token) throw new Error(`no public token in ${JSON.stringify(res)}`);
  return token;
}

/** Chart body identical to `factory.barChart` — for specs without the factory fixture (public project). */
export function barChartBody(title: string) {
  return {
    title,
    chart_type: 'bar',
    computation_type: 'aggregated',
    schema_name: EDUCATION.schema,
    table_name: EDUCATION.table,
    extra_config: {
      dimension_column: 'statename',
      metrics: [{ column: 'students', aggregation: 'sum', alias: 'Students' }],
      customizations: { orientation: 'vertical', showTooltip: true },
      filters: [] as unknown[],
      sort: [] as unknown[],
      pagination: { enabled: false, page_size: 50 },
    },
  };
}

/** Public-project setup: same dashboard shape as `buildFilterDashboard`, created with a raw ApiClient. */
export async function buildPublicDashboard(api: ApiClient, name: string) {
  const chart = await api.post<{ id: number }>(
    '/api/charts/',
    barChartBody(e2eTitle(`${name}-bar`))
  );
  const dash = await api.post<{ id: number; title: string }>('/api/dashboards/', {
    title: e2eTitle(name),
    grid_columns: 12,
  });
  await putWidgets(api, dash.id, defaultWidgets(chart.id));
  const filter = await createFilter(api, dash.id, FILTERS.stateMulti());
  const token = await makePublic(dash.id);
  return {
    dashboardId: dash.id,
    title: dash.title,
    barChartId: chart.id,
    filterId: filter.id,
    token,
  };
}

// ---------------------------------------------------------------------------
// Payload relabelling — ids that change per run (filter ids, chart ids, tokens) → stable labels

/**
 * Replace run-specific ids in a captured request with stable labels, e.g.
 * `{ [filterId]: '<state>', [chartId]: '<bar>', [token]: '<token>' }`.
 * Rewrites path segments, `dashboard_filters` keys and string values anywhere in body/query.
 */
export function relabel(
  captured: CapturedRequest,
  labels: Record<string, string>
): CapturedRequest {
  const swap = (s: string) =>
    Object.entries(labels).reduce(
      (acc, [raw, label]) =>
        acc
          .split(`/${raw}/`)
          .join(`/${label}/`)
          .replace(new RegExp(`/${raw}$`), `/${label}`),
      s
    );
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return labels[v] ?? swap(v);
    if (typeof v === 'number') return labels[String(v)] ?? v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([k, val]) => [labels[k] ?? k, walk(val)])
      );
    }
    return v;
  };
  return {
    method: captured.method,
    path: swap(captured.path),
    query: walk(captured.query) as CapturedRequest['query'],
    body: walk(captured.body) as CapturedRequest['body'],
  };
}

// ---------------------------------------------------------------------------
// Request listeners

/** Collect every request matching `pattern` from now on. */
export function collectRequests(page: Page, pattern: RegExp): Request[] {
  const seen: Request[] = [];
  page.on('request', (r) => {
    if (pattern.test(r.url())) seen.push(r);
  });
  return seen;
}

export const chartDataUrl = (chartId: number) => new RegExp(`/api/charts/${chartId}/data/`);
export const chartDataWithFilters = (chartId: number) =>
  new RegExp(`/api/charts/${chartId}/data/\\?dashboard_filters=`);
export const kpiDataWithFilters = (kpiId: number) =>
  new RegExp(`/api/kpis/${kpiId}/data/\\?dashboard_filters=`);

// ---------------------------------------------------------------------------
// Page objects

/** The dashboard view (desktop header is the visible one at 1440px). */
export async function openView(page: Page, dashboardId: number) {
  await page.goto(`/dashboards/${dashboardId}`);
  await expect(page.getByTestId('dashboard-view-back-btn')).toBeVisible({ timeout: 30_000 });
}

/** The builder, waiting for the filters sidebar to be interactive. */
export async function openBuilder(page: Page, dashboardId: number) {
  await page.goto(`/dashboards/${dashboardId}/edit`);
  await expect(page.getByTestId('dashboard-filter-add-btn')).toBeVisible({ timeout: 30_000 });
}

/**
 * Grid cell of a chart in view mode.
 * TODO testid: the view grid item has no testid; `.dashboard-item` is the only hook (view:1500).
 */
export function chartCell(page: Page, chartId: number): Locator {
  return page
    .locator('.dashboard-item')
    .filter({ has: page.getByTestId(`dashboard-chart-fullscreen-btn-${chartId}`) });
}

/** Wait until a chart cell in view mode has its toolbar (data loaded) and a settled canvas. */
export async function waitForViewChart(page: Page, chartId: number) {
  const cell = chartCell(page, chartId);
  await expect(cell).toBeVisible({ timeout: 30_000 });
  await waitForEChart(cell);
  return cell;
}

/** Hover toolbars are revealed on hover; park the mouse so screenshots don't include them. */
export async function parkMouse(page: Page) {
  await page.mouse.move(1, 1);
}

export function filterPanel(page: Page) {
  return page.getByTestId('dashboard-filters-panel');
}

export function filterElement(page: Page, filterId: number | string) {
  return page.getByTestId(`dashboard-filter-${filterId}`);
}

/** Multi-select value filter: toggle each value, then close the popover. */
export async function selectMultiValues(page: Page, filterId: number | string, values: string[]) {
  const base = `dashboard-filter-value-${filterId}`;
  await page.getByTestId(`${base}-container`).click();
  for (const v of values) {
    await page.getByTestId(`${base}-item-${v}`).click();
  }
  await page.keyboard.press('Escape');
  for (const v of values) {
    await expect(
      page.getByTestId(`${base}-container`).getByRole('button', { name: `Remove ${v}` })
    ).toBeVisible();
  }
}

/** Single-select value filter. */
export async function selectSingleValue(page: Page, filterId: number | string, value: string) {
  const base = `dashboard-filter-value-${filterId}`;
  await page.getByTestId(`${base}-input`).click();
  await page.getByTestId(`${base}-item-${value}`).click();
  await expect(page.getByTestId(`${base}-input`)).toHaveValue(value);
}

/**
 * Pick a date in a DatePicker (react-day-picker with month/year dropdowns).
 * `prefix` is the DatePicker testId, e.g. `dashboard-filter-date-start-12`.
 */
export async function pickDate(page: Page, prefix: string, date: Date) {
  await page.getByTestId(`${prefix}-trigger`).click();
  const popover = page.getByTestId(`${prefix}-popover`);
  await expect(popover).toBeVisible();
  await popover
    .getByRole('combobox', { name: 'Choose the Year' })
    .selectOption(String(date.getFullYear()));
  await popover
    .getByRole('combobox', { name: 'Choose the Month' })
    .selectOption(String(date.getMonth()));
  // TODO testid: day buttons expose only data-day (toLocaleDateString, en-US in Playwright)
  await popover.locator(`[data-day="${date.toLocaleDateString('en-US')}"]`).click();
  await expect(popover).toBeHidden();
}

/** Day button inside an open DatePicker popover. */
export function dayButton(page: Page, prefix: string, date: Date) {
  return page
    .getByTestId(`${prefix}-popover`)
    .locator(`[data-day="${date.toLocaleDateString('en-US')}"]`);
}

/** Click Apply and wait for the deliberate 500ms spinner to finish. */
export async function applyFilters(page: Page) {
  const apply = page.getByTestId('dashboard-filter-apply-btn');
  await apply.click();
  await expect(apply).toBeEnabled();
}

/** Response JSON of the next chart data request for `chartId` matching `pattern`. */
export async function nextChartData(page: Page, pattern: RegExp) {
  const res = await page.waitForResponse(
    (r) => pattern.test(r.url()) && r.request().method() === 'GET',
    {
      timeout: 30_000,
    }
  );
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as unknown;
}

/** Stable text of an embed snippet: origin, token and run-specific title replaced. */
export function normalizeEmbed(snippet: string, origin: string, token: string, title: string) {
  return snippet
    .split(origin)
    .join('<origin>')
    .split(token)
    .join('<token>')
    .split(title)
    .join('<title>');
}

/** Visible heading with the dashboard title (header renders mobile + desktop copies). */
export function viewTitle(page: Page, title: string) {
  return page.getByRole('heading', { name: title, exact: true }).locator('visible=true');
}
