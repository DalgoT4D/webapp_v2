import { test, expect } from '../support/fixtures';
import { type Resource, ApiClient } from '../support/api-client';
import { expectChartScreenshot, waitForEChart } from '../support/render';
import { e2eTitle, SEED } from '../support/env';
import {
  apiFactory,
  createReportDashboard,
  echartsInstance,
  EDUCATION_DATE_COLUMN,
  REPORT_PERIOD,
  REPORT_PERIOD_LABEL,
  setReportGeneralAccess,
} from './helpers';

/**
 * Logged-out (`public` project): public share links of e2e reports.
 * Setup runs through the admin API session saved by global.setup (playwright/.auth/admin.json),
 * so run the chromium project (or its setup) first when that session is stale.
 */

const SUMMARY = 'Public summary line one\n  indented line two';

interface Seeded {
  id: number;
  title: string;
  token: string;
}

let api: ApiClient;
const created: Array<{ resource: Resource; id: number }> = [];
let seedReport: Seeded; // from seed dashboard 412 (read-only source)
let chartReport: Seeded & { chartId: number }; // single factory bar chart → stable screenshot

async function createPublicReport(title: string, dashboardId: number): Promise<Seeded> {
  const res = await api.post<{ data: { id: number; title: string } }>('/api/reports/', {
    title,
    dashboard_id: dashboardId,
    date_column: EDUCATION_DATE_COLUMN,
    period_start: REPORT_PERIOD.start,
    period_end: REPORT_PERIOD.end,
  });
  created.push({ resource: 'reports', id: res.data.id });
  const token = await setReportGeneralAccess(res.data.id, 'public');
  if (!token) throw new Error(`report ${res.data.id}: no public_share_token after going public`);
  return { id: res.data.id, title: res.data.title, token };
}

test.describe('public report link (logged out)', () => {
  test.beforeAll(async () => {
    api = await ApiClient.create();
    seedReport = await createPublicReport(e2eTitle('public-seed-rep'), SEED.dashboards.education);
    await api.put(`/api/reports/${seedReport.id}/`, { summary: SUMMARY });

    const dash = await createReportDashboard(api, apiFactory(api, created), {
      name: 'public-chart',
    });
    chartReport = {
      ...(await createPublicReport(e2eTitle('public-chart-rep'), dash.dashboardId)),
      chartId: dash.chartId,
    };
  });

  test.afterAll(async () => {
    for (const { resource, id } of [...created].reverse()) {
      await api.deleteResource(resource, id).catch(() => {});
    }
    await api.dispose();
  });

  test('R-S1 public link renders header, summary and frozen canvas without editor controls', async ({
    page,
  }) => {
    await page.goto(`/share/report/${seedReport.token}`);
    await expect(page.getByTestId('public-report')).toBeVisible();
    await expect(page.getByTestId('public-report-title')).toHaveText(seedReport.title);
    await expect(page.getByTestId('public-report-period')).toHaveText(REPORT_PERIOD_LABEL);
    await expect(page.getByTestId('public-report-header')).toContainText('Public View');
    await expect(page.getByTestId('public-report-read-only-badge')).toHaveText('Read Only');
    // Whitespace preserved
    await expect(page.getByTestId('public-report-summary-text')).toHaveText(SUMMARY, {
      useInnerText: true,
    });
    // Seed dashboard 412's first tab renders in report mode
    await expect(page.getByRole('tab', { name: 'Impact' })).toBeVisible();

    // No comments / share / download / edit / widget navigation for anonymous viewers
    await expect(page.getByTestId(/^comment-trigger-/)).toHaveCount(0);
    await expect(page.getByTestId('report-download-btn')).toHaveCount(0);
    await expect(page.getByTestId('report-share-btn')).toHaveCount(0);
    await expect(page.getByTestId('summary-edit-btn')).toHaveCount(0);
    await expect(page.getByTestId(/^dashboard-(chart|kpi)-view-btn-/)).toHaveCount(0);
  });

  test('R-S1 public frozen chart screenshot', async ({ page }) => {
    await page.goto(`/share/report/${chartReport.token}`);
    await expect(page.getByTestId('public-report-title')).toHaveText(chartReport.title);
    // No summary set → no summary block
    await expect(page.getByTestId('public-report-summary')).toHaveCount(0);
    // Frozen chart has no hover toolbar in report mode
    await expect(
      page.getByTestId(`dashboard-chart-download-trigger-${chartReport.chartId}`)
    ).toHaveCount(0);
    await waitForEChart(page.getByTestId('public-report'));
    await expectChartScreenshot(echartsInstance(page), 'public-report-frozen-bar');
  });

  test('R-S2 print mode ?print=true → data-pdf-ready print layout', async ({ page }) => {
    await page.goto(`/share/report/${seedReport.token}?print=true`);
    const print = page.getByTestId('public-report-print');
    await expect(print).toBeVisible();
    await expect(print).toHaveAttribute('data-pdf-ready', 'true');
    await expect(print.getByRole('heading', { level: 1 })).toHaveText(seedReport.title);
    await expect(print).toContainText(REPORT_PERIOD_LABEL);
    await expect(print).toContainText(/Created by: \S+@\S+/);
    await expect(print).toContainText('Education Program dashboard');
    await expect(print).toContainText('Executive Summary');
    // Print header drops the interactive-view chrome
    await expect(print).not.toContainText('Public View');
    await expect(page.getByTestId('public-report-read-only-badge')).toHaveCount(0);
    await expect(page.getByTestId('public-report')).toHaveCount(0);
  });

  test('R-S3 invalid token → "Report Not Found" with sign-in link', async ({ page }) => {
    await page.goto('/share/report/definitely-not-a-real-token');
    const card = page.getByTestId('public-report-not-found');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Report Not Found');
    await expect(page.getByTestId('public-report-learn-more-btn')).toBeVisible();
    await page.getByTestId('public-report-sign-in-btn').click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
