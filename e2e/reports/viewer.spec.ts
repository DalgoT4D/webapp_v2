import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { expectChartScreenshot, waitForEChart } from '../support/render';
import { SEED } from '../support/env';
import {
  createReport,
  createReportDashboard,
  echartsInstance,
  openReport,
  REPORT_PERIOD_LABEL,
  TINY_PDF,
  toast,
  withStableIds,
} from './helpers';

// Value used when applying the statename filter (present in production.mart_education_program)
const STATE = 'Assam';
// Backend cap on email recipients (components/reports/utils.ts MAX_RECIPIENTS)
const MAX_RECIPIENTS = 20;

const EXPORT_URL = /\/api\/reports\/\d+\/export\/pdf\/$/;
const EMAIL_URL = /\/api\/reports\/\d+\/share\/email\/$/;

/** Frozen-chart data GET for one chart of a report (query carries dashboard_filters). */
function chartDataUrl(reportId: number, chartId: number) {
  return new RegExp(`/api/reports/${reportId}/charts/${chartId}/data/`);
}

/** Expand the collapsed report filter panel and pick one statename value, then Apply. */
async function applyStateFilter(page: Page, filterId: number) {
  await page.getByTestId('dashboard-filter-panel-expand-btn').click();
  await page.getByTestId(`dashboard-filter-value-${filterId}-container`).click();
  await page.getByTestId(`dashboard-filter-value-${filterId}-item-${STATE}`).click();
  await page.keyboard.press('Escape');
  await page.getByTestId('dashboard-filter-apply-btn').click();
}

test.describe('report viewer', () => {
  test('R-V1 header metadata, dashboard link, frozen chart renders without toolbar', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'viewer-header' });
    const report = await createReport(api, track, {
      name: 'viewer-header-rep',
      dashboardId: dash.dashboardId,
    });

    const data = captureRequest(page, {
      method: 'GET',
      url: chartDataUrl(report.id, dash.chartId),
    });
    await openReport(page, report.id);
    expectPayloadSnapshot(
      withStableIds(await data, {
        [report.id]: 'report',
        [-report.id]: 'report-date-filter',
        [dash.chartId]: 'chart',
      }),
      'report-viewer-frozen-chart-data'
    );

    await expect(page.getByTestId('report-title')).toHaveText(report.title);
    await expect(page.getByTestId('report-period')).toHaveText(REPORT_PERIOD_LABEL);
    await expect(page.getByTestId('report-created-by')).toHaveText(/^Created by: \S+@\S+$/);
    const link = page.getByTestId('report-dashboard-link');
    await expect(link).toHaveText(dash.dashboardTitle);
    await expect(link).toHaveAttribute('href', `/dashboards/${dash.dashboardId}`);

    // Editor actions (admin = edit access)
    await expect(page.getByTestId('report-download-btn')).toBeEnabled();
    await expect(page.getByTestId('report-share-btn')).toBeVisible();
    await expect(page.getByTestId('report-email-pdf-btn')).toBeVisible();
    await expect(page.getByTestId('request-edit-pill')).toHaveCount(0);

    // Summary: empty, read-only until Edit
    const summary = page.getByTestId('report-summary-textarea');
    await expect(summary).toHaveValue('');
    await expect(summary).toHaveAttribute('placeholder', 'Add your notes here');
    await expect(summary).toHaveAttribute('readonly', '');
    await expect(page.getByTestId('report-last-modified-by')).toHaveCount(0);

    // Frozen chart: title row with View + comment triggers, NO hover toolbar
    await expect(page.getByRole('heading', { name: dash.chartTitle })).toBeVisible();
    await expect(page.getByTestId(`dashboard-chart-view-btn-${dash.chartId}`)).toBeVisible();
    await expect(page.getByTestId(`comment-trigger-chart-${dash.chartId}`)).toBeVisible();
    await expect(page.getByTestId(`dashboard-chart-download-trigger-${dash.chartId}`)).toHaveCount(
      0
    );
    await expect(page.getByTestId(`dashboard-chart-fullscreen-btn-${dash.chartId}`)).toHaveCount(0);

    await waitForEChart(page.locator('main'));
    await expectChartScreenshot(echartsInstance(page), 'report-viewer-frozen-bar');

    await page.getByTestId('report-back-btn').click();
    await expect(page).toHaveURL(/\/reports$/);
  });

  test('R-V1 seed report 150 header (read-only view)', async ({ page }) => {
    await openReport(page, SEED.reports.education);
    await expect(page.getByTestId('report-title')).toHaveText('Education Program Annual Review');
    await expect(page.getByTestId('report-period')).toHaveText(REPORT_PERIOD_LABEL);
    await expect(page.getByTestId('report-dashboard-link')).toHaveText(
      'Education Program dashboard'
    );
    // Seed data: report 150 was snapshotted from dashboard 311 (not today's 412), and the link
    // follows report_metadata.dashboard_id
    await expect(page.getByTestId('report-dashboard-link')).toHaveAttribute(
      'href',
      '/dashboards/311'
    );
    await expect(page.getByTestId('report-summary-textarea')).toHaveValue(
      /^Education reach exceeded ten million students/
    );
    // Report mode: the dashboard's tabs render below the summary
    await expect(page.getByRole('tab', { name: 'Impact' })).toBeVisible();
  });

  test('R-V2 summary edit → save (PUT), cancel restores, unchanged save is a no-op', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'viewer-summary' });
    const report = await createReport(api, track, {
      name: 'viewer-summary-rep',
      dashboardId: dash.dashboardId,
    });
    await openReport(page, report.id);
    const summary = page.getByTestId('report-summary-textarea');

    // Save
    await page.getByTestId('summary-edit-btn').click();
    await expect(summary).not.toHaveAttribute('readonly', '');
    await expect(summary).toBeFocused();
    await summary.fill('Quarterly summary written by e2e');
    const put = captureRequest(page, { method: 'PUT', url: `/api/reports/${report.id}/` });
    await page.getByTestId('report-save-btn').click();
    expectPayloadSnapshot(await put, 'report-summary-put');
    await expect(toast(page, 'Report saved successfully!')).toBeVisible();
    await expect(page.getByTestId('report-save-btn')).toBeHidden();
    await expect(summary).toHaveValue('Quarterly summary written by e2e');
    await expect(summary).toHaveAttribute('readonly', '');
    await expect(page.getByTestId('report-last-modified-by')).toHaveText(
      /^Last updated by: \S+@\S+$/
    );

    // Cancel restores the saved value
    await page.getByTestId('summary-edit-btn').click();
    await summary.fill('discarded text');
    await page.getByTestId('report-cancel-edit-btn').click();
    await expect(summary).toHaveValue('Quarterly summary written by e2e');
    await expect(page.getByTestId('report-cancel-edit-btn')).toBeHidden();

    // Unchanged (whitespace-only difference) → exits edit mode without any PUT
    const puts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'PUT' && r.url().includes(`/api/reports/${report.id}/`))
        puts.push(r.url());
    });
    await page.getByTestId('summary-edit-btn').click();
    await summary.fill('Quarterly summary written by e2e   ');
    await page.getByTestId('report-save-btn').click();
    // The PUT would be sent before edit mode closes, so once Save is gone none was sent
    await expect(page.getByTestId('report-save-btn')).toBeHidden();
    expect(puts).toHaveLength(0);

    // Persisted across reload
    await page.reload();
    await expect(summary).toHaveValue('Quarterly summary written by e2e');
  });

  test('R-V3 filter panel collapsed; locked date filter; Clear all resets to defaults', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, {
      name: 'viewer-filters',
      withFilter: true,
    });
    const report = await createReport(api, track, {
      name: 'viewer-filters-rep',
      dashboardId: dash.dashboardId,
    });
    const filterId = dash.filterId!;
    // The frozen date range becomes a synthetic locked filter with id = -reportId
    const dateFilterId = -report.id;
    const ids = {
      [report.id]: 'report',
      [dateFilterId]: 'report-date-filter',
      [filterId]: 'state-filter',
      [dash.chartId]: 'chart',
    };

    await openReport(page, report.id);
    // Collapsed by default in report mode
    await expect(page.getByTestId('dashboard-filter-panel-expand-btn')).toBeVisible();
    await expect(page.getByTestId('dashboard-filter-apply-btn')).toHaveCount(0);

    await page.getByTestId('dashboard-filter-panel-expand-btn').click();
    await expect(page.getByTestId(`dashboard-filter-datetime-${dateFilterId}`)).toBeVisible();
    const start = page.getByTestId(`dashboard-filter-date-start-${dateFilterId}-trigger`);
    const end = page.getByTestId(`dashboard-filter-date-end-${dateFilterId}-trigger`);
    await expect(start).toBeDisabled();
    await expect(end).toBeDisabled();
    await expect(start).toHaveText('Jun 1st, 2025');
    await expect(end).toHaveText('Jun 1st, 2026');
    // Locked filter: no clear action, and it doesn't count as "applied"
    await page.getByTestId(`dashboard-filter-datetime-${dateFilterId}`).hover();
    await expect(page.getByTestId(`dashboard-filter-clear-${dateFilterId}`)).toHaveCount(0);
    await expect(page.getByTestId('dashboard-filter-clear-all-btn')).toBeDisabled();

    // Apply a value filter → chart data refetched with it
    await page.getByTestId('dashboard-filter-panel-collapse-btn').click();
    const filtered = captureRequest(page, {
      method: 'GET',
      url: new RegExp(`/api/reports/${report.id}/charts/${dash.chartId}/data/.*${STATE}`),
    });
    await applyStateFilter(page, filterId);
    expectPayloadSnapshot(withStableIds(await filtered, ids), 'report-viewer-chart-data-filtered');
    await expect(page.getByRole('button', { name: `Remove ${STATE}`, exact: true })).toBeVisible();
    await expect(page.getByTestId('dashboard-filter-clear-all-btn')).toBeEnabled();

    // Clear all → back to report defaults: value gone, locked dates kept
    await page.getByTestId('dashboard-filter-clear-all-btn').click();
    await expect(page.getByRole('button', { name: `Remove ${STATE}`, exact: true })).toHaveCount(0);
    await expect(page.getByTestId('dashboard-filter-clear-all-btn')).toBeDisabled();
    await expect(start).toHaveText('Jun 1st, 2025');
    await expect(end).toHaveText('Jun 1st, 2026');
  });

  test('R-V4 Download PDF posts the current filters (intercepted)', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, {
      name: 'viewer-pdf',
      withFilter: true,
    });
    const report = await createReport(api, track, {
      name: 'viewer-pdf-rep',
      dashboardId: dash.dashboardId,
    });
    const ids = {
      [report.id]: 'report',
      [-report.id]: 'report-date-filter',
      [dash.filterId!]: 'state-filter',
    };

    // Never hit the backend renderer
    await page.route(EXPORT_URL, (route) =>
      route.fulfill({ status: 200, contentType: 'application/pdf', body: TINY_PDF })
    );
    await openReport(page, report.id);

    // Defaults only
    let exported = captureRequest(page, { method: 'POST', url: EXPORT_URL });
    let download = page.waitForEvent('download');
    await page.getByTestId('report-download-btn').click();
    expectPayloadSnapshot(withStableIds(await exported, ids), 'report-export-pdf-defaults');
    expect((await download).suggestedFilename()).toBe(`${report.title}.pdf`);
    await expect(toast(page, 'Generating Report PDF...')).toBeVisible();
    await expect(toast(page, 'Report exported as PDF successfully!')).toBeVisible();
    await expect(page.getByTestId('report-download-btn')).toBeEnabled();

    // With a live value filter applied
    await applyStateFilter(page, dash.filterId!);
    await expect(page.getByRole('button', { name: `Remove ${STATE}`, exact: true })).toBeVisible();
    await expect(page.getByTestId('dashboard-filter-apply-btn')).toBeEnabled();
    exported = captureRequest(page, { method: 'POST', url: EXPORT_URL });
    download = page.waitForEvent('download');
    await page.getByTestId('report-download-btn').click();
    expectPayloadSnapshot(withStableIds(await exported, ids), 'report-export-pdf-filtered');
    await download;
  });

  test('R-V5 Email PDF dialog: validation + send (intercepted)', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'viewer-email' });
    const report = await createReport(api, track, {
      name: 'viewer-email-rep',
      dashboardId: dash.dashboardId,
    });
    // Never send real email from staging
    await page.route(EMAIL_URL, (route) =>
      route.fulfill({
        status: 200,
        json: { success: true, data: { recipients_count: 2, message: 'sent' } },
      })
    );
    await openReport(page, report.id);

    await page.getByTestId('report-email-pdf-btn').click();
    const dialog = page.getByTestId('share-via-email-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('share-email-subject')).toHaveValue(`Report: ${report.title}`);
    const input = page.getByTestId('share-email-input');
    const send = page.getByTestId('share-email-send-btn');
    await expect(send).toBeDisabled();

    // Only separators → no recipients
    await input.fill(' , ; ');
    await send.click();
    await expect(toast(page, 'Please enter at least one email address')).toBeVisible();

    // > 20 recipients
    const many = Array.from({ length: MAX_RECIPIENTS + 1 }, (_, i) => `user${i}@example.com`);
    await input.fill(many.join(', '));
    await send.click();
    await expect(toast(page, 'Maximum 20 recipients allowed')).toBeVisible();

    // Invalid addresses are listed
    await input.fill('not-an-email; ok@example.com, also bad');
    await send.click();
    await expect(toast(page, 'Invalid emails: not-an-email, also bad')).toBeVisible();
    await expect(dialog).toBeVisible();

    // Valid send → payload (subject trimmed), success toast, dialog closes
    await page.getByTestId('share-email-subject').fill('  Monthly report  ');
    await input.fill('first@example.com; second@example.com');
    const sent = captureRequest(page, { method: 'POST', url: EMAIL_URL });
    await send.click();
    expectPayloadSnapshot(await sent, 'report-share-email');
    await expect(toast(page, 'Report sent to 2 recipients')).toBeVisible();
    await expect(dialog).toBeHidden();

    // Reopen → form reset to defaults
    await page.getByTestId('report-email-pdf-btn').click();
    await expect(page.getByTestId('share-email-input')).toHaveValue('');
    await expect(page.getByTestId('share-email-subject')).toHaveValue(`Report: ${report.title}`);
    await page.getByTestId('share-email-cancel-btn').click();
    await expect(dialog).toBeHidden();
  });

  test('R-V6 View Chart opens ?from=report and "Back to Report" returns', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'viewer-nav' });
    const report = await createReport(api, track, {
      name: 'viewer-nav-rep',
      dashboardId: dash.dashboardId,
    });
    await openReport(page, report.id);

    await page.getByTestId(`dashboard-chart-view-btn-${dash.chartId}`).click();
    await expect(page).toHaveURL(new RegExp(`/charts/${dash.chartId}\\?from=report$`));
    const back = page.getByTestId('chart-detail-back-dashboard');
    await expect(back).toHaveText('Back to Report');
    await back.click();
    await expect(page).toHaveURL(new RegExp(`/reports/${report.id}$`));
    await expect(page.getByTestId('report-title')).toHaveText(report.title);
  });

  test('R-V7 invalid id and not-found states', async ({ page }) => {
    await page.goto('/reports');
    await page.goto('/reports/not-a-number');
    await expect(page.getByTestId('report-invalid-id')).toHaveText('Invalid report ID.');
    // Go Back = router.back()
    await page.getByTestId('report-go-back-btn').click();
    await expect(page).toHaveURL(/\/reports$/);

    await page.goto('/reports/0');
    await expect(page.getByTestId('report-invalid-id')).toBeVisible();

    await page.goto('/reports/999999999');
    await expect(page.getByTestId('report-load-error')).toHaveText('Failed to load report.');
    await expect(page.getByTestId('report-go-back-btn')).toBeVisible();
    await expect(page.getByTestId('report-title')).toHaveCount(0);
  });
});
