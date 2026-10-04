import { test, expect } from '../support/fixtures';
import { e2eTitle } from '../support/env';
import {
  CALC_EXPR,
  MODES,
  MULTI_METRIC,
  openSource,
  PermBuilder,
  SAVED_METRIC_ID,
  SHORT,
  TYPES,
} from './helpers-perm';

/**
 * PERM scenario 6 — METRIC TAB CYCLING per type, create + edit (edit: prefill-equivalent source).
 * Row 0: Simple SUM(students) → Calculated tab → expression → Saved tab → library metric 620 →
 * Simple tab. Multi-metric types (bar, line, table, pivot) repeat the cycle on row 1 with row 0
 * untouched. Every step pins UI + data request; the save pins POST / PUT.
 * MetricAccordionItem.handleTabChange: →Simple detaches the library link and resets an expression
 * to COUNT(*); →Calculated detaches the library link; the expression commits after validation.
 */

function cycle(index: number) {
  const r = `r${index}`;
  return [
    [`${r}-simple`, (p: PermBuilder) => p.b.setSimpleMetric(index, 'avg', 'male_score')],
    [`${r}-calc-tab`, (p: PermBuilder) => p.metricTab(index, 'calculated')],
    [`${r}-calc`, (p: PermBuilder) => p.fillExpr(index, CALC_EXPR)],
    [`${r}-saved-tab`, (p: PermBuilder) => p.metricTab(index, 'saved')],
    [`${r}-saved`, (p: PermBuilder) => p.pickSaved(index, SAVED_METRIC_ID)],
    [`${r}-simple-tab`, (p: PermBuilder) => p.metricTab(index, 'simple')],
  ] as const;
}

for (const mode of MODES) {
  test.describe(`PERM-metric-tabs-${mode}`, () => {
    for (const type of TYPES) {
      const t = SHORT[type];

      test(`PERM-metric-tabs-${mode} ${t} row 0 simple → calculated → saved → simple`, async ({
        page,
        api,
        track,
      }) => {
        const title = `PERM-metric-tabs-${mode} ${t} row 0`;
        const p = new PermBuilder(page, mode, `tabs-${mode}-${t}-r0`);
        await openSource(p, { api, track }, type, title, 'prefill');
        for (const [step, action] of cycle(0)) {
          const s = await p.step(step, type, () => action(p));
          expect(s.ui.controls['metric-trigger-0'], step).toBeDefined();
        }
        await p.save(track, e2eTitle(title));
      });

      if (!MULTI_METRIC.includes(type)) continue;

      test(`PERM-metric-tabs-${mode} ${t} row 1 cycle, row 0 untouched`, async ({
        page,
        api,
        track,
      }) => {
        const title = `PERM-metric-tabs-${mode} ${t} row 1`;
        const p = new PermBuilder(page, mode, `tabs-${mode}-${t}-r1`);
        await openSource(p, { api, track }, type, title, 'prefill');
        await p.step('r0-sum', type, () => p.b.setSimpleMetric(0, 'sum', 'students'));
        await p.step('r1-add', type, () => p.addMetric());
        for (const [step, action] of cycle(1)) {
          const s = await p.step(step, type, () => action(p));
          // Row 0 is never touched by the row-1 cycle
          expect(s.ui.controls['metric-trigger-0'], step).toBe('SUM(students) SUM(students)');
        }
        await p.save(track, e2eTitle(title));
      });
    }
  });
}
