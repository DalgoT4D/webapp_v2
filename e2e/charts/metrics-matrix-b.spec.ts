import { test, expect } from '../support/fixtures';
import { expectPayloadSnapshot, type CapturedRequest } from '../support/payload';
import { expectChartScreenshot, waitForEChart } from '../support/render';
import type { Page } from '@playwright/test';
import {
  API,
  echartsRoot,
  field,
  isAggregatedPreview,
  MtpBuilder,
  parkMouse,
  RequestLog,
  tableBodyRows,
  tableHeaders,
} from './helpers-mtp';

/**
 * Metrics matrix (part B) — metric TYPES (simple / calculated / saved) × metric COUNT (1–3, remove)
 * for table, pivot and map, plus a 3-level table drill-down chain. MATRIX §7, §8.5–8.7.
 * Dataset: production.mart_education_program (6 states × 2 districts).
 * Saved metrics 619–622 are seed (READ-ONLY): only picked, never edited.
 */

const STATES = 6;
const DISTRICTS_PER_STATE = 2;

type MetricSpec =
  | { kind: 'simple'; aggregation: string; column: string; alias: string }
  | { kind: 'calculated'; expression: string; alias: string }
  | { kind: 'saved'; id: number; alias: string; expression?: string };

const SIMPLE: MetricSpec = {
  kind: 'simple',
  aggregation: 'sum',
  column: 'students',
  alias: 'SUM(students)',
};
const CALC_EXPR = 'SUM(females) * 1.0 / NULLIF(SUM(students),0)';
// A committed expression becomes the auto Display Name
const CALC: MetricSpec = { kind: 'calculated', expression: CALC_EXPR, alias: CALC_EXPR };
// Seed library metrics: 620 is a simple SUM(students), 622 / 619 are expressions
const SAVED_TOTAL: MetricSpec = { kind: 'saved', id: 620, alias: 'total_students' };
const SAVED_MALE: MetricSpec = { kind: 'saved', id: 622, alias: 'avg_score_male' };
const SAVED_COVERAGE: MetricSpec = {
  kind: 'saved',
  id: 619,
  alias: 'education_coverage_rate',
  expression: 'SUM(students) / NULLIF(SUM(population), 0)',
};

const json = (v: unknown) => JSON.stringify(v);
const aliasesOf = (c: CapturedRequest) =>
  ((field(c.body, 'metrics') as Array<{ alias?: string }> | undefined) ?? []).map((m) => m.alias);

// ---------------------------------------------------------------------------
// Metric row drivers (MetricAccordionItem)
// ---------------------------------------------------------------------------

async function expandMetric(page: Page, i: number) {
  const trigger = page.getByTestId(`metric-trigger-${i}`);
  if ((await trigger.getAttribute('data-state')) !== 'open') await trigger.click();
  await expect(trigger).toHaveAttribute('data-state', 'open');
}

/** Types an expression and waits for the server validation to accept it. */
async function setCalculated(page: Page, i: number, expression: string) {
  await expandMetric(page, i);
  await page.getByTestId(`metric-tab-calculated-${i}`).click();
  const validated = page.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/metrics/validate/'
  );
  await page.getByTestId(`metric-expr-${i}`).fill(expression);
  const body = (await (await validated).json()) as { valid: boolean };
  expect(body.valid, `expression "${expression}" should validate`).toBe(true);
  await expect(page.getByTestId(`metric-alias-${i}`)).toHaveValue(expression);
}

async function setSaved(b: MtpBuilder, i: number, id: number, alias: string) {
  await expandMetric(b.page, i);
  await b.page.getByTestId(`metric-tab-saved-${i}`).click();
  await b.pickCombobox(`metric-saved-${i}`, String(id));
  await expect(b.page.getByTestId(`metric-library-icon-${i}`)).toBeVisible();
  await expect(b.page.getByTestId(`metric-alias-${i}`)).toHaveValue(alias);
}

async function applyMetric(b: MtpBuilder, i: number, m: MetricSpec) {
  if (m.kind === 'simple') await b.setSimpleMetric(i, m.aggregation, m.column);
  if (m.kind === 'calculated') await setCalculated(b.page, i, m.expression);
  if (m.kind === 'saved') await setSaved(b, i, m.id, m.alias);
}

/** Row 0 is the prefilled COUNT(*); each further row comes from "+ ADD ANOTHER METRIC". */
async function applyMetrics(b: MtpBuilder, metrics: MetricSpec[]) {
  for (const [i, m] of metrics.entries()) {
    if (i > 0) await b.page.getByTestId('add-metric-button').click();
    await applyMetric(b, i, m);
  }
}

/** Reopened edit page: one accordion row per metric, each on its own tab with its alias. */
async function expectEditMetrics(page: Page, metrics: MetricSpec[]) {
  for (const [i, m] of metrics.entries()) {
    await expandMetric(page, i);
    await expect(page.getByTestId(`metric-tab-${m.kind}-${i}`)).toHaveAttribute(
      'data-state',
      'active'
    );
    await expect(page.getByTestId(`metric-alias-${i}`)).toHaveValue(m.alias);
    await expect(page.getByTestId(`metric-trigger-${i}`)).toContainText(m.alias);
    if (m.kind === 'saved') {
      await expect(page.getByTestId(`metric-library-icon-${i}`)).toBeVisible();
      await expect(page.getByTestId(`metric-saved-${i}-input`)).toHaveValue(m.alias);
    }
    if (m.kind === 'calculated') {
      await expect(page.getByTestId(`metric-expr-${i}`)).toHaveValue(m.expression);
    }
  }
  await expect(page.getByTestId(`metric-trigger-${metrics.length}`)).toHaveCount(0);
}

// ---------------------------------------------------------------------------
// Cases shared by table + pivot
// ---------------------------------------------------------------------------

interface MultiCase {
  n: number;
  title: string;
  build: MetricSpec[];
  /** Index removed after building (case 6) */
  removeIndex?: number;
  /** [pinned] pivot shows a 0–1 ratio rounded to 0 decimals (PivotTableChart formatCell default) */
  pivotRoundsRatio?: boolean;
}

const MULTI_CASES: MultiCase[] = [
  { n: 1, title: '1× simple SUM(students)', build: [SIMPLE] },
  { n: 2, title: '1× calculated expression', build: [CALC], pivotRoundsRatio: true },
  { n: 3, title: '1× saved library metric (620 total_students)', build: [SAVED_TOTAL] },
  { n: 4, title: '2 metrics: simple + calculated', build: [SIMPLE, CALC] },
  { n: 5, title: '3 metrics: simple + calculated + saved', build: [SIMPLE, CALC, SAVED_MALE] },
  {
    n: 6,
    title: '3 metrics → remove middle → 2 remain in order',
    build: [SIMPLE, CALC, SAVED_MALE],
    removeIndex: 1,
  },
];

const finalMetrics = (c: MultiCase) => c.build.filter((_, i) => i !== c.removeIndex);

async function removeAndCheck(page: Page, c: MultiCase) {
  if (c.removeIndex === undefined) return;
  await page.getByTestId(`remove-metric-${c.removeIndex}`).click();
  const remaining = finalMetrics(c);
  await expect(page.getByTestId(`metric-trigger-${remaining.length}`)).toHaveCount(0);
  for (const [i, m] of remaining.entries()) {
    await expect(page.getByTestId(`metric-trigger-${i}`)).toContainText(m.alias);
  }
}

// ---------------------------------------------------------------------------
// TABLE
// ---------------------------------------------------------------------------

test.describe('metrics matrix — table (statename)', () => {
  for (const c of MULTI_CASES) {
    test(`MM-table-${c.n} ${c.title}`, async ({ page, track }) => {
      const metrics = finalMetrics(c);
      const aliases = metrics.map((m) => m.alias);
      const b = new MtpBuilder(page);
      await b.openCreate('table');
      await b.pickCombobox('chart-table-dimension-0', 'statename');
      await applyMetrics(b, c.build);
      await removeAndCheck(page, c);
      // Aggregated rows come back unordered → sort by the first metric (unique per state)
      b.dataPreview.mark();
      await b.pickCombobox('chart-sort-column-select', aliases[0]);
      const preview = await b.dataPreview.next(
        (r) =>
          isAggregatedPreview(r) &&
          json(field(r.body, 'dimensions')) === json(['statename']) &&
          json(aliasesOf(r)) === json(aliases) &&
          field(r.body, 'extra_config', 'sort', 0, 'column') === aliases[0]
      );
      expect(field(preview.body, 'metrics') as unknown[]).toHaveLength(metrics.length);
      expectPayloadSnapshot(preview, `mm-table-${c.n}-preview`);
      // One column per metric after the dimension
      await expect.poll(() => tableHeaders(b.preview)).toEqual(['statename', ...aliases]);
      await expect(tableBodyRows(b.preview)).toHaveCount(STATES);
      await expectChartScreenshot(b.preview, `mm-table-${c.n}-builder`);

      await b.setTitle(`mm-table-${c.n}`);
      const { id, captured } = await b.saveCreate(track);
      expectPayloadSnapshot(captured, `mm-table-${c.n}-create-post`);
      const table = page.locator('main').getByRole('table').first();
      await expect(tableBodyRows(table)).toHaveCount(STATES);
      await expect.poll(() => tableHeaders(table)).toEqual(['statename', ...aliases]);
      await expectChartScreenshot(table, `mm-table-${c.n}-detail`);

      const edit = new MtpBuilder(page);
      await edit.openEdit(id);
      await expectEditMetrics(page, metrics);
    });
  }
});

// ---------------------------------------------------------------------------
// PIVOT
// ---------------------------------------------------------------------------

const pivotDims = (r: CapturedRequest) =>
  json(field(r.body, 'row_dimensions')) === json(['statename']) &&
  json(field(r.body, 'column_dimensions')) === json(['climate_event']);

/** Every metric gets one sub-column under each climate_event value — same count per metric. */
async function expectPivotMetricColumns(page: Page, aliases: string[]) {
  const pivot = page.getByTestId('pivot-table');
  const counts: number[] = [];
  for (const alias of aliases) {
    counts.push(await pivot.getByRole('columnheader', { name: alias, exact: true }).count());
  }
  expect(counts[0], `metric header "${aliases[0]}" rendered`).toBeGreaterThan(0);
  expect(new Set(counts).size, `per-metric header counts ${json(counts)}`).toBe(1);
}

/**
 * [pinned] With no number format the pivot renders every metric with 0 decimals, so a female
 * share of ~0.49–0.51 shows as "0" or "1" (the table shows full precision for the same metric).
 */
async function expectRatioRoundedToInteger(page: Page) {
  const values: string[] = [];
  for (let i = 0; i < STATES; i++) {
    const cells = page.getByTestId(`pivot-row-${i}`).getByRole('cell');
    // first cell is the statename
    values.push(...(await cells.allTextContents()).slice(1).map((t) => t.trim()));
  }
  const numeric = values.filter((v) => v !== 'N/A');
  expect(numeric.length).toBeGreaterThan(0);
  for (const v of numeric) expect(v).toMatch(/^[01]$/);
}

test.describe('metrics matrix — pivot (rows statename × columns climate_event)', () => {
  for (const c of MULTI_CASES) {
    const pinned = c.pivotRoundsRatio ? '[pinned] ' : '';
    test(`${pinned}MM-pivot-${c.n} ${c.title}`, async ({ page, track }) => {
      const metrics = finalMetrics(c);
      const aliases = metrics.map((m) => m.alias);
      const b = new MtpBuilder(page);
      await b.openCreate('pivot_table');
      await b.pickCombobox('pivot-row-dimension-0', 'statename');
      await b.pickCombobox('pivot-col-dimension-0', 'climate_event');
      b.chartData.mark();
      await applyMetrics(b, c.build);
      await removeAndCheck(page, c);
      const data = await b.chartData.next(
        (r) => pivotDims(r) && json(aliasesOf(r)) === json(aliases)
      );
      expect(field(data.body, 'metrics') as unknown[]).toHaveLength(metrics.length);
      expectPayloadSnapshot(data, `mm-pivot-${c.n}-chart-data`);
      await expect(page.getByTestId(`pivot-row-${STATES - 1}`)).toBeVisible();
      await expect(page.getByTestId(`pivot-row-${STATES}`)).toHaveCount(0);
      await expectPivotMetricColumns(page, aliases);
      if (c.pivotRoundsRatio) await expectRatioRoundedToInteger(page);
      await expectChartScreenshot(b.preview, `mm-pivot-${c.n}-builder`);

      await b.setTitle(`mm-pivot-${c.n}`);
      const { id, captured } = await b.saveCreate(track);
      expectPayloadSnapshot(captured, `mm-pivot-${c.n}-create-post`);
      await expect(page.getByTestId(`pivot-row-${STATES - 1}`)).toBeVisible();
      await expectPivotMetricColumns(page, aliases);
      await expectChartScreenshot(page.getByTestId('pivot-table'), `mm-pivot-${c.n}-detail`);

      const edit = new MtpBuilder(page);
      await edit.openEdit(id);
      await expectEditMetrics(page, metrics);
    });
  }
});

// ---------------------------------------------------------------------------
// MAP (single metric)
// ---------------------------------------------------------------------------

const MAP_CASES: Array<{ n: number; title: string; metric: MetricSpec }> = [
  { n: 1, title: 'simple SUM(students)', metric: SIMPLE },
  { n: 2, title: 'calculated expression', metric: CALC },
  { n: 3, title: 'saved library metric (619 education_coverage_rate)', metric: SAVED_COVERAGE },
];

function overlayMatches(m: MetricSpec) {
  return (r: CapturedRequest) => {
    const metric = (k: string) => field(r.body, 'metrics', 0, k);
    if (m.kind === 'simple')
      return metric('column') === m.column && metric('aggregation') === m.aggregation;
    if (m.kind === 'calculated') return metric('column_expression') === m.expression;
    return metric('column_expression') === m.expression;
  };
}

test.describe('metrics matrix — map (one metric)', () => {
  for (const { n, title, metric } of MAP_CASES) {
    test(`MM-map-${n} ${title}`, async ({ page, track }) => {
      const b = new MtpBuilder(page);
      await b.openCreate('map');
      b.overlay.mark();
      await applyMetric(b, 0, metric);
      const overlay = await b.overlay.next(overlayMatches(metric));
      expectPayloadSnapshot(overlay, `mm-map-${n}-overlay`);
      await parkMouse(page);
      await waitForEChart(b.preview);
      await expectChartScreenshot(b.preview, `mm-map-${n}-builder`);

      await b.setTitle(`mm-map-${n}`);
      const detailOverlay = new RequestLog(page, API.mapOverlay);
      const { id, captured } = await b.saveCreate(track);
      expectPayloadSnapshot(captured, `mm-map-${n}-create-post`);
      await detailOverlay.next(overlayMatches(metric));
      const main = page.locator('main');
      await waitForEChart(main);
      await parkMouse(page);
      await expectChartScreenshot(echartsRoot(main), `mm-map-${n}-detail`);

      const edit = new MtpBuilder(page);
      await edit.openEdit(id);
      await expectEditMetrics(page, [metric]);
      await expect(page.getByTestId('add-metric-button')).toHaveCount(0);
    });
  }

  test('MM-map-4 max one metric: ADD ANOTHER METRIC hidden until the metric is removed', async ({
    page,
  }) => {
    const b = new MtpBuilder(page);
    await b.openCreate('map');
    await expect(page.getByTestId('metric-trigger-0')).toBeVisible();
    await expect(page.getByTestId('add-metric-button')).toHaveCount(0);
    await page.getByTestId('remove-metric-0').click();
    await expect(page.getByTestId('metric-trigger-0')).toHaveCount(0);
    await expect(page.getByTestId('add-metric-button')).toBeVisible();
    await page.getByTestId('add-metric-button').click();
    await expect(page.getByTestId('metric-trigger-0')).toContainText('Total Count');
    await expect(page.getByTestId('metric-trigger-1')).toHaveCount(0);
    await expect(page.getByTestId('add-metric-button')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// TABLE 3-level drill-down chain
// ---------------------------------------------------------------------------

test.describe('metrics matrix — table drill-down chain', () => {
  test('[pinned] MM-table-7 drill statename → districtname → climate_event, ← Back level by level', async ({
    page,
  }) => {
    const b = new MtpBuilder(page);
    await b.openCreate('table');
    await b.pickCombobox('chart-table-dimension-0', 'statename');
    await page.getByTestId('chart-table-dimension-add-btn').click();
    await b.pickCombobox('chart-table-dimension-1', 'districtname');
    await page.getByTestId('chart-table-dimension-add-btn').click();
    await b.pickCombobox('chart-table-dimension-2', 'climate_event');
    await b.setSimpleMetric(0, 'sum', 'students');
    await b.pickCombobox('chart-sort-column-select', SIMPLE.alias);
    b.dataPreview.mark();
    await page.getByTestId('chart-table-drill-down-switch').click();
    await expect(
      page.getByText('Drill-down will follow the order: statename → districtname → climate_event')
    ).toBeVisible();
    const dimsAre = (d: string[]) => (r: CapturedRequest) =>
      isAggregatedPreview(r) && json(field(r.body, 'dimensions')) === json(d);
    const filtersOf = (r: CapturedRequest) => field(r.body, 'extra_config', 'filters');

    // Level 1: states
    const level1 = await b.dataPreview.next(dimsAre(['statename']));
    expectPayloadSnapshot(level1, 'mm-table-7-level1-preview');
    await expect(tableBodyRows(b.preview)).toHaveCount(STATES);
    const stateCell = page.getByTestId('chart-table-drill-cell-0-statename');
    const state = (await stateCell.textContent())!.trim();

    // Level 2: districts of the state
    b.dataPreview.mark();
    await stateCell.click();
    const level2 = await b.dataPreview.next(dimsAre(['districtname']));
    expect(filtersOf(level2)).toEqual([{ column: 'statename', operator: 'equals', value: state }]);
    expectPayloadSnapshot(level2, 'mm-table-7-level2-preview');
    await expect(page.getByText(`statename: ${state}`, { exact: true })).toBeVisible();
    await expect(tableBodyRows(b.preview)).toHaveCount(DISTRICTS_PER_STATE);
    const districtCell = page.getByTestId('chart-table-drill-cell-0-districtname');
    const district = (await districtCell.textContent())!.trim();

    // Level 3: climate events of the district
    b.dataPreview.mark();
    await districtCell.click();
    const level3 = await b.dataPreview.next(dimsAre(['climate_event']));
    expect(filtersOf(level3)).toEqual([
      { column: 'statename', operator: 'equals', value: state },
      { column: 'districtname', operator: 'equals', value: district },
    ]);
    expectPayloadSnapshot(level3, 'mm-table-7-level3-preview');
    const crumb = `statename: ${state} → districtname: ${district}`;
    await expect(page.getByText(crumb, { exact: true })).toBeVisible();
    await expect.poll(() => tableHeaders(b.preview)).toEqual(['climate_event', SIMPLE.alias]);
    await expect.poll(() => tableBodyRows(b.preview).count()).toBeGreaterThan(0);
    const eventRows = await tableBodyRows(b.preview).count();

    // [pinned] the last level still renders drill cells, but clicking one is a no-op
    b.dataPreview.mark();
    await page.getByTestId('chart-table-drill-cell-0-climate_event').click();
    await expect(page.getByText(crumb, { exact: true })).toBeVisible();
    await expect(tableBodyRows(b.preview)).toHaveCount(eventRows);

    // ← Back: level 3 → level 2 (state filter only)
    await page.getByTestId('chart-table-drill-back-btn').click();
    await expect(page.getByText(`statename: ${state}`, { exact: true })).toBeVisible();
    await expect(tableBodyRows(b.preview)).toHaveCount(DISTRICTS_PER_STATE);
    await expect.poll(() => tableHeaders(b.preview)).toEqual(['districtname', SIMPLE.alias]);

    // ← Back: level 2 → level 1 (no breadcrumb)
    await page.getByTestId('chart-table-drill-back-btn').click();
    await expect(page.getByTestId('chart-table-drill-back-btn')).toHaveCount(0);
    await expect(tableBodyRows(b.preview)).toHaveCount(STATES);
    await expect.poll(() => tableHeaders(b.preview)).toEqual(['statename', SIMPLE.alias]);
    // Whatever going back fetches (or serves from SWR cache) no longer carries the district filter
    for (const r of b.dataPreview.since().filter(isAggregatedPreview)) {
      expect(json(filtersOf(r))).not.toContain(district);
    }
  });
});
