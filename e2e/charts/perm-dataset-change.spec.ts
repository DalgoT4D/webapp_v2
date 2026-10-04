import { test, expect } from '../support/fixtures';
import { e2eTitle } from '../support/env';
import {
  diff,
  expectDiffSnapshot,
  FULL_SOURCE,
  MATERNAL,
  MATERNAL_FULL_NAME,
  MODES,
  openSource,
  PermBuilder,
  savedExtraConfig,
  SHORT,
  TYPES,
} from './helpers-perm';

/**
 * PERM scenario 4 — DATASET CHANGE. Fully configured chart of each type on the education mart →
 * Data Source = production.mart_health_maternal_risk, create + edit. handleDatasetChange
 * (ChartDataConfigurationV3 L253 / MapDataConfigurationV3) keeps title, type and customizations and
 * resets the data fields; auto-prefill then re-runs for the new table.
 * `<key>-reset.json` = what differs after the change vs the configured chart (UI, request, saved).
 */

/** [pinned] per type (both builders; verified in the source). */
const PINNED: Partial<Record<(typeof TYPES)[number], string>> = {
  map: 'map handleDatasetChange clears the state column and auto-prefill does not refill it → Save disabled',
  table:
    'table dimensions blanked + metrics emptied with no re-prefill; table_columns of the old dataset are kept and saved',
};

for (const mode of MODES) {
  test.describe(`PERM-dataset-${mode}`, () => {
    for (const type of TYPES) {
      const title = `PERM-dataset-${mode} ${SHORT[type]} education → maternal`;
      const pin = PINNED[type];
      test(`${pin ? '[pinned] ' : ''}${title}${pin ? ` — ${pin}` : ''}`, async ({
        page,
        api,
        track,
      }) => {
        const p = new PermBuilder(page, mode, `dataset-${mode}-${SHORT[type]}`);
        await openSource(p, { api, track }, type, title, 'full');
        const before = await p.snap('configured', type);

        const after = await p.step('dataset', type, () =>
          p.setDataset(MATERNAL_FULL_NAME, MATERNAL.table)
        );
        // Title and type always survive a dataset change
        expect(after.ui.type).toBe(type);
        expect(after.ui.title).toBe(e2eTitle(title));
        expect(after.ui.controls['chart-dataset-select-input']).toBe(MATERNAL_FULL_NAME);

        const saved = await p.save(track, e2eTitle(title));
        expectDiffSnapshot(p.key, 'reset', {
          ui: diff(before.ui.controls, after.ui.controls),
          request: diff(before.current?.body, after.current?.body),
          saved: saved.request
            ? diff(FULL_SOURCE[type], savedExtraConfig(saved.request))
            : 'not saved',
        });
      });
    }
  });
}
