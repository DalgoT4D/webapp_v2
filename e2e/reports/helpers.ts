import { expect, type Locator, type Page } from '@playwright/test';
import { ApiClient, type Resource } from '../support/api-client';
import type { CapturedRequest } from '../support/payload';
import { e2eTitle, SEED } from '../support/env';

/**
 * Page objects + API setup for the reports area.
 * Reports are created from e2e dashboards (a factory bar chart on the education mart) so
 * specs never mutate seed reports 150/151 or seed dashboards 411/412.
 */

type Track = (resource: Resource, id: number) => void;

interface FactoryLike {
  barChart(
    name?: string,
    overrides?: Record<string, unknown>
  ): Promise<{ id: number; title: string }>;
  dashboard(name?: string): Promise<{ id: number; title: string }>;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string | null;
}

export interface ReportRow {
  id: number;
  title: string;
}

export interface ReportDashboard {
  dashboardId: number;
  dashboardTitle: string;
  chartId: number;
  chartTitle: string;
  /** Value filter on statename (only when `withFilter`) */
  filterId?: number;
  /** Seed KPI placed on the dashboard (only when `withKpi`) — read-only reference */
  kpiId?: number;
}

/** The only datetime column on production.mart_education_program (GET /api/reports/dashboards/412/datetime-columns/) */
export const EDUCATION_DATE_COLUMN = {
  schema_name: 'production',
  table_name: 'mart_education_program',
  column_name: 'date',
} as const;

/** Frozen period used by API-created reports — within the education mart's data range */
export const REPORT_PERIOD = { start: '2025-06-01', end: '2026-06-01' } as const;
/** How `formatDateShort` renders REPORT_PERIOD in headers */
export const REPORT_PERIOD_LABEL = 'Jun 1st, 2025 - Jun 1st, 2026';

/** Seed KPI "Female Average Score" — only referenced from e2e dashboards, never edited */
export const SEED_KPI_ID = 441;

/** Grid height of a chart cell (rowHeight 20px) — tall enough for ECharts to draw axes */
const CHART_CELL_H = 17;
const KPI_CELL_H = 11;
const HALF_WIDTH = 6;

/**
 * Native dashboard containing one factory bar chart (+ optional seed KPI and statename value filter).
 * Everything is registered with `track` (via factory) so it is deleted after the test.
 */
export async function createReportDashboard(
  api: ApiClient,
  factory: FactoryLike,
  opts: { name?: string; withKpi?: boolean; withFilter?: boolean } = {}
): Promise<ReportDashboard> {
  const name = opts.name ?? 'report';
  const chart = await factory.barChart(`${name}-bar`);
  const dash = await factory.dashboard(`${name}-dash`);

  const layout: Array<Record<string, unknown>> = [
    { i: 'chart-1', x: 0, y: 0, w: HALF_WIDTH, h: CHART_CELL_H },
  ];
  const components: Record<string, unknown> = {
    'chart-1': {
      id: 'chart-1',
      type: 'chart',
      config: { chartId: chart.id, chartType: 'bar', title: chart.title },
    },
  };
  if (opts.withKpi) {
    layout.push({ i: 'kpi-1', x: HALF_WIDTH, y: 0, w: HALF_WIDTH, h: KPI_CELL_H });
    components['kpi-1'] = {
      id: 'kpi-1',
      type: 'kpi',
      config: { kpiId: SEED_KPI_ID, title: 'Female Average Score' },
    };
  }
  await api.put(`/api/dashboards/${dash.id}/`, {
    tabs: [{ id: 'tab-1', title: 'Main', layout_config: layout, components }],
  });

  let filterId: number | undefined;
  if (opts.withFilter) {
    const filter = await api.post<{ id: number }>(`/api/dashboards/${dash.id}/filters/`, {
      name: 'State',
      filter_type: 'value',
      schema_name: SEED.datasets.education.schema,
      table_name: SEED.datasets.education.table,
      column_name: 'statename',
      settings: { has_default_value: false, can_select_multiple: true },
    });
    filterId = filter.id;
  }

  return {
    dashboardId: dash.id,
    dashboardTitle: dash.title,
    chartId: chart.id,
    chartTitle: chart.title,
    filterId,
    kpiId: opts.withKpi ? SEED_KPI_ID : undefined,
  };
}

/**
 * FactoryLike for hooks without the test-scoped `factory` fixture (beforeAll in the logged-out
 * `public` project). Same bar-chart config as support/fixtures `factory.barChart`.
 * Everything created is pushed to `created` — delete it in afterAll (reverse order).
 */
export function apiFactory(
  api: ApiClient,
  created: Array<{ resource: Resource; id: number }>
): FactoryLike {
  return {
    async barChart(name = 'bar') {
      const { schema, table } = SEED.datasets.education;
      const chart = await api.post<{ id: number; title: string }>('/api/charts/', {
        title: e2eTitle(name),
        chart_type: 'bar',
        computation_type: 'aggregated',
        schema_name: schema,
        table_name: table,
        extra_config: {
          dimension_column: 'statename',
          metrics: [{ column: 'students', aggregation: 'sum', alias: 'Students' }],
          customizations: { orientation: 'vertical', showTooltip: true },
          filters: [],
          sort: [],
          pagination: { enabled: false, page_size: 50 },
        },
      });
      created.push({ resource: 'charts', id: chart.id });
      return chart;
    },
    async dashboard(name = 'dashboard') {
      const dash = await api.post<{ id: number; title: string }>('/api/dashboards/', {
        title: e2eTitle(name),
        grid_columns: 12,
      });
      created.push({ resource: 'dashboards', id: dash.id });
      return dash;
    },
  };
}

/** POST /api/reports/ (dated by default) and register it for cleanup. */
export async function createReport(
  api: ApiClient,
  track: Track,
  opts: { name: string; dashboardId: number; dated?: boolean }
): Promise<ReportRow> {
  const body: Record<string, unknown> = {
    title: e2eTitle(opts.name),
    dashboard_id: opts.dashboardId,
  };
  if (opts.dated !== false) {
    body.date_column = EDUCATION_DATE_COLUMN;
    body.period_start = REPORT_PERIOD.start;
    body.period_end = REPORT_PERIOD.end;
  }
  const res = await api.post<ApiEnvelope<ReportRow>>('/api/reports/', body);
  track('reports', res.data.id);
  return res.data;
}

/** PATCH general access → returns the public share token when mode is public. */
export async function setReportGeneralAccess(
  reportId: number,
  mode: 'public' | 'internal' | 'private'
): Promise<string | undefined> {
  // ApiClient, not a raw request context: it refreshes the 30-min access token on 498
  const api = await ApiClient.create();
  try {
    const body = await api.patch<{ public_share_token?: string }>(
      `/api/access/report/${reportId}/general-access`,
      { mode }
    );
    return body.public_share_token;
  } finally {
    await api.dispose();
  }
}

// ---------- payload normalization (run-specific ids) ----------

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function replaceIdsDeep(value: Json, ids: Map<string, string>): Json {
  if (typeof value === 'number') return ids.get(String(value)) ?? value;
  if (typeof value === 'string') return ids.get(value) ?? value;
  if (Array.isArray(value)) return value.map((v) => replaceIdsDeep(v, ids));
  if (value && typeof value === 'object') {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value)) out[ids.get(k) ?? k] = replaceIdsDeep(v, ids);
    return out;
  }
  return value;
}

/**
 * Replace run-specific numeric ids (report, dashboard, chart, filter ids) in a captured request
 * — as keys, numbers or numeric strings — with stable placeholders before snapshotting.
 * e.g. withStableIds(req, { [report.id]: 'report', [-report.id]: 'report-date-filter' })
 */
export function withStableIds(
  captured: CapturedRequest,
  ids: Record<string | number, string>
): CapturedRequest {
  const map = new Map(Object.entries(ids).map(([k, v]) => [String(k), `<${v}>`]));
  return {
    ...captured,
    query: replaceIdsDeep(captured.query as Json, map) as CapturedRequest['query'],
    body: replaceIdsDeep(captured.body, map),
  };
}

// ---------- page objects ----------

/** Open the viewer and wait for the header. */
export async function openReport(page: Page, reportId: number, query = '') {
  await page.goto(`/reports/${reportId}${query}`);
  await expect(page.getByTestId('report-title')).toBeVisible();
}

/** Rendered ECharts instance of the (single) frozen chart on an e2e report canvas. */
export function echartsInstance(page: Page): Locator {
  // TODO testid: dashboard cells have no per-chart container testid; `_echarts_instance_`
  // is the same hook support/render.ts waits on.
  return page.locator('div[_echarts_instance_]').first();
}

/** Pick a date through the staged DatePicker (edit field → OK). `mmddyyyy` like 06/01/2025. */
export async function pickDate(page: Page, testId: string, mmddyyyy: string) {
  await page.getByTestId(`${testId}-trigger`).click();
  await page.getByTestId(`${testId}-edit-btn`).click();
  const input = page.getByTestId(`${testId}-edit-input`);
  await input.fill(mmddyyyy);
  await input.press('Enter');
  await page.getByTestId(`${testId}-ok-btn`).click();
  await expect(page.getByTestId(`${testId}-popover`)).toBeHidden();
}

/** Reports list: type into one of the column filter popovers. */
export async function setListFilter(
  page: Page,
  column: 'title' | 'dashboard' | 'creator',
  value: string
) {
  await page.getByTestId(`report-filter-${column}-trigger`).click();
  await page.getByTestId(`report-filter-${column}`).fill(value);
  await page.keyboard.press('Escape');
}

/** Wait for the list GET whose query has `search=<value>` (debounced filter reached the server). */
export function waitForListQuery(page: Page, param: string, value: string) {
  return page.waitForResponse((r) => {
    if (r.request().method() !== 'GET') return false;
    const url = new URL(r.url());
    return url.pathname === '/api/reports/' && url.searchParams.get(param) === value;
  });
}

/**
 * Trial orgs show a one-shot "Report" feature coachmark (driver.js) over the list's CREATE REPORT
 * button until the user dismisses it (stored per user on the backend). It intercepts clicks, so
 * dismiss it whenever it shows up.
 */
export async function dismissFeatureNudges(page: Page) {
  await page.addLocatorHandler(page.getByTestId('feature-nudge-dismiss-btn'), async (btn) => {
    await btn.click();
  });
}

/** Tiny valid PDF used to fulfill intercepted export requests. */
export const TINY_PDF = Buffer.from(
  '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'
);

/** Toast by text inside sonner's "Notifications" landmark — toasts have no testids. */
export function toast(page: Page, text: string | RegExp) {
  return page.getByRole('region', { name: /Notifications/ }).getByText(text);
}
