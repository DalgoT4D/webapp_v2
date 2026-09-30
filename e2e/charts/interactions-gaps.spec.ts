import { test, expect } from '../support/fixtures';
import { expectPayloadSnapshot, type CapturedRequest } from '../support/payload';
import { waitForEChart } from '../support/render';
import { fetchForRewrite } from '../support/routes';
import type { Locator, Page } from '@playwright/test';
import { ChartBuilderPage, EDU, EDU_FULL_NAME, STUB_STATE_VALUES } from './helpers-builder';
import { e2eTitle } from '../support/env';
import {
  CHATBOT_SEED_IDS,
  CHATBOT_SOURCE,
  createChart,
  createDashboardUsingChart,
  gotoChartsList,
  listRow,
  openListFilter,
  closeListFilter,
  openListFilteredByName,
  openRowMenu,
  SEED_CHARTS,
  setListPageSize,
} from './helpers-core';
import { field, isAggregatedPreview, MtpBuilder, tableBodyRows } from './helpers-mtp';

/**
 * Interaction-coverage gaps (coverage/INTERACTIONS.md "Untouched interactive elements" › charts).
 * Each test clicks controls no other spec touched and asserts their effect. Titles "IG-charts …".
 */

const EDU_TABLE = EDU.table;
const TABLE_PREVIEW_URL = /\/api\/charts\/chart-data-preview\/\?/;
const SUM = 'SUM(students)';
// Education mart: 6 states × 2 districts
const STATES = 6;
const DISTRICTS_PER_STATE = 2;
// Education mart: 156 source rows → Raw Data pages at the various page sizes
const TOTAL_ROWS = 156;
// Stand-in URL value for the table link cell; *.invalid never resolves (RFC 2606)
const LINK_URL = 'https://e2e.invalid/report';

/** Click a Combobox chevron: opens the listbox; a second click closes it. */
async function toggleViaChevron(page: Page, id: string) {
  const chevron = page.getByTestId(`${id}-chevron`);
  const listbox = page.getByTestId(`${id}-listbox`);
  await chevron.click();
  await expect(listbox).toBeVisible();
  await chevron.click();
  await expect(listbox).toBeHidden();
}

/** Radix tooltip on an (i) button: hover shows the text; the click is what the recorder credits. */
async function expectInfoTooltip(page: Page, testId: string, text: string | RegExp) {
  const btn = page.getByTestId(testId);
  await btn.hover();
  await expect(page.getByRole('tooltip').filter({ hasText: text })).toHaveCount(1);
  // Radix closes the tooltip on pointerdown; the click must not toggle anything else
  await btn.click();
  await page.mouse.move(0, 0);
}

function customizations(c: CapturedRequest) {
  return field(c.body, 'extra_config', 'customizations') as Record<string, unknown> | undefined;
}

// ---------------------------------------------------------------------------
// Create step 1 + list
// ---------------------------------------------------------------------------

test.describe('IG charts — list + create step 1', () => {
  test('IG-charts new-page dataset chevron opens the dataset list and picks', async ({ page }) => {
    await page.goto('/charts/new');
    const input = page.getByTestId('chart-new-dataset-select-input');
    await expect(input).toBeEnabled({ timeout: 30_000 });
    await page.getByTestId('chart-new-dataset-select-chevron').click();
    await expect(page.getByTestId('chart-new-dataset-select-listbox')).toBeVisible();
    // The chevron-opened list filters + picks like the typed one
    await input.fill(EDU_TABLE);
    await page.getByTestId(`chart-new-dataset-select-item-${EDU_FULL_NAME}`).click();
    await expect(input).toHaveValue(EDU_FULL_NAME);
    await expect(page.getByTestId('chart-new-dataset-select-listbox')).toBeHidden();
  });

  test('IG-charts list source + type filter checkboxes toggle the filter', async ({ page }) => {
    await gotoChartsList(page);
    await setListPageSize(page, 100);

    await openListFilter(page, 'source');
    const sourceBox = page.getByTestId(`chart-list-filter-source-checkbox-${CHATBOT_SOURCE}`);
    // The checkbox itself (not its row) — the click bubbles to the row's toggle handler
    await sourceBox.click();
    await expect(sourceBox).toBeChecked();
    await closeListFilter(page, 'source');
    await expect(listRow.titleLink(page, CHATBOT_SEED_IDS[0])).toBeVisible();
    await expect(listRow.titleLink(page, SEED_CHARTS.bar.id)).toBeHidden();

    await openListFilter(page, 'source');
    await sourceBox.click();
    await expect(sourceBox).not.toBeChecked();
    await closeListFilter(page, 'source');

    await openListFilter(page, 'type');
    const typeBox = page.getByTestId('chart-list-filter-type-checkbox-map');
    await typeBox.click();
    await expect(typeBox).toBeChecked();
    await closeListFilter(page, 'type');
    await expect(listRow.titleLink(page, SEED_CHARTS.map.id)).toBeVisible();
    await expect(listRow.titleLink(page, SEED_CHARTS.bar.id)).toBeHidden();
  });

  test('IG-charts delete dialog dashboard link opens the dashboard', async ({
    page,
    api,
    track,
  }) => {
    const chart = await createChart(api, track, 'bar', 'ig-del-link');
    const dash = await createDashboardUsingChart(api, track, 'ig-del-link-dash', chart.id);
    await openListFilteredByName(page, chart.title);
    await openRowMenu(page, chart.id);
    await page.getByTestId(`chart-list-row-menu-delete-${chart.id}`).click();
    await expect(page.getByTestId('chart-delete-dialog')).toBeVisible();
    await page.getByTestId(`chart-delete-dashboard-link-${dash.id}`).click();
    await expect(page).toHaveURL(new RegExp(`/dashboards/${dash.id}$`));
    // Nothing was deleted
    expect((await api.get<{ id: number }>(`/api/charts/${chart.id}/`)).id).toBe(chart.id);
  });
});

// ---------------------------------------------------------------------------
// Create builder — shared data configuration
// ---------------------------------------------------------------------------

test.describe('IG charts — create builder (bar)', () => {
  test('IG-charts configure preview CHART tab returns from DATA', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.previewDataTab();
    await expect(b.dataPanel).toBeVisible();
    await b.previewChartTab();
    await expect(page.getByTestId('chart-preview-tab-chart')).toHaveAttribute(
      'data-state',
      'active'
    );
    await waitForEChart(b.previewPanel);
  });

  test('IG-charts data config chevrons (dataset, X axis, extra dimension, sort, metric column, saved metric, filter column)', async ({
    page,
  }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await toggleViaChevron(page, 'chart-dataset-select');
    await toggleViaChevron(page, 'chart-x-axis-select');
    await toggleViaChevron(page, 'chart-extra-dimension-select');
    await toggleViaChevron(page, 'chart-sort-column-select');

    await b.expandMetric(0);
    await toggleViaChevron(page, 'metric-column-0');
    await page.getByTestId('metric-tab-saved-0').click();
    await toggleViaChevron(page, 'metric-saved-0');

    await b.addFilter();
    await toggleViaChevron(page, 'chart-filter-column-0');
    // Chevron-opened list still picks
    await page.getByTestId('chart-filter-column-0-chevron').click();
    await page.getByTestId('chart-filter-column-0-item-statename').click();
    await expect(page.getByTestId('chart-filter-column-0-input')).toHaveValue('statename');
  });

  test('IG-charts filter value chevron + "Select all" sends every value', async ({ page }) => {
    const b = new ChartBuilderPage(page);
    await b.stubColumnValues();
    await b.openCreate('bar');
    await b.setXAxis('statename');
    await b.addFilter();
    await b.setFilterColumn(0, 'statename');

    // Single-value combobox: chevron opens the stubbed value list
    await page.getByTestId('chart-filter-value-0-chevron').click();
    await expect(page.getByTestId('chart-filter-value-0-listbox').getByRole('option')).toHaveCount(
      STUB_STATE_VALUES.length
    );
    await page.getByTestId('chart-filter-value-0-chevron').click();
    await expect(page.getByTestId('chart-filter-value-0-listbox')).toBeHidden();

    // Multi-select (in): "Select all" checkbox picks every listed value
    await b.setFilterOperator(0, 'in');
    await page.getByTestId('chart-filter-value-0-search').click();
    const all = await b.captureChartData(() =>
      page.getByTestId('chart-filter-value-0-checkbox-select-all').click()
    );
    expectPayloadSnapshot(all, 'ig-filter-value-select-all');
    expect(field(all.body, 'extra_config', 'filters', 0, 'value')).toBe(
      STUB_STATE_VALUES.join(', ')
    );
    await expect(page.getByTestId('chart-filter-value-0-checkbox-select-all')).toHaveAttribute(
      'data-state',
      'checked'
    );
    // Clicking the "Select all" row again clears the selection
    await page.getByTestId('chart-filter-value-0-select-all').click();
    await expect(page.getByTestId('chart-filter-value-0-checkbox-select-all')).toHaveAttribute(
      'data-state',
      'unchecked'
    );
  });

  test('IG-charts data preview pagination: prev / first + page sizes 10 · 20 · 100 · 200', async ({
    page,
  }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.previewDataTab();
    await page.getByTestId('chart-data-tab-raw-data').click();
    const panel = b.dataPanel;
    const info = panel.getByTestId('chart-data-preview-page-info');
    await expect(info).toHaveText('Page 1 of 8');
    await panel.getByTestId('chart-data-preview-next-page-btn').click();
    await expect(info).toHaveText('Page 2 of 8');
    await panel.getByTestId('chart-data-preview-next-page-btn').click();
    await expect(info).toHaveText('Page 3 of 8');
    await panel.getByTestId('chart-data-preview-prev-page-btn').click();
    await expect(info).toHaveText('Page 2 of 8');
    await panel.getByTestId('chart-data-preview-first-page-btn').click();
    await expect(info).toHaveText('Page 1 of 8');
    await expect(panel.getByTestId('chart-data-preview-first-page-btn')).toBeDisabled();
    await expect(panel.getByTestId('chart-data-preview-prev-page-btn')).toBeDisabled();

    for (const size of [10, 100, 200, 20]) {
      await b.pickSelect(
        'chart-data-preview-page-size',
        String(size),
        `chart-data-preview-page-size-option-${size}`
      );
      await expect(page.getByTestId('chart-data-preview-page-size')).toHaveText(String(size));
      await expect(info).toHaveText(`Page 1 of ${Math.ceil(TOTAL_ROWS / size)}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Styling re-picks (default value can't be re-picked directly — pick another first)
// ---------------------------------------------------------------------------

test.describe('IG charts — styling back to defaults', () => {
  test('IG-charts bar orientation Vertical + Y label rotation Horizontal saved', async ({
    page,
    track,
  }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('bar');
    await b.stylingTab();
    const vertical = page.getByTestId('chart-styling-orientation-vertical');
    await page.getByTestId('chart-styling-orientation-horizontal').click();
    await expect(vertical).toHaveAttribute('data-state', 'unchecked');
    await vertical.click();
    await expect(vertical).toHaveAttribute('data-state', 'checked');

    await b.pickSelect('chart-styling-y-axis-label-rotation', '45');
    await b.pickSelect('chart-styling-y-axis-label-rotation', 'horizontal');
    await expect(page.getByTestId('chart-styling-y-axis-label-rotation')).toHaveText(
      'Horizontal (0°)'
    );
    const { request } = await b.saveAndSnapshot(
      track,
      e2eTitle('ig-bar-defaults'),
      'ig-bar-defaults-save'
    );
    expect(customizations(request)).toMatchObject({
      orientation: 'vertical',
      yAxisLabelRotation: 'horizontal',
    });
  });

  test('IG-charts line Y label rotation Horizontal saved', async ({ page, track }) => {
    const b = new ChartBuilderPage(page);
    await b.openCreate('line');
    await b.stylingTab();
    await b.pickSelect('chart-styling-y-axis-label-rotation', 'vertical');
    await b.pickSelect('chart-styling-y-axis-label-rotation', 'horizontal');
    const { request } = await b.saveAndSnapshot(
      track,
      e2eTitle('ig-line-rot'),
      'ig-line-rotation-save'
    );
    expect(customizations(request)).toMatchObject({ yAxisLabelRotation: 'horizontal' });
  });
});

// ---------------------------------------------------------------------------
// Map / table / pivot builders
// ---------------------------------------------------------------------------

test.describe('IG charts — map / table / pivot builders', () => {
  test('IG-charts map column chevrons, Blues re-pick, Enable Selection off → saved', async ({
    page,
    track,
  }) => {
    const b = new MtpBuilder(page);
    await b.openCreate('map');
    await expect(page.getByTestId('chart-map-state-column-select-input')).toHaveValue('statename');
    await toggleViaChevron(page, 'chart-map-state-column-select');
    await toggleViaChevron(page, 'chart-map-district-column-select');
    await b.setSimpleMetric(0, 'sum', 'students');

    await b.stylingTab();
    await b.pickSelect('chart-styling-color-scheme', 'chart-styling-color-scheme-option-Greens');
    await b.pickSelect('chart-styling-color-scheme', 'chart-styling-color-scheme-option-Blues');
    await expect(page.getByTestId('chart-styling-color-scheme')).toHaveText('Blues');
    const selection = page.getByTestId('chart-styling-enable-selection');
    await expect(selection).toBeChecked();
    await selection.click();
    await expect(selection).not.toBeChecked();

    await b.setTitle('ig-map-selection');
    const { captured } = await b.saveCreate(track);
    expectPayloadSnapshot(captured, 'ig-map-selection-save');
    expect(customizations(captured)).toMatchObject({ colorScheme: 'Blues', select: false });
  });

  test('IG-charts table dimension chevron, CF info tooltip, rule level back to "All levels"', async ({
    page,
  }) => {
    const b = new MtpBuilder(page);
    await b.openCreate('table');
    await b.pickCombobox('chart-table-dimension-0', 'statename');
    await toggleViaChevron(page, 'chart-table-dimension-0');
    await page.getByTestId('chart-table-dimension-add-btn').click();
    await b.pickCombobox('chart-table-dimension-1', 'districtname');
    await b.setSimpleMetric(0, 'sum', 'students');
    b.dataPreview.mark();
    await page.getByTestId('chart-table-drill-down-switch').click();
    await b.dataPreview.next(
      (c) =>
        isAggregatedPreview(c) && JSON.stringify(field(c.body, 'dimensions')) === '["statename"]'
    );

    await b.stylingTab();
    await expectInfoTooltip(
      page,
      'conditional-formatting-info',
      'Highlight cells based on conditions.'
    );
    await page.getByTestId('add-formatting-rule-btn').click();
    await b.pickSelect('rule-column-0', `rule-column-0-option-${SUM}`);
    await b.pickSelect('rule-level-0', 'rule-level-0-option-districtname');
    await expect(page.getByTestId('rule-scope-hint-0')).toContainText(
      'only at the districtname level'
    );
    await b.pickSelect('rule-level-0', 'rule-level-0-option-__all__');
    await expect(page.getByTestId('rule-level-0')).toHaveText('All levels');
    await expect(page.getByTestId('rule-scope-hint-0')).toHaveText(
      'This rule applies at every drill level.'
    );
  });

  test('IG-charts table cell with a URL renders a new-tab "Link"', async ({ page, context }) => {
    let column = '';
    await page.route(TABLE_PREVIEW_URL, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      const res = await fetchForRewrite(route);
      if (!res) return;
      const body = (await res.json()) as { data?: Array<Record<string, unknown>> };
      const first = body.data?.[0];
      if (first) {
        column ||= Object.keys(first).find((k) => typeof first[k] === 'string') ?? '';
        if (column) first[column] = LINK_URL;
      }
      await route.fulfill({ response: res, json: body });
    });
    await context.route('https://e2e.invalid/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<p>e2e link target</p>' })
    );
    const b = new MtpBuilder(page);
    await b.openCreate('table');
    await expect(tableBodyRows(b.preview).first()).toBeVisible();
    expect(column).not.toBe('');
    const link = page.getByTestId(`chart-table-link-0-${column}`);
    await expect(link).toHaveText('Link');
    await expect(link).toHaveAttribute('href', LINK_URL);
    await expect(link).toHaveAttribute('target', '_blank');
    const [popup] = await Promise.all([context.waitForEvent('page'), link.click()]);
    await expect(popup).toHaveURL(LINK_URL);
    await popup.close();
    // The builder stays put
    await expect(page).toHaveURL(/\/charts\/new\/configure\?/);
  });

  test('IG-charts pivot dimension chevrons + (i) tooltips', async ({ page }) => {
    const b = new MtpBuilder(page);
    await b.openCreate('pivot_table');
    await toggleViaChevron(page, 'pivot-row-dimension-0');
    await toggleViaChevron(page, 'pivot-col-dimension-0');
    const TIPS: Array<[string, string]> = [
      ['pivot-info-row-dimensions', 'Fields used to group data into rows.'],
      ['pivot-info-column-dimensions', 'Fields whose unique values become column headers.'],
      ['pivot-info-row-subtotals', 'Requires at least two row dimensions.'],
      ['pivot-info-column-subtotals', 'Requires at least two column dimensions.'],
      ['pivot-info-row-grand-total', 'Requires at least one column dimension.'],
      ['pivot-info-column-grand-total', 'appears when both grand totals are on.'],
    ];
    for (const [id, text] of TIPS) await expectInfoTooltip(page, id, text);
  });
});

// ---------------------------------------------------------------------------
// Edit page
// ---------------------------------------------------------------------------

async function activeTab(tab: Locator) {
  await expect(tab).toHaveAttribute('data-state', 'active');
}

test.describe('IG charts — edit page', () => {
  test('IG-charts edit tabs: Data Configuration, CHART preview, Chart Data / Raw Data', async ({
    page,
    factory,
  }) => {
    const chart = await factory.barChart('ig-edit-tabs');
    await page.goto(`/charts/${chart.id}/edit`);
    await expect(page.getByTestId('chart-name-input')).toHaveValue(chart.title, {
      timeout: 30_000,
    });

    await page.getByTestId('chart-styling-tab').click();
    await activeTab(page.getByTestId('chart-styling-tab'));
    await page.getByTestId('chart-data-config-tab').click();
    await activeTab(page.getByTestId('chart-data-config-tab'));
    await expect(page.getByTestId('chart-x-axis-select-input')).toHaveValue('statename');

    await page.getByTestId('chart-preview-tab-data').click();
    const chartDataTab = page.getByTestId('chart-data-tab-chart-data');
    await activeTab(chartDataTab);
    await page.getByTestId('chart-data-tab-raw-data').click();
    await activeTab(page.getByTestId('chart-data-tab-raw-data'));
    await expect(page.getByRole('columnheader', { name: /districtname/ })).toBeVisible();
    await chartDataTab.click();
    await activeTab(chartDataTab);
    await expect(page.getByRole('columnheader', { name: /districtname/ })).toHaveCount(0);

    await page.getByTestId('chart-preview-tab-chart').click();
    await activeTab(page.getByTestId('chart-preview-tab-chart'));
    await waitForEChart(page.getByRole('tabpanel', { name: 'CHART', exact: true }));
  });

  test('IG-charts edit table drill-down "← Back" returns to the top level', async ({
    page,
    api,
    track,
  }) => {
    // No saved sort: sorting by the top dimension breaks the drilled query (pinned test below)
    const chart = await createChart(api, track, 'table', 'ig-edit-drill', (body) => ({
      ...body,
      extra_config: { ...body.extra_config, sort: [] },
    }));
    await page.goto(`/charts/${chart.id}/edit`);
    const cell = page.getByTestId('chart-table-drill-cell-0-statename');
    await expect(cell).toBeVisible({ timeout: 30_000 });
    const value = (await cell.innerText()).trim();
    const preview = page.getByRole('tabpanel', { name: 'CHART', exact: true });
    await expect(tableBodyRows(preview)).toHaveCount(STATES);
    await cell.click();
    const back = page.getByTestId('chart-table-drill-back-btn');
    await expect(back).toBeVisible();
    await expect(page.getByText(`statename: ${value}`)).toBeVisible();
    await expect(tableBodyRows(preview)).toHaveCount(DISTRICTS_PER_STATE);
    await expect(page.getByRole('columnheader', { name: 'districtname' })).toBeVisible();

    await back.click();
    await expect(back).toBeHidden();
    await expect(tableBodyRows(preview)).toHaveCount(STATES);
    await expect(cell).toBeVisible();
  });

  test('[pinned] IG-charts edit table drill-down with a saved sort on the top dimension errors', async ({
    page,
    api,
    track,
  }) => {
    // Edit builder keeps sort=[statename] after drilling to districtname → backend GROUP BY error
    // (500) → "needs a small adjustment" alert. The detail page drills the same chart fine (C-D4).
    const chart = await createChart(api, track, 'table', 'ig-edit-drill-sorted');
    await page.goto(`/charts/${chart.id}/edit`);
    const cell = page.getByTestId('chart-table-drill-cell-0-statename');
    await expect(cell).toBeVisible({ timeout: 30_000 });
    const failed = page.waitForResponse(
      (r) =>
        TABLE_PREVIEW_URL.test(r.url()) && r.request().method() === 'POST' && r.status() === 500
    );
    await cell.click();
    const res = await failed;
    expect(await res.text()).toContain('must appear in the GROUP BY clause');
    await expect(
      page.getByText('Table configuration needs a small adjustment.', { exact: false })
    ).toBeVisible();
    await page.getByTestId('chart-table-drill-back-btn').click();
    await expect(cell).toBeVisible();
  });

  test('IG-charts edit Access Denied (view-only member) → Back to Charts', async ({
    factory,
    pageAs,
  }) => {
    const chart = await factory.barChart('ig-edit-denied');
    const member = await pageAs('member');
    await member.goto(`/charts/${chart.id}/edit`);
    await expect(member.getByText("You don't have edit access to this chart.")).toBeVisible({
      timeout: 30_000,
    });
    await member.getByTestId('chart-edit-access-denied-back-btn').click();
    await expect(member).toHaveURL(/\/charts$/);
  });
});
