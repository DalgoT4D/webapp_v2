import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { ApiClient } from '../support/api-client';
import { e2eTitle, ROLE_USERS, SEED } from '../support/env';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { releaseBuilderLocks, watchBuilderReady } from './helpers-builder';
import {
  FORCED_ERROR,
  editResponse,
  failRequests,
  holdRequests,
  withoutPermissions,
} from './helpers-gaps-builder';

/**
 * Dashboard list gaps. Lives outside the parallel `chromium` run (like list.spec.ts): the list
 * filters/sorts client-side over whatever the org holds, so concurrent specs creating dashboards
 * can change what these tests see.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
// Relative "modified" ages for the date-filter test: inside 7 days, inside 30, outside 30
const AGE_RECENT_DAYS = 0;
const AGE_WEEKS_DAYS = 10;
const AGE_OLD_DAYS = 40;

const LIST_URL = (url: URL) => url.pathname === '/api/dashboards/' && url.search.includes('page=');

function row(page: Page, id: number): Locator {
  return page.getByTestId(`dashboard-list-row-${id}`);
}

async function rowIds(page: Page): Promise<number[]> {
  // TODO testid: rows only have per-id testids; match on the prefix to read the order
  const ids = await page
    .locator('[data-testid^="dashboard-list-row-"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') || ''));
  return ids.map((t) => Number(t.replace('dashboard-list-row-', '')));
}

async function gotoList(page: Page) {
  const loaded = page.waitForResponse(
    (r) => r.request().method() === 'GET' && LIST_URL(new URL(r.url()))
  );
  await page.goto('/dashboards');
  await loaded;
  // TODO testid: the pagination text only carries a DOM id
  await expect(page.locator('#dashboard-pagination-info')).toBeVisible();
}

async function filterByName(page: Page, text: string) {
  await page.getByTestId('dashboard-list-filter-name-trigger').click();
  await page.getByTestId('dashboard-list-name-filter-search').fill(text);
  await page.keyboard.press('Escape');
}

interface ListedDashboard {
  id: number;
  updated_at?: string;
}

/** The list endpoint answers with a plain array or a paginated `{data}` object. */
function mapListItems(body: unknown, fn: (d: ListedDashboard) => ListedDashboard) {
  if (Array.isArray(body)) return body.map(fn);
  const paged = body as { data: ListedDashboard[] };
  return { ...paged, data: paged.data.map(fn) };
}

test.describe('dashboard list gaps', () => {
  test.afterEach(async ({ api }) => releaseBuilderLocks(api));

  test('GAP-D sort by Owner orders by owner email, desc then asc', async ({ page, factory }) => {
    const mine = await factory.dashboard('owner-sort-admin');
    const analystApi = await ApiClient.create(ROLE_USERS.analyst.statePath);
    let theirs: { id: number } | null = null;
    try {
      theirs = await analystApi.post<{ id: number }>('/api/dashboards/', {
        title: e2eTitle('owner-sort-analyst'),
        grid_columns: 12,
      });
      await gotoList(page);
      await filterByName(page, e2eTitle('owner-sort-'));
      await expect
        .poll(async () => (await rowIds(page)).sort())
        .toEqual([mine.id, theirs.id].sort());

      const byEmail = [
        { id: mine.id, email: ROLE_USERS.admin.email!.toLowerCase() },
        { id: theirs.id, email: ROLE_USERS.analyst.email!.toLowerCase() },
      ].sort((a, b) => (a.email < b.email ? -1 : 1));
      const asc = byEmail.map((d) => d.id);

      await page.getByTestId('dashboard-list-sort-owner').click();
      await expect.poll(() => rowIds(page)).toEqual([...asc].reverse());
      await page.getByTestId('dashboard-list-sort-owner').click();
      await expect.poll(() => rowIds(page)).toEqual(asc);
    } finally {
      if (theirs) await analystApi.deleteResource('dashboards', theirs.id).catch(() => {});
      await analystApi.dispose();
    }
  });

  test('GAP-D date modified filter: Last 7 days and Last 30 days', async ({ page, factory }) => {
    const recent = await factory.dashboard('date-recent');
    const weeks = await factory.dashboard('date-weeks');
    const old = await factory.dashboard('date-old');
    // Freshly created dashboards are all "today"; the list response is edited to give them ages
    const ageDays: Record<number, number> = {
      [recent.id]: AGE_RECENT_DAYS,
      [weeks.id]: AGE_WEEKS_DAYS,
      [old.id]: AGE_OLD_DAYS,
    };
    const now = Date.now();
    await editResponse(page, LIST_URL, (body) =>
      mapListItems(body, (d) =>
        d.id in ageDays
          ? { ...d, updated_at: new Date(now - ageDays[d.id] * DAY_MS).toISOString() }
          : d
      )
    );
    await gotoList(page);
    await filterByName(page, e2eTitle('date-'));
    const all = [recent.id, weeks.id, old.id].sort();
    await expect.poll(async () => (await rowIds(page)).sort()).toEqual(all);

    await page.getByTestId('dashboard-list-filter-date-trigger').click();
    await page.getByTestId('dashboard-list-date-filter-week').check();
    await expect.poll(() => rowIds(page)).toEqual([recent.id]);
    await expect(page.getByText('2 filters active')).toBeVisible();

    await page.getByTestId('dashboard-list-date-filter-month').check();
    await expect
      .poll(async () => (await rowIds(page)).sort())
      .toEqual([recent.id, weeks.id].sort());

    await page.getByTestId('dashboard-list-date-filter-all').check();
    await expect.poll(async () => (await rowIds(page)).sort()).toEqual(all);
    await expect(page.getByText('1 filter active')).toBeVisible();
  });

  test('GAP-D Clear buttons in the name and owner popovers', async ({ page, factory, api }) => {
    const fav = await factory.dashboard('clear-fav');
    const plain = await factory.dashboard('clear-plain');
    await api.post(`/api/dashboards/${fav.id}/favorite/`);
    await gotoList(page);

    // Name popover: text + "favorites" both reset by its Clear
    await page.getByTestId('dashboard-list-filter-name-trigger').click();
    const search = page.getByTestId('dashboard-list-name-filter-search');
    await search.fill(e2eTitle('clear-'));
    await page.getByTestId('dashboard-list-name-filter-favorites').click();
    await expect.poll(() => rowIds(page)).toEqual([fav.id]);
    await expect(page.getByText('1 filter active')).toBeVisible();
    await page.getByTestId('dashboard-list-name-filter-clear').click();
    await expect(search).toHaveValue('');
    await expect(page.getByTestId('dashboard-list-name-filter-favorites')).not.toBeChecked();
    await page.keyboard.press('Escape');
    await expect(page.getByText(/filters? active/)).toHaveCount(0);
    await expect(row(page, plain.id)).toBeVisible();
    await expect(row(page, SEED.dashboards.health)).toBeVisible();

    // Owner popover
    const owner = ROLE_USERS.admin.email!;
    await page.getByTestId('dashboard-list-filter-owner-trigger').click();
    await page.getByTestId('dashboard-list-owner-filter-search').fill(owner);
    const option = page.getByTestId(`dashboard-list-owner-filter-option-${owner}`);
    await option.click();
    await expect(page.getByText('1 filter active')).toBeVisible();
    await page.getByTestId('dashboard-list-owner-filter-clear').click();
    await expect(page.getByText(/filters? active/)).toHaveCount(0);
    await expect(option.getByRole('checkbox')).not.toBeChecked();
    await page.keyboard.press('Escape');
  });

  test('GAP-D empty state "No dashboards yet" for an org with no dashboards', async ({ page }) => {
    // No empty org on staging — the list response is mocked empty
    await page.route(LIST_URL, (route) =>
      route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.fallback()
    );
    await page.goto('/dashboards');
    await expect(page.getByText('No dashboards yet')).toBeVisible();
    await expect(page.getByText('No dashboards found')).toHaveCount(0);
    const create = page.getByTestId('dashboard-empty-create-button');
    await expect(create).toHaveText('CREATE YOUR FIRST DASHBOARD');
    await expect(page.locator('a', { has: create })).toHaveAttribute('href', '/dashboards/create');
  });

  test('GAP-D favorite failure shows an error toast and keeps the dashboard unfavorited', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('fav-fail');
    const favUrl = `/api/dashboards/${dash.id}/favorite/`;
    await failRequests(page, (url) => url.pathname === favUrl, { method: 'POST' });
    await gotoList(page);
    await filterByName(page, dash.title);

    const post = captureRequest(page, { method: 'POST', url: favUrl });
    await page.getByTestId(`dashboard-list-favorite-${dash.id}`).click();
    expectPayloadSnapshot(await post, 'gap-d-list-favorite-fail-post');
    await expect(page.getByText(FORCED_ERROR)).toBeVisible();

    await page.getByTestId('dashboard-list-filter-name-trigger').click();
    await page.getByTestId('dashboard-list-name-filter-favorites').click();
    await page.keyboard.press('Escape');
    await expect(row(page, dash.id)).toHaveCount(0);
  });

  test('GAP-D title link opens the dashboard view', async ({ page, factory }) => {
    const dash = await factory.dashboard('title-link');
    await gotoList(page);
    await filterByName(page, dash.title);
    const link = page.getByTestId(`dashboard-list-title-link-${dash.id}`);
    await expect(link).toHaveText(dash.title);
    await link.click();
    await expect(page).toHaveURL(`/dashboards/${dash.id}`);
    await expect(page.getByTestId('dashboard-view-back-btn')).toBeVisible({ timeout: 30_000 });
  });

  test('GAP-D edit icon opens the builder', async ({ page, factory }) => {
    const dash = await factory.dashboard('edit-icon');
    await gotoList(page);
    await filterByName(page, dash.title);
    const ready = watchBuilderReady(page, dash.id);
    await page.getByTestId(`dashboard-list-edit-${dash.id}`).click();
    await ready();
    await expect(page).toHaveURL(`/dashboards/${dash.id}/edit`);
    await expect(page.getByTestId('dashboard-title-display')).toHaveText(dash.title);
  });

  test('GAP-D share icon opens the Share modal from the list', async ({ page, factory }) => {
    const dash = await factory.dashboard('share-icon');
    await gotoList(page);
    await filterByName(page, dash.title);
    const share = page.getByTestId(`dashboard-share-table-${dash.id}`);
    await expect(share).toHaveAttribute('aria-label', `Share dashboard: ${dash.title}`);
    await share.click();
    const modal = page.getByTestId('share-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: `Share "${dash.title}"` })).toBeVisible();
    await expect(modal.getByTestId('general-access-select')).toBeVisible();
    await modal.getByTestId('share-close-btn').click();
    await expect(modal).toBeHidden();
    await expect(page).toHaveURL('/dashboards');
  });

  test('GAP-D Create Dashboard button goes to /dashboards/create and on to the builder', async ({
    page,
    track,
  }) => {
    await gotoList(page);
    const post = captureRequest(page, { method: 'POST', url: /\/api\/dashboards\/$/ });
    const created = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/dashboards\/$/.test(r.url())
    );
    const ready = watchBuilderReady(page, null);
    await page.getByTestId('dashboard-create-button').click();
    const body = await post;
    const { id } = (await (await created).json()) as { id: number };
    track('dashboards', id); // "Untitled Dashboard" isn't prefix-swept
    expectPayloadSnapshot(body, 'gap-d-list-create-post');
    await expect(page).toHaveURL(new RegExp(`/dashboards/${id}/edit\\?new=true$`));
    await ready();
    await expect(page.getByTestId('dashboard-title-input')).toHaveValue('Untitled Dashboard');
  });

  test('GAP-D loading skeleton, then "Failed to load dashboards" with Retry', async ({ page }) => {
    // Loading: hold the list request
    const hold = await holdRequests(page, LIST_URL, 'GET');
    await page.goto('/dashboards');
    // TODO testid: skeleton rows only carry the shared ui/skeleton data-slot
    const skeletons = page.locator('[data-slot="skeleton"]');
    const rows = page.locator('[data-testid^="dashboard-list-row-"]');
    await expect(skeletons.first()).toBeVisible();
    await expect(rows).toHaveCount(0);
    expect(hold.held()).toBeGreaterThan(0);
    hold.release();
    await expect(skeletons).toHaveCount(0);
    await expect(rows.first()).toBeVisible();
    await page.unrouteAll({ behavior: 'wait' });

    // Error: fail the list request until Retry is clicked
    let failing = true;
    await page.route(LIST_URL, (route) =>
      failing && route.request().method() === 'GET'
        ? route.fulfill({ status: 500, json: { detail: FORCED_ERROR } })
        : route.fallback()
    );
    await page.goto('/dashboards');
    await expect(page.getByText('Failed to load dashboards')).toBeVisible();
    const retry = page.getByTestId('dashboard-list-retry-btn');
    await expect(retry).toBeVisible();
    failing = false;
    const reloaded = page.waitForEvent('load');
    await retry.click();
    await reloaded;
    await expect(page.locator('#dashboard-pagination-info')).toBeVisible();
    await expect(page.getByText('Failed to load dashboards')).toHaveCount(0);
  });

  test('GAP-D Create, Duplicate and Delete are hidden without the matching permission', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('no-perms');
    await withoutPermissions(page, ['can_create_dashboards', 'can_delete_dashboards']);
    await gotoList(page);
    await expect(page.getByTestId('dashboard-create-button')).toHaveCount(0);

    await filterByName(page, dash.title);
    await page.getByTestId(`dashboard-list-menu-${dash.id}`).click();
    // Landing-page items stay (view permission); duplicate / delete are gone
    await expect(page.getByTestId(`dashboard-list-set-landing-${dash.id}`)).toBeVisible();
    await expect(page.getByTestId(`dashboard-list-duplicate-${dash.id}`)).toHaveCount(0);
    await expect(page.getByTestId(`dashboard-list-delete-${dash.id}`)).toHaveCount(0);
    await page.keyboard.press('Escape');

    // The empty state's create button is gated the same way
    await filterByName(page, 'zzz-e2e-no-such-dashboard');
    await expect(page.getByText('No dashboards found')).toBeVisible();
    await expect(page.getByTestId('dashboard-empty-create-button')).toHaveCount(0);
  });
});
