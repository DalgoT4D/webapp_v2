import { test, expect, installUiGuards } from '../support/fixtures';
import { installEmailGuard } from '../support/email-guard';
import { installInteractionRecorder } from '../support/interactions';
import { expectPayloadSnapshot, type CapturedRequest } from '../support/payload';
import { expectChartScreenshot, waitForEChart } from '../support/render';
import type { Locator, Page } from '@playwright/test';
import {
  API,
  createChartViaApi,
  dragTo,
  echartsRoot,
  field,
  findRegion,
  isAggregatedPreview,
  MAP_BASE_CONFIG,
  MAP_DISTRICT_HIERARCHY,
  mapTooltip,
  MtpBuilder,
  parkMouse,
  RequestLog,
  tableBodyRows,
  tableColumnCells,
  tableHeader,
} from './helpers-mtp';
import { failRequests, holdRequests, withoutPermissions } from './helpers-gaps';
import { chartCell, openView, putWidgets } from '../dashboards/helpers-view';
import { fetchForRewrite } from '../support/routes';

/**
 * FEATURES.md gap list › Charts — Map / Table / Pivot / Edit / Detail-map-toast lines.
 * Dataset: production.mart_education_program (6 states × 2 districts, 156 rows).
 */

const STATE = 'Rajasthan';
const SUM = 'SUM(students)';
const TOTAL_ROWS = 156;
// PRESET_COLORS[0] (#C8E6C9) — default conditional-formatting colour
const LIGHT_GREEN = 'rgb(200, 230, 201)';
const NO_BG = 'rgba(0, 0, 0, 0)';

const GEOJSON_URL = /\/api\/charts\/geojsons\/\d+\/$/;
const OVERLAY_URL = /\/api\/charts\/map-data-overlay\/$/;
// useAvailableRegionTypes / DynamicLevelConfig: all IND regions (no region_type)
const REGION_TYPES_URL = /\/api\/charts\/regions\/\?country_code=IND$/;
// ChartDetailClient useRegions('IND', 'state') — the drill-down region lookup
const STATE_REGIONS_URL = /\/api\/charts\/regions\/\?country_code=IND&region_type=state$/;
const TABLE_PREVIEW_URL = /\/api\/charts\/chart-data-preview\/\?/;
const COLUMN_VALUES_URL = /\/api\/warehouse\/column-values\//;

const json = (v: unknown) => JSON.stringify(v);
const dims = (c: CapturedRequest) => json(field(c.body, 'dimensions'));
const previewWithDims =
  (...d: string[]) =>
  (c: CapturedRequest) =>
    isAggregatedPreview(c) && dims(c) === json(d);

// ---------------------------------------------------------------------------
// Local page helpers
// ---------------------------------------------------------------------------

// Staging can take >10s to serve the builder's first render under parallel load
const PAGE_LOAD_MS = 30_000;

/** MtpBuilder.openCreate with a load wait sized for staging (same prefill waits). */
async function openCreate(b: MtpBuilder, type: 'map' | 'table' | 'pivot_table') {
  await b.page.goto(MtpBuilder.configureUrl(type));
  await expect(b.page.getByTestId('chart-name-input')).toBeVisible({ timeout: PAGE_LOAD_MS });
  if (type === 'table') await b.dataPreview.next(isAggregatedPreview);
  if (type === 'pivot_table') await b.chartData.next();
  if (type === 'map') await b.overlay.next();
}

/** Map create builder with SUM(students) by statename, rendered. */
async function openMapWithSum(page: Page) {
  const b = new MtpBuilder(page);
  await openCreate(b, 'map');
  b.overlay.mark();
  await b.setSimpleMetric(0, 'sum', 'students');
  await b.overlay.next((c) => field(c.body, 'metrics', 0, 'aggregation') === 'sum');
  await waitForEChart(b.preview);
  return b;
}

/** statename + districtname, SUM(students), sorted by SUM asc → 12 deterministic rows. */
async function openStateDistrictTable(page: Page) {
  const b = new MtpBuilder(page);
  await openCreate(b, 'table');
  await b.pickCombobox('chart-table-dimension-0', 'statename');
  await page.getByTestId('chart-table-dimension-add-btn').click();
  await b.pickCombobox('chart-table-dimension-1', 'districtname');
  await b.setSimpleMetric(0, 'sum', 'students');
  b.dataPreview.mark();
  await b.pickCombobox('chart-sort-column-select', SUM);
  await b.dataPreview.next(
    (c) =>
      previewWithDims('statename', 'districtname')(c) &&
      field(c.body, 'extra_config', 'sort', 0, 'column') === SUM
  );
  await expect(tableBodyRows(b.preview)).toHaveCount(12);
  return b;
}

async function turnDrillDownOn(b: MtpBuilder) {
  b.dataPreview.mark();
  await b.page.getByTestId('chart-table-drill-down-switch').click();
  await b.dataPreview.next(previewWithDims('statename'));
  await expect(b.page.getByTestId('chart-table-drill-cell-0-statename')).toBeVisible();
}

function pivotRowDims(rows: string[], cols: string[]) {
  return (c: CapturedRequest) =>
    json(field(c.body, 'row_dimensions')) === json(rows) &&
    json(field(c.body, 'column_dimensions')) === json(cols);
}

/** Pivot builder with `rows` × `cols`, SUM(students) (prefill: rows [id], cols [date]). */
async function openPivotWith(page: Page, rows: string[], cols: string[]) {
  const b = new MtpBuilder(page);
  await openCreate(b, 'pivot_table');
  await expect(page.getByTestId('pivot-table-chart')).toBeVisible();
  b.chartData.mark();
  await b.setSimpleMetric(0, 'sum', 'students');
  for (const [i, col] of rows.entries()) {
    if (i > 0) await page.getByTestId('add-row-dimension-btn').click();
    await b.pickCombobox(`pivot-row-dimension-${i}`, col);
  }
  for (const [i, col] of cols.entries()) {
    if (i > 0) await page.getByTestId('add-col-dimension-btn').click();
    await b.pickCombobox(`pivot-col-dimension-${i}`, col);
  }
  await b.chartData.next(
    (c) => pivotRowDims(rows, cols)(c) && field(c.body, 'metrics', 0, 'column') === 'students'
  );
  await expect(page.getByTestId('pivot-row-0')).toBeVisible();
  return b;
}

/**
 * Rewrite the GET /api/charts/{id}/ response — simulates legacy saved configs the backend no longer
 * accepts on create (e.g. side legend positions, maps without a GeoJSON id).
 */
async function rewriteChart(
  page: Page,
  id: number,
  mutate: (extra: Record<string, unknown>) => void
) {
  await page.route(new RegExp(`/api/charts/${id}/$`), async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    try {
      const response = await fetchForRewrite(route);
      if (!response) return;
      const body = (await response.json()) as { extra_config: Record<string, unknown> };
      mutate(body.extra_config);
      await route.fulfill({ response, json: body });
    } catch {
      /* page navigated away / closed mid-request */
    }
  });
}

/** A sonner toast by its text. TODO testid: sonner toasts have none; <li> in the toaster <ol>. */
function toast(page: Page, text: string | RegExp): Locator {
  return page.getByRole('listitem').filter({ hasText: text });
}

// ---------------------------------------------------------------------------
// Map: data configuration
// ---------------------------------------------------------------------------

test.describe('gaps — map data configuration', () => {
  test('GAP-C map "Loading Geographic Levels..." while region types load', async ({ page }) => {
    const gate = await holdRequests(page, REGION_TYPES_URL, 'GET');
    await page.goto(MtpBuilder.configureUrl('map'));
    await expect(page.getByText('Loading Geographic Levels...')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('chart-map-state-column-select-input')).toHaveCount(0);
    gate.release();
    await expect(page.getByText('Loading Geographic Levels...')).toBeHidden({ timeout: 30_000 });
    await expect(page.getByTestId('chart-map-state-column-select-input')).toHaveValue('statename');
  });

  test('GAP-C map configuration section only appears with a valid metric', async ({ page }) => {
    const b = new MtpBuilder(page);
    await openCreate(b, 'map');
    const section = page.getByText('Configure geographic levels and drill-down functionality');
    await expect(section).toBeVisible();
    await expect(page.getByTestId('chart-map-state-column-select-input')).toBeVisible();

    await page.getByTestId('remove-metric-0').click();
    await expect(section).toBeHidden();
    await expect(page.getByTestId('chart-map-state-column-select-input')).toHaveCount(0);
    await expect(page.getByTestId('chart-edit-save-button')).toBeDisabled();

    await page.getByTestId('add-metric-button').click();
    await expect(section).toBeVisible();
    await expect(page.getByTestId('chart-map-state-column-select-input')).toHaveValue('statename');
  });

  test('GAP-C map preview state: "Loading map boundaries..." while the GeoJSON loads', async ({
    page,
  }) => {
    const gate = await holdRequests(page, GEOJSON_URL, 'GET');
    const b = new MtpBuilder(page);
    await page.goto(MtpBuilder.configureUrl('map'));
    await expect(b.preview.getByText('Loading map boundaries...')).toBeVisible({ timeout: 30_000 });
    gate.release();
    await waitForEChart(b.preview);
    await expect(b.preview.getByText('Loading map boundaries...')).toHaveCount(0);
  });

  test('GAP-C map preview state: "Loading data..." overlay while the overlay loads', async ({
    page,
  }) => {
    const b = await openMapWithSum(page);
    const gate = await holdRequests(page, OVERLAY_URL, 'POST');
    await b.setSimpleMetric(0, 'max', 'students');
    await expect(b.preview.getByText('Loading data...')).toBeVisible();
    gate.release();
    await expect(b.preview.getByText('Loading data...')).toBeHidden({ timeout: 30_000 });
  });

  test('GAP-C map preview state: GeoJSON failure → configuration error', async ({ page }) => {
    await failRequests(page, GEOJSON_URL, { method: 'GET', detail: 'e2e geojson failure' });
    const b = new MtpBuilder(page);
    await page.goto(MtpBuilder.configureUrl('map'));
    const alert = b.preview.getByRole('alert');
    await expect(alert).toContainText(
      'Map configuration needs a small adjustment. Please review your settings and try again.',
      { timeout: 30_000 }
    );
    await expect(alert).toContainText('e2e geojson failure');
  });

  test('GAP-C map preview state: GeoJSON without boundaries → "Configure your map to see a preview"', async ({
    page,
  }) => {
    await page.route(GEOJSON_URL, (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status: 200, json: {} })
        : route.fallback()
    );
    const b = new MtpBuilder(page);
    await page.goto(MtpBuilder.configureUrl('map'));
    await expect(b.preview.getByText('Configure your map to see a preview')).toBeVisible({
      timeout: 30_000,
    });
    await expect(b.preview.getByText('Select country and GeoJSON to get started')).toBeVisible();
  });

  test('GAP-C map preview state: overlay failure → "Data needs attention"', async ({ page }) => {
    await failRequests(page, OVERLAY_URL, { method: 'POST', detail: 'e2e overlay failure' });
    const b = new MtpBuilder(page);
    await page.goto(MtpBuilder.configureUrl('map'));
    await expect(b.preview.getByText('Data needs attention: e2e overlay failure')).toBeVisible({
      timeout: 30_000,
    });
    // The boundaries still render underneath the warning
    await waitForEChart(b.preview);
  });

  test('GAP-C map colour scale widens when every region has the same value', async ({ page }) => {
    // Every region gets the same value → MapPreview widens the scale to [0, value] (MapPreview.tsx:175)
    await page.route(OVERLAY_URL, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      const response = await fetchForRewrite(route);
      if (!response) return;
      const body = (await response.json()) as { data?: Array<{ name: string; value: number }> };
      for (const row of body.data ?? []) row.value = 500;
      await route.fulfill({ response, json: body });
    });
    const b = await openMapWithSum(page);
    await findRegion(b.preview, STATE);
    await expect(mapTooltip(b.preview)).toHaveText(`${STATE}SUM(students): 500`);
    await parkMouse(page);
    await waitForEChart(b.preview);
    await expectChartScreenshot(b.preview, 'gap-map-single-value-scale');
  });
});

// ---------------------------------------------------------------------------
// Map: styling
// ---------------------------------------------------------------------------

test.describe('gaps — map styling', () => {
  const legacy: Array<{ value: string; shown: string; renders: string }> = [
    // MapCustomizations legacyMap; MapPreview's switch only knows corners (anything else → bottom-left)
    { value: 'left', shown: 'Bottom Left', renders: 'bottom-left' },
    { value: 'right', shown: 'Bottom Right', renders: 'bottom-left' },
    { value: 'top', shown: 'Top Left', renders: 'bottom-left' },
    { value: 'bottom', shown: 'Bottom Left', renders: 'bottom-left' },
  ];
  for (const { value, shown, renders } of legacy) {
    const odd = shown.toLowerCase().replace(' ', '-') !== renders;
    // [pinned] styling select maps right/top to a corner, but the preview renders them bottom-left
    test(`${odd ? '[pinned] ' : ''}GAP-C map legacy legend position "${value}" → "${shown}" in styling`, async ({
      page,
      api,
      track,
    }) => {
      const chart = await createChartViaApi(
        api,
        track,
        `gap-map-legacy-${value}`,
        'map',
        MAP_BASE_CONFIG
      );
      // Backend now rejects side values on save → serve them as an old saved chart would have them
      await rewriteChart(page, chart.id, (extra) => {
        (extra.customizations as Record<string, unknown>).legendPosition = value;
      });
      const b = new MtpBuilder(page);
      await b.openEdit(chart.id);
      await waitForEChart(b.preview);
      await b.stylingTab();
      await expect(page.getByTestId('chart-styling-legend-position')).toHaveText(shown);
      if (odd) {
        await parkMouse(page);
        await expectChartScreenshot(b.preview, `gap-map-legacy-legend-${value}`);
      }
    });
  }

  test('GAP-C map decimal places apply to the tooltip value', async ({ page }) => {
    const b = await openMapWithSum(page);
    await findRegion(b.preview, STATE);
    await expect(mapTooltip(b.preview)).toHaveText(new RegExp(`^${STATE}SUM\\(students\\): \\d+$`));
    await b.stylingTab();
    await page.getByTestId('mapDecimalPlaces').fill('2');
    await parkMouse(page);
    await waitForEChart(b.preview);
    await findRegion(b.preview, STATE);
    await expect(mapTooltip(b.preview)).toHaveText(
      new RegExp(`^${STATE}SUM\\(students\\): [\\d,]+\\.\\d{2}$`)
    );
  });

  test('GAP-C map legend hides in very small containers (dashboard cell)', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const chart = await createChartViaApi(api, track, 'gap-map-small', 'map', MAP_BASE_CONFIG);
    const dash = await factory.dashboard('gap-map-small-dash');
    const config = { chartId: chart.id, title: chart.title, chartType: 'map' };
    // Two cells of the same map: 2×7 (< 200×180 px → visualMap hidden) and 6×22 (legend shown)
    await putWidgets(api, dash.id, [
      { id: 'chart-small', type: 'chart', config, layout: { x: 0, y: 0, w: 2, h: 7 } },
      { id: 'chart-large', type: 'chart', config, layout: { x: 2, y: 0, w: 6, h: 22 } },
    ]);
    await openView(page, dash.id);
    const cells = chartCell(page, chart.id);
    await expect(cells).toHaveCount(2, { timeout: 30_000 });
    for (const cell of [cells.nth(0), cells.nth(1)]) await waitForEChart(cell);
    await parkMouse(page);
    const small = echartsRoot(cells.nth(0));
    const box = await small.boundingBox();
    expect(box!.width < 200 || box!.height < 180, `small cell ${box?.width}×${box?.height}`).toBe(
      true
    );
    await expectChartScreenshot(small, 'gap-map-small-cell-no-legend');
    await expectChartScreenshot(echartsRoot(cells.nth(1)), 'gap-map-large-cell-legend');
  });
});

// ---------------------------------------------------------------------------
// Map: save, edit, detail
// ---------------------------------------------------------------------------

test.describe('gaps — map edit / detail', () => {
  const FILTERS = [
    { column: 'climate_event', operator: 'equals', value: 'flood', data_type: 'text' },
  ];

  test('[pinned] GAP-C edit-builder map preview ignores the chart filters (detail sends them)', async ({
    page,
    api,
    track,
  }) => {
    // edit/page.tsx builds the overlay payload with `chart_filters: []`
    const chart = await createChartViaApi(api, track, 'gap-map-edit-filters', 'map', {
      ...MAP_BASE_CONFIG,
      filters: FILTERS,
    });
    const b = new MtpBuilder(page);
    await b.openEdit(chart.id);
    const editOverlay = await b.overlay.next();
    expectPayloadSnapshot(editOverlay, 'gap-map-edit-overlay-filters');
    expect(field(editOverlay.body, 'extra_config', 'filters')).toBeUndefined();

    const detailOverlay = new RequestLog(page, API.mapOverlay);
    await page.goto(`/charts/${chart.id}`);
    const sent = await detailOverlay.next();
    expectPayloadSnapshot(sent, 'gap-map-detail-overlay-filters');
    expect(field(sent.body, 'extra_config', 'filters')).toEqual(FILTERS);
  });
});

test.describe('gaps — detail page map toasts', () => {
  const main = (page: Page) => page.locator('main');

  async function openDetailMap(page: Page, id: number) {
    const overlay = new RequestLog(page, API.mapOverlay);
    await page.goto(`/charts/${id}`);
    await overlay.next();
    await waitForEChart(main(page));
  }

  test('GAP-C detail map "Region X not found in database" toast', async ({ page, api, track }) => {
    const chart = await createChartViaApi(api, track, 'gap-map-region-missing', 'map', {
      ...MAP_BASE_CONFIG,
      geographic_hierarchy: MAP_DISTRICT_HIERARCHY,
    });
    // The region lookup knows no states → the clicked one can't be resolved
    await page.route(STATE_REGIONS_URL, (route) => route.fulfill({ status: 200, json: [] }));
    await openDetailMap(page, chart.id);
    const { x, y } = await findRegion(main(page), STATE);
    await page.mouse.click(x, y);
    await expect(page.getByText(`Region "${STATE}" not found in database`)).toBeVisible();
    await expect(page.getByTestId('chart-map-breadcrumb-home')).toHaveCount(0);
  });

  const EMPTY_MAP_FILTERS = [
    { column: 'climate_event', operator: 'equals', value: 'flood' },
    { column: 'statename', operator: 'not_equals', value: 'Assam' },
  ];

  /**
   * Map with chart filters whose GeoJSON never loads → the "filtered map with no data" toasts
   * (ChartDetailClient.tsx:452). The backend requires a GeoJSON id, so the GET drops it (legacy chart).
   */
  async function createFilteredEmptyMap(
    page: Page,
    api: Parameters<typeof createChartViaApi>[0],
    track: Parameters<typeof createChartViaApi>[1]
  ) {
    const chart = await createChartViaApi(api, track, 'gap-map-filtered-empty', 'map', {
      ...MAP_BASE_CONFIG,
      filters: EMPTY_MAP_FILTERS,
    });
    await rewriteChart(page, chart.id, (extra) => {
      delete extra.selected_geojson_id;
    });
    return chart;
  }

  // [pinned] the builder's 'not_equals' reads "filtered", only legacy 'not equals' / '!=' read "excluded"
  test('[pinned] GAP-C detail filtered map with no data: one toast per filter, then a hint', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createFilteredEmptyMap(page, api, track);
    await page.goto(`/charts/${chart.id}`);
    const flood = toast(page, '🗺️ flood filtered from map');
    const assam = toast(page, '🗺️ Assam filtered from map');
    const hint = toast(page, '💡 Configure drill-down layers to see filtered regions');
    await expect(flood).toBeVisible({ timeout: 30_000 });
    await expect(flood).toContainText('Filter: climate_event equals flood');
    await expect(assam).toBeVisible();
    await expect(assam).toContainText('Filter: statename not_equals Assam');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText("Click 'Edit Chart' to set up geographic layers");
    await expect(flood).toHaveCount(1);
    await expect(assam).toHaveCount(1);
    await expect(hint).toHaveCount(1);
  });

  test('GAP-C detail map toast "Edit Chart" action opens the edit page (editor)', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createFilteredEmptyMap(page, api, track);
    await page.goto(`/charts/${chart.id}`);
    const hint = toast(page, '💡 Configure drill-down layers to see filtered regions');
    await expect(hint).toBeVisible({ timeout: 30_000 });
    await hint.getByRole('button', { name: 'Edit Chart' }).click();
    await expect(page).toHaveURL(`/charts/${chart.id}/edit`);
  });

  test('GAP-C detail map toasts have no "Edit Chart" action without edit permission', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createFilteredEmptyMap(page, api, track);
    await withoutPermissions(page, ['can_edit_charts']);
    await page.goto(`/charts/${chart.id}`);
    const hint = toast(page, '💡 Configure drill-down layers to see filtered regions');
    await expect(hint).toBeVisible({ timeout: 30_000 });
    await expect(hint).toContainText('Chart needs geographic layers to show filtered regions');
    await expect(hint.getByRole('button', { name: 'Edit Chart' })).toHaveCount(0);
  });

  const LEGACY_LAYERS = [
    { id: '0', level: 0, geographic_column: 'statename', geojson_id: 35 },
    {
      id: '1',
      level: 1,
      geographic_column: 'districtname',
      selected_regions: [{ region_id: 0, region_name: 'Kerala', geojson_id: 1 }],
    },
  ];

  test('GAP-C detail map "not configured" toast: Edit Chart action for editors only', async ({
    page,
    api,
    track,
    browser,
    touchedTestIds,
    blockedEmails,
  }) => {
    const chart = await createChartViaApi(api, track, 'gap-map-layers-action', 'map', {
      ...MAP_BASE_CONFIG,
      layers: LEGACY_LAYERS,
    });
    await openDetailMap(page, chart.id);
    const { x, y } = await findRegion(main(page), STATE);
    await page.mouse.click(x, y);
    const info = toast(page, `🗺️ ${STATE} not configured for drill-down`);
    await expect(info).toContainText('Configure this region in edit mode to enable drill-down');
    await info.getByRole('button', { name: 'Edit Chart' }).click();
    await expect(page).toHaveURL(`/charts/${chart.id}/edit`);

    // Same click without can_edit_charts → no action, viewer wording
    const ctx = await browser.newContext({
      storageState: test.info().project.use.storageState as string,
      baseURL: test.info().project.use.baseURL,
      viewport: test.info().project.use.viewport,
      reducedMotion: 'reduce',
    });
    await installInteractionRecorder(ctx, touchedTestIds);
    try {
      const viewer = await ctx.newPage();
      await installUiGuards(viewer);
      await installEmailGuard(viewer, blockedEmails);
      await withoutPermissions(viewer, ['can_edit_charts']);
      await openDetailMap(viewer, chart.id);
      const pos = await findRegion(main(viewer), STATE);
      await viewer.mouse.click(pos.x, pos.y);
      const viewerInfo = toast(viewer, `🗺️ ${STATE} not configured for drill-down`);
      await expect(viewerInfo).toContainText('This region is not configured for drill-down');
      await expect(viewerInfo.getByRole('button', { name: 'Edit Chart' })).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Table chart
// ---------------------------------------------------------------------------

test.describe('gaps — table chart', () => {
  test('GAP-C table ADD DIMENSION(s) disabled once every column is used', async ({ page, api }) => {
    const columns = await api.get<unknown[]>(
      `/api/warehouse/table_columns/production/mart_education_program`
    );
    const b = new MtpBuilder(page);
    await openCreate(b, 'table');
    const add = page.getByTestId('chart-table-dimension-add-btn');
    // Prefill uses one column; each click adds the next unused one
    for (let i = 1; i < columns.length; i++) {
      await expect(add).toBeEnabled();
      await add.click();
      await expect(page.getByTestId(`chart-table-dimension-${i}-input`)).toBeVisible();
    }
    await expect(add).toBeDisabled();
    await expect(page.getByTestId(`chart-table-dimension-${columns.length}-input`)).toHaveCount(0);
  });

  test('[pinned] GAP-C table turning drill-down off never asks for confirmation (even with level-scoped rules)', async ({
    page,
  }) => {
    // TableDimensionsSelector only confirms when `hasLevelScopedRules` is passed — no page passes it
    const b = await openStateDistrictTable(page);
    await turnDrillDownOn(b);
    await b.stylingTab();
    await page.getByTestId('add-formatting-rule-btn').click();
    await b.pickSelect('rule-column-0', `rule-column-0-option-${SUM}`);
    await b.pickSelect('rule-level-0', 'rule-level-0-option-districtname');
    await expect(page.getByTestId('rule-level-0')).toHaveText('districtname level');
    await b.dataTab();
    await page.getByTestId('chart-table-drill-down-switch').click();
    // Drill-down off immediately: both dimensions render again, no drill cells
    await expect(tableHeader(b.preview, 'districtname')).toBeVisible();
    await expect(page.getByTestId('chart-table-drill-cell-0-statename')).toHaveCount(0);
    await expect(page.getByTestId('chart-table-drill-off-confirm')).toHaveCount(0);
    await expect(page.getByTestId('chart-table-drill-down-switch')).not.toBeChecked();
  });

  test('GAP-C table with drill-down on, Column formatting lists only the shown dimension', async ({
    page,
  }) => {
    const b = await openStateDistrictTable(page);
    await b.stylingTab();
    await expect(page.getByTestId('alignment-districtname')).toBeVisible();
    await b.dataTab();
    await turnDrillDownOn(b);
    await b.stylingTab();
    await expect(page.getByTestId('alignment-statename')).toBeVisible();
    await expect(page.getByTestId(`alignment-${SUM}`)).toBeVisible();
    await expect(page.getByTestId('alignment-districtname')).toHaveCount(0);

    b.dataPreview.mark();
    await page.getByTestId('chart-table-drill-cell-0-statename').click();
    await b.dataPreview.next(previewWithDims('districtname'));
    await expect(page.getByTestId('alignment-districtname')).toBeVisible();
    await expect(page.getByTestId('alignment-statename')).toHaveCount(0);
  });

  test('GAP-C table "No numeric columns to format." message', async ({ page }) => {
    const b = new MtpBuilder(page);
    await openCreate(b, 'table');
    b.dataPreview.mark();
    await b.pickCombobox('chart-table-dimension-0', 'statename');
    await page.getByTestId('remove-metric-0').click();
    await b.dataPreview.next(
      (c) => previewWithDims('statename')(c) && json(field(c.body, 'metrics')) === '[]'
    );
    await b.stylingTab();
    await expect(page.getByText('No numeric columns to format.')).toBeVisible();
  });

  test('GAP-C table changing a rule column to another type resets the rule', async ({ page }) => {
    const b = await openStateDistrictTable(page);
    await b.stylingTab();
    await page.getByTestId('add-formatting-rule-btn').click();
    await expect(page.getByTestId('rule-column-0')).toHaveText('statename');
    await b.pickSelect('rule-operator-0', 'rule-operator-0-option-!=');
    await page.getByTestId('rule-value-0').fill('Assam');

    // text → numeric: operator ">" and value 0
    await b.pickSelect('rule-column-0', `rule-column-0-option-${SUM}`);
    await expect(page.getByTestId('rule-operator-0')).toHaveText('Greater than (>)');
    await expect(page.getByTestId('rule-value-0')).toHaveValue('0');
    await expect(page.getByTestId('rule-value-0')).toHaveAttribute('type', 'number');
    await b.pickSelect('rule-operator-0', 'rule-operator-0-option-<');
    await page.getByTestId('rule-value-0').fill('7');

    // numeric → numeric keeps the rule
    await b.pickSelect('rule-column-0', 'rule-column-0-option-districtname');
    // districtname is text → reset to "==" and empty value
    await expect(page.getByTestId('rule-operator-0')).toHaveText('Equal to (==)');
    await expect(page.getByTestId('rule-value-0')).toHaveValue('');
    await expect(page.getByTestId('rule-value-0')).toHaveAttribute('type', 'text');
  });

  test('GAP-C table per-level rule scope for metric columns when drill-down is on', async ({
    page,
  }) => {
    const b = await openStateDistrictTable(page);
    await b.stylingTab();
    await page.getByTestId('add-formatting-rule-btn').click();
    await b.pickSelect('rule-column-0', `rule-column-0-option-${SUM}`);
    // Drill-down off → no level scope
    await expect(page.getByTestId('rule-level-0')).toHaveCount(0);

    await b.dataTab();
    await turnDrillDownOn(b);
    await b.stylingTab();
    await expect(page.getByTestId('rule-level-0')).toHaveText('All levels');
    await expect(page.getByTestId('rule-scope-hint-0')).toHaveText(
      'This rule applies at every drill level.'
    );
    const [topCell] = await tableColumnCells(b.preview, SUM);
    // Default numeric rule "> 0" → every SUM cell matches at the top level
    await expect(topCell).toHaveCSS('background-color', LIGHT_GREEN);

    await b.pickSelect('rule-level-0', 'rule-level-0-option-districtname');
    await expect(page.getByTestId('rule-scope-hint-0')).toHaveText(
      "This rule applies only at the districtname level, and it won't be shown at the top level."
    );
    await expect(topCell).toHaveCSS('background-color', NO_BG);

    b.dataPreview.mark();
    await page.getByTestId('chart-table-drill-cell-0-statename').click();
    await b.dataPreview.next(previewWithDims('districtname'));
    await expect(tableBodyRows(b.preview)).toHaveCount(2);
    const [districtCell] = await tableColumnCells(b.preview, SUM);
    await expect(districtCell).toHaveCSS('background-color', LIGHT_GREEN);
  });

  test('GAP-C table search only looks at rows on the current page', async ({ page }) => {
    const b = new MtpBuilder(page);
    await openCreate(b, 'table');
    b.dataPreview.mark();
    await b.pickCombobox('chart-sort-column-select', 'id');
    await b.dataPreview.next((c) => field(c.body, 'extra_config', 'sort', 0, 'column') === 'id');
    await expect(tableBodyRows(b.preview)).toHaveCount(20);
    const page1Ids = await Promise.all(
      (await tableColumnCells(b.preview, 'id')).map(async (c) => (await c.textContent())!.trim())
    );
    // Last id of page 2 — not on page 1
    b.dataPreview.mark();
    await page.getByTestId('chart-table-next-page-btn').click();
    await b.dataPreview.next((c) => c.query.page === 1);
    await expect(page.getByTestId('chart-table-page-info')).toHaveText('Page 2 of 8');
    await expect(tableBodyRows(b.preview).first()).not.toContainText(page1Ids[0]);
    const page2Cells = await tableColumnCells(b.preview, 'id');
    const needle = (await page2Cells[page2Cells.length - 1].textContent())!.trim();
    expect(
      page1Ids.some((id) => id.includes(needle)),
      `"${needle}" also on page 1`
    ).toBe(false);

    const input = page.getByTestId('table-search-input');
    await input.fill(needle);
    await expect(page.getByTestId('table-search-count')).toHaveText('1 match');
    await page.getByTestId('chart-table-first-page-btn').click();
    await expect(page.getByTestId('chart-table-page-info')).toHaveText('Page 1 of 8');
    await expect(input).toHaveValue(needle);
    await expect(page.getByTestId('table-search-count')).toHaveText('0 matches');
  });

  for (const size of [10, 20, 100, 200] as const) {
    test(`GAP-C table page size ${size} → limit=${size}`, async ({ page }) => {
      const b = new MtpBuilder(page);
      await openCreate(b, 'table');
      await expect(page.getByTestId('chart-table-page-info')).toHaveText('Page 1 of 8');
      if (size === 20) {
        // 20 is the create default: the initial request carries limit=20. Switching 10 → 20 again
        // may be served from the SWR cache (same key), so only the UI is asserted after the switch.
        expectPayloadSnapshot(
          await b.dataPreview.next((c) => isAggregatedPreview(c) && c.query.limit === 20),
          `gap-table-page-size-${size}-preview`
        );
        b.dataPreview.mark();
        await b.pickSelect('chart-table-page-size', 'chart-table-page-size-option-10');
        await b.dataPreview.next((c) => c.query.limit === 10);
        await expect(tableBodyRows(b.preview)).toHaveCount(10);
        await b.pickSelect('chart-table-page-size', 'chart-table-page-size-option-20');
      } else {
        b.dataPreview.mark();
        await b.pickSelect('chart-table-page-size', `chart-table-page-size-option-${size}`);
        expectPayloadSnapshot(
          await b.dataPreview.next((c) => isAggregatedPreview(c) && c.query.limit === size),
          `gap-table-page-size-${size}-preview`
        );
      }
      await expect(page.getByTestId('chart-table-page-size')).toHaveText(String(size));
      await expect(page.getByTestId('chart-table-page-info')).toHaveText(
        `Page 1 of ${Math.ceil(TOTAL_ROWS / size)}`
      );
      await expect(tableBodyRows(b.preview)).toHaveCount(Math.min(size, TOTAL_ROWS));
    });
  }

  test('GAP-C table state "Loading table data..."', async ({ page }) => {
    const gate = await holdRequests(page, TABLE_PREVIEW_URL, 'POST');
    const b = new MtpBuilder(page);
    await page.goto(MtpBuilder.configureUrl('table'));
    await expect(b.preview.getByText('Loading table data...')).toBeVisible({ timeout: 30_000 });
    gate.release();
    await expect(tableBodyRows(b.preview).first()).toBeVisible({ timeout: 30_000 });
    await expect(b.preview.getByText('Loading table data...')).toHaveCount(0);
  });

  test('GAP-C table state "No data available" (filter matches nothing)', async ({ page }) => {
    const b = new MtpBuilder(page);
    await openCreate(b, 'table');
    await page.getByTestId('chart-add-filter-btn').click();
    await b.pickCombobox('chart-filter-column-0', 'statename');
    b.dataPreview.mark();
    await b.pickSelect('chart-filter-operator-0', 'chart-filter-operator-0-option-is_null');
    await b.dataPreview.next(
      (c) =>
        isAggregatedPreview(c) &&
        field(c.body, 'extra_config', 'filters', 0, 'operator') === 'is_null'
    );
    await expect(b.preview.getByText('No data available')).toBeVisible();
    await expect(b.preview.getByText('Configure your table to display data')).toBeVisible();
  });

  test('[pinned] GAP-C table state "No columns configured" (rows without columns)', async ({
    page,
  }) => {
    // Reachable only when the response has rows but neither `columns` nor row keys
    await page.route(TABLE_PREVIEW_URL, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 200, json: { data: [{}], columns: [] } })
        : route.fallback()
    );
    const b = new MtpBuilder(page);
    await page.goto(MtpBuilder.configureUrl('table'));
    await expect(b.preview.getByText('No columns configured')).toBeVisible({ timeout: 30_000 });
    await expect(b.preview.getByText('Select columns to display in the table')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Pivot table
// ---------------------------------------------------------------------------

test.describe('gaps — pivot table', () => {
  const pivot = (page: Page) => page.getByTestId('pivot-table');

  test('GAP-C pivot reorder row dimensions by drag', async ({ page }) => {
    const b = await openPivotWith(page, ['statename', 'districtname'], ['climate_event']);
    b.chartData.mark();
    await dragTo(page.getByTestId('drag-row-dim-0'), page.getByTestId('drag-row-dim-1'));
    const req = await b.chartData.next(
      pivotRowDims(['districtname', 'statename'], ['climate_event'])
    );
    expectPayloadSnapshot(req, 'gap-pivot-row-reorder-chart-data');
    await expect(page.getByTestId('pivot-row-dimension-0-input')).toHaveValue('districtname');
    await expect(page.getByTestId('pivot-row-dimension-1-input')).toHaveValue('statename');
  });

  test('GAP-C pivot reorder column dimensions by drag', async ({ page }) => {
    const b = await openPivotWith(page, ['statename'], ['climate_event', 'districtname']);
    b.chartData.mark();
    await dragTo(page.getByTestId('drag-col-dim-0'), page.getByTestId('drag-col-dim-1'));
    const req = await b.chartData.next(
      pivotRowDims(['statename'], ['districtname', 'climate_event'])
    );
    expectPayloadSnapshot(req, 'gap-pivot-col-reorder-chart-data');
    await expect(page.getByTestId('pivot-col-dimension-0-input')).toHaveValue('districtname');
  });

  test('GAP-C pivot "N/A" shown for empty cells', async ({ page }) => {
    // statename × districtname: each state has only its own 2 districts → most cells are empty
    await openPivotWith(page, ['statename'], ['districtname']);
    const row0 = page.getByTestId('pivot-row-0');
    await expect(row0.getByRole('cell', { name: 'N/A', exact: true }).first()).toBeVisible();
    await expect(pivot(page).getByRole('cell', { name: 'N/A', exact: true })).toHaveCount(
      6 * 12 - 12
    );
  });

  test('GAP-C pivot sticky total column only with one metric', async ({ page }) => {
    const b = await openPivotWith(page, ['statename'], ['climate_event']);
    b.chartData.mark();
    await page.getByTestId('pivot-show-row-grand-total').click();
    await b.chartData.next((c) => field(c.body, 'show_row_grand_total') === true);
    const totalHeader = pivot(page).getByRole('columnheader', { name: 'Grand Total' }).first();
    await expect(totalHeader).toBeVisible();
    await expect(totalHeader).toHaveCSS('position', 'sticky');
    await expect(page.getByTestId('pivot-row-0').getByRole('cell').last()).toHaveCSS(
      'position',
      'sticky'
    );
    b.chartData.mark();
    await page.getByTestId('add-metric-button').click();
    await b.chartData.next(
      (c) => (field(c.body, 'metrics') as unknown[] | undefined)?.length === 2
    );
    await expect(page.getByTestId('pivot-row-0').getByRole('cell').last()).not.toHaveCSS(
      'position',
      'sticky'
    );
  });

  test('GAP-C pivot filters narrow the pivot (payload + render)', async ({ page }) => {
    // staging column-values is flaky → force the plain text value box
    await page.route(COLUMN_VALUES_URL, (route) => route.fulfill({ status: 500, json: {} }));
    const b = await openPivotWith(page, ['statename'], ['climate_event']);
    await expect(page.getByTestId('pivot-row-5')).toBeVisible();
    await page.getByTestId('chart-add-filter-btn').click();
    await b.pickCombobox('chart-filter-column-0', 'statename');
    b.chartData.mark();
    await page.getByTestId('chart-filter-value-0-text').fill(STATE);
    const req = await b.chartData.next(
      (c) => field(c.body, 'extra_config', 'filters', 0, 'value') === STATE
    );
    expectPayloadSnapshot(req, 'gap-pivot-filter-chart-data');
    await expect(page.getByTestId('pivot-row-0')).toContainText(STATE);
    await expect(page.getByTestId('pivot-row-1')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Edit page
// ---------------------------------------------------------------------------

test.describe('gaps — edit page', () => {
  test('GAP-C edit incomplete-config overlay is not shown for a map chart', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChartViaApi(
      api,
      track,
      'gap-edit-map-overlay',
      'map',
      MAP_BASE_CONFIG
    );
    const b = new MtpBuilder(page);
    await b.openEdit(chart.id);
    await waitForEChart(b.preview);
    await page.getByTestId('remove-metric-0').click();
    await expect(page.getByTestId('metric-trigger-0')).toHaveCount(0);
    await expect(page.getByTestId('chart-edit-save-button')).toBeDisabled();
    await expect(page.getByTestId('chart-config-incomplete-overlay')).toHaveCount(0);
  });

  test('GAP-C edit incomplete-config overlay is not shown for a table chart', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChartViaApi(api, track, 'gap-edit-table-overlay', 'table', {
      dimension_column: 'statename',
      dimensions: [{ column: 'statename', enable_drill_down: false }],
      dimension_columns: ['statename'],
      metrics: [{ column: 'students', aggregation: 'sum', alias: SUM }],
      table_columns: [],
      customizations: {},
      filters: [],
      sort: [],
      pagination: { enabled: false, page_size: 50 },
    });
    const b = new MtpBuilder(page);
    await b.openEdit(chart.id);
    await expect(tableHeader(b.preview, SUM)).toBeVisible({ timeout: 30_000 });
    b.dataPreview.mark();
    await page.getByTestId('remove-metric-0').click();
    // Without metrics the edit page queries raw rows (no aggregation)
    await b.dataPreview.next((c) => !(field(c.body, 'metrics') as unknown[] | undefined)?.length);
    await expect(tableHeader(b.preview, SUM)).toHaveCount(0);
    await expect(tableHeader(b.preview, 'statename')).toBeVisible();
    await expect(page.getByTestId('chart-config-incomplete-overlay')).toHaveCount(0);
  });

  test('[pinned] GAP-C edit data preview page size resets to 25 when the row limit changes', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const chart = await factory.barChart('gap-edit-preview-reset');
    void api;
    void track;
    const preview = new RequestLog(page, API.chartDataPreview);
    await page.goto(`/charts/${chart.id}/edit`);
    await expect(page.getByTestId('chart-name-input')).toHaveValue(chart.title);
    await preview.next((c) => c.query.limit === 25);
    await page.getByTestId('chart-preview-tab-data').click();
    await expect(page.getByTestId('chart-data-preview-page-info')).toBeVisible();
    await expect(page.getByTestId('chart-data-preview-page-size')).toHaveText('');

    preview.mark();
    await page.getByTestId('chart-data-preview-page-size').click();
    await page.getByTestId('chart-data-preview-page-size-option-50').click();
    await preview.next((c) => c.query.limit === 50);
    await expect(page.getByTestId('chart-data-preview-page-size')).toHaveText('50');

    preview.mark();
    await page.getByTestId('chart-pagination-select').click();
    await page.getByTestId('chart-pagination-option-20').click();
    const reset = await preview.next(
      (c) => c.query.limit === 25 && field(c.body, 'extra_config', 'pagination', 'page_size') === 20
    );
    expectPayloadSnapshot(reset, 'gap-edit-preview-reset-25');
    // [pinned] 25 is not one of the Rows-per-page options (10/20/50/100/200) → the trigger is blank
    await expect(page.getByTestId('chart-data-preview-page-size')).toHaveText('');
  });
});
