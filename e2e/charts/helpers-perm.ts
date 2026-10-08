import { expect, type Page, type Request } from '@playwright/test';
import type { ApiClient } from '../support/api-client';
import { BACKEND_URL, e2eTitle, SEED } from '../support/env';
import { type CapturedRequest, normalize, stablePayload } from '../support/payload';
import { journal } from '../support/journal';
import { ChartBuilderPage, EDU } from './helpers-builder';
import { redactIds } from './helpers-core';
import { API, isAggregatedPreview, toCaptured } from './helpers-mtp';

/**
 * Permutation harness (perm-*.spec.ts): fill / switch / refill the create and edit builders in
 * every order and pin what each step does TODAY.
 *
 * Every step records
 *   - `<name>-ui.json`  every visible testid'd control of the Data Configuration panel (values,
 *                       metric rows, add/remove buttons), the selected chart type, title, Save state
 *                       and whether the step sent a data request (always on — this is the UI guard)
 *   - `<name>.json`     the step's data request (PAY, via expectPayloadSnapshot) when one was sent
 *
 * Determinism: SWR dedupes a key for 2s after its response (dedupingInterval), so whether revisiting
 * a config refetches would depend on how fast the test clicks. The page runs on Playwright's clock:
 * before every step we jump the clock past the dedupe window (and every 500ms debounce), so a step
 * that changes the config ALWAYS sends a request and a step that doesn't NEVER does.
 */

export const TYPES = ['bar', 'line', 'pie', 'number', 'table', 'map', 'pivot_table'] as const;
export type PermType = (typeof TYPES)[number];
export type Mode = 'create' | 'edit';
export const MODES: Mode[] = ['create', 'edit'];

type Json = CapturedRequest['body'];
type TrackFn = (resource: 'charts', id: number) => void;

/** Short names used in test titles / snapshot names. */
export const SHORT: Record<PermType, string> = {
  bar: 'bar',
  line: 'line',
  pie: 'pie',
  number: 'number',
  table: 'table',
  map: 'map',
  pivot_table: 'pivot',
};

// ChartTypeSelector shows the selected type's description under the buttons (buttons expose no state)
const TYPE_DESCRIPTIONS: Record<PermType, string> = {
  bar: 'Compare values across categories',
  line: 'Display trends over time',
  pie: 'Show proportions of a whole',
  number: 'Display a single key metric prominently',
  map: 'Visualize geographic data',
  table: 'Display data in rows and columns',
  pivot_table: 'Cross-tabulate data across two dimensions',
};

export const MATERNAL = SEED.datasets.maternal;
export const MATERNAL_FULL_NAME = `${MATERNAL.schema}.${MATERNAL.table}`;
export const EDU_FULL_NAME = `${EDU.schema}.${EDU.table}`;

// SWR dedupingInterval (hooks/api/useChart.ts) + margin: jumping past it lets a revisited key refetch
const SWR_DEDUPE_JUMP_MS = 2_500;
// Every debounced input in the builder (alias, expression, subtitle…) uses 500ms; flush them
const DEBOUNCE_FLUSH_MS = 600;
// settleFully(): stop once the request counts are unchanged for this many consecutive settles
const STABLE_ROUNDS_NEEDED = 2;
const MAX_SETTLE_ROUNDS = 8;
// Backend traffic must stay quiet this long before a step counts as settled (chained requests —
// columns → prefill → data, regions → geojsons → overlay — start well within it)
const QUIET_MS = 700;
const SETTLE_TIMEOUT_MS = 45_000;
const REQUEST_TIMEOUT_MS = 45_000;

const TRACKED_API = /\/api\/(charts|warehouse|metrics)\//;
const CHART_CREATE_PATH = '/api/charts/';

/** In-flight backend requests of the builder (charts / warehouse / metrics APIs). */
class NetTracker {
  private inflight = new Set<Request>();
  private lastActivity = Date.now();

  constructor(page: Page) {
    const relevant = (r: Request) => r.url().startsWith(BACKEND_URL) && TRACKED_API.test(r.url());
    page.on('request', (r) => {
      if (!relevant(r)) return;
      this.inflight.add(r);
      this.lastActivity = Date.now();
    });
    const done = (r: Request) => {
      if (!this.inflight.delete(r)) return;
      this.lastActivity = Date.now();
    };
    page.on('requestfinished', done);
    page.on('requestfailed', done);
  }

  async idle() {
    await expect
      .poll(() => this.inflight.size === 0 && Date.now() - this.lastActivity >= QUIET_MS, {
        timeout: SETTLE_TIMEOUT_MS,
        message: 'builder network did not go quiet',
        intervals: [100],
      })
      .toBe(true);
  }
}

/** All requests to one backend path, in the order the page sent them. */
class Log {
  readonly reqs: Request[] = [];
  constructor(page: Page, path: string, method = 'POST') {
    page.on('request', (r) => {
      if (r.method() === method && new URL(r.url()).pathname === path) this.reqs.push(r);
    });
  }
}

export interface UiState {
  type: PermType | null;
  title: string;
  saveEnabled: boolean;
  controls: Record<string, string | boolean>;
}

export interface StepResult {
  /** Data request the step sent (last one on the type's primary endpoint), or null */
  request: CapturedRequest | null;
  /** Latest data request of the page = the request for the config now on screen */
  current: CapturedRequest | null;
  ui: UiState;
}

export interface SaveResult {
  request: CapturedRequest | null;
  status: number | null;
  id: number | null;
}

/**
 * Create builder (`/charts/new/configure`) or edit builder (`/charts/<id>/edit`) driven by the same
 * steps. Reuses ChartBuilderPage (create-builder page object) for the shared controls.
 */
export class PermBuilder {
  readonly b: ChartBuilderPage;
  private readonly net: NetTracker;
  private readonly chartData: Log;
  private readonly preview: Log;
  private readonly overlay: Log;
  private clockInstalled = false;
  private chartId: number | null = null;

  constructor(
    readonly page: Page,
    readonly mode: Mode,
    /** Prefix of every snapshot name of this test (unique within the spec file) */
    readonly key: string
  ) {
    this.b = new ChartBuilderPage(page);
    this.net = new NetTracker(page);
    this.chartData = new Log(page, API.chartData);
    this.preview = new Log(page, API.chartDataPreview);
    this.overlay = new Log(page, API.mapOverlay);
    // Re-opening the builder with unsaved changes fires the page's beforeunload prompt
    page.on('dialog', (d) => {
      if (d.type() === 'beforeunload') void d.accept();
    });
  }

  // ---------- navigation ----------

  /** Create: open the builder for `type` on the education mart. Edit: open chart `id`. */
  async open(target: { type: PermType } | { id: number; title: string; type: PermType }) {
    if (!this.clockInstalled) {
      await this.page.clock.install();
      this.clockInstalled = true;
    }
    if ('id' in target) {
      this.chartId = target.id;
      await this.page.goto(`/charts/${target.id}/edit`);
      await expect(this.b.nameInput).toHaveValue(target.title, { timeout: REQUEST_TIMEOUT_MS });
    } else {
      await this.page.goto(this.b.configureUrl(target.type));
      await expect(this.b.saveButton).toBeVisible({ timeout: REQUEST_TIMEOUT_MS });
    }
    // First data request of the (auto-prefilled / loaded) config
    await expect
      .poll(() => this.primary(target.type).length, {
        timeout: REQUEST_TIMEOUT_MS,
        message: `no initial data request for ${target.type}`,
      })
      .toBeGreaterThan(0);
    // Data Source shows its value only once sync_tables (behind the warehouse lookup) has loaded
    await expect(this.page.getByTestId('chart-dataset-select-input')).not.toHaveValue('', {
      timeout: REQUEST_TIMEOUT_MS,
    });
    await this.settle();
  }

  // ---------- timing ----------

  /** Flush debounces, then wait until the builder's backend traffic is quiet. */
  async settle() {
    await this.page.clock.fastForward(DEBOUNCE_FLUSH_MS);
    await this.net.idle();
  }

  /**
   * Settle until the request stream is stable. One debounce flush isn't always enough: a change
   * can chain (debounce → state → effect → another debounced request), so a single settle() may
   * return while the last request is still pending — and a snapshot then records a stale one.
   */
  async settleFully() {
    let stableRounds = 0;
    let last = JSON.stringify(this.counts());
    for (let round = 0; round < MAX_SETTLE_ROUNDS && stableRounds < STABLE_ROUNDS_NEEDED; round++) {
      await this.settle();
      const now = JSON.stringify(this.counts());
      stableRounds = now === last ? stableRounds + 1 : 0;
      last = now;
    }
  }

  // ---------- requests ----------

  /** Requests on the endpoint that renders `type` in this builder. */
  private primary(type: PermType): Request[] {
    if (type === 'map') return this.overlay.reqs;
    if (type === 'table' && this.mode === 'create') {
      return this.preview.reqs.filter((r) => isAggregatedPreview(toCaptured(r)));
    }
    return this.chartData.reqs;
  }

  private counts() {
    return {
      chartData: this.chartData.reqs.length,
      preview: this.preview.reqs.length,
      overlay: this.overlay.reqs.length,
    };
  }

  private sinceMark(type: PermType, mark: ReturnType<PermBuilder['counts']>): Request[] {
    if (type === 'map') return this.overlay.reqs.slice(mark.overlay);
    if (type === 'table' && this.mode === 'create') {
      return this.preview.reqs
        .slice(mark.preview)
        .filter((r) => isAggregatedPreview(toCaptured(r)));
    }
    return this.chartData.reqs.slice(mark.chartData);
  }

  /** Latest data request of the page for the config now on screen. */
  current(type: PermType): CapturedRequest | null {
    const reqs = this.primary(type);
    return reqs.length ? this.redact(toCaptured(reqs[reqs.length - 1])) : null;
  }

  private redact(c: CapturedRequest): CapturedRequest {
    return this.chartId ? redactIds(c, { chart: this.chartId }) : c;
  }

  // ---------- UI state ----------

  async readUi(): Promise<UiState> {
    let type: PermType | null = null;
    for (const t of TYPES) {
      if (await this.page.getByText(TYPE_DESCRIPTIONS[t], { exact: true }).isVisible()) {
        type = t;
        break;
      }
    }
    // TODO testid: TabsContent value="configuration" has none — role + accessible name
    const panel = this.page.getByRole('tabpanel', { name: 'Data Configuration' });
    const controls = await panel.locator('[data-testid]').evaluateAll((els) => {
      const out: Record<string, string | boolean> = {};
      for (const el of els as HTMLElement[]) {
        if (!el.getClientRects().length) continue;
        const id = el.getAttribute('data-testid') ?? '';
        if (id.startsWith('chart-type-switch-')) continue;
        const role = el.getAttribute('role');
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          out[id] =
            el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value;
        } else if (role === 'switch' || role === 'checkbox' || role === 'radio') {
          out[id] = el.getAttribute('aria-checked') === 'true';
        } else if (role === 'combobox') {
          out[id] = (el.textContent ?? '').trim();
        } else if (/^metric-trigger-\d+$/.test(id)) {
          out[id] = (el.innerText ?? '').replace(/\s+/g, ' ').trim();
        } else if (/^metric-tab-(simple|calculated|saved)-\d+$/.test(id)) {
          if (el.getAttribute('data-state') === 'active') out[id] = 'active';
        } else if (/^metric-library-icon-\d+$/.test(id)) {
          out[id] = 'shown';
        } else if (
          el instanceof HTMLButtonElement &&
          /(^add-|^remove-|-add-btn$|-remove-\d+$|^chart-add-filter-btn$)/.test(id)
        ) {
          out[id] = el.disabled ? 'disabled' : 'enabled';
        }
      }
      return out;
    });
    const sorted: Record<string, string | boolean> = {};
    for (const k of Object.keys(controls).sort()) sorted[k] = controls[k];
    return {
      type,
      title: await this.b.nameInput.inputValue(),
      saveEnabled: await this.b.saveButton.isEnabled(),
      controls: sorted,
    };
  }

  private expectUi(name: string, ui: UiState, request: 'sent' | 'none') {
    journal(`${this.key}-${name}`, 'ui', normalize({ ...ui, request } as unknown as Json));
  }

  // ---------- steps ----------

  /**
   * One pinned step: jump past SWR dedupe → act → settle → snapshot UI (+ the data request the
   * step sent on the endpoint of `typeAfter`).
   */
  async step(name: string, typeAfter: PermType, action: () => Promise<void>): Promise<StepResult> {
    await this.settle();
    await this.page.clock.fastForward(SWR_DEDUPE_JUMP_MS);
    const mark = this.counts();
    await action();
    await this.settle();
    const sent = this.sinceMark(typeAfter, mark);
    const request = sent.length ? this.redact(toCaptured(sent[sent.length - 1])) : null;
    const ui = await this.readUi();
    this.expectUi(name, ui, request ? 'sent' : 'none');
    if (request) journal(`${this.key}-${name}`, 'request', stablePayload(request));
    return { request, current: this.current(typeAfter), ui };
  }

  /** Snapshot the state on screen without acting (e.g. right after open / full config). */
  async snap(name: string, type: PermType): Promise<StepResult> {
    await this.settleFully();
    const ui = await this.readUi();
    const current = this.current(type);
    this.expectUi(name, ui, current ? 'sent' : 'none');
    if (current) journal(`${this.key}-${name}`, 'request', stablePayload(current));
    return { request: current, current, ui };
  }

  switchTo(type: PermType) {
    return () => this.page.getByTestId(`chart-type-switch-${type}`).click();
  }

  // ---------- save ----------

  /**
   * Save with a stable title: create → POST /api/charts/, edit → Save → "Update existing" → PUT.
   * Save disabled → nothing sent (recorded). Snapshots `<name>-ui.json` (Save state + response
   * status) and the request body (PAY).
   */
  async save(track: TrackFn, title: string, name = 'save'): Promise<SaveResult> {
    await this.b.setTitle(title);
    await this.settle();
    const enabled = await this.b.saveButton.isEnabled();
    let result: SaveResult = { request: null, status: null, id: null };
    if (enabled)
      result = this.mode === 'create' ? await this.saveCreate(track) : await this.saveEdit();
    journal(
      `${this.key}-${name}`,
      'ui',
      normalize({ saveEnabled: enabled, status: result.status } as unknown as Json)
    );
    if (result.request) journal(`${this.key}-${name}`, 'request', stablePayload(result.request));
    return result;
  }

  private async saveCreate(track: TrackFn): Promise<SaveResult> {
    const isCreate = (r: Request) =>
      r.method() === 'POST' && new URL(r.url()).pathname === CHART_CREATE_PATH;
    const reqP = this.page.waitForRequest(isCreate, { timeout: REQUEST_TIMEOUT_MS });
    const resP = this.page.waitForResponse((r) => isCreate(r.request()), {
      timeout: REQUEST_TIMEOUT_MS,
    });
    await this.b.saveButton.click();
    const [req, res] = await Promise.all([reqP, resP]);
    let id: number | null = null;
    if (res.ok()) {
      const body = (await res.json()) as { id?: number; data?: { id: number } };
      id = body.id ?? body.data?.id ?? null;
      if (id) track('charts', id);
      await expect(this.page).toHaveURL(new RegExp(`/charts/${id}(\\?|$)`), {
        timeout: REQUEST_TIMEOUT_MS,
      });
    }
    return { request: toCaptured(req), status: res.status(), id };
  }

  private async saveEdit(): Promise<SaveResult> {
    const path = `${API.charts}${this.chartId}/`;
    const isPut = (r: Request) => r.method() === 'PUT' && new URL(r.url()).pathname === path;
    await this.b.saveButton.click();
    const reqP = this.page.waitForRequest(isPut, { timeout: REQUEST_TIMEOUT_MS });
    const resP = this.page.waitForResponse((r) => isPut(r.request()), {
      timeout: REQUEST_TIMEOUT_MS,
    });
    await this.page.getByTestId('chart-save-update-existing-btn').click();
    const [req, res] = await Promise.all([reqP, resP]);
    if (res.ok()) {
      await expect(this.page).toHaveURL(new RegExp(`/charts/${this.chartId}$`), {
        timeout: REQUEST_TIMEOUT_MS,
      });
    }
    return { request: this.redact(toCaptured(req)), status: res.status(), id: this.chartId };
  }

  // ---------- controls (shared by create and edit) ----------

  async alias(index: number, value: string) {
    await this.b.expandMetric(index);
    await this.page.getByTestId(`metric-alias-${index}`).fill(value);
  }
  async addMetric() {
    await this.page.getByTestId('add-metric-button').click();
  }
  async removeAllMetrics() {
    const first = this.page.getByTestId('remove-metric-0');
    while (await first.isVisible()) {
      const before = await this.page.locator('[data-testid^="metric-trigger-"]').count();
      await first.click();
      await expect(this.page.locator('[data-testid^="metric-trigger-"]')).toHaveCount(before - 1);
    }
  }
  async setDataset(fullName: string, table: string) {
    await this.b.pickCombo('chart-dataset-select', fullName, table);
  }
  async setTableDim(index: number, column: string) {
    await this.b.pickCombo(`chart-table-dimension-${index}`, column, column);
  }
  async addTableDim(column: string) {
    const count = await this.page.locator('[data-testid^="chart-table-dimension-remove-"]').count();
    await this.page.getByTestId('chart-table-dimension-add-btn').click();
    await expect(this.page.getByTestId(`chart-table-dimension-${count}-input`)).toBeVisible();
    await this.setTableDim(count, column);
  }
  async setPivotRow(index: number, column: string) {
    await this.b.pickCombo(`pivot-row-dimension-${index}`, column, column);
  }
  async setPivotCol(index: number, column: string) {
    await this.b.pickCombo(`pivot-col-dimension-${index}`, column, column);
  }
  async setMapDistrict(column: string) {
    await this.b.pickCombo('chart-map-district-column-select', column);
  }
  async setMapState(column: string) {
    await this.b.pickCombo('chart-map-state-column-select', column);
  }

  /** Calculated metric on row `index` (tab → expression → validated). */
  async fillExpr(index: number, expr: string) {
    await this.b.expandMetric(index);
    const validate = this.page.waitForResponse(
      (r) => r.url().includes('/api/metrics/validate/') && r.request().method() === 'POST',
      { timeout: REQUEST_TIMEOUT_MS }
    );
    await this.page.getByTestId(`metric-expr-${index}`).fill(expr);
    await this.page.clock.fastForward(DEBOUNCE_FLUSH_MS);
    const v = (await (await validate).json()) as { valid: boolean; error?: string };
    expect(v.valid, `validate "${expr}": ${v.error ?? ''}`).toBe(true);
  }
  async metricTab(index: number, tab: 'simple' | 'calculated' | 'saved') {
    await this.b.expandMetric(index);
    await this.page.getByTestId(`metric-tab-${tab}-${index}`).click();
  }
  /** Make sure metric row `index` exists (adds COUNT rows with + ADD ANOTHER METRIC). */
  async ensureRow(index: number) {
    while (!(await this.b.metricTrigger(index).isVisible())) await this.addMetric();
  }
  async pickSaved(index: number, id: number) {
    await this.b.expandMetric(index);
    await this.b.pickCombo(`metric-saved-${index}`, String(id));
  }
}

// ---------------------------------------------------------------------------
// Configs
// ---------------------------------------------------------------------------

export const CALC_EXPR = 'SUM(students) - SUM(females)';
/** Seed library metric: total_students = SUM(students) (READ-ONLY, only picked) */
export const SAVED_METRIC_ID = 620;

/**
 * "Fully configured" chart of each type, built through the UI (create and edit alike): non-default
 * dimension(s), custom alias on metric 0, a second metric where allowed, extra dimension, sort,
 * pagination and a few styling options. No filters (staging column-values 500s).
 */
export const FULL_CONFIG: Record<PermType, (p: PermBuilder) => Promise<void>> = {
  async bar(p) {
    const { b } = p;
    await b.setXAxis('statename');
    await b.setSimpleMetric(0, 'sum', 'students');
    await p.alias(0, 'Students');
    await p.addMetric();
    await b.setSimpleMetric(1, 'avg', 'male_score');
    await b.setExtraDimension('climate_event');
    await b.setSortColumn('statename');
    await b.setPagination('50');
    await b.stylingTab();
    await p.page.getByTestId('chart-styling-orientation-horizontal').click();
    await p.page.getByTestId('chart-styling-show-data-labels').click();
    await b.pickSelect('chart-styling-data-label-position', 'inside');
    await p.page.getByTestId('chart-styling-show-tooltip').click();
    await b.dataTab();
  },
  async line(p) {
    const { b } = p;
    await b.setXAxis('date');
    await b.setTimeGrain('month');
    await b.setSimpleMetric(0, 'sum', 'students');
    await p.alias(0, 'Students');
    await p.addMetric();
    await b.setSimpleMetric(1, 'avg', 'male_score');
    await b.setExtraDimension('climate_event');
    await b.setSortColumn('date');
    await b.setPagination('50');
    await b.stylingTab();
    await p.page.getByTestId('chart-styling-line-style-straight').click();
    await p.page.getByTestId('chart-styling-show-data-labels').click();
    await b.pickSelect('chart-styling-data-label-position', 'bottom');
    await p.page.getByTestId('chart-styling-show-tooltip').click();
    await b.dataTab();
  },
  async pie(p) {
    const { b } = p;
    await b.setXAxis('statename');
    await b.setSimpleMetric(0, 'sum', 'students');
    await p.alias(0, 'Students');
    await b.setExtraDimension('climate_event');
    await p.settle();
    await b.setSortColumn('Students');
    await b.setSortDirection('desc');
    await b.setPagination('20');
    await b.stylingTab();
    await p.page.getByTestId('chart-styling-chart-style-pie').click();
    await b.pickSelect('chart-styling-data-label-position', 'inside');
    await p.page.getByTestId('chart-styling-show-tooltip').click();
    await b.dataTab();
  },
  async number(p) {
    const { b } = p;
    await b.setSimpleMetric(0, 'sum', 'students');
    await b.stylingTab();
    await p.page.getByTestId('chart-styling-number-size-large').click();
    await p.page.getByTestId('chart-styling-subtitle').fill('students reached');
    await p.settle();
    await b.dataTab();
  },
  async table(p) {
    const { b } = p;
    await p.setTableDim(0, 'statename');
    await p.addTableDim('districtname');
    await b.setSimpleMetric(0, 'sum', 'students');
    await p.alias(0, 'Students');
    await p.addMetric();
    await b.setSimpleMetric(1, 'avg', 'male_score');
    await b.setSortColumn('statename');
    await b.setPagination('50');
    await b.stylingTab();
    await p.page.getByTestId('zebra-rows-switch').click();
    await p.page.getByTestId('freeze-column-switch').click();
    await b.dataTab();
  },
  async map(p) {
    const { b } = p;
    await b.setSimpleMetric(0, 'sum', 'students');
    await p.alias(0, 'Students');
    await p.settle();
    await p.setMapDistrict('districtname');
    await b.stylingTab();
    await b.pickSelect('chart-styling-color-scheme', 'Greens');
    await p.page.getByTestId('chart-styling-show-tooltip').click();
    await b.dataTab();
  },
  async pivot_table(p) {
    const { b } = p;
    await p.setPivotRow(0, 'statename');
    await p.setPivotCol(0, 'climate_event');
    await b.setSimpleMetric(0, 'sum', 'students');
    await p.alias(0, 'Students');
    await p.addMetric();
    await b.setSimpleMetric(1, 'avg', 'male_score');
    await p.page.getByTestId('pivot-show-row-grand-total').click();
    await b.stylingTab();
    await p.page.getByTestId('theme-option-blue').click();
    await b.dataTab();
  },
};

/** Types that allow more than one metric row. */
export const MULTI_METRIC: PermType[] = ['bar', 'line', 'table', 'pivot_table'];

// ---------------------------------------------------------------------------
// Edit-builder sources (API). Bodies equal what the create builder saves for the same config —
// the round-trip "control" tests pin that equality.
// ---------------------------------------------------------------------------

type ExtraConfig = Record<string, unknown>;

const TABLE_PREFILL_COLUMNS = [
  'id',
  'country',
  'statename',
  'districtname',
  'districtcode',
  'date',
];

const CREATE_DEFAULTS: Record<PermType, ExtraConfig> = {
  bar: {
    dataLabelPosition: 'top',
    orientation: 'vertical',
    showDataLabels: false,
    showLegend: true,
    showTooltip: true,
    stacked: false,
    xAxisLabelRotation: '45',
    xAxisTitle: '',
    yAxisLabelRotation: 'horizontal',
    yAxisTitle: '',
  },
  line: {
    dataLabelPosition: 'top',
    lineStyle: 'smooth',
    showDataLabels: false,
    showDataPoints: true,
    showLegend: true,
    showTooltip: true,
    xAxisLabelRotation: 'horizontal',
    xAxisTitle: '',
    yAxisLabelRotation: 'horizontal',
    yAxisTitle: '',
  },
  pie: {
    chartStyle: 'donut',
    dataLabelPosition: 'outside',
    labelFormat: 'percentage',
    legendPosition: 'right',
    showDataLabels: true,
    showLegend: true,
    showTooltip: true,
  },
  number: {
    decimalPlaces: 0,
    numberFormat: 'default',
    numberPrefix: '',
    numberSize: 'medium',
    numberSuffix: '',
    subtitle: '',
  },
  table: {},
  map: {
    colorScheme: 'Blues',
    nullValueLabel: 'No Data',
    showLegend: true,
    showTooltip: true,
    title: '',
  },
  pivot_table: { decimalPlaces: 0, numberFormat: 'default' },
};

const COUNT_METRIC: { aggregation: string; alias: string; column: string | null } = {
  aggregation: 'count',
  alias: 'Total Count',
  column: null,
};

/** extra_config the create builder saves right after opening (auto-prefill, no user edits). */
export const PREFILL_SOURCE: Record<PermType, ExtraConfig> = {
  bar: {
    aggregate_function: 'count',
    customizations: CREATE_DEFAULTS.bar,
    dimension_column: 'id',
    metrics: [COUNT_METRIC],
  },
  line: {
    aggregate_function: 'count',
    customizations: CREATE_DEFAULTS.line,
    dimension_column: 'id',
    metrics: [COUNT_METRIC],
  },
  pie: {
    aggregate_function: 'count',
    customizations: CREATE_DEFAULTS.pie,
    dimension_column: 'id',
    metrics: [COUNT_METRIC],
  },
  number: {
    aggregate_function: 'count',
    customizations: CREATE_DEFAULTS.number,
    metrics: [COUNT_METRIC],
  },
  table: {
    aggregate_function: 'count',
    customizations: CREATE_DEFAULTS.table,
    dimension_column: 'id',
    dimension_columns: ['id'],
    dimensions: [{ column: 'id', enable_drill_down: false }],
    metrics: [COUNT_METRIC],
    table_columns: TABLE_PREFILL_COLUMNS,
  },
  map: {
    aggregate_function: 'count',
    customizations: CREATE_DEFAULTS.map,
    geographic_column: 'statename',
    metrics: [COUNT_METRIC],
    selected_geojson_id: 35,
  },
  pivot_table: {
    aggregate_function: 'count',
    column_dimensions: ['date'],
    column_grand_total_label: 'Grand Total',
    column_subtotal_label: 'Subtotal',
    customizations: CREATE_DEFAULTS.pivot_table,
    metrics: [COUNT_METRIC],
    row_dimensions: ['id'],
    row_grand_total_label: 'Grand Total',
    row_subtotal_label: 'Subtotal',
    show_column_grand_total: false,
    show_column_subtotals: false,
    show_row_grand_total: false,
    show_row_subtotals: false,
  },
};

const SUM_STUDENTS = { aggregation: 'sum', alias: 'Students', column: 'students' };
const AVG_MALE = { aggregation: 'avg', alias: 'AVG(male_score)', column: 'male_score' };

/** extra_config the create builder saves after FULL_CONFIG. */
export const FULL_SOURCE: Record<PermType, ExtraConfig> = {
  bar: {
    aggregate_function: 'count',
    customizations: {
      ...CREATE_DEFAULTS.bar,
      dataLabelPosition: 'inside',
      orientation: 'horizontal',
      showDataLabels: true,
      showTooltip: false,
    },
    dimension_column: 'statename',
    extra_dimension_column: 'climate_event',
    metrics: [SUM_STUDENTS, AVG_MALE],
    pagination: { enabled: true, page_size: 50 },
    sort: [{ column: 'statename', direction: 'asc' }],
  },
  line: {
    aggregate_function: 'count',
    customizations: {
      ...CREATE_DEFAULTS.line,
      dataLabelPosition: 'bottom',
      lineStyle: 'straight',
      showDataLabels: true,
      showTooltip: false,
    },
    dimension_column: 'date',
    extra_dimension_column: 'climate_event',
    metrics: [SUM_STUDENTS, AVG_MALE],
    pagination: { enabled: true, page_size: 50 },
    sort: [{ column: 'date', direction: 'asc' }],
    time_grain: 'month',
  },
  pie: {
    aggregate_function: 'count',
    customizations: {
      ...CREATE_DEFAULTS.pie,
      chartStyle: 'pie',
      dataLabelPosition: 'inside',
      showTooltip: false,
    },
    dimension_column: 'statename',
    extra_dimension_column: 'climate_event',
    metrics: [SUM_STUDENTS],
    pagination: { enabled: true, page_size: 20 },
    sort: [{ column: 'Students', direction: 'desc' }],
  },
  number: {
    aggregate_column: 'students',
    aggregate_function: 'sum',
    customizations: {
      ...CREATE_DEFAULTS.number,
      numberSize: 'large',
      subtitle: 'students reached',
    },
    metrics: [{ aggregation: 'sum', alias: 'SUM(students)', column: 'students' }],
  },
  table: {
    aggregate_function: 'count',
    customizations: { freezeFirstColumn: true, zebraRows: false },
    dimension_column: 'statename',
    dimension_columns: ['statename', 'districtname'],
    dimensions: [
      { column: 'statename', enable_drill_down: false },
      { column: 'districtname', enable_drill_down: false },
    ],
    metrics: [SUM_STUDENTS, AVG_MALE],
    pagination: { enabled: true, page_size: 50 },
    sort: [{ column: 'statename', direction: 'asc' }],
    table_columns: TABLE_PREFILL_COLUMNS,
  },
  map: {
    aggregate_column: 'students',
    aggregate_function: 'sum',
    customizations: { ...CREATE_DEFAULTS.map, colorScheme: 'Greens', showTooltip: false },
    geographic_column: 'statename',
    geographic_hierarchy: {
      base_level: { column: 'statename', label: 'Country', level: 0, region_type: 'country' },
      country_code: 'IND',
      drill_down_levels: [
        { column: 'districtname', label: 'State', level: 1, region_type: 'state' },
      ],
    },
    metrics: [SUM_STUDENTS],
    selected_geojson_id: 35,
    value_column: 'students',
  },
  pivot_table: {
    ...PREFILL_SOURCE.pivot_table,
    column_dimensions: ['climate_event'],
    customizations: { ...CREATE_DEFAULTS.pivot_table, theme: 'blue' },
    metrics: [SUM_STUDENTS, AVG_MALE],
    row_dimensions: ['statename'],
    show_row_grand_total: true,
  },
};

/** API-create the edit builder's source chart (education mart) and register it for cleanup. */
export async function createSource(
  api: ApiClient,
  track: TrackFn,
  type: PermType,
  name: string,
  extraConfig: ExtraConfig
): Promise<{ id: number; title: string; type: PermType }> {
  const title = e2eTitle(name);
  const chart = await api.post<{ id: number }>(API.charts, {
    title,
    chart_type: type,
    computation_type: 'aggregated',
    schema_name: EDU.schema,
    table_name: EDU.table,
    extra_config: extraConfig,
  });
  track('charts', chart.id);
  return { id: chart.id, title, type };
}

/**
 * Open the builder on a chart of `type`: create → fresh builder (+ stable title, optional UI
 * config); edit → API source with `source` config.
 */
export async function openSource(
  p: PermBuilder,
  ctx: { api: ApiClient; track: TrackFn },
  type: PermType,
  title: string,
  source: 'prefill' | 'full'
) {
  if (p.mode === 'create') {
    await p.open({ type });
    await p.b.setTitle(e2eTitle(title));
    if (source === 'full') await FULL_CONFIG[type](p);
    return;
  }
  const cfg = source === 'full' ? FULL_SOURCE[type] : PREFILL_SOURCE[type];
  const chart = await createSource(ctx.api, ctx.track, type, title, cfg);
  await p.open(chart);
}

// ---------------------------------------------------------------------------
// Diffs (round trip / dataset change: what's kept vs lost)
// ---------------------------------------------------------------------------

type Flat = Record<string, string>;

function flatten(v: unknown, prefix = '', out: Flat = {}): Flat {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    const entries = Object.entries(v as Record<string, unknown>);
    if (!entries.length && prefix) out[prefix] = '{}';
    for (const [k, val] of entries) flatten(val, prefix ? `${prefix}.${k}` : k, out);
  } else if (Array.isArray(v)) {
    if (!v.length) out[prefix] = '[]';
    v.forEach((val, i) => flatten(val, `${prefix}[${i}]`, out));
  } else {
    out[prefix] = JSON.stringify(v ?? null);
  }
  return out;
}

/** Keys whose value differs between `before` and `after`: `{ key: "before → after" }` (absent = ∅). */
export function diff(before: unknown, after: unknown): Record<string, string> {
  const a = flatten(before);
  const b = flatten(after);
  const out: Record<string, string> = {};
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    if (a[k] !== b[k]) out[k] = `${a[k] ?? '∅'} → ${b[k] ?? '∅'}`;
  }
  return out;
}

/** Snapshot a derived diff (documents kept/lost fields; gated with the payload baselines). */
export function expectDiffSnapshot(key: string, name: string, value: Record<string, unknown>) {
  journal(`${key}-${name}`, 'diff', normalize(value as Json));
}

/** extra_config of a captured POST/PUT chart body. */
export function savedExtraConfig(req: CapturedRequest | null): Json | null {
  if (!req || !req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return null;
  return (req.body as Record<string, Json>).extra_config ?? null;
}

/** Snapshot-name slug for a list of types: bar-pie-bar */
export function slug(types: PermType[]): string {
  return types.map((t) => SHORT[t]).join('-');
}

/** Title fragment for a list of types: bar → pie → bar */
export function arrow(types: PermType[]): string {
  return types.map((t) => SHORT[t]).join(' → ');
}
