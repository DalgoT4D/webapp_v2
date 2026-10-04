import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { expectChartScreenshot } from '../support/render';
import {
  applyFilters,
  buildFilterDashboard,
  chartCell,
  chartDataUrl,
  chartDataWithFilters,
  collectRequests,
  createFilter,
  dayButton,
  EDUCATION,
  EDUCATION_STATES,
  filterElement,
  filterPanel,
  FILTERS,
  kpiDataWithFilters,
  nextChartData,
  openBuilder,
  openView,
  parkMouse,
  pickDate,
  relabel,
  selectMultiValues,
  selectSingleValue,
  waitForViewChart,
} from './helpers-view';

/**
 * MATRIX §2.4 Dashboard filters (D-F1..D-F8).
 * Filters are created on e2e dashboards only (seed 411/412 are read-only).
 */

const DATASET_VALUE = `${EDUCATION.schema}.${EDUCATION.table}`;

/** Walk the Create Dashboard Filter modal up to (not including) the Create click. */
async function fillCreateModal(page: Page, column: string) {
  await page.getByTestId('dashboard-filter-add-btn').click();
  const modal = page.getByTestId('filter-config-modal');
  await expect(modal.getByRole('heading', { name: 'Create Dashboard Filter' })).toBeVisible();
  await expect(page.getByTestId('filter-config-create-btn')).toBeDisabled();
  await expect(modal.getByText('Fill in all required fields to continue')).toBeVisible();
  await expect(page.getByTestId('filter-config-tab-preview')).toBeDisabled();

  await page.getByTestId('filter-config-dataset-select-input').click();
  await page.getByTestId('filter-config-dataset-select-input').fill(EDUCATION.table);
  await page.getByTestId(`filter-config-dataset-select-item-${DATASET_VALUE}`).click();

  const columnInput = page.getByTestId('filter-config-column-select-input');
  await expect(columnInput).toBeEnabled({ timeout: 15_000 });
  await columnInput.click();
  await columnInput.fill(column);
  await page.getByTestId(`filter-config-column-select-item-${column}`).click();
  return modal;
}

/** Click Create Filter; returns the captured POST and the created filter id. */
async function submitCreate(page: Page, dashboardId: number) {
  const req = captureRequest(page, {
    method: 'POST',
    url: `/api/dashboards/${dashboardId}/filters/`,
  });
  const res = page.waitForResponse(
    (r) =>
      r.url().includes(`/api/dashboards/${dashboardId}/filters/`) && r.request().method() === 'POST'
  );
  await page.getByTestId('filter-config-create-btn').click();
  const [captured, response] = await Promise.all([req, res]);
  expect(response.ok()).toBeTruthy();
  const { id } = (await response.json()) as { id: number };
  await expect(page.getByTestId('filter-config-modal')).toBeHidden();
  return { captured, filterId: id };
}

test.describe('dashboard filters — create (builder)', () => {
  test('D-F1 create single-select value filter: dataset → column → auto type + name, preview', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'f1-single');
    await openBuilder(page, dash.id);
    // TODO testid: the builder's empty filter panel has no dashboard-filters-panel testid (panel:423)
    await expect(page.getByText('No filters added yet')).toBeVisible();

    const modal = await fillCreateModal(page, 'statename');
    await expect(modal.getByText('Dropdown Filter')).toBeVisible();
    await expect(modal.getByText('Auto-detected from character varying')).toBeVisible();
    await expect(page.getByTestId('filter-config-name-input')).toHaveValue('Statename');
    await expect(page.getByTestId('filter-config-single-select')).toBeChecked();
    await expect(page.getByTestId('filter-config-multi-select')).not.toBeChecked();

    await page.getByTestId('filter-config-tab-preview').click();
    await expect(modal.getByText(`Available Values (${EDUCATION_STATES.length})`)).toBeVisible();
    for (const state of EDUCATION_STATES)
      await expect(modal.getByText(state, { exact: true })).toBeVisible();

    const { captured, filterId } = await submitCreate(page, dash.id);
    expectPayloadSnapshot(captured, 'create-value-single');

    await expect(filterElement(page, filterId)).toBeVisible();
    await expect(filterElement(page, filterId).getByText('Statename')).toBeVisible();
    await expect(filterPanel(page).getByText('1 filter', { exact: true })).toBeVisible();
    await expect(page.getByTestId(`dashboard-filter-value-${filterId}-input`)).toHaveAttribute(
      'placeholder',
      'Select...'
    );
  });

  test('D-F1 create multi-select value filter', async ({ page, api, factory }) => {
    const dash = await buildFilterDashboard(api, factory, 'f1-multi');
    await openBuilder(page, dash.id);

    const modal = await fillCreateModal(page, 'statename');
    await page.getByTestId('filter-config-multi-select').click();
    await expect(page.getByTestId('filter-config-single-select')).not.toBeChecked();
    await expect(modal.getByText('checkboxes (multiple selection)')).toBeVisible();

    const { captured, filterId } = await submitCreate(page, dash.id);
    expectPayloadSnapshot(captured, 'create-value-multi');
    // multi-select renders the chip-style combobox (search input instead of single input)
    await expect(page.getByTestId(`dashboard-filter-value-${filterId}-search`)).toBeVisible();
  });

  // Bug pinned: new numerical filters always save default_min 0 / default_max 100 (no UI to set them),
  // so the widget starts at 0 – 100 even though the data range is 470889 – 1143195.
  test('[pinned] D-F2 create numerical slider filter saves forced default 0–100', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'f2-slider');
    await openBuilder(page, dash.id);

    const modal = await fillCreateModal(page, 'students');
    await expect(modal.getByText('Range Filter')).toBeVisible();
    await expect(page.getByTestId('filter-config-name-input')).toHaveValue('Students');
    await expect(page.getByTestId('filter-config-slider-ui')).toBeChecked();
    await expect(modal.getByText('Dual-handle range slider for min/max selection')).toBeVisible();

    const { captured, filterId } = await submitCreate(page, dash.id);
    expectPayloadSnapshot(captured, 'create-numerical-slider');

    const el = filterElement(page, filterId);
    await expect(el.getByText('Range • Slider')).toBeVisible();
    await expect(page.getByTestId(`dashboard-filter-slider-${filterId}`)).toBeVisible();
    await expect(el.getByText('0 - 100', { exact: true })).toBeVisible();
    await expect(el.getByText('470889', { exact: true })).toBeVisible();
    await expect(el.getByText('1143195', { exact: true })).toBeVisible();
  });

  test('[pinned] D-F2 create numerical input filter saves forced default 0–100', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'f2-input');
    await openBuilder(page, dash.id);

    const modal = await fillCreateModal(page, 'students');
    await page.getByTestId('filter-config-input-ui').click();
    await expect(page.getByTestId('filter-config-slider-ui')).not.toBeChecked();
    await expect(modal.getByText('Separate Min and Max input fields')).toBeVisible();

    const { captured, filterId } = await submitCreate(page, dash.id);
    expectPayloadSnapshot(captured, 'create-numerical-input');

    const el = filterElement(page, filterId);
    await expect(el.getByText('Range • Input')).toBeVisible();
    await expect(page.getByTestId(`dashboard-filter-min-input-${filterId}`)).toHaveValue('0');
    await expect(page.getByTestId(`dashboard-filter-max-input-${filterId}`)).toHaveValue('100');
    await expect(el.getByText('Min: 470889')).toBeVisible();
    await expect(el.getByText('Max: 1143195')).toBeVisible();
  });

  // Bug pinned: datetime filters fall into the non-value branch and save numerical-shaped settings
  test('[pinned] D-F3 create datetime filter saves numerical-shaped settings', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'f3-date');
    await openBuilder(page, dash.id);

    const modal = await fillCreateModal(page, 'date');
    await expect(modal.getByText('Date Range Filter').first()).toBeVisible();
    await expect(page.getByTestId('filter-config-name-input')).toHaveValue('Date');
    await page.getByTestId('filter-config-tab-preview').click();
    await expect(modal.getByText('Unique Days:')).toBeVisible();
    await expect(modal.getByText('13', { exact: true })).toBeVisible();

    const { captured, filterId } = await submitCreate(page, dash.id);
    expectPayloadSnapshot(captured, 'create-datetime');
    await expect(page.getByTestId(`dashboard-filter-datetime-${filterId}`)).toBeVisible();
    await expect(page.getByTestId(`dashboard-filter-date-start-${filterId}-trigger`)).toHaveText(
      'Start date'
    );
    await expect(page.getByTestId(`dashboard-filter-date-end-${filterId}-trigger`)).toHaveText(
      'End date'
    );
  });
});

test.describe('dashboard filters — edit / delete / reorder (builder)', () => {
  test('D-F4 edit filter: dataset disabled, rename + switch to multi → PUT', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'f4-edit');
    const filter = await createFilter(api, dash.id, FILTERS.stateSingle());
    await openBuilder(page, dash.id);

    const el = filterElement(page, filter.id);
    await el.hover();
    await page.getByTestId(`dashboard-filter-edit-${filter.id}`).click();
    const modal = page.getByTestId('filter-config-modal');
    await expect(modal.getByRole('heading', { name: 'Edit Dashboard Filter' })).toBeVisible();
    await expect(page.getByTestId('filter-config-name-input')).toHaveValue('Statename');
    await expect(page.getByTestId('filter-config-dataset-select-input')).toBeDisabled();
    await expect(page.getByTestId('filter-config-dataset-select-input')).toHaveValue(DATASET_VALUE);

    await page.getByTestId('filter-config-name-input').fill('State (edited)');
    await page.getByTestId('filter-config-multi-select').click();

    const req = captureRequest(page, {
      method: 'PUT',
      url: `/api/dashboards/${dash.id}/filters/${filter.id}/`,
    });
    await page.getByTestId('filter-config-save-btn').click();
    expectPayloadSnapshot(relabel(await req, { [filter.id]: '<filter>' }), 'update-value-filter');

    await expect(modal).toBeHidden();
    await expect(el.getByText('State (edited)')).toBeVisible();
    await expect(page.getByTestId(`dashboard-filter-value-${filter.id}-search`)).toBeVisible();
  });

  test('D-F4 delete filter: no confirm, removed immediately → DELETE', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'f4-delete');
    const keep = await createFilter(api, dash.id, { ...FILTERS.stateMulti(), order: 0 });
    const drop = await createFilter(api, dash.id, { ...FILTERS.date(), order: 1 });
    await openBuilder(page, dash.id);
    await expect(filterPanel(page).getByText('2 filters', { exact: true })).toBeVisible();

    await filterElement(page, drop.id).hover();
    const req = captureRequest(page, {
      method: 'DELETE',
      url: `/api/dashboards/${dash.id}/filters/${drop.id}/`,
    });
    await page.getByTestId(`dashboard-filter-remove-${drop.id}`).click();
    expectPayloadSnapshot(await req, 'delete-filter');

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(filterElement(page, drop.id)).toHaveCount(0);
    await expect(filterElement(page, keep.id)).toBeVisible();
    await expect(filterPanel(page).getByText('1 filter', { exact: true })).toBeVisible();
    const saved = await api.get<{ filters: Array<{ id: number }> }>(`/api/dashboards/${dash.id}/`);
    expect(saved.filters.map((f) => f.id)).toEqual([keep.id]);
  });

  test('D-F4 reorder filters by drag → PUT order per moved filter', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'f4-reorder');
    const first = await createFilter(api, dash.id, { ...FILTERS.stateMulti(), order: 0 });
    const second = await createFilter(api, dash.id, { ...FILTERS.date(), order: 1 });
    await openBuilder(page, dash.id);

    const firstBox = await filterElement(page, first.id).boundingBox();
    await filterElement(page, second.id).hover();
    const handle = page.getByTestId(`dashboard-filter-drag-${second.id}`);
    await expect(handle).toBeVisible();
    const handleBox = await handle.boundingBox();
    if (!firstBox || !handleBox) throw new Error('filter elements not laid out');

    const labels = { [first.id]: '<first>', [second.id]: '<second>' };
    const movedFirst = captureRequest(page, {
      method: 'PUT',
      url: `/api/dashboards/${dash.id}/filters/${first.id}/`,
    });
    const movedSecond = captureRequest(page, {
      method: 'PUT',
      url: `/api/dashboards/${dash.id}/filters/${second.id}/`,
    });
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    // dnd-kit starts after 5px; move in steps so collision detection sees the pass-over
    await page.mouse.move(handleBox.x + handleBox.width / 2, firstBox.y + 5, { steps: 20 });
    await page.mouse.move(handleBox.x + handleBox.width / 2, firstBox.y + 2, { steps: 5 });
    await page.mouse.up();

    expectPayloadSnapshot(relabel(await movedSecond, labels), 'reorder-moved-up');
    expectPayloadSnapshot(relabel(await movedFirst, labels), 'reorder-moved-down');

    await expect
      .poll(async () => {
        const saved = await api.get<{ filters: Array<{ id: number }> }>(
          `/api/dashboards/${dash.id}/`
        );
        return saved.filters.map((f) => f.id);
      })
      .toEqual([second.id, first.id]);
  });
});

test.describe('dashboard filters — apply / clear (view)', () => {
  test('D-F5 apply value filter → every chart + KPI refetch with dashboard_filters', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'f5-apply');
    const filter = await createFilter(api, dash.id, FILTERS.stateMulti());
    await openView(page, dash.id);
    await waitForViewChart(page, dash.barChartId);
    await waitForViewChart(page, dash.lineChartId);

    await selectMultiValues(page, filter.id, ['Assam', 'Karnataka']);

    const labels = {
      [filter.id]: '<state>',
      [dash.barChartId]: '<bar>',
      [dash.lineChartId]: '<line>',
      [dash.otherChartId]: '<other>',
      [dash.kpiId]: '<kpi>',
    };
    const bar = captureRequest(page, { method: 'GET', url: chartDataWithFilters(dash.barChartId) });
    const line = captureRequest(page, {
      method: 'GET',
      url: chartDataWithFilters(dash.lineChartId),
    });
    const other = captureRequest(page, {
      method: 'GET',
      url: chartDataWithFilters(dash.otherChartId),
    });
    const kpi = captureRequest(page, { method: 'GET', url: kpiDataWithFilters(dash.kpiId) });
    await applyFilters(page);

    expectPayloadSnapshot(relabel(await bar, labels), 'apply-value-bar');
    expectPayloadSnapshot(relabel(await line, labels), 'apply-value-line');
    expectPayloadSnapshot(relabel(await other, labels), 'apply-value-other-table');
    expectPayloadSnapshot(relabel(await kpi, labels), 'apply-value-kpi');

    const cell = await waitForViewChart(page, dash.barChartId);
    await parkMouse(page);
    await expectChartScreenshot(cell, 'bar-filtered-assam-karnataka');
  });

  test('D-F5 apply single-select value filter sends a string value', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'f5-single');
    const filter = await createFilter(api, dash.id, FILTERS.stateSingle());
    await openView(page, dash.id);
    await waitForViewChart(page, dash.barChartId);

    await selectSingleValue(page, filter.id, 'Odisha');
    const bar = captureRequest(page, { method: 'GET', url: chartDataWithFilters(dash.barChartId) });
    await applyFilters(page);
    expectPayloadSnapshot(
      relabel(await bar, { [filter.id]: '<state>', [dash.barChartId]: '<bar>' }),
      'apply-value-single-bar'
    );
    const cell = await waitForViewChart(page, dash.barChartId);
    await parkMouse(page);
    await expectChartScreenshot(cell, 'bar-filtered-odisha');
  });

  test('D-F3 datetime filter: cross-limited pickers, summary text, apply payload', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'f3-apply');
    const filter = await createFilter(api, dash.id, FILTERS.date());
    await openView(page, dash.id);
    await waitForViewChart(page, dash.lineChartId);

    const start = `dashboard-filter-date-start-${filter.id}`;
    const end = `dashboard-filter-date-end-${filter.id}`;
    await pickDate(page, start, new Date(2026, 0, 1));
    const widget = page.getByTestId(`dashboard-filter-datetime-${filter.id}`);
    await expect(widget.getByText('Filtering from Jan 1st, 2026 onwards')).toBeVisible();

    // End picker disables every date before the chosen start
    await page.getByTestId(`${end}-trigger`).click();
    await page
      .getByTestId(`${end}-popover`)
      .getByRole('combobox', { name: 'Choose the Month' })
      .selectOption('0');
    await expect(dayButton(page, end, new Date(2025, 11, 31))).toBeDisabled();
    await expect(dayButton(page, end, new Date(2026, 0, 2))).toBeEnabled();
    await page.keyboard.press('Escape');

    await pickDate(page, end, new Date(2026, 2, 31));
    await expect(widget.getByText('Filtering from Jan 1st, 2026 to Mar 31st, 2026')).toBeVisible();

    // Start picker now disables every date after the chosen end
    await page.getByTestId(`${start}-trigger`).click();
    await page
      .getByTestId(`${start}-popover`)
      .getByRole('combobox', { name: 'Choose the Month' })
      .selectOption('3');
    await expect(dayButton(page, start, new Date(2026, 3, 1))).toBeDisabled();
    await page.keyboard.press('Escape');

    const line = captureRequest(page, {
      method: 'GET',
      url: chartDataWithFilters(dash.lineChartId),
    });
    await applyFilters(page);
    expectPayloadSnapshot(
      relabel(await line, { [filter.id]: '<date>', [dash.lineChartId]: '<line>' }),
      'apply-datetime-line'
    );
  });

  // Bug pinned: the forced 0–100 default is "applied" on load, so Apply without touching the
  // filter sends {min:0,max:100} and filters out every row (students are 470k–1.1M).
  test('[pinned] D-F2 numerical filter applies forced 0–100 default untouched', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'f2-apply');
    const filter = await createFilter(api, dash.id, FILTERS.studentsInput());
    await openView(page, dash.id);
    await waitForViewChart(page, dash.barChartId);
    await expect(filterPanel(page).getByText('• Some applied')).toBeVisible();

    const bar = captureRequest(page, { method: 'GET', url: chartDataWithFilters(dash.barChartId) });
    const data = nextChartData(page, chartDataWithFilters(dash.barChartId));
    await applyFilters(page);
    expectPayloadSnapshot(
      relabel(await bar, { [filter.id]: '<students>', [dash.barChartId]: '<bar>' }),
      'apply-numerical-default-bar'
    );
    const body = (await data) as { data?: { xAxisData?: unknown[] } };
    expect(body.data?.xAxisData ?? []).toHaveLength(0);
  });

  test('D-F2 numerical input: typed range is clamped to data limits and applied', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'f2-input-apply');
    const filter = await createFilter(api, dash.id, FILTERS.studentsInput());
    await openView(page, dash.id);
    await waitForViewChart(page, dash.barChartId);

    const min = page.getByTestId(`dashboard-filter-min-input-${filter.id}`);
    const max = page.getByTestId(`dashboard-filter-max-input-${filter.id}`);
    await expect(max).toHaveValue('100');
    await min.fill('800000');
    await min.press('Enter');
    await max.fill('99999999');
    await max.press('Enter');
    await expect(max).toHaveValue('1143195');

    const bar = captureRequest(page, { method: 'GET', url: chartDataWithFilters(dash.barChartId) });
    await applyFilters(page);
    expectPayloadSnapshot(
      relabel(await bar, { [filter.id]: '<students>', [dash.barChartId]: '<bar>' }),
      'apply-numerical-input-bar'
    );
  });

  test('D-F6 clear one filter (local only), clear all refetches unfiltered, applied dot', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'f6-clear');
    const state = await createFilter(api, dash.id, { ...FILTERS.stateMulti(), order: 0 });
    await createFilter(api, dash.id, { ...FILTERS.date(), order: 1 });
    await openView(page, dash.id);
    await waitForViewChart(page, dash.barChartId);

    const panel = filterPanel(page);
    const clearAll = page.getByTestId('dashboard-filter-clear-all-btn');
    await expect(clearAll).toBeDisabled();
    await expect(panel.getByTitle('Filters applied')).toHaveCount(0);

    await selectMultiValues(page, state.id, ['Assam']);
    await expect(panel.getByTitle('Filters applied')).toBeVisible();
    await expect(panel.getByText('2 filters • Some applied')).toBeVisible();
    await expect(clearAll).toBeEnabled();

    // Clear one: local value only — no chart refetch until Apply
    const refetches = collectRequests(page, chartDataWithFilters(dash.barChartId));
    await filterElement(page, state.id).hover();
    await page.getByTestId(`dashboard-filter-clear-${state.id}`).click();
    await expect(page.getByRole('button', { name: 'Remove Assam' })).toHaveCount(0);
    await expect(panel.getByTitle('Filters applied')).toHaveCount(0);
    await expect(clearAll).toBeDisabled();
    await page.waitForLoadState('networkidle');
    expect(refetches).toHaveLength(0);

    // Apply a value, then Clear all → charts refetch with no dashboard_filters
    await selectMultiValues(page, state.id, ['Assam']);
    const filtered = nextChartData(page, chartDataWithFilters(dash.barChartId));
    await applyFilters(page);
    await filtered;

    const unfiltered = page.waitForRequest(
      (r) => chartDataUrl(dash.barChartId).test(r.url()) && !r.url().includes('dashboard_filters')
    );
    await clearAll.click();
    await unfiltered;
    await expect(page.getByRole('button', { name: 'Remove Assam' })).toHaveCount(0);
    await expect(panel.getByTitle('Filters applied')).toHaveCount(0);
    await expect(clearAll).toBeDisabled();
  });

  test('D-F7 filter only affects charts on the matching schema/table', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'f7-match');
    const filter = await createFilter(api, dash.id, FILTERS.stateMulti());

    const barBefore = nextChartData(page, chartDataUrl(dash.barChartId));
    const otherBefore = nextChartData(page, chartDataUrl(dash.otherChartId));
    await openView(page, dash.id);
    const [barUnfiltered, otherUnfiltered] = await Promise.all([barBefore, otherBefore]);

    await selectMultiValues(page, filter.id, ['Assam']);
    const barAfter = nextChartData(page, chartDataWithFilters(dash.barChartId));
    const otherAfter = nextChartData(page, chartDataWithFilters(dash.otherChartId));
    await applyFilters(page);
    const [barFiltered, otherFiltered] = await Promise.all([barAfter, otherAfter]);

    // education chart narrows to one state; menstrual chart ignores the education filter
    expect((barFiltered as { data: { xAxisData: string[] } }).data.xAxisData).toEqual(['Assam']);
    expect(barFiltered).not.toEqual(barUnfiltered);
    expect(otherFiltered).toEqual(otherUnfiltered);
    await expect(chartCell(page, dash.otherChartId)).toBeVisible();
  });
});

test.describe('dashboard filters — builder', () => {
  // Bug pinned: the builder never passes dashboardFilters to KPIs, so KPIs ignore Apply in edit mode
  test('[pinned] D-F8 builder Apply refetches charts but not KPIs', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'f8-kpi');
    const filter = await createFilter(api, dash.id, FILTERS.stateMulti());
    await openBuilder(page, dash.id);
    await expect(page.getByTestId(`kpi-card-${dash.kpiId}`)).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState('networkidle');

    await selectMultiValues(page, filter.id, ['Assam', 'Karnataka']);
    const kpiRefetches = collectRequests(page, kpiDataWithFilters(dash.kpiId));
    const bar = captureRequest(page, { method: 'GET', url: chartDataWithFilters(dash.barChartId) });
    await applyFilters(page);
    expectPayloadSnapshot(
      relabel(await bar, { [filter.id]: '<state>', [dash.barChartId]: '<bar>' }),
      'builder-apply-bar'
    );
    await page.waitForLoadState('networkidle');
    expect(kpiRefetches).toHaveLength(0);
  });
});
