import { test, expect } from '../support/fixtures';
import { e2eTitle } from '../support/env';
import {
  arrow,
  MODES,
  openSource,
  PermBuilder,
  slug,
  TYPES,
  type Mode,
  type PermType,
} from './helpers-perm';

/**
 * PERM scenario 1 — PREFILL-ONLY SWITCH. Source = a chart of type A exactly as auto-prefill leaves it
 * (create: fresh builder; edit: API chart with the config the create builder saves for it) → switch
 * to B, for all 42 ordered pairs, in both builders. Pins UI + data request of the open state and the
 * switch, then the save (POST / PUT).
 * Keep/trim rules live in ChartDataConfigurationV3.handleChartTypeChange; the edit builder re-maps the
 * switch again in its handleFormChange (customizations → new type defaults + a few preserved keys).
 */

const XY: PermType[] = ['bar', 'line', 'pie'];

/** [pinned] reason for a pair, or null (each verified in the source). */
function pinned(mode: Mode, a: PermType, b: PermType): string | null {
  if (b === 'pivot_table') {
    return 'handleChartTypeChange resets pivot row/column dimensions to [] → Save disabled';
  }
  if ((a === 'number' || a === 'pivot_table') && XY.includes(b)) {
    return 'source has no dimension_column; the switch copies the empty one over auto-prefill → Save disabled';
  }
  if (mode === 'create' && a === 'map' && XY.includes(b)) {
    return 'MapDataConfigurationV3 switches with {chart_type} only (no keep/trim, no prefill) → no dimension, Save disabled';
  }
  if (mode === 'create' && a === 'pie' && b === 'map') {
    return "pie legendPosition 'right' carried into map customizations → save 422 (map needs a corner)";
  }
  if (
    mode === 'edit' &&
    ((XY.includes(a) && b === 'pie' && a !== 'pie') ||
      (a === 'pie' && (b === 'bar' || b === 'line')))
  ) {
    return 'edit handleFormChange re-applies the old dataLabelPosition over the sanitized one → save 422';
  }
  return null;
}

for (const mode of MODES) {
  test.describe(`PERM-prefill-${mode}`, () => {
    for (const a of TYPES) {
      for (const b of TYPES) {
        if (a === b) continue;
        const pin = pinned(mode, a, b);
        const title = `PERM-prefill-${mode} ${arrow([a, b])}`;
        test(`${pin ? '[pinned] ' : ''}${title}${pin ? ` — ${pin}` : ''}`, async ({
          page,
          api,
          track,
        }) => {
          // Pinned reason (if any): pinned() above
          const p = new PermBuilder(page, mode, `prefill-${mode}-${slug([a, b])}`);
          await openSource(p, { api, track }, a, title, 'prefill');
          const open = await p.snap('open', a);
          expect(open.ui.type).toBe(a);

          const switched = await p.step('switch', b, p.switchTo(b));
          expect(switched.ui.type).toBe(b);
          // Title survives every switch
          expect(switched.ui.title).toBe(e2eTitle(title));

          await p.save(track, e2eTitle(title));
        });
      }
    }
  });
}
