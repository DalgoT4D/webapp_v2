import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import {
  type SeedTab,
  FIXED_IDS,
  SEED_CHARTS,
  addText,
  cell,
  chartComponent,
  expectBuilderPayload,
  layoutOf,
  openBuilder,
  putTabs,
  releaseBuilderLocks,
  saveAndCapture,
  tabItems,
  tabTitles,
  textComponent,
} from './helpers-builder';

const TAB_TITLE_MAX = 50;

async function tabIds(page: Page): Promise<string[]> {
  const testIds = await tabItems(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-testid') || '')
  );
  return testIds.map((t) => t.replace('tab-item-', ''));
}

function tab(page: Page, id: string) {
  return page.getByTestId(`tab-item-${id}`);
}

/** Drag a widget by its strip onto a tab, and wait until the 500ms hover hand-off happened. */
async function dragWidgetOntoTab(page: Page, componentId: string, targetTabId: string) {
  await cell(page, componentId).hover();
  const strip = (await page.getByTestId(`dashboard-cell-drag-${componentId}`).boundingBox())!;
  const target = (await tab(page, targetTabId).boundingBox())!;
  await page.mouse.move(strip.x + strip.width / 2, strip.y + strip.height / 2);
  await page.mouse.down();
  await page.mouse.move(strip.x + strip.width / 2 + 5, strip.y + strip.height / 2 + 5);
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 15 });
}

test.describe('dashboard tabs', () => {
  test.afterEach(async ({ api }) => releaseBuilderLocks(api));

  test('D-T1 add, switch, rename (Enter / Esc / blur / 50 chars) and remove with dialog', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('tabs-basic');
    await openBuilder(page, dash.id);

    expect(await tabTitles(page)).toEqual(['Untitled Tab 1']);
    const [firstId] = await tabIds(page);
    // Only one tab → no remove button
    await expect(page.getByTestId(`tab-remove-btn-${firstId}`)).toHaveCount(0);

    await page.getByTestId('add-tab-btn').click();
    expect(await tabTitles(page)).toEqual(['Untitled Tab 1', 'Untitled Tab 2']);
    const [, secondId] = await tabIds(page);
    await expect(tab(page, secondId)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId(`tab-remove-btn-${firstId}`)).toBeVisible();

    // Each tab has its own canvas
    const textId = await addText(page);
    await tab(page, firstId).click();
    await expect(tab(page, firstId)).toHaveAttribute('aria-selected', 'true');
    await expect(cell(page, textId)).toHaveCount(0);
    await tab(page, secondId).press('Enter');
    await expect(tab(page, secondId)).toHaveAttribute('aria-selected', 'true');
    await expect(cell(page, textId)).toBeVisible();

    const title = page.getByTestId(`tab-title-${secondId}`);
    const input = page.getByTestId(`tab-rename-input-${secondId}`);
    await title.click();
    await input.fill('Reach');
    await input.press('Enter');
    await expect(title).toHaveText('Reach');

    await title.click();
    await input.fill('never applied');
    await input.press('Escape');
    await expect(title).toHaveText('Reach');

    await title.click();
    await input.fill('Outcomes');
    await input.blur();
    await expect(title).toHaveText('Outcomes');

    await title.click();
    await input.fill('');
    await input.pressSequentially('y'.repeat(TAB_TITLE_MAX + 10));
    await expect(input).toHaveValue('y'.repeat(TAB_TITLE_MAX));
    await input.press('Enter');
    await expect(title).toHaveText('y'.repeat(TAB_TITLE_MAX));

    // Clicking an inactive tab's title selects it instead of renaming
    await page.getByTestId(`tab-title-${firstId}`).click();
    await expect(tab(page, firstId)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId(`tab-rename-input-${firstId}`)).toHaveCount(0);

    await tab(page, secondId).click();
    await page.getByTestId(`tab-remove-btn-${secondId}`).click();
    const dialog = page.getByTestId('delete-tab-dialog');
    await expect(dialog).toContainText('This change cannot be undone');
    await page.getByTestId('delete-tab-cancel-btn').click();
    await expect(dialog).toBeHidden();
    expect(await tabIds(page)).toHaveLength(2);
    expectBuilderPayload(await saveAndCapture(page, dash.id), 'd-t1-two-tabs-put');

    await page.getByTestId(`tab-remove-btn-${secondId}`).click();
    await page.getByTestId('delete-tab-confirm-btn').click();
    expect(await tabIds(page)).toEqual([firstId]);
    await expect(tab(page, firstId)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId(`tab-remove-btn-${firstId}`)).toHaveCount(0);
    expectBuilderPayload(await saveAndCapture(page, dash.id), 'd-t1-after-remove-put');
  });

  test('D-T2 reorder with Alt+Arrow keys and by dragging', async ({ page, factory, api }) => {
    const dash = await factory.dashboard('tabs-reorder');
    const empty = { layout_config: [] as SeedTab['layout_config'], components: {} };
    await putTabs(api, dash, [
      { id: FIXED_IDS.tab1, title: 'A', ...empty },
      { id: FIXED_IDS.tab2, title: 'B', ...empty },
      { id: FIXED_IDS.tab3, title: 'C', ...empty },
    ]);
    await openBuilder(page, dash.id);
    expect(await tabTitles(page)).toEqual(['A', 'B', 'C']);

    await tab(page, FIXED_IDS.tab1).focus();
    await page.keyboard.press('Alt+ArrowRight');
    expect(await tabTitles(page)).toEqual(['B', 'A', 'C']);
    await tab(page, FIXED_IDS.tab1).focus();
    await page.keyboard.press('Alt+ArrowLeft');
    await page.keyboard.press('Alt+ArrowLeft'); // already first → no-op
    expect(await tabTitles(page)).toEqual(['A', 'B', 'C']);

    // Drag C onto A (dnd-kit starts after 6px of pointer movement)
    const from = (await tab(page, FIXED_IDS.tab3).boundingBox())!;
    const to = (await tab(page, FIXED_IDS.tab1).boundingBox())!;
    await page.mouse.move(from.x + 10, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 20, from.y + from.height / 2, { steps: 3 });
    await page.mouse.move(to.x + 10, to.y + to.height / 2, { steps: 15 });
    await expect(page.getByTestId(`tab-reorder-indicator-${FIXED_IDS.tab1}`)).toBeVisible();
    await page.mouse.up();
    await expect.poll(() => tabTitles(page)).toEqual(['C', 'A', 'B']);

    expectBuilderPayload(await saveAndCapture(page, dash.id), 'd-t2-reordered-put');
  });

  test.describe('D-T3 cross-tab widget move', () => {
    const seed = () => [
      {
        id: FIXED_IDS.tab1,
        title: 'Source',
        layout_config: [
          { i: FIXED_IDS.chart1, x: 0, y: 0, w: 6, h: 12 },
          { i: FIXED_IDS.text1, x: 6, y: 0, w: 6, h: 8 },
        ],
        components: {
          [FIXED_IDS.chart1]: chartComponent(FIXED_IDS.chart1, SEED_CHARTS.bar),
          [FIXED_IDS.text1]: textComponent(FIXED_IDS.text1, 'Stays on source'),
        },
      },
      {
        id: FIXED_IDS.tab2,
        title: 'Target',
        layout_config: [] as SeedTab['layout_config'],
        components: {},
      },
    ];

    test('hover a tab 500ms, then drop on its canvas → widget moves', async ({
      page,
      factory,
      api,
    }) => {
      const dash = await factory.dashboard('tabs-xmove');
      await putTabs(api, dash, seed());
      await openBuilder(page, dash.id);

      await dragWidgetOntoTab(page, FIXED_IDS.chart1, FIXED_IDS.tab2);
      const overlay = page.getByTestId('cross-tab-drag-overlay');
      await expect(overlay).toHaveText('Move chart to this tab');

      // The pointer is the widget's top-left (cross-tab-drag pointerToGridPosition). Aim a few px
      // inside the grid's top-left cell: canvas p-4 (16px) + grid padding (8px)
      const CANVAS_TO_FIRST_CELL_PX = 16 + 8 + 5;
      const bar = (await page.getByTestId('dashboard-tab-bar').boundingBox())!;
      await page.mouse.move(
        bar.x + CANVAS_TO_FIRST_CELL_PX,
        bar.y + bar.height + CANVAS_TO_FIRST_CELL_PX,
        { steps: 10 }
      );
      await expect(page.getByTestId('cross-tab-drop-placeholder')).toBeVisible();
      await page.mouse.up();
      await expect(overlay).toBeHidden();

      await expect(tab(page, FIXED_IDS.tab2)).toHaveAttribute('aria-selected', 'true');
      await expect(cell(page, FIXED_IDS.chart1)).toBeVisible();
      const captured = await saveAndCapture(page, dash.id);
      expect(layoutOf(captured.body, FIXED_IDS.chart1, 0)).toBeUndefined();
      expect(layoutOf(captured.body, FIXED_IDS.chart1, 1)).toMatchObject({ x: 0, y: 0 });
      expectBuilderPayload(captured, 'd-t3-moved-put');

      await tab(page, FIXED_IDS.tab1).click();
      await expect(cell(page, FIXED_IDS.chart1)).toHaveCount(0);
      await expect(cell(page, FIXED_IDS.text1)).toBeVisible();
    });

    test('Esc during the hand-off cancels the move', async ({ page, factory, api }) => {
      const dash = await factory.dashboard('tabs-xmove-esc');
      await putTabs(api, dash, seed());
      await openBuilder(page, dash.id);

      await dragWidgetOntoTab(page, FIXED_IDS.chart1, FIXED_IDS.tab2);
      await expect(page.getByTestId('cross-tab-drag-overlay')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('cross-tab-drag-overlay')).toBeHidden();
      await page.mouse.up();

      await expect(tab(page, FIXED_IDS.tab1)).toHaveAttribute('aria-selected', 'true');
      await expect(cell(page, FIXED_IDS.chart1)).toBeVisible();
      const { body } = await saveAndCapture(page, dash.id);
      expect(layoutOf(body, FIXED_IDS.chart1, 0)).toMatchObject({ x: 0, y: 0 });
      expect(layoutOf(body, FIXED_IDS.chart1, 1)).toBeUndefined();
    });

    test('releasing over the tab before 500ms cancels the move', async ({ page, factory, api }) => {
      const dash = await factory.dashboard('tabs-xmove-early');
      await putTabs(api, dash, seed());
      await openBuilder(page, dash.id);

      await dragWidgetOntoTab(page, FIXED_IDS.chart1, FIXED_IDS.tab2);
      await page.mouse.up();
      await expect(page.getByTestId('cross-tab-drag-overlay')).toHaveCount(0);

      await expect(tab(page, FIXED_IDS.tab1)).toHaveAttribute('aria-selected', 'true');
      const { body } = await saveAndCapture(page, dash.id);
      expect(layoutOf(body, FIXED_IDS.chart1, 0)).toMatchObject({ x: 0, y: 0, w: 6, h: 12 });
      expect(layoutOf(body, FIXED_IDS.chart1, 1)).toBeUndefined();
    });
  });

  test('D-T4 [pinned] undo restores a deleted tab despite "cannot be undone"', async ({
    page,
    factory,
  }) => {
    // DeleteTabDialog warns the change is permanent, but tab removal goes through setState
    // (history) so Undo brings it back.
    const dash = await factory.dashboard('tabs-undo');
    await openBuilder(page, dash.id);
    await page.getByTestId('add-tab-btn').click();
    const [, secondId] = await tabIds(page);
    await page.getByTestId(`tab-title-${secondId}`).click();
    await page.getByTestId(`tab-rename-input-${secondId}`).fill('Doomed');
    await page.getByTestId(`tab-rename-input-${secondId}`).press('Enter');

    await page.getByTestId(`tab-remove-btn-${secondId}`).click();
    await expect(page.getByTestId('delete-tab-dialog')).toContainText('cannot be undone');
    await page.getByTestId('delete-tab-confirm-btn').click();
    expect(await tabTitles(page)).toEqual(['Untitled Tab 1']);

    await page.getByTestId('dashboard-builder-undo-btn').click();
    expect(await tabTitles(page)).toEqual(['Untitled Tab 1', 'Doomed']);
    expectBuilderPayload(await saveAndCapture(page, dash.id), 'd-t4-undone-put');
  });

  test('D-T5 view mode shows the tab bar only with 2+ tabs', async ({ page, factory, api }) => {
    const single = await factory.dashboard('tabs-view-one');
    await putTabs(api, single, [
      {
        id: FIXED_IDS.tab1,
        title: 'Only',
        layout_config: [{ i: FIXED_IDS.text1, x: 0, y: 0, w: 12, h: 4 }],
        components: { [FIXED_IDS.text1]: textComponent(FIXED_IDS.text1, 'Single tab notes') },
      },
    ]);
    await page.goto(`/dashboards/${single.id}`);
    await expect(page.getByText('Single tab notes')).toBeVisible();
    await expect(page.getByTestId('dashboard-tab-bar')).toHaveCount(0);

    const multi = await factory.dashboard('tabs-view-two');
    await putTabs(api, multi, [
      {
        id: FIXED_IDS.tab1,
        title: 'First',
        layout_config: [{ i: FIXED_IDS.text1, x: 0, y: 0, w: 12, h: 4 }],
        components: { [FIXED_IDS.text1]: textComponent(FIXED_IDS.text1, 'First tab notes') },
      },
      {
        id: FIXED_IDS.tab2,
        title: 'Second',
        layout_config: [{ i: FIXED_IDS.text1, x: 0, y: 0, w: 12, h: 4 }],
        components: { [FIXED_IDS.text1]: textComponent(FIXED_IDS.text1, 'Second tab notes') },
      },
    ]);
    await page.goto(`/dashboards/${multi.id}`);
    await expect(page.getByTestId('dashboard-tab-bar')).toBeVisible();
    expect(await tabTitles(page)).toEqual(['First', 'Second']);
    await expect(page.getByTestId('add-tab-btn')).toHaveCount(0);
    await expect(page.getByTestId(`tab-remove-btn-${FIXED_IDS.tab1}`)).toHaveCount(0);
    await expect(page.getByText('First tab notes')).toBeVisible();

    await tab(page, FIXED_IDS.tab2).click();
    await expect(tab(page, FIXED_IDS.tab2)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Second tab notes')).toBeVisible();
    await expect(page.getByText('First tab notes')).toHaveCount(0);
  });
});
