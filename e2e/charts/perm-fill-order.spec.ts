import { test, expect } from '../support/fixtures';
import { e2eTitle } from '../support/env';
import {
  createSource,
  diff,
  expectDiffSnapshot,
  MODES,
  PermBuilder,
  PREFILL_SOURCE,
  SHORT,
  type Mode,
  type PermType,
} from './helpers-perm';

/**
 * PERM scenario 5 — FILL ORDER, per multi-field type, create + edit (edit: source = prefill-equivalent
 * chart). Starting from the auto-prefilled config:
 *   (a/b) metrics → dimensions vs dimensions → metrics: same final request / UI? (`order-diff.json`)
 *   (c)   dimensions → switch type → metrics (switch before any metric is added)
 *   (d)   remove every metric → switch type
 *   (e)   dimension dependencies: extra dimension / 2nd dimension, then move the X axis (or first
 *         dimension) onto a dependent / date column and back — time grain appears / clears
 */

type FillType = 'bar' | 'line' | 'pie' | 'table' | 'pivot_table' | 'map';
const FILL_TYPES: FillType[] = ['bar', 'line', 'pie', 'table', 'pivot_table', 'map'];

interface Fill {
  dims: (p: PermBuilder) => Promise<void>;
  metrics: (p: PermBuilder) => Promise<void>;
  /** Type switched to in (c) / (d) */
  partner: FillType;
}

async function twoMetrics(p: PermBuilder) {
  await p.ensureRow(0);
  await p.b.setSimpleMetric(0, 'sum', 'students');
  await p.ensureRow(1);
  await p.b.setSimpleMetric(1, 'avg', 'male_score');
}
async function oneMetric(p: PermBuilder) {
  await p.ensureRow(0);
  await p.b.setSimpleMetric(0, 'sum', 'students');
}
async function xAndExtra(p: PermBuilder) {
  await p.b.setXAxis('statename');
  await p.b.setExtraDimension('climate_event');
}

const FILL: Record<FillType, Fill> = {
  bar: { dims: xAndExtra, metrics: twoMetrics, partner: 'line' },
  line: { dims: xAndExtra, metrics: twoMetrics, partner: 'bar' },
  pie: { dims: xAndExtra, metrics: oneMetric, partner: 'bar' },
  table: {
    async dims(p) {
      await p.setTableDim(0, 'statename');
      await p.addTableDim('districtname');
    },
    metrics: twoMetrics,
    partner: 'bar',
  },
  pivot_table: {
    async dims(p) {
      await p.setPivotRow(0, 'statename');
      await p.setPivotCol(0, 'climate_event');
    },
    metrics: twoMetrics,
    partner: 'table',
  },
  map: {
    async dims(p) {
      await p.setMapDistrict('districtname');
    },
    metrics: oneMetric,
    partner: 'bar',
  },
};

/** (e) steps per type: [step name, action] */
const DEPENDENCY_STEPS: Record<FillType, Array<[string, (p: PermBuilder) => Promise<void>]>> = {
  bar: xDateSteps(true),
  line: xDateSteps(true),
  pie: xDateSteps(false),
  table: [
    ['dims', FILL.table.dims],
    ['remove-first-dim', (p) => p.page.getByTestId('chart-table-dimension-remove-0').click()],
    ['dim-date', (p) => p.setTableDim(0, 'date')],
    ['dim-back', (p) => p.setTableDim(0, 'statename')],
  ],
  pivot_table: [
    ['dims', FILL.pivot_table.dims],
    [
      'add-row-dim',
      async (p) => {
        await p.page.getByTestId('add-row-dimension-btn').click();
        await p.setPivotRow(1, 'districtname');
      },
    ],
    ['remove-first-row-dim', (p) => p.page.getByTestId('remove-row-dim-0').click()],
    ['col-date', (p) => p.setPivotCol(0, 'date')],
    ['col-back', (p) => p.setPivotCol(0, 'climate_event')],
  ],
  map: [
    ['district', FILL.map.dims],
    // Moving the state column onto the drill-down column
    ['state-to-district', (p) => p.setMapState('districtname')],
    ['state-back', (p) => p.setMapState('statename')],
  ],
};

function xDateSteps(grain: boolean): Array<[string, (p: PermBuilder) => Promise<void>]> {
  return [
    ['x-extra', xAndExtra],
    // X axis onto the extra dimension's column (the extra list excludes the X column)
    ['x-to-extra', (p) => p.b.setXAxis('climate_event')],
    ['x-date', (p) => p.b.setXAxis('date')],
    ...(grain
      ? ([['grain-month', (p: PermBuilder) => p.b.setTimeGrain('month')]] as Array<
          [string, (p: PermBuilder) => Promise<void>]
        >)
      : []),
    ['x-back', (p) => p.b.setXAxis('statename')],
  ];
}

interface Ctx {
  api: Parameters<typeof createSource>[0];
  track: Parameters<typeof createSource>[1];
}

/** Open the prefilled builder (create) / the prefill-equivalent source (edit). */
async function openPrefilled(p: PermBuilder, ctx: Ctx, type: PermType, title: string) {
  if (p.mode === 'create') {
    await p.open({ type });
    await p.b.setTitle(e2eTitle(title));
    return null;
  }
  const chart = await createSource(ctx.api, ctx.track, type, title, PREFILL_SOURCE[type]);
  await p.open(chart);
  return chart;
}

function name(mode: Mode, type: FillType, sub: string) {
  return `fill-${mode}-${SHORT[type]}-${sub}`;
}

for (const mode of MODES) {
  test.describe(`PERM-fill-${mode}`, () => {
    for (const type of FILL_TYPES) {
      const t = SHORT[type];
      const fill = FILL[type];

      test(`PERM-fill-${mode} ${t} (a) metrics→dims vs (b) dims→metrics`, async ({
        page,
        api,
        track,
      }) => {
        const title = `PERM-fill-${mode} ${t} order`;
        const p = new PermBuilder(page, mode, name(mode, type, 'order'));
        const chart = await openPrefilled(p, { api, track }, type, title);
        await p.step('a-metrics', type, () => fill.metrics(p));
        const a = await p.step('a-dims', type, () => fill.dims(p));

        // Fresh builder on the same starting point
        if (chart) await p.open(chart);
        else {
          await p.open({ type });
          await p.b.setTitle(e2eTitle(title));
        }
        await p.step('b-dims', type, () => fill.dims(p));
        const b = await p.step('b-metrics', type, () => fill.metrics(p));

        const orderDiff = {
          ui: diff(a.ui.controls, b.ui.controls),
          request: diff(a.current?.body, b.current?.body),
        };
        expectDiffSnapshot(p.key, 'order-diff', orderDiff);
        // Today the fill order never matters: same controls, same final data request
        expect(orderDiff).toEqual({ ui: {}, request: {} });
        expect(b.ui.saveEnabled).toBe(a.ui.saveEnabled);
        await p.save(track, e2eTitle(title));
      });

      // [pinned] create map → bar keeps no dimension (MapDataConfigurationV3 switches with {chart_type}
      // only) → Save disabled; edit pie → bar re-applies pie dataLabelPosition 'outside' → save 422
      const pinC = (mode === 'create' && type === 'map') || (mode === 'edit' && type === 'pie');
      test(`${pinC ? '[pinned] ' : ''}PERM-fill-${mode} ${t} (c) dims → switch to ${SHORT[fill.partner]} → metrics`, async ({
        page,
        api,
        track,
      }) => {
        const title = `PERM-fill-${mode} ${t} switch-before-metrics`;
        const p = new PermBuilder(page, mode, name(mode, type, 'switch-first'));
        await openPrefilled(p, { api, track }, type, title);
        await p.step('dims', type, () => fill.dims(p));
        const sw = await p.step('switch', fill.partner, p.switchTo(fill.partner));
        expect(sw.ui.type).toBe(fill.partner);
        await p.step('metrics', fill.partner, () => FILL[fill.partner].metrics(p));
        await p.save(track, e2eTitle(title));
      });

      // [pinned] bar/line/pie/table → bar/line with zero metrics: Save stays enabled (isFormValid falls
      // back to the legacy aggregate_function='count' path) but the backend needs ≥1 metric → 422
      const pinD = type !== 'map' && type !== 'pivot_table';
      test(`${pinD ? '[pinned] ' : ''}PERM-fill-${mode} ${t} (d) remove all metrics → switch to ${SHORT[fill.partner]}`, async ({
        page,
        api,
        track,
      }) => {
        const title = `PERM-fill-${mode} ${t} no-metrics-switch`;
        const p = new PermBuilder(page, mode, name(mode, type, 'no-metrics'));
        await openPrefilled(p, { api, track }, type, title);
        const removed = await p.step('removed', type, () => p.removeAllMetrics());
        expect(removed.ui.controls['metric-trigger-0']).toBeUndefined();
        const sw = await p.step('switch', fill.partner, p.switchTo(fill.partner));
        expect(sw.ui.type).toBe(fill.partner);
        await p.save(track, e2eTitle(title));
      });

      test(`PERM-fill-${mode} ${t} (e) dimension dependencies / date dimension and back`, async ({
        page,
        api,
        track,
      }) => {
        const title = `PERM-fill-${mode} ${t} dependencies`;
        const p = new PermBuilder(page, mode, name(mode, type, 'deps'));
        await openPrefilled(p, { api, track }, type, title);
        for (const [stepName, action] of DEPENDENCY_STEPS[type]) {
          await p.step(stepName, type, () => action(p));
        }
        await p.save(track, e2eTitle(title));
      });
    }
  });
}
