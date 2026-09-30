import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import {
  applyFilters,
  buildFilterDashboard,
  chartCell,
  chartDataWithFilters,
  collectRequests,
  createFilter,
  EDUCATION,
  filterElement,
  filterPanel,
  FILTERS,
  openBuilder,
  openView,
  pickDate,
  relabel,
  selectMultiValues,
  waitForViewChart,
} from './helpers-view';
import { putTabs } from './helpers-builder';
import { holdRequests, previewUrl, rewriteJson, toasts } from './helpers-gaps-view';

/**
 * GAP-D — filter rows of coverage/FEATURES.md that had no test yet
 * ("Filters: create, edit, delete, reorder" + "Filters: using them").
 * All on e2e dashboards; states staging can't produce (loading / failures / org data) are
 * produced with page.route on the real responses.
 */

const DATASET_VALUE = `${EDUCATION.schema}.${EDUCATION.table}`;

// Below the 1200px `useResponsiveLayout` desktop breakpoint, above Tailwind `lg` (1024px):
// desktop header, but horizontal filters in the builder
const TABLET_VIEWPORT = { width: 1100, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

// dnd-kit keyboard sensor's default announcement when a drag starts
const DND_PICKED_UP = /Picked up draggable item/;

/** Walk the create modal up to (not including) Create — same steps as filters.spec D-F1. */
async function fillCreateModal(page: Page, column: string) {
  await page.getByTestId('dashboard-filter-add-btn').click();
  const modal = page.getByTestId('filter-config-modal');
  await expect(modal.getByRole('heading', { name: 'Create Dashboard Filter' })).toBeVisible();
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

test.describe('GAP-D filters — builder create / edit / reorder', () => {
  test('GAP-D filter edit modal shows "Loading filter configuration..." until the filter loads', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await factory.dashboard('gap-f-edit-loading');
    const filter = await createFilter(api, dash.id, FILTERS.stateSingle());
    await openBuilder(page, dash.id);

    const { release, held } = await holdRequests(
      page,
      `**/api/dashboards/${dash.id}/filters/${filter.id}/`
    );
    await filterElement(page, filter.id).hover();
    await page.getByTestId(`dashboard-filter-edit-${filter.id}`).click();
    await held;
    const modal = page.getByTestId('filter-config-modal');
    await expect(modal.getByText('Loading filter configuration...')).toBeVisible();
    await expect(page.getByTestId('filter-config-name-input')).toHaveCount(0);

    release();
    await expect(modal.getByText('Loading filter configuration...')).toHaveCount(0);
    await expect(page.getByTestId('filter-config-name-input')).toHaveValue('Statename');
  });

  // Bug pinned: useSortable's `attributes` (role=button, tabindex=0, "press the space bar…"
  // instructions) sit on the item wrapper, but its `listeners` (incl. the keyboard sensor's
  // onKeyDown) sit on the non-focusable drag-handle div. Keyboard focus lands on the wrapper,
  // whose keydown never reaches the handle, so Space never picks the filter up.
  test('[pinned] GAP-D filter keyboard reorder is advertised but does nothing', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await factory.dashboard('gap-f-kbd-reorder');
    const first = await createFilter(api, dash.id, { ...FILTERS.stateMulti(), order: 0 });
    const second = await createFilter(api, dash.id, { ...FILTERS.date(), order: 1 });
    await openBuilder(page, dash.id);

    // TODO testid: the sortable wrapper has no testid; it is the role=button around the filter
    const item = page.getByRole('button').filter({ has: filterElement(page, second.id) });
    await expect(item).toHaveAttribute('aria-roledescription', 'sortable');
    await expect(item).toHaveAccessibleDescription(/press the space bar/);

    const yOf = async (id: number) => (await filterElement(page, id).boundingBox())!.y;
    expect(await yOf(first.id)).toBeLessThan(await yOf(second.id));

    const reorders = collectRequests(page, new RegExp(`/api/dashboards/${dash.id}/filters/\\d+/$`));
    await item.focus();
    await expect(item).toBeFocused();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Space');

    await expect(page.getByText(DND_PICKED_UP)).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    expect(reorders.filter((r) => r.method() === 'PUT')).toHaveLength(0);
    expect(await yOf(first.id)).toBeLessThan(await yOf(second.id));
    const saved = await api.get<{ filters: Array<{ id: number }> }>(`/api/dashboards/${dash.id}/`);
    expect(saved.filters.map((f) => f.id)).toEqual([first.id, second.id]);
  });

  // The modal closes right after handing the payload to the builder (not awaiting the save), so a
  // failed create just loses what was typed — no toast, no inline error
  test('GAP-D filter create failure is silent: modal closes, no toast, no filter', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('gap-f-create-fail');
    await openBuilder(page, dash.id);
    await page.route(`**/api/dashboards/${dash.id}/filters/`, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 500, json: { detail: 'e2e forced create failure' } })
        : route.fallback()
    );

    const modal = await fillCreateModal(page, 'statename');
    const req = captureRequest(page, {
      method: 'POST',
      url: `/api/dashboards/${dash.id}/filters/`,
    });
    const res = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/dashboards/${dash.id}/filters/`) && r.request().method() === 'POST'
    );
    await page.getByTestId('filter-config-create-btn').click();
    expectPayloadSnapshot(await req, 'gap-create-filter-failure');
    expect((await res).status()).toBe(500);

    await expect(modal).toBeHidden();
    await page.waitForLoadState('networkidle');
    await expect(toasts(page)).toHaveCount(0);
    await expect(page.getByText('e2e forced create failure')).toHaveCount(0);
    await expect(page.getByText('No filters added yet')).toBeVisible();
  });

  test('GAP-D filter update failure is silent: modal closes, no toast, name unchanged', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await factory.dashboard('gap-f-update-fail');
    const filter = await createFilter(api, dash.id, FILTERS.stateSingle());
    await openBuilder(page, dash.id);
    await page.route(`**/api/dashboards/${dash.id}/filters/${filter.id}/`, (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({ status: 500, json: { detail: 'e2e forced update failure' } })
        : route.fallback()
    );

    await filterElement(page, filter.id).hover();
    await page.getByTestId(`dashboard-filter-edit-${filter.id}`).click();
    const modal = page.getByTestId('filter-config-modal');
    await expect(page.getByTestId('filter-config-name-input')).toHaveValue('Statename');
    await page.getByTestId('filter-config-name-input').fill('State (never saved)');

    const req = captureRequest(page, {
      method: 'PUT',
      url: `/api/dashboards/${dash.id}/filters/${filter.id}/`,
    });
    await page.getByTestId('filter-config-save-btn').click();
    expectPayloadSnapshot(
      relabel(await req, { [filter.id]: '<filter>' }),
      'gap-update-filter-failure'
    );

    await expect(modal).toBeHidden();
    await page.waitForLoadState('networkidle');
    await expect(toasts(page)).toHaveCount(0);
    await expect(page.getByText('e2e forced update failure')).toHaveCount(0);
    await expect(
      filterElement(page, filter.id).getByText('Statename', { exact: true })
    ).toBeVisible();
    const saved = await api.get<{ filters: Array<{ id: number; name: string }> }>(
      `/api/dashboards/${dash.id}/`
    );
    expect(saved.filters.find((f) => f.id === filter.id)?.name).toBe('Statename');
  });

  test('GAP-D builder below 1200px: horizontal filter bar, hide → "Show Filters (n)" → back', async ({
    page,
    api,
    factory,
  }) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    const dash = await factory.dashboard('gap-f-horizontal');
    const filter = await createFilter(api, dash.id, FILTERS.stateMulti());
    await openBuilder(page, dash.id);

    const panel = filterPanel(page);
    await expect(panel).toBeVisible();
    await expect(filterElement(page, filter.id)).toBeVisible();
    await expect(panel.getByText('1 filter', { exact: true })).toBeVisible();
    // Horizontal bar: X "Hide filters" instead of the sidebar's collapse button
    await expect(page.getByTestId('dashboard-filter-panel-collapse-btn')).toHaveCount(0);
    const panelBox = (await panel.boundingBox())!;
    expect(panelBox.width).toBeGreaterThan(TABLET_VIEWPORT.width / 2);

    await page.getByTestId('dashboard-filter-panel-hide-btn').click();
    await expect(filterElement(page, filter.id)).toHaveCount(0);
    const show = page.getByTestId('dashboard-builder-show-filters-btn');
    await expect(show).toHaveText('Show Filters (1)');

    await show.click();
    await expect(show).toHaveCount(0);
    await expect(filterElement(page, filter.id)).toBeVisible();
  });
});

test.describe('GAP-D filters — using them (view)', () => {
  test('GAP-D date filter with only an end date: "Filtering up to …", applied', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'gap-f-date-end');
    const filter = await createFilter(api, dash.id, FILTERS.date());
    await openView(page, dash.id);
    await waitForViewChart(page, dash.lineChartId);

    await pickDate(page, `dashboard-filter-date-end-${filter.id}`, new Date(2026, 2, 31));
    const widget = page.getByTestId(`dashboard-filter-datetime-${filter.id}`);
    await expect(widget.getByText('Filtering up to Mar 31st, 2026')).toBeVisible();
    await expect(page.getByTestId(`dashboard-filter-date-start-${filter.id}-trigger`)).toHaveText(
      'Start date'
    );

    const line = captureRequest(page, {
      method: 'GET',
      url: chartDataWithFilters(dash.lineChartId),
    });
    await applyFilters(page);
    expectPayloadSnapshot(
      relabel(await line, { [filter.id]: '<date>', [dash.lineChartId]: '<line>' }),
      'gap-apply-datetime-end-only-line'
    );
  });

  test('GAP-D range slider: dragging both handles to the ends, then Apply', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'gap-f-slider');
    // Explicit in-range defaults so the handles start inside the data range (470889 – 1143195)
    const filter = await createFilter(api, dash.id, {
      ...FILTERS.studentsInput(),
      settings: { ui_mode: 'slider', default_min: 500000, default_max: 1000000, step: 1 },
    });
    await openView(page, dash.id);
    await waitForViewChart(page, dash.barChartId);

    const el = filterElement(page, filter.id);
    await expect(el.getByText('500000 - 1000000', { exact: true })).toBeVisible();
    const thumbs = page.getByTestId(`dashboard-filter-slider-${filter.id}`).getByRole('slider');
    await expect(thumbs).toHaveCount(2);

    const drag = async (index: number, dx: number) => {
      const box = (await thumbs.nth(index).boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y, { steps: 10 });
      await page.mouse.up();
    };
    // Far past either end → clamped to the data min / max
    await drag(0, -2000);
    await expect(el.getByText('470889 - 1000000', { exact: true })).toBeVisible();
    await drag(1, 2000);
    await expect(el.getByText('470889 - 1143195', { exact: true })).toBeVisible();

    const bar = captureRequest(page, { method: 'GET', url: chartDataWithFilters(dash.barChartId) });
    await applyFilters(page);
    expectPayloadSnapshot(
      relabel(await bar, { [filter.id]: '<students>', [dash.barChartId]: '<bar>' }),
      'gap-apply-numerical-slider-dragged-bar'
    );
  });

  test('GAP-D Apply shows a short spinner (button disabled) before charts reload', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await factory.dashboard('gap-f-apply-spinner');
    await createFilter(api, dash.id, FILTERS.stateMulti());
    await openView(page, dash.id);

    const apply = page.getByTestId('dashboard-filter-apply-btn');
    await expect(apply).toBeEnabled();
    await apply.click();
    await expect(apply).toBeDisabled();
    await expect(page.getByTestId('dashboard-filter-clear-all-btn')).toBeDisabled();
    await expect(apply).toBeEnabled();
  });

  test('GAP-D view filter panel: collapse / expand and hide / show the filter list', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await buildFilterDashboard(api, factory, 'gap-f-collapse');
    const filter = await createFilter(api, dash.id, FILTERS.stateMulti());
    await openView(page, dash.id);
    const bar = await waitForViewChart(page, dash.barChartId);
    await selectMultiValues(page, filter.id, ['Assam']);

    // Hide / show only the list (header, Apply stay)
    const listToggle = page.getByTestId('dashboard-filter-list-toggle-btn');
    await expect(listToggle).toHaveAccessibleName('Hide filter list');
    await listToggle.click();
    await expect(filterElement(page, filter.id)).toHaveCount(0);
    await expect(page.getByTestId('dashboard-filter-apply-btn')).toBeVisible();
    await expect(listToggle).toHaveAccessibleName('Show filter list');
    await listToggle.click();
    await expect(filterElement(page, filter.id)).toBeVisible();

    // Collapse the whole panel: the canvas gets the freed width, the applied dot stays
    const widthBefore = (await bar.boundingBox())!.width;
    await page.getByTestId('dashboard-filter-panel-collapse-btn').click();
    const expand = page.getByTestId('dashboard-filter-panel-expand-btn');
    await expect(expand).toBeVisible();
    await expect(filterElement(page, filter.id)).toHaveCount(0);
    await expect(page.getByTestId('dashboard-filter-apply-btn')).toHaveCount(0);
    await expect(filterPanel(page).getByTitle('Filters applied')).toBeVisible();
    await expect
      .poll(async () => (await chartCell(page, dash.barChartId).boundingBox())!.width)
      .toBeGreaterThan(widthBefore);

    await expand.click();
    await expect(filterElement(page, filter.id)).toBeVisible();
    // The unapplied selection survives collapse/expand
    await expect(
      page
        .getByTestId(`dashboard-filter-value-${filter.id}-container`)
        .getByRole('button', { name: 'Remove Assam' })
    ).toBeVisible();
  });

  // Bug pinned: "N applied" counts every key of the applied map — unset filters are sent as null
  // on Apply — so after Apply it always equals the total filter count (2), not the 1 that is set.
  test('[pinned] GAP-D mobile filter accordion "Filters • N applied" counts every filter', async ({
    page,
    api,
    factory,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    const dash = await factory.dashboard('gap-f-mobile');
    const state = await createFilter(api, dash.id, { ...FILTERS.stateMulti(), order: 0 });
    await createFilter(api, dash.id, { ...FILTERS.date(), order: 1 });
    await page.goto(`/dashboards/${dash.id}`);
    await expect(page.getByTestId('dashboard-view-back-btn-mobile')).toBeVisible({
      timeout: 30_000,
    });

    const section = page.getByTestId('dashboard-filters-section');
    const trigger = page.getByTestId('dashboard-filters-accordion-trigger');
    await expect(section).toBeVisible();
    await expect(trigger).toHaveText('Filters');
    await expect(filterElement(page, state.id)).toHaveCount(0);

    await trigger.click();
    await expect(filterElement(page, state.id)).toBeVisible();
    await selectMultiValues(page, state.id, ['Assam']);
    await applyFilters(page);
    await expect(trigger).toHaveText('Filters• 2 applied');

    await page.getByTestId('dashboard-filter-clear-all-btn').click();
    await expect(trigger).toHaveText('Filters');
  });

  test('GAP-D dropdown filter shows "Loading options..." while options load', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await factory.dashboard('gap-f-opt-loading');
    const filter = await createFilter(api, dash.id, FILTERS.stateSingle());
    const { release, held } = await holdRequests(page, previewUrl('statename'));
    await openView(page, dash.id);
    await held;

    const el = filterElement(page, filter.id);
    await expect(el.getByText('Loading options...')).toBeVisible();
    await expect(page.getByTestId(`dashboard-filter-value-${filter.id}-input`)).toHaveCount(0);
    release();
    await expect(page.getByTestId(`dashboard-filter-value-${filter.id}-input`)).toHaveAttribute(
      'placeholder',
      'Choose option...'
    );
    await expect(el.getByText('Loading options...')).toHaveCount(0);
  });

  test('GAP-D dropdown filter shows "Options need attention" with the error when options fail', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await factory.dashboard('gap-f-opt-error');
    const filter = await createFilter(api, dash.id, FILTERS.stateSingle());
    await page.route(previewUrl('statename'), (route) =>
      route.fulfill({ status: 500, json: { detail: 'e2e forced options failure' } })
    );
    await openView(page, dash.id);

    const el = filterElement(page, filter.id);
    await expect(el.getByText('Options need attention')).toBeVisible({ timeout: 30_000 });
    await expect(el.getByText('e2e forced options failure')).toBeVisible();
    await expect(page.getByTestId(`dashboard-filter-value-${filter.id}-input`)).toHaveCount(0);
  });

  test('GAP-D dropdown filter shows "No options available" for an empty column', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await factory.dashboard('gap-f-opt-empty');
    const filter = await createFilter(api, dash.id, FILTERS.stateSingle());
    await page.route(previewUrl('statename'), (route) => route.fulfill({ json: { options: [] } }));
    await openView(page, dash.id);

    const el = filterElement(page, filter.id);
    await expect(el.getByText('No options available')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId(`dashboard-filter-value-${filter.id}-input`)).toHaveCount(0);
  });

  // The cap is the `limit=100` the widget asks the backend for; the widget lists whatever returns
  test('GAP-D dropdown filter asks for at most 100 options and lists them all', async ({
    page,
    api,
    factory,
  }) => {
    const OPTION_LIMIT = 100;
    const dash = await factory.dashboard('gap-f-opt-cap');
    const filter = await createFilter(api, dash.id, FILTERS.stateSingle());
    const options = Array.from({ length: OPTION_LIMIT }, (_, i) => {
      const v = `Value ${String(i + 1).padStart(3, '0')}`;
      return { value: v, label: v, count: 1 };
    });
    await page.route(previewUrl('statename'), (route) => route.fulfill({ json: { options } }));

    const preview = captureRequest(page, {
      method: 'GET',
      url: previewUrl('statename'),
      timeout: 30_000,
    });
    await openView(page, dash.id);
    expectPayloadSnapshot(await preview, 'gap-filter-options-preview');

    await page.getByTestId(`dashboard-filter-value-${filter.id}-input`).click();
    // TODO testid: items only carry a per-value testid; match the prefix to count them
    const items = page.locator(`[data-testid^="dashboard-filter-value-${filter.id}-item-"]`);
    await expect(items).toHaveCount(OPTION_LIMIT);
    await expect(
      page.getByTestId(`dashboard-filter-value-${filter.id}-item-Value 100`)
    ).toBeAttached();
  });

  // "Filter needs attention" is unreachable: its try/catch wraps JSX creation, not rendering.
  test('GAP-D broken filters: "Invalid filter configuration", "Filter not found", panel drops invalid rows', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await factory.dashboard('gap-f-broken');
    const real = await createFilter(api, dash.id, FILTERS.stateMulti());
    // Legacy in-canvas "filter" widgets: one whose inline config lacks schema/table, one pointing
    // at a filter id that doesn't exist
    await putTabs(api, dash, [
      {
        id: 'tab-1700000000001',
        title: 'Main',
        layout_config: [
          { i: 'filter-1700000000041', x: 0, y: 0, w: 6, h: 6 },
          { i: 'filter-1700000000042', x: 6, y: 0, w: 6, h: 6 },
        ],
        components: {
          'filter-1700000000041': {
            id: 'filter-1700000000041',
            type: 'filter',
            config: {
              id: 'legacy-inline',
              name: 'Legacy',
              filter_type: 'value',
              column_name: 'statename',
            },
          },
          'filter-1700000000042': {
            id: 'filter-1700000000042',
            type: 'filter',
            config: { filterId: 999999999 },
          },
        },
      },
    ]);
    // A saved filter row with no column (can't be created through the API) — the panel skips it
    const BROKEN_ID = 999999998;
    await rewriteJson(page, `**/api/dashboards/${dash.id}/`, (json) => ({
      ...json,
      filters: [
        ...(json.filters as unknown[]),
        {
          id: BROKEN_ID,
          name: 'Broken',
          filter_type: 'value',
          schema_name: EDUCATION.schema,
          table_name: EDUCATION.table,
          column_name: null,
          settings: { has_default_value: false, can_select_multiple: false },
          order: 1,
        },
      ],
    }));
    await openView(page, dash.id);

    await expect(page.getByText('Invalid filter configuration')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Filter not found: ID 999999999')).toBeVisible();
    await expect(page.getByText(`Available: ${real.id}, ${BROKEN_ID}`)).toBeVisible();

    await expect(filterElement(page, real.id)).toBeVisible();
    await expect(filterElement(page, BROKEN_ID)).toHaveCount(0);
    await expect(filterPanel(page).getByText('1 filter', { exact: true })).toBeVisible();
    await expect(page.getByText('Filter needs attention')).toHaveCount(0);
  });
});
