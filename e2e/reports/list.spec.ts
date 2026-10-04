import { test, expect } from '../support/fixtures';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { e2eTitle, SEED } from '../support/env';
import {
  createReport,
  createReportDashboard,
  dismissFeatureNudges,
  setListFilter,
  toast,
  waitForListQuery,
} from './helpers';

// Default page size of the reports list (app/reports/page.tsx DEFAULT_PAGE_SIZE)
const DEFAULT_PAGE_SIZE = 10;

test.describe('reports list', () => {
  test.beforeEach(async ({ page }) => {
    await dismissFeatureNudges(page);
  });

  test('R-L1 loads seeded reports 150/151 and row click opens the viewer', async ({ page }) => {
    await page.goto('/reports');
    // Parallel e2e reports can push seeds past page 1 — show everything
    await page.getByTestId('report-list-page-size').click();
    await page.getByTestId('report-list-page-size-option-100').click();

    const edu = SEED.reports.education;
    await expect(page.getByTestId(`report-row-title-${edu}`)).toHaveText(
      'Education Program Annual Review'
    );
    await expect(page.getByTestId(`report-row-dashboard-${edu}`)).toHaveText(
      'Education Program dashboard'
    );
    await expect(page.getByTestId(`report-row-title-${SEED.reports.health}`)).toHaveText(
      'Health Sector Program Demo Report'
    );
    await expect(page.getByTestId(`report-row-dashboard-${SEED.reports.health}`)).toHaveText(
      'Health Sector Program Dashboard'
    );

    await page.getByTestId(`report-row-${edu}`).click();
    await expect(page).toHaveURL(new RegExp(`/reports/${edu}$`));
    await expect(page.getByTestId('report-title')).toHaveText('Education Program Annual Review');
  });

  test('R-L2 title/dashboard/creator filters send server params, count + Clear all', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'list-filter' });
    const report = await createReport(api, track, {
      name: 'list-filter-rep',
      dashboardId: dash.dashboardId,
    });

    await page.goto('/reports');
    await expect(page.getByTestId('report-list-item-count')).toBeVisible();

    // Title → ?search=
    const titleReq = captureRequest(page, { method: 'GET', url: /\/api\/reports\/\?search=/ });
    await setListFilter(page, 'title', report.title);
    expectPayloadSnapshot(await titleReq, 'reports-list-filter-title');
    await expect(page.getByTestId(`report-row-${report.id}`)).toBeVisible();
    await expect(page.getByTestId(`report-row-${SEED.reports.education}`)).toHaveCount(0);
    await expect(page.getByTestId('report-list-active-filter-count')).toHaveText('1 filter active');

    // + dashboard + creator → all three params in one request
    await setListFilter(page, 'dashboard', dash.dashboardTitle);
    const allReq = captureRequest(page, { method: 'GET', url: /created_by=/ });
    await setListFilter(page, 'creator', 'himanshu.dube13');
    expectPayloadSnapshot(await allReq, 'reports-list-filter-all');
    await expect(page.getByTestId('report-list-active-filter-count')).toHaveText(
      '3 filters active'
    );
    await expect(page.getByTestId(`report-row-${report.id}`)).toBeVisible();

    // Non-matching filter → no-match row (not the empty state)
    const noMatch = waitForListQuery(page, 'search', 'zz-no-such-report');
    await page.getByTestId('report-filter-title-trigger').click();
    await page.getByTestId('report-filter-title').fill('zz-no-such-report');
    await noMatch;
    await expect(page.getByTestId('report-list-no-match')).toHaveText(
      'No reports match the current filters'
    );
    await expect(page.getByTestId('report-list-item-count')).toHaveText('0–0 of 0');
    // Per-column Clear empties that input only
    await page.getByTestId('report-filter-title-clear').click();
    await expect(page.getByTestId('report-filter-title')).toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('report-list-active-filter-count')).toHaveText(
      '2 filters active'
    );

    await page.getByTestId('report-list-clear-all-filters').click();
    await expect(page.getByTestId('report-list-active-filter-count')).toBeHidden();
    await page.getByTestId('report-filter-creator-trigger').click();
    await expect(page.getByTestId('report-filter-creator')).toHaveValue('');
  });

  test('R-L3 sort toggles per column (new column starts desc) and pagination', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'list-sort' });
    // 11 reports → two pages at the default size of 10
    const created = [];
    for (let i = 0; i <= DEFAULT_PAGE_SIZE; i++) {
      const n = String(i).padStart(2, '0');
      created.push(
        await createReport(api, track, {
          name: `list-sort-${n}`,
          dashboardId: dash.dashboardId,
          dated: false,
        })
      );
    }
    const prefix = e2eTitle('list-sort-');
    const byTitleAsc = created.map((r) => r.id);

    await page.goto('/reports');
    const loaded = waitForListQuery(page, 'search', prefix);
    await setListFilter(page, 'title', prefix);
    await loaded;

    const rows = page.getByTestId(/^report-row-\d+$/);
    await expect(page.getByTestId('report-list-item-count')).toHaveText('1–10 of 11');
    await expect(page.getByTestId('report-list-page-counter')).toHaveText('1 of 2');
    await expect(page.getByTestId('report-list-page-prev')).toBeDisabled();
    await expect(page.getByTestId('report-list-page-next')).toBeEnabled();

    // Default sort = created_at desc → newest (last created) first
    await expect(rows.first()).toHaveAttribute('data-testid', `report-row-${byTitleAsc[10]}`);

    // Title: first click → desc, second → asc
    await page.getByTestId('report-list-sort-title').click();
    await expect(rows.first()).toHaveAttribute('data-testid', `report-row-${byTitleAsc[10]}`);
    await page.getByTestId('report-list-sort-title').click();
    await expect(rows.first()).toHaveAttribute('data-testid', `report-row-${byTitleAsc[0]}`);

    // Created on: switching column resets to desc → newest first; toggle → oldest first
    await page.getByTestId('report-list-sort-created-on').click();
    await expect(rows.first()).toHaveAttribute('data-testid', `report-row-${byTitleAsc[10]}`);
    await page.getByTestId('report-list-sort-created-on').click();
    await expect(rows.first()).toHaveAttribute('data-testid', `report-row-${byTitleAsc[0]}`);

    // Dashboard / Created by: every row has the same value → the stable sort re-sorts the
    // SERVER order (not the currently displayed order), so ties fall back to the API order
    const serverOrder = (
      await api.get<{ data: Array<{ id: number }> }>(
        `/api/reports/?search=${encodeURIComponent(prefix)}`
      )
    ).data.map((r) => r.id);
    await page.getByTestId('report-list-sort-dashboard').click();
    await expect(rows.first()).toHaveAttribute('data-testid', `report-row-${serverOrder[0]}`);
    await page.getByTestId('report-list-sort-created-by').click();
    await expect(rows.first()).toHaveAttribute('data-testid', `report-row-${serverOrder[0]}`);

    // Page 2
    // The trial "Getting started" pill is fixed over the bottom-right pager → keyboard-activate
    await page.getByTestId('report-list-page-next').press('Enter');
    await expect(page.getByTestId('report-list-item-count')).toHaveText('11–11 of 11');
    await expect(page.getByTestId('report-list-page-counter')).toHaveText('2 of 2');
    await expect(page.getByTestId('report-list-page-next')).toBeDisabled();
    await expect(rows).toHaveCount(1);

    // Changing page size resets to page 1
    await page.getByTestId('report-list-page-size').click();
    await page.getByTestId('report-list-page-size-option-20').click();
    await expect(page.getByTestId('report-list-page-counter')).toHaveText('1 of 1');
    await expect(page.getByTestId('report-list-item-count')).toHaveText('1–11 of 11');
    await expect(rows).toHaveCount(11);
  });

  test('[pinned] R-L3 deleting the only row of the last page leaves an empty page', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'list-lastpage' });
    const created = [];
    for (let i = 0; i <= DEFAULT_PAGE_SIZE; i++) {
      const n = String(i).padStart(2, '0');
      created.push(
        await createReport(api, track, {
          name: `list-lastpage-${n}`,
          dashboardId: dash.dashboardId,
          dated: false,
        })
      );
    }
    const oldest = created[0];

    await page.goto('/reports');
    const loaded = waitForListQuery(page, 'search', e2eTitle('list-lastpage-'));
    await setListFilter(page, 'title', e2eTitle('list-lastpage-'));
    await loaded;
    // The trial "Getting started" pill is fixed over the bottom-right pager → keyboard-activate
    await page.getByTestId('report-list-page-next').press('Enter');
    await expect(page.getByTestId(`report-row-${oldest.id}`)).toBeVisible();

    await page.getByTestId(`report-actions-${oldest.id}`).click();
    await page.getByTestId(`report-delete-${oldest.id}`).click();
    await page.getByTestId('report-delete-confirm-confirm-btn').click();
    await expect(toast(page, 'Report deleted successfully')).toBeVisible();

    // Pinned: currentPage is not clamped after the list shrinks — page 2 of 1, no rows
    await expect(page.getByTestId('report-list-no-match')).toBeVisible();
    await expect(page.getByTestId('report-list-page-counter')).toHaveText('2 of 1');
    await expect(page.getByTestId('report-list-item-count')).toHaveText('11–10 of 10');
  });

  test('R-L4 row menu: view, email PDF dialog, delete with confirm', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'list-menu' });
    const report = await createReport(api, track, {
      name: 'list-menu-rep',
      dashboardId: dash.dashboardId,
    });

    await page.goto('/reports');
    const loaded = waitForListQuery(page, 'search', report.title);
    await setListFilter(page, 'title', report.title);
    await loaded;

    await expect(page.getByTestId(`report-share-${report.id}`)).toBeVisible();

    // Email PDF → dialog prefilled subject, cancel closes
    await page.getByTestId(`report-actions-${report.id}`).click();
    await page.getByTestId(`report-email-pdf-${report.id}`).click();
    await expect(page.getByTestId('share-via-email-dialog')).toBeVisible();
    await expect(page.getByTestId('share-email-subject')).toHaveValue(`Report: ${report.title}`);
    await expect(page.getByTestId('share-email-send-btn')).toBeDisabled();
    await page.getByTestId('share-email-cancel-btn').click();
    await expect(page.getByTestId('share-via-email-dialog')).toBeHidden();

    // Delete → confirm dialog → cancel keeps the row
    await page.getByTestId(`report-actions-${report.id}`).click();
    await page.getByTestId(`report-delete-${report.id}`).click();
    const confirm = page.getByTestId('report-delete-confirm');
    await expect(confirm).toContainText('Delete report?');
    await expect(confirm).toContainText(`This will permanently delete "${report.title}"`);
    await page.getByTestId('report-delete-confirm-cancel-btn').click();
    await expect(page.getByTestId(`report-row-${report.id}`)).toBeVisible();

    // Delete → confirm
    const del = captureRequest(page, { method: 'DELETE', url: `/api/reports/${report.id}/` });
    await page.getByTestId(`report-actions-${report.id}`).click();
    await page.getByTestId(`report-delete-${report.id}`).click();
    await page.getByTestId('report-delete-confirm-confirm-btn').click();
    await del;
    await expect(toast(page, 'Report deleted successfully')).toBeVisible();
    await expect(page.getByTestId(`report-row-${report.id}`)).toHaveCount(0);

    // View Report item (on a fresh report) navigates to the viewer
    const other = await createReport(api, track, {
      name: 'list-menu-view',
      dashboardId: dash.dashboardId,
    });
    const reloaded = waitForListQuery(page, 'search', other.title);
    await page.getByTestId('report-filter-title-trigger').click();
    await page.getByTestId('report-filter-title').fill(other.title);
    await page.keyboard.press('Escape');
    await reloaded;
    await page.getByTestId(`report-actions-${other.id}`).click();
    await page.getByTestId(`report-view-${other.id}`).click();
    await expect(page).toHaveURL(new RegExp(`/reports/${other.id}$`));
  });
});
