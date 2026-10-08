import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { e2eTitle, ORG_SLUG, ROLE_USERS, SEED } from '../support/env';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import {
  getPersonalLanding,
  openBuilder,
  releaseBuilderLocks,
  restorePersonalLanding,
} from './helpers-builder';

// List paginates client-side with this default page size (dashboard-list-v2:170)
const DEFAULT_PAGE_SIZE = 10;
// Enough extra dashboards to guarantee a second page regardless of what else is on staging
const PAGINATION_EXTRA = DEFAULT_PAGE_SIZE + 1;

// TODO testid: the pagination texts only carry DOM ids (dashboard-list-v2 "x–y of N", "p of P")
function paginationInfo(page: Page): Locator {
  return page.locator('#dashboard-pagination-info');
}
function pageInfoText(page: Page): Locator {
  return page.locator('#dashboard-page-info');
}

function row(page: Page, id: number): Locator {
  return page.getByTestId(`dashboard-list-row-${id}`);
}

/** Ids of the rendered rows, in DOM order. */
async function rowIds(page: Page): Promise<number[]> {
  // TODO testid: rows only have per-id testids; match on the prefix to read the order
  const ids = await page
    .locator('[data-testid^="dashboard-list-row-"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid') || ''));
  return ids.map((t) => Number(t.replace('dashboard-list-row-', '')));
}

async function gotoList(page: Page) {
  const loaded = page.waitForResponse(
    (r) => r.request().method() === 'GET' && /\/api\/dashboards\/\?/.test(r.url())
  );
  await page.goto('/dashboards');
  await loaded;
  await expect(paginationInfo(page)).toBeVisible();
}

async function filterByName(page: Page, text: string) {
  await page.getByTestId('dashboard-list-filter-name-trigger').click();
  await page.getByTestId('dashboard-list-name-filter-search').fill(text);
  await page.keyboard.press('Escape');
}

async function openRowMenu(page: Page, id: number) {
  await page.getByTestId(`dashboard-list-menu-${id}`).click();
}

test.describe('dashboard list', () => {
  test.afterEach(async ({ api }) => releaseBuilderLocks(api));

  test('D-L1 loads with pinned (org default) rows first, badges and counter', async ({
    page,
    factory,
  }) => {
    const mine = await factory.dashboard('list-load');
    await gotoList(page);

    const healthRow = row(page, SEED.dashboards.health);
    await expect(healthRow).toBeVisible();
    await expect(healthRow.getByText('Org Default')).toBeVisible();
    await expect(row(page, mine.id)).toContainText(mine.title);

    // Default sort is "last modified desc", yet the older org-default row renders above the
    // newest dashboard because pinned rows always come first
    const ids = await rowIds(page);
    expect(ids.indexOf(SEED.dashboards.health)).toBeLessThan(ids.indexOf(mine.id));
    await expect(paginationInfo(page)).toHaveText(/^1–\d+ of \d+$/);
    await expect(pageInfoText(page)).toHaveText(/^1 of \d+$/);
  });

  test('D-L2 sort by Name / Owner / Last Modified; new column starts desc', async ({
    page,
    factory,
  }) => {
    // Created b → a → c, so modified order differs from name order
    const b = await factory.dashboard('sort-b');
    const a = await factory.dashboard('sort-a');
    const c = await factory.dashboard('sort-c');
    await gotoList(page);
    await filterByName(page, e2eTitle('sort-'));
    await expect.poll(() => rowIds(page)).toEqual([c.id, a.id, b.id]); // default: modified desc

    await page.getByTestId('dashboard-list-sort-modified').click();
    await expect.poll(() => rowIds(page)).toEqual([b.id, a.id, c.id]);

    await page.getByTestId('dashboard-list-sort-name').click();
    await expect.poll(() => rowIds(page)).toEqual([c.id, b.id, a.id]);
    await page.getByTestId('dashboard-list-sort-name').click();
    await expect.poll(() => rowIds(page)).toEqual([a.id, b.id, c.id]);

    // All three share one owner, so owner sort keeps the set but the order is backend order
    await page.getByTestId('dashboard-list-sort-owner').click();
    await expect.poll(async () => (await rowIds(page)).sort()).toEqual([a.id, b.id, c.id].sort());
  });

  test('D-L3 name / favourites / locked filters, owner filter, date filter, Clear all', async ({
    page,
    factory,
    api,
  }) => {
    const fav = await factory.dashboard('flt-fav');
    const locked = await factory.dashboard('flt-locked');
    const plain = await factory.dashboard('flt-plain');
    await api.post(`/api/dashboards/${fav.id}/favorite/`);
    await api.post(`/api/dashboards/${locked.id}/lock/`);
    try {
      await gotoList(page);
      await filterByName(page, e2eTitle('flt-'));
      await expect(page.getByText('1 filter active')).toBeVisible();
      await expect.poll(async () => (await rowIds(page)).length).toBe(3);

      const nameFilter = page.getByTestId('dashboard-list-filter-name-trigger');
      await nameFilter.click();
      await page.getByTestId('dashboard-list-name-filter-favorites').click();
      await expect.poll(() => rowIds(page)).toEqual([fav.id]);
      await page.getByTestId('dashboard-list-name-filter-favorites').click();

      await page.getByTestId('dashboard-list-name-filter-locked').click();
      await expect.poll(() => rowIds(page)).toEqual([locked.id]);
      await expect(row(page, locked.id).getByText('By You')).toBeVisible();
      await page.getByTestId('dashboard-list-name-filter-locked').click();
      await page.keyboard.press('Escape');

      // Owner
      await page.getByTestId('dashboard-list-filter-owner-trigger').click();
      await page.getByTestId('dashboard-list-owner-filter-search').fill('zzz-no-owner');
      await expect(page.getByText('No owners found')).toBeVisible();
      const owner = ROLE_USERS.admin.email!;
      await page.getByTestId('dashboard-list-owner-filter-search').fill(owner);
      await page.getByTestId(`dashboard-list-owner-filter-option-${owner}`).click();
      await page.keyboard.press('Escape');
      await expect(page.getByText('2 filters active')).toBeVisible();
      await expect.poll(async () => (await rowIds(page)).length).toBe(3);

      // Date modified; per-popover Clear only resets that column
      await page.getByTestId('dashboard-list-filter-date-trigger').click();
      await page.getByTestId('dashboard-list-date-filter-today').check();
      await expect(page.getByText('3 filters active')).toBeVisible();
      await expect.poll(async () => (await rowIds(page)).length).toBe(3);
      await page.getByTestId('dashboard-list-date-filter-clear').click();
      await expect(page.getByText('2 filters active')).toBeVisible();

      await page.getByTestId('dashboard-list-date-filter-custom').check();
      await page.getByTestId('dashboard-list-date-filter-start').fill('2020-01-01');
      await page.getByTestId('dashboard-list-date-filter-end').fill('2020-01-02');
      await page.keyboard.press('Escape');
      await expect(page.getByText('No dashboards found')).toBeVisible();
      // [pinned] With zero matches the whole table — including the column filter triggers —
      // is replaced by the empty state, so "Clear all" is the only way back. The counter keeps
      // showing the unfiltered total.
      await expect(page.getByTestId('dashboard-list-filter-date-trigger')).toHaveCount(0);
      await expect(paginationInfo(page)).toHaveText(/^1–\d+ of \d+$/);

      await page.getByTestId('dashboard-list-clear-all-filters').click();
      await expect(page.getByText(/filters? active/)).toHaveCount(0);
      await expect(row(page, SEED.dashboards.health)).toBeVisible();
      await expect(row(page, plain.id)).toBeVisible();
    } finally {
      await api.delete(`/api/dashboards/${locked.id}/lock/`).catch(() => {});
    }
  });

  test('D-L3 [pinned] "Show only shared" hides every dashboard', async ({ page, factory }) => {
    // The filter checks `dashboard.is_public`, which the list endpoint does not return,
    // so no row ever passes it (dashboard-list-v2:291).
    await factory.dashboard('flt-shared');
    await gotoList(page);
    await page.getByTestId('dashboard-list-filter-name-trigger').click();
    await page.getByTestId('dashboard-list-name-filter-shared').click();
    await page.keyboard.press('Escape');
    await expect(page.getByText('No dashboards found')).toBeVisible();
    await expect(page.getByTestId('dashboard-empty-create-button')).toBeVisible();
  });

  test('D-L4 favourite toggle persists across reload', async ({ page, factory }) => {
    const dash = await factory.dashboard('favourite');
    await gotoList(page);
    await filterByName(page, dash.title);

    const favUrl = `/api/dashboards/${dash.id}/favorite/`;
    const settled = (method: string) =>
      page.waitForResponse((r) => r.request().method() === method && r.url().endsWith(favUrl));
    const on = captureRequest(page, { method: 'POST', url: favUrl });
    const onDone = settled('POST');
    await page.getByTestId(`dashboard-list-favorite-${dash.id}`).click();
    expectPayloadSnapshot(await on, 'd-l4-favorite-post');
    expect((await onDone).ok()).toBe(true);

    const favouritesOnly = async () => {
      await gotoList(page);
      await filterByName(page, dash.title);
      await page.getByTestId('dashboard-list-filter-name-trigger').click();
      await page.getByTestId('dashboard-list-name-filter-favorites').click();
      await page.keyboard.press('Escape');
    };
    await favouritesOnly();
    await expect(row(page, dash.id)).toBeVisible();

    const off = captureRequest(page, { method: 'DELETE', url: favUrl });
    const offDone = settled('DELETE');
    await page.getByTestId(`dashboard-list-favorite-${dash.id}`).click();
    expectPayloadSnapshot(await off, 'd-l4-unfavorite-delete');
    expect((await offDone).ok()).toBe(true);
    await favouritesOnly();
    await expect(row(page, dash.id)).toHaveCount(0);
  });

  test('D-L5 row menu: set / remove my landing page (restored after)', async ({
    page,
    factory,
    api,
  }) => {
    const dash = await factory.dashboard('landing');
    const previous = await getPersonalLanding(api, ORG_SLUG);
    try {
      await gotoList(page);
      await filterByName(page, dash.title);

      await openRowMenu(page, dash.id);
      const set = captureRequest(page, {
        method: 'POST',
        url: `/api/dashboards/landing-page/set-personal/${dash.id}`,
      });
      await page.getByTestId(`dashboard-list-set-landing-${dash.id}`).click();
      expectPayloadSnapshot(await set, 'd-l5-set-landing-post');
      await expect(row(page, dash.id).getByText('My Landing')).toBeVisible();

      await openRowMenu(page, dash.id);
      const remove = captureRequest(page, {
        method: 'DELETE',
        url: '/api/dashboards/landing-page/remove-personal',
      });
      await page.getByTestId(`dashboard-list-remove-landing-${dash.id}`).click();
      expectPayloadSnapshot(await remove, 'd-l5-remove-landing-delete');
      await expect(row(page, dash.id).getByText('My Landing')).toHaveCount(0);
    } finally {
      await restorePersonalLanding(api, previous);
    }
  });

  test('D-L5 row menu: org default item is disabled on the current org default', async ({
    page,
  }) => {
    await gotoList(page);
    await openRowMenu(page, SEED.dashboards.health);
    const item = page.getByTestId(`dashboard-list-set-org-default-${SEED.dashboards.health}`);
    await expect(item).toHaveText('Current org default');
    await expect(item).toHaveAttribute('data-disabled', '');
    await page.keyboard.press('Escape');
  });

  test('D-L5 [pinned] row menu: duplicate → "Copy of X" with a chart-worded toast', async ({
    page,
    factory,
    track,
  }) => {
    // toastSuccess.duplicated is shared with charts and hardcodes the word "Chart"
    const dash = await factory.dashboard('duplicate');
    await gotoList(page);
    await filterByName(page, dash.title);

    const post = captureRequest(page, {
      method: 'POST',
      url: `/api/dashboards/${dash.id}/duplicate/`,
    });
    const created = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' && r.url().endsWith(`/api/dashboards/${dash.id}/duplicate/`)
    );
    await openRowMenu(page, dash.id);
    await page.getByTestId(`dashboard-list-duplicate-${dash.id}`).click();
    expectPayloadSnapshot(await post, 'd-l5-duplicate-post');
    const copy = (await (await created).json()) as { id: number; title: string };
    track('dashboards', copy.id); // "Copy of e2e-…" isn't prefix-swept
    expect(copy.title).toBe(`Copy of ${dash.title}`);

    await expect(
      page.getByText(`Chart "${dash.title}" duplicated as "Copy of ${dash.title}" successfully!`)
    ).toBeVisible();
    await expect(row(page, copy.id)).toContainText(`Copy of ${dash.title}`);
  });

  test('D-L5 row menu: delete asks for confirmation; Cancel keeps, Delete removes', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('delete');
    await gotoList(page);
    await filterByName(page, dash.title);

    await openRowMenu(page, dash.id);
    await page.getByTestId(`dashboard-list-delete-${dash.id}`).click();
    const dialog = page.getByTestId(`dashboard-list-delete-dialog-${dash.id}`);
    await expect(dialog).toContainText(`Are you sure you want to delete "${dash.title}"?`);
    await page.getByTestId(`dashboard-list-delete-cancel-${dash.id}`).click();
    await expect(dialog).toBeHidden();
    await expect(row(page, dash.id)).toBeVisible();

    // [pinned] The Delete item calls preventDefault on select (to host the dialog), so after
    // Cancel the row menu is still open — and modal, blocking clicks elsewhere
    const deleteItem = page.getByTestId(`dashboard-list-delete-${dash.id}`);
    await expect(deleteItem).toBeVisible();
    await deleteItem.click();
    const del = captureRequest(page, { method: 'DELETE', url: `/api/dashboards/${dash.id}/` });
    await page.getByTestId(`dashboard-list-delete-confirm-${dash.id}`).click();
    expectPayloadSnapshot(await del, 'd-l5-delete');
    await expect(page.getByText(`${dash.title} deleted successfully`)).toBeVisible();
    await expect(row(page, dash.id)).toHaveCount(0);
  });

  test('D-L6 pagination: next / prev, page size resets to page 1', async ({ page, factory }) => {
    await Promise.all(
      Array.from({ length: PAGINATION_EXTRA }, (_, i) => factory.dashboard(`page-${i}`))
    );
    await gotoList(page);

    const info = paginationInfo(page);
    const pageInfo = pageInfoText(page);
    const prev = page.getByTestId('dashboard-prev-page-button');
    const next = page.getByTestId('dashboard-next-page-button');

    await expect(info).toHaveText(new RegExp(`^1–${DEFAULT_PAGE_SIZE} of \\d+$`));
    const pages = Number((await pageInfo.innerText()).split(' of ')[1]);
    expect(pages).toBeGreaterThanOrEqual(2);
    await expect(prev).toBeDisabled();
    const firstPage = await rowIds(page);

    // The fixed "Get Started" onboarding pill (bottom-right, z-40) covers the next-page button
    // at this viewport, so a pointer click lands on the pill; use the keyboard like a user would
    await next.focus();
    await page.keyboard.press('Enter');
    await expect(pageInfo).toHaveText(`2 of ${pages}`);
    await expect(info).toHaveText(new RegExp(`^${DEFAULT_PAGE_SIZE + 1}–\\d+ of \\d+$`));
    await expect(prev).toBeEnabled();
    // Pinned rows repeat on every page; the regular rows change
    const secondPage = await rowIds(page);
    const pinned = firstPage.filter((id) => secondPage.includes(id));
    expect(firstPage.length - pinned.length).toBe(DEFAULT_PAGE_SIZE);

    await page.getByTestId('dashboard-page-size-trigger').click();
    await page.getByTestId('dashboard-page-size-option-20').click();
    await expect(pageInfo).toHaveText(/^1 of \d+$/);
    await expect(info).toHaveText(/^1–\d+ of \d+$/);
    await expect(prev).toBeDisabled();
  });

  test('D-L7 lock badge: "By You" for the editor, "Locked" for another user', async ({
    page,
    factory,
    pageAs,
  }) => {
    const dash = await factory.dashboard('lock-badge');
    const editor = await page.context().newPage();
    await openBuilder(editor, dash.id);

    await gotoList(page);
    await filterByName(page, dash.title);
    await expect(row(page, dash.id).getByText('By You')).toBeVisible();
    await expect(row(page, dash.id).getByText('Locked', { exact: true })).toHaveCount(0);

    const analyst = await pageAs('analyst');
    await gotoList(analyst);
    await filterByName(analyst, dash.title);
    await expect(row(analyst, dash.id).getByText('Locked', { exact: true })).toBeVisible();
    await expect(row(analyst, dash.id).getByText('By You')).toHaveCount(0);
    await editor.close();
  });
});
