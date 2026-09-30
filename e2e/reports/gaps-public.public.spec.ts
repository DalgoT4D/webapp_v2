import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { type Resource, ApiClient } from '../support/api-client';
import { type CapturedRequest, captureRequest, expectPayloadSnapshot } from '../support/payload';
import { e2eTitle } from '../support/env';
import {
  apiFactory,
  createReportDashboard,
  EDUCATION_DATE_COLUMN,
  REPORT_PERIOD,
  setReportGeneralAccess,
  withStableIds,
} from './helpers';
import { holdRoute } from './helpers-gaps';

/**
 * Logged-out gaps on the public report link: filters, print-mode `?dashboard_filters=`, loading.
 * Setup goes through the admin API session saved by global.setup (like share-report.public.spec).
 */

// Value used for the statename filter (present in production.mart_education_program)
const STATE = 'Assam';

// Public chart data can queue behind other specs' load on staging (captureRequest default 15s)
const PUBLIC_DATA_TIMEOUT_MS = 30_000;

let api: ApiClient;
const created: Array<{ resource: Resource; id: number }> = [];
let report: { id: number; title: string; token: string; chartId: number; filterId: number };

/** Public chart-data GET of the report's single frozen chart. */
function publicChartData(page: Page, extra = '') {
  return captureRequest(page, {
    method: 'GET',
    url: new RegExp(
      `/api/v1/public/reports/${report.token}/charts/${report.chartId}/data/${extra}`
    ),
    timeout: PUBLIC_DATA_TIMEOUT_MS,
  });
}

function stable(captured: CapturedRequest) {
  const tokenless = { ...captured, path: captured.path.replace(report.token, '<token>') };
  return withStableIds(tokenless, {
    [report.id]: 'report',
    [-report.id]: 'report-date-filter',
    [report.filterId]: 'state-filter',
    [report.chartId]: 'chart',
  });
}

test.describe('public report link — gaps (logged out)', () => {
  // Shared staging backend under parallel load: these multi-request flows need the 3x budget
  test.slow();

  test.beforeAll(async () => {
    api = await ApiClient.create();
    const dash = await createReportDashboard(api, apiFactory(api, created), {
      name: 'gaps-public',
      withFilter: true,
    });
    const res = await api.post<{ data: { id: number; title: string } }>('/api/reports/', {
      title: e2eTitle('gaps-public-rep'),
      dashboard_id: dash.dashboardId,
      date_column: EDUCATION_DATE_COLUMN,
      period_start: REPORT_PERIOD.start,
      period_end: REPORT_PERIOD.end,
    });
    created.push({ resource: 'reports', id: res.data.id });
    const token = await setReportGeneralAccess(res.data.id, 'public');
    if (!token) throw new Error(`report ${res.data.id}: no public_share_token after going public`);
    report = {
      id: res.data.id,
      title: res.data.title,
      token,
      chartId: dash.chartId,
      filterId: dash.filterId!,
    };
  });

  test.afterAll(async () => {
    for (const { resource, id } of [...created].reverse()) {
      await api.deleteResource(resource, id).catch(() => {});
    }
    await api.dispose();
  });

  test('GAP-R public report filters: apply a value filter → frozen chart refetched with it', async ({
    page,
  }) => {
    const initial = publicChartData(page);
    await page.goto(`/share/report/${report.token}`);
    await expect(page.getByTestId('public-report-title')).toHaveText(report.title);
    expectPayloadSnapshot(stable(await initial), 'gaps-public-report-chart-data-default');

    // Collapsed by default, same panel as the viewer — locked report dates included
    await expect(page.getByTestId('dashboard-filter-apply-btn')).toHaveCount(0);
    await page.getByTestId('dashboard-filter-panel-expand-btn').click();
    const dateFilterId = -report.id;
    await expect(
      page.getByTestId(`dashboard-filter-date-start-${dateFilterId}-trigger`)
    ).toBeDisabled();
    await expect(
      page.getByTestId(`dashboard-filter-date-end-${dateFilterId}-trigger`)
    ).toBeDisabled();

    await page.getByTestId(`dashboard-filter-value-${report.filterId}-container`).click();
    await page.getByTestId(`dashboard-filter-value-${report.filterId}-item-${STATE}`).click();
    await page.keyboard.press('Escape');
    const filtered = publicChartData(page, `.*${STATE}`);
    await page.getByTestId('dashboard-filter-apply-btn').click();
    expectPayloadSnapshot(stable(await filtered), 'gaps-public-report-chart-data-filtered');
    await expect(page.getByRole('button', { name: `Remove ${STATE}`, exact: true })).toBeVisible();

    // Clear all → back to the report defaults. No request is asserted here: the default-filter
    // key is usually still in SWR's cache, so whether it refetches depends on timing
    await page.getByTestId('dashboard-filter-clear-all-btn').click();
    await expect(page.getByRole('button', { name: `Remove ${STATE}`, exact: true })).toHaveCount(0);
    await expect(page.getByTestId('dashboard-filter-clear-all-btn')).toBeDisabled();
  });

  test('GAP-R print view with ?dashboard_filters= bakes the filter into chart data', async ({
    page,
  }) => {
    const filters = JSON.stringify({ [report.filterId]: [STATE] });
    const data = publicChartData(page);
    await page.goto(
      `/share/report/${report.token}?print=true&dashboard_filters=${encodeURIComponent(filters)}`
    );
    await expect(page.getByTestId('public-report-print')).toHaveAttribute('data-pdf-ready', 'true');
    const captured = await data;
    const query = captured.query.dashboard_filters as Record<string, unknown>;
    expect(query[String(report.filterId)]).toEqual([STATE]);
    expectPayloadSnapshot(stable(captured), 'gaps-public-report-print-filtered');
  });

  test('GAP-R print view ignores a bad ?dashboard_filters= (invalid JSON)', async ({ page }) => {
    const data = publicChartData(page);
    await page.goto(`/share/report/${report.token}?print=true&dashboard_filters=%7Bnot-json`);
    const print = page.getByTestId('public-report-print');
    await expect(print).toHaveAttribute('data-pdf-ready', 'true');
    await expect(print.getByRole('heading', { level: 1 })).toHaveText(report.title);
    const captured = await data;
    // Parse failure → no filters at all (not even an error page)
    expect(JSON.stringify(captured.query)).not.toContain(STATE);
    expectPayloadSnapshot(stable(captured), 'gaps-public-report-print-bad-filters');
  });

  test('GAP-R public "Loading report..." state while the report loads', async ({ page }) => {
    const hold = await holdRoute(page, new RegExp(`/api/v1/public/reports/${report.token}/view/$`));
    await page.goto(`/share/report/${report.token}`);
    await hold.held;
    const loading = page.getByTestId('public-report-loading');
    await expect(loading).toBeVisible();
    await expect(loading).toContainText('Loading report...');
    await expect(page.getByTestId('public-report')).toHaveCount(0);
    hold.release();
    await expect(page.getByTestId('public-report-title')).toHaveText(report.title);
    await expect(loading).toHaveCount(0);
  });
});
