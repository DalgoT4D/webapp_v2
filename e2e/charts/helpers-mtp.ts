import { expect, type Locator, type Page, type Request } from '@playwright/test';
import type { CapturedRequest } from '../support/payload';
import { e2eTitle, SEED } from '../support/env';

/**
 * Page objects + request helpers for the Map / Table / Pivot builder specs
 * (builder-map.spec.ts, builder-table.spec.ts, builder-pivot.spec.ts).
 * Self-contained on purpose — helpers-builder.ts is owned by another spec set.
 */

export type MtpChartType = 'map' | 'table' | 'pivot_table';

export const EDU = SEED.datasets.education;

// Hover → ECharts tooltip DOM update; the tooltip re-renders on the next frame
const TOOLTIP_POLL_MS = 80;
// Grid step (fraction of the map container) used when scanning for a region by hovering
const REGION_SCAN_STEP = 0.05;
const REQUEST_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Request capture
// ---------------------------------------------------------------------------

export const API = {
  chartData: '/api/charts/chart-data/',
  chartDataPreview: '/api/charts/chart-data-preview/',
  totalRows: '/api/charts/chart-data-preview/total-rows/',
  mapOverlay: '/api/charts/map-data-overlay/',
  charts: '/api/charts/',
} as const;

type Json = CapturedRequest['body'];

/** Same shape `expectPayloadSnapshot` expects (support/payload.ts keeps its parser private). */
export function toCaptured(req: Request): CapturedRequest {
  const raw = req.postData();
  let body: Json = null;
  if (raw) {
    try {
      body = JSON.parse(raw) as Json;
    } catch {
      body = raw;
    }
  }
  const url = new URL(req.url());
  const query: Record<string, Json> = {};
  url.searchParams.forEach((v, k) => {
    try {
      query[k] = JSON.parse(v) as Json;
    } catch {
      query[k] = v;
    }
  });
  return { method: req.method(), path: url.pathname, query, body };
}

/** Reads a nested key off a captured JSON body without `any`. */
export function field(value: Json | undefined, ...keys: Array<string | number>): Json | undefined {
  let cur: Json | undefined = value;
  for (const key of keys) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, Json>)[key as string];
  }
  return cur;
}

/**
 * Records every request to one backend path. Builders fire the same endpoint several times while
 * effects settle (auto-prefill, derived payloads), so a test marks a point in time, acts, then
 * waits for the first request after the mark that satisfies a predicate describing the new state.
 */
export class RequestLog {
  private readonly reqs: Request[] = [];
  private markIdx = 0;

  constructor(
    page: Page,
    private readonly path: string,
    private readonly method = 'POST'
  ) {
    page.on('request', (r) => {
      if (r.method() !== this.method) return;
      if (new URL(r.url()).pathname === this.path) this.reqs.push(r);
    });
  }

  mark() {
    this.markIdx = this.reqs.length;
  }

  since(): CapturedRequest[] {
    return this.reqs.slice(this.markIdx).map(toCaptured);
  }

  all(): CapturedRequest[] {
    return this.reqs.map(toCaptured);
  }

  /** First request after the last `mark()` matching `pred`. */
  async next(
    pred: (c: CapturedRequest) => boolean = () => true,
    timeout = REQUEST_TIMEOUT_MS
  ): Promise<CapturedRequest> {
    let found: CapturedRequest | undefined;
    await expect
      .poll(
        () => {
          found = this.since().find(pred);
          return Boolean(found);
        },
        { timeout, message: `no ${this.method} ${this.path} matching predicate` }
      )
      .toBe(true);
    return found!;
  }
}

// ---------------------------------------------------------------------------
// Builder page object (create + edit)
// ---------------------------------------------------------------------------

export class MtpBuilder {
  readonly preview: Locator;
  readonly dataPreview: RequestLog;
  readonly chartData: RequestLog;
  readonly overlay: RequestLog;

  constructor(readonly page: Page) {
    // Right-hand CHART tab of the builder. TODO testid: MapPreview/TableChart roots have none.
    this.preview = page.getByRole('tabpanel', { name: 'CHART', exact: true });
    this.dataPreview = new RequestLog(page, API.chartDataPreview);
    this.chartData = new RequestLog(page, API.chartData);
    this.overlay = new RequestLog(page, API.mapOverlay);
  }

  static configureUrl(type: MtpChartType) {
    return `/charts/new/configure?schema=${EDU.schema}&table=${EDU.table}&type=${type}`;
  }

  /** Opens the create builder and waits until auto-prefill has produced its first data request. */
  async openCreate(type: MtpChartType) {
    await this.page.goto(MtpBuilder.configureUrl(type));
    await expect(this.page.getByTestId('chart-name-input')).toBeVisible();
    if (type === 'table') await this.dataPreview.next(isAggregatedPreview);
    if (type === 'pivot_table') await this.chartData.next();
    if (type === 'map') await this.overlay.next();
  }

  async openEdit(id: number) {
    await this.page.goto(`/charts/${id}/edit`);
    await expect(this.page.getByTestId('chart-name-input')).not.toHaveValue('', {
      timeout: REQUEST_TIMEOUT_MS,
    });
  }

  async setTitle(name: string) {
    const title = e2eTitle(name);
    await this.page.getByTestId('chart-name-input').fill(title);
    return title;
  }

  async dataTab() {
    await this.page.getByTestId('chart-data-config-tab').click();
  }

  async stylingTab() {
    await this.page.getByTestId('chart-styling-tab').click();
  }

  /** Radix Select: click trigger, click option. */
  async pickSelect(triggerTestId: string, optionTestId: string) {
    await this.page.getByTestId(triggerTestId).click();
    await this.page.getByTestId(optionTestId).click();
  }

  /** Combobox with a stable `id` (testids `${id}-input` / `${id}-item-${value}`). */
  async pickCombobox(id: string, value: string) {
    await this.page.getByTestId(`${id}-input`).click();
    await this.page.getByTestId(`${id}-item-${value}`).click();
    await expect(this.page.getByTestId(`${id}-listbox`)).toBeHidden();
  }

  /** Expands metric accordion `index` (if collapsed) and sets a Simple aggregation on a column. */
  async setSimpleMetric(index: number, aggregation: string, column: string) {
    const agg = this.page.getByTestId(`metric-agg-${index}`);
    if (!(await agg.isVisible())) await this.page.getByTestId(`metric-trigger-${index}`).click();
    await this.pickSelect(`metric-agg-${index}`, `metric-agg-${index}-option-${aggregation}`);
    await this.pickCombobox(`metric-column-${index}`, column);
  }

  /** Create-page save. Registers the new chart for cleanup and returns the POST body + id. */
  async saveCreate(track: (resource: 'charts', id: number) => void) {
    const reqPromise = this.page.waitForRequest(
      (r) => r.method() === 'POST' && new URL(r.url()).pathname === API.charts
    );
    const resPromise = this.page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === API.charts
    );
    await this.page.getByTestId('chart-edit-save-button').click();
    const captured = toCaptured(await reqPromise);
    const res = await resPromise;
    expect(res.ok(), `create chart → ${res.status()}`).toBe(true);
    const { id } = (await res.json()) as { id: number };
    track('charts', id);
    await expect(this.page).toHaveURL(new RegExp(`/charts/${id}$`));
    return { id, captured };
  }

  /** Edit-page save → "Update existing chart". Returns the PUT body. */
  async saveUpdate(id: number) {
    const path = `${API.charts}${id}/`;
    await this.page.getByTestId('chart-edit-save-button').click();
    const reqPromise = this.page.waitForRequest(
      (r) => r.method() === 'PUT' && new URL(r.url()).pathname === path
    );
    const resPromise = this.page.waitForResponse(
      (r) => r.request().method() === 'PUT' && new URL(r.url()).pathname === path
    );
    await this.page.getByTestId('chart-save-update-existing-btn').click();
    const captured = toCaptured(await reqPromise);
    const res = await resPromise;
    expect(res.ok(), `update chart → ${res.status()}`).toBe(true);
    await expect(this.page).toHaveURL(new RegExp(`/charts/${id}$`));
    return captured;
  }
}

// ---------------------------------------------------------------------------
// API factories (for tests that aren't about the create flow)
// ---------------------------------------------------------------------------

interface ApiLike {
  post<T>(path: string, data?: unknown): Promise<T>;
}

/** Map config equivalent to what the builder saves for SUM(students) by statename. */
export const MAP_BASE_CONFIG = {
  metrics: [{ column: 'students', aggregation: 'sum', alias: 'SUM(students)' }],
  value_column: 'students',
  aggregate_column: 'students',
  aggregate_function: 'sum',
  geographic_column: 'statename',
  // Default India-states GeoJSON on staging (seed map 1239 uses it too)
  selected_geojson_id: 35,
  customizations: {
    colorScheme: 'Blues',
    showTooltip: true,
    showLegend: true,
    nullValueLabel: 'No Data',
    title: '',
  },
  filters: [] as unknown[],
  sort: [] as unknown[],
  pagination: { enabled: false, page_size: 50 },
};

/** Dynamic state → district drill-down, as DynamicLevelConfig writes it. */
export const MAP_DISTRICT_HIERARCHY = {
  country_code: 'IND',
  base_level: { label: 'State', level: 0, column: 'statename', region_type: 'state' },
  drill_down_levels: [
    { label: 'District', level: 1, column: 'districtname', region_type: 'district' },
  ],
};

export async function createChartViaApi(
  api: ApiLike,
  track: (resource: 'charts', id: number) => void,
  name: string,
  chartType: MtpChartType,
  extraConfig: Record<string, unknown>
) {
  const chart = await api.post<{ id: number; title: string }>(API.charts, {
    title: e2eTitle(name),
    chart_type: chartType,
    computation_type: 'aggregated',
    schema_name: EDU.schema,
    table_name: EDU.table,
    extra_config: extraConfig,
  });
  track('charts', chart.id);
  return chart;
}

/** chart-data-preview for the chart itself (the map filter value picker sends `raw` ones too). */
export function isAggregatedPreview(c: CapturedRequest) {
  return field(c.body, 'computation_type') === 'aggregated';
}

// ---------------------------------------------------------------------------
// Table helpers (TableChart renders a plain <table>: roles columnheader / row / cell)
// ---------------------------------------------------------------------------

/** Header texts of the rendered table, in order. */
export async function tableHeaders(container: Locator): Promise<string[]> {
  return (await container.getByRole('columnheader').allTextContents()).map((t) => t.trim());
}

/** Body rows (rows that have cells, i.e. not the header row). */
export function tableBodyRows(container: Locator) {
  return container.getByRole('row').filter({ has: container.page().getByRole('cell') });
}

/** Header cell of `column`. */
export function tableHeader(container: Locator, column: string) {
  return container.getByRole('columnheader', { name: column, exact: true });
}

/** Cell locators of `column` for every body row currently rendered. */
export async function tableColumnCells(container: Locator, column: string): Promise<Locator[]> {
  const headers = await tableHeaders(container);
  const idx = headers.indexOf(column);
  if (idx < 0) throw new Error(`column ${column} not in [${headers.join(', ')}]`);
  const rows = tableBodyRows(container);
  const count = await rows.count();
  return Array.from({ length: count }, (_, i) => rows.nth(i).getByRole('cell').nth(idx));
}

// ---------------------------------------------------------------------------
// Map canvas helpers (ECharts draws regions on a canvas → locate them by hovering)
// ---------------------------------------------------------------------------

/** The ECharts instance div inside a container (MapPreview has no testid). */
export function echartsRoot(container: Locator) {
  return container.locator('div[_echarts_instance_]').first();
}

/**
 * The HTML tooltip ECharts appends inside its root: `<div><b>Region</b><br/>label: value</div>`.
 * ECharts internals have no testid/role, so this is the one place we go by DOM shape.
 */
export function mapTooltip(container: Locator) {
  return echartsRoot(container).locator('b').first().locator('..');
}

async function tooltipTitle(container: Locator): Promise<string | null> {
  const title = echartsRoot(container).locator('b').first();
  // A hidden tooltip keeps its last content — only trust a visible one
  if (!(await title.isVisible().catch((): boolean => false))) return null;
  return title.textContent({ timeout: TOOLTIP_POLL_MS }).catch((): null => null);
}

/**
 * Scans the map with the mouse until the tooltip names `region` (or any region when omitted).
 * Returns the page coordinates. Needs the tooltip enabled.
 */
export async function findRegion(
  container: Locator,
  region?: string
): Promise<{ x: number; y: number; name: string }> {
  const page = container.page();
  const box = await echartsRoot(container).boundingBox();
  if (!box) throw new Error('map not rendered');
  // Scan from the centre outwards so central regions are found fast
  const fractions: number[] = [];
  for (let f = REGION_SCAN_STEP; f < 1; f += REGION_SCAN_STEP) fractions.push(Number(f.toFixed(2)));
  fractions.sort((a, b) => Math.abs(a - 0.5) - Math.abs(b - 0.5));
  for (const fx of fractions) {
    for (const fy of fractions) {
      const x = box.x + box.width * fx;
      const y = box.y + box.height * fy;
      await page.mouse.move(x, y);
      await page.waitForTimeout(TOOLTIP_POLL_MS);
      const name = await tooltipTitle(container);
      if (name && (!region || name === region)) return { x, y, name };
    }
  }
  throw new Error(`region ${region ?? '(any)'} not found on map`);
}

/** Moves the mouse off the map so no tooltip/emphasis leaks into a screenshot. */
export async function parkMouse(page: Page) {
  await page.mouse.move(1, 1);
}

// dnd-kit PointerSensor has no activation constraint here; small steps let it detect `over`
const DRAG_STEPS = 12;

/**
 * Pointer drag from one handle onto another (dnd-kit sortable lists). dnd-kit measures on animation
 * frames, so we move in hops and wait for its own signal: the target shifts once it is `over`.
 */
export async function dragTo(source: Locator, target: Locator) {
  const page = source.page();
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('drag handle not visible');
  const x = from.x + from.width / 2;
  const y = from.y + from.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  const dy = to.y > from.y ? to.height : -to.height;
  const endY = to.y + to.height / 2 + dy / 2;
  // Travel in small hops, re-measuring the target between hops (gives dnd-kit frames to react)
  for (let i = 1; i <= DRAG_STEPS; i++) {
    await page.mouse.move(x, y + ((endY - y) * i) / DRAG_STEPS);
    if ((await target.boundingBox())?.y !== to.y) break;
  }
  await expect
    .poll(async () => (await target.boundingBox())?.y, { message: 'drop target did not shift' })
    .not.toBe(to.y);
  await page.mouse.up();
}
