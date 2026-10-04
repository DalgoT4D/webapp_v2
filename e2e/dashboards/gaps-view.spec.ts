import { test, expect } from '../support/fixtures';
import { ROLE_USERS } from '../support/env';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import {
  chartCell,
  chartDataUrl,
  createFilter,
  filterElement,
  FILTERS,
  openView,
  putWidgets,
  relabel,
  waitForViewChart,
} from './helpers-view';
import { putTabs } from './helpers-builder';
import { numberChartOverrides, roleApi } from './helpers-gaps-view';

/**
 * GAP-D — "Dashboard view mode" rows of coverage/FEATURES.md that had no test yet.
 * Superset dashboard view (Share / Refresh / Open in Superset) is not covered: the e2e org has
 * no Superset (`viz_url` is null), so only the no-Superset fallbacks are pinned here.
 */

const TABLET_VIEWPORT = { width: 1100, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
// Far above any real dashboard id on staging
const MISSING_DASHBOARD_ID = 999999999;

test.describe('GAP-D view header', () => {
  test('GAP-D view header shows the "Published" badge and the description', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await factory.dashboard('gap-v-published');
    await api.put(`/api/dashboards/${dash.id}/`, {
      description: 'Quarterly outcomes for the e2e suite',
      is_published: true,
    });
    await openView(page, dash.id);
    await expect(
      page.getByText('Published', { exact: true }).locator('visible=true')
    ).toBeVisible();
    await expect(page.getByTestId('dashboard-description')).toHaveText(
      'Quarterly outcomes for the e2e suite'
    );
    await expect(page.getByText(/^Locked by/)).toHaveCount(0);
  });

  test('GAP-D view header shows "Locked by you" while my own edit lock is held', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await factory.dashboard('gap-v-locked-me');
    await api.post(`/api/dashboards/${dash.id}/lock/`, {}); // released by the track cleanup
    await openView(page, dash.id);
    await expect(page.getByText('Locked by you', { exact: true })).toBeVisible();
    // My own lock doesn't hide Edit
    await expect(page.getByTestId('dashboard-edit-btn')).toBeVisible();
  });

  test('GAP-D Edit Dashboard is hidden and "Locked by <user>" shown while another user edits', async ({
    page,
    factory,
    pageAs,
  }) => {
    await pageAs('analyst'); // skips without analyst creds
    const dash = await factory.dashboard('gap-v-locked-other');
    const analyst = await roleApi('analyst');
    try {
      await analyst.post(`/api/dashboards/${dash.id}/lock/`, {});
      await openView(page, dash.id);
      await expect(
        page.getByText(`Locked by ${ROLE_USERS.analyst.email}`, { exact: true })
      ).toBeVisible();
      await expect(page.getByTestId('dashboard-edit-btn')).toHaveCount(0);
      // Share still works (it only needs edit access, not the lock)
      await expect(page.getByTestId('dashboard-share-btn')).toBeVisible();
    } finally {
      await analyst.delete(`/api/dashboards/${dash.id}/lock/`).catch(() => {});
      await analyst.dispose();
    }
  });

  test('GAP-D Back button returns to the dashboard list', async ({ page, factory }) => {
    const dash = await factory.dashboard('gap-v-back');
    await openView(page, dash.id);
    await page.getByTestId('dashboard-view-back-btn').click();
    await expect(page).toHaveURL('/dashboards');
  });
});

test.describe('GAP-D view widgets', () => {
  test('GAP-D number chart toolbar offers PNG but no CSV export', async ({
    page,
    api,
    factory,
  }) => {
    const chart = await factory.barChart('gap-v-number', numberChartOverrides());
    const dash = await factory.dashboard('gap-v-number');
    await putWidgets(api, dash.id, [
      {
        id: 'chart-e2e-number',
        type: 'chart',
        config: { chartId: chart.id, chartType: 'number' },
        layout: { x: 0, y: 0, w: 6, h: 12 },
      },
    ]);
    await openView(page, dash.id);
    const cell = chartCell(page, chart.id);
    await expect(cell).toBeVisible({ timeout: 30_000 });

    await cell.hover();
    await page.getByTestId(`dashboard-chart-download-trigger-${chart.id}`).click();
    await expect(page.getByTestId(`dashboard-chart-download-png-${chart.id}`)).toBeVisible();
    await expect(page.getByTestId(`dashboard-chart-download-csv-${chart.id}`)).toHaveCount(0);
  });

  test('GAP-D "Chart Error" card: Retry refetches and renders the chart', async ({
    page,
    api,
    factory,
  }) => {
    const chart = await factory.barChart('gap-v-retry');
    const dash = await factory.dashboard('gap-v-retry');
    await putWidgets(api, dash.id, [
      {
        id: 'chart-e2e-retry',
        type: 'chart',
        config: { chartId: chart.id, chartType: 'bar' },
        layout: { x: 0, y: 0, w: 8, h: 17 },
      },
    ]);
    // "not found" in the message stops SWR's automatic retries, so only Retry can refetch
    let failing = true;
    await page.route(chartDataUrl(chart.id), (route) =>
      failing
        ? route.fulfill({ status: 404, json: { detail: 'e2e chart data not found' } })
        : route.fallback()
    );
    await page.goto(`/dashboards/${dash.id}`);
    const retry = page.getByTestId(`dashboard-chart-retry-btn-${chart.id}`);
    await expect(retry).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Chart Error')).toBeVisible();
    await expect(
      page.getByText('Please check the dataset or metrics selected and try again')
    ).toBeVisible();

    failing = false;
    const refetch = captureRequest(page, { method: 'GET', url: chartDataUrl(chart.id) });
    await retry.click();
    expectPayloadSnapshot(
      relabel(await refetch, { [chart.id]: '<bar>' }),
      'gap-chart-retry-refetch'
    );
    await waitForViewChart(page, chart.id);
    await expect(retry).toHaveCount(0);
  });

  test('GAP-D old "heading" and "filter" widget types still render in view mode', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await factory.dashboard('gap-v-legacy');
    const filter = await createFilter(api, dash.id, FILTERS.stateSingle());
    await putTabs(api, dash, [
      {
        id: 'tab-1700000000001',
        title: 'Main',
        layout_config: [
          { i: 'heading-1700000000051', x: 0, y: 0, w: 12, h: 4 },
          { i: 'filter-1700000000052', x: 0, y: 4, w: 6, h: 8 },
        ],
        components: {
          'heading-1700000000051': {
            id: 'heading-1700000000051',
            type: 'heading',
            config: { text: 'Legacy section heading', level: 2 },
          },
          'filter-1700000000052': {
            id: 'filter-1700000000052',
            type: 'filter',
            config: { filterId: filter.id },
          },
        },
      },
    ]);
    await openView(page, dash.id);
    await expect(
      page.getByRole('heading', { level: 2, name: 'Legacy section heading' })
    ).toBeVisible();
    // Same filter twice: the sidebar panel and the legacy in-canvas widget
    await expect(filterElement(page, filter.id)).toHaveCount(2);
    await expect(page.getByText(/^Filter not found/)).toHaveCount(0);
  });
});

test.describe('GAP-D view responsive actions', () => {
  test('GAP-D tablet (<1200px) actions menu: Share Dashboard and Edit Dashboard', async ({
    page,
    factory,
  }) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    const dash = await factory.dashboard('gap-v-tablet-menu');
    await openView(page, dash.id);
    // Desktop buttons are replaced by the kebab menu
    await expect(page.getByTestId('dashboard-share-btn')).toHaveCount(0);
    await expect(page.getByTestId('dashboard-edit-btn')).toHaveCount(0);

    const trigger = page.getByTestId('dashboard-actions-menu-trigger');
    await expect(trigger).toHaveAccessibleName('Dashboard actions');
    await trigger.click();
    await expect(page.getByTestId('dashboard-actions-share-item')).toHaveText('Share Dashboard');
    await page.getByTestId('dashboard-actions-share-item').click();
    await expect(page.getByTestId('share-modal')).toBeVisible();
    await page.getByTestId('share-close-btn').click();
    await expect(page.getByTestId('share-modal')).toBeHidden();

    await trigger.click();
    await expect(page.getByTestId('dashboard-actions-edit-item')).toHaveText('Edit Dashboard');
    await page.getByTestId('dashboard-actions-edit-item').click();
    await expect(page).toHaveURL(`/dashboards/${dash.id}/edit`);
    await expect(page.getByTestId('dashboard-filter-add-btn')).toBeVisible({ timeout: 30_000 });
  });

  test('GAP-D mobile actions menu: Share Dashboard and Edit Dashboard', async ({
    page,
    factory,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    const dash = await factory.dashboard('gap-v-mobile-menu');
    await page.goto(`/dashboards/${dash.id}`);
    await expect(page.getByTestId('dashboard-view-back-btn-mobile')).toBeVisible({
      timeout: 30_000,
    });

    const trigger = page.getByTestId('dashboard-actions-menu-trigger-mobile');
    await trigger.click();
    await page.getByTestId('dashboard-actions-share-item-mobile').click();
    await expect(page.getByTestId('share-modal')).toBeVisible();
    await page.getByTestId('share-close-btn').click();
    await expect(page.getByTestId('share-modal')).toBeHidden();

    await trigger.click();
    await page.getByTestId('dashboard-actions-edit-item-mobile').click();
    await expect(page).toHaveURL(`/dashboards/${dash.id}/edit`);
  });
});

test.describe('GAP-D view not found / Superset fallback', () => {
  test('GAP-D native "Dashboard Not Found" when the open dashboard is deleted meanwhile', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await factory.dashboard('gap-v-deleted');
    await openView(page, dash.id);
    await api.deleteResource('dashboards', dash.id);

    let detailStatus = 0;
    page.on('response', (r) => {
      if (r.url().endsWith(`/api/dashboards/${dash.id}/`) && r.request().method() === 'GET') {
        detailStatus = r.status();
      }
    });
    // A network reconnect revalidates the dashboard (SWR revalidateOnReconnect). SWR dedupes
    // revalidations within 2s of the last fetch, so keep signalling until the refetch happens.
    await expect
      .poll(async () => {
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
        return detailStatus;
      })
      .toBe(404);
    await expect(page.getByRole('heading', { name: 'Dashboard Not Found' })).toBeVisible();
    await page.getByTestId('dashboard-view-not-found-back-btn').click();
    await expect(page).toHaveURL('/dashboards');
  });

  // Pinned: a 404 on the native API falls through to the Superset view even for an org without
  // Superset, so an unknown id ends on the Superset "Error Loading Dashboard" card.
  test('[pinned] GAP-D unknown dashboard id falls back to the Superset view error', async ({
    page,
  }) => {
    const superset = page.waitForResponse((r) =>
      r.url().includes(`/api/superset/dashboards/${MISSING_DASHBOARD_ID}/`)
    );
    await page.goto(`/dashboards/${MISSING_DASHBOARD_ID}`);
    expect((await superset).ok()).toBe(false);
    await expect(page.getByRole('heading', { name: 'Error Loading Dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dashboard Not Found' })).toHaveCount(0);
    await page.getByTestId('superset-dashboard-error-back-btn').click();
    await expect(page).toHaveURL('/dashboards');
  });

  test('GAP-D usage dashboard without Superset says the org is not subscribed', async ({
    page,
  }) => {
    await page.goto('/dashboards/usage');
    await expect(page.getByRole('heading', { name: 'Usage Dashboard' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole('heading', { name: 'You have not subscribed to Superset for Visualisation.' })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'support@dalgo.org' })).toHaveAttribute(
      'href',
      'mailto:support@dalgo.org'
    );
  });
});
