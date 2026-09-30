import { type Locator, type Page, expect } from '@playwright/test';
import { SEED } from '../support/env';
import { type CapturedRequest, captureRequest, expectPayloadSnapshot } from '../support/payload';
import { expectChartScreenshot, waitForChartData, waitForEChart } from '../support/render';

/**
 * Page object for the chart CREATE builder (`/charts/new/configure`).
 * Used by builder-shared / builder-<bar|line|pie|number> / type-switch specs.
 *
 * Comboboxes derive their testids from a stable `id`: `${id}-input`, `${id}-listbox`, `${id}-item-${value}`.
 * Radix selects: trigger testid + `${trigger}-option-${value}`.
 */

export type BuilderChartType = 'bar' | 'line' | 'pie' | 'number' | 'map' | 'table' | 'pivot_table';

type TrackFn = (resource: 'charts', id: number) => void;

export const EDU = SEED.datasets.education;
export const EDU_FULL_NAME = `${EDU.schema}.${EDU.table}`;

export const CHART_DATA_URL = '/api/charts/chart-data/';
// POST /api/charts/ exactly (not /api/charts/chart-data/ etc.)
const CHART_CREATE_URL = /\/api\/charts\/(\?.*)?$/;
const COLUMN_VALUES_URL = '**/api/warehouse/column-values/**';

/**
 * staging's GET /api/warehouse/column-values/ currently 500s, so the filter value input falls back to
 * a text box. Tests of the combobox / multi-select variants stub the endpoint with these values.
 */
export const STUB_STATE_VALUES = [
  'Assam',
  'Karnataka',
  'Maharashtra',
  'Odisha',
  'Rajasthan',
  'Uttar Pradesh',
];

export class ChartBuilderPage {
  constructor(readonly page: Page) {}

  // ---------- locators ----------
  get saveButton() {
    return this.page.getByTestId('chart-edit-save-button');
  }
  get nameInput() {
    return this.page.getByTestId('chart-name-input');
  }
  get backButton() {
    return this.page.getByTestId('chart-create-back-button');
  }
  /** Right-hand CHART tab panel — the preview container used for screenshots. */
  get previewPanel(): Locator {
    // TODO testid: TabsContent value="chart" (app/charts/new/configure/page.tsx:1345) has none
    return this.page.getByRole('tabpanel', { name: 'CHART', exact: true });
  }
  /** Right-hand DATA tab panel. */
  get dataPanel(): Locator {
    // TODO testid: TabsContent value="data" (app/charts/new/configure/page.tsx:1467) has none
    return this.page.getByRole('tabpanel', { name: 'DATA', exact: true });
  }
  comboInput(id: string) {
    return this.page.getByTestId(`${id}-input`);
  }
  comboItem(id: string, value: string) {
    return this.page.getByTestId(`${id}-item-${value}`);
  }
  metricTrigger(index: number) {
    return this.page.getByTestId(`metric-trigger-${index}`);
  }

  // ---------- navigation ----------
  configureUrl(type: BuilderChartType, dataset: { schema: string; table: string } = EDU) {
    return `/charts/new/configure?schema=${dataset.schema}&table=${dataset.table}&type=${type}`;
  }

  /**
   * Open the builder for the education mart + `type` and wait until the auto-prefilled config
   * has produced its first chart-data response and the preview has drawn.
   */
  async openCreate(type: BuilderChartType) {
    const usesChartData = type !== 'map' && type !== 'table';
    const firstData = usesChartData ? this.waitForChartDataResponse() : null;
    await this.page.goto(this.configureUrl(type));
    await expect(this.saveButton).toBeVisible();
    if (firstData) await firstData;
    await this.settle();
    if (usesChartData && type !== 'pivot_table') await waitForEChart(this.previewPanel);
  }

  /** Step-1 page: pick dataset + type card → Continue → builder (does not wait for the preview). */
  async openCreateViaPicker(type: BuilderChartType) {
    await this.page.goto('/charts/new');
    const input = this.page.getByTestId('chart-new-dataset-select-input');
    await expect(input).toBeEnabled({ timeout: 30_000 });
    await input.click();
    await input.fill(EDU.table);
    await this.page.getByTestId(`chart-new-dataset-select-item-${EDU_FULL_NAME}`).click();
    await this.page.getByTestId(`chart-type-card-${type}`).click();
    await this.page.getByTestId('chart-type-continue-button').click();
    await expect(this.page).toHaveURL(/\/charts\/new\/configure\?/);
    await expect(this.saveButton).toBeVisible();
  }

  waitForChartDataResponse() {
    return this.page.waitForResponse(
      (r) => r.url().includes(CHART_DATA_URL) && r.request().method() === 'POST',
      { timeout: 30_000 }
    );
  }

  /** Let in-flight chart-data / preview requests finish (call before starting a capture). */
  async settle() {
    await waitForChartData(this.page);
  }

  // ---------- tabs ----------
  async dataTab() {
    await this.page.getByTestId('chart-data-config-tab').click();
  }
  async stylingTab() {
    await this.page.getByTestId('chart-styling-tab').click();
  }
  async previewChartTab() {
    await this.page.getByTestId('chart-preview-tab-chart').click();
  }
  async previewDataTab() {
    await this.page.getByTestId('chart-preview-tab-data').click();
  }

  // ---------- generic controls ----------
  /** Pick an option of a stable-id Combobox; `search` types into it first to filter a long list. */
  async pickCombo(id: string, value: string, search?: string) {
    const input = this.comboInput(id);
    await input.click();
    if (search !== undefined) await input.fill(search);
    await this.comboItem(id, value).click();
    await expect(this.page.getByTestId(`${id}-listbox`)).toBeHidden();
  }

  /** Radix Select: click trigger, click `${trigger}-option-${value}` (or an explicit option testid). */
  async pickSelect(triggerTestId: string, value: string, optionTestId?: string) {
    await this.page.getByTestId(triggerTestId).click();
    await this.page.getByTestId(optionTestId ?? `${triggerTestId}-option-${value}`).click();
    await expect(this.page.getByRole('listbox')).toBeHidden();
  }

  /**
   * Fill a debounced (500ms) input and wait for the chart-data response it triggers — networkidle alone
   * can resolve before the debounce fires, letting the late request leak into the next capture.
   */
  async fillAndWait(testId: string, value: string) {
    await this.settle();
    // Wait for the request that actually carries the new value (not an earlier in-flight one)
    // JSON string value, e.g. `:"Assam"` (bodies are unspaced JSON.stringify output)
    const needle = `:${JSON.stringify(value)}`;
    const res = this.page.waitForResponse(
      (r) =>
        r.url().includes(CHART_DATA_URL) &&
        r.request().method() === 'POST' &&
        (r.request().postData() ?? '').includes(needle),
      { timeout: 30_000 }
    );
    await this.page.getByTestId(testId).fill(value);
    await res;
    await this.settle();
  }

  // ---------- data config ----------
  async setXAxis(column: string) {
    await this.pickCombo('chart-x-axis-select', column, column);
  }
  async setExtraDimension(column: string) {
    await this.pickCombo(
      'chart-extra-dimension-select',
      column,
      column === 'none' ? 'None' : column
    );
  }
  async setTimeGrain(value: string) {
    await this.pickSelect('chart-time-grain-select', value, `chart-time-grain-option-${value}`);
  }
  async setPagination(value: '__none__' | '20' | '50' | '100' | '200') {
    await this.pickSelect('chart-pagination-select', value, `chart-pagination-option-${value}`);
  }
  async setSortColumn(value: string) {
    await this.pickCombo('chart-sort-column-select', value);
  }
  async setSortDirection(dir: 'asc' | 'desc') {
    await this.pickSelect('chart-sort-direction-select', dir, `chart-sort-direction-option-${dir}`);
  }

  async addFilter() {
    await this.page.getByTestId('chart-add-filter-btn').click();
  }
  async setFilterColumn(index: number, column: string) {
    await this.pickCombo(`chart-filter-column-${index}`, column, column);
  }
  async setFilterOperator(index: number, operator: string) {
    await this.pickSelect(`chart-filter-operator-${index}`, operator);
  }
  filterTextValue(index: number) {
    return this.page.getByTestId(`chart-filter-value-${index}-text`);
  }

  /** Serve fixed values for GET column-values (staging endpoint 500s). */
  async stubColumnValues(values: string[] = STUB_STATE_VALUES) {
    await this.page.route(COLUMN_VALUES_URL, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(values) })
    );
  }

  // ---------- metrics ----------
  async expandMetric(index: number) {
    const trigger = this.metricTrigger(index);
    if ((await trigger.getAttribute('data-state')) !== 'open') await trigger.click();
    await expect(trigger).toHaveAttribute('data-state', 'open');
  }
  async setMetricAgg(index: number, agg: string) {
    await this.expandMetric(index);
    await this.pickSelect(`metric-agg-${index}`, agg);
  }
  async setMetricColumn(index: number, column: string) {
    await this.expandMetric(index);
    await this.pickCombo(`metric-column-${index}`, column, column === '*' ? undefined : column);
  }
  /** Simple metric AGG(column) in one go. */
  async setSimpleMetric(index: number, agg: string, column: string) {
    await this.setMetricAgg(index, agg);
    await this.setMetricColumn(index, column);
  }

  // ---------- composite setups ----------
  /**
   * Readable, deterministic bar/line/pie baseline for styling screenshots:
   * X = statename (6 states), SUM(students), sorted by statename asc (GROUP BY order is otherwise unspecified).
   */
  async statenameBaseline() {
    await this.setXAxis('statename');
    await this.setSimpleMetric(0, 'sum', 'students');
    await this.setSortColumn('statename');
    await this.settle();
    await waitForEChart(this.previewPanel);
  }

  // ---------- capture / assert helpers ----------
  /** Settle, start listening for the next chart-data POST, run `action`, return the captured request. */
  async captureChartData(action: () => Promise<void>): Promise<CapturedRequest> {
    await this.settle();
    const req = captureRequest(this.page, { method: 'POST', url: CHART_DATA_URL, timeout: 20_000 });
    await action();
    const captured = await req;
    await this.settle();
    return captured;
  }

  /** Capture the next chart-data request triggered by `action` and snapshot it. */
  async expectChartDataPayload(name: string, action: () => Promise<void>) {
    const captured = await this.captureChartData(action);
    expectPayloadSnapshot(captured, name);
    return captured;
  }

  /** Screenshot the preview panel (ECharts canvas settled; floating onboarding pill hidden). */
  async expectPreviewShot(name: string) {
    await this.settle();
    // ChartPreview's loading state (a slow chart-data response can outlive networkidle under load)
    await expect(this.previewPanel.getByText('Loading chart...')).toHaveCount(0, {
      timeout: 30_000,
    });
    await waitForEChart(this.previewPanel);
    const pill = this.page.getByTestId('getting-started-widget-pill');
    if (await pill.count()) {
      // Fixed-position onboarding pill overlaps the preview's bottom-right corner
      await pill.evaluate((el) => ((el as HTMLElement).style.visibility = 'hidden'));
    }
    await expectChartScreenshot(this.previewPanel, name);
  }

  async setTitle(title: string) {
    await this.nameInput.fill(title);
  }

  /**
   * Click Save Chart, capture the POST /api/charts/ body and the created id.
   * Registers the id with `track` before returning, so cleanup happens even if the test fails later.
   */
  async save(track: TrackFn): Promise<{ id: number; request: CapturedRequest }> {
    const reqP = captureRequest(this.page, { method: 'POST', url: CHART_CREATE_URL });
    const resP = this.page.waitForResponse(
      (r) => CHART_CREATE_URL.test(r.url()) && r.request().method() === 'POST',
      { timeout: 30_000 }
    );
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    const [request, response] = await Promise.all([reqP, resP]);
    expect(response.ok(), `create chart → ${response.status()}`).toBeTruthy();
    const body = (await response.json()) as { id?: number; data?: { id: number } };
    const id = body.id ?? body.data?.id;
    expect(id, 'created chart id').toBeTruthy();
    track('charts', id as number);
    await expect(this.page).toHaveURL(new RegExp(`/charts/${id}(\\?|$)`), { timeout: 30_000 });
    return { id: id as number, request };
  }

  /** Title the chart with `title`, save, snapshot the create payload. */
  async saveAndSnapshot(track: TrackFn, title: string, snapshotName: string) {
    await this.setTitle(title);
    const saved = await this.save(track);
    expectPayloadSnapshot(saved.request, snapshotName);
    return saved;
  }
}

// ---------- styling cases (builder-<type>.spec.ts) ----------

export interface StylingCase {
  /** Test title after the type prefix, e.g. 'orientation horizontal'. Prefix with '[pinned] ' for odd behavior. */
  title: string;
  /** Snapshot base name (unique within the spec file). */
  id: string;
  /** Extra data-config steps on top of the type baseline (Data Configuration tab). */
  setup?: (b: ChartBuilderPage) => Promise<void>;
  /** Styling-tab steps before the one under test (not captured). */
  prepare?: (b: ChartBuilderPage) => Promise<void>;
  /** The styling change under test. */
  apply: (b: ChartBuilderPage) => Promise<void>;
  /**
   * Whether `apply` sends a new chart-data request. False for frontend-only formatting keys
   * that getApiCustomizations strips (number/decimal/date formats) — those are pinned via the save payload.
   */
  chartData?: boolean;
  /** Screenshot the preview (false for non-visual options such as the hover tooltip). */
  shot?: boolean;
}

/**
 * One styling option = one test: baseline → setup → styling tab → prepare → apply
 * (PAY chart-data) → SHOT preview → save (PAY create payload).
 */
export async function runStylingCase(
  b: ChartBuilderPage,
  track: TrackFn,
  type: BuilderChartType,
  baseline: (b: ChartBuilderPage) => Promise<void>,
  c: StylingCase,
  title: string
) {
  const { chartData = true, shot = true } = c;
  await b.openCreate(type);
  await baseline(b);
  if (c.setup) await c.setup(b);
  await b.stylingTab();
  if (c.prepare) await c.prepare(b);
  if (chartData) {
    await b.expectChartDataPayload(`${c.id}-chart-data`, () => c.apply(b));
  } else {
    await b.settle();
    await c.apply(b);
  }
  if (shot) await b.expectPreviewShot(c.id);
  await b.saveAndSnapshot(track, title, `${c.id}-save`);
}

/** Radix Switch / Radio click by testid. */
export function clickTestId(testId: string) {
  return (b: ChartBuilderPage) => b.page.getByTestId(testId).click();
}
/** Radix Select option pick (trigger testid + `-option-${value}`). */
export function selectOption(triggerTestId: string, value: string) {
  return (b: ChartBuilderPage) => b.pickSelect(triggerTestId, value);
}
/** Debounced text input fill. */
export function fillTestId(testId: string, value: string) {
  return (b: ChartBuilderPage) => b.page.getByTestId(testId).fill(value);
}

/** The 6 non-default number formats (NumberFormatSection options). */
export const NUMBER_FORMATS = [
  'adaptive_indian',
  'adaptive_international',
  'indian',
  'international',
  'european',
  'percentage',
] as const;
