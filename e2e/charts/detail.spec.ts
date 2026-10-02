import { test, expect } from '../support/fixtures';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { expectChartScreenshot, waitForChartData, waitForEChart } from '../support/render';
import type { Page } from '@playwright/test';
import {
  type ChartTypeId,
  type CreatedChart,
  ALL_CHART_TYPES,
  createChart,
  detailChartLocator,
  expectDownload,
  exportFilenamePattern,
  gotoChartDetail,
  openMenu,
  SEED_CHARTS,
} from './helpers-core';

/** MATRIX §1.5 — /charts/[id] view page. */

const isECharts = (t: ChartTypeId) => !['table', 'pivot_table'].includes(t);

/** Wait until the chart of `type` has drawn on the detail page. */
async function waitForDetailRender(page: Page, type: ChartTypeId) {
  const chart = detailChartLocator(page, type);
  if (isECharts(type)) {
    await waitForEChart(page.locator('body'));
  } else {
    await expect(chart).toBeVisible();
  }
  await waitForChartData(page);
}

// Per-type data request the detail page sends for the chart body
const DATA_URL: Record<ChartTypeId, string> = {
  bar: '/api/charts/chart-data/',
  line: '/api/charts/chart-data/',
  pie: '/api/charts/chart-data/',
  number: '/api/charts/chart-data/',
  pivot_table: '/api/charts/chart-data/',
  table: '/api/charts/chart-data-preview/',
  map: '/api/charts/map-data-overlay/',
};

test.describe('charts detail', () => {
  for (const type of ALL_CHART_TYPES) {
    test(`C-D1 ${type} chart renders (payload + screenshot)`, async ({ page, api, track }) => {
      const chart = await createChart(api, track, type, `detail-${type}`);
      const data = captureRequest(page, { method: 'POST', url: DATA_URL[type] });
      await gotoChartDetail(page, chart.id);
      expectPayloadSnapshot(await data, `detail-${type}-data-request`);

      await expect(page.getByRole('heading', { name: chart.title })).toBeVisible();
      await expect(page.getByTestId('chart-detail-created-by')).toHaveText(/^· Created by .+@/);
      await waitForDetailRender(page, type);
      await expectChartScreenshot(detailChartLocator(page, type), `detail-${type}`);
    });
  }

  const seededTypes = ['bar', 'line', 'pie', 'map', 'table', 'pivot_table'] as const;
  for (const type of seededTypes) {
    test(`C-D1 seeded ${type} chart renders`, async ({ page }) => {
      const seed = SEED_CHARTS[type];
      await gotoChartDetail(page, seed.id);
      await expect(page.getByRole('heading', { name: seed.title })).toBeVisible();
      await waitForDetailRender(page, type);
      if (type === 'pivot_table') {
        await expect(page.getByTestId('pivot-grand-total-row')).toBeVisible();
        await expect(page.getByTestId('pivot-row-0')).toBeVisible();
      }
      if (type === 'table') {
        await expect(page.getByTestId('chart-table-page-info')).toHaveText(/^Page 1 of \d+$/);
      }
    });
  }

  test('C-D1 missing chart shows the not-ready message', async ({ page }) => {
    await page.goto('/charts/999999999');
    await expect(
      page.getByText("Chart isn't ready yet. Please check your settings or try again later.")
    ).toBeVisible();
  });

  test('C-D2 Edit Chart link opens the edit page', async ({ page, factory }) => {
    const chart = await factory.barChart('detail-edit');
    await gotoChartDetail(page, chart.id);
    const edit = page.getByTestId('chart-detail-edit-link');
    await expect(edit).toHaveText('Edit Chart');
    await expect(edit).toHaveAttribute('href', `/charts/${chart.id}/edit`);
    await edit.click();
    await expect(page).toHaveURL(`/charts/${chart.id}/edit`);
  });

  test('C-D2 Share button opens and closes the ShareModal', async ({ page, factory }) => {
    const chart = await factory.barChart('detail-share');
    await gotoChartDetail(page, chart.id);
    await page.getByTestId('chart-detail-share-button').click();
    const modal = page.getByTestId('share-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(chart.title);
    await page.getByTestId('share-close-btn').click();
    await expect(modal).toBeHidden();
  });

  test('C-D2 ?openShare=true auto-opens share; closing strips the param', async ({
    page,
    factory,
  }) => {
    const chart = await factory.barChart('detail-openshare');
    await gotoChartDetail(page, chart.id, '?openShare=true');
    const modal = page.getByTestId('share-modal');
    await expect(modal).toBeVisible();
    await page.getByTestId('share-close-btn').click();
    await expect(modal).toBeHidden();
    await expect(page).toHaveURL(`/charts/${chart.id}`);
  });

  test('C-D2 member with view access: no Edit/Share, request-edit pill shown', async ({
    factory,
    pageAs,
  }) => {
    const chart = await factory.barChart('detail-member-view');
    const member = await pageAs('member');
    await gotoChartDetail(member, chart.id);
    await expect(member.getByRole('heading', { name: chart.title })).toBeVisible();
    await expect(member.getByTestId('chart-detail-edit-link')).toHaveCount(0);
    await expect(member.getByTestId('chart-detail-share-button')).toHaveCount(0);
    await expect(member.getByTestId('request-edit-pill')).toBeVisible();
    await expect(member.getByTestId('chart-export-trigger')).toBeVisible();
  });

  // ---- C-D3 export ----------------------------------------------------------------------

  const echartsExportTypes = ['bar', 'line', 'pie', 'number', 'map'] as const;
  for (const type of echartsExportTypes) {
    test(`C-D3 ${type} export menu lists PNG, PDF and CSV`, async ({ page, api, track }) => {
      const chart = await createChart(api, track, type, `detail-exportmenu-${type}`);
      await gotoChartDetail(page, chart.id);
      await waitForDetailRender(page, type);
      await openMenu(
        page.getByTestId('chart-export-trigger'),
        page.getByTestId('chart-export-png')
      );
      await expect(page.getByTestId('chart-export-png')).toHaveText('Export as PNG');
      await expect(page.getByTestId('chart-export-pdf')).toHaveText('Export as PDF');
      await expect(page.getByTestId('chart-export-csv')).toHaveText('Export Data as CSV');
    });

    test(`C-D3 ${type} export PNG downloads`, async ({ page, api, track }) => {
      const chart = await createChart(api, track, type, `detail-png-${type}`);
      await gotoChartDetail(page, chart.id);
      await waitForDetailRender(page, type);
      await exportAndCheck(page, chart, 'png');
      await expect(page.getByText('Chart exported as PNG')).toBeVisible();
    });

    test(`C-D3 ${type} export PDF downloads`, async ({ page, api, track }) => {
      const chart = await createChart(api, track, type, `detail-pdf-${type}`);
      await gotoChartDetail(page, chart.id);
      await waitForDetailRender(page, type);
      await exportAndCheck(page, chart, 'pdf');
      await expect(page.getByText('Chart exported as PDF')).toBeVisible();
    });

    test(`[pinned] C-D3 ${type} export CSV: server download, filename has two timestamps`, async ({
      page,
      api,
      track,
    }) => {
      // generateFilename() already appends a timestamp; the CSV branch appends another
      const chart = await createChart(api, track, type, `detail-csv-${type}`);
      await gotoChartDetail(page, chart.id);
      await waitForDetailRender(page, type);
      const csvReq = captureRequest(page, { method: 'POST', url: '/api/charts/download-csv/' });
      await exportAndCheck(page, chart, 'csv', 2);
      expectPayloadSnapshot(await csvReq, `detail-${type}-download-csv`);
      await expect(page.getByText('CSV downloaded successfully')).toBeVisible();
    });
  }

  for (const type of ['table', 'pivot_table'] as const) {
    test(`C-D3 ${type} export menu lists PNG and CSV only`, async ({ page, api, track }) => {
      const chart = await createChart(api, track, type, `detail-exportmenu-${type}`);
      await gotoChartDetail(page, chart.id);
      await waitForDetailRender(page, type);
      await openMenu(
        page.getByTestId('chart-export-trigger'),
        page.getByTestId('chart-export-png')
      );
      await expect(page.getByTestId('chart-export-csv')).toHaveText('Export to CSV');
      await expect(page.getByTestId('chart-export-pdf')).toHaveCount(0);
    });

    test(`C-D3 ${type} export PNG downloads`, async ({ page, api, track }) => {
      const chart = await createChart(api, track, type, `detail-png-${type}`);
      await gotoChartDetail(page, chart.id);
      await waitForDetailRender(page, type);
      await exportAndCheck(page, chart, 'png');
      await expect(page.getByText('Table exported as PNG')).toBeVisible();
    });
  }

  test('[pinned] C-D3 table export CSV: server download, filename has two timestamps', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChart(api, track, 'table', 'detail-csv-table');
    await gotoChartDetail(page, chart.id);
    await waitForDetailRender(page, 'table');
    const csvReq = captureRequest(page, { method: 'POST', url: '/api/charts/download-csv/' });
    await exportAndCheck(page, chart, 'csv', 2);
    expectPayloadSnapshot(await csvReq, 'detail-table-download-csv');
  });

  test('[pinned] C-D3 pivot export CSV is built client-side and always says "Grand Total"', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChart(api, track, 'pivot_table', 'detail-csv-pivot', (b) => ({
      ...b,
      extra_config: { ...b.extra_config, column_grand_total_label: 'All Districts' },
    }));
    await gotoChartDetail(page, chart.id);
    await waitForDetailRender(page, 'pivot_table');
    let serverCsv = false;
    page.on('request', (r) => {
      if (r.url().includes('/api/charts/download-csv/')) serverCsv = true;
    });
    const download = await exportAndCheck(page, chart, 'csv');
    expect(serverCsv).toBe(false);
    const csv = await readDownload(download);
    // custom label "All Districts" is ignored by exportPivotAsCsv (pivot-table/utils.ts)
    expect(csv).toContain('Grand Total');
    expect(csv).not.toContain('All Districts');
    await expect(page.getByText('CSV downloaded successfully')).toBeVisible();
  });

  // ---- C-D4 drill-down ------------------------------------------------------------------

  test('C-D4 table drill-down: click cell → filtered data, "← Back", export current view', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChart(api, track, 'table', 'detail-drill-table');
    await gotoChartDetail(page, chart.id);
    await waitForDetailRender(page, 'table');

    const cell = page.getByTestId('chart-table-drill-cell-0-statename');
    const value = (await cell.innerText()).trim();
    expect(value.length).toBeGreaterThan(0);

    const drillReq = captureRequest(page, {
      method: 'POST',
      url: '/api/charts/chart-data-preview/?',
    });
    await cell.click();
    const captured = await drillReq;
    const body = captured.body as { dimensions: string[]; extra_config: { filters: unknown[] } };
    expect(body.dimensions).toEqual(['districtname']);
    expect(body.extra_config.filters).toEqual([{ column: 'statename', operator: 'equals', value }]);

    await expect(page.getByTestId('chart-table-drill-back-btn')).toHaveText('← Back');
    await expect(page.getByText(`statename: ${value}`)).toBeVisible();
    await expect(page.getByTestId('chart-export-trigger')).toHaveText('Export current view');
    // last dimension: its cells are not drillable
    await expect(page.getByTestId('chart-table-drill-cell-0-districtname')).toHaveCount(0);

    // export filename carries the drill value
    await openMenu(page.getByTestId('chart-export-trigger'), page.getByTestId('chart-export-csv'));
    const download = await expectDownload(page, () => page.getByTestId('chart-export-csv').click());
    expect(download.suggestedFilename()).toMatch(
      exportFilenamePattern(`${chart.title} - ${value}`, 'csv', 2)
    );

    await page.getByTestId('chart-table-drill-back-btn').click();
    await expect(page.getByTestId('chart-table-drill-back-btn')).toBeHidden();
    await expect(page.getByTestId('chart-export-trigger')).toHaveText('Export');
    await expect(page.getByTestId('chart-table-drill-cell-0-statename')).toBeVisible();
  });

  test('C-D4 map drill-down: region click → toast, breadcrumb, Home returns', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChart(api, track, 'map', 'detail-drill-map');
    await gotoChartDetail(page, chart.id);
    await waitForDetailRender(page, 'map');
    await expect(page.getByTestId('chart-map-breadcrumb-home')).toHaveCount(0);

    // Click the middle of the map canvas (central India) to hit a state polygon
    const canvas = page.locator('div[_echarts_instance_] canvas').first();
    const box = (await canvas.boundingBox())!;
    const childRegions = page.waitForResponse((r) =>
      /\/api\/charts\/regions\/\d+\/geojsons\//.test(r.url())
    );
    await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.5);
    await expect(page.getByText(/^🗺️ Drilling down to district in .+/)).toBeVisible();
    await childRegions;
    await expect(page.getByTestId('chart-map-breadcrumb-home')).toBeVisible();
    await expect(page.getByTestId('chart-map-level-badge')).toBeVisible();

    await page.getByTestId('chart-map-breadcrumb-home').click();
    await expect(page.getByTestId('chart-map-breadcrumb-home')).toHaveCount(0);
  });

  test('C-D4 map zoom in/out buttons', async ({ page, api, track }) => {
    const chart = await createChart(api, track, 'map', 'detail-zoom-map');
    await gotoChartDetail(page, chart.id);
    await waitForDetailRender(page, 'map');
    await expect(page.getByTestId('chart-map-zoom-in')).toBeVisible();
    await page.getByTestId('chart-map-zoom-in').click();
    await page.getByTestId('chart-map-zoom-out').click();
    await expect(page.locator('div[_echarts_instance_] canvas').first()).toBeVisible();
  });

  // ---- C-D5 back variants ---------------------------------------------------------------

  test('C-D5 plain Back links to /charts', async ({ page, factory }) => {
    const chart = await factory.barChart('detail-back');
    await gotoChartDetail(page, chart.id);
    await expect(page.getByTestId('chart-detail-back-dashboard')).toHaveCount(0);
    await expect(page.getByTestId('chart-detail-back-link')).toHaveAttribute('href', '/charts');
    await expect(page.getByTestId('chart-detail-back-button')).toHaveText('Back');
    await page.getByTestId('chart-detail-back-button').click();
    await expect(page).toHaveURL('/charts');
  });

  for (const [from, label, origin] of [
    ['dashboard', 'Back to Dashboard', '/dashboards'],
    ['report', 'Back to Report', '/reports'],
  ] as const) {
    test(`C-D5 ?from=${from}: "${label}" goes back in history, edit link keeps from`, async ({
      page,
      factory,
    }) => {
      const chart = await factory.barChart(`detail-from-${from}`);
      await page.goto(origin);
      await gotoChartDetail(page, chart.id, `?from=${from}`);
      await expect(page.getByTestId('chart-detail-back-link')).toHaveCount(0);
      await expect(page.getByTestId('chart-detail-edit-link')).toHaveAttribute(
        'href',
        `/charts/${chart.id}/edit?from=${from}`
      );
      const back = page.getByTestId('chart-detail-back-dashboard');
      await expect(back).toHaveText(label);
      await back.click();
      await expect(page).toHaveURL(origin);
    });
  }

  test('C-D5 unknown ?from value falls back to plain Back', async ({ page, factory }) => {
    const chart = await factory.barChart('detail-from-bogus');
    await gotoChartDetail(page, chart.id, '?from=somewhere');
    await expect(page.getByTestId('chart-detail-back-button')).toHaveText('Back');
    await expect(page.getByTestId('chart-detail-edit-link')).toHaveAttribute(
      'href',
      `/charts/${chart.id}/edit`
    );
  });
});

async function exportAndCheck(
  page: Page,
  chart: CreatedChart,
  format: 'png' | 'pdf' | 'csv',
  timestamps = 1
) {
  await openMenu(
    page.getByTestId('chart-export-trigger'),
    page.getByTestId(`chart-export-${format}`)
  );
  const download = await expectDownload(page, () =>
    page.getByTestId(`chart-export-${format}`).click()
  );
  expect(download.suggestedFilename()).toMatch(
    exportFilenamePattern(chart.title, format, timestamps)
  );
  return download;
}

async function readDownload(download: import('@playwright/test').Download): Promise<string> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}
