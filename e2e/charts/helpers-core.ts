import { type Download, type Locator, type Page, expect } from '@playwright/test';
import type { ApiClient, Resource } from '../support/api-client';
import { e2eTitle, SEED } from '../support/env';
import type { CapturedRequest } from '../support/payload';

/**
 * Page objects + data builders for the charts list / create-pick / edit / detail specs.
 * Builder-specific helpers live in the builder specs' own helper files.
 */

export type ChartTypeId = 'bar' | 'line' | 'pie' | 'number' | 'map' | 'table' | 'pivot_table';

export const ALL_CHART_TYPES: ChartTypeId[] = [
  'bar',
  'pie',
  'line',
  'number',
  'map',
  'table',
  'pivot_table',
];

/** Seed charts on staging (READ-ONLY: view / filter / export only). */
export const SEED_CHARTS = {
  bar: { id: 1242, title: 'Coverage Percentage' },
  line: { id: 1248, title: 'Reach over time by state' },
  pie: { id: 1237, title: 'Menstrual Products Distributed by Product Type' },
  map: { id: 1239, title: 'Students Reached Map' },
  table: { id: 1234, title: 'Lowest Coverage drill down' },
  pivot_table: { id: 1259, title: 'Child Development Risk by District and Severity' },
  /** used by seed dashboard 412 */
  usedInDashboard: { id: 1246, title: 'Learning scores over time', dashboardId: 412 },
  /** oldest seed (updated 2026-08-14 07:54 UTC) — falls outside every relative date filter */
  oldest: { id: 1243, title: 'Maternal Health Visits by Month' },
} as const;

export const CHATBOT_SOURCE = 'production.mart_health_chatbot_operations';
export const CLINIC_SOURCE = 'production.mart_health_clinic_delivery';
/** Seeds on the two sources above */
export const CHATBOT_SEED_IDS = [1250, 1257, 1255];
export const CLINIC_SEED_IDS = [1249, 1253, 1256, 1245];

// Backend caps page_size at 100; the list UI offers 10/20/50/100
const LIST_MAX_PAGE_SIZE = 100;

// ---------------------------------------------------------------------------
// Chart payloads (API creation). Shapes copied from the seeded charts of each type.
// ---------------------------------------------------------------------------

interface ChartCreateBody {
  title: string;
  chart_type: ChartTypeId;
  computation_type: 'aggregated' | 'raw';
  schema_name: string;
  table_name: string;
  extra_config: Record<string, unknown>;
}

const EDU = SEED.datasets.education;

export function chartPayload(type: ChartTypeId, title: string): ChartCreateBody {
  const base = { title, chart_type: type, computation_type: 'aggregated' as const };
  switch (type) {
    case 'bar':
      return {
        ...base,
        schema_name: EDU.schema,
        table_name: EDU.table,
        extra_config: {
          dimension_column: 'statename',
          metrics: [{ column: 'students', aggregation: 'sum', alias: 'Students' }],
          customizations: { orientation: 'vertical', showTooltip: true },
          filters: [],
          sort: [],
          pagination: { enabled: false, page_size: 50 },
        },
      };
    case 'line':
      return {
        ...base,
        schema_name: EDU.schema,
        table_name: EDU.table,
        extra_config: {
          dimension_column: 'date',
          time_grain: 'month',
          metrics: [{ column: 'students', aggregation: 'sum', alias: 'Students' }],
          customizations: {
            lineStyle: 'smooth',
            showDataPoints: true,
            showTooltip: true,
            showLegend: true,
            showDataLabels: false,
            xAxisLabelRotation: 'horizontal',
            yAxisLabelRotation: 'horizontal',
          },
          filters: [],
          sort: [{ column: 'date', direction: 'asc' }],
          pagination: { enabled: false, page_size: 50 },
        },
      };
    case 'pie':
      return {
        ...base,
        schema_name: SEED.datasets.menstrual.schema,
        table_name: SEED.datasets.menstrual.table,
        extra_config: {
          dimension_column: 'product_type',
          metrics: [
            { column: 'products_distributed_numeric', aggregation: 'sum', alias: 'Products' },
          ],
          customizations: {
            chartStyle: 'donut',
            labelFormat: 'percentage',
            showDataLabels: true,
            dataLabelPosition: 'outside',
            showTooltip: true,
            showLegend: true,
            legendPosition: 'right',
          },
          filters: [],
          sort: [],
          pagination: { enabled: false, page_size: 50 },
        },
      };
    case 'number':
      return {
        ...base,
        schema_name: EDU.schema,
        table_name: EDU.table,
        extra_config: {
          metrics: [{ column: 'students', aggregation: 'sum', alias: 'Total Students' }],
          aggregate_column: 'students',
          aggregate_function: 'sum',
          customizations: {
            numberSize: 'medium',
            subtitle: 'students reached',
            numberFormat: 'default',
            decimalPlaces: 0,
            numberPrefix: '',
            numberSuffix: '',
          },
          filters: [],
        },
      };
    case 'map':
      return {
        ...base,
        schema_name: EDU.schema,
        table_name: EDU.table,
        extra_config: {
          geographic_column: 'statename',
          selected_geojson_id: 35,
          value_column: 'students',
          aggregate_column: 'students',
          aggregate_function: 'sum',
          metrics: [{ column: 'students', aggregation: 'sum', alias: 'Students' }],
          geographic_hierarchy: {
            country_code: 'IND',
            base_level: { label: 'State', level: 0, column: 'statename', region_type: 'state' },
            drill_down_levels: [
              { label: 'District', level: 1, column: 'districtname', region_type: 'district' },
            ],
          },
          customizations: {
            colorScheme: 'Blues',
            showTooltip: true,
            showLegend: true,
            nullValueLabel: 'No Data',
            title: '',
          },
          filters: [],
        },
      };
    case 'table':
      return {
        ...base,
        schema_name: EDU.schema,
        table_name: EDU.table,
        extra_config: {
          dimension_column: 'statename',
          dimensions: [
            { column: 'statename', enable_drill_down: true },
            { column: 'districtname', enable_drill_down: true },
          ],
          dimension_columns: ['statename', 'districtname'],
          metrics: [{ column: 'students', aggregation: 'sum', alias: 'Students' }],
          table_columns: [],
          customizations: {},
          filters: [],
          sort: [{ column: 'statename', direction: 'asc' }],
          pagination: { enabled: false, page_size: 50 },
        },
      };
    case 'pivot_table':
      return {
        ...base,
        schema_name: SEED.datasets.childDev.schema,
        table_name: SEED.datasets.childDev.table,
        extra_config: {
          metrics: [{ column: 'child_id', aggregation: 'count_distinct', alias: 'Children' }],
          row_dimensions: ['district'],
          column_dimensions: ['severity'],
          show_row_subtotals: false,
          show_column_subtotals: false,
          show_row_grand_total: true,
          show_column_grand_total: true,
          row_subtotal_label: 'Subtotal',
          column_subtotal_label: 'Subtotal',
          row_grand_total_label: 'Grand Total',
          column_grand_total_label: 'Grand Total',
          customizations: { numberFormat: 'default', decimalPlaces: 0 },
          filters: [],
          sort: [],
        },
      };
  }
}

export interface CreatedChart {
  id: number;
  title: string;
}

/** Create an e2e chart of any type through the API and register it for cleanup. */
export async function createChart(
  api: ApiClient,
  track: (resource: Resource, id: number) => void,
  type: ChartTypeId,
  name: string,
  mutate?: (body: ChartCreateBody) => ChartCreateBody
): Promise<CreatedChart> {
  let body = chartPayload(type, e2eTitle(name));
  if (mutate) body = mutate(body);
  const chart = await api.post<CreatedChart>('/api/charts/', body);
  track('charts', chart.id);
  return chart;
}

/** Empty dashboard whose single tab holds `chartId` — makes the chart "used in a dashboard". */
export async function createDashboardUsingChart(
  api: ApiClient,
  track: (resource: Resource, id: number) => void,
  name: string,
  chartId: number
): Promise<{ id: number; title: string }> {
  const dash = await api.post<{ id: number; title: string }>('/api/dashboards/', {
    title: e2eTitle(name),
    grid_columns: 12,
  });
  track('dashboards', dash.id);
  await api.put(`/api/dashboards/${dash.id}/`, {
    tabs: [
      {
        id: 'tab-1',
        title: 'Tab 1',
        layout_config: [{ i: 'chart-1', x: 0, y: 0, w: 6, h: 10 }],
        components: {
          'chart-1': {
            id: 'chart-1',
            type: 'chart',
            config: { chartId, title: 'e2e', chartType: 'bar' },
          },
        },
      },
    ],
  });
  return dash;
}

// ---------------------------------------------------------------------------
// Charts list page
// ---------------------------------------------------------------------------

export const listRow = {
  titleLink: (page: Page, id: number) => page.getByTestId(`chart-list-title-link-${id}`),
  favorite: (page: Page, id: number) => page.getByTestId(`chart-list-favorite-${id}`),
  menu: (page: Page, id: number) => page.getByTestId(`chart-list-row-menu-${id}`),
  /** The <tr> that owns the chart's title link */
  row: (page: Page, id: number) =>
    page.getByRole('row').filter({ has: page.getByTestId(`chart-list-title-link-${id}`) }),
};

/** Every chart title link currently rendered in the list, in DOM order. */
export function allTitleLinks(page: Page): Locator {
  return page.locator('[data-testid^="chart-list-title-link-"]');
}

export async function visibleChartIds(page: Page): Promise<number[]> {
  const ids = await allTitleLinks(page).evaluateAll((els) =>
    els.map((el) => Number(el.getAttribute('data-testid')!.replace('chart-list-title-link-', '')))
  );
  return ids;
}

export async function visibleChartTitles(page: Page): Promise<string[]> {
  return allTitleLinks(page).allInnerTexts();
}

function isListRequest(url: string, pageSize?: number, pageNum?: number) {
  const u = new URL(url);
  if (u.pathname !== '/api/charts/') return false;
  if (pageSize && u.searchParams.get('page_size') !== String(pageSize)) return false;
  if (pageNum && u.searchParams.get('page') !== String(pageNum)) return false;
  return true;
}

export interface ListResponse {
  data: Array<{
    id: number;
    title: string;
    chart_type: string;
    schema_name: string;
    table_name: string;
    updated_at: string;
    is_favorite?: boolean;
  }>;
  total: number;
  total_pages: number;
  page: number;
  page_size: number;
}

/** Open /charts and wait for the first list response. */
export async function gotoChartsList(page: Page): Promise<ListResponse> {
  const resp = page.waitForResponse(
    (r) => r.request().method() === 'GET' && isListRequest(r.url())
  );
  await page.goto('/charts');
  const body = (await (await resp).json()) as ListResponse;
  await expect(page.getByTestId('charts-create-btn')).toBeVisible();
  return body;
}

/** Pick a page size in the footer and wait for the refetch. */
export async function setListPageSize(page: Page, size: 10 | 20 | 50 | 100): Promise<ListResponse> {
  const resp = page.waitForResponse(
    (r) => r.request().method() === 'GET' && isListRequest(r.url(), size)
  );
  await openMenu(
    page.getByTestId('chart-list-page-size-trigger'),
    page.getByTestId(`chart-list-page-size-option-${size}`)
  );
  await page.getByTestId(`chart-list-page-size-option-${size}`).click();
  const body = (await (await resp).json()) as ListResponse;
  await expect(page.getByTestId('chart-list-page-size-trigger')).toHaveText(String(size));
  return body;
}

/** Type into the Name filter popover and close it. */
export async function filterListByName(page: Page, text: string) {
  await openListFilter(page, 'name');
  const input = page.getByTestId('chart-list-filter-name-input');
  await input.fill(text);
  await closeWith(page, input);
}

/**
 * List page showing only rows whose title contains `text` — page size 100 so newly
 * created charts are on the current page even while other suites create charts.
 */
export async function openListFilteredByName(page: Page, text: string): Promise<ListResponse> {
  await gotoChartsList(page);
  const body = await setListPageSize(page, LIST_MAX_PAGE_SIZE);
  await filterListByName(page, text);
  return body;
}

export async function openRowMenu(page: Page, id: number) {
  await openMenu(listRow.menu(page, id), page.getByTestId(`chart-list-row-menu-select-${id}`));
}

/** Open a list column-filter popover (name | source | type | date). */
export async function openListFilter(page: Page, which: 'name' | 'source' | 'type' | 'date') {
  const probe = {
    name: 'chart-list-filter-name-input',
    source: 'chart-list-filter-source-clear',
    type: 'chart-list-filter-type-clear',
    date: 'chart-list-filter-date-all',
  }[which];
  await openMenu(page.getByTestId(`chart-list-filter-${which}-trigger`), page.getByTestId(probe));
}

/** Close the open popover/menu with Escape and wait until `inside` is gone. */
export async function closeWith(page: Page, inside: Locator) {
  await page.keyboard.press('Escape');
  await expect(inside).toBeHidden();
}

/** Close the open list filter popover. */
export async function closeListFilter(page: Page, which: 'name' | 'source' | 'type' | 'date') {
  await page.keyboard.press('Escape');
  await expect(page.getByTestId(`chart-list-filter-${which}-trigger`)).toHaveAttribute(
    'data-state',
    'closed'
  );
}

/**
 * Go to the next list page. [pinned] The first Next press requests page N+1 but snaps back:
 * while the new page loads `useCharts` reports totalPages=1 and the clamp effect
 * (app/charts/page.tsx "Clamp currentPage") resets to page 1. A second press lands (cached).
 */
export async function nextListPage(page: Page, expectedPage: number) {
  const next = page.getByTestId('chart-list-next-page-btn');
  await expect(async () => {
    await pressButton(next);
    await expect(page.locator('#charts-page-info')).toHaveText(new RegExp(`^${expectedPage} of `), {
      timeout: MENU_ATTEMPT_MS,
    });
  }).toPass({ timeout: MENU_OPEN_MS });
}

/**
 * Activate a button with the keyboard. The onboarding "Get Started" FAB (bottom-right) sits on
 * top of the list's pagination prev/next buttons at 1440×900, so a pointer click cannot reach them.
 */
export async function pressButton(button: Locator) {
  await button.focus();
  await button.press('Enter');
}

// ---------------------------------------------------------------------------
// Payload helpers
// ---------------------------------------------------------------------------

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/**
 * Replace run-specific numeric ids in a captured request body by named placeholders
 * (the harness normalizes titles/timestamps, but ids in bodies are ours to handle).
 */
export function redactIds(captured: CapturedRequest, ids: Record<string, number>): CapturedRequest {
  const byValue = new Map(Object.entries(ids).map(([name, id]) => [id, `<${name}>`]));
  const walk = (v: Json): Json => {
    if (typeof v === 'number' && byValue.has(v)) return byValue.get(v)!;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const out: Record<string, Json> = {};
      for (const [k, val] of Object.entries(v)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  return { ...captured, body: walk(captured.body as Json) };
}

/**
 * Open a Radix popover / menu / select and wait for `item` inside it. Uses the trigger's
 * `data-state` (not item visibility, which stays true during the exit animation) so a retry
 * never toggles an already-open menu shut.
 */
// One attempt of the retry loop below — not a raised timeout, the loop itself is bounded
const MENU_ATTEMPT_MS = 3_000;
const MENU_OPEN_MS = 15_000;

export async function openMenu(trigger: Locator, item: Locator) {
  await expect(async () => {
    if ((await trigger.getAttribute('data-state')) !== 'open') {
      await trigger.click({ timeout: MENU_ATTEMPT_MS });
    }
    await expect(trigger).toHaveAttribute('data-state', 'open', { timeout: MENU_ATTEMPT_MS });
    await expect(item).toBeVisible({ timeout: MENU_ATTEMPT_MS });
  }).toPass({ timeout: MENU_OPEN_MS });
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

/** Run `action` and return the browser download it triggers. */
export async function expectDownload(page: Page, action: () => Promise<void>): Promise<Download> {
  const [download] = await Promise.all([page.waitForEvent('download'), action()]);
  return download;
}

/** `generateFilename()` in lib/chart-export.ts: sanitized lowercase title + ISO timestamp. */
export function exportFilenamePattern(title: string, ext: string, timestamps = 1): RegExp {
  const sanitized = title
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
  const ts = '\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}';
  const escaped = sanitized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}${`-${ts}`.repeat(timestamps)}\\.${ext}$`);
}

// ---------------------------------------------------------------------------
// Detail page
// ---------------------------------------------------------------------------

/**
 * The rendered chart on the detail page, excluding the header (whose title differs per run).
 * TODO testid: the detail page's chart Card (ChartDetailClient.tsx CardContent) has no testid,
 * so ECharts types anchor on the ECharts root element and tables on their table role.
 */
export function detailChartLocator(page: Page, type: ChartTypeId): Locator {
  if (type === 'pivot_table') return page.getByTestId('pivot-table');
  if (type === 'table') return page.getByRole('table').first();
  return page.locator('div[_echarts_instance_]').first();
}

/** Open a chart's detail page and wait until its chart record loads. */
export async function gotoChartDetail(page: Page, id: number, query = ''): Promise<void> {
  const resp = page.waitForResponse(
    (r) => r.request().method() === 'GET' && new URL(r.url()).pathname === `/api/charts/${id}/`
  );
  await page.goto(`/charts/${id}${query}`);
  await resp;
  await expect(page.getByTestId('chart-export-trigger')).toBeVisible();
}

/** Open a chart's edit page and wait until the form is populated. */
export async function gotoChartEdit(page: Page, chart: CreatedChart, query = ''): Promise<void> {
  await page.goto(`/charts/${chart.id}/edit${query}`);
  await expect(page.getByTestId('chart-name-input')).toHaveValue(chart.title);
}
