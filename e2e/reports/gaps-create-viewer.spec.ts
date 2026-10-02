import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { expectChartScreenshot, waitForEChart } from '../support/render';
import { e2eTitle, SEED } from '../support/env';
import {
  createReport,
  createReportDashboard,
  dismissFeatureNudges,
  echartsInstance,
  pickDate,
  TINY_PDF,
  toast,
  withStableIds,
} from './helpers';
import {
  createTableMapDashboard,
  failRoute,
  FORCED_FAILURE,
  holdRoute,
  openReport,
} from './helpers-gaps';

// Combobox id passed by create-snapshot-dialog → testids `${id}-input`, `${id}-item-${value}`
const DASHBOARD_PICKER = 'snapshot-dashboard-select';
const CREATE_URL = /\/api\/reports\/$/;
const DATETIME_COLUMNS_URL = (dashboardId: number) =>
  new RegExp(`/api/reports/dashboards/${dashboardId}/datetime-columns/$`);
const EXPORT_URL = /\/api\/reports\/\d+\/export\/pdf\/$/;
const EMAIL_URL = /\/api\/reports\/\d+\/share\/email\/$/;
const PLACEHOLDER_PICK_COLUMN = 'Pick the date-time column to filter by';

/** Two datetime columns, neither of them a dashboard filter → nothing to auto-pick. */
const TWO_DATE_COLUMNS = [
  {
    schema_name: 'production',
    table_name: 'mart_education_program',
    column_name: 'date',
    data_type: 'DATE',
    is_dashboard_filter: false,
  },
  {
    schema_name: 'production',
    table_name: 'mart_education_program',
    column_name: 'enrolled_on',
    data_type: 'TIMESTAMP',
    is_dashboard_filter: false,
  },
];

async function openCreateDialog(page: Page) {
  await page.goto('/reports');
  await page.getByTestId('create-report-btn').click();
  await expect(page.getByTestId('create-snapshot-dialog')).toBeVisible();
}

async function pickDashboard(page: Page, dashboardId: number) {
  await page.getByTestId(`${DASHBOARD_PICKER}-input`).click();
  await page.getByTestId(`${DASHBOARD_PICKER}-item-${dashboardId}`).click();
}

/** Serve a fixed datetime-columns discovery response for one dashboard. */
async function mockDateColumns(page: Page, dashboardId: number, columns: unknown[]) {
  await page.route(DATETIME_COLUMNS_URL(dashboardId), (route) =>
    route.fulfill({ status: 200, json: { success: true, message: null, data: columns } })
  );
}

/** Answer the create POST ourselves (fake date columns would be rejected / must not persist). */
async function fakeCreate(page: Page) {
  await page.route(CREATE_URL, (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 200, json: { success: true, data: { id: 0, title: 'x' } } })
      : route.fallback()
  );
}

/** A day cell of the open calendar, by its accessible name (react-day-picker label). */
function day(page: Page, testId: string, label: RegExp) {
  return page.getByTestId(`${testId}-popover`).getByRole('button', { name: label });
}

/** Stage a date in an open picker through its edit box (moves the calendar to that month). */
async function stageDate(page: Page, testId: string, mmddyyyy: string) {
  await page.getByTestId(`${testId}-edit-btn`).click();
  const input = page.getByTestId(`${testId}-edit-input`);
  await input.fill(mmddyyyy);
  await input.press('Enter');
}

test.describe('create report — gaps', () => {
  // Shared staging backend under parallel load: these multi-request flows need the 3x budget
  test.slow();

  test.beforeEach(async ({ page }) => {
    await dismissFeatureNudges(page);
  });

  test('GAP-R create several date columns: none auto-picked, the chosen one is sent', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('gaps-create-multi');
    await mockDateColumns(page, dash.id, TWO_DATE_COLUMNS);
    await fakeCreate(page);
    await openCreateDialog(page);

    await pickDashboard(page, dash.id);
    const column = page.getByTestId('snapshot-date-column');
    await expect(column).toBeEnabled();
    // Neither column is a dashboard filter and there is more than one → no auto-pick
    await expect(column).toHaveText(PLACEHOLDER_PICK_COLUMN);
    await expect(page.getByTestId('snapshot-no-datetime-hint')).toHaveCount(0);

    await page.getByTestId('snapshot-report-name').fill(e2eTitle('gaps-create-multi-rep'));
    await pickDate(page, 'snapshot-end-date', '06/30/2026');
    // Column is required once columns exist
    await page.getByTestId('snapshot-submit-btn').click();
    await expect(page.getByTestId('snapshot-date-column-error')).toHaveText(
      'Please select a date-time column'
    );

    await column.click();
    await expect(page.getByRole('option')).toHaveText([
      'mart_education_program.date',
      'mart_education_program.enrolled_on',
    ]);
    await page
      .getByTestId('snapshot-date-column-option-production.mart_education_program.enrolled_on')
      .click();
    await expect(column).toHaveText('mart_education_program.enrolled_on');

    const post = captureRequest(page, { method: 'POST', url: CREATE_URL });
    await page.getByTestId('snapshot-submit-btn').click();
    expectPayloadSnapshot(
      withStableIds(await post, { [dash.id]: 'dashboard' }),
      'gaps-report-create-chosen-column'
    );
    await expect(page.getByTestId('create-snapshot-dialog')).toBeHidden();
  });

  test('GAP-R create start date cannot be after the end date or today', async ({ page }) => {
    await openCreateDialog(page);
    // Seed 412 is only read (dated dashboard → the duration pickers are active)
    await pickDashboard(page, SEED.dashboards.education);
    await expect(page.getByTestId('snapshot-date-column')).toHaveText(
      'mart_education_program.date'
    );

    // End date: nothing after today
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const monthDay = (d: Date) =>
      new RegExp(
        `${d.toLocaleDateString('en-US', { month: 'long' })} ${d.getDate()}\\w\\w, ${d.getFullYear()}`
      );
    await page.getByTestId('snapshot-end-date-trigger').click();
    await expect(day(page, 'snapshot-end-date', monthDay(today))).toBeEnabled();
    // fixedWeeks calendar always shows some days of the next month, so tomorrow is on screen
    await expect(day(page, 'snapshot-end-date', monthDay(tomorrow))).toBeDisabled();
    await page.getByTestId('snapshot-end-date-cancel-btn').click();

    // End = Jun 15 2026 → start can't go past it
    await pickDate(page, 'snapshot-end-date', '06/15/2026');
    await page.getByTestId('snapshot-start-date-trigger').click();
    await stageDate(page, 'snapshot-start-date', '06/10/2026');
    await expect(day(page, 'snapshot-start-date', /June 15th, 2026/)).toBeEnabled();
    await expect(day(page, 'snapshot-start-date', /June 16th, 2026/)).toBeDisabled();
    await expect(day(page, 'snapshot-start-date', /June 30th, 2026/)).toBeDisabled();
    await day(page, 'snapshot-start-date', /June 16th, 2026/).click({ force: true });
    await page.getByTestId('snapshot-start-date-ok-btn').click();
    // Clicking a disabled day did nothing — the staged Jun 10 was confirmed
    await expect(page.getByTestId('snapshot-start-date-trigger')).toHaveText('Jun 10th, 2026');
  });

  test('[pinned] GAP-R create typed start date bypasses the max-date limit', async ({ page }) => {
    await openCreateDialog(page);
    await pickDashboard(page, SEED.dashboards.education);
    await expect(page.getByTestId('snapshot-date-column')).toHaveText(
      'mart_education_program.date'
    );
    await pickDate(page, 'snapshot-end-date', '06/15/2026');
    // Pinned: the limit only disables calendar cells; the edit box accepts any parseable date
    await pickDate(page, 'snapshot-start-date', '12/31/2030');
    await expect(page.getByTestId('snapshot-start-date-trigger')).toHaveText('Dec 31st, 2030');
  });

  test('GAP-R create changing the dashboard clears the date column', async ({ page, factory }) => {
    const other = await factory.dashboard('gaps-create-switch');
    await mockDateColumns(page, other.id, TWO_DATE_COLUMNS);
    await openCreateDialog(page);

    await pickDashboard(page, SEED.dashboards.education);
    await expect(page.getByTestId('snapshot-date-column')).toHaveText(
      'mart_education_program.date'
    );
    // Switch → selection cleared; the new dashboard has 2 non-filter columns so nothing re-fills it
    await pickDashboard(page, other.id);
    await expect(page.getByTestId('snapshot-date-column')).toHaveText(PLACEHOLDER_PICK_COLUMN);
    await expect(page.getByTestId('snapshot-date-column')).toBeEnabled();
  });

  test('GAP-R create failure toast keeps the dialog open', async ({ page, factory }) => {
    const dash = await factory.dashboard('gaps-create-fail');
    await page.route(CREATE_URL, (route) =>
      route.request().method() === 'POST' ? failRoute(route) : route.fallback()
    );
    await openCreateDialog(page);
    await pickDashboard(page, dash.id);
    await expect(page.getByTestId('snapshot-no-datetime-hint')).toBeVisible();
    const title = e2eTitle('gaps-create-fail-rep');
    await page.getByTestId('snapshot-report-name').fill(title);

    const post = captureRequest(page, { method: 'POST', url: CREATE_URL });
    await page.getByTestId('snapshot-submit-btn').click();
    expectPayloadSnapshot(
      withStableIds(await post, { [dash.id]: 'dashboard' }),
      'gaps-report-create-failing'
    );
    await expect(toast(page, FORCED_FAILURE)).toBeVisible();
    await expect(toast(page, 'Report created successfully!')).toHaveCount(0);
    await expect(page.getByTestId('create-snapshot-dialog')).toBeVisible();
    await expect(page.getByTestId('snapshot-submit-btn')).toHaveText('Generate Report');
    await expect(page.getByTestId('snapshot-submit-btn')).toBeEnabled();
    await expect(page.getByTestId('snapshot-report-name')).toHaveValue(title);
  });
});

test.describe('report viewer — gaps', () => {
  // Shared staging backend under parallel load: these multi-request flows need the 3x budget
  test.slow();

  test('GAP-R viewer loading skeleton while the report loads', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'gaps-viewer-skel' });
    const report = await createReport(api, track, {
      name: 'gaps-viewer-skel-rep',
      dashboardId: dash.dashboardId,
    });
    const hold = await holdRoute(page, new RegExp(`/api/reports/${report.id}/view/$`));
    await page.goto(`/reports/${report.id}`);
    await hold.held;
    await expect(page.getByTestId('report-view-skeleton')).toBeVisible();
    await expect(page.getByTestId('report-title')).toHaveCount(0);
    hold.release();
    await expect(page.getByTestId('report-title')).toHaveText(report.title);
    await expect(page.getByTestId('report-view-skeleton')).toHaveCount(0);
  });

  test('GAP-R viewer frozen table and map charts render', async ({ page, api, track }) => {
    const dash = await createTableMapDashboard(api, track, 'gaps-viewer-tm');
    const report = await createReport(api, track, {
      name: 'gaps-viewer-tm-rep',
      dashboardId: dash.dashboardId,
    });
    const ids = {
      [report.id]: 'report',
      [-report.id]: 'report-date-filter',
      [dash.tableChartId]: 'table-chart',
      [dash.mapChartId]: 'map-chart',
    };
    const tableReq = captureRequest(page, {
      method: 'POST',
      url: new RegExp(`/api/reports/${report.id}/charts/${dash.tableChartId}/table-data/\\?`),
    });
    const mapReq = captureRequest(page, {
      method: 'POST',
      url: new RegExp(`/api/reports/${report.id}/charts/${dash.mapChartId}/map-data/`),
    });
    await openReport(page, report.id);
    expectPayloadSnapshot(withStableIds(await tableReq, ids), 'gaps-report-frozen-table-data');
    expectPayloadSnapshot(withStableIds(await mapReq, ids), 'gaps-report-frozen-map-data');

    await expect(page.getByRole('heading', { name: dash.tableTitle })).toBeVisible();
    await expect(page.getByRole('heading', { name: dash.mapTitle })).toBeVisible();
    // Frozen widgets: View + comment, no hover toolbar
    for (const chartId of [dash.tableChartId, dash.mapChartId]) {
      await expect(page.getByTestId(`dashboard-chart-view-btn-${chartId}`)).toBeVisible();
      await expect(page.getByTestId(`comment-trigger-chart-${chartId}`)).toBeVisible();
      await expect(page.getByTestId(`dashboard-chart-download-trigger-${chartId}`)).toHaveCount(0);
      await expect(page.getByTestId(`dashboard-chart-fullscreen-btn-${chartId}`)).toHaveCount(0);
    }

    // TODO testid: the table has no container testid — it is the only <table> on the canvas
    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader')).toHaveText(['statename', 'Students Reached']);
    await expect(table.getByRole('row', { name: /Uttar Pradesh/ })).toBeVisible();
    await expect(page.getByText('Showing 1 to 6 of 6 rows')).toBeVisible();
    await expectChartScreenshot(table, 'gaps-report-frozen-table');

    await waitForEChart(page.locator('main'));
    await expectChartScreenshot(echartsInstance(page), 'gaps-report-frozen-map');
  });

  test('GAP-R viewer KPI in a report has no download or fullscreen (the live dashboard does)', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, {
      name: 'gaps-viewer-kpi',
      withKpi: true,
    });
    const report = await createReport(api, track, {
      name: 'gaps-viewer-kpi-rep',
      dashboardId: dash.dashboardId,
    });
    const kpiId = dash.kpiId!;

    // Control: the same KPI on the live dashboard has both toolbar buttons
    await page.goto(`/dashboards/${dash.dashboardId}`);
    const liveCard = page.getByTestId(`kpi-card-${kpiId}`);
    await expect(liveCard).toBeVisible();
    await liveCard.hover();
    // TODO testid: KPI card toolbar buttons only have a title
    await expect(liveCard.getByRole('button', { name: 'Download' })).toBeVisible();
    await expect(liveCard.getByRole('button', { name: 'Fullscreen' })).toBeVisible();

    await openReport(page, report.id);
    const card = page.getByTestId(`kpi-card-${kpiId}`);
    await expect(card).toBeVisible();
    await card.hover();
    await expect(page.getByTestId(`dashboard-kpi-view-btn-${kpiId}`)).toBeVisible();
    await expect(page.getByTestId(`comment-trigger-kpi-${kpiId}`)).toBeVisible();
    await expect(card.getByRole('button', { name: 'Download' })).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Fullscreen' })).toHaveCount(0);
  });

  test('GAP-R viewer summary save failure keeps edit mode with a toast', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'gaps-viewer-savefail' });
    const report = await createReport(api, track, {
      name: 'gaps-viewer-savefail-rep',
      dashboardId: dash.dashboardId,
    });
    const reportUrl = new RegExp(`/api/reports/${report.id}/$`);
    await page.route(reportUrl, (route) =>
      route.request().method() === 'PUT' ? failRoute(route) : route.fallback()
    );
    await openReport(page, report.id);
    const summary = page.getByTestId('report-summary-textarea');

    await page.getByTestId('summary-edit-btn').click();
    await summary.fill('Never saved');
    const put = captureRequest(page, { method: 'PUT', url: reportUrl });
    await page.getByTestId('report-save-btn').click();
    expectPayloadSnapshot(await put, 'gaps-report-summary-put-failing');
    await expect(toast(page, FORCED_FAILURE)).toBeVisible();
    await expect(toast(page, 'Report saved successfully!')).toHaveCount(0);
    // Still editing, draft kept, buttons usable again
    await expect(page.getByTestId('report-save-btn')).toHaveText('Save');
    await expect(page.getByTestId('report-save-btn')).toBeEnabled();
    await expect(page.getByTestId('report-cancel-edit-btn')).toBeEnabled();
    await expect(summary).not.toHaveAttribute('readonly', '');
    await expect(summary).toHaveValue('Never saved');
    await expect(page.getByTestId('report-last-modified-by')).toHaveCount(0);
  });

  test('GAP-R viewer PDF filename strips special characters (export intercepted)', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'gaps-viewer-pdfname' });
    const report = await createReport(api, track, {
      name: 'pdf: Q1/Q2 (final)!',
      dashboardId: dash.dashboardId,
    });
    await page.route(EXPORT_URL, (route) =>
      route.fulfill({ status: 200, contentType: 'application/pdf', body: TINY_PDF })
    );
    await openReport(page, report.id);
    await expect(page.getByTestId('report-title')).toHaveText(e2eTitle('pdf: Q1/Q2 (final)!'));

    const exported = captureRequest(page, { method: 'POST', url: EXPORT_URL });
    const download = page.waitForEvent('download');
    await page.getByTestId('report-download-btn').click();
    expectPayloadSnapshot(
      withStableIds(await exported, { [report.id]: 'report', [-report.id]: 'report-date-filter' }),
      'gaps-report-export-pdf-special-title'
    );
    // Only letters, digits, spaces, "-" and "_" survive
    expect((await download).suggestedFilename()).toBe(`${e2eTitle('pdf Q1Q2 final')}.pdf`);
    await expect(toast(page, 'Report exported as PDF successfully!')).toBeVisible();
  });

  test('GAP-R viewer Email PDF send failure toast keeps the dialog open', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'gaps-viewer-mailfail' });
    const report = await createReport(api, track, {
      name: 'gaps-viewer-mailfail-rep',
      dashboardId: dash.dashboardId,
    });
    // Never reaches the backend mailer
    await page.route(EMAIL_URL, failRoute);
    await openReport(page, report.id);

    await page.getByTestId('report-email-pdf-btn').click();
    const dialog = page.getByTestId('share-via-email-dialog');
    await expect(dialog).toBeVisible();
    await page.getByTestId('share-email-input').fill('first@example.com');
    const sent = captureRequest(page, { method: 'POST', url: EMAIL_URL });
    await page.getByTestId('share-email-send-btn').click();
    expectPayloadSnapshot(await sent, 'gaps-report-share-email-failing');
    await expect(toast(page, FORCED_FAILURE)).toBeVisible();
    await expect(toast(page, /Report sent to/)).toHaveCount(0);
    // Dialog stays with the recipients kept, Send usable again
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('share-email-input')).toHaveValue('first@example.com');
    await expect(page.getByTestId('share-email-send-btn')).toBeEnabled();
  });
});
