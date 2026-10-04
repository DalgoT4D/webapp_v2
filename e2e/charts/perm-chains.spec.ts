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
  type PermType,
} from './helpers-perm';

/**
 * PERM scenario 3 — CHAINS. Multi-hop switches from a fully configured start of every type, back to
 * the start type, create + edit. Each hop pins UI + data request; the save pins POST / PUT;
 * `<key>-lost.json` = what differs at the end vs the configured start.
 */

/**
 * [pinned] chains that end with Save disabled: a hop through number/map clears the X axis (auto-prefill
 * runs once per type, so it is not refilled) or a hop into pivot resets its row/column dimensions.
 */
const SAVE_DISABLED: Record<string, string[]> = {
  create: [
    'bar-line-pie-number-table-map-pivot-bar',
    'bar-map-pivot-bar',
    'line-table-map-line',
    'pie-number-pivot-pie',
    'pivot-line-number-pivot',
  ],
  edit: [
    'bar-line-pie-number-table-map-pivot-bar',
    'bar-map-pivot-bar',
    'pie-number-pivot-pie',
    'pivot-line-number-pivot',
  ],
};

const CHAINS: PermType[][] = [
  ['table', 'bar', 'pie', 'table'],
  ['pivot_table', 'line', 'number', 'pivot_table'],
  ['map', 'bar', 'table', 'map'],
  ['number', 'pie', 'line', 'number'],
  ['bar', 'map', 'pivot_table', 'bar'],
  ['line', 'table', 'map', 'line'],
  ['pie', 'number', 'pivot_table', 'pie'],
  // every type in one go
  ['bar', 'line', 'pie', 'number', 'table', 'map', 'pivot_table', 'bar'],
];

for (const mode of MODES) {
  test.describe(`PERM-chains-${mode}`, () => {
    for (const chain of CHAINS) {
      const title = `PERM-chains-${mode} ${arrow(chain)}`;
      const pin = SAVE_DISABLED[mode].includes(slug(chain));
      test(`${pin ? '[pinned] ' : ''}${title}${pin ? ' — ends with Save disabled' : ''}`, async ({
        page,
        api,
        track,
      }) => {
        const [start] = chain;
        const p = new PermBuilder(page, mode, `chain-${mode}-${slug(chain)}`);
        await openSource(p, { api, track }, start, title, 'full');
        const first = await p.snap('configured', start);

        let last = first;
        for (const [i, type] of chain.slice(1).entries()) {
          last = await p.step(`hop${i + 1}-${type}`, type, p.switchTo(type));
          expect(last.ui.type).toBe(type);
        }
        expect(last.ui.title).toBe(e2eTitle(title));

        const saved = await p.save(track, e2eTitle(title));
        expect(saved.request === null).toBe(pin);
        expectDiffSnapshot(p.key, 'lost', {
          ui: diff(first.ui.controls, last.ui.controls),
          request: diff(first.current?.body, last.current?.body),
          saved: saved.request
            ? diff(FULL_SOURCE[start], savedExtraConfig(saved.request))
            : 'not saved',
        });
      });
    }
  });
}
