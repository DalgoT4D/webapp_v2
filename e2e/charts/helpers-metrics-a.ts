import { expect, type Page, type Response } from '@playwright/test';
import type { CapturedRequest } from '../support/payload';
import { waitForChartData, waitForEChart } from '../support/render';
import { ChartBuilderPage, CHART_DATA_URL } from './helpers-builder';
import { gotoChartDetail, gotoChartEdit } from './helpers-core';

/**
 * Metric matrix helpers (metrics-matrix-a.spec.ts): build N metrics of mixed kinds in the create
 * builder, and verify what the builder / edit page / detail page send and render for them.
 */

export type MetricKind = 'simple' | 'calculated' | 'saved';

export type MetricSpec =
  | { kind: 'simple'; agg: string; column: string; alias: string }
  | { kind: 'calculated'; expr: string; alias: string }
  | { kind: 'saved'; id: number; alias: string };

type MatrixChartType = 'bar' | 'line' | 'pie' | 'number';

interface PayloadMetric {
  alias?: string;
  aggregation?: string | null;
  column?: string | null;
  column_expression?: string | null;
  saved_metric_id?: number;
}

interface ChartDataBody {
  metrics?: PayloadMetric[];
}

/** POST /api/charts/chart-data/ response `data`, per chart family. */
interface ChartDataResponseBody {
  data?: {
    legend?: string[];
    series?: Array<{ name: string }>;
    seriesName?: string;
    pieData?: Array<{ name: string }>;
    metric_name?: string;
  };
}

export interface ChartDataCapture {
  request: CapturedRequest;
  body: ChartDataBody;
  response: ChartDataResponseBody;
}

const CHART_DATA_TIMEOUT_MS = 30_000;
const METRIC_VALIDATE_URL = '/api/metrics/validate/';

function isChartDataPost(r: Response) {
  return r.url().includes(CHART_DATA_URL) && r.request().method() === 'POST';
}

function parseBody(r: Response): ChartDataBody {
  try {
    return (r.request().postDataJSON() ?? {}) as ChartDataBody;
  } catch {
    return {};
  }
}

export function aliasesOf(body: ChartDataBody): string[] {
  return (body.metrics ?? []).map((m) => m.alias ?? '');
}

async function toCapture(r: Response): Promise<ChartDataCapture> {
  expect(r.ok(), `chart-data → ${r.status()}`).toBeTruthy();
  const url = new URL(r.url());
  const body = parseBody(r);
  return {
    request: {
      method: r.request().method(),
      path: url.pathname,
      query: {},
      body: body as CapturedRequest['body'],
    },
    body,
    response: (await r.json()) as ChartDataResponseBody,
  };
}

/**
 * Run `action` and wait for the chart-data POST whose metric aliases are exactly `aliases` (in order).
 * Matching on content (not "the next request") keeps debounced / in-flight requests of earlier steps
 * from being captured by mistake.
 */
export async function chartDataWithAliases(
  page: Page,
  aliases: string[],
  action: () => Promise<void>
): Promise<ChartDataCapture> {
  const expected = JSON.stringify(aliases);
  const res = page.waitForResponse(
    (r) => isChartDataPost(r) && JSON.stringify(aliasesOf(parseBody(r))) === expected,
    { timeout: CHART_DATA_TIMEOUT_MS }
  );
  await action();
  const capture = await toCapture(await res);
  await waitForChartData(page);
  return capture;
}

/** Put `spec` into metric row `index` (the row must exist). Returns the chart-data capture it caused. */
export async function applyMetric(
  b: ChartBuilderPage,
  index: number,
  spec: MetricSpec,
  expectedAliases: string[]
): Promise<ChartDataCapture> {
  const { page } = b;
  await b.expandMetric(index);
  if (spec.kind === 'simple') {
    // Function first (sends an intermediate AGG(*) request), then column → final alias
    await b.setMetricAgg(index, spec.agg);
    return chartDataWithAliases(page, expectedAliases, () => b.setMetricColumn(index, spec.column));
  }
  if (spec.kind === 'calculated') {
    await page.getByTestId(`metric-tab-calculated-${index}`).click();
    const validate = page.waitForResponse(
      (r) => r.url().includes(METRIC_VALIDATE_URL) && r.request().method() === 'POST',
      { timeout: CHART_DATA_TIMEOUT_MS }
    );
    const capture = await chartDataWithAliases(page, expectedAliases, async () => {
      await page.getByTestId(`metric-expr-${index}`).fill(spec.expr);
      const v = (await (await validate).json()) as { valid: boolean; error?: string };
      expect(v.valid, `validate "${spec.expr}": ${v.error ?? ''}`).toBe(true);
    });
    await expect(page.getByText('Validating expression...')).toHaveCount(0);
    return capture;
  }
  await page.getByTestId(`metric-tab-saved-${index}`).click();
  return chartDataWithAliases(page, expectedAliases, () =>
    b.pickCombo(`metric-saved-${index}`, String(spec.id))
  );
}

/**
 * Starting from the create builder's prefilled single COUNT(*) row, build `specs` row by row
 * (adding rows with "+ ADD ANOTHER METRIC"). Returns the capture of the final chart-data request.
 */
export async function buildMetrics(
  b: ChartBuilderPage,
  specs: MetricSpec[]
): Promise<ChartDataCapture> {
  let last: ChartDataCapture | null = null;
  for (let i = 0; i < specs.length; i++) {
    const done = specs.slice(0, i).map((s) => s.alias);
    if (i > 0) {
      // New row = COUNT(*) "Total Count", expanded
      await chartDataWithAliases(b.page, [...done, 'Total Count'], () =>
        b.page.getByTestId('add-metric-button').click()
      );
    }
    last = await applyMetric(b, i, specs[i], [...done, specs[i].alias]);
  }
  return last as ChartDataCapture;
}

/** Each payload metric carries the definition of its kind (and only that). */
export function expectPayloadMetrics(metrics: PayloadMetric[] | undefined, specs: MetricSpec[]) {
  expect(metrics ?? [], 'payload metrics').toHaveLength(specs.length);
  specs.forEach((spec, i) => {
    const m = (metrics ?? [])[i];
    expect(m.alias, `metric ${i} alias`).toBe(spec.alias);
    if (spec.kind === 'simple') {
      expect(m).toMatchObject({ aggregation: spec.agg, column: spec.column });
      expect(m.column_expression ?? null).toBeNull();
      expect(m.saved_metric_id ?? null).toBeNull();
    } else if (spec.kind === 'calculated') {
      expect(m.column_expression).toBe(spec.expr);
      expect(m.saved_metric_id ?? null).toBeNull();
    } else {
      expect(m.saved_metric_id).toBe(spec.id);
    }
  });
}

/** The chart-data response carries one series per metric, named by alias (per chart family). */
export function expectSeries(
  type: MatrixChartType,
  capture: ChartDataCapture,
  specs: MetricSpec[]
) {
  const aliases = specs.map((s) => s.alias);
  const data = capture.response.data ?? {};
  if (type === 'bar' || type === 'line') {
    expect(data.legend, 'legend entries').toEqual(aliases);
    expect(
      (data.series ?? []).map((s) => s.name),
      'series names'
    ).toEqual(aliases);
  } else if (type === 'pie') {
    expect(data.seriesName, 'pie series').toBe(aliases[0]);
  } else {
    expect(data.metric_name, 'number metric').toBe(aliases[0]);
  }
}

/** "+ ADD ANOTHER METRIC" is offered on bar/line, hidden on single-metric pie/number (maxMetrics=1). */
export async function expectAddButton(page: Page, type: MatrixChartType) {
  const add = page.getByTestId('add-metric-button');
  if (type === 'pie' || type === 'number') await expect(add).toHaveCount(0);
  else await expect(add).toBeVisible();
}

/** Open /charts/<id>/edit: same rows, each on its saved kind's tab with its alias. */
export async function expectEditRows(
  page: Page,
  type: MatrixChartType,
  chart: { id: number; title: string },
  specs: MetricSpec[]
) {
  const b = new ChartBuilderPage(page);
  const data = page.waitForResponse(isChartDataPost, { timeout: CHART_DATA_TIMEOUT_MS });
  await gotoChartEdit(page, chart);
  const capture = await toCapture(await data);
  expectPayloadMetrics(capture.body.metrics, specs);
  expectSeries(type, capture, specs);

  await expect(b.metricTrigger(specs.length)).toHaveCount(0);
  await expectAddButton(page, type);
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    await expect(b.metricTrigger(i)).toContainText(spec.alias);
    await b.expandMetric(i);
    await expect(page.getByTestId(`metric-tab-${spec.kind}-${i}`)).toHaveAttribute(
      'data-state',
      'active'
    );
    await expect(page.getByTestId(`metric-library-icon-${i}`)).toHaveCount(
      spec.kind === 'saved' ? 1 : 0
    );
    // Display Name is hidden on number charts
    if (type === 'number') {
      await expect(page.getByTestId(`metric-alias-${i}`)).toHaveCount(0);
    } else {
      await expect(page.getByTestId(`metric-alias-${i}`)).toHaveValue(spec.alias);
    }
  }
  await waitForEChart(b.previewPanel);
}

/** Open /charts/<id> and wait for its chart-data (series per metric) and the ECharts render. */
export async function openDetail(
  page: Page,
  type: MatrixChartType,
  id: number,
  specs: MetricSpec[]
) {
  const data = page.waitForResponse(isChartDataPost, { timeout: CHART_DATA_TIMEOUT_MS });
  await gotoChartDetail(page, id);
  const capture = await toCapture(await data);
  expectPayloadMetrics(capture.body.metrics, specs);
  expectSeries(type, capture, specs);
  await waitForEChart(page.locator('body'));
  await waitForChartData(page);
}
