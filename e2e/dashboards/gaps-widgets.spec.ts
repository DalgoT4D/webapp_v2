import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import type { ApiClient } from '../support/api-client';
import { waitForEChart } from '../support/render';
import {
  type SeedTab,
  FIXED_IDS,
  SEED_CHARTS,
  SEED_KPIS,
  cell,
  cellsOfKind,
  chartComponent,
  expectBuilderPayload,
  gridItem,
  layoutOf,
  openBuilder,
  putTabs,
  releaseBuilderLocks,
  saveAndCapture,
  textComponent,
} from './helpers-builder';
import {
  type ResizeHandle,
  apiPath,
  canvasRect,
  canvasScrollTop,
  editResponse,
  failRequests,
  resizeFrom,
} from './helpers-gaps-builder';

// rowHeight 20 + margin 8 (dashboard-builder-v2 grid config)
const ROW_STEP = 28;
// Autoscroll engages within 60px of the canvas edge (AUTOSCROLL_EDGE_PX); aim well inside that
const NEAR_EDGE_PX = 20;
// Id no real KPI on staging has — the mocked "KPI without a metric"
const MOCK_KPI_ID = 990_001;

type Factoryish = { dashboard: (n: string) => Promise<{ id: number; title: string }> };

function kpiComponent(componentId: string) {
  return {
    id: componentId,
    type: 'kpi',
    config: { kpiId: SEED_KPIS.femaleScores.id, title: SEED_KPIS.femaleScores.name },
  };
}

/** Dashboard with one tab holding `layout` + `components`, opened in the builder. */
async function seedAndOpen(
  page: Page,
  factory: Factoryish,
  api: ApiClient,
  name: string,
  tab: Pick<SeedTab, 'layout_config' | 'components'>
) {
  const dash = await factory.dashboard(name);
  await putTabs(api, dash, [{ id: FIXED_IDS.tab1, title: 'Tab', ...tab }]);
  await openBuilder(page, dash.id);
  return dash;
}

const emptyList = { data: [] as unknown[], total: 0, page: 1, page_size: 10, total_pages: 1 };

test.describe('dashboard builder gaps — widgets', () => {
  test.afterEach(async ({ api }) => releaseBuilderLocks(api));

  // ---------------------------------------------------------------- adding and removing widgets

  test('GAP-D the same chart can be added to a different tab', async ({ page, factory, api }) => {
    const dash = await factory.dashboard('same-chart-tabs');
    await putTabs(api, dash, [
      {
        id: FIXED_IDS.tab1,
        title: 'First',
        layout_config: [{ i: FIXED_IDS.chart1, x: 0, y: 0, w: 12, h: 18 }],
        components: { [FIXED_IDS.chart1]: chartComponent(FIXED_IDS.chart1, SEED_CHARTS.bar) },
      },
      { id: FIXED_IDS.tab2, title: 'Second', layout_config: [], components: {} },
    ]);
    await openBuilder(page, dash.id);
    const modal = page.getByTestId('dashboard-chart-selector-modal');
    const option = modal.getByTestId(`dashboard-chart-option-${SEED_CHARTS.bar.id}`);

    // On its own tab the chart is excluded …
    await page.getByTestId('add-chart-btn').click();
    await modal.getByTestId('dashboard-chart-selector-search').fill(SEED_CHARTS.bar.title);
    await expect(option.getByText('Already added')).toBeVisible();
    await page.keyboard.press('Escape');

    // … on another tab it is offered and inserts normally
    await page.getByTestId(`tab-item-${FIXED_IDS.tab2}`).click();
    await expect(page.getByTestId(`tab-item-${FIXED_IDS.tab2}`)).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await page.getByTestId('add-chart-btn').click();
    await modal.getByTestId('dashboard-chart-selector-search').fill(SEED_CHARTS.bar.title);
    await expect(option).toBeVisible();
    await expect(option.getByText('Already added')).toHaveCount(0);
    await option.click();
    await expect(modal).toBeHidden();
    await expect(cellsOfKind(page, 'chart')).toHaveCount(1);
    await expect(cell(page, FIXED_IDS.chart1)).toHaveCount(0); // tab 1's cell is not rendered here

    const captured = await saveAndCapture(page, dash.id);
    const tabs = (
      captured.body as {
        tabs: Array<{ components: Record<string, { config: { chartId: number } }> }>;
      }
    ).tabs;
    expect(Object.values(tabs[1].components).map((c) => c.config.chartId)).toEqual([
      SEED_CHARTS.bar.id,
    ]);
    expectBuilderPayload(captured, 'gap-d-same-chart-other-tab-put');
  });

  test('GAP-D "CREATE NEW CHART" in the Add Chart modal opens /charts/new?from=dashboard', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('create-new-chart');
    await openBuilder(page, dash.id);
    await page.getByTestId('add-chart-btn').click();
    await page.getByTestId('dashboard-chart-selector-create-new').click();
    await expect(page).toHaveURL('/charts/new?from=dashboard');
  });

  test("GAP-D [pinned] an org with no charts gets the modal's empty state, not /charts/new", async ({
    page,
    factory,
  }) => {
    // The Add Chart button redirects only when `Array.isArray(chartsData) && length === 0`, but
    // GET /api/charts/ returns a paginated object ({data, total, …}), so the redirect never fires
    // and the modal opens on its "No charts available yet." state instead.
    // Chart list mocked empty (same shape as staging's) — no empty org exists to test against.
    let listServed = 0;
    await page.route(apiPath('/api/charts/'), (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      listServed++;
      return route.fulfill({ json: emptyList });
    });
    const dash = await factory.dashboard('no-charts');
    await openBuilder(page, dash.id);
    await expect.poll(() => listServed).toBeGreaterThan(0);

    await page.getByTestId('add-chart-btn').click();
    const modal = page.getByTestId('dashboard-chart-selector-modal');
    await expect(modal.getByText('No charts available yet.')).toBeVisible();
    await expect(modal.getByText('Get started by creating your first chart')).toBeVisible();
    await expect(page).toHaveURL(`/dashboards/${dash.id}/edit`);
    await modal.getByTestId('dashboard-chart-selector-create-first').click();
    await expect(page).toHaveURL('/charts/new?from=dashboard');
  });

  test('GAP-D "CREATE NEW KPI" link, and the empty "GO TO KPIs" state', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('kpi-links');
    await openBuilder(page, dash.id);
    const modal = page.getByTestId('dashboard-kpi-selector-modal');
    await page.getByTestId('add-kpi-btn').click();
    await expect(modal).toBeVisible();
    await modal.getByTestId('dashboard-kpi-selector-create-new').click();
    await expect(page).toHaveURL('/kpis');

    // KPI list mocked empty for the "no KPIs yet" state
    await page.route(apiPath('/api/kpis/'), (route) =>
      route.request().method() === 'GET' ? route.fulfill({ json: emptyList }) : route.fallback()
    );
    await openBuilder(page, dash.id);
    await page.getByTestId('add-kpi-btn').click();
    await expect(modal.getByText('No KPIs available yet.')).toBeVisible();
    await expect(modal.getByText('Create KPIs from your metrics first')).toBeVisible();
    await modal.getByTestId('dashboard-kpi-selector-go-to-kpis').click();
    await expect(page).toHaveURL('/kpis');
  });

  test('GAP-D [pinned] a KPI with no metric crashes the builder as soon as it opens', async ({
    page,
    factory,
  }) => {
    // kpi-selector-modal renders `kpi.metric.name` with no null check. The modal is mounted (and
    // its KPI list fetched) with the builder, so one KPI whose metric is missing takes the whole
    // edit page down to the root error boundary (app/global-error.tsx) before Add KPI is clickable.
    // KPI list mocked — no real KPI on staging lacks a metric.
    let listServed = 0;
    await page.route(apiPath('/api/kpis/'), (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      listServed++;
      return route.fulfill({
        json: {
          ...emptyList,
          total: 1,
          data: [{ id: MOCK_KPI_ID, name: 'e2e KPI without metric', metric: null }],
        },
      });
    });
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    const dash = await factory.dashboard('kpi-no-metric');
    await page.goto(`/dashboards/${dash.id}/edit`);

    await expect(page.getByRole('heading', { name: 'Something went wrong!' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByTestId('add-kpi-btn')).toHaveCount(0);
    expect(listServed).toBeGreaterThan(0);
    expect(errors.some((m) => m.includes("Cannot read properties of null (reading 'name')"))).toBe(
      true
    );
  });

  test('GAP-D Edit Chart / Edit KPI are hidden without edit access to that chart or KPI', async ({
    page,
    factory,
    api,
  }) => {
    // No seed chart/KPI is view-only for the admin, so the per-object access level is mocked
    const asViewOnly = (body: Record<string, unknown>) => ({ ...body, access_level: 'view' });
    await editResponse(page, apiPath(`/api/charts/${SEED_CHARTS.bar.id}/`), asViewOnly);
    await editResponse(page, apiPath(`/api/kpis/${SEED_KPIS.femaleScores.id}/`), asViewOnly);
    await seedAndOpen(page, factory, api, 'no-edit-access', {
      layout_config: [
        { i: FIXED_IDS.chart1, x: 0, y: 0, w: 6, h: 18 },
        { i: FIXED_IDS.kpi1, x: 6, y: 0, w: 6, h: 11 },
      ],
      components: {
        [FIXED_IDS.chart1]: chartComponent(FIXED_IDS.chart1, SEED_CHARTS.bar),
        [FIXED_IDS.kpi1]: kpiComponent(FIXED_IDS.kpi1),
      },
    });

    for (const id of [FIXED_IDS.chart1, FIXED_IDS.kpi1]) {
      await cell(page, id).hover();
      await expect(page.getByTestId(`dashboard-cell-view-${id}`)).toBeVisible();
      await expect(page.getByTestId(`dashboard-cell-remove-${id}`)).toBeVisible();
      await expect(page.getByTestId(`dashboard-cell-edit-${id}`)).toHaveCount(0);
    }
  });

  // ---------------------------------------------------------------- dragging and resizing

  test('GAP-D KPI and text widgets clamp at their own minimum size', async ({
    page,
    factory,
    api,
  }) => {
    const dash = await seedAndOpen(page, factory, api, 'min-kpi-text', {
      layout_config: [
        { i: FIXED_IDS.kpi1, x: 0, y: 0, w: 6, h: 11 },
        { i: FIXED_IDS.text1, x: 6, y: 0, w: 6, h: 8 },
      ],
      components: {
        [FIXED_IDS.kpi1]: kpiComponent(FIXED_IDS.kpi1),
        [FIXED_IDS.text1]: textComponent(FIXED_IDS.text1, 'Min size'),
      },
    });

    for (const id of [FIXED_IDS.kpi1, FIXED_IDS.text1]) {
      const box = (await gridItem(page, id).boundingBox())!;
      await resizeFrom(page, id, 'se', -box.width * 2, -box.height * 2);
    }
    const captured = await saveAndCapture(page, dash.id);
    for (const id of [FIXED_IDS.kpi1, FIXED_IDS.text1]) {
      const l = layoutOf(captured.body, id);
      expect(l.w).toBe(l.minW);
      expect(l.h).toBe(l.minH);
    }
    expectBuilderPayload(captured, 'gap-d-min-kpi-text-put');
  });

  // Start {x:3, y:0, w:6, h:12}; one column right/left and two rows down per handle.
  // Vertical compaction pulls a lone widget back to y=0 after a north-edge shrink.
  /** Grid position/size (react-grid-layout units) the widget must end up with */
  type GridBox = { x: number; y: number; w: number; h: number };
  const HANDLE_CASES: Array<{
    handle: ResizeHandle;
    cols: number;
    rows: number;
    expected: GridBox;
  }> = [
    { handle: 'e', cols: 1, rows: 0, expected: { x: 3, y: 0, w: 7, h: 12 } },
    { handle: 'w', cols: -1, rows: 0, expected: { x: 2, y: 0, w: 7, h: 12 } },
    { handle: 's', cols: 0, rows: 2, expected: { x: 3, y: 0, w: 6, h: 14 } },
    { handle: 'n', cols: 0, rows: 2, expected: { x: 3, y: 0, w: 6, h: 10 } },
    { handle: 'ne', cols: 1, rows: 2, expected: { x: 3, y: 0, w: 7, h: 10 } },
    { handle: 'nw', cols: -1, rows: 2, expected: { x: 2, y: 0, w: 7, h: 10 } },
    { handle: 'sw', cols: -1, rows: 2, expected: { x: 2, y: 0, w: 7, h: 14 } },
  ];

  for (const { handle, cols, rows, expected } of HANDLE_CASES) {
    test(`GAP-D resize from the ${handle} handle`, async ({ page, factory, api }) => {
      const dash = await seedAndOpen(page, factory, api, `resize-${handle}`, {
        layout_config: [{ i: FIXED_IDS.text1, x: 3, y: 0, w: 6, h: 12 }],
        components: { [FIXED_IDS.text1]: textComponent(FIXED_IDS.text1, `Resize ${handle}`) },
      });
      const box = (await gridItem(page, FIXED_IDS.text1).boundingBox())!;
      const colStep = (box.width + 8) / 6; // one column incl. the 8px margin
      await resizeFrom(page, FIXED_IDS.text1, handle, colStep * cols, ROW_STEP * rows);
      const captured = await saveAndCapture(page, dash.id);
      expect(layoutOf(captured.body, FIXED_IDS.text1)).toMatchObject(expected);
      expectBuilderPayload(captured, `gap-d-resize-${handle}-put`);
    });
  }

  test('GAP-D the canvas scrolls while a widget is dragged near its bottom edge', async ({
    page,
    factory,
    api,
  }) => {
    const stackIds = [
      FIXED_IDS.text1,
      'text-1700000000022',
      'text-1700000000023',
      'text-1700000000024',
    ];
    await seedAndOpen(page, factory, api, 'drag-autoscroll', {
      layout_config: stackIds.map((i, n) => ({ i, x: 0, y: n * 18, w: 12, h: 18 })),
      components: Object.fromEntries(
        stackIds.map((i, n) => [i, textComponent(i, `Block ${n + 1}`)])
      ),
    });
    const first = cell(page, FIXED_IDS.text1);
    expect(await canvasScrollTop(first)).toBe(0);

    await first.hover();
    const strip = (await page.getByTestId(`dashboard-cell-drag-${FIXED_IDS.text1}`).boundingBox())!;
    const rect = await canvasRect(first);
    const start = { x: strip.x + strip.width / 2, y: strip.y + strip.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 2, start.y + 2);
    await page.mouse.move(start.x, rect.bottom - NEAR_EDGE_PX, { steps: 12 });
    // The pointer rests in the edge zone; the RAF loop keeps scrolling
    await expect.poll(() => canvasScrollTop(first)).toBeGreaterThan(0);
    const scrolled = await canvasScrollTop(first);
    await expect.poll(() => canvasScrollTop(first)).toBeGreaterThan(scrolled);
    await page.mouse.up();
  });

  // ---------------------------------------------------------------- chart title

  test('GAP-D clearing the chart title input hides the title', async ({ page, factory, api }) => {
    const chartId = SEED_CHARTS.bar.id;
    const dash = await seedAndOpen(page, factory, api, 'title-clear', {
      layout_config: [{ i: FIXED_IDS.chart1, x: 0, y: 0, w: 12, h: 18 }],
      components: { [FIXED_IDS.chart1]: chartComponent(FIXED_IDS.chart1, SEED_CHARTS.bar) },
    });
    const display = page.getByTestId(`dashboard-chart-title-display-${chartId}`);
    await display.click();
    const input = page.getByTestId(`dashboard-chart-title-input-${chartId}`);
    await expect(input).toHaveAttribute('placeholder', 'Enter chart title (leave empty to hide)');
    await input.fill('');
    await input.press('Enter');
    await expect(display).toHaveCount(0);
    await cell(page, FIXED_IDS.chart1).hover();
    await expect(page.getByTestId(`dashboard-chart-title-show-${chartId}`)).toBeVisible();

    const captured = await saveAndCapture(page, dash.id);
    const config = (
      captured.body as {
        tabs: Array<{ components: Record<string, { config: Record<string, unknown> }> }>;
      }
    ).tabs[0].components[FIXED_IDS.chart1].config;
    expect(config).toMatchObject({ titleOverride: '', showTitle: false });
    expectBuilderPayload(captured, 'gap-d-title-cleared-put');
  });

  // ---------------------------------------------------------------- charts inside the builder

  test('GAP-D map cell: region click drills down; Home returns to the top level', async ({
    page,
    factory,
    api,
  }) => {
    const chart = SEED_CHARTS.map;
    await seedAndOpen(page, factory, api, 'map-drill', {
      layout_config: [{ i: FIXED_IDS.chart1, x: 0, y: 0, w: 12, h: 18 }],
      components: { [FIXED_IDS.chart1]: chartComponent(FIXED_IDS.chart1, chart, 'map') },
    });
    const c = cell(page, FIXED_IDS.chart1);
    await waitForEChart(c);
    const home = c.getByTestId(`dashboard-chart-map-home-${chart.id}`);
    await expect(home).toHaveCount(0);

    // Centre of the map canvas (central India) hits a state polygon
    const canvas = c.locator('div[_echarts_instance_] canvas').first();
    const box = (await canvas.boundingBox())!;
    const childRegions = page.waitForResponse((r) =>
      /\/api\/charts\/regions\/\d+\/geojsons\//.test(r.url())
    );
    await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.5);
    await expect(page.getByText(/Drilling down to district in .+/)).toBeVisible();
    await childRegions;
    await expect(home).toBeVisible();
    await expect(c.getByTestId(`dashboard-chart-map-crumb-${chart.id}-0`)).toBeVisible();

    await home.click();
    await expect(home).toHaveCount(0);
    await waitForEChart(c);
  });

  test('GAP-D "Chart Error" card in the builder when chart data fails', async ({
    page,
    factory,
    api,
  }) => {
    const failed = await failRequests(page, new RegExp(`/api/charts/${SEED_CHARTS.bar.id}/data/`), {
      method: 'GET',
    });
    await seedAndOpen(page, factory, api, 'chart-error', {
      layout_config: [{ i: FIXED_IDS.chart1, x: 0, y: 0, w: 12, h: 18 }],
      components: { [FIXED_IDS.chart1]: chartComponent(FIXED_IDS.chart1, SEED_CHARTS.bar) },
    });
    const c = cell(page, FIXED_IDS.chart1);
    await expect(c.getByText('Chart Error')).toBeVisible();
    // FORCED_ERROR has no data-related keyword → the "configuration" wording
    await expect(
      c.getByText('Chart configuration needs adjustment. Please review your settings and try again')
    ).toBeVisible();
    expect(failed.length).toBeGreaterThan(0);
  });

  test('GAP-D "Failed to load KPI" in the builder when KPI data fails', async ({
    page,
    factory,
    api,
  }) => {
    await failRequests(page, new RegExp(`/api/kpis/${SEED_KPIS.femaleScores.id}/data/`), {
      method: 'GET',
    });
    await seedAndOpen(page, factory, api, 'kpi-error', {
      layout_config: [{ i: FIXED_IDS.kpi1, x: 0, y: 0, w: 6, h: 11 }],
      components: { [FIXED_IDS.kpi1]: kpiComponent(FIXED_IDS.kpi1) },
    });
    const c = cell(page, FIXED_IDS.kpi1);
    await expect(c.getByText('Failed to load KPI')).toBeVisible();
    await expect(c.getByTestId(`kpi-card-${SEED_KPIS.femaleScores.id}`)).toHaveCount(0);
  });
});
