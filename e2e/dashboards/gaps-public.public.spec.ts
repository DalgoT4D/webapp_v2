import { test, expect } from '../support/fixtures';
import { ApiClient } from '../support/api-client';
import { e2eTitle } from '../support/env';
import {
  buildPublicDashboard,
  chartCell,
  makePublic,
  parkMouse,
  waitForViewChart,
} from './helpers-view';
import { FIXED_IDS, putTabs, textComponent } from './helpers-builder';
import { rewriteJson } from './helpers-gaps-view';

/**
 * GAP-D — "Public dashboard link and embed" rows of coverage/FEATURES.md that had no test yet.
 * Logged out (`public` project). Objects are created per worker with the stored admin session,
 * as in share-dashboard.public.spec.ts.
 */

// Tailwind `p-4` on the embed container
const EMBED_PADDING_PX = 16;

let api: ApiClient;
let shared: Awaited<ReturnType<typeof buildPublicDashboard>>;
let tabbed: { id: number; token: string };

test.beforeAll(async () => {
  api = await ApiClient.create();
  shared = await buildPublicDashboard(api, 'gap-public');
  const dash = await api.post<{ id: number; title: string }>('/api/dashboards/', {
    title: e2eTitle('gap-public-tabs'),
    grid_columns: 12,
  });
  await putTabs(api, dash, [
    {
      id: FIXED_IDS.tab1,
      title: 'Overview',
      layout_config: [{ i: FIXED_IDS.text1, x: 0, y: 0, w: 6, h: 4 }],
      components: { [FIXED_IDS.text1]: textComponent(FIXED_IDS.text1, 'First tab text') },
    },
    {
      id: FIXED_IDS.tab2,
      title: 'Details',
      layout_config: [],
      components: {},
    },
  ]);
  tabbed = { id: dash.id, token: await makePublic(dash.id) };
});

test.afterAll(async () => {
  if (shared) {
    await api.deleteResource('dashboards', shared.dashboardId).catch(() => {});
    await api.deleteResource('charts', shared.barChartId).catch(() => {});
  }
  if (tabbed) await api.deleteResource('dashboards', tabbed.id).catch(() => {});
  await api?.dispose();
});

test('GAP-D public chart PNG download and chart fullscreen', async ({ page }) => {
  await page.goto(`/share/dashboard/${shared.token}`);
  const cell = await waitForViewChart(page, shared.barChartId);
  const id = shared.barChartId;
  const chartTitle = e2eTitle('gap-public-bar');

  await cell.hover();
  await page.getByTestId(`dashboard-chart-download-trigger-${id}`).click();
  const png = page.waitForEvent('download');
  await page.getByTestId(`dashboard-chart-download-png-${id}`).click();
  // Public mode names the file from the public chart metadata (unlike CSV — see D-S2 [pinned])
  expect((await png).suggestedFilename()).toMatch(
    new RegExp(`^${chartTitle}-\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}\\.png$`)
  );
  await expect(page.getByText('Chart downloaded successfully')).toBeVisible();

  await parkMouse(page);
  await cell.hover();
  await page.getByTestId(`dashboard-chart-fullscreen-btn-${id}`).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
  // Title moves into the centred fullscreen overlay
  await expect(chartCell(page, id).getByText(chartTitle, { exact: true })).toBeVisible();
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(false);
});

test('GAP-D embed padding on adds a 16px inset, off removes it', async ({ page }) => {
  await page.goto(`/share/dashboard/${shared.token}?embed=true&title=true&org=false&padding=true`);
  const header = page.getByTestId('public-dashboard-embed-header');
  await expect(header).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await header.boundingBox())!.x).toBe(EMBED_PADDING_PX);

  await page.goto(`/share/dashboard/${shared.token}?embed=true&title=true&org=false&padding=false`);
  await expect(header).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await header.boundingBox())!.x).toBe(0);
});

test('GAP-D embed mode hides the tab bar and shows the "Powered by Dalgo" footer', async ({
  page,
}) => {
  // Public link (not embedded): tabs, no footer
  await page.goto(`/share/dashboard/${tabbed.token}`);
  await expect(page.getByTestId('public-dashboard-header')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('dashboard-tab-bar')).toBeVisible();
  await expect(page.getByRole('tab', { name: /Details/ })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toHaveCount(0);

  await page.goto(`/share/dashboard/${tabbed.token}?embed=true`);
  await expect(page.getByText('First tab text')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('dashboard-tab-bar')).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(0);
  const footer = page.getByRole('contentinfo');
  await expect(footer).toHaveText('Powered by Dalgo');
  await expect(footer.getByRole('link', { name: 'Dalgo' })).toHaveAttribute(
    'href',
    'https://dalgo.org/'
  );
});

// Bug pinned: PublicDashboardView defines an ErrorBoundary ("ERROR in DashboardNativeView: …")
// but never mounts it, so a crash in the dashboard body takes down the whole page and the root
// app/global-error.tsx fallback is shown instead. Crash produced by a filter row without an id.
test('[pinned] GAP-D public page crash shows the global "Something went wrong!" page', async ({
  page,
}) => {
  await rewriteJson(page, `**/api/v1/public/dashboards/${shared.token}/`, (json) => ({
    ...json,
    filters: [{ ...((json.filters as Array<Record<string, unknown>>)[0] ?? {}), id: null }],
  }));
  await page.goto(`/share/dashboard/${shared.token}`);
  await expect(page.getByRole('heading', { name: 'Something went wrong!' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByText(/ERROR in DashboardNativeView/)).toHaveCount(0);
  await expect(page.getByTestId('public-dashboard-header')).toHaveCount(0);
});
