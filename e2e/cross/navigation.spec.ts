import { test, expect } from '../support/fixtures';
import { captureRequest } from '../support/payload';
import { e2eTitle } from '../support/env';
import { createReport, createReportDashboard, openReport } from '../reports/helpers';
import { openChartDeleteDialog, openDashboardView, viewChartFromDashboard } from './helpers';

test.describe('cross-area navigation', () => {
  test('X-1 + X-4 dashboard → View Chart → back; → Edit → save → back; dashboard shows the edit', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'x1' });
    await openDashboardView(page, dash.dashboardId, dash.chartTitle);

    // View → "Back to Dashboard"
    await viewChartFromDashboard(page, dash.chartId, dash.chartTitle);
    await expect(page).toHaveURL(new RegExp(`/charts/${dash.chartId}\\?from=dashboard$`));
    const back = page.getByTestId('chart-detail-back-dashboard');
    await expect(back).toHaveText('Back to Dashboard');
    await back.click();
    await expect(page).toHaveURL(new RegExp(`/dashboards/${dash.dashboardId}$`));

    // View → Edit keeps the source; save → detail (replace) → back lands on the dashboard
    await viewChartFromDashboard(page, dash.chartId, dash.chartTitle);
    await page.getByTestId('chart-detail-edit-link').click();
    await expect(page).toHaveURL(new RegExp(`/charts/${dash.chartId}/edit\\?from=dashboard$`));
    await expect(page.getByTestId('chart-edit-back-button')).toHaveText('Back to Dashboard');

    const renamed = e2eTitle('x1-renamed');
    await expect(page.getByTestId('chart-name-input')).toHaveValue(dash.chartTitle);
    await page.getByTestId('chart-name-input').fill(renamed);
    await page.getByTestId('chart-edit-save-button').click();
    const put = captureRequest(page, { method: 'PUT', url: `/api/charts/${dash.chartId}/` });
    await page.getByTestId('chart-save-update-existing-btn').click();
    expect((await put).body).toMatchObject({ title: renamed });
    await expect(page).toHaveURL(new RegExp(`/charts/${dash.chartId}\\?from=dashboard$`));
    await page.getByTestId('chart-detail-back-dashboard').click();
    await expect(page).toHaveURL(new RegExp(`/dashboards/${dash.dashboardId}$`));

    // X-4: the dashboard cell resolves its title from the live chart → shows the rename
    await expect(page.getByRole('heading', { name: renamed, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: dash.chartTitle, exact: true })).toHaveCount(0);
    // …and after a full reload too
    await openDashboardView(page, dash.dashboardId, renamed);
  });

  test('X-2 report → View KPI → "Back to Report"', async ({ page, api, track, factory }) => {
    const dash = await createReportDashboard(api, factory, { name: 'x2', withKpi: true });
    const report = await createReport(api, track, {
      name: 'x2-rep',
      dashboardId: dash.dashboardId,
    });
    await openReport(page, report.id);

    await page.getByTestId(`dashboard-kpi-view-btn-${dash.kpiId}`).click();
    // /kpis?open=<id>&from=report opens the KPI drawer, then `open` is stripped (from is kept)
    await expect(page.getByRole('dialog')).toContainText('Average Female Scores');
    await expect(page).toHaveURL(/\/kpis\?from=report$/);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    const back = page.getByTestId('kpi-back-to-source');
    await expect(back).toHaveText('Back to Report');
    await back.click();
    await expect(page).toHaveURL(new RegExp(`/reports/${report.id}$`));
    await expect(page.getByTestId('report-title')).toHaveText(report.title);
  });

  test('X-3 delete a chart used in a dashboard: dialog lists it; dashboard cell errors after', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'x3' });
    await openChartDeleteDialog(page, dash.chartId, dash.chartTitle);

    const dialog = page.getByTestId('chart-delete-dialog');
    await expect(dialog).toContainText(`Are you sure you want to delete "${dash.chartTitle}"?`);
    await expect(dialog).toContainText('This chart is used in 1 dashboard:');
    const usage = page.getByTestId(`chart-delete-dashboard-${dash.dashboardId}`);
    await expect(usage).toContainText(dash.dashboardTitle);
    await expect(
      page.getByTestId(`chart-delete-dashboard-link-${dash.dashboardId}`)
    ).toHaveAttribute('href', `/dashboards/${dash.dashboardId}`);

    const del = page.waitForResponse(
      (r) => r.request().method() === 'DELETE' && r.url().includes(`/api/charts/${dash.chartId}/`)
    );
    await page.getByTestId('chart-delete-confirm-btn').click();
    expect((await del).ok()).toBe(true);
    await expect(page.getByTestId(`chart-list-title-link-${dash.chartId}`)).toHaveCount(0);

    // The dashboard still references the deleted chart → its cell shows the chart error state
    await page.goto(`/dashboards/${dash.dashboardId}`);
    await expect(page.getByTestId(`dashboard-chart-retry-btn-${dash.chartId}`)).toBeVisible();
    await expect(page.getByText('Chart Error')).toBeVisible();
  });
});
