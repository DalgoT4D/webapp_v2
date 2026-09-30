import { test, expect } from '../support/fixtures';
import { ORG_SLUG, SEED } from '../support/env';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { expectChartScreenshot } from '../support/render';
import {
  buildFilterDashboard,
  collectRequests,
  filterPanel,
  makePublic,
  normalizeEmbed,
  openView,
  parkMouse,
  relabel,
  SEED_412,
  selectMultiValues,
  setGeneralAccess,
  viewTitle,
  waitForViewChart,
} from './helpers-view';
import { fetchForRewrite } from '../support/routes';

/**
 * MATRIX §2.5 View mode (D-V1..D-V9) + view-only permission rows.
 * Seed 411/412: viewing, filtering in the UI (unsaved) and exporting only.
 */

const { health, education } = SEED.dashboards;

async function isFullscreen(page: import('@playwright/test').Page) {
  return page.evaluate(() => document.fullscreenElement !== null);
}

async function exitFullscreen(page: import('@playwright/test').Page) {
  // Esc exits native fullscreen at the browser level, which Playwright's keyboard can't reach
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => isFullscreen(page)).toBe(false);
}

test.describe('dashboard view — seed dashboards', () => {
  test('D-V1 seed 412 renders header, tabs, filters, KPIs and charts', async ({ page }) => {
    await openView(page, education);
    await expect(viewTitle(page, 'Education Program dashboard')).toBeVisible();
    await expect(page.getByText(/Updated by /).locator('visible=true')).toBeVisible();
    await expect(page.getByText(/^Modified .+ ago$/).locator('visible=true')).toBeVisible();

    await expect(page.getByTestId('dashboard-tab-bar')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Impact/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByRole('tab', { name: /Reach/ })).toBeVisible();

    const panel = filterPanel(page);
    await expect(panel.getByText('2 filters', { exact: true })).toBeVisible();
    await expect(page.getByTestId(`dashboard-filter-${SEED_412.statenameFilter}`)).toBeVisible();
    await expect(
      page.getByTestId(`dashboard-filter-datetime-${SEED_412.dateFilter}`)
    ).toBeVisible();

    for (const kpi of [443, 441, 445])
      await expect(page.getByTestId(`kpi-card-${kpi}`)).toBeVisible();
    await expect(page.getByText('Monitor learning outcomes, gender gaps')).toBeVisible();

    const line = await waitForViewChart(page, SEED_412.lineChart);
    await waitForViewChart(page, 1244);
    await parkMouse(page);
    await expectChartScreenshot(line, 'seed-412-learning-scores-line');
  });

  test('D-V1 seed 411 renders header, five tabs, filters and KPIs', async ({ page }) => {
    await openView(page, health);
    await expect(viewTitle(page, 'Health Sector Program Dashboard')).toBeVisible();
    await expect(page.getByTestId('dashboard-tab-bar').getByRole('tab')).toHaveCount(5);
    await expect(filterPanel(page).getByText('2 filters', { exact: true })).toBeVisible();
    for (const kpi of [449, 447, 448])
      await expect(page.getByTestId(`kpi-card-${kpi}`)).toBeVisible();

    // Second tab holds charts 1247 + 1260
    await page.getByTestId('dashboard-tab-bar').getByRole('tab').nth(1).click();
    await expect(page.getByTestId('kpi-card-446')).toBeVisible();
    await waitForViewChart(page, 1247);
  });

  test('D-V2 charts are not filtered until Apply', async ({ page }) => {
    await openView(page, education);
    await waitForViewChart(page, SEED_412.lineChart);
    await page.waitForLoadState('networkidle');

    const filtered = collectRequests(page, /dashboard_filters=/);
    await selectMultiValues(page, SEED_412.statenameFilter, ['Assam']);
    await page.waitForLoadState('networkidle');
    expect(filtered).toHaveLength(0);

    const line = captureRequest(page, {
      method: 'GET',
      url: new RegExp(`/api/charts/${SEED_412.lineChart}/data/\\?dashboard_filters=`),
    });
    await page.getByTestId('dashboard-filter-apply-btn').click();
    expectPayloadSnapshot(
      relabel(await line, {
        [SEED_412.statenameFilter]: '<state>',
        [SEED_412.dateFilter]: '<date>',
        [SEED_412.lineChart]: '<line>',
      }),
      'seed-412-apply-state-line'
    );
  });

  test('D-V3 chart toolbar: download PNG and CSV (with dashboard_filters)', async ({ page }) => {
    await openView(page, education);
    const cell = await waitForViewChart(page, SEED_412.lineChart);
    const id = SEED_412.lineChart;

    await cell.hover();
    await page.getByTestId(`dashboard-chart-download-trigger-${id}`).click();
    const png = page.waitForEvent('download');
    await page.getByTestId(`dashboard-chart-download-png-${id}`).click();
    expect((await png).suggestedFilename()).toMatch(
      /^learning-scores-over-time-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.png$/
    );
    await expect(page.getByText('Chart downloaded successfully')).toBeVisible();

    await expect(page.getByTestId(`dashboard-chart-download-png-${id}`)).toBeHidden();
    await cell.hover();
    await page.getByTestId(`dashboard-chart-download-trigger-${id}`).click();
    await expect(page.getByTestId(`dashboard-chart-download-csv-${id}`)).toBeVisible();
    const csvReq = captureRequest(page, { method: 'POST', url: '/api/charts/download-csv/' });
    const csv = page.waitForEvent('download');
    await page.getByTestId(`dashboard-chart-download-csv-${id}`).click();
    expectPayloadSnapshot(await csvReq, 'seed-412-line-download-csv');
    expect((await csv).suggestedFilename()).toMatch(
      /^learning_scores_over_time-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/
    );
  });

  test('D-V3 chart toolbar: CSV export carries applied dashboard_filters', async ({ page }) => {
    await openView(page, education);
    const cell = await waitForViewChart(page, SEED_412.lineChart);
    await selectMultiValues(page, SEED_412.statenameFilter, ['Odisha']);
    const refetch = page.waitForResponse((r) =>
      r.url().includes(`/api/charts/${SEED_412.lineChart}/data/?dashboard_filters=`)
    );
    await page.getByTestId('dashboard-filter-apply-btn').click();
    await refetch;
    await waitForViewChart(page, SEED_412.lineChart);

    await cell.hover();
    await page.getByTestId(`dashboard-chart-download-trigger-${SEED_412.lineChart}`).click();
    const csvReq = captureRequest(page, { method: 'POST', url: '/api/charts/download-csv/' });
    const csv = page.waitForEvent('download');
    await page.getByTestId(`dashboard-chart-download-csv-${SEED_412.lineChart}`).click();
    expectPayloadSnapshot(
      relabel(await csvReq, {
        [SEED_412.statenameFilter]: '<state>',
        [SEED_412.dateFilter]: '<date>',
      }),
      'seed-412-line-download-csv-filtered'
    );
    await csv;
  });

  test('D-V3 chart toolbar: View Chart navigates with ?from=dashboard', async ({ page }) => {
    await openView(page, education);
    const cell = await waitForViewChart(page, SEED_412.lineChart);
    await cell.hover();
    await page.getByTestId(`dashboard-chart-view-btn-${SEED_412.lineChart}`).click();
    await expect(page).toHaveURL(new RegExp(`/charts/${SEED_412.lineChart}\\?from=dashboard$`));
  });

  test('D-V3 chart toolbar: fullscreen overlay shows the chart title', async ({ page }) => {
    await openView(page, education);
    const cell = await waitForViewChart(page, SEED_412.lineChart);
    await cell.hover();
    await page.getByTestId(`dashboard-chart-fullscreen-btn-${SEED_412.lineChart}`).click();
    await expect.poll(() => isFullscreen(page)).toBe(true);
    // Title moves from the title row (hidden) into the centred overlay
    await expect(
      cell.getByText('Learning scores over time', { exact: true }).locator('visible=true')
    ).toHaveCount(1);
    await expect(cell.getByRole('heading', { name: 'Learning scores over time' })).toBeHidden();
    await exitFullscreen(page);
  });

  test('D-V4 KPI card: download PNG/CSV, fullscreen, view', async ({ page }) => {
    await openView(page, education);
    const card = page.getByTestId(`kpi-card-${SEED_412.kpi}`);
    await expect(card).toBeVisible();
    // TODO testid: KPICard toolbar buttons + menu items have titles/text only (kpi-card.tsx:252,259,265,276)
    const download = card.getByTitle('Download');
    await expect(download).toBeAttached({ timeout: 30_000 });

    await card.hover();
    await download.click();
    const png = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Download as PNG' }).click();
    expect((await png).suggestedFilename()).toBe(`kpi-${SEED_412.kpiTitle}.png`);

    // Reopening while the previous menu is still animating closed toggles it shut again
    await expect(page.getByRole('menu')).toBeHidden();
    await card.hover();
    await download.click();
    await expect(page.getByRole('menuitem', { name: 'Export Data as CSV' })).toBeVisible();
    const csv = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Export Data as CSV' }).click();
    expect((await csv).suggestedFilename()).toBe(`kpi-${SEED_412.kpiTitle}.csv`);

    await card.hover();
    await card.getByTitle('Fullscreen').click();
    await expect.poll(() => isFullscreen(page)).toBe(true);
    await exitFullscreen(page);

    await card.hover();
    await page.getByTestId(`dashboard-kpi-view-btn-${SEED_412.kpi}`).click();
    await expect(page).toHaveURL(new RegExp(`/kpis\\?open=${SEED_412.kpi}&from=dashboard$`));
  });

  test('D-V5 dashboard fullscreen toggles the Fullscreen API', async ({ page }) => {
    await openView(page, education);
    await page.getByTestId('dashboard-view-fullscreen-btn').click();
    await expect.poll(() => isFullscreen(page)).toBe(true);
    // Back is hidden while fullscreen
    await expect(page.getByTestId('dashboard-view-back-btn')).toBeHidden();
    await exitFullscreen(page);
    await expect(page.getByTestId('dashboard-view-back-btn')).toBeVisible();
  });

  test('D-V8 embed code is only offered for public dashboards', async ({ page }) => {
    await openView(page, education);
    await expect(page.getByTestId('dashboard-view-fullscreen-btn')).toBeVisible();
    await expect(page.getByTestId('dashboard-embed-trigger')).toHaveCount(0);
  });
});

test.describe('dashboard view — e2e dashboards', () => {
  test('D-V6 landing dropdown: set and remove my landing page', async ({ page, api, factory }) => {
    const dash = await factory.dashboard('v6-landing');
    const before =
      await api.get<Array<{ org: { slug: string }; landing_dashboard_id: number | null }>>(
        '/api/currentuserv2'
      );
    const originalLanding =
      before.find((o) => o.org.slug === ORG_SLUG)?.landing_dashboard_id ?? null;
    try {
      await openView(page, dash.id);
      const trigger = page.getByTestId('dashboard-view-landing-trigger');
      await expect(trigger).toHaveText('Set Landing');

      await trigger.click();
      const setReq = captureRequest(page, {
        method: 'POST',
        url: `/api/dashboards/landing-page/set-personal/${dash.id}`,
      });
      await page.getByTestId('dashboard-view-landing-set').click();
      expectPayloadSnapshot(await setReq, 'landing-set-personal');
      await expect(trigger).toHaveText('My Landing');

      await trigger.click();
      const removeReq = captureRequest(page, {
        method: 'DELETE',
        url: '/api/dashboards/landing-page/remove-personal',
      });
      await page.getByTestId('dashboard-view-landing-remove').click();
      expectPayloadSnapshot(await removeReq, 'landing-remove-personal');
      await expect(trigger).toHaveText('Set Landing');
    } finally {
      // Restore whatever the admin had before (null on staging)
      if (originalLanding) {
        await api.post(`/api/dashboards/landing-page/set-personal/${originalLanding}`);
      } else {
        await api.delete('/api/dashboards/landing-page/remove-personal').catch(() => {});
      }
    }
  });

  test('D-V7 Edit Dashboard opens the builder; share button opens the modal', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('v7-edit');
    await openView(page, dash.id);
    await expect(viewTitle(page, dash.title)).toBeVisible();

    await page.getByTestId('dashboard-share-btn').click();
    await expect(page.getByTestId('share-modal')).toBeVisible();
    await page.getByTestId('share-close-btn').click();
    await expect(page.getByTestId('share-modal')).toBeHidden();

    await page.getByTestId('dashboard-edit-btn').click();
    await expect(page).toHaveURL(new RegExp(`/dashboards/${dash.id}/edit$`));
    await expect(page.getByTestId('dashboard-save-btn')).toBeVisible({ timeout: 30_000 });
  });

  // Bug pinned: GET /api/dashboards/<id>/ never returns public_share_token, so the embed dropdown
  // (rendered only when that field is set, view:1265) never appears — even on a public dashboard.
  test('[pinned] D-V8 embed code trigger is missing even on a public dashboard', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('v8-embed-missing');
    await makePublic(dash.id);
    const detail = page.waitForResponse((r) => r.url().endsWith(`/api/dashboards/${dash.id}/`));
    await openView(page, dash.id);
    const body = (await (await detail).json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty('public_share_token');
    await expect(page.getByTestId('dashboard-view-fullscreen-btn')).toBeVisible();
    await expect(page.getByTestId('dashboard-embed-trigger')).toHaveCount(0);
  });

  test('D-V8 embed code: options change the snippet, copy puts it on the clipboard', async ({
    page,
    context,
    factory,
    baseURL,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const dash = await factory.dashboard('v8-embed');
    const token = await makePublic(dash.id);
    // The detail API omits public_share_token (see [pinned] test above); inject the real token so
    // the embed generator itself stays covered.
    await page.route(`**/api/dashboards/${dash.id}/`, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const res = await fetchForRewrite(route);
      if (!res) return;
      const json = (await res.json()) as Record<string, unknown>;
      await route.fulfill({ response: res, json: { ...json, public_share_token: token } });
    });
    await openView(page, dash.id);

    // Rendered in both the mobile and desktop headers
    await page.getByTestId('dashboard-embed-trigger').locator('visible=true').click();
    const menu = page.getByTestId('dashboard-embed-menu');
    await expect(menu).toBeVisible();
    const textarea = page.getByTestId('dashboard-embed-code-textarea');
    const origin = new URL(baseURL!).origin;
    const snippet = async () =>
      normalizeEmbed(await textarea.inputValue(), origin, token, dash.title);

    expect(await snippet()).toMatchSnapshot('embed-code-default.txt');

    await page.getByTestId('dashboard-embed-show-title-switch').click();
    await page.getByTestId('dashboard-embed-show-org-switch').click();
    await page.getByTestId('dashboard-embed-show-padding-switch').click();
    await page.getByTestId('dashboard-embed-theme-select').selectOption('dark');
    await page.getByTestId('dashboard-embed-width-input').fill('1000');
    await page.getByTestId('dashboard-embed-height-input').fill('700');
    expect(await snippet()).toMatchSnapshot('embed-code-custom.txt');

    // Empty / invalid size falls back to 800 × 600
    await page.getByTestId('dashboard-embed-width-input').fill('');
    await expect(textarea).toHaveValue(/width="800"/);

    const copy = page.getByTestId('dashboard-embed-copy-btn');
    await copy.click();
    await expect(copy).toHaveText('Copied!');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe(await textarea.inputValue());
    await expect(copy).toHaveText('Copy Embed Code', { timeout: 5_000 });
  });

  test('D-V9 empty dashboard shows "No Dashboard Components"', async ({ page, factory }) => {
    const dash = await factory.dashboard('v9-empty');
    await openView(page, dash.id);
    const empty = page.getByTestId('dashboard-view-empty-state');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('No Dashboard Components');
    await expect(empty).toContainText("This dashboard doesn't have any components configured yet.");
    // No filters → no filter sidebar in view mode
    await expect(filterPanel(page)).toHaveCount(0);
  });

  test('D-V1 e2e dashboard renders KPI + charts from its saved layout', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'v1-layout');
    await openView(page, dash.id);
    await expect(page.getByTestId(`kpi-card-${dash.kpiId}`)).toBeVisible();
    const bar = await waitForViewChart(page, dash.barChartId);
    await waitForViewChart(page, dash.lineChartId);
    await waitForViewChart(page, dash.otherChartId);
    await expect(bar.getByText('Students by State')).toBeVisible();
    // No filters, no tab bar (single tab)
    await expect(page.getByTestId('dashboard-tab-bar')).toHaveCount(0);
    await parkMouse(page);
    await expectChartScreenshot(bar, 'e2e-bar-unfiltered');
  });
});

test.describe('dashboard view — permissions', () => {
  test('D-P1 member on seed dashboard: view-only, request-edit pill, no edit/share', async ({
    pageAs,
  }) => {
    const page = await pageAs('member');
    await openView(page, education);
    await expect(page.getByTestId('request-edit-pill').locator('visible=true')).toBeVisible();
    await expect(page.getByTestId('request-edit-pill').locator('visible=true')).toHaveText(
      /Request Edit/
    );
    await expect(page.getByTestId('dashboard-edit-btn')).toHaveCount(0);
    await expect(page.getByTestId('dashboard-share-btn')).toHaveCount(0);
  });

  test('D-P2 member cannot open the builder of a view-only dashboard', async ({ pageAs }) => {
    const page = await pageAs('member');
    await page.goto(`/dashboards/${education}/edit`);
    await expect(page.getByText('You have view-only access to this dashboard.')).toBeVisible({
      timeout: 30_000,
    });
  });

  test('D-P3 analyst on a private e2e dashboard sees the no-access screen', async ({
    pageAs,
    factory,
  }) => {
    const page = await pageAs('analyst');
    const dash = await factory.dashboard('p3-private');
    await setGeneralAccess(dash.id, 'private');
    await page.goto(`/dashboards/${dash.id}`);
    await expect(page.getByTestId('no-access')).toBeVisible({ timeout: 30_000 });
  });
});
