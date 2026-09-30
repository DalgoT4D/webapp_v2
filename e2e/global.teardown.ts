import { test as teardown } from '@playwright/test';
import { type Resource, ApiClient } from './support/api-client';
import { E2E_PREFIX, RUN_ID } from './support/env';

// Order matters: containers first, then the widgets they reference
const SWEEP_ORDER: Resource[] = ['reports', 'dashboards', 'charts', 'kpis', 'metrics'];

// Runs older than this are considered crashed/abandoned; younger ones may still be in progress
const STALE_RUN_MS = 3 * 60 * 60 * 1000;

// Titles look like e2e-<runId>-<name>; runId is Date.now() in base36 (see playwright.config.ts).
// Duplicated objects get "Copy of " prepended (possibly repeatedly).
const RUN_ID_PATTERN = new RegExp(`^(?:Copy of )*${E2E_PREFIX}([0-9a-z]+)-`);

/** This run's objects, or any run old enough to be abandoned. Never another live run's objects. */
function isSweepable(title: string): boolean {
  const match = RUN_ID_PATTERN.exec(title);
  if (!match) return false;
  if (match[1] === RUN_ID) return true;
  const startedAt = parseInt(match[1], 36);
  return Number.isFinite(startedAt) && Date.now() - startedAt > STALE_RUN_MS;
}

/** Safety net: remove e2e-* objects left behind by this run or by crashed/interrupted runs. */
teardown('sweep e2e objects', async () => {
  const api = await ApiClient.create();
  try {
    // The backend refuses (423) to delete a dashboard still locked by a builder session
    for (const dash of await api.list('dashboards')) {
      if (isSweepable(dash.title ?? '')) {
        await api.delete(`/api/dashboards/${dash.id}/lock/`).catch(() => {
          /* not locked */
        });
      }
    }
    for (const resource of SWEEP_ORDER) {
      const count = await api.sweep(resource, isSweepable);
      if (count) console.log(`[teardown] removed ${count} leftover ${resource}`);
    }
  } finally {
    await api.dispose();
  }
});
