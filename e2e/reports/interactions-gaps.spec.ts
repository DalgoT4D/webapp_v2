import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { e2eTitle } from '../support/env';
import {
  createReport,
  createReportDashboard,
  dismissFeatureNudges,
  pickDate,
  setListFilter,
  withStableIds,
} from './helpers';
import { COMMENTS_URL, openReport } from './helpers-gaps';

/**
 * Interaction-coverage gaps (coverage/INTERACTIONS.md) in the reports area: list filter Clear
 * buttons + pagination controls, the viewer's dashboard link, the comment send button and the
 * create dialog's dashboard chevron / date-picker Clear + Cancel.
 */

// GET /api/reports/ with or without the filter query (never /api/reports/<id>/…)
const LIST_URL = /\/api\/reports\/(\?.*)?$/;
// Mocked list size: 3 pages at the default page size of 10 (app/reports/page.tsx DEFAULT_PAGE_SIZE)
const MOCK_ROWS = 25;
// Fake ids far outside the staging range — the mocked rows are never clicked
const MOCK_ID_BASE = 990_000;
const DATE_PLACEHOLDER = 'Pick a date';
// > app/reports/page.tsx FILTER_DEBOUNCE_MS (400) — long enough to see a page reset land
const STICK_TIMEOUT_MS = 1_000;

function mockRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: MOCK_ID_BASE + i,
    title: `e2e-mock-report-${String(i).padStart(2, '0')}`,
    dashboard_title: 'Mock dashboard',
    period_start: '2025-06-01',
    period_end: '2026-06-01',
    created_by: 'mock@example.com',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    access_level: 'edit',
  }));
}

async function pickPageSize(page: Page, size: 10 | 50) {
  await page.getByTestId('report-list-page-size').click();
  await page.getByTestId(`report-list-page-size-option-${size}`).click();
  await expect(page.getByTestId('report-list-page-size')).toHaveText(String(size));
}

test.describe('IG-reports list', () => {
  test.beforeEach(async ({ page }) => {
    await dismissFeatureNudges(page);
  });

  test('IG-reports list dashboard + creator filter Clear buttons empty their filter', async ({
    page,
  }) => {
    await page.goto('/reports');
    await expect(page.getByTestId('report-list-item-count')).toBeVisible({ timeout: 30_000 });

    for (const column of ['dashboard', 'creator'] as const) {
      await setListFilter(page, column, 'zz-ig-clear');
      await expect(page.getByTestId('report-list-active-filter-count')).toHaveText(
        '1 filter active'
      );
      await page.getByTestId(`report-filter-${column}-trigger`).click();
      await page.getByTestId(`report-filter-${column}-clear`).click();
      await expect(page.getByTestId(`report-filter-${column}`)).toHaveValue('');
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('report-list-active-filter-count')).toHaveCount(0);
    }
  });

  test('IG-reports list page size 50 / 10 and Prev page (mocked 25-row list)', async ({ page }) => {
    await page.route(LIST_URL, (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status: 200, json: { success: true, data: mockRows(MOCK_ROWS) } })
        : route.fallback()
    );
    await page.goto('/reports');
    const counter = page.getByTestId('report-list-page-counter');
    const prev = page.getByTestId('report-list-page-prev');
    await expect(counter).toHaveText('1 of 3', { timeout: 30_000 });
    await expect(prev).toBeDisabled();

    // The filter debounce also fires once on mount and resets to page 1 (FILTER_DEBOUNCE_MS after
    // load) — a Next click landing before it bounces back, so retry until page 2 sticks
    await expect(async () => {
      if ((await counter.textContent()) === '1 of 3') {
        await page.getByTestId('report-list-page-next').click();
      }
      await expect(counter).toHaveText('2 of 3', { timeout: STICK_TIMEOUT_MS });
    }).toPass();
    await expect(page.getByTestId('report-list-item-count')).toHaveText('11–20 of 25');
    await prev.click();
    await expect(counter).toHaveText('1 of 3');
    await expect(page.getByTestId('report-list-item-count')).toHaveText('1–10 of 25');
    await expect(prev).toBeDisabled();

    await pickPageSize(page, 50);
    await expect(counter).toHaveText('1 of 1');
    await expect(page.getByTestId('report-list-item-count')).toHaveText('1–25 of 25');
    await expect(page.locator('[data-testid^="report-row-title-"]')).toHaveCount(MOCK_ROWS);

    await pickPageSize(page, 10);
    await expect(counter).toHaveText('1 of 3');
    await expect(page.locator('[data-testid^="report-row-title-"]')).toHaveCount(10);
  });
});

test.describe('IG-reports viewer', () => {
  test.slow();

  test('IG-reports viewer dashboard link opens the source dashboard', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'ig-dash-link' });
    const report = await createReport(api, track, {
      name: 'ig-dash-link-rep',
      dashboardId: dash.dashboardId,
    });
    await openReport(page, report.id);
    const link = page.getByTestId('report-dashboard-link');
    await expect(link).toHaveText(dash.dashboardTitle);
    await expect(link).toHaveAttribute('href', `/dashboards/${dash.dashboardId}`);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/dashboards/${dash.dashboardId}$`));
    await expect(page.getByTestId('dashboard-view-back-btn')).toBeVisible({ timeout: 30_000 });
  });

  test('IG-reports comment send button posts the summary comment', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'ig-comment-send' });
    const report = await createReport(api, track, {
      name: 'ig-comment-send-rep',
      dashboardId: dash.dashboardId,
    });
    await openReport(page, report.id);
    await page.getByTestId('comment-trigger-summary').click();
    const submit = page.getByTestId('comment-submit-btn');
    await expect(submit).toBeDisabled();
    await page.getByTestId('comment-input').fill('Sent with the button');
    await expect(submit).toBeEnabled();

    const post = captureRequest(page, { method: 'POST', url: COMMENTS_URL(report.id) });
    await submit.click();
    const req = await post;
    expect(req.body).toMatchObject({ target_type: 'summary', content: 'Sent with the button' });
    expectPayloadSnapshot(withStableIds(req, { [report.id]: 'report' }), 'ig-reports-comment-send');
    await expect(page.getByTestId('comment-popover-summary')).toContainText('Sent with the button');
    await expect(page.getByTestId('comment-input')).toHaveValue('');
  });
});

test.describe('IG-reports create dialog', () => {
  test.slow();

  test.beforeEach(async ({ page }) => {
    await dismissFeatureNudges(page);
  });

  test('IG-reports create dialog dashboard chevron + start/end date Cancel and Clear', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'ig-create-dates' });
    await page.goto('/reports');
    await page.getByTestId('create-report-btn').click();
    await expect(page.getByTestId('create-snapshot-dialog')).toBeVisible();

    // Chevron opens the dashboard list
    await page.getByTestId('snapshot-dashboard-select-chevron').click();
    await page.getByTestId('snapshot-dashboard-select-input').fill(dash.dashboardTitle);
    await page.getByTestId(`snapshot-dashboard-select-item-${dash.dashboardId}`).click();
    await expect(page.getByTestId('snapshot-dashboard-select-input')).toHaveValue(
      dash.dashboardTitle
    );
    await expect(page.getByTestId('snapshot-date-column')).toHaveText(
      'mart_education_program.date',
      { timeout: 30_000 }
    );

    const start = page.getByTestId('snapshot-start-date-trigger');
    const end = page.getByTestId('snapshot-end-date-trigger');
    await pickDate(page, 'snapshot-start-date', '06/01/2025');
    await expect(start).toHaveText('Jun 1st, 2025');

    // Cancel drops a staged change
    await start.click();
    await page.getByTestId('snapshot-start-date-edit-btn').click();
    await page.getByTestId('snapshot-start-date-edit-input').fill('07/15/2025');
    await page.getByTestId('snapshot-start-date-edit-input').press('Enter');
    await page.getByTestId('snapshot-start-date-cancel-btn').click();
    await expect(page.getByTestId('snapshot-start-date-popover')).toBeHidden();
    await expect(start).toHaveText('Jun 1st, 2025');

    // Clear stages "no date"; OK commits it
    await start.click();
    await page.getByTestId('snapshot-start-date-clear-btn').click();
    await expect(page.getByTestId('snapshot-start-date-popover')).toContainText('No date');
    await page.getByTestId('snapshot-start-date-ok-btn').click();
    await expect(start).toHaveText(DATE_PLACEHOLDER);

    await pickDate(page, 'snapshot-end-date', '06/30/2026');
    await expect(end).toHaveText('Jun 30th, 2026');
    await end.click();
    await page.getByTestId('snapshot-end-date-clear-btn').click();
    await page.getByTestId('snapshot-end-date-ok-btn').click();
    await expect(end).toHaveText(DATE_PLACEHOLDER);

    // End date is required again → submit shows the error instead of creating
    await page.getByTestId('snapshot-report-name').fill(e2eTitle('ig-not-created'));
    await page.getByTestId('snapshot-submit-btn').click();
    await expect(page.getByTestId('snapshot-end-date-error')).toHaveText(
      'Please select an end date'
    );
  });
});
