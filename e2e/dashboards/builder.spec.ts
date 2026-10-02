import { test, expect, installUiGuards } from '../support/fixtures';
import { installEmailGuard } from '../support/email-guard';
import { installInteractionRecorder } from '../support/interactions';
import { e2eTitle, ROLE_USERS } from '../support/env';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { waitForEChart, expectChartScreenshot } from '../support/render';
import {
  AUTOSAVE_TIMEOUT_MS,
  FIXED_IDS,
  SEED_CHARTS,
  SEED_KPIS,
  addChartViaModal,
  addKpiViaModal,
  addText,
  captureNextPut,
  clickCellAction,
  releaseBuilderLocks,
  cell,
  cellsOfKind,
  chartComponent,
  dashboardUrl,
  dragCell,
  dragContent,
  expectBuilderPayload,
  gridItem,
  layoutOf,
  openBuilder,
  putTabs,
  resizeCell,
  saveAndCapture,
  textComponent,
  watchBuilderReady,
} from './helpers-builder';

// Autosave debounce is 5s (builder:776); anything well under that proves it didn't fire early
const AUTOSAVE_MIN_DELAY_MS = 4_000;
// Artificial latency on the save PUT so the transient "Saving..." state is observable
const SLOW_SAVE_MS = 1_500;
const DESCRIPTION_MAX = 100;

test.describe('dashboard builder', () => {
  test.afterEach(async ({ api }) => releaseBuilderLocks(api));

  test('D-B1 /dashboards/create auto-POSTs and lands on /edit?new=true with title in edit mode', async ({
    page,
    track,
  }) => {
    const post = captureRequest(page, { method: 'POST', url: /\/api\/dashboards\/$/ });
    const created = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/dashboards\/$/.test(r.url())
    );
    const ready = watchBuilderReady(page, null); // id unknown until the POST returns
    await page.goto('/dashboards/create');
    const body = await post;
    const { id } = (await (await created).json()) as { id: number };
    // UI-created objects are titled "Untitled Dashboard" — track immediately, rename below
    track('dashboards', id);
    expectPayloadSnapshot(body, 'd-b1-create-post');

    await expect(page).toHaveURL(new RegExp(`/dashboards/${id}/edit\\?new=true$`));
    await ready();
    await expect(page.getByText('Dashboard created successfully!')).toBeVisible();

    const titleInput = page.getByTestId('dashboard-title-input');
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue('Untitled Dashboard');
    await expect(titleInput).toBeFocused();

    const put = captureNextPut(page, id);
    await titleInput.fill(e2eTitle('created'));
    await titleInput.press('Enter');
    expectBuilderPayload(await put, 'd-b1-rename-put');
    await expect(page.getByTestId('dashboard-title-display')).toHaveText(e2eTitle('created'));
  });

  test('D-B2 title: Enter and blur save, empty becomes "Untitled Dashboard"', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('title');
    await openBuilder(page, dash.id);
    const display = page.getByTestId('dashboard-title-display');
    const input = page.getByTestId('dashboard-title-input');
    await expect(display).toHaveText(dash.title);

    // Enter
    await display.click();
    await expect(input).toHaveValue(dash.title);
    let put = captureNextPut(page, dash.id);
    await input.fill(e2eTitle('title-enter'));
    await input.press('Enter');
    expectBuilderPayload(await put, 'd-b2-title-enter-put');
    await expect(display).toHaveText(e2eTitle('title-enter'));

    // Blur
    await display.click();
    put = captureNextPut(page, dash.id);
    await input.fill(e2eTitle('title-blur'));
    await input.blur();
    expect(((await put).body as { title: string }).title).toBe(e2eTitle('title-blur'));
    await expect(display).toHaveText(e2eTitle('title-blur'));

    // Empty → default title
    await display.click();
    put = captureNextPut(page, dash.id);
    await input.fill('   ');
    await input.press('Enter');
    expect(((await put).body as { title: string }).title).toBe('Untitled Dashboard');
    await expect(display).toHaveText('Untitled Dashboard');
  });

  test('D-B2 description: 100-char counter, Cmd/Ctrl+Enter saves, Esc reverts', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('description');
    await openBuilder(page, dash.id);
    const display = page.getByTestId('dashboard-description-display');
    const input = page.getByTestId('dashboard-description-input');
    await expect(display).toHaveText('+ Add description');

    await display.click();
    await expect(input).toBeFocused();
    await expect(page.getByText(`0/${DESCRIPTION_MAX}`)).toBeVisible();
    // maxLength caps typing at 100 characters
    await input.pressSequentially('x'.repeat(DESCRIPTION_MAX + 20));
    await expect(input).toHaveValue('x'.repeat(DESCRIPTION_MAX));
    await expect(page.getByText(`${DESCRIPTION_MAX}/${DESCRIPTION_MAX}`)).toBeVisible();

    await input.fill('Programme reach by state');
    await expect(page.getByText(`24/${DESCRIPTION_MAX}`)).toBeVisible();
    const put = captureNextPut(page, dash.id);
    await input.press('ControlOrMeta+Enter');
    expectBuilderPayload(await put, 'd-b2-description-put');
    await expect(input).toBeHidden();
    await expect(display).toHaveText('Programme reach by state');

    // Esc discards the edit and restores the value from when the popover opened
    await display.click();
    await input.fill('discard me');
    await input.press('Escape');
    await expect(input).toBeHidden();
    await expect(display).toHaveText('Programme reach by state');
  });

  test('D-B3 explicit Save sends full payload; status Saving… → Saved', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('save');
    await openBuilder(page, dash.id);
    await addChartViaModal(page, SEED_CHARTS.bar);
    await addKpiViaModal(page, SEED_KPIS.femaleScores);
    await addText(page);

    await page.route(dashboardUrl(dash.id), async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      await new Promise((r) => setTimeout(r, SLOW_SAVE_MS));
      return route.fallback();
    });
    const put = saveAndCapture(page, dash.id);
    await expect(page.getByTestId('dashboard-save-status-saving')).toHaveText('Saving...');
    expectBuilderPayload(await put, 'd-b3-save-put');
    await expect(page.getByTestId('dashboard-save-status-saved')).toHaveText('Saved');
    // "Saved" clears itself after 3s (builder:1060)
    await expect(page.getByTestId('dashboard-save-status-saved')).toBeHidden();
  });

  test('D-B4 [pinned] autosave PUTs on mount with no user change', async ({ page, factory }) => {
    // useDebounce seeds with the initial state, so the autosave effect fires as soon as the
    // builder mounts (coverage/dashboards.md item 4) — opening the editor is a write.
    const dash = await factory.dashboard('autosave-mount');
    const put = captureNextPut(page, dash.id);
    await page.goto(`/dashboards/${dash.id}/edit`);
    expectBuilderPayload(await put, 'd-b4-mount-put');
  });

  test('D-B4 autosave fires ~5s after a change', async ({ page, factory }) => {
    const dash = await factory.dashboard('autosave');
    await openBuilder(page, dash.id);
    const put = captureNextPut(page, dash.id, AUTOSAVE_TIMEOUT_MS);
    const changedAt = Date.now();
    await addText(page);
    const body = await put;
    expect(Date.now() - changedAt).toBeGreaterThanOrEqual(AUTOSAVE_MIN_DELAY_MS);
    expectBuilderPayload(body, 'd-b4-autosave-put');
  });

  test('D-B5 Add Chart modal: search, insert renders cell, "Already added" is disabled', async ({
    page,
    factory,
  }) => {
    const chart = await factory.barChart('builder-shot');
    const dash = await factory.dashboard('add-chart');
    await openBuilder(page, dash.id);

    await page.getByTestId('add-chart-btn').click();
    const modal = page.getByTestId('dashboard-chart-selector-modal');
    await expect(modal.getByRole('heading', { name: 'Add Chart' })).toBeVisible();
    await modal.getByTestId('dashboard-chart-selector-search').fill('zzz-e2e-no-such-chart');
    await expect(modal.getByText('No charts found matching your search.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    const componentId = await addChartViaModal(page, chart);
    const c = cell(page, componentId);
    await expect(c.getByTestId(`dashboard-chart-title-display-${chart.id}`)).toHaveText(
      chart.title
    );
    await waitForEChart(c);
    await page.mouse.move(0, 0); // hover-revealed toolbar/drag strip out of the shot
    // Chart canvas only — the title carries the per-run e2e prefix
    await expectChartScreenshot(c.locator('div[_echarts_instance_]').first(), 'd-b5-bar-cell');

    // Same chart again: card is marked and clicking it does nothing
    await page.getByTestId('add-chart-btn').click();
    await modal.getByTestId('dashboard-chart-selector-search').fill(chart.title);
    const option = modal.getByTestId(`dashboard-chart-option-${chart.id}`);
    await expect(option.getByText('Already added')).toBeVisible();
    await option.click();
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(cellsOfKind(page, 'chart')).toHaveCount(1);

    expectBuilderPayload(await saveAndCapture(page, dash.id), 'd-b5-add-chart-put', [chart.id]);
  });

  test('D-B6 Add KPI modal: search, insert renders KPI card, "Already added" is disabled', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('add-kpi');
    await openBuilder(page, dash.id);

    await page.getByTestId('add-kpi-btn').click();
    const modal = page.getByTestId('dashboard-kpi-selector-modal');
    await expect(modal.getByRole('heading', { name: 'Add KPI' })).toBeVisible();
    await modal.getByTestId('dashboard-kpi-selector-search').fill('zzz-e2e-no-such-kpi');
    await expect(modal.getByText('No KPIs found matching your search.')).toBeVisible();
    await page.keyboard.press('Escape');

    const componentId = await addKpiViaModal(page, SEED_KPIS.femaleScores);
    await expect(
      cell(page, componentId).getByTestId(`kpi-card-${SEED_KPIS.femaleScores.id}`)
    ).toBeVisible();

    await page.getByTestId('add-kpi-btn').click();
    await modal.getByTestId('dashboard-kpi-selector-search').fill(SEED_KPIS.femaleScores.name);
    const option = modal.getByTestId(`dashboard-kpi-option-${SEED_KPIS.femaleScores.id}`);
    await expect(option.getByText('Already added')).toBeVisible();
    await option.click();
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(cellsOfKind(page, 'kpi')).toHaveCount(1);

    expectBuilderPayload(await saveAndCapture(page, dash.id), 'd-b6-add-kpi-put');
  });

  test.describe('D-B9 cell toolbar', () => {
    // chart on top, KPI below it, text at the bottom
    const layout = [
      { i: FIXED_IDS.chart1, x: 0, y: 0, w: 12, h: 18 },
      { i: FIXED_IDS.kpi1, x: 0, y: 18, w: 6, h: 11 },
      { i: FIXED_IDS.text1, x: 0, y: 29, w: 12, h: 8 },
    ];
    const components = {
      [FIXED_IDS.chart1]: chartComponent(FIXED_IDS.chart1, SEED_CHARTS.bar),
      [FIXED_IDS.kpi1]: {
        id: FIXED_IDS.kpi1,
        type: 'kpi',
        config: { kpiId: SEED_KPIS.femaleScores.id, title: SEED_KPIS.femaleScores.name },
      },
      [FIXED_IDS.text1]: textComponent(FIXED_IDS.text1, 'Notes'),
    };

    test('chart View / Edit navigate with ?from=dashboard', async ({ page, factory, api }) => {
      const dash = await factory.dashboard('cell-chart-nav');
      await putTabs(api, dash, [
        { id: FIXED_IDS.tab1, title: 'Tab', layout_config: layout, components },
      ]);

      await openBuilder(page, dash.id);
      await clickCellAction(page, FIXED_IDS.chart1, 'view');
      await expect(page).toHaveURL(`/charts/${SEED_CHARTS.bar.id}?from=dashboard`);

      await openBuilder(page, dash.id);
      await clickCellAction(page, FIXED_IDS.chart1, 'edit');
      await expect(page).toHaveURL(`/charts/${SEED_CHARTS.bar.id}/edit?from=dashboard`);
    });

    test('KPI View / Edit navigate to the KPI page', async ({ page, factory, api }) => {
      const dash = await factory.dashboard('cell-kpi-nav');
      await putTabs(api, dash, [
        { id: FIXED_IDS.tab1, title: 'Tab', layout_config: layout, components },
      ]);
      const kpiId = SEED_KPIS.femaleScores.id;

      await openBuilder(page, dash.id);
      await clickCellAction(page, FIXED_IDS.kpi1, 'view');
      await expect(page).toHaveURL(`/kpis?open=${kpiId}&from=dashboard`);

      await openBuilder(page, dash.id);
      await clickCellAction(page, FIXED_IDS.kpi1, 'edit');
      await expect(page).toHaveURL(`/kpis?edit=${kpiId}&from=dashboard`);
    });

    test('Remove chart, KPI and text; widgets below slide up', async ({ page, factory, api }) => {
      const dash = await factory.dashboard('cell-remove');
      await putTabs(api, dash, [
        { id: FIXED_IDS.tab1, title: 'Tab', layout_config: layout, components },
      ]);
      await openBuilder(page, dash.id);

      // Text has no View/Edit — only Remove
      await cell(page, FIXED_IDS.text1).hover();
      await expect(page.getByTestId(`dashboard-cell-view-${FIXED_IDS.text1}`)).toHaveCount(0);

      await clickCellAction(page, FIXED_IDS.chart1, 'remove');
      await expect(cell(page, FIXED_IDS.chart1)).toHaveCount(0);
      let captured = await saveAndCapture(page, dash.id);
      // compactVertical: KPI (was y=18) and text (was y=29) move up by the chart's height
      expect(layoutOf(captured.body, FIXED_IDS.kpi1)).toMatchObject({ x: 0, y: 0 });
      expect(layoutOf(captured.body, FIXED_IDS.text1)).toMatchObject({ y: 11 });
      expectBuilderPayload(captured, 'd-b9-remove-chart-put');

      await clickCellAction(page, FIXED_IDS.kpi1, 'remove');
      await clickCellAction(page, FIXED_IDS.text1, 'remove');
      await expect(page.locator('[data-testid^="dashboard-cell-"]')).toHaveCount(0);
      captured = await saveAndCapture(page, dash.id);
      expect(layoutOf(captured.body, FIXED_IDS.text1)).toBeUndefined();
      expectBuilderPayload(captured, 'd-b9-remove-all-put');
    });
  });

  test.describe('D-B10 drag and resize', () => {
    const twoStacked = () => ({
      layout_config: [
        { i: FIXED_IDS.chart1, x: 0, y: 0, w: 6, h: 12 },
        { i: FIXED_IDS.chart2, x: 0, y: 12, w: 6, h: 12 },
      ],
      components: {
        [FIXED_IDS.chart1]: chartComponent(FIXED_IDS.chart1, SEED_CHARTS.bar),
        [FIXED_IDS.chart2]: chartComponent(FIXED_IDS.chart2, SEED_CHARTS.pie, 'pie'),
      },
    });

    test('drag by the top strip moves the widget; neighbour compacts up', async ({
      page,
      factory,
      api,
    }) => {
      const dash = await factory.dashboard('drag');
      await putTabs(api, dash, [{ id: FIXED_IDS.tab1, title: 'Tab', ...twoStacked() }]);
      await openBuilder(page, dash.id);

      const box = (await gridItem(page, FIXED_IDS.chart1).boundingBox())!;
      // w=6 item → one "half canvas" step to the right
      await dragCell(page, FIXED_IDS.chart1, box.width + 8, 0);
      const captured = await saveAndCapture(page, dash.id);
      expect(layoutOf(captured.body, FIXED_IDS.chart1)).toMatchObject({ x: 6, y: 0, w: 6, h: 12 });
      expect(layoutOf(captured.body, FIXED_IDS.chart2)).toMatchObject({ x: 0, y: 0 });
      expectBuilderPayload(captured, 'd-b10-drag-put');
    });

    test('dragging from the chart content does not move the widget', async ({
      page,
      factory,
      api,
    }) => {
      const dash = await factory.dashboard('drag-content');
      await putTabs(api, dash, [{ id: FIXED_IDS.tab1, title: 'Tab', ...twoStacked() }]);
      await openBuilder(page, dash.id);

      const box = (await gridItem(page, FIXED_IDS.chart1).boundingBox())!;
      await dragContent(page, FIXED_IDS.chart1, box.width + 8, 0);
      const { body } = await saveAndCapture(page, dash.id);
      expect(layoutOf(body, FIXED_IDS.chart1)).toMatchObject({ x: 0, y: 0 });
      expect(layoutOf(body, FIXED_IDS.chart2)).toMatchObject({ x: 0, y: 12 });
    });

    test('resize grows the widget and clamps at the per-type minimum', async ({
      page,
      factory,
      api,
    }) => {
      const dash = await factory.dashboard('resize');
      await putTabs(api, dash, [{ id: FIXED_IDS.tab1, title: 'Tab', ...twoStacked() }]);
      await openBuilder(page, dash.id);

      const box = (await gridItem(page, FIXED_IDS.chart1).boundingBox())!;
      const colStep = (box.width + 8) / 6; // one column incl. the 8px margin
      const ROW_STEP = 28; // rowHeight 20 + margin 8
      await resizeCell(page, FIXED_IDS.chart1, 'se', colStep * 2, ROW_STEP * 4);
      let captured = await saveAndCapture(page, dash.id);
      expect(layoutOf(captured.body, FIXED_IDS.chart1)).toMatchObject({ x: 0, y: 0, w: 8, h: 16 });
      // pushed down below the taller widget
      expect(layoutOf(captured.body, FIXED_IDS.chart2)).toMatchObject({ y: 16 });
      expectBuilderPayload(captured, 'd-b10-resize-grow-put');

      // Shrink far past the minimum → clamps to the chart minimum
      await resizeCell(page, FIXED_IDS.chart1, 'se', -box.width * 2, -box.height * 2);
      captured = await saveAndCapture(page, dash.id);
      expectBuilderPayload(captured, 'd-b10-resize-min-put');
    });
  });

  test.describe('D-B11 chart title override', () => {
    const chartId = SEED_CHARTS.bar.id;
    const setup = async (
      page: import('@playwright/test').Page,
      factory: { dashboard: (n: string) => Promise<{ id: number; title: string }> },
      api: import('../support/api-client').ApiClient,
      name: string
    ) => {
      const dash = await factory.dashboard(name);
      await putTabs(api, dash, [
        {
          id: FIXED_IDS.tab1,
          title: 'Tab',
          layout_config: [{ i: FIXED_IDS.chart1, x: 0, y: 0, w: 12, h: 18 }],
          components: { [FIXED_IDS.chart1]: chartComponent(FIXED_IDS.chart1, SEED_CHARTS.bar) },
        },
      ]);
      await openBuilder(page, dash.id);
      return dash;
    };

    test('edit with Enter, Esc cancels, typing the original removes the override', async ({
      page,
      factory,
      api,
    }) => {
      const dash = await setup(page, factory, api, 'title-override');
      const display = page.getByTestId(`dashboard-chart-title-display-${chartId}`);
      const input = page.getByTestId(`dashboard-chart-title-input-${chartId}`);
      await expect(display).toHaveText(SEED_CHARTS.bar.title);

      await display.click();
      await expect(input).toHaveValue(SEED_CHARTS.bar.title);
      await input.fill('Coverage by state');
      await input.press('Enter');
      await expect(display).toHaveText('Coverage by state');
      await expect(
        page.getByText(`Custom title • Original: "${SEED_CHARTS.bar.title}"`)
      ).toBeVisible();
      expectBuilderPayload(await saveAndCapture(page, dash.id), 'd-b11-override-put');

      await display.click();
      await input.fill('never saved');
      await input.press('Escape');
      await expect(display).toHaveText('Coverage by state');

      // Reset: typing the original title drops titleOverride entirely
      await display.click();
      await input.fill(SEED_CHARTS.bar.title);
      await input.press('Enter');
      await expect(page.getByText(/Custom title • Original/)).toBeHidden();
      expectBuilderPayload(await saveAndCapture(page, dash.id), 'd-b11-reset-put');
    });

    test('[pinned] hide then show stores the original title as an override', async ({
      page,
      factory,
      api,
    }) => {
      // handleShowTitle writes createTitleUpdateConfig(original) → titleOverride === original,
      // so the "Custom title" hint shows even though the text equals the chart title.
      const dash = await setup(page, factory, api, 'title-hide');
      await page.getByTestId(`dashboard-chart-title-display-${chartId}`).hover();
      await page.getByTestId(`dashboard-chart-title-hide-${chartId}`).click();
      await expect(page.getByTestId(`dashboard-chart-title-display-${chartId}`)).toHaveCount(0);
      expectBuilderPayload(await saveAndCapture(page, dash.id), 'd-b11-hidden-put');

      await cell(page, FIXED_IDS.chart1).hover();
      await page.getByTestId(`dashboard-chart-title-show-${chartId}`).click();
      await expect(page.getByTestId(`dashboard-chart-title-display-${chartId}`)).toHaveText(
        SEED_CHARTS.bar.title
      );
      await expect(
        page.getByText(`Custom title • Original: "${SEED_CHARTS.bar.title}"`)
      ).toBeVisible();
      expectBuilderPayload(await saveAndCapture(page, dash.id), 'd-b11-shown-put');
    });

    test('[pinned] clicking the Cancel (X) button still saves the typed title', async ({
      page,
      factory,
      api,
    }) => {
      // The input's onBlur (save) fires on mousedown, before the Cancel button's onClick
      await setup(page, factory, api, 'title-cancel');
      const display = page.getByTestId(`dashboard-chart-title-display-${chartId}`);
      await display.click();
      await page.getByTestId(`dashboard-chart-title-input-${chartId}`).fill('saved by cancel');
      await page.getByTestId(`dashboard-chart-title-cancel-${chartId}`).click();
      await expect(display).toHaveText('saved by cancel');
    });
  });

  test('D-B12 undo/redo via buttons and keyboard; shortcuts ignored inside inputs', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('undo');
    await openBuilder(page, dash.id);
    const undo = page.getByTestId('dashboard-builder-undo-btn');
    const redo = page.getByTestId('dashboard-builder-redo-btn');
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();

    const textId = await addText(page);
    await expect(undo).toBeEnabled();

    await undo.click();
    await expect(cell(page, textId)).toHaveCount(0);
    await expect(redo).toBeEnabled();
    await redo.click();
    await expect(cell(page, textId)).toBeVisible();
    await expect(redo).toBeDisabled();

    await page.mouse.click(5, 5); // make sure focus is on the page, not a control
    await page.keyboard.press('ControlOrMeta+z');
    await expect(cell(page, textId)).toHaveCount(0);
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(cell(page, textId)).toBeVisible();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(cell(page, textId)).toHaveCount(0);
    await page.keyboard.press('Control+y');
    await expect(cell(page, textId)).toBeVisible();

    // Inside an input the shortcut is left to the input
    await page.getByTestId('dashboard-title-display').click();
    await page.getByTestId('dashboard-title-input').press('ControlOrMeta+z');
    await expect(cell(page, textId)).toBeVisible();
    await page.getByTestId('dashboard-title-input').press('Enter');

    expectBuilderPayload(await saveAndCapture(page, dash.id), 'd-b12-after-redo-put');
  });

  test('D-B13 View saves, unlocks and opens the view page', async ({ page, factory }) => {
    const dash = await factory.dashboard('preview');
    await openBuilder(page, dash.id);
    await addText(page);

    const put = captureNextPut(page, dash.id);
    const unlock = page.waitForRequest(
      (r) => r.method() === 'DELETE' && r.url().endsWith(`/api/dashboards/${dash.id}/lock/`)
    );
    await page.getByTestId('dashboard-preview-btn').click();
    expectBuilderPayload(await put, 'd-b13-view-put');
    await unlock;
    await expect(page).toHaveURL(`/dashboards/${dash.id}`);
  });

  test('D-B14 lock: POST on open, DELETE on Back', async ({ page, factory }) => {
    const dash = await factory.dashboard('lock');
    const lock = captureRequest(page, { method: 'POST', url: `/api/dashboards/${dash.id}/lock/` });
    const ready = watchBuilderReady(page, dash.id);
    await page.goto(`/dashboards/${dash.id}/edit`);
    expectPayloadSnapshot(await lock, 'd-b14-lock-post');
    await ready();

    const unlock = page.waitForRequest(
      (r) => r.method() === 'DELETE' && r.url().endsWith(`/api/dashboards/${dash.id}/lock/`)
    );
    await page.getByTestId('dashboard-back-btn').filter({ visible: true }).click();
    await unlock;
    await expect(page).toHaveURL('/dashboards');
  });

  test('D-B14 [pinned] same user in a second browser is not shown the locked screen', async ({
    page,
    factory,
    browser,
    touchedTestIds,
    blockedEmails,
  }, testInfo) => {
    // Backend lock is per org-user and re-entrant (dashboard_service.lock_dashboard refreshes
    // an existing lock for the same user), and the edit page only blocks when locked_by is a
    // *different* email — see the analyst test below for the locked screen.
    const dash = await factory.dashboard('lock-same-user');
    await openBuilder(page, dash.id);

    const { baseURL, viewport } = testInfo.project.use;
    const other = await browser.newContext({
      storageState: 'playwright/.auth/admin.json',
      baseURL,
      viewport,
    });
    await installInteractionRecorder(other, touchedTestIds);
    try {
      const page2 = await other.newPage();
      await installUiGuards(page2);
      await installEmailGuard(page2, blockedEmails);
      await openBuilder(page2, dash.id);
      await expect(page2.getByTestId('dashboard-locked-title')).toHaveCount(0);
      await expect(page2.getByTestId('dashboard-title-display')).toHaveText(dash.title);
    } finally {
      await other.close();
    }
  });

  test('D-B14 another user (analyst) gets the "Currently Locked" screen with countdown', async ({
    page,
    factory,
    pageAs,
  }) => {
    const dash = await factory.dashboard('lock-other-user');
    await openBuilder(page, dash.id);

    const analyst = await pageAs('analyst');
    await analyst.goto(`/dashboards/${dash.id}/edit`);
    await expect(analyst.getByTestId('dashboard-locked-title')).toHaveText(
      'Dashboard is Currently Locked'
    );
    await expect(analyst.getByText(`Currently edited by: ${ROLE_USERS.admin.email}`)).toBeVisible();
    const countdown = analyst.getByText(/Auto-refreshing in \d+ seconds\.\.\./);
    await expect(countdown).toBeVisible();
    const secondsLeft = async () => Number((await countdown.innerText()).match(/\d+/)![0]);
    const first = await secondsLeft();
    await expect.poll(secondsLeft).not.toBe(first);
    // The builder never mounted, so no lock was requested by the analyst
    await expect(analyst.getByTestId('add-chart-btn')).toHaveCount(0);

    await analyst.getByTestId('dashboard-locked-go-back-btn').click();
    await expect(analyst).toHaveURL('/dashboards');
  });

  test.describe('D-B15 table / pivot / map cells in the builder', () => {
    test('table drill-down and ← Back', async ({ page, factory, api }) => {
      const chart = SEED_CHARTS.tableDrill;
      const dash = await factory.dashboard('table-drill');
      await putTabs(api, dash, [
        {
          id: FIXED_IDS.tab1,
          title: 'Tab',
          layout_config: [{ i: FIXED_IDS.chart1, x: 0, y: 0, w: 12, h: 18 }],
          components: { [FIXED_IDS.chart1]: chartComponent(FIXED_IDS.chart1, chart, 'table') },
        },
      ]);
      await openBuilder(page, dash.id);
      const c = cell(page, FIXED_IDS.chart1);
      const firstState = c.getByTestId('chart-table-drill-cell-0-statename');
      await expect(firstState).toBeVisible({ timeout: 30_000 });
      const stateName = (await firstState.innerText()).trim();

      await firstState.click();
      const back = c.getByTestId(`dashboard-chart-table-back-${chart.id}`);
      await expect(back).toBeVisible();
      await expect(c.getByText(`statename: ${stateName}`)).toBeVisible();
      await expect(c.getByTestId('chart-table-drill-cell-0-districtname')).toBeVisible({
        timeout: 30_000,
      });

      await back.click();
      await expect(back).toBeHidden();
      await expect(c.getByTestId('chart-table-drill-cell-0-statename')).toBeVisible();
    });

    test('pivot and map cells render', async ({ page, factory, api }) => {
      const dash = await factory.dashboard('pivot-map');
      await putTabs(api, dash, [
        {
          id: FIXED_IDS.tab1,
          title: 'Tab',
          layout_config: [
            { i: FIXED_IDS.chart1, x: 0, y: 0, w: 12, h: 18 },
            { i: FIXED_IDS.chart2, x: 0, y: 18, w: 12, h: 18 },
          ],
          components: {
            [FIXED_IDS.chart1]: chartComponent(FIXED_IDS.chart1, SEED_CHARTS.pivot, 'pivot_table'),
            [FIXED_IDS.chart2]: chartComponent(FIXED_IDS.chart2, SEED_CHARTS.map, 'map'),
          },
        },
      ]);
      await openBuilder(page, dash.id);
      const pivot = cell(page, FIXED_IDS.chart1);
      await expect(pivot.getByRole('table')).toBeVisible({ timeout: 30_000 });
      await expect(pivot.getByText('No data available')).toHaveCount(0);

      const map = cell(page, FIXED_IDS.chart2);
      await waitForEChart(map);
      // Breadcrumb only appears after a region drill — none yet
      await expect(map.getByTestId(`dashboard-chart-map-home-${SEED_CHARTS.map.id}`)).toHaveCount(
        0
      );
    });
  });
});
