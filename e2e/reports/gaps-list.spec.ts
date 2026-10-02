import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { ROLE_USERS } from '../support/env';
import {
  createReport,
  createReportDashboard,
  dismissFeatureNudges,
  setListFilter,
  toast,
  waitForListQuery,
} from './helpers';
import { failRoute, grantReport, holdRoute } from './helpers-gaps';
import { fetchForRewrite } from '../support/routes';

/**
 * Reports list (`/reports`) gaps. Nothing here counts org-wide totals — every assertion is
 * scoped to rows this test created (title filter) or to a mocked list response.
 */

// GET /api/reports/ with or without the filter query (never /api/reports/<id>/…)
const LIST_URL = /\/api\/reports\/(\?.*)?$/;
const CURRENT_USER_URL = /\/api\/currentuserv2$/;
const FLAGS_URL = /\/api\/organizations\/flags$/;
// app/reports/page.tsx FILTER_DEBOUNCE_MS
const FILTER_DEBOUNCE_MS = 400;
// Keystroke gap well under the debounce, so a non-debounced list would fire once per key
const KEYSTROKE_DELAY_MS = 60;
// The unfiltered list is org-wide and slow on a busy staging backend (render.ts budget)
const LIST_LOAD_TIMEOUT_MS = 30_000;
// Slack for timer granularity + React commit between the debounce firing and the fetch call
const TIMER_SLACK_MS = 50;

interface ListRow {
  id: number;
  dashboard_title?: string | null;
  created_by?: string | null;
}

/** Route the list GET only (lets the create-POST and everything else through). */
async function routeList(page: Page, handler: Parameters<Page['route']>[1]) {
  await page.route(LIST_URL, (route, request) =>
    request.method() === 'GET' ? handler(route, request) : route.fallback()
  );
}

/** Drop permission slugs from the org user the app loads (frontend RBAC reads it). */
async function withoutPermissions(page: Page, slugs: string[]) {
  await page.route(CURRENT_USER_URL, async (route) => {
    const res = await fetchForRewrite(route);
    if (!res) return;
    const body = (await res.json()) as Array<{ permissions: Array<{ slug: string }> }>;
    for (const orgUser of body) {
      orgUser.permissions = orgUser.permissions.filter((p) => !slugs.includes(p.slug));
    }
    await route.fulfill({ response: res, json: body });
  });
}

test.describe('reports list — gaps', () => {
  // Shared staging backend under parallel load: these multi-request flows need the 3x budget
  test.slow();

  test.beforeEach(async ({ page }) => {
    await dismissFeatureNudges(page);
  });

  test('[pinned] GAP-R list failed load shows "No reports yet" instead of an error', async ({
    page,
  }) => {
    // Every list GET fails (SWR retries too) — nothing reaches the real list
    await routeList(page, failRoute);
    await page.goto('/reports');
    // Pinned: useSnapshots maps an error to `snapshots: []`, and the page has no error branch,
    // so a backend failure reads exactly like an org with no reports
    await expect(page.getByTestId('report-list-empty')).toHaveText('No reports yet');
    await expect(page.getByTestId('create-first-report-btn')).toBeVisible();
    await expect(page.getByTestId('report-list-skeleton')).toHaveCount(0);
    // …and no error toast either
    await expect(toast(page, /fail|error/i)).toHaveCount(0);
    await expect(page.getByTestId('report-list-item-count')).toHaveText('0–0 of 0');
  });

  test('GAP-R list empty state "No reports yet" with a create button', async ({ page }) => {
    // Staging always has seed reports → an empty org is simulated with an empty list response
    await routeList(page, (route) =>
      route.fulfill({ status: 200, json: { success: true, data: [] } })
    );
    await page.goto('/reports');
    await expect(page.getByTestId('report-list-empty')).toHaveText('No reports yet');
    // The table (and its no-match row) is not rendered at all
    await expect(page.getByTestId('report-list-no-match')).toHaveCount(0);
    await expect(page.getByTestId('report-list-sort-title')).toHaveCount(0);
    const createFirst = page.getByTestId('create-first-report-btn');
    await expect(createFirst).toHaveText('CREATE YOUR FIRST REPORT');
    await createFirst.click();
    await expect(page.getByTestId('create-snapshot-dialog')).toBeVisible();
    await page.getByTestId('snapshot-cancel-btn').click();
    await expect(page.getByTestId('create-snapshot-dialog')).toBeHidden();
  });

  test('GAP-R list loading skeleton while the list loads', async ({ page }) => {
    const hold = await holdRoute(page, LIST_URL);
    await page.goto('/reports');
    await hold.held;
    await expect(page.getByTestId('report-list-skeleton')).toBeVisible();
    await expect(page.getByTestId('report-list-empty')).toHaveCount(0);
    hold.release();
    await expect(page.getByTestId('report-list-skeleton')).toHaveCount(0);
    await expect(page.getByTestId('report-list-sort-title')).toBeVisible();
  });

  test('GAP-R list filter waits 400ms after typing: one request with the final value', async ({
    page,
  }) => {
    // Timestamps are taken inside the page (last keystroke vs. list fetch start) so a slow
    // test-runner ↔ browser round trip can't distort the measured delay
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, number>;
      document.addEventListener('input', () => (w.__e2eLastInput = performance.now()), true);
      const originalFetch = window.fetch;
      window.fetch = (...args) => {
        const url = args[0] instanceof Request ? args[0].url : String(args[0]);
        if (url.includes('/api/reports/?') && url.includes('search=')) {
          w.__e2eSearchFetch = performance.now();
        }
        return originalFetch(...args);
      };
    });
    await page.goto('/reports');
    await expect(page.getByTestId('report-list-sort-title')).toBeVisible({
      timeout: LIST_LOAD_TIMEOUT_MS,
    });

    const searched: string[] = [];
    page.on('request', (r) => {
      if (r.method() !== 'GET' || !LIST_URL.test(r.url())) return;
      const search = new URL(r.url()).searchParams.get('search');
      if (search !== null) searched.push(search);
    });
    const value = 'zz-debounce-probe';
    await page.getByTestId('report-filter-title-trigger').click();
    const request = page.waitForRequest((r) => {
      if (r.method() !== 'GET' || !LIST_URL.test(r.url())) return false;
      return new URL(r.url()).searchParams.get('search') === value;
    });
    await page.getByTestId('report-filter-title').pressSequentially(value, {
      delay: KEYSTROKE_DELAY_MS,
    });
    await request;
    // The debounce timer restarted on every keystroke → nothing was sent until 400ms after the last
    const delay = await page.evaluate(() => {
      const w = window as unknown as Record<string, number>;
      return w.__e2eSearchFetch - w.__e2eLastInput;
    });
    expect(delay).toBeGreaterThanOrEqual(FILTER_DEBOUNCE_MS - TIMER_SLACK_MS);
    await expect(page.getByTestId('report-list-no-match')).toBeVisible();
    // No request for any intermediate prefix
    expect(searched).toEqual([value]);
  });

  test('GAP-R list row: missing dashboard shows "—"; creator email shown (only when present)', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'gaps-list-cells' });
    const noDash = await createReport(api, track, {
      name: 'gaps-list-cells-a',
      dashboardId: dash.dashboardId,
    });
    const noCreator = await createReport(api, track, {
      name: 'gaps-list-cells-b',
      dashboardId: dash.dashboardId,
    });
    // Every real report carries its frozen dashboard title and creator; blank them in the
    // response to reach the fallbacks (legacy / deleted-user rows)
    await routeList(page, async (route) => {
      const res = await fetchForRewrite(route);
      if (!res) return;
      const body = (await res.json()) as { data: ListRow[] };
      for (const row of body.data) {
        if (row.id === noDash.id) row.dashboard_title = null;
        if (row.id === noCreator.id) row.created_by = null;
      }
      await route.fulfill({ response: res, json: body });
    });

    await page.goto('/reports');
    const prefix = noDash.title.replace(/-a$/, '-');
    const loaded = waitForListQuery(page, 'search', prefix);
    await setListFilter(page, 'title', prefix);
    await loaded;

    await expect(page.getByTestId(`report-row-dashboard-${noDash.id}`)).toHaveText('—');
    await expect(page.getByTestId(`report-row-created-by-${noDash.id}`)).toHaveText(
      ROLE_USERS.admin.email!
    );
    await expect(page.getByTestId(`report-row-dashboard-${noCreator.id}`)).toHaveText(
      dash.dashboardTitle
    );
    // No creator → the whole avatar + email block is omitted
    // TODO testid: the avatar circle itself has no testid, only the email span
    await expect(page.getByTestId(`report-row-created-by-${noCreator.id}`)).toHaveCount(0);
  });

  test('GAP-R Reports nav item is shown for this org (REPORTS flag on) and hidden when the flag is off', async ({
    page,
  }) => {
    await page.goto('/charts');
    const nav = page.getByRole('link', { name: 'Reports', exact: true });
    await expect(nav).toBeVisible();
    await nav.click();
    await expect(page).toHaveURL(/\/reports$/);

    // Same page with the flag off (mocked — the org's real flags are left alone)
    await page.route(FLAGS_URL, async (route) => {
      const res = await fetchForRewrite(route);
      if (!res) return;
      const flags = (await res.json()) as Record<string, boolean>;
      await route.fulfill({ response: res, json: { ...flags, REPORTS: false } });
    });
    // The item is also hidden while flags are still loading, so "hidden" only means something
    // once the app has consumed the flags body: mark that moment from inside the page
    await page.addInitScript((flagsPath) => {
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const res = await originalFetch(...args);
        const url = args[0] instanceof Request ? args[0].url : String(args[0]);
        if (url.includes(flagsPath)) {
          const readJson = res.json.bind(res);
          res.json = async () => {
            const body = await readJson();
            // After the app's own continuation (SWR cache write) has run
            setTimeout(
              () => ((window as unknown as Record<string, boolean>).__e2eFlagsRead = true)
            );
            return body;
          };
        }
        return res;
      };
    }, '/api/organizations/flags');
    await page.goto('/charts');
    await page.waitForFunction(() => (window as unknown as Record<string, boolean>).__e2eFlagsRead);
    // Two frames → the re-render triggered by the flags has been committed
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
    );
    await expect(page.getByRole('link', { name: 'Charts', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reports', exact: true })).toHaveCount(0);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('GAP-R list Create hidden without create permission; Delete hidden without delete permission', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'gaps-list-rbac' });
    const report = await createReport(api, track, {
      name: 'gaps-list-rbac-rep',
      dashboardId: dash.dashboardId,
    });
    // Every staging role has both permissions → remove them from the loaded org user
    await withoutPermissions(page, ['can_create_dashboards', 'can_delete_dashboards']);

    await page.goto('/reports');
    const loaded = waitForListQuery(page, 'search', report.title);
    await setListFilter(page, 'title', report.title);
    await loaded;
    await expect(page.getByTestId(`report-row-${report.id}`)).toBeVisible();
    await expect(page.getByTestId('create-report-btn')).toHaveCount(0);

    // Edit access on the report itself is intact → share + email stay, delete goes
    await expect(page.getByTestId(`report-share-${report.id}`)).toBeVisible();
    await page.getByTestId(`report-actions-${report.id}`).click();
    await expect(page.getByTestId(`report-view-${report.id}`)).toBeVisible();
    await expect(page.getByTestId(`report-email-pdf-${report.id}`)).toBeVisible();
    await expect(page.getByTestId(`report-delete-${report.id}`)).toHaveCount(0);
    await page.keyboard.press('Escape');

    // Empty state has its own create button — hidden too
    await routeList(page, (route) =>
      route.fulfill({ status: 200, json: { success: true, data: [] } })
    );
    await page.goto('/reports');
    await expect(page.getByTestId('report-list-empty')).toBeVisible();
    await expect(page.getByTestId('create-first-report-btn')).toHaveCount(0);
  });
});

test.describe('reports list — other roles', () => {
  // Shared staging backend under parallel load: these multi-request flows need the 3x budget
  test.slow();

  test('GAP-R list view-only member: Create shown (role permission), no Share / Email PDF / Delete on a view-only report @sends-email', async ({
    pageAs,
    api,
    track,
    factory,
  }) => {
    const member = await pageAs('member');
    await dismissFeatureNudges(member);
    const dash = await createReportDashboard(api, factory, { name: 'gaps-list-member' });
    const report = await createReport(api, track, {
      name: 'gaps-list-member-rep',
      dashboardId: dash.dashboardId,
    });
    await grantReport(api, report.id, 'member', 'view');

    await member.goto('/reports');
    const loaded = waitForListQuery(member, 'search', report.title);
    await setListFilter(member, 'title', report.title);
    await loaded;
    await expect(member.getByTestId(`report-row-title-${report.id}`)).toHaveText(report.title);
    // Member role has can_create_dashboards on staging → Create is shown
    await expect(member.getByTestId('create-report-btn')).toBeVisible();
    // …but the report is view-only for them: no share icon, and the menu only has View
    await expect(member.getByTestId(`report-share-${report.id}`)).toHaveCount(0);
    await member.getByTestId(`report-actions-${report.id}`).click();
    await expect(member.getByTestId(`report-view-${report.id}`)).toBeVisible();
    await expect(member.getByTestId(`report-email-pdf-${report.id}`)).toHaveCount(0);
    await expect(member.getByTestId(`report-delete-${report.id}`)).toHaveCount(0);
  });

  test('GAP-R list analyst with an Edit grant: Share, Email PDF and Delete all shown @sends-email', async ({
    pageAs,
    api,
    track,
    factory,
  }) => {
    const analyst = await pageAs('analyst');
    await dismissFeatureNudges(analyst);
    const dash = await createReportDashboard(api, factory, { name: 'gaps-list-analyst' });
    const report = await createReport(api, track, {
      name: 'gaps-list-analyst-rep',
      dashboardId: dash.dashboardId,
    });
    await grantReport(api, report.id, 'analyst', 'edit');

    await analyst.goto('/reports');
    const loaded = waitForListQuery(analyst, 'search', report.title);
    await setListFilter(analyst, 'title', report.title);
    await loaded;
    await expect(analyst.getByTestId('create-report-btn')).toBeVisible();
    await expect(analyst.getByTestId(`report-share-${report.id}`)).toBeVisible();
    await analyst.getByTestId(`report-actions-${report.id}`).click();
    await expect(analyst.getByTestId(`report-email-pdf-${report.id}`)).toBeVisible();
    // Analyst role has can_delete_dashboards + Edit access on the report
    await expect(analyst.getByTestId(`report-delete-${report.id}`)).toBeVisible();
  });
});
