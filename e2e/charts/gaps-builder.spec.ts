import { test, expect } from '../support/fixtures';
import { e2eTitle, SEED } from '../support/env';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { waitForEChart } from '../support/render';
import type { Page } from '@playwright/test';
import { ChartBuilderPage, CHART_DATA_URL, clickTestId, runStylingCase } from './helpers-builder';
import { createChart, gotoChartsList } from './helpers-core';
import { MtpBuilder } from './helpers-mtp';
import { holdRequests } from './helpers-gaps';

/**
 * FEATURES.md gap list › Charts — create builder basics, shared data configuration, metrics,
 * bar stacked totals and the edit-page type switch. Titles map to checklist lines ("GAP-C …").
 */

// "Sep 26, 11:53 PM" — toLocaleString('en-US', {month:'short', day, hour, minute, hour12})
const DEFAULT_TITLE_TIMESTAMP = String.raw`[A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2}\s?(AM|PM)`;

// POST /api/charts/ exactly (create), not chart-data etc.
const CHART_CREATE_URL = /\/api\/charts\/(\?.*)?$/;
const TABLE_COLUMNS_URL = (table: string) => `**/api/warehouse/table_columns/production/${table}`;
const MENSTRUAL = SEED.datasets.menstrual;
const MENSTRUAL_FULL_NAME = `${MENSTRUAL.schema}.${MENSTRUAL.table}`;
// Timestamp column of the menstrual mart (education mart only has a date-only `date` column)
const TIMESTAMP_COLUMN = '_airbyte_extracted_at';
// ChartDataConfigurationV3 FilterValueInput caps the value dropdown at the first 100 values
const FILTER_VALUE_CAP = 100;
const STUB_VALUE_COUNT = 150;
// Seed saved metric (read-only): education_coverage_rate = SUM(students) / NULLIF(SUM(population), 0)
const SAVED_EXPRESSION_METRIC_ID = '619';

/** Open the create builder on the education mart, optionally with extra query params. */
async function openBuilder(page: Page, type: string, extraQuery = '') {
  const b = new ChartBuilderPage(page);
  await page.goto(`${b.configureUrl(type as never)}${extraQuery}`);
  await expect(b.saveButton).toBeVisible();
  return b;
}

test.describe('gaps — builder basics (create)', () => {
  const DEFAULT_TITLES = [
    { type: 'table', prefix: 'Chart' },
    { type: 'pivot_table', prefix: 'Chart' },
    { type: 'map', prefix: 'Map chart' },
  ] as const;
  for (const { type, prefix } of DEFAULT_TITLES) {
    test(`GAP-C default title ${type} → "${prefix} - <table> <time>"`, async ({ page }) => {
      const b = await openBuilder(page, type);
      await expect(b.nameInput).toHaveValue(
        new RegExp(`^${prefix} - mart_education_program ${DEFAULT_TITLE_TIMESTAMP}$`)
      );
    });
  }

  test('GAP-C map save disabled without a valid metric', async ({ page }) => {
    const b = new MtpBuilder(page);
    await b.openCreate('map');
    const save = page.getByTestId('chart-edit-save-button');
    await expect(save).toBeEnabled();
    // SUM with no column yet → invalid metric
    await page.getByTestId('metric-trigger-0').click();
    await b.pickSelect('metric-agg-0', 'metric-agg-0-option-sum');
    await expect(save).toBeDisabled();
    await b.pickCombobox('metric-column-0', 'students');
    await expect(save).toBeEnabled();
  });

  test('GAP-C map save disabled without a GeoJSON', async ({ page }) => {
    // No GeoJSON for the country → no default is auto-selected (DynamicLevelConfig)
    await page.route('**/api/charts/regions/*/geojsons/', (route) =>
      route.fulfill({ status: 200, json: [] })
    );
    const b = await openBuilder(page, 'map');
    await expect(page.getByTestId('chart-map-state-column-select-input')).toHaveValue('statename');
    await expect(b.saveButton).toBeDisabled();
  });

  test('GAP-C map save disabled without a geographic column', async ({ page }) => {
    // Only numeric columns → auto-prefill finds no text/state column to use as geography
    await page.route(TABLE_COLUMNS_URL(SEED.datasets.education.table), (route) =>
      route.fulfill({
        status: 200,
        json: [
          { name: 'students', column_name: 'students', data_type: 'bigint' },
          { name: 'males', column_name: 'males', data_type: 'bigint' },
        ],
      })
    );
    const b = await openBuilder(page, 'map');
    await expect(page.getByTestId('metric-trigger-0')).toContainText('Total Count');
    await expect(page.getByTestId('chart-map-state-column-select-input')).toHaveValue('');
    await expect(b.saveButton).toBeDisabled();
  });

  test('GAP-C save shows "Saving..." then an error toast on failure', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.setTitle(e2eTitle('gap-save-fail'));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route(CHART_CREATE_URL, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      await gate;
      await route.fulfill({ status: 500, json: { detail: 'e2e forced save failure' } });
    });
    const req = captureRequest(page, { method: 'POST', url: CHART_CREATE_URL });
    await b.saveButton.click();
    expectPayloadSnapshot(await req, 'gap-save-fail-create');
    await expect(b.saveButton).toHaveText('Saving...');
    await expect(b.saveButton).toBeDisabled();
    release();
    await expect(page.getByText('e2e forced save failure')).toBeVisible();
    await expect(b.saveButton).toHaveText('Save Chart');
    await expect(b.saveButton).toBeEnabled();
    await expect(page).toHaveURL(/\/charts\/new\/configure\?/);
  });

  for (const type of ['table', 'pivot_table'] as const) {
    test(`GAP-C ${type} DATA tab opens on Raw Data`, async ({ page }) => {
      const b = new MtpBuilder(page);
      await b.openCreate(type);
      await page.getByTestId('chart-preview-tab-data').click();
      await expect(page.getByTestId('chart-data-tab-raw-data')).toHaveAttribute(
        'data-state',
        'active'
      );
      await expect(page.getByTestId('chart-data-tab-chart-data')).toHaveAttribute(
        'data-state',
        'inactive'
      );
    });
  }

  test('GAP-C bar DATA tab opens on Chart Data (contrast)', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.previewDataTab();
    await expect(page.getByTestId('chart-data-tab-chart-data')).toHaveAttribute(
      'data-state',
      'active'
    );
  });

  test('GAP-C pivot DATA › Chart Data shows the pivot itself', async ({ page }) => {
    const b = new MtpBuilder(page);
    await b.openCreate('pivot_table');
    await page.getByTestId('chart-preview-tab-data').click();
    await page.getByTestId('chart-data-tab-chart-data').click();
    const dataPanel = page.getByRole('tabpanel', { name: 'DATA', exact: true });
    await expect(dataPanel.getByTestId('pivot-table')).toBeVisible();
    await expect(dataPanel.getByTestId('pivot-row-0')).toBeVisible();
  });

  test('GAP-C from dashboard: "Back to Dashboard" and save replaces history with ?from=dashboard', async ({
    page,
    track,
  }) => {
    await gotoChartsList(page);
    const b = await openBuilder(page, 'bar', '&from=dashboard');
    await expect(b.backButton).toHaveText('Back to Dashboard');
    await b.settle();
    await b.setTitle(e2eTitle('gap-from-dashboard'));
    const reqP = captureRequest(page, { method: 'POST', url: CHART_CREATE_URL });
    const resP = page.waitForResponse(
      (r) => CHART_CREATE_URL.test(r.url()) && r.request().method() === 'POST'
    );
    await b.saveButton.click();
    const [captured, res] = await Promise.all([reqP, resP]);
    const { id } = (await res.json()) as { id: number };
    track('charts', id);
    expectPayloadSnapshot(captured, 'gap-from-dashboard-create');
    await expect(page).toHaveURL(new RegExp(`/charts/${id}\\?from=dashboard$`));
    await expect(page.getByTestId('chart-detail-back-dashboard')).toBeVisible();
    // router.replace: the builder entry is gone, so Back lands on the page before it
    await page.goBack();
    await expect(page).toHaveURL(/\/charts$/);
  });

  test('[pinned] GAP-C beforeunload "leave page?" prompt — fires even without user edits', async ({
    page,
  }) => {
    // Pinned: auto-prefill changes formData after originalFormData is captured, so
    // hasUnsavedChanges is already true on a pristine builder (same cause as C-B6 Back dialog)
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    // Chrome only shows beforeunload prompts after a user gesture on the page
    await b.nameInput.click();
    const dialog = page.waitForEvent('dialog');
    await page.close({ runBeforeUnload: true });
    const d = await dialog;
    expect(d.type()).toBe('beforeunload');
    const closed = page.waitForEvent('close');
    await d.accept();
    await closed;
  });

  test('GAP-C chart-name hint next to the name field', async ({ page }) => {
    const b = await openBuilder(page, 'bar');
    const hint = page.locator('#chart-name-guidance'); // TODO testid: DashboardNameHint has none
    await expect(hint).toHaveText(
      'Use a clear name so it’s easy to find when adding it to a dashboard.'
    );
    await expect(b.nameInput).toHaveAccessibleDescription(
      'Use a clear name so it’s easy to find when adding it to a dashboard.'
    );
  });
});

test.describe('gaps — builder data configuration', () => {
  test('GAP-C change data source resets data fields, keeps title, type and styling', async ({
    page,
  }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    const title = e2eTitle('gap-change-source');
    await b.setTitle(title);
    await b.setXAxis('statename');
    await b.setSimpleMetric(0, 'sum', 'students');
    await b.addFilter();
    await b.setFilterColumn(0, 'students');
    await b.stylingTab();
    await page.getByTestId('chart-styling-orientation-horizontal').click();
    await b.dataTab();
    await b.settle();

    // Hold the new table's columns so the reset state is observable before auto-prefill re-runs
    const cols = await holdRequests(page, TABLE_COLUMNS_URL(MENSTRUAL.table), 'GET');
    await b.pickCombo('chart-dataset-select', MENSTRUAL_FULL_NAME, MENSTRUAL.table);
    await expect(b.comboInput('chart-dataset-select')).toHaveValue(MENSTRUAL_FULL_NAME);
    await expect(b.metricTrigger(0)).toHaveCount(0);
    await expect(page.getByTestId('remove-filter-0')).toHaveCount(0);
    await expect(page.getByText('Configure metrics first to enable sorting')).toBeVisible();
    await expect(b.nameInput).toHaveValue(title);
    // Still a bar chart (the extra-dimension placeholder is bar-specific; the type buttons expose no state)
    await expect(b.comboInput('chart-extra-dimension-select')).toHaveAttribute(
      'placeholder',
      'Select dimension (for stacked bar)'
    );

    // Released → auto-prefill on the new table; styling survived into the chart-data request
    const data = captureRequest(page, { method: 'POST', url: CHART_DATA_URL, timeout: 30_000 });
    cols.release();
    expectPayloadSnapshot(await data, 'gap-change-source-chart-data');
    await expect(b.metricTrigger(0)).toContainText('Total Count');
    await b.stylingTab();
    await expect(page.getByTestId('chart-styling-orientation-horizontal')).toBeChecked();
  });

  test('GAP-C time grain hour/minute/second on a timestamp column', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    const firstData = b.waitForChartDataResponse();
    await page.goto(b.configureUrl('bar', MENSTRUAL));
    await expect(b.saveButton).toBeVisible();
    await firstData;
    await b.setXAxis(TIMESTAMP_COLUMN);
    await page.getByTestId('chart-time-grain-select').click();
    for (const v of ['hour', 'minute', 'second']) {
      await expect(page.getByTestId(`chart-time-grain-option-${v}`)).not.toHaveAttribute(
        'data-disabled'
      );
    }
    await page.keyboard.press('Escape');
    for (const grain of ['hour', 'minute', 'second'] as const) {
      await b.expectChartDataPayload(`gap-time-grain-${grain}`, () => b.setTimeGrain(grain));
      await expect(page.getByTestId('chart-time-grain-select')).toHaveText(
        grain[0].toUpperCase() + grain.slice(1)
      );
    }
  });

  test('GAP-C extra dimension placeholder per chart type', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await expect(b.comboInput('chart-extra-dimension-select')).toHaveAttribute(
      'placeholder',
      'Select dimension (for stacked bar)'
    );
    for (const type of ['line', 'pie'] as const) {
      await page.getByTestId(`chart-type-switch-${type}`).click();
      await expect(b.comboInput('chart-extra-dimension-select')).toHaveAttribute(
        'placeholder',
        'Select dimension (for multi-line chart)'
      );
    }
  });

  test('GAP-C filter value dropdown shows at most the first 100 values', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    const values = Array.from(
      { length: STUB_VALUE_COUNT },
      (_, i) => `v${String(i).padStart(3, '0')}`
    );
    await b.stubColumnValues(values);
    await b.openCreate('bar');
    await b.addFilter();
    await b.setFilterColumn(0, 'statename');
    await b.comboInput('chart-filter-value-0').click();
    const options = page.getByTestId('chart-filter-value-0-listbox').getByRole('option');
    await expect(options).toHaveCount(FILTER_VALUE_CAP);
    await expect(b.comboItem('chart-filter-value-0', 'v099')).toHaveCount(1);
    await expect(b.comboItem('chart-filter-value-0', 'v100')).toHaveCount(0);
  });

  test('GAP-C "Configure metrics first to enable sorting" message', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await expect(b.comboInput('chart-sort-column-select')).toBeVisible();
    await expect(page.getByText('Configure metrics first to enable sorting')).toHaveCount(0);
    // Dataset switch clears dimension + metrics; holding the new columns keeps prefill from refilling
    const cols = await holdRequests(page, TABLE_COLUMNS_URL(MENSTRUAL.table), 'GET');
    await b.pickCombo('chart-dataset-select', MENSTRUAL_FULL_NAME, MENSTRUAL.table);
    await expect(page.getByText('Configure metrics first to enable sorting')).toBeVisible();
    await expect(b.comboInput('chart-sort-column-select')).toHaveCount(0);
    cols.release();
    // Columns response → prefill → re-render; staging can take a while under concurrent load
    await expect(b.comboInput('chart-sort-column-select')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Configure metrics first to enable sorting')).toHaveCount(0);
  });
});

test.describe('gaps — metrics (builder)', () => {
  test('GAP-C "Validating expression..." while the expression is checked', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.expandMetric(0);
    await page.getByTestId('metric-tab-calculated-0').click();
    const validate = await holdRequests(page, '**/api/metrics/validate/', 'POST');
    const req = captureRequest(page, { method: 'POST', url: '/api/metrics/validate/' });
    await page.getByTestId('metric-expr-0').fill('SUM(students) / 10');
    expectPayloadSnapshot(await req, 'gap-validating-expression');
    const indicator = page.getByText('Validating expression...');
    await expect(indicator).toBeVisible();
    validate.release();
    await expect(indicator).toBeHidden();
    await expect(b.metricTrigger(0)).toContainText('SUM(students) / 10');
  });

  test('GAP-C saved metrics empty: "No saved metrics yet"', async ({ page }) => {
    await page.route(/\/api\/metrics\/\?/, (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({
            status: 200,
            json: { data: [], total: 0, page: 1, page_size: 50, total_pages: 1 },
          })
        : route.fallback()
    );
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.expandMetric(0);
    await page.getByTestId('metric-tab-saved-0').click();
    await b.comboInput('metric-saved-0').click();
    await expect(page.getByTestId('metric-saved-0-listbox')).toContainText('No saved metrics yet');
  });

  test('GAP-C saved metrics search: "No metrics match your search"', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.expandMetric(0);
    await page.getByTestId('metric-tab-saved-0').click();
    const input = b.comboInput('metric-saved-0');
    await input.click();
    await expect(b.comboItem('metric-saved-0', '620')).toBeVisible();
    await input.fill('zz-no-such-metric-zz');
    await expect(page.getByTestId('metric-saved-0-listbox')).toContainText(
      'No metrics match your search'
    );
  });

  test('GAP-C saved metric → Simple detaches from library and resets to COUNT', async ({
    page,
    track,
  }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.setXAxis('statename');
    await b.expandMetric(0);
    await page.getByTestId('metric-tab-saved-0').click();
    await b.pickCombo('metric-saved-0', SAVED_EXPRESSION_METRIC_ID);
    // Row limit set only now → the COUNT(*) payload after the switch is not already in SWR's cache
    await b.setPagination('200');
    await expect(page.getByTestId('metric-library-icon-0')).toBeVisible();
    await expect(b.metricTrigger(0)).toContainText('education_coverage_rate');
    await b.settle();

    await b.expectChartDataPayload('gap-saved-to-simple-chart-data', () =>
      page.getByTestId('metric-tab-simple-0').click()
    );
    await expect(page.getByTestId('metric-library-icon-0')).toHaveCount(0);
    await expect(b.metricTrigger(0)).toContainText('COUNT(*)');
    await expect(page.getByTestId('metric-agg-0')).toHaveText('Count');
    await expect(page.getByTestId('metric-alias-0')).toHaveValue('Total Count');
    await b.saveAndSnapshot(track, e2eTitle('gap-saved-to-simple'), 'gap-saved-to-simple-save');
  });
});

test.describe('gaps — bar styling', () => {
  // Pinned bug: chart-data returns series values as strings ("18979597"); createStackedTotalFormatter's
  // extractValue (lib/stacked-bar-utils.ts) counts non-numbers as 0, so every total label renders blank.
  // The screenshot baseline therefore shows stacked bars with NO total labels.
  test('[pinned] GAP-C total labels on stacked bars render blank', async ({ page, track }) => {
    const b = new ChartBuilderPage(page);
    await runStylingCase(
      b,
      track,
      'bar',
      (x) => x.statenameBaseline(),
      {
        title: 'stacked total labels',
        id: 'gap-bar-stacked-total-labels',
        setup: (x) => x.setExtraDimension('climate_event'),
        prepare: clickTestId('chart-styling-stacked'),
        apply: clickTestId('chart-styling-show-data-labels'),
      },
      e2eTitle('gap-stacked-totals')
    );
  });
});

// Same as ChartBuilderPage.save: the post-save navigation can outlast the default expect timeout
const SAVE_NAV_TIMEOUT_MS = 30_000;

/** Edit-page save → "Update existing chart"; returns the PUT request (MtpBuilder.saveUpdate + nav timeout). */
async function saveUpdate(b: MtpBuilder, id: number) {
  const path = `/api/charts/${id}/`;
  await b.page.getByTestId('chart-edit-save-button').click();
  const reqP = captureRequest(b.page, { method: 'PUT', url: path });
  const resP = b.page.waitForResponse(
    (r) => r.request().method() === 'PUT' && new URL(r.url()).pathname === path,
    { timeout: SAVE_NAV_TIMEOUT_MS }
  );
  await b.page.getByTestId('chart-save-update-existing-btn').click();
  const [captured, res] = await Promise.all([reqP, resP]);
  expect(res.ok(), `update chart → ${res.status()}`).toBe(true);
  await expect(b.page).toHaveURL(new RegExp(`/charts/${id}$`), { timeout: SAVE_NAV_TIMEOUT_MS });
  return captured;
}

/**
 * Open the edit builder and wait until the warehouse columns have loaded. The type switcher
 * (ChartDataConfigurationV3.handleChartTypeChange) only auto-prefills the new type when its
 * columns are present, so switching earlier produces a different (racy) config.
 */
async function openEditWithColumns(b: MtpBuilder, id: number) {
  const cols = b.page.waitForResponse((r) => r.url().includes('/api/warehouse/table_columns/'));
  await b.openEdit(id);
  await cols;
  await b.page.waitForLoadState('networkidle');
}

test.describe('gaps — type switch in the edit builder', () => {
  test('GAP-C edit bar → map maps X axis to the geographic column', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChart(api, track, 'bar', 'gap-edit-bar-to-map');
    const b = new MtpBuilder(page);
    await openEditWithColumns(b, chart.id);
    b.overlay.mark();
    await page.getByTestId('chart-type-switch-map').click();
    await expect(page.getByTestId('chart-map-state-column-select-input')).toHaveValue('statename');
    await b.overlay.next();
    await waitForEChart(b.preview);
    const put = await saveUpdate(b, chart.id);
    expectPayloadSnapshot(put, 'gap-edit-bar-to-map-put');
  });

  test('GAP-C edit map → bar maps the geographic column to the X axis', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChart(api, track, 'map', 'gap-edit-map-to-bar');
    const b = new MtpBuilder(page);
    await openEditWithColumns(b, chart.id);
    await expect(page.getByTestId('chart-map-state-column-select-input')).toHaveValue('statename');
    b.chartData.mark();
    await page.getByTestId('chart-type-switch-bar').click();
    await expect(page.getByTestId('chart-x-axis-select-input')).toHaveValue('statename');
    expectPayloadSnapshot(await b.chartData.next(), 'gap-edit-map-to-bar-chart-data');
    const put = await saveUpdate(b, chart.id);
    expectPayloadSnapshot(put, 'gap-edit-map-to-bar-put');
  });

  test('[pinned] GAP-C edit bar → table: dimension reset to the first text column', async ({
    page,
    api,
    track,
  }) => {
    // Pinned: the edit page's switch maps the X axis (statename) into x_axis/table_columns only;
    // the table `dimensions` come from ChartDataConfigurationV3's auto-prefill = first text column
    // (`id`), so the table groups by id instead of the bar's statename. SUM(students) is kept.
    const chart = await createChart(api, track, 'bar', 'gap-edit-bar-to-table');
    const b = new MtpBuilder(page);
    await openEditWithColumns(b, chart.id);
    b.dataPreview.mark();
    await page.getByTestId('chart-type-switch-table').click();
    expectPayloadSnapshot(await b.dataPreview.next(), 'gap-edit-bar-to-table-preview');
    await expect(page.getByRole('combobox', { name: 'Select dimension' })).toHaveValue('id'); // TODO testid
    await expect(b.preview.getByRole('columnheader', { name: 'id', exact: true })).toBeVisible();
    await expect(b.preview.getByRole('columnheader', { name: 'Students' })).toBeVisible();
    await expect(b.preview.getByRole('columnheader', { name: 'statename' })).toHaveCount(0);
    const put = await saveUpdate(b, chart.id);
    expectPayloadSnapshot(put, 'gap-edit-bar-to-table-put');
  });

  test('GAP-C edit table → bar', async ({ page, api, track }) => {
    const chart = await createChart(api, track, 'table', 'gap-edit-table-to-bar');
    const b = new MtpBuilder(page);
    await openEditWithColumns(b, chart.id);
    b.chartData.mark();
    await page.getByTestId('chart-type-switch-bar').click();
    expectPayloadSnapshot(await b.chartData.next(), 'gap-edit-table-to-bar-chart-data');
    await expect(page.getByTestId('chart-x-axis-select-input')).toHaveValue('statename');
    const put = await saveUpdate(b, chart.id);
    expectPayloadSnapshot(put, 'gap-edit-table-to-bar-put');
  });
});
