import { test, expect } from '../support/fixtures';
import { e2eTitle } from '../support/env';
import {
  arrow,
  diff,
  expectDiffSnapshot,
  FULL_SOURCE,
  MODES,
  openSource,
  PermBuilder,
  savedExtraConfig,
  slug,
  TYPES,
  type Mode,
  type PermType,
} from './helpers-perm';

/**
 * PERM scenario 2 — ROUND TRIP. Fully configured A (FULL_CONFIG / FULL_SOURCE) → B → back to A, all
 * 42 pairs, create + edit. Each step pins UI + data request; the save pins POST / PUT; `<key>-lost.json`
 * lists what differs after the round trip vs the original (UI controls, data request, saved
 * extra_config vs FULL_SOURCE) — i.e. what was lost / reset / added.
 * "control" tests pin that FULL_SOURCE (the edit sources) is what the create builder saves.
 */

const XY: PermType[] = ['bar', 'line', 'pie'];

/** [pinned] reasons for a round trip (each verified in the source; see `<key>-lost.json`). */
function pinned(mode: Mode, a: PermType, b: PermType): string | null {
  const reasons: string[] = [];
  if (XY.includes(a) && (b === 'number' || (mode === 'create' && b === 'map'))) {
    reasons.push(
      'X axis cleared on the way; auto-prefill runs once per type so it is not refilled → Save disabled'
    );
  }
  if (a === 'pivot_table' && b !== 'map') {
    reasons.push('pivot row/column dimensions reset to [] on the way back → Save disabled');
  }
  if (a === 'table')
    reasons.push('table dimensions come back as auto-prefill (id), not statename/districtname');
  if (mode === 'edit') {
    reasons.push(
      'edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost)'
    );
  }
  return reasons.length ? reasons.join('; ') : null;
}

for (const mode of MODES) {
  test.describe(`PERM-roundtrip-${mode}`, () => {
    for (const a of TYPES) {
      test(`PERM-roundtrip-${mode} ${a} control (no switch) saves FULL_SOURCE`, async ({
        page,
        api,
        track,
      }) => {
        const title = `PERM-roundtrip-${mode} ${a} control`;
        const p = new PermBuilder(page, mode, `rt-${mode}-${a}-control`);
        await openSource(p, { api, track }, a, title, 'full');
        await p.snap('configured', a);
        const saved = await p.save(track, e2eTitle(title));
        const extra = savedExtraConfig(saved.request);
        if (mode === 'create') {
          expect(extra).toEqual(FULL_SOURCE[a]);
        } else {
          expectDiffSnapshot(p.key, 'vs-source', diff(FULL_SOURCE[a], extra));
        }
      });

      for (const b of TYPES) {
        if (a === b) continue;
        const pin = pinned(mode, a, b);
        const title = `PERM-roundtrip-${mode} ${arrow([a, b, a])}`;
        test(`${pin ? '[pinned] ' : ''}${title}${pin ? ` — ${pin}` : ''}`, async ({
          page,
          api,
          track,
        }) => {
          // Pinned reason (if any): pinned() above
          const p = new PermBuilder(page, mode, `rt-${mode}-${slug([a, b, a])}`);
          await openSource(p, { api, track }, a, title, 'full');
          const start = await p.snap('configured', a);

          const there = await p.step('to', b, p.switchTo(b));
          expect(there.ui.type).toBe(b);
          const back = await p.step('back', a, p.switchTo(a));
          expect(back.ui.type).toBe(a);
          expect(back.ui.title).toBe(e2eTitle(title));

          const saved = await p.save(track, e2eTitle(title));
          expectDiffSnapshot(p.key, 'lost', {
            ui: diff(start.ui.controls, back.ui.controls),
            request: diff(start.current?.body, back.current?.body),
            saved: saved.request
              ? diff(FULL_SOURCE[a], savedExtraConfig(saved.request))
              : 'not saved',
          });
        });
      }
    }
  });
}
