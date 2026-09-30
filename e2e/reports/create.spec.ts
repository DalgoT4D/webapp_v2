import { test, expect } from '../support/fixtures';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { e2eTitle, SEED } from '../support/env';
import { dismissFeatureNudges, pickDate, toast, withStableIds } from './helpers';

// Combobox id passed by create-snapshot-dialog → testids `${id}-input`, `${id}-item-${value}`
const DASHBOARD_PICKER = 'snapshot-dashboard-select';

interface CreatedReportResponse {
  data: { id: number; title: string };
}

async function openCreateDialog(page: import('@playwright/test').Page) {
  await page.goto('/reports');
  await page.getByTestId('create-report-btn').click();
  await expect(page.getByTestId('create-snapshot-dialog')).toBeVisible();
}

async function pickDashboard(page: import('@playwright/test').Page, dashboardId: number) {
  await page.getByTestId(`${DASHBOARD_PICKER}-input`).click();
  await page.getByTestId(`${DASHBOARD_PICKER}-item-${dashboardId}`).click();
}

test.describe('create report', () => {
  test.beforeEach(async ({ page }) => {
    await dismissFeatureNudges(page);
  });

  test('R-C1 dashboard with a date column: auto-selects it, end date required, POST payload', async ({
    page,
    track,
  }) => {
    const title = e2eTitle('create-dated');
    await openCreateDialog(page);

    // Seed 412 is only read here (a report snapshots it; the dashboard is not modified)
    await pickDashboard(page, SEED.dashboards.education);
    await expect(page.getByTestId(`${DASHBOARD_PICKER}-input`)).toHaveValue(
      'Education Program dashboard'
    );
    // The single datetime column is the dashboard's own filter column → auto-selected
    await expect(page.getByTestId('snapshot-date-column')).toHaveText(
      'mart_education_program.date'
    );
    await expect(page.getByTestId('snapshot-no-datetime-hint')).toHaveCount(0);

    await page.getByTestId('snapshot-report-name').fill(`  ${title}  `);

    // End date is required when the dashboard has date columns
    await page.getByTestId('snapshot-submit-btn').click();
    await expect(page.getByTestId('snapshot-end-date-error')).toHaveText(
      'Please select an end date'
    );

    await pickDate(page, 'snapshot-start-date', '06/01/2025');
    await pickDate(page, 'snapshot-end-date', '06/30/2026');
    await expect(page.getByTestId('snapshot-start-date-trigger')).toHaveText('Jun 1st, 2025');
    await expect(page.getByTestId('snapshot-end-date-trigger')).toHaveText('Jun 30th, 2026');
    await expect(page.getByTestId('snapshot-end-date-error')).toHaveCount(0);

    const post = captureRequest(page, { method: 'POST', url: /\/api\/reports\/$/ });
    const created = page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/reports/'
    );
    await page.getByTestId('snapshot-submit-btn').click();
    const body = (await (await created).json()) as CreatedReportResponse;
    track('reports', body.data.id);
    expectPayloadSnapshot(await post, 'report-create-dated');

    await expect(toast(page, 'Report created successfully!')).toBeVisible();
    await expect(page.getByTestId('create-snapshot-dialog')).toBeHidden();
    // List revalidates → the trimmed title shows up
    await expect(page.getByTestId(`report-row-title-${body.data.id}`)).toHaveText(title);
  });

  test('R-C2 dashboard without a date column: hint shown, date fields skipped in payload', async ({
    page,
    factory,
    track,
  }) => {
    // Empty dashboard → no chart tables → no datetime columns
    const dash = await factory.dashboard('create-nodate');
    const title = e2eTitle('create-nodate-rep');
    await openCreateDialog(page);

    await pickDashboard(page, dash.id);
    await expect(page.getByTestId('snapshot-no-datetime-hint')).toHaveText(
      'No datetime columns found — date filtering will be skipped.'
    );
    await expect(page.getByTestId('snapshot-date-column')).toBeDisabled();
    await expect(page.getByTestId('snapshot-date-column')).toHaveText('No date columns available');

    await page.getByTestId('snapshot-report-name').fill(title);
    const post = captureRequest(page, { method: 'POST', url: /\/api\/reports\/$/ });
    const created = page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/reports/'
    );
    await page.getByTestId('snapshot-submit-btn').click();
    const body = (await (await created).json()) as CreatedReportResponse;
    track('reports', body.data.id);
    // No end-date error even though no dates were picked
    await expect(page.getByTestId('snapshot-end-date-error')).toHaveCount(0);
    expectPayloadSnapshot(
      withStableIds(await post, { [dash.id]: 'dashboard' }),
      'report-create-no-date'
    );
    await expect(page.getByTestId('create-snapshot-dialog')).toBeHidden();
  });

  test('[pinned] R-C3 validation messages; Cancel does not reset the form', async ({ page }) => {
    // This test must never create a report: block the create POST outright
    await page.route(/\/api\/reports\/$/, (route) =>
      route.request().method() === 'POST' ? route.abort() : route.continue()
    );
    const draft = e2eTitle('create-draft');
    await openCreateDialog(page);

    // Nothing filled → dashboard + name errors (no date errors without a dashboard)
    await page.getByTestId('snapshot-submit-btn').click();
    await expect(page.getByTestId('snapshot-dashboard-error')).toHaveText(
      'Please select a dashboard'
    );
    await expect(page.getByTestId('snapshot-report-name-error')).toHaveText(
      'Please enter a report name'
    );
    await expect(page.getByTestId('snapshot-date-column-error')).toHaveCount(0);
    await expect(page.getByTestId('snapshot-end-date-error')).toHaveCount(0);

    // Whitespace-only name still fails
    await page.getByTestId('snapshot-report-name').fill('   ');
    await page.getByTestId('snapshot-submit-btn').click();
    await expect(page.getByTestId('snapshot-report-name-error')).toHaveText(
      'Please enter a report name'
    );

    // Dated dashboard selected → dashboard error clears; end date becomes required
    await pickDashboard(page, SEED.dashboards.education);
    // Wait for column discovery: submitting while it is still loading skips the date rules
    await expect(page.getByTestId('snapshot-date-column')).toHaveText(
      'mart_education_program.date'
    );
    await page.getByTestId('snapshot-report-name').fill(draft);
    await page.getByTestId('snapshot-submit-btn').click();
    await expect(page.getByTestId('snapshot-dashboard-error')).toHaveCount(0);
    await expect(page.getByTestId('snapshot-report-name-error')).toHaveCount(0);
    await expect(page.getByTestId('snapshot-end-date-error')).toHaveText(
      'Please select an end date'
    );

    // Pinned: Cancel only closes — reopening shows the previous draft (resetForm runs on success only)
    await page.getByTestId('snapshot-cancel-btn').click();
    await expect(page.getByTestId('create-snapshot-dialog')).toBeHidden();
    await page.getByTestId('create-report-btn').click();
    await expect(page.getByTestId('snapshot-report-name')).toHaveValue(draft);
    // Dashboard selection is kept too — the date column it produced is still selected
    // (the picker's input itself renders empty on reopen)
    await expect(page.getByTestId(`${DASHBOARD_PICKER}-input`)).toHaveValue('');
    await expect(page.getByTestId('snapshot-date-column')).toHaveText(
      'mart_education_program.date'
    );
    // …but the validation errors are cleared (values kept, errors dropped)
    await expect(page.getByTestId('snapshot-end-date-error')).toHaveCount(0);
  });

  test('[pinned] R-C3 submitting while date columns are still loading skips the date requirement', async ({
    page,
  }) => {
    // Hold the datetime-columns discovery response until after submit
    let releaseColumns: () => void = () => {};
    const columnsHeld = new Promise<void>((resolve) => (releaseColumns = resolve));
    await page.route(/\/api\/reports\/dashboards\/\d+\/datetime-columns\//, async (route) => {
      await columnsHeld;
      await route.continue();
    });
    // Never create a real report: answer the POST ourselves
    await page.route(/\/api\/reports\/$/, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 200, json: { success: true, data: { id: 0, title: 'x' } } })
        : route.continue()
    );

    await openCreateDialog(page);
    await pickDashboard(page, SEED.dashboards.education);
    await expect(page.getByTestId('snapshot-date-column')).toHaveText(
      'Discovering date columns...'
    );
    await page.getByTestId('snapshot-report-name').fill(e2eTitle('create-race'));

    const post = captureRequest(page, { method: 'POST', url: /\/api\/reports\/$/ });
    await page.getByTestId('snapshot-submit-btn').click();
    // Pinned: dashboard 412 HAS a date column, but the rules only apply once discovery finished,
    // so the report is created without date_column / period_end.
    expectPayloadSnapshot(await post, 'report-create-while-columns-loading');
    releaseColumns();
    await expect(page.getByTestId('create-snapshot-dialog')).toBeHidden();
  });
});
