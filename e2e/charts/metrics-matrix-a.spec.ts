import { test, expect } from '../support/fixtures';
import { e2eTitle } from '../support/env';
import { expectPayloadSnapshot } from '../support/payload';
import { expectChartScreenshot } from '../support/render';
import { ChartBuilderPage } from './helpers-builder';
import { detailChartLocator } from './helpers-core';
import {
  type ChartDataCapture,
  type MetricSpec,
  applyMetric,
  buildMetrics,
  chartDataWithAliases,
  expectAddButton,
  expectEditRows,
  expectPayloadMetrics,
  expectSeries,
  openDetail,
} from './helpers-metrics-a';

/**
 * Metric matrix (inventory §7 × §8.1–8.4): metric kinds (simple / calculated / saved) and metric counts
 * per chart type on production.mart_education_program.
 * Each case: PAY chart-data (metrics array) + series-per-metric in the response + SHOT preview →
 * save (PAY create payload) → reopen /edit (same rows, tab, alias) → /charts/<id> render SHOT.
 * Saved metrics 619/620/621 are seed library metrics (READ-ONLY: picked, never edited).
 */

type MultiType = 'bar' | 'line';
type SingleType = 'pie' | 'number';
type MatrixType = MultiType | SingleType;

const SIMPLE: MetricSpec = {
  kind: 'simple',
  agg: 'sum',
  column: 'students',
  alias: 'SUM(students)',
};
// Ratio (0..1) — suggested calculated case for single-metric charts
const CALC_RATIO: MetricSpec = {
  kind: 'calculated',
  expr: 'SUM(females) * 1.0 / NULLIF(SUM(students),0)',
  alias: 'SUM(females) * 1.0 / NULLIF(SUM(students),0)',
};
// Same magnitude as SUM(students), so it stays visible next to it in multi-metric bar/line charts
const CALC_MALES: MetricSpec = {
  kind: 'calculated',
  expr: 'SUM(students) - SUM(females)',
  alias: 'SUM(students) - SUM(females)',
};
// Seed library metrics: 620 = SUM(students) (simple), 619 = students/population (expression),
// 621 = weighted female score (expression)
const SAVED_TOTAL: MetricSpec = { kind: 'saved', id: 620, alias: 'total_students' };
const SAVED_COVERAGE: MetricSpec = { kind: 'saved', id: 619, alias: 'education_coverage_rate' };
const SAVED_FEMALE_SCORE: MetricSpec = { kind: 'saved', id: 621, alias: 'avg_score_female' };

/** Dimension + deterministic order (GROUP BY order is otherwise unspecified). Number has neither. */
async function dimensionBaseline(b: ChartBuilderPage, type: MatrixType) {
  if (type === 'number') return;
  await b.setXAxis('statename');
  await b.setSortColumn('statename');
  await b.settle();
}

/** Save with a stable title, snapshot + check the create payload, reopen edit, render detail. */
async function saveReopenDetail(
  b: ChartBuilderPage,
  track: (resource: 'charts', id: number) => void,
  type: MatrixType,
  name: string,
  specs: MetricSpec[]
) {
  const title = e2eTitle(name);
  const { id, request } = await b.saveAndSnapshot(track, title, `${name}-save`);
  const extra = (request.body as { extra_config?: { metrics?: [] } }).extra_config;
  expectPayloadMetrics(extra?.metrics, specs);

  await expectEditRows(b.page, type, { id, title }, specs);

  await openDetail(b.page, type, id, specs);
  await expectChartScreenshot(detailChartLocator(b.page, type), `${name}-detail`);
  return { id, request };
}

/** Full case: open create → dimension → metrics → PAY/SHOT → save/edit/detail. */
async function runCase(
  b: ChartBuilderPage,
  track: (resource: 'charts', id: number) => void,
  type: MatrixType,
  name: string,
  specs: MetricSpec[]
) {
  await b.openCreate(type);
  await dimensionBaseline(b, type);
  const final = await buildMetrics(b, specs);
  await checkPreview(b, type, name, final, specs);
  return saveReopenDetail(b, track, type, name, specs);
}

async function checkPreview(
  b: ChartBuilderPage,
  type: MatrixType,
  name: string,
  capture: ChartDataCapture,
  specs: MetricSpec[]
) {
  expectPayloadMetrics(capture.body.metrics, specs);
  expectSeries(type, capture, specs);
  expectPayloadSnapshot(capture.request, `${name}-chart-data`);
  for (let i = 0; i < specs.length; i++) {
    await expect(b.metricTrigger(i)).toContainText(specs[i].alias);
  }
  await expect(b.metricTrigger(specs.length)).toHaveCount(0);
  await expectAddButton(b.page, type);
  await b.expectPreviewShot(`${name}-preview`);
}

// ---------------------------------------------------------------------------------------------
// BAR / LINE — several metrics
// ---------------------------------------------------------------------------------------------

for (const type of ['bar', 'line'] as const) {
  // Different saved metric per type so both a simple (620) and an expression (619) library metric
  // go through the single-saved case
  const singleSaved = type === 'bar' ? SAVED_TOTAL : SAVED_COVERAGE;
  // Fraction-only series (ratio ≈0.5; coverage rate ≈0.09). The builder preview labels the Y axis
  // 0.1…0.6, but the saved chart comes back from GET /api/charts/<id>/ with yAxisDecimalPlaces: null
  // and applyLineBarChartFormatting treats null as "set" (`!== undefined`) → toFixed(null) → the
  // detail page labels the Y axis with integers ("1", "0", …). Pinned via the detail SHOT.
  const yAxisRoundedOnDetail = (spec: MetricSpec) => spec === CALC_RATIO || spec === SAVED_COVERAGE;
  const pin = (title: string) => `${title} — detail Y axis rounded to integers`;
  const cases: Array<{ n: number; title: string; specs: MetricSpec[]; pinned?: boolean }> = [
    { n: 1, title: 'one simple metric (SUM students)', specs: [SIMPLE] },
    {
      n: 2,
      title: pin('one calculated metric (ratio expression)'),
      specs: [CALC_RATIO],
      pinned: true,
    },
    {
      n: 3,
      title: yAxisRoundedOnDetail(singleSaved)
        ? pin(`one saved library metric (${singleSaved.alias})`)
        : `one saved library metric (${singleSaved.alias})`,
      specs: [singleSaved],
      pinned: yAxisRoundedOnDetail(singleSaved),
    },
    { n: 4, title: 'two metrics (simple+calculated)', specs: [SIMPLE, CALC_MALES] },
    {
      n: 5,
      title: 'three mixed metrics (simple+calculated+saved)',
      specs: [SIMPLE, CALC_MALES, SAVED_FEMALE_SCORE],
    },
  ];

  test.describe(`metrics matrix ${type}`, () => {
    for (const c of cases) {
      test(`${c.pinned ? '[pinned] ' : ''}MM-${type}-${c.n} ${c.title}`, async ({
        page,
        track,
        api,
      }) => {
        const b = new ChartBuilderPage(page);
        const { id } = await runCase(b, track, type, `mm-${type}-${c.n}`, c.specs);
        if (c.pinned) {
          // Pinned: the stored null (not undefined) is what rounds the detail Y axis (SHOT)
          const chart = await api.get<{
            extra_config: { customizations: Record<string, unknown> };
          }>(`/api/charts/${id}/`);
          expect(chart.extra_config.customizations.yAxisDecimalPlaces).toBeNull();
        }
      });
    }

    test(`MM-${type}-6 three metrics → remove middle → two remain in order`, async ({
      page,
      track,
    }) => {
      const name = `mm-${type}-6`;
      const all = [SIMPLE, CALC_MALES, SAVED_FEMALE_SCORE];
      const remaining = [SIMPLE, SAVED_FEMALE_SCORE];
      const b = new ChartBuilderPage(page);
      await b.openCreate(type);
      await dimensionBaseline(b, type);
      await buildMetrics(b, all);

      const afterRemove = await chartDataWithAliases(
        page,
        remaining.map((s) => s.alias),
        () => page.getByTestId('remove-metric-1').click()
      );
      await checkPreview(b, type, name, afterRemove, remaining);
      // The surviving saved row keeps its library link after moving up from index 2 → 1
      await expect(page.getByTestId('metric-library-icon-1')).toBeVisible();
      await saveReopenDetail(b, track, type, name, remaining);
    });
  });
}

// ---------------------------------------------------------------------------------------------
// PIE / NUMBER — exactly one metric
// ---------------------------------------------------------------------------------------------

for (const type of ['pie', 'number'] as const) {
  const singleSaved = type === 'pie' ? SAVED_TOTAL : SAVED_COVERAGE;
  // Both ratio metrics are fractions (≈0.50 and ≈0.09). On a number card they render rounded to an
  // integer ("1" / "0"): the create builder defaults number charts to decimalPlaces 0.
  const fractionOnCard = type === 'number';
  const pin = (title: string) =>
    fractionOnCard ? `${title} — rendered rounded to an integer (default decimalPlaces 0)` : title;
  const cases: Array<{ n: number; title: string; specs: MetricSpec[]; pinned?: boolean }> = [
    { n: 1, title: 'simple metric (SUM students)', specs: [SIMPLE] },
    {
      n: 2,
      title: pin('calculated metric (ratio expression)'),
      specs: [CALC_RATIO],
      pinned: fractionOnCard,
    },
    {
      n: 3,
      title: pin(`saved library metric (${singleSaved.alias})`),
      specs: [singleSaved],
      pinned: fractionOnCard,
    },
  ];

  test.describe(`metrics matrix ${type}`, () => {
    for (const c of cases) {
      test(`${c.pinned ? '[pinned] ' : ''}MM-${type}-${c.n} ${c.title}`, async ({
        page,
        track,
      }) => {
        const b = new ChartBuilderPage(page);
        const saved = await runCase(b, track, type, `mm-${type}-${c.n}`, c.specs);
        if (c.pinned) {
          // Pinned: fraction shown as "1"/"0" on the card (SHOT) because of this create default
          const body = saved.request.body as {
            extra_config?: { customizations?: { decimalPlaces?: number } };
          };
          expect(body.extra_config?.customizations?.decimalPlaces).toBe(0);
        }
      });
    }

    test(`MM-${type}-4 max one metric: no add button, tab switches keep exactly one metric`, async ({
      page,
      track,
    }) => {
      const name = `mm-${type}-4`;
      const b = new ChartBuilderPage(page);
      const addButton = page.getByTestId('add-metric-button');
      await b.openCreate(type);
      await dimensionBaseline(b, type);
      await expect(b.metricTrigger(0)).toBeVisible();
      await expect(addButton).toHaveCount(0);

      // simple → calculated → saved on the same (only) row
      const steps: Array<{ step: string; spec: MetricSpec }> = [
        { step: 'simple', spec: SIMPLE },
        { step: 'calculated', spec: CALC_RATIO },
        { step: 'saved', spec: SAVED_TOTAL },
      ];
      for (const { step, spec } of steps) {
        const cap = await applyMetric(b, 0, spec, [spec.alias]);
        expectPayloadMetrics(cap.body.metrics, [spec]);
        expectPayloadSnapshot(cap.request, `${name}-${step}-chart-data`);
        await expect(b.metricTrigger(1)).toHaveCount(0);
        await expect(addButton).toHaveCount(0);
      }
      await b.expectPreviewShot(`${name}-preview`);
      await saveReopenDetail(b, track, type, name, [SAVED_TOTAL]);
    });
  });
}

// ---------------------------------------------------------------------------------------------
// PIE with an extra dimension
// ---------------------------------------------------------------------------------------------

test('MM-pie-5 extra dimension (statename × climate_event, SUM students)', async ({
  page,
  track,
}) => {
  const name = 'mm-pie-5';
  const specs = [SIMPLE];
  const b = new ChartBuilderPage(page);
  await b.openCreate('pie');
  await b.setXAxis('statename');
  await buildMetrics(b, specs);
  // Slices are state × event pairs: sort by the metric (distinct values) for a stable slice order
  await b.setSortColumn(SIMPLE.alias);
  await b.setSortDirection('desc');
  const withExtra = await b.captureChartData(() => b.setExtraDimension('climate_event'));
  const body = withExtra.body as { extra_dimension?: string; metrics?: [] };
  expect(body.extra_dimension).toBe('climate_event');
  expectPayloadMetrics(body.metrics, specs);
  expectPayloadSnapshot(withExtra, `${name}-chart-data`);
  await b.expectPreviewShot(`${name}-preview`);

  const title = e2eTitle(name);
  const { request } = await b.saveAndSnapshot(track, title, `${name}-save`);
  const extra = (
    request.body as { extra_config?: { extra_dimension_column?: string; metrics?: [] } }
  ).extra_config;
  expectPayloadMetrics(extra?.metrics, specs);
});
