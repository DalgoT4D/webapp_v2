import { type Page, expect } from '@playwright/test';

/**
 * Page helpers for flows that span charts ↔ dashboards ↔ reports.
 * Dashboard/report fixtures come from e2e/reports/helpers.ts (createReportDashboard / createReport).
 */

/** Open a dashboard in view mode and wait until the chart title (from live chart metadata) shows. */
export async function openDashboardView(page: Page, dashboardId: number, chartTitle: string) {
  await page.goto(`/dashboards/${dashboardId}`);
  await expect(page.getByRole('heading', { name: chartTitle, exact: true })).toBeVisible();
}

/**
 * Click a chart's "View Chart" button in dashboard view. It lives in a hover-revealed toolbar,
 * so hover the chart's title first.
 */
export async function viewChartFromDashboard(page: Page, chartId: number, chartTitle: string) {
  await page.getByRole('heading', { name: chartTitle, exact: true }).hover();
  await page.getByTestId(`dashboard-chart-view-btn-${chartId}`).click();
}

/** Charts list → name filter → row menu → Delete (opens the usage dialog). */
export async function openChartDeleteDialog(page: Page, chartId: number, chartTitle: string) {
  await page.goto('/charts');
  await page.getByTestId('chart-list-filter-name-trigger').click();
  await page.getByTestId('chart-list-filter-name-input').fill(chartTitle);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId(`chart-list-title-link-${chartId}`)).toBeVisible();
  await page.getByTestId(`chart-list-row-menu-${chartId}`).click();
  await page.getByTestId(`chart-list-row-menu-delete-${chartId}`).click();
  await expect(page.getByTestId('chart-delete-dialog')).toBeVisible();
}
