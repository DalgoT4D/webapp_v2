import { test, expect } from '../support/fixtures';
import { ApiClient } from '../support/api-client';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { expectChartScreenshot } from '../support/render';
import {
  BAR_TITLE,
  buildPublicDashboard,
  chartCell,
  parkMouse,
  relabel,
  selectMultiValues,
  SEED_WIDGETS,
  waitForViewChart,
} from './helpers-view';

/**
 * MATRIX §2.6 public side (D-S2..D-S5) — runs logged out in the `public` project.
 * Logged-out specs have no `factory`/`track`, so one e2e dashboard is created (and deleted)
 * per worker via ApiClient with the stored admin session.
 */

// The `public` project has no storageState, so `page` is logged out. beforeAll runs once per
// worker, so each worker gets its own public dashboard (no shared mutable state across workers).
let api: ApiClient;
let shared: Awaited<ReturnType<typeof buildPublicDashboard>>;

test.beforeAll(async () => {
  api = await ApiClient.create();
  shared = await buildPublicDashboard(api, 'public-share');
});

test.afterAll(async () => {
  if (shared) {
    await api.deleteResource('dashboards', shared.dashboardId).catch(() => {});
    await api.deleteResource('charts', shared.barChartId).catch(() => {});
  }
  await api?.dispose();
});

const labels = () => ({
  [shared.token]: '<token>',
  [shared.filterId]: '<state>',
  [shared.barChartId]: '<bar>',
  [SEED_WIDGETS.educationLineChart]: '<line>',
  [SEED_WIDGETS.menstrualBarChart]: '<other>',
  [SEED_WIDGETS.educationKpi]: '<kpi>',
});

test('D-S2 public link loads logged out: header, Read Only, charts, KPI', async ({ page }) => {
  await page.goto(`/share/dashboard/${shared.token}`);
  await expect(page.getByTestId('public-dashboard-header')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('public-dashboard-title')).toHaveText(shared.title);
  await expect(page.getByText('Public View')).toBeVisible();
  await expect(page.getByTestId('public-dashboard-read-only-badge')).toHaveText('Read Only');
  await expect(
    page.getByTestId('public-dashboard-header').getByText(/^Modified .+ ago$/)
  ).toBeVisible();

  // No logged-in chrome: no back/landing/share/edit
  await expect(page.getByTestId('dashboard-view-back-btn')).toHaveCount(0);
  await expect(page.getByTestId('dashboard-view-landing-trigger')).toHaveCount(0);
  await expect(page.getByTestId('dashboard-share-btn')).toHaveCount(0);
  await expect(page.getByTestId('dashboard-edit-btn')).toHaveCount(0);

  await expect(page.getByTestId(`kpi-card-${SEED_WIDGETS.educationKpi}`)).toBeVisible();
  const bar = await waitForViewChart(page, shared.barChartId);
  await waitForViewChart(page, SEED_WIDGETS.educationLineChart);
  await expect(bar.getByText(BAR_TITLE)).toBeVisible();
  // Public charts have no "View Chart" navigation
  await expect(page.getByTestId(`dashboard-chart-view-btn-${shared.barChartId}`)).toHaveCount(0);
  await parkMouse(page);
  await expectChartScreenshot(bar, 'public-bar-unfiltered');
});

test('D-S2 public filters start collapsed; apply refetches via public endpoints', async ({
  page,
}) => {
  await page.goto(`/share/dashboard/${shared.token}`);
  await waitForViewChart(page, shared.barChartId);

  const expand = page.getByTestId('dashboard-filter-panel-expand-btn');
  await expect(expand).toBeVisible();
  await expect(page.getByTestId('dashboard-filter-apply-btn')).toHaveCount(0);

  const options = page.waitForResponse((r) =>
    r.url().includes(`/api/v1/public/dashboards/${shared.token}/filters/preview/`)
  );
  await expand.click();
  await options;
  await selectMultiValues(page, shared.filterId, ['Assam', 'Karnataka']);

  const bar = captureRequest(page, {
    method: 'GET',
    url: new RegExp(
      `/api/v1/public/dashboards/[^/]+/charts/${shared.barChartId}/data\\?dashboard_filters=`
    ),
  });
  const kpi = captureRequest(page, {
    method: 'GET',
    url: new RegExp(
      `/api/v1/public/dashboards/[^/]+/kpis/${SEED_WIDGETS.educationKpi}/data/\\?dashboard_filters=`
    ),
  });
  await page.getByTestId('dashboard-filter-apply-btn').click();
  expectPayloadSnapshot(relabel(await bar, labels()), 'public-apply-bar');
  expectPayloadSnapshot(relabel(await kpi, labels()), 'public-apply-kpi');

  const cell = await waitForViewChart(page, shared.barChartId);
  await parkMouse(page);
  await expectChartScreenshot(cell, 'public-bar-filtered');
});

// Bug pinned: in public mode chart metadata comes from the public endpoint, but the CSV filename
// reads the private `chartMetadata` (never fetched logged out), so it falls back to chart_<id> (sanitized `chart-<id>`).
test('[pinned] D-S2 public CSV download → public endpoint, filename chart_<id>', async ({
  page,
}) => {
  await page.goto(`/share/dashboard/${shared.token}`);
  const cell = await waitForViewChart(page, shared.barChartId);

  await cell.hover();
  await page.getByTestId(`dashboard-chart-download-trigger-${shared.barChartId}`).click();
  const req = captureRequest(page, {
    method: 'POST',
    url: new RegExp(`/api/v1/public/dashboards/[^/]+/charts/${shared.barChartId}/download-csv/`),
  });
  const download = page.waitForEvent('download');
  await page.getByTestId(`dashboard-chart-download-csv-${shared.barChartId}`).click();
  expectPayloadSnapshot(relabel(await req, labels()), 'public-download-csv');
  expect((await download).suggestedFilename()).toMatch(
    new RegExp(`^chart_${shared.barChartId}-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}\\.csv$`)
  );
});

test('D-S3 embed mode (dark, title + org, padding): no header, no filters', async ({ page }) => {
  await page.goto(
    `/share/dashboard/${shared.token}?embed=true&title=true&org=true&theme=dark&padding=true`
  );
  const embedHeader = page.getByTestId('public-dashboard-embed-header');
  await expect(embedHeader).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('public-dashboard-embed-title')).toHaveText(shared.title);
  await expect(page.getByTestId('public-dashboard-embed-org')).not.toBeEmpty();
  // dark theme: bg-gray-800 header (Tailwind v4 oklch), white title
  await expect(embedHeader).toHaveCSS('background-color', 'oklch(0.278 0.033 256.848)');
  await expect(page.getByTestId('public-dashboard-embed-title')).toHaveCSS(
    'color',
    'rgb(255, 255, 255)'
  );

  await expect(page.getByTestId('public-dashboard-header')).toHaveCount(0);
  await expect(page.getByTestId('dashboard-filters-panel')).toHaveCount(0);
  await expect(page.getByTestId('dashboard-filter-panel-expand-btn')).toHaveCount(0);
  await waitForViewChart(page, shared.barChartId);
});

test('D-S3 embed mode without title/org hides the embed header', async ({ page }) => {
  await page.goto(
    `/share/dashboard/${shared.token}?embed=true&title=false&org=false&theme=light&padding=false`
  );
  await waitForViewChart(page, shared.barChartId);
  await expect(page.getByTestId('public-dashboard-embed-header')).toHaveCount(0);
  await expect(page.getByTestId('public-dashboard-header')).toHaveCount(0);
  await expect(chartCell(page, shared.barChartId)).toBeVisible();
});

test('D-S3 embed mode with only org shows org, not title (light)', async ({ page }) => {
  await page.goto(`/share/dashboard/${shared.token}?embed=true&title=false&org=true`);
  const embedHeader = page.getByTestId('public-dashboard-embed-header');
  await expect(embedHeader).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('public-dashboard-embed-title')).toHaveCount(0);
  await expect(page.getByTestId('public-dashboard-embed-org')).toBeVisible();
  await expect(embedHeader).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('D-S4 invalid token → "Dashboard Not Found" with sign-in link', async ({ page }) => {
  await page.goto('/share/dashboard/e2e-invalid-token-does-not-exist');
  const notFound = page.getByTestId('public-dashboard-not-found');
  await expect(notFound).toBeVisible({ timeout: 30_000 });
  await expect(notFound.getByRole('heading', { name: 'Dashboard Not Found' })).toBeVisible();
  await expect(page.getByTestId('public-dashboard-sign-in-btn')).toHaveText('Sign in to Dalgo');
  await expect(page.getByTestId('public-dashboard-learn-more-btn')).toContainText(
    'Learn about Dalgo'
  );
  await page.getByTestId('public-dashboard-sign-in-btn').click();
  await expect(page).toHaveURL(/\/login/);
});

// Bug pinned: the legacy route renders DashboardNativeView with dashboardId=0 and no data, so
// useDashboard(0) never fetches and the loading skeleton stays forever.
test('[pinned] D-S5 legacy /public/dashboard/<token> never finishes loading', async ({ page }) => {
  const dataRequests: string[] = [];
  page.on('request', (r) => {
    if (/\/api\/(v1\/public\/)?(dashboards|charts)\//.test(r.url())) dataRequests.push(r.url());
  });
  await page.goto(`/public/dashboard/${shared.token}`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(shared.title)).toHaveCount(0);
  await expect(page.getByTestId('public-dashboard-header')).toHaveCount(0);
  await expect(page.getByText('Dashboard Not Found')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(dataRequests).toEqual([]);
});
