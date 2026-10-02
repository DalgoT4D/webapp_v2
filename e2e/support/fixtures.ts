import { type Page, test as base, expect } from '@playwright/test';
import { type Resource, ApiClient } from './api-client';
import { type RoleName, e2eTitle, hasRole, ROLE_USERS, SEED } from './env';
import { flushJournal } from './journal';
import { EmailGuardError, installEmailGuard } from './email-guard';
import { flushInteractions, installInteractionRecorder, type Touched } from './interactions';

/**
 * Extended `test` for every authenticated spec:
 *   import { test, expect } from '../support/fixtures';
 *
 * - `api`     backend client (worker-scoped, reuses the logged-in session)
 * - `track`   register ids created during the test → deleted after it, even on failure
 * - `factory` fast API creation of e2e-* objects for tests that aren't about the create flow
 * - `pageAs`  a page logged in as another org role; skips the test when that role has no creds
 *             e.g. `const memberPage = await pageAs('member');`
 */

type Track = (resource: Resource, id: number) => void;

// Onboarding "Get Started" pill/panel is position:fixed over the bottom-right of every page:
// it covers pagers and builder previews and leaks into screenshots. Not under test here.
const HIDE_ONBOARDING_CSS = `
  [data-testid="getting-started-widget-pill"],
  [data-testid="getting-started-widget"] { visibility: hidden !important; pointer-events: none !important; }
`;

/**
 * Trial orgs show driver.js "feature nudge" popovers that intercept clicks at random moments,
 * plus a floating onboarding widget. Neutralize both so specs don't have to.
 */
export async function installUiGuards(page: Page) {
  await page.addInitScript((css) => {
    const inject = () => {
      const style = document.createElement('style');
      style.dataset.e2e = 'ui-guards';
      style.textContent = css;
      document.head.appendChild(style);
    };
    if (document.head) inject();
    else document.addEventListener('DOMContentLoaded', inject);
  }, HIDE_ONBOARDING_CSS);

  await page.addLocatorHandler(page.getByTestId('feature-nudge-dismiss-btn'), async (btn) => {
    await btn.click();
  });

  skipTokenExpiredResponses(page);
}

// Backend's "access token expired — refresh me" status (see lib/api.ts)
const TOKEN_EXPIRED_STATUS = 498;

/**
 * Runs outlast the 30-min access token. The app handles a 498 itself (refresh → retry the same
 * request), but a test waiting for "the next response" would receive the 498 and read its error
 * body. Make every `page.waitForResponse` skip 498s and keep waiting for the app's retry — works
 * for any predicate form (URL string / RegExp / function), in every spec, with no spec changes.
 */
function skipTokenExpiredResponses(page: Page) {
  const original = page.waitForResponse.bind(page);
  page.waitForResponse = (async (...args: Parameters<Page['waitForResponse']>) => {
    for (;;) {
      const res = await original(...args);
      if (res.status() !== TOKEN_EXPIRED_STATUS) return res;
    }
  }) as Page['waitForResponse'];
}

interface ChartSeed {
  id: number;
  title: string;
}

interface Factory {
  /** Bar chart on education mart: statename × SUM(students). */
  barChart(name?: string, overrides?: Record<string, unknown>): Promise<ChartSeed>;
  /** Empty native dashboard. */
  dashboard(name?: string): Promise<{ id: number; title: string }>;
}

interface TestFixtures {
  /** Auto: writes the test's snapshot journal (support/journal.ts) after it passes */
  snapshotJournal: void;
  /** Auto: email-triggering requests blocked in this test's pages (support/email-guard.ts) */
  blockedEmails: string[];
  /** Auto: testids this test interacted with, when E2E_RECORD_INTERACTIONS=on (support/interactions.ts) */
  touchedTestIds: Touched;
  track: Track;
  factory: Factory;
  pageAs: (role: RoleName) => Promise<Page>;
}

interface WorkerFixtures {
  api: ApiClient;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  blockedEmails: [
    async ({}, use) => {
      const blocked: string[] = [];
      await use(blocked);
      if (blocked.length) {
        const [method, path, ...rest] = blocked[0].split(' ');
        throw new EmailGuardError(method, path, `${rest.join(' ')} · ${blocked.length} blocked`);
      }
    },
    { auto: true },
  ],

  touchedTestIds: [
    async ({}, use, testInfo) => {
      const touched: Touched = new Map();
      await use(touched);
      flushInteractions(testInfo, touched);
    },
    { auto: true },
  ],

  // Context-level so popups / extra tabs of the default context are recorded too
  context: async ({ context, touchedTestIds }, use) => {
    await installInteractionRecorder(context, touchedTestIds);
    await use(context);
  },

  page: async ({ page, blockedEmails }, use) => {
    await installUiGuards(page);
    await installEmailGuard(page, blockedEmails);
    await use(page);
  },

  snapshotJournal: [
    async ({}, use) => {
      await use();
      flushJournal();
    },
    { auto: true },
  ],

  api: [
    async ({}, use) => {
      const api = await ApiClient.create();
      await use(api);
      await api.dispose();
    },
    { scope: 'worker' },
  ],

  track: async ({ api }, use) => {
    const created: Array<{ resource: Resource; id: number }> = [];
    await use((resource, id) => created.push({ resource, id }));
    // Reverse order: dashboards/reports before the charts they reference
    for (const { resource, id } of created.reverse()) {
      // Opening the builder takes an edit lock and the backend refuses (423) to delete a locked
      // dashboard; the browser's unload unlock doesn't reach the backend, so release it here
      if (resource === 'dashboards') {
        await api.delete(`/api/dashboards/${id}/lock/`).catch(() => {
          /* not locked */
        });
      }
      await api.deleteResource(resource, id).catch(() => {
        /* already deleted by the test itself */
      });
    }
  },

  factory: async ({ api, track }, use) => {
    await use({
      async barChart(name = 'bar', overrides = {}) {
        const title = e2eTitle(name);
        const { schema, table } = SEED.datasets.education;
        const chart = await api.post<ChartSeed>('/api/charts/', {
          title,
          chart_type: 'bar',
          computation_type: 'aggregated',
          schema_name: schema,
          table_name: table,
          extra_config: {
            dimension_column: 'statename',
            metrics: [{ column: 'students', aggregation: 'sum', alias: 'Students' }],
            customizations: { orientation: 'vertical', showTooltip: true },
            filters: [],
            sort: [],
            pagination: { enabled: false, page_size: 50 },
          },
          ...overrides,
        });
        track('charts', chart.id);
        return chart;
      },

      async dashboard(name = 'dashboard') {
        const title = e2eTitle(name);
        const dash = await api.post<{ id: number; title: string }>('/api/dashboards/', {
          title,
          grid_columns: 12,
        });
        track('dashboards', dash.id);
        return dash;
      },
    });
  },

  pageAs: async ({ browser, blockedEmails, touchedTestIds }, use, testInfo) => {
    const contexts: Array<Awaited<ReturnType<typeof browser.newContext>>> = [];
    await use(async (role) => {
      testInfo.skip(
        !hasRole(role),
        `no ${role} credentials in .env (E2E_${role.toUpperCase()}_EMAIL/PASSWORD)`
      );
      const { baseURL, viewport } = testInfo.project.use;
      const ctx = await browser.newContext({
        baseURL,
        viewport,
        reducedMotion: 'reduce',
        storageState: ROLE_USERS[role].statePath,
      });
      contexts.push(ctx);
      await installInteractionRecorder(ctx, touchedTestIds);
      const rolePage = await ctx.newPage();
      await installUiGuards(rolePage);
      await installEmailGuard(rolePage, blockedEmails);
      return rolePage;
    });
    for (const ctx of contexts) await ctx.close();
  },
});

export { expect };
