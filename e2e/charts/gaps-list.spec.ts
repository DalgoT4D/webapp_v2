import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import { e2eTitle, ORG_SLUG, SEED } from '../support/env';
import { type CapturedRequest, captureRequest, expectPayloadSnapshot } from '../support/payload';
import { expectChartScreenshot } from '../support/render';
import {
  ALL_CHART_TYPES,
  createChart,
  filterListByName,
  listRow,
  openListFilteredByName,
  openRowMenu,
  redactIds,
  setListPageSize,
} from './helpers-core';
import { failRequests, holdRequests, withoutPermissions } from './helpers-gaps';
import { fetchForRewrite } from '../support/routes';

/**
 * FEATURES.md gap list › Charts — chart list (`/charts`) and create step 1 (`/charts/new`).
 * Titles start with `GAP-C` so they map back to the checklist lines.
 */

// GET /api/charts/?page=…&page_size=… (the list query), not /api/charts/<id>/…
const LIST_URL = /\/api\/charts\/\?page=\d+&page_size=\d+$/;
const SYNC_TABLES_URL = /\/api\/warehouse\/sync_tables(\?.*)?$/;
const WAREHOUSES_URL = /\/api\/organizations\/warehouses(\?.*)?$/;
const USER_PREFERENCES_URL = /\/api\/userpreferences\/(\?.*)?$/;
const FORCED_ERROR = 'e2e forced failure';
const EDU_FULL_NAME = `${SEED.datasets.education.schema}.${SEED.datasets.education.table}`;

/** /charts without relying on the Create button (hidden in the permission tests). */
async function gotoList(page: Page) {
  const resp = page.waitForResponse(
    (r) => r.request().method() === 'GET' && LIST_URL.test(r.url())
  );
  await page.goto('/charts');
  await resp;
  await expect(page.locator('#charts-page-info')).toBeVisible();
}

/** Mouse off every hover style (star, filter icon) before a screenshot. */
async function parkMouse(page: Page) {
  await page.mouse.move(1, 1);
}

test.describe('charts list — gaps', () => {
  test('GAP-C list row type icon + tooltip for every chart type', async ({ page, api, track }) => {
    const charts = await Promise.all(
      ALL_CHART_TYPES.map((type) => createChart(api, track, type, `gap-icon-${type}`))
    );
    await openListFilteredByName(page, e2eTitle('gap-icon-'));
    for (const [i, type] of ALL_CHART_TYPES.entries()) {
      const chart = charts[i];
      // Name | Data Source | Type | … — TODO testid: the type icon cell has none
      const typeCell = listRow.row(page, chart.id).getByRole('cell').nth(2);
      await typeCell.locator('svg').hover();
      // Tooltip text is `${chart_type} Chart`, capitalized with CSS only
      await expect(page.getByRole('tooltip')).toHaveText(`${type} Chart`);
      // Pointer-leave alone doesn't always close it (Radix grace area); Escape dismisses it
      await parkMouse(page);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('tooltip')).toHaveCount(0);
      // [pinned] pivot_table has no chartIcons entry → falls back to the bar icon (pivot colours)
      await expectChartScreenshot(typeCell, `gap-list-type-icon-${type}`);
    }
  });

  test('GAP-C list loading skeleton while the list request is in flight', async ({ page }) => {
    const gate = await holdRequests(page, LIST_URL, 'GET');
    await page.goto('/charts');
    // TODO testid: the loading table has none; Skeleton renders data-slot="skeleton"
    const skeletons = page.locator('[data-slot="skeleton"]');
    await expect(skeletons.first()).toBeVisible();
    // 8 skeleton rows × 9 skeleton cells + 9 header skeletons (app/charts/page.tsx loading table)
    expect(await skeletons.count()).toBeGreaterThan(8);
    await expect(page.locator('[data-testid^="chart-list-title-link-"]')).toHaveCount(0);
    expect(gate.held()).toBeGreaterThan(0);
    gate.release();
    await expect(page.locator('[data-testid^="chart-list-title-link-"]').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(skeletons).toHaveCount(0);
  });

  test('GAP-C list error state "Failed to load charts" and Retry reloads', async ({ page }) => {
    await failRequests(page, LIST_URL, { method: 'GET' });
    await page.goto('/charts');
    await expect(page.getByText('Failed to load charts')).toBeVisible();
    const retry = page.getByTestId('chart-list-retry-btn');
    await expect(retry).toHaveText('Retry');
    await expect(page.getByTestId('charts-create-btn')).toHaveCount(0);

    // Backend healthy again → Retry (window.location.reload) brings the list back
    await page.unroute(LIST_URL);
    const resp = page.waitForResponse(
      (r) => r.request().method() === 'GET' && LIST_URL.test(r.url())
    );
    await retry.click();
    expect((await resp).ok()).toBe(true);
    await expect(page.getByTestId('charts-create-btn')).toBeVisible();
    await expect(page.getByText('Failed to load charts')).toHaveCount(0);
  });

  test('GAP-C list teal active dot on a filtered column header', async ({ page, factory }) => {
    const chart = await factory.barChart('gap-dot');
    await gotoList(page);
    await setListPageSize(page, 100);
    const trigger = page.getByTestId('chart-list-filter-name-trigger');
    await parkMouse(page);
    await expectChartScreenshot(trigger, 'gap-list-filter-dot-inactive');

    await filterListByName(page, chart.title);
    await expect(listRow.titleLink(page, chart.id)).toBeVisible();
    await parkMouse(page);
    // Active: icon turns teal and a teal dot sits on its top-right corner
    await expectChartScreenshot(trigger, 'gap-list-filter-dot-active');
    // Other (unfiltered) columns keep the grey icon
    await expectChartScreenshot(
      page.getByTestId('chart-list-filter-type-trigger'),
      'gap-list-filter-dot-inactive-type'
    );
  });

  test('GAP-C list empty state "No charts yet" for an org with no charts', async ({ page }) => {
    await page.route(LIST_URL, (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({
            status: 200,
            json: { data: [], total: 0, page: 1, page_size: 10, total_pages: 0 },
          })
        : route.fallback()
    );
    await page.goto('/charts');
    await expect(page.locator('#charts-empty-state')).toBeVisible();
    await expect(page.locator('#charts-empty-text')).toHaveText('No charts yet');
    const create = page.getByTestId('charts-empty-create-btn');
    await expect(create).toHaveText('CREATE YOUR FIRST CHART');
    await create.click();
    await expect(page).toHaveURL(/\/charts\/new$/);
  });

  test('GAP-C list favorite failure rolls the star back and shows a toast', async ({
    page,
    factory,
    api,
  }) => {
    const chart = await factory.barChart('gap-fav-fail');
    const favUrl = `/api/charts/${chart.id}/favorite/`;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(`**${favUrl}`, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      await gate;
      await route.fulfill({ status: 500, json: { detail: FORCED_ERROR } });
    });

    await openListFilteredByName(page, chart.title);
    const star = listRow.favorite(page, chart.id);
    await parkMouse(page);
    await expectChartScreenshot(star, 'gap-list-favorite-off');

    const req = captureRequest(page, { method: 'POST', url: favUrl });
    await star.click();
    expectPayloadSnapshot(await req, 'gap-list-favorite-fail-request');
    // Optimistic flip while the request is in flight; button locked
    await expect(star).toBeDisabled();
    await parkMouse(page);
    await expectChartScreenshot(star, 'gap-list-favorite-on');

    release();
    await expect(page.getByText(FORCED_ERROR)).toBeVisible();
    await expect(star).toBeEnabled();
    await parkMouse(page);
    await expectChartScreenshot(star, 'gap-list-favorite-off');
    const saved = await api.get<{ is_favorite?: boolean }>(`/api/charts/${chart.id}/`);
    expect(saved.is_favorite ?? false).toBe(false);
  });

  test('GAP-C list bulk delete falls back to one DELETE per chart when bulk fails', async ({
    page,
    api,
    track,
  }) => {
    const [a, b] = await Promise.all(
      ['gap-bulkfb-a', 'gap-bulkfb-b'].map((n) => createChart(api, track, 'bar', n))
    );
    await failRequests(page, '**/api/charts/bulk-delete/', { method: 'POST' });
    await openListFilteredByName(page, e2eTitle('gap-bulkfb-'));
    await expect(page.locator('[data-testid^="chart-list-title-link-"]')).toHaveCount(2);

    await openRowMenu(page, a.id);
    await page.getByTestId(`chart-list-row-menu-select-${a.id}`).click();
    await page.getByTestId(`chart-select-checkbox-${b.id}`).click();
    await page.getByTestId('chart-list-bulk-delete-btn').click();
    await expect(page.getByTestId('chart-bulk-delete-confirm')).toBeVisible();

    const deletes: CapturedRequest[] = [];
    page.on('request', (r) => {
      const path = new URL(r.url()).pathname;
      if (r.method() === 'DELETE' && /^\/api\/charts\/\d+\/$/.test(path)) {
        deletes.push({ method: 'DELETE', path, query: {}, body: null });
      }
    });
    const bulk = captureRequest(page, { method: 'POST', url: '/api/charts/bulk-delete/' });
    await page.getByTestId('chart-bulk-delete-confirm-confirm-btn').click();
    expectPayloadSnapshot(
      redactIds(await bulk, { chartA: a.id, chartB: b.id }),
      'gap-list-bulk-delete-fallback-bulk'
    );
    await expect(page.getByText('2 charts deleted successfully')).toBeVisible();
    expect(deletes.map((d) => d.path).sort()).toEqual(
      [`/api/charts/${a.id}/`, `/api/charts/${b.id}/`].sort()
    );
    await expect(page.locator('#charts-selection-bar')).toBeHidden();
    await expect(listRow.titleLink(page, a.id)).toBeHidden();
    await expect(listRow.titleLink(page, b.id)).toBeHidden();
  });

  test('GAP-C list without create/delete permission hides Create, Duplicate and Delete', async ({
    page,
    factory,
  }) => {
    const chart = await factory.barChart('gap-perm-cd');
    await withoutPermissions(page, ['can_create_charts', 'can_delete_charts']);
    await gotoList(page);
    await setListPageSize(page, 100);
    await filterListByName(page, chart.title);
    await expect(listRow.titleLink(page, chart.id)).toHaveAttribute('href', `/charts/${chart.id}`);
    await expect(page.getByTestId('charts-create-btn')).toHaveCount(0);

    await openRowMenu(page, chart.id);
    await expect(page.getByTestId(`chart-list-row-menu-duplicate-${chart.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`chart-list-row-menu-delete-${chart.id}`)).toHaveCount(0);
    // Select (and Export, which needs view) stay
    await page.getByTestId(`chart-list-row-menu-select-${chart.id}`).click();
    await expect(page.locator('#charts-selection-bar')).toBeVisible();
    await expect(page.getByTestId('chart-list-bulk-delete-btn')).toHaveCount(0);
  });

  test('GAP-C list without view permission: title link goes nowhere (#)', async ({
    page,
    factory,
  }) => {
    const chart = await factory.barChart('gap-perm-view');
    await withoutPermissions(page, ['can_view_charts']);
    await gotoList(page);
    await setListPageSize(page, 100);
    await filterListByName(page, chart.title);
    const link = listRow.titleLink(page, chart.id);
    await expect(link).toHaveAttribute('href', '#');
    // Create still shown (needs create, not view)
    await expect(page.getByTestId('charts-create-btn')).toBeVisible();
  });
});

test.describe('charts create step 1 — gaps', () => {
  test('GAP-C new chart "Access Denied" without the create-charts permission', async ({ page }) => {
    await withoutPermissions(page, ['can_create_charts']);
    await page.goto('/charts/new');
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    await expect(page.getByText("You don't have permission to create charts.")).toBeVisible();
    await expect(page.getByTestId('chart-type-grid')).toHaveCount(0);
    const back = page.getByTestId('chart-new-access-denied-back-btn');
    await expect(back).toHaveText('Back to Charts');
    await back.click();
    await expect(page).toHaveURL(/\/charts$/);
  });

  test('GAP-C new chart dataset error "Failed to load datasets"', async ({ page }) => {
    await failRequests(page, SYNC_TABLES_URL, { method: 'GET' });
    await page.goto('/charts/new');
    await expect(
      page
        .getByTestId('chart-dataset-selector')
        .getByText('Failed to load datasets. Please try refreshing.')
    ).toBeVisible();
    await expect(page.getByTestId('chart-new-dataset-select-input')).toHaveCount(0);
    await expect(page.getByTestId('chart-type-continue-button')).toBeDisabled();
  });

  test('GAP-C new chart dataset "Set up a warehouse" when the org has no warehouse', async ({
    page,
  }) => {
    let syncTablesCalled = false;
    page.on('request', (r) => {
      if (SYNC_TABLES_URL.test(r.url())) syncTablesCalled = true;
    });
    await page.route(WAREHOUSES_URL, (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status: 200, json: { warehouses: [] } })
        : route.fallback()
    );
    await page.goto('/charts/new');
    await expect(
      page
        .getByTestId('chart-dataset-selector')
        .getByText('Set up a warehouse before selecting a dataset.')
    ).toBeVisible();
    await expect(page.getByTestId('chart-new-dataset-select-input')).toHaveCount(0);
    // Tables are only fetched once a warehouse exists
    expect(syncTablesCalled).toBe(false);
  });

  test('GAP-C new chart onboarding walkthrough: pick table → pick type → Continue', async ({
    page,
    api,
  }) => {
    const users =
      await api.get<Array<{ user_id: number; org: { slug: string } }>>('/api/currentuserv2');
    const me = users.find((u) => u.org.slug === ORG_SLUG)!;
    const suffix = `${me.user_id}_${ORG_SLUG}`;

    // The staging admin has skipped the insights walkthrough on the backend; serve preferences
    // without that record so tour-gate may resume the locally stored stage.
    await page.route(USER_PREFERENCES_URL, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const res = await fetchForRewrite(route);
      if (!res) return;
      const body = (await res.json()) as {
        res?: { trial_walkthrough?: Record<string, unknown> };
      };
      if (body.res?.trial_walkthrough) delete body.res.trial_walkthrough.insights;
      await route.fulfill({ response: res, json: body });
    });
    // Walkthrough progress lives in localStorage (insight-walkthrough-constants.ts storage keys).
    // Seed once per context: later page loads must keep the stage the app advances to.
    await page.addInitScript((sfx: string) => {
      const seeded = `e2e_walkthrough_seeded_${sfx}`;
      if (localStorage.getItem(seeded)) return;
      localStorage.setItem(seeded, '1');
      localStorage.setItem(`dalgo_insight_walkthrough_stage_insights_${sfx}`, 'chart_create');
      localStorage.setItem(`dalgo_insight_walkthrough_path_insights_${sfx}`, 'own_data');
      localStorage.setItem(`dalgo_insight_walkthrough_active_flow_${sfx}`, 'insights');
    }, suffix);

    await page.goto('/charts');
    await expect(page.getByText('Build chart', { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('charts-create-btn').click();
    await expect(page).toHaveURL(/\/charts\/new$/);

    await expect(page.getByText('Select the relevant data table.')).toBeVisible();
    const input = page.getByTestId('chart-new-dataset-select-input');
    await expect(input).toBeEnabled({ timeout: 30_000 });
    await input.click();
    await input.fill(SEED.datasets.education.table);
    await page.getByTestId(`chart-new-dataset-select-item-${EDU_FULL_NAME}`).click();

    await expect(page.getByText('Select the relevant type', { exact: true })).toBeVisible();
    await page.getByTestId('chart-type-card-bar').click();

    await expect(page.getByText('Continue to configure your chart')).toBeVisible();
    await expect(page.getByText('Select the relevant type', { exact: true })).toHaveCount(0);
    await page.getByTestId('chart-type-continue-button').click();
    await expect(page).toHaveURL(/\/charts\/new\/configure\?.*type=bar/);
    await expect
      .poll(() =>
        page.evaluate(
          (sfx) => localStorage.getItem(`dalgo_insight_walkthrough_stage_insights_${sfx}`),
          suffix
        )
      )
      .toBe('chart_data_config');
  });
});
