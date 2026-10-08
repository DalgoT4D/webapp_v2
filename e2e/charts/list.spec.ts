import { test, expect } from '../support/fixtures';
import { e2eTitle } from '../support/env';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import type { Page, Route } from '@playwright/test';
import {
  type ListResponse,
  allTitleLinks,
  CHATBOT_SEED_IDS,
  CHATBOT_SOURCE,
  CLINIC_SEED_IDS,
  CLINIC_SOURCE,
  createChart,
  createDashboardUsingChart,
  expectDownload,
  exportFilenamePattern,
  filterListByName,
  gotoChartsList,
  listRow,
  openListFilteredByName,
  openMenu,
  closeListFilter,
  nextListPage,
  openListFilter,
  openRowMenu,
  pressButton,
  redactIds,
  SEED_CHARTS,
  setListPageSize,
  visibleChartIds,
  visibleChartTitles,
} from './helpers-core';

/** MATRIX §1.1 — /charts list page. */

// TODO testid: pagination counter / page info / empty text only have element ids
const counter = (page: Page) => page.locator('#charts-pagination-info');
const pageInfo = (page: Page) => page.locator('#charts-page-info');
const emptyText = (page: Page) => page.locator('#charts-empty-text');
// TODO testid: selection bar has only an element id; its "N of M charts selected" text has none
const selectionBar = (page: Page) => page.locator('#charts-selection-bar');
// TODO testid: filter summary ("N filter(s) active") has only an element id
const filterSummary = (page: Page) => page.locator('#charts-filters-section');

type Item = ListResponse['data'][number];

function byId(body: ListResponse): Map<number, Item> {
  return new Map(body.data.map((c) => [c.id, c]));
}

/** Assert `values` never increases (desc) / decreases (asc) — the list's comparator uses </>. */
function expectMonotonic(values: Array<string | number>, order: 'asc' | 'desc') {
  for (let i = 1; i < values.length; i++) {
    const [a, b] = [values[i - 1], values[i]];
    if (order === 'asc') expect(a <= b, `${a} should come before ${b} (asc)`).toBe(true);
    else expect(a >= b, `${a} should come before ${b} (desc)`).toBe(true);
  }
}

test.describe('charts list', () => {
  test('C-L1 loads: header, rows in updated desc order, counter "1–10 of N"', async ({ page }) => {
    const body = await gotoChartsList(page);
    await expect(page.getByRole('heading', { name: 'Charts', exact: true })).toBeVisible();
    await expect(page.getByText('Create and manage your visualizations')).toBeVisible();
    await expect(page.getByTestId('charts-create-btn')).toHaveText('CREATE CHART');

    expect(body.total).toBeGreaterThanOrEqual(27);
    await expect(allTitleLinks(page)).toHaveCount(body.data.length);
    await expect(counter(page)).toHaveText(`1–${Math.min(10, body.total)} of ${body.total}`);
    await expect(pageInfo(page)).toHaveText(`1 of ${body.total_pages}`);
    await expect(page.getByTestId('chart-list-page-size-trigger')).toHaveText('10');

    // default sort: Last Modified desc
    const map = byId(body);
    const ids = await visibleChartIds(page);
    expectMonotonic(
      ids.map((id) => new Date(map.get(id)!.updated_at).getTime()),
      'desc'
    );
  });

  test('C-L1 seeded row shows title, data source, creator, relative time and actions', async ({
    page,
  }) => {
    await openListFilteredByName(page, SEED_CHARTS.bar.title);
    const id = SEED_CHARTS.bar.id;
    await expect(listRow.titleLink(page, id)).toHaveText(SEED_CHARTS.bar.title);
    await expect(listRow.titleLink(page, id)).toHaveAttribute('href', `/charts/${id}`);
    const row = listRow.row(page, id);
    await expect(row).toContainText('production.mart_education_program');
    await expect(row).toContainText(/\bago\b/); // formatDistanceToNow
    await expect(page.getByTestId(`chart-created-by-${id}`)).toHaveText(/@/);
    await expect(page.getByTestId(`chart-list-edit-${id}`)).toBeVisible();
    await expect(page.getByTestId(`chart-list-share-${id}`)).toBeVisible();
    await expect(listRow.favorite(page, id)).toBeVisible();
  });

  test('C-L2 sort: each column, toggle asc↔desc, a new column starts desc', async ({ page }) => {
    await gotoChartsList(page);
    const body = await setListPageSize(page, 100);
    const map = byId(body);
    const key = {
      title: (c: Item) => (c.title || '').toLowerCase(),
      source: (c: Item) => `${c.schema_name}.${c.table_name}`.toLowerCase(),
      type: (c: Item) => (c.chart_type || '').toLowerCase(),
      updated: (c: Item) => new Date(c.updated_at).getTime(),
    };
    const check = async (k: keyof typeof key, order: 'asc' | 'desc') => {
      await expect
        .poll(async () => {
          const ids = await visibleChartIds(page);
          const values = ids.map((id) => key[k](map.get(id)!));
          const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
          if (order === 'desc') sorted.reverse();
          return JSON.stringify(values) === JSON.stringify(sorted);
        })
        .toBe(true);
    };

    await check('updated', 'desc');
    await page.getByTestId('chart-list-sort-name').click();
    await check('title', 'desc');
    await page.getByTestId('chart-list-sort-name').click();
    await check('title', 'asc');
    await page.getByTestId('chart-list-sort-data-source').click();
    await check('source', 'desc');
    await page.getByTestId('chart-list-sort-data-source').click();
    await check('source', 'asc');
    await page.getByTestId('chart-list-sort-type').click();
    await check('type', 'desc');
    await page.getByTestId('chart-list-sort-type').click();
    await check('type', 'asc');
    await page.getByTestId('chart-list-sort-updated-at').click();
    await check('updated', 'desc');
    await page.getByTestId('chart-list-sort-updated-at').click();
    await check('updated', 'asc');
  });

  test('C-L2 sort resets to page 1', async ({ page }) => {
    await gotoChartsList(page);
    await nextListPage(page, 2);
    await page.getByTestId('chart-list-sort-name').click();
    await expect(pageInfo(page)).toHaveText(/^1 of /);
    await expect(counter(page)).toHaveText(/^1–10 of \d+$/);
  });

  test('C-L3 filter: name text is a case-insensitive substring match', async ({
    page,
    api,
    track,
  }) => {
    const alpha = await createChart(api, track, 'bar', 'flt-alpha');
    const beta = await createChart(api, track, 'bar', 'flt-beta');
    await openListFilteredByName(page, e2eTitle('flt-'));
    await expect(allTitleLinks(page)).toHaveCount(2);
    expect((await visibleChartIds(page)).sort()).toEqual([alpha.id, beta.id].sort());

    await filterListByName(page, 'FLT-ALPHA');
    // other runs may have their own flt-alpha; ours must be there and beta must not
    await expect(listRow.titleLink(page, alpha.id)).toBeVisible();
    await expect(listRow.titleLink(page, beta.id)).toBeHidden();
    for (const t of await visibleChartTitles(page)) expect(t.toLowerCase()).toContain('flt-alpha');
  });

  test('C-L3 filter: "Show only favorites"', async ({ page, api, track }) => {
    const fav = await createChart(api, track, 'bar', 'favf-yes');
    const plain = await createChart(api, track, 'bar', 'favf-no');
    await api.post(`/api/charts/${fav.id}/favorite/`);
    await openListFilteredByName(page, e2eTitle('favf-'));
    await expect(allTitleLinks(page)).toHaveCount(2);

    await openListFilter(page, 'name');
    await page.getByTestId('chart-list-filter-favorites-checkbox').click();
    await expect(page.getByTestId('chart-list-filter-favorites-checkbox')).toBeChecked();
    await closeListFilter(page, 'name');
    await expect(listRow.titleLink(page, fav.id)).toBeVisible();
    await expect(listRow.titleLink(page, plain.id)).toBeHidden();
    await expect(filterSummary(page)).toContainText('1 filter active');
  });

  test('C-L3 filter: data source multi-select with search', async ({ page }) => {
    await gotoChartsList(page);
    const body = await setListPageSize(page, 100);
    const map = byId(body);
    const sources = [...new Set(body.data.map((c) => `${c.schema_name}.${c.table_name}`))].sort();

    await openListFilter(page, 'source');
    const options = page.locator('[data-testid^="chart-list-filter-source-option-"]');
    await expect(options).toHaveCount(sources.length);
    expect(await options.allInnerTexts()).toEqual(sources);

    const search = page.getByTestId('chart-list-filter-source-search');
    await search.fill('zzz-none');
    await expect(options).toHaveCount(0);
    await expect(page.getByText('No data sources found')).toBeVisible();
    await search.fill('CHATBOT');
    await expect(options).toHaveCount(1);
    await page.getByTestId(`chart-list-filter-source-option-${CHATBOT_SOURCE}`).click();
    await expect(
      page.getByTestId(`chart-list-filter-source-checkbox-${CHATBOT_SOURCE}`)
    ).toBeChecked();
    await search.fill('clinic');
    await page.getByTestId(`chart-list-filter-source-option-${CLINIC_SOURCE}`).click();
    await closeListFilter(page, 'source');

    for (const id of [...CHATBOT_SEED_IDS, ...CLINIC_SEED_IDS]) {
      await expect(listRow.titleLink(page, id)).toBeVisible();
    }
    for (const id of await visibleChartIds(page)) {
      const c = map.get(id)!;
      expect([CHATBOT_SOURCE, CLINIC_SOURCE]).toContain(`${c.schema_name}.${c.table_name}`);
    }

    // toggling an option off removes its rows
    await openListFilter(page, 'source');
    await search.fill('');
    await page.getByTestId(`chart-list-filter-source-option-${CLINIC_SOURCE}`).click();
    await closeListFilter(page, 'source');
    await expect(listRow.titleLink(page, CLINIC_SEED_IDS[0])).toBeHidden();
    await expect(listRow.titleLink(page, CHATBOT_SEED_IDS[0])).toBeVisible();
  });

  test('C-L3 filter: chart type multi-select lists only types on the page', async ({ page }) => {
    await gotoChartsList(page);
    const body = await setListPageSize(page, 100);
    const map = byId(body);
    const types = [...new Set(body.data.map((c) => c.chart_type))].sort();

    await openListFilter(page, 'type');
    const options = page.locator('[data-testid^="chart-list-filter-type-option-"]');
    await expect(options).toHaveCount(types.length);
    const optionIds = await options.evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-testid')!.replace('chart-list-filter-type-option-', ''))
    );
    expect(optionIds).toEqual(types);

    await page.getByTestId('chart-list-filter-type-option-map').click();
    await page.getByTestId('chart-list-filter-type-option-pivot_table').click();
    await expect(page.getByTestId('chart-list-filter-type-checkbox-map')).toBeChecked();
    await expect(page.getByTestId('chart-list-filter-type-checkbox-pivot_table')).toBeChecked();
    await closeListFilter(page, 'type');

    await expect(listRow.titleLink(page, SEED_CHARTS.map.id)).toBeVisible();
    await expect(listRow.titleLink(page, SEED_CHARTS.pivot_table.id)).toBeVisible();
    await expect(listRow.titleLink(page, SEED_CHARTS.bar.id)).toBeHidden();
    for (const id of await visibleChartIds(page)) {
      expect(['map', 'pivot_table']).toContain(map.get(id)!.chart_type);
    }
  });

  test('C-L3 filter: date modified today / 7 days / 30 days / custom / all', async ({
    page,
    api,
    track,
  }) => {
    const recent = await createChart(api, track, 'bar', 'date-recent');
    await gotoChartsList(page);
    await setListPageSize(page, 100);
    const oldest = SEED_CHARTS.oldest.id;

    const pick = async (range: 'all' | 'today' | 'week' | 'month' | 'custom') => {
      await openListFilter(page, 'date');
      await page.getByTestId(`chart-list-filter-date-${range}`).check();
    };

    await openListFilter(page, 'date');
    await expect(page.getByTestId('chart-list-filter-date-all')).toBeChecked();
    await expect(page.getByTestId('chart-list-filter-date-from')).toBeHidden();
    await closeListFilter(page, 'date');

    for (const range of ['today', 'week', 'month'] as const) {
      await pick(range);
      await closeListFilter(page, 'date');
      await expect(listRow.titleLink(page, recent.id)).toBeVisible();
      await expect(listRow.titleLink(page, oldest)).toBeHidden();
    }

    // custom: [2026-08-14, 2026-08-15) (inputs parse as UTC midnight)
    await pick('custom');
    await page.getByTestId('chart-list-filter-date-from').fill('2026-08-14');
    await page.getByTestId('chart-list-filter-date-to').fill('2026-08-15');
    await closeListFilter(page, 'date');
    await expect(listRow.titleLink(page, oldest)).toBeVisible();
    await expect(listRow.titleLink(page, recent.id)).toBeHidden();
    await expect(listRow.titleLink(page, SEED_CHARTS.map.id)).toBeHidden(); // updated Aug 15 07:57Z

    await pick('all');
    await closeListFilter(page, 'date');
    await expect(listRow.titleLink(page, oldest)).toBeVisible();
    await expect(listRow.titleLink(page, recent.id)).toBeVisible();
    await expect(filterSummary(page)).toBeHidden();
  });

  test('C-L4 "N filter(s) active", per-popover Clear, Clear all', async ({ page }) => {
    await gotoChartsList(page);
    await setListPageSize(page, 100);
    await expect(filterSummary(page)).toBeHidden();
    const totalRows = await allTitleLinks(page).count();

    await filterListByName(page, 'a');
    await expect(filterSummary(page)).toContainText('1 filter active');

    await openListFilter(page, 'type');
    await page.getByTestId('chart-list-filter-type-option-pie').click();
    await closeListFilter(page, 'type');
    await expect(filterSummary(page)).toContainText('2 filters active');

    // combination chosen so seed 1250 (chatbot pie, updated 2026-08-14) always stays visible —
    // an empty result would unmount the header and its popovers (see C-L14)
    await openListFilter(page, 'source');
    await page.getByTestId(`chart-list-filter-source-option-${CHATBOT_SOURCE}`).click();
    await closeListFilter(page, 'source');
    await openListFilter(page, 'date');
    await page.getByTestId('chart-list-filter-date-custom').check();
    await page.getByTestId('chart-list-filter-date-from').fill('2026-08-14');
    await page.getByTestId('chart-list-filter-date-to').fill('2026-08-15');
    await closeListFilter(page, 'date');
    await expect(filterSummary(page)).toContainText('4 filters active');
    await expect(listRow.titleLink(page, CHATBOT_SEED_IDS[0])).toBeVisible();

    // per-popover Clear
    await openListFilter(page, 'name');
    await page.getByTestId('chart-list-filter-name-clear').click();
    await expect(page.getByTestId('chart-list-filter-name-input')).toHaveValue('');
    await closeListFilter(page, 'name');
    await expect(filterSummary(page)).toContainText('3 filters active');

    await openListFilter(page, 'type');
    await page.getByTestId('chart-list-filter-type-clear').click();
    await expect(page.getByTestId('chart-list-filter-type-checkbox-pie')).not.toBeChecked();
    await closeListFilter(page, 'type');
    await expect(filterSummary(page)).toContainText('2 filters active');

    await openListFilter(page, 'date');
    await page.getByTestId('chart-list-filter-date-clear').click();
    await expect(page.getByTestId('chart-list-filter-date-all')).toBeChecked();
    await closeListFilter(page, 'date');
    await expect(filterSummary(page)).toContainText('1 filter active');

    await openListFilter(page, 'source');
    await page.getByTestId('chart-list-filter-source-clear').click();
    await expect(
      page.getByTestId(`chart-list-filter-source-checkbox-${CHATBOT_SOURCE}`)
    ).not.toBeChecked();
    await closeListFilter(page, 'source');
    await expect(filterSummary(page)).toBeHidden();

    // Clear all
    await filterListByName(page, 'a');
    await openListFilter(page, 'type');
    await page.getByTestId('chart-list-filter-type-option-pie').click();
    await closeListFilter(page, 'type');
    await expect(filterSummary(page)).toContainText('2 filters active');
    await page.getByTestId('chart-list-clear-all-filters-btn').click();
    await expect(filterSummary(page)).toBeHidden();
    await expect(allTitleLinks(page)).toHaveCount(totalRows);
  });

  test('[pinned] C-L5 filters act on the current page only; counter keeps server total', async ({
    page,
  }) => {
    // Filters are client-side over the fetched page (useCharts sends only page/page_size)
    const body = await gotoChartsList(page);
    expect(body.data.map((c) => c.id)).not.toContain(SEED_CHARTS.oldest.id);
    await filterListByName(page, SEED_CHARTS.oldest.title);
    await expect(emptyText(page)).toHaveText('No charts found');
    await expect(counter(page)).toHaveText(`1–10 of ${body.total}`);

    const all = await setListPageSize(page, 100);
    await expect(listRow.titleLink(page, SEED_CHARTS.oldest.id)).toBeVisible();
    await expect(allTitleLinks(page)).toHaveCount(1);
    await expect(counter(page)).toHaveText(`1–${Math.min(100, all.total)} of ${all.total}`);
  });

  test('C-L6 favorite toggle on/off persists after reload', async ({ page, factory }) => {
    const chart = await factory.barChart('fav-toggle');
    await openListFilteredByName(page, chart.title);

    const on = captureRequest(page, { method: 'POST', url: `/api/charts/${chart.id}/favorite/` });
    const onResp = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' && r.url().includes(`/api/charts/${chart.id}/favorite/`)
    );
    await listRow.favorite(page, chart.id).click();
    expectPayloadSnapshot(await on, 'list-favorite-on');
    expect((await onResp).ok()).toBe(true);

    await openListFilteredByName(page, chart.title);
    await openListFilter(page, 'name');
    await page.getByTestId('chart-list-filter-favorites-checkbox').click();
    await closeListFilter(page, 'name');
    await expect(listRow.titleLink(page, chart.id)).toBeVisible();

    const off = captureRequest(page, {
      method: 'DELETE',
      url: `/api/charts/${chart.id}/favorite/`,
    });
    const offResp = page.waitForResponse(
      (r) =>
        r.request().method() === 'DELETE' && r.url().includes(`/api/charts/${chart.id}/favorite/`)
    );
    await listRow.favorite(page, chart.id).click();
    expectPayloadSnapshot(await off, 'list-favorite-off');
    expect((await offResp).ok()).toBe(true);
    // the row stays until the list refetches (optimistic, no revalidate) — it is filtered locally
    await expect(listRow.titleLink(page, chart.id)).toBeHidden();

    await openListFilteredByName(page, chart.title);
    await expect(listRow.titleLink(page, chart.id)).toBeVisible();
    await openListFilter(page, 'name');
    await page.getByTestId('chart-list-filter-favorites-checkbox').click();
    // the empty result unmounts the header (and this popover) — see C-L14
    await expect(emptyText(page)).toHaveText('No charts found');
  });

  test('C-L7 title link opens detail; edit icon opens edit', async ({ page, factory }) => {
    const chart = await factory.barChart('nav');
    await openListFilteredByName(page, chart.title);
    await listRow.titleLink(page, chart.id).click();
    await expect(page).toHaveURL(`/charts/${chart.id}`);

    await openListFilteredByName(page, chart.title);
    await page.getByTestId(`chart-list-edit-${chart.id}`).click();
    await expect(page).toHaveURL(`/charts/${chart.id}/edit`);
  });

  test('C-L8 duplicate → "Copy of X", again → "Copy of X (2)", copy of copy → "(3)"', async ({
    page,
    factory,
    track,
  }) => {
    const chart = await factory.barChart('dup');
    await openListFilteredByName(page, chart.title);

    const duplicate = async (sourceId: number) => {
      const req = captureRequest(page, { method: 'POST', url: /\/api\/charts\/$/ });
      const resp = page.waitForResponse(
        (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/charts/'
      );
      await openRowMenu(page, sourceId);
      await page.getByTestId(`chart-list-row-menu-duplicate-${sourceId}`).click();
      const created = (await (await resp).json()) as { id: number; title: string };
      track('charts', created.id);
      return { captured: await req, created };
    };

    const first = await duplicate(chart.id);
    expectPayloadSnapshot(first.captured, 'list-duplicate');
    expect(first.created.title).toBe(`Copy of ${chart.title}`);
    await expect(listRow.titleLink(page, first.created.id)).toHaveText(`Copy of ${chart.title}`);
    await expect(
      page.getByText(`Chart "${chart.title}" duplicated as "Copy of ${chart.title}" successfully!`)
    ).toBeVisible();

    const second = await duplicate(chart.id);
    expect(second.created.title).toBe(`Copy of ${chart.title} (2)`);
    await expect(listRow.titleLink(page, second.created.id)).toBeVisible();

    const third = await duplicate(first.created.id);
    expect(third.created.title).toBe(`Copy of ${chart.title} (3)`);
    await expect(listRow.titleLink(page, third.created.id)).toBeVisible();
  });

  test('C-L9 delete unused chart: dialog says "not used", cancel keeps, confirm deletes', async ({
    page,
    factory,
  }) => {
    const chart = await factory.barChart('del-unused');
    await openListFilteredByName(page, chart.title);

    await openRowMenu(page, chart.id);
    await page.getByTestId(`chart-list-row-menu-delete-${chart.id}`).click();
    const dialog = page.getByTestId('chart-delete-dialog');
    await expect(dialog).toContainText('Delete Chart');
    await expect(dialog).toContainText(`Are you sure you want to delete "${chart.title}"?`);
    await expect(dialog).toContainText('✓ This chart is not used in any dashboards');
    await page.getByTestId('chart-delete-cancel-btn').click();
    await expect(dialog).toBeHidden();
    await expect(listRow.titleLink(page, chart.id)).toBeVisible();

    await openRowMenu(page, chart.id);
    await page.getByTestId(`chart-list-row-menu-delete-${chart.id}`).click();
    await expect(page.getByTestId('chart-delete-confirm-btn')).toHaveText('DELETE CHART');
    const del = captureRequest(page, { method: 'DELETE', url: `/api/charts/${chart.id}/` });
    await page.getByTestId('chart-delete-confirm-btn').click();
    expectPayloadSnapshot(await del, 'list-delete-single');
    await expect(page.getByText(`${chart.title} deleted successfully`)).toBeVisible();
    await expect(listRow.titleLink(page, chart.id)).toBeHidden();
    await expect(emptyText(page)).toHaveText('No charts found');
  });

  test('C-L9 delete dialog lists dashboards using the chart', async ({ page, api, track }) => {
    const chart = await createChart(api, track, 'bar', 'del-used');
    const dash = await createDashboardUsingChart(api, track, 'del-used-dash', chart.id);
    await openListFilteredByName(page, chart.title);

    await openRowMenu(page, chart.id);
    await page.getByTestId(`chart-list-row-menu-delete-${chart.id}`).click();
    const dialog = page.getByTestId('chart-delete-dialog');
    await expect(dialog).toContainText('⚠️ This chart is used in 1 dashboard:');
    await expect(page.getByTestId(`chart-delete-dashboard-${dash.id}`)).toContainText(dash.title);
    await expect(page.getByTestId(`chart-delete-dashboard-${dash.id}`)).toContainText('native');
    await expect(page.getByTestId(`chart-delete-dashboard-link-${dash.id}`)).toHaveAttribute(
      'href',
      `/dashboards/${dash.id}`
    );
    await page.getByTestId('chart-delete-cancel-btn').click();
    await expect(dialog).toBeHidden();
  });

  test('C-L10 selection mode: select, select all, deselect all, exit', async ({
    page,
    api,
    track,
  }) => {
    const charts = await Promise.all(
      ['sel-a', 'sel-b', 'sel-c'].map((n) => createChart(api, track, 'bar', n))
    );
    await openListFilteredByName(page, e2eTitle('sel-'));
    await expect(allTitleLinks(page)).toHaveCount(3);
    const [a, b] = charts;

    await expect(page.getByTestId(`chart-select-checkbox-${a.id}`)).toBeHidden();
    await openRowMenu(page, a.id);
    await expect(page.getByTestId(`chart-list-row-menu-select-${a.id}`)).toHaveText('Select');
    await page.getByTestId(`chart-list-row-menu-select-${a.id}`).click();
    await expect(selectionBar(page)).toContainText('1 of 3 charts selected');
    await expect(page.getByTestId(`chart-select-checkbox-${a.id}`)).toBeChecked();
    await expect(page.getByTestId(`chart-select-checkbox-${b.id}`)).not.toBeChecked();
    await expect(page.getByTestId('chart-list-bulk-delete-btn')).toHaveText('Delete (1)');

    // menu item flips to Deselect and toggles off
    await openRowMenu(page, a.id);
    await expect(page.getByTestId(`chart-list-row-menu-select-${a.id}`)).toHaveText('Deselect');
    await page.getByTestId(`chart-list-row-menu-select-${a.id}`).click();
    await expect(selectionBar(page)).toContainText('0 of 3 charts selected');
    await expect(page.getByTestId('chart-list-bulk-delete-btn')).toBeDisabled();
    await expect(page.getByTestId('chart-list-deselect-all-btn')).toBeDisabled();

    await page.getByTestId('chart-list-select-all-btn').click();
    await expect(selectionBar(page)).toContainText('3 of 3 charts selected');
    await expect(page.getByTestId('chart-list-select-all-btn')).toBeDisabled();
    await expect(page.getByTestId('chart-list-bulk-delete-btn')).toHaveText('Delete (3)');

    await page.getByTestId('chart-list-deselect-all-btn').click();
    await expect(selectionBar(page)).toContainText('0 of 3 charts selected');

    await page.getByTestId(`chart-select-checkbox-${b.id}`).click();
    await expect(selectionBar(page)).toContainText('1 of 3 charts selected');

    await page.getByTestId('chart-list-exit-selection-btn').click();
    await expect(selectionBar(page)).toBeHidden();
    await expect(page.getByTestId(`chart-select-checkbox-${b.id}`)).toBeHidden();
  });

  test('C-L10 bulk delete: 1 vs many confirm text, cancel keeps, confirm deletes', async ({
    page,
    api,
    track,
  }) => {
    const [a, b, c] = await Promise.all(
      ['bulk-a', 'bulk-b', 'bulk-c'].map((n) => createChart(api, track, 'bar', n))
    );
    await openListFilteredByName(page, e2eTitle('bulk-'));
    await expect(allTitleLinks(page)).toHaveCount(3);

    await openRowMenu(page, a.id);
    await page.getByTestId(`chart-list-row-menu-select-${a.id}`).click();
    await page.getByTestId('chart-list-bulk-delete-btn').click();
    const confirm = page.getByTestId('chart-bulk-delete-confirm');
    await expect(confirm).toContainText('Delete Chart');
    await expect(confirm).toContainText(
      `This will permanently delete "${a.title}". This action cannot be undone.`
    );
    await page.getByTestId('chart-bulk-delete-confirm-cancel-btn').click();
    await expect(confirm).toBeHidden();
    await expect(selectionBar(page)).toContainText('1 of 3 charts selected');

    await page.getByTestId(`chart-select-checkbox-${b.id}`).click();
    await page.getByTestId('chart-list-bulk-delete-btn').click();
    await expect(confirm).toContainText('Delete Charts');
    await expect(confirm).toContainText(
      'This will permanently delete 2 charts. This action cannot be undone.'
    );
    await expect(confirm).toContainText(`• ${a.title}`);
    await expect(confirm).toContainText(`• ${b.title}`);
    await expect(page.getByTestId('chart-bulk-delete-confirm-confirm-btn')).toHaveText('DELETE');

    const req = captureRequest(page, { method: 'POST', url: '/api/charts/bulk-delete/' });
    await page.getByTestId('chart-bulk-delete-confirm-confirm-btn').click();
    expectPayloadSnapshot(redactIds(await req, { chartA: a.id, chartB: b.id }), 'list-bulk-delete');
    await expect(page.getByText('2 charts deleted successfully')).toBeVisible();
    await expect(selectionBar(page)).toBeHidden();
    await expect(listRow.titleLink(page, a.id)).toBeHidden();
    await expect(listRow.titleLink(page, b.id)).toBeHidden();
    await expect(listRow.titleLink(page, c.id)).toBeVisible();
  });

  test('[pinned] C-L11 pagination: next/prev (first Next bounces back) and every page size', async ({
    page,
  }) => {
    const first = await gotoChartsList(page);
    const prev = page.getByTestId('chart-list-prev-page-btn');
    const next = page.getByTestId('chart-list-next-page-btn');
    await expect(prev).toBeDisabled();
    await expect(next).toBeEnabled();
    await expect(counter(page)).toHaveText(`1–10 of ${first.total}`);

    // [pinned] first Next: page 2 is requested, then the view snaps back to page 1
    const p2 = page.waitForResponse((r) => r.url().includes('/api/charts/?page=2&page_size=10'));
    await pressButton(next);
    const second = (await (await p2).json()) as ListResponse;
    await expect(pageInfo(page)).toHaveText(`1 of ${first.total_pages}`);
    await expect(counter(page)).toHaveText(`1–10 of ${first.total}`);

    // second Next (page 2 now cached) lands
    await pressButton(next);
    await expect(counter(page)).toHaveText(`11–${Math.min(20, second.total)} of ${second.total}`);
    await expect(pageInfo(page)).toHaveText(`2 of ${second.total_pages}`);
    await expect(prev).toBeEnabled();
    await expect(allTitleLinks(page)).toHaveCount(second.data.length);

    await pressButton(prev);
    await expect(pageInfo(page)).toHaveText(/^1 of /);

    // page size change resets to page 1
    await nextListPage(page, 2);
    for (const size of [20, 50, 100, 10] as const) {
      const body = await setListPageSize(page, size);
      expect(body.page).toBe(1);
      await expect(pageInfo(page)).toHaveText(`1 of ${body.total_pages}`);
      await expect(counter(page)).toHaveText(`1–${Math.min(size, body.total)} of ${body.total}`);
      await expect(allTitleLinks(page)).toHaveCount(body.data.length);
      if (body.total_pages === 1) await expect(next).toBeDisabled();
    }
  });

  test('C-L11 current page clamps to the last page after the last row is deleted', async ({
    page,
  }) => {
    // Mocked list: 11 charts → page 2 holds one row; deleting it leaves 1 page
    const mk = (id: number) => ({
      id,
      title: `e2e-mock-${id}`,
      chart_type: 'bar',
      computation_type: 'aggregated',
      schema_name: 'production',
      table_name: 'mart_education_program',
      extra_config: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: new Date(Date.UTC(2026, 0, 1, 0, id - 990000)).toISOString(),
      created_by: 'mock@example.org',
      is_favorite: false,
      access_level: 'edit',
    });
    let ids = Array.from({ length: 11 }, (_, i) => 990001 + i);
    const listRoute = async (route: Route) => {
      const url = new URL(route.request().url());
      const pageNum = Number(url.searchParams.get('page'));
      const size = Number(url.searchParams.get('page_size'));
      const totalPages = Math.max(1, Math.ceil(ids.length / size));
      const slice = ids.slice((pageNum - 1) * size, pageNum * size);
      await route.fulfill({
        json: {
          data: slice.map(mk),
          total: ids.length,
          page: pageNum,
          page_size: size,
          total_pages: totalPages,
        },
      });
    };
    await page.route((u) => u.pathname === '/api/charts/' && u.search.includes('page='), listRoute);
    await page.route(/\/api\/charts\/99\d{4}\/dashboards\/$/, (r) => r.fulfill({ json: [] }));
    await page.route(/\/api\/charts\/99\d{4}\/$/, async (r) => {
      if (r.request().method() !== 'DELETE') return r.fallback();
      const id = Number(new URL(r.request().url()).pathname.split('/')[3]);
      ids = ids.filter((x) => x !== id);
      await r.fulfill({ json: { success: true } });
    });

    await page.goto('/charts');
    await expect(counter(page)).toHaveText('1–10 of 11');
    await nextListPage(page, 2);
    await expect(pageInfo(page)).toHaveText('2 of 2');
    await expect(counter(page)).toHaveText('11–11 of 11');
    const onlyId = (await visibleChartIds(page))[0];

    await openRowMenu(page, onlyId);
    await page.getByTestId(`chart-list-row-menu-delete-${onlyId}`).click();
    await page.getByTestId('chart-delete-confirm-btn').click();
    await expect(pageInfo(page)).toHaveText('1 of 1');
    await expect(counter(page)).toHaveText('1–10 of 10');
    await expect(allTitleLinks(page)).toHaveCount(10);
  });

  // Export submenu per type. Seeds are only exported (read-only); number has no seed → created.
  const exportCases = [
    { type: 'bar', formats: ['png', 'pdf'] },
    { type: 'line', formats: ['png', 'pdf'] },
    { type: 'pie', formats: ['png', 'pdf'] },
    { type: 'number', formats: ['png', 'pdf'] },
    { type: 'map', formats: ['png', 'pdf'] },
    { type: 'table', formats: ['csv'] },
    { type: 'pivot_table', formats: ['csv'] },
  ] as const;

  for (const { type, formats } of exportCases) {
    const chartFor = async (
      api: Parameters<typeof createChart>[0],
      track: Parameters<typeof createChart>[1]
    ) =>
      type === 'number'
        ? createChart(api, track, 'number', 'list-export-number')
        : SEED_CHARTS[type];

    test(`C-L12 export submenu for ${type} offers ${formats.join('+').toUpperCase()} only`, async ({
      page,
      api,
      track,
    }) => {
      const chart = await chartFor(api, track);
      await openListFilteredByName(page, chart.title);
      await openRowMenu(page, chart.id);
      await openMenu(
        page.getByTestId(`chart-list-export-trigger-${chart.id}`),
        page.getByTestId(`chart-list-export-${formats[0]}-${chart.id}`)
      );
      for (const f of ['png', 'pdf', 'csv'] as const) {
        const item = page.getByTestId(`chart-list-export-${f}-${chart.id}`);
        if ((formats as readonly string[]).includes(f)) await expect(item).toBeVisible();
        else await expect(item).toHaveCount(0);
      }
    });

    for (const f of formats) {
      if (type === 'table') continue; // pinned separately below — the export fails
      test(`C-L12 export ${type} as ${f.toUpperCase()} from the list downloads`, async ({
        page,
        api,
        track,
      }) => {
        const chart = await chartFor(api, track);
        await openListFilteredByName(page, chart.title);
        await openRowMenu(page, chart.id);
        await openMenu(
          page.getByTestId(`chart-list-export-trigger-${chart.id}`),
          page.getByTestId(`chart-list-export-${f}-${chart.id}`)
        );
        const download = await expectDownload(page, () =>
          page.getByTestId(`chart-list-export-${f}-${chart.id}`).click()
        );
        expect(download.suggestedFilename()).toMatch(exportFilenamePattern(chart.title, f));
        await expect(
          page.getByText(`${chart.title} exported as ${f.toUpperCase()} successfully!`)
        ).toBeVisible();
      });
    }
  }

  test('[pinned] C-L12 table CSV export from the list fails: payload lacks `dimensions`', async ({
    page,
    api,
    track,
  }) => {
    // handleTableCSVExport (ChartExportDropdownForList.tsx) sends only dimension_col, never the
    // `dimensions` array → backend 500 "At least one dimension is required for table charts"
    const chart = await createChart(api, track, 'table', 'list-export-table');
    await openListFilteredByName(page, chart.title);
    await openRowMenu(page, chart.id);
    await openMenu(
      page.getByTestId(`chart-list-export-trigger-${chart.id}`),
      page.getByTestId(`chart-list-export-csv-${chart.id}`)
    );
    let downloaded = false;
    page.on('download', () => (downloaded = true));
    const req = captureRequest(page, { method: 'POST', url: '/api/charts/chart-data-preview/' });
    const resp = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/api/charts/chart-data-preview/')
    );
    await page.getByTestId(`chart-list-export-csv-${chart.id}`).click();
    expectPayloadSnapshot(await req, 'list-export-table-csv-request');
    expect((await resp).status()).toBe(500);
    await expect(
      page.getByText('At least one dimension is required for table charts')
    ).toBeVisible();
    expect(downloaded).toBe(false);
  });

  test('C-L13 share icon opens the ShareModal for that chart', async ({ page, factory }) => {
    const chart = await factory.barChart('share');
    await openListFilteredByName(page, chart.title);
    const grants = page.waitForResponse((r) => r.url().includes(`/api/access/chart/${chart.id}/`));
    await page.getByTestId(`chart-list-share-${chart.id}`).click();
    await grants;
    const modal = page.getByTestId('share-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(chart.title);
    await page.getByTestId('share-close-btn').click();
    await expect(modal).toBeHidden();
  });

  test('C-L13 member: no Edit/Share icons on a chart they can only view', async ({
    factory,
    pageAs,
  }) => {
    const chart = await factory.barChart('list-member-view');
    const member = await pageAs('member');
    await openListFilteredByName(member, chart.title);
    await expect(listRow.titleLink(member, chart.id)).toBeVisible();
    await expect(member.getByTestId(`chart-list-edit-${chart.id}`)).toHaveCount(0);
    await expect(member.getByTestId(`chart-list-share-${chart.id}`)).toHaveCount(0);
    await expect(listRow.menu(member, chart.id)).toBeVisible();
  });

  test('[pinned] C-L14 empty state "No charts found"; header + filter popovers disappear', async ({
    page,
  }) => {
    await gotoChartsList(page);
    await openListFilter(page, 'name');
    await page.getByTestId('chart-list-filter-name-input').fill('zzz-no-chart-has-this-name');
    await expect(emptyText(page)).toHaveText('No charts found');
    // Pinned: the empty state replaces the whole table, so the open popover, the sort buttons
    // and every filter trigger unmount — only "Clear all" can undo the filter
    await expect(page.getByTestId('chart-list-filter-name-input')).toHaveCount(0);
    await expect(page.getByTestId('chart-list-filter-name-trigger')).toHaveCount(0);
    await expect(page.getByTestId('chart-list-sort-name')).toHaveCount(0);
    await expect(page.getByTestId('charts-empty-create-btn')).toHaveText('CREATE YOUR FIRST CHART');
    await expect(filterSummary(page)).toContainText('1 filter active');
    await page.getByTestId('chart-list-clear-all-filters-btn').click();
    await expect(emptyText(page)).toBeHidden();
    await expect(allTitleLinks(page).first()).toBeVisible();

    // empty-state CTA goes to the picker
    await openListFilter(page, 'name');
    await page.getByTestId('chart-list-filter-name-input').fill('zzz-no-chart-has-this-name');
    await page.getByTestId('charts-empty-create-btn').click();
    await expect(page).toHaveURL('/charts/new');
  });
});
