import { type Locator, type Page, type Request, expect } from '@playwright/test';
import type { ApiClient } from '../support/api-client';
import { type CapturedRequest, captureRequest, expectPayloadSnapshot } from '../support/payload';

/**
 * Page objects + helpers for the dashboard list / builder / tabs specs.
 *
 * Builder facts these helpers encode (see coverage/dashboards.md §3–§7):
 * - Opening the builder POSTs /lock/ and immediately PUTs the dashboard (useDebounce seeds with
 *   the initial state, and dev StrictMode doubles it). `openBuilder` waits for those to settle so
 *   the next captured PUT belongs to the action under test.
 * - Every later state change autosaves ~5s after the last change. `saveAndCapture` clicks the
 *   explicit Save button instead, which PUTs synchronously with the current state.
 */

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

// Seed objects on staging (READ-ONLY: they're only ever *added* to e2e dashboards, never edited)
export const SEED_CHARTS = {
  bar: { id: 1242, title: 'Coverage Percentage' },
  pie: { id: 1237, title: 'Menstrual Products Distributed by Product Type' },
  tableDrill: { id: 1234, title: 'Lowest Coverage drill down' },
  pivot: { id: 1259, title: 'Child Development Risk by District and Severity' },
  map: { id: 1239, title: 'Students Reached Map' },
} as const;

export const SEED_KPIS = {
  femaleScores: { id: 441, name: 'Average Female Scores' },
} as const;

// Upper bound for the mount-time autosave + lock round trip against staging
const BUILDER_READY_TIMEOUT_MS = 30_000;
// Autosave debounce in the builder is 5s; allow generous slack for the PUT to be issued
export const AUTOSAVE_TIMEOUT_MS = 15_000;

/** Matches exactly `PUT /api/dashboards/<id>/` (not /lock/, /lock/refresh/, /filters/ …). */
export function dashboardUrl(id: number | null): RegExp {
  return new RegExp(`/api/dashboards/${id ?? '\\d+'}/$`);
}

function isDashboardPut(req: Request, id: number | null) {
  return req.method() === 'PUT' && dashboardUrl(id).test(req.url());
}

/**
 * Open `/dashboards/<id>/edit` and wait until the builder is idle:
 * lock taken, mount-time autosave(s) finished, toolbar visible.
 */
export async function openBuilder(page: Page, id: number, query = '') {
  const ready = watchBuilderReady(page, id);
  await page.goto(`/dashboards/${id}/edit${query}`);
  await ready();
}

/**
 * Start listening for the builder's mount traffic BEFORE navigating (by URL or by a click that
 * redirects into the builder); await the returned function once navigation has started.
 */
export function watchBuilderReady(page: Page, id: number | null): () => Promise<void> {
  // id null = "whichever dashboard the page is about to create" (the /create redirect)
  if (id !== null) openedBuilders.add(id);
  let pending = 0;
  let finished = 0;
  const onRequest = (r: Request) => {
    if (isDashboardPut(r, id)) pending++;
  };
  const onDone = (r: Request) => {
    if (isDashboardPut(r, id)) {
      pending--;
      finished++;
    }
  };
  page.on('request', onRequest);
  page.on('requestfinished', onDone);
  page.on('requestfailed', onDone);

  const lock = page.waitForRequest(
    (r) =>
      r.method() === 'POST' && new RegExp(`/api/dashboards/${id ?? '\\d+'}/lock/$`).test(r.url()),
    { timeout: BUILDER_READY_TIMEOUT_MS }
  );

  return async () => {
    try {
      const lockReq = await lock;
      const lockedId = Number(/\/api\/dashboards\/(\d+)\/lock\//.exec(lockReq.url())![1]);
      openedBuilders.add(lockedId);
      await expect(page.getByTestId('add-chart-btn')).toBeVisible({
        timeout: BUILDER_READY_TIMEOUT_MS,
      });
      await expect
        .poll(() => finished > 0 && pending === 0, { timeout: BUILDER_READY_TIMEOUT_MS })
        .toBe(true);
    } finally {
      page.off('request', onRequest);
      page.off('requestfinished', onDone);
      page.off('requestfailed', onDone);
    }
  };
}

// Dashboards whose builder this worker opened in the current test (workers run tests serially)
const openedBuilders = new Set<number>();

/**
 * Release edit locks taken by builders opened in this test. Call from `test.afterEach`.
 * The backend refuses to DELETE a locked dashboard (423), and closing the page does not reliably
 * unlock (beforeunload beacons a relative URL at the Next server), so without this the `track`
 * cleanup silently fails and the dashboard leaks until the lock expires.
 */
export async function releaseBuilderLocks(api: ApiClient) {
  for (const id of openedBuilders) {
    await api.delete(`/api/dashboards/${id}/lock/`).catch(() => {
      /* already unlocked or deleted */
    });
  }
  openedBuilders.clear();
}

/** Click a cell toolbar button (View/Edit/Remove) after revealing it on hover. */
export async function clickCellAction(
  page: Page,
  componentId: string,
  action: 'view' | 'edit' | 'remove'
) {
  await cell(page, componentId).hover();
  // The 20×20 `ne` resize handle (z-20) covers the top-right quadrant of the rightmost button,
  // so aim at its lower-left corner like a user would to hit it
  const LOWER_LEFT = { x: 6, y: 22 };
  await page.getByTestId(`dashboard-cell-${action}-${componentId}`).click({ position: LOWER_LEFT });
}

/** Click the explicit Save button and return the PUT it sends. */
export async function saveAndCapture(page: Page, id: number): Promise<CapturedRequest> {
  const req = captureRequest(page, { method: 'PUT', url: dashboardUrl(id) });
  const res = page.waitForResponse((r) => isDashboardPut(r.request(), id));
  await page.getByTestId('dashboard-save-btn').click();
  const captured = await req;
  expect((await res).ok()).toBe(true);
  return captured;
}

/** The next PUT of this dashboard, whatever triggers it (autosave, title blur …). */
export function captureNextPut(page: Page, id: number, timeout = AUTOSAVE_TIMEOUT_MS) {
  return captureRequest(page, { method: 'PUT', url: dashboardUrl(id), timeout });
}

// Tab ids are `tab-<Date.now()>-<random base36>`; the harness normalizer only replaces the
// timestamp part, so the random suffix would make every snapshot unique. Strip it first.
const TAB_RANDOM_SUFFIX = /\b(tab-\d{12,})-[a-z0-9]+\b/g;

function stripVolatile(value: Json, idMap: Map<number, string>): Json {
  if (typeof value === 'string') return value.replace(TAB_RANDOM_SUFFIX, '$1');
  if (Array.isArray(value)) return value.map((v) => stripVolatile(v, idMap));
  if (value && typeof value === 'object') {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value)) {
      const key = k.replace(TAB_RANDOM_SUFFIX, '$1');
      // Only chart references are id-mapped; layout numbers (x/y/w/h) stay as they are
      out[key] =
        k === 'chartId' && typeof v === 'number' && idMap.has(v)
          ? idMap.get(v)!
          : stripVolatile(v, idMap);
    }
    return out;
  }
  return value;
}

/**
 * Snapshot a dashboard request after removing per-run values the harness can't know about:
 * tab-id random suffixes, and ids of charts created by this test (`runChartIds`).
 */
export function expectBuilderPayload(
  captured: CapturedRequest,
  name: string,
  runChartIds: number[] = []
) {
  const idMap = new Map(runChartIds.map((id, i) => [id, `<run-chart-${i + 1}>`]));
  expectPayloadSnapshot({ ...captured, body: stripVolatile(captured.body as Json, idMap) }, name);
}

// ---------- canvas / cells ----------

export function cell(page: Page, componentId: string): Locator {
  return page.getByTestId(`dashboard-cell-${componentId}`);
}

/** All cells on the active tab whose component id starts with `kind-` (chart/kpi/text). */
export function cellsOfKind(page: Page, kind: 'chart' | 'kpi' | 'text'): Locator {
  // TODO testid: cells only carry a per-instance testid, so match on its prefix
  return page.locator(`[data-testid^="dashboard-cell-${kind}-"]`);
}

async function componentIds(page: Page, kind: 'chart' | 'kpi' | 'text'): Promise<string[]> {
  return cellsOfKind(page, kind).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-component-id') || '')
  );
}

/** Run `action`, then return the id of the one new `kind` cell it produced. */
async function newComponentAfter(
  page: Page,
  kind: 'chart' | 'kpi' | 'text',
  action: () => Promise<void>
): Promise<string> {
  const before = new Set(await componentIds(page, kind));
  await action();
  let added = '';
  await expect
    .poll(async () => {
      const now = await componentIds(page, kind);
      added = now.find((id) => !before.has(id)) || '';
      return added;
    })
    .not.toBe('');
  return added;
}

export async function addChartViaModal(page: Page, chart: { id: number; title: string }) {
  return newComponentAfter(page, 'chart', async () => {
    await page.getByTestId('add-chart-btn').click();
    const modal = page.getByTestId('dashboard-chart-selector-modal');
    await expect(modal).toBeVisible();
    await modal.getByTestId('dashboard-chart-selector-search').fill(chart.title);
    await modal.getByTestId(`dashboard-chart-option-${chart.id}`).click();
    await expect(modal).toBeHidden();
  });
}

export async function addKpiViaModal(page: Page, kpi: { id: number; name: string }) {
  return newComponentAfter(page, 'kpi', async () => {
    await page.getByTestId('add-kpi-btn').click();
    const modal = page.getByTestId('dashboard-kpi-selector-modal');
    await expect(modal).toBeVisible();
    await modal.getByTestId('dashboard-kpi-selector-search').fill(kpi.name);
    await modal.getByTestId(`dashboard-kpi-option-${kpi.id}`).click();
    await expect(modal).toBeHidden();
  });
}

export async function addText(page: Page) {
  return newComponentAfter(page, 'text', async () => {
    await page.getByTestId('dashboard-builder-add-text-btn').click();
  });
}

/** Wrapper RGL puts around each cell — carries position + resize handles. */
export function gridItem(page: Page, componentId: string): Locator {
  // TODO testid: react-grid-layout owns this element; there's no testid to hang on it
  return page.locator('.react-grid-item', { has: cell(page, componentId) });
}

/** Mouse-drag with intermediate moves so react-draggable sees a real gesture. */
async function mouseDrag(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  const STEPS = 12;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // A small first hop lets react-draggable register the drag start
  await page.mouse.move(from.x + 2, from.y + 2);
  await page.mouse.move(from.x + dx, from.y + dy, { steps: STEPS });
  await page.mouse.up();
}

export async function dragCell(page: Page, componentId: string, dx: number, dy: number) {
  const strip = page.getByTestId(`dashboard-cell-drag-${componentId}`);
  await cell(page, componentId).hover();
  const box = (await strip.boundingBox())!;
  await mouseDrag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, dx, dy);
}

export async function dragContent(page: Page, componentId: string, dx: number, dy: number) {
  const box = (await cell(page, componentId).boundingBox())!;
  await mouseDrag(page, { x: box.x + box.width / 2, y: box.y + box.height * 0.7 }, dx, dy);
}

export async function resizeCell(
  page: Page,
  componentId: string,
  handle: 'se' | 'e' | 's',
  dx: number,
  dy: number
) {
  const item = gridItem(page, componentId);
  await item.hover();
  // TODO testid: RGL resize handles are identified by class only
  const h = item.locator(`.react-resizable-handle-${handle}`);
  const box = (await h.boundingBox())!;
  await mouseDrag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, dx, dy);
}

/** Layout entry of a component in a captured dashboard PUT body (active/first tab by index). */
export function layoutOf(body: Json, componentId: string, tabIndex = 0) {
  const tabs = (body as { tabs: Array<{ layout_config: Array<Record<string, number | string>> }> })
    .tabs;
  return tabs[tabIndex].layout_config.find((l) => l.i === componentId)!;
}

// ---------- API setup ----------

export interface SeedTab {
  id: string;
  title: string;
  layout_config: Array<Record<string, string | number>>;
  components: Record<string, { id: string; type: string; config: Record<string, unknown> }>;
}

/** Fixed, timestamp-shaped ids so the payload normalizer maps them like UI-created ones. */
export const FIXED_IDS = {
  tab1: 'tab-1700000000001',
  tab2: 'tab-1700000000002',
  tab3: 'tab-1700000000003',
  chart1: 'chart-1700000000011',
  chart2: 'chart-1700000000012',
  text1: 'text-1700000000021',
  kpi1: 'kpi-1700000000031',
} as const;

export function chartComponent(
  componentId: string,
  chart: { id: number; title: string },
  type = 'bar'
) {
  return {
    id: componentId,
    type: 'chart',
    config: {
      chartId: chart.id,
      title: chart.title,
      chartType: type,
      computation_type: 'aggregated',
    },
  };
}

export function textComponent(componentId: string, content: string) {
  return {
    id: componentId,
    type: 'text',
    config: {
      content,
      type: 'paragraph',
      fontSize: 16,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'left',
      color: '#000000',
    },
  };
}

/** Replace a dashboard's tabs through the API (setup only — never on seed dashboards). */
export async function putTabs(
  api: ApiClient,
  dash: { id: number; title: string },
  tabs: SeedTab[]
) {
  await api.put(`/api/dashboards/${dash.id}/`, {
    title: dash.title,
    description: '',
    grid_columns: 12,
    target_screen_size: 'desktop',
    filter_layout: 'vertical',
    tabs,
  });
}

// ---------- tabs ----------

export function tabItems(page: Page): Locator {
  // TODO testid: per-tab testids only; match the prefix to enumerate tabs in order
  return page.getByTestId('dashboard-tab-bar').locator('[data-testid^="tab-item-"]');
}

export async function tabTitles(page: Page): Promise<string[]> {
  return page
    .getByTestId('dashboard-tab-bar')
    .locator('[data-testid^="tab-title-"]')
    .allInnerTexts();
}

// ---------- landing page (personal) ----------

interface OrgUserInfo {
  org: { slug: string };
  landing_dashboard_id: number | null;
}

export async function getPersonalLanding(api: ApiClient, orgSlug: string): Promise<number | null> {
  const users = await api.get<OrgUserInfo[]>('/api/currentuserv2');
  return users.find((u) => u.org.slug === orgSlug)?.landing_dashboard_id ?? null;
}

export async function restorePersonalLanding(api: ApiClient, previous: number | null) {
  if (previous) await api.post(`/api/dashboards/landing-page/set-personal/${previous}`);
  else await api.delete('/api/dashboards/landing-page/remove-personal');
}
