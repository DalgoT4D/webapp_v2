import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import {
  type SeedTab,
  FIXED_IDS,
  SEED_CHARTS,
  addText,
  cell,
  chartComponent,
  dashboardUrl,
  expectBuilderPayload,
  layoutOf,
  openBuilder,
  putTabs,
  releaseBuilderLocks,
  saveAndCapture,
  tabTitles,
  textComponent,
} from './helpers-builder';
import { editResponse, tabIdsOf } from './helpers-gaps-builder';

// Tabs with long titles overflow the 1440px tab bar
const MANY_TABS = 12;
const LONG_TAB_TITLE_CHARS = 40;
// Pointer inside the tab bar's 40px autoscroll edge zone (TAB_BAR_SCROLL_EDGE_PX)
const TAB_EDGE_INSET_PX = 10;
// Enough pointer moves in the edge zone to scroll several steps
const EDGE_MOVES = 10;

function tab(page: Page, id: string) {
  return page.getByTestId(`tab-item-${id}`);
}

const emptyTab = (id: string, title: string): SeedTab => ({
  id,
  title,
  layout_config: [],
  components: {},
});

/** Drag a widget by its strip onto a tab and keep the button down (hand-off after 500ms). */
async function dragWidgetOntoTab(page: Page, componentId: string, targetTabId: string) {
  await cell(page, componentId).hover();
  const strip = (await page.getByTestId(`dashboard-cell-drag-${componentId}`).boundingBox())!;
  const target = (await tab(page, targetTabId).boundingBox())!;
  await page.mouse.move(strip.x + strip.width / 2, strip.y + strip.height / 2);
  await page.mouse.down();
  await page.mouse.move(strip.x + strip.width / 2 + 5, strip.y + strip.height / 2 + 5);
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 15 });
  await expect(page.getByTestId('cross-tab-drag-overlay')).toHaveText('Move chart to this tab');
}

const crossTabSeed = (): SeedTab[] => [
  {
    id: FIXED_IDS.tab1,
    title: 'Source',
    layout_config: [{ i: FIXED_IDS.chart1, x: 0, y: 0, w: 6, h: 12 }],
    components: { [FIXED_IDS.chart1]: chartComponent(FIXED_IDS.chart1, SEED_CHARTS.bar) },
  },
  emptyTab(FIXED_IDS.tab2, 'Target'),
];

test.describe('dashboard tabs gaps', () => {
  test.afterEach(async ({ api }) => releaseBuilderLocks(api));

  test('GAP-D switch tab with Space', async ({ page, factory, api }) => {
    const dash = await factory.dashboard('tabs-space');
    await putTabs(api, dash, [emptyTab(FIXED_IDS.tab1, 'One'), emptyTab(FIXED_IDS.tab2, 'Two')]);
    await openBuilder(page, dash.id);
    await expect(tab(page, FIXED_IDS.tab1)).toHaveAttribute('aria-selected', 'true');

    await tab(page, FIXED_IDS.tab2).focus();
    await page.keyboard.press('Space');
    await expect(tab(page, FIXED_IDS.tab2)).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, FIXED_IDS.tab1)).toHaveAttribute('aria-selected', 'false');
    // Space is swallowed (no rename input, no page scroll)
    await expect(page.getByTestId(`tab-rename-input-${FIXED_IDS.tab2}`)).toHaveCount(0);
  });

  test('GAP-D an empty tab name goes back to the old name', async ({ page, factory, api }) => {
    const dash = await factory.dashboard('tabs-empty-name');
    await putTabs(api, dash, [emptyTab(FIXED_IDS.tab1, 'Reach')]);
    await openBuilder(page, dash.id);
    const title = page.getByTestId(`tab-title-${FIXED_IDS.tab1}`);
    const input = page.getByTestId(`tab-rename-input-${FIXED_IDS.tab1}`);

    await title.click();
    await input.fill('');
    await input.press('Enter');
    await expect(input).toHaveCount(0);
    await expect(title).toHaveText('Reach');

    await title.click();
    await input.fill('   ');
    await input.blur();
    await expect(title).toHaveText('Reach');

    const captured = await saveAndCapture(page, dash.id);
    expect((captured.body as { tabs: Array<{ title: string }> }).tabs.map((t) => t.title)).toEqual([
      'Reach',
    ]);
    expectBuilderPayload(captured, 'gap-d-tab-empty-name-put');
  });

  test('GAP-D tab bar scrolls while a tab is dragged near its edge', async ({
    page,
    factory,
    api,
  }) => {
    const ids = Array.from(
      { length: MANY_TABS },
      (_, n) => `tab-17000000001${String(n).padStart(2, '0')}`
    );
    const dash = await factory.dashboard('tabs-scroll');
    await putTabs(
      api,
      dash,
      ids.map((id, n) => emptyTab(id, `${n + 1} ${'x'.repeat(LONG_TAB_TITLE_CHARS)}`))
    );
    await openBuilder(page, dash.id);
    const scroller = page.getByTestId('dashboard-tab-scroll');
    const metrics = () =>
      scroller.evaluate((el) => ({
        left: el.scrollLeft,
        overflow: el.scrollWidth > el.clientWidth,
      }));
    expect(await metrics()).toEqual({ left: 0, overflow: true });

    const bar = (await scroller.boundingBox())!;
    const first = (await tab(page, ids[0]).boundingBox())!;
    const y = first.y + first.height / 2;
    await page.mouse.move(first.x + 10, y);
    await page.mouse.down();
    await page.mouse.move(first.x + 20, y, { steps: 3 }); // past dnd-kit's 6px activation
    const edgeX = bar.x + bar.width - TAB_EDGE_INSET_PX;
    await page.mouse.move(edgeX - EDGE_MOVES, y, { steps: 10 });
    for (let i = 0; i < EDGE_MOVES; i++) await page.mouse.move(edgeX - EDGE_MOVES + i + 1, y);
    await expect.poll(async () => (await metrics()).left).toBeGreaterThan(0);
    await page.mouse.up();
  });

  test('GAP-D switching browser window cancels a cross-tab widget move', async ({
    page,
    factory,
    api,
  }) => {
    const dash = await factory.dashboard('tabs-xmove-blur');
    await putTabs(api, dash, crossTabSeed());
    await openBuilder(page, dash.id);

    await dragWidgetOntoTab(page, FIXED_IDS.chart1, FIXED_IDS.tab2);
    // What the browser fires when the user switches window mid-drag
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.getByTestId('cross-tab-drag-overlay')).toBeHidden();
    await page.mouse.up();

    await expect(tab(page, FIXED_IDS.tab1)).toHaveAttribute('aria-selected', 'true');
    await expect(cell(page, FIXED_IDS.chart1)).toBeVisible();
    const { body } = await saveAndCapture(page, dash.id);
    expect(layoutOf(body, FIXED_IDS.chart1, 0)).toMatchObject({ x: 0, y: 0, w: 6, h: 12 });
    expect(layoutOf(body, FIXED_IDS.chart1, 1)).toBeUndefined();
  });

  test('GAP-D dropping outside the canvas cancels a cross-tab widget move', async ({
    page,
    factory,
    api,
  }) => {
    const dash = await factory.dashboard('tabs-xmove-outside');
    await putTabs(api, dash, crossTabSeed());
    await openBuilder(page, dash.id);

    await dragWidgetOntoTab(page, FIXED_IDS.chart1, FIXED_IDS.tab2);
    // Release over the header, above the tab bar — outside the canvas
    const header = (await page.getByTestId('dashboard-title-display').boundingBox())!;
    await page.mouse.move(header.x + header.width / 2, header.y + header.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByTestId('cross-tab-drag-overlay')).toBeHidden();

    await expect(tab(page, FIXED_IDS.tab1)).toHaveAttribute('aria-selected', 'true');
    await expect(cell(page, FIXED_IDS.chart1)).toBeVisible();
    const { body } = await saveAndCapture(page, dash.id);
    expect(layoutOf(body, FIXED_IDS.chart1, 0)).toMatchObject({ x: 0, y: 0, w: 6, h: 12 });
    expect(layoutOf(body, FIXED_IDS.chart1, 1)).toBeUndefined();
  });

  test('GAP-D an old dashboard without tabs opens as "Untitled Tab 1"', async ({
    page,
    factory,
  }) => {
    // The backend no longer stores pre-tab dashboards (DashboardUpdate only takes `tabs`), so the
    // GET is rewritten into the legacy shape: no tabs, top-level layout_config + components
    const dash = await factory.dashboard('tabs-legacy');
    await editResponse<Record<string, unknown>>(page, dashboardUrl(dash.id), (body) => ({
      ...body,
      tabs: [],
      layout_config: [{ i: FIXED_IDS.text1, x: 0, y: 0, w: 12, h: 6 }],
      components: { [FIXED_IDS.text1]: textComponent(FIXED_IDS.text1, 'Legacy notes') },
    }));
    await openBuilder(page, dash.id);

    expect(await tabTitles(page)).toEqual(['Untitled Tab 1']);
    await expect(cell(page, FIXED_IDS.text1)).toContainText('Legacy notes');
    const captured = await saveAndCapture(page, dash.id);
    const tabs = (
      captured.body as { tabs: Array<{ title: string; components: Record<string, unknown> }> }
    ).tabs;
    expect(tabs).toHaveLength(1);
    expect(Object.keys(tabs[0].components)).toEqual([FIXED_IDS.text1]);
    expectBuilderPayload(captured, 'gap-d-tabs-legacy-put');
  });

  test('GAP-D undo can jump back to another tab', async ({ page, factory, api }) => {
    const dash = await factory.dashboard('tabs-undo-jump');
    await putTabs(api, dash, [emptyTab(FIXED_IDS.tab1, 'Alpha'), emptyTab(FIXED_IDS.tab2, 'Beta')]);
    await openBuilder(page, dash.id);

    const textId = await addText(page); // on Alpha
    await tab(page, FIXED_IDS.tab2).click(); // switching tabs is not recorded in history
    await expect(tab(page, FIXED_IDS.tab2)).toHaveAttribute('aria-selected', 'true');

    await page.getByTestId('dashboard-builder-undo-btn').click();
    // The restored snapshot carries activeTabId = Alpha
    await expect(tab(page, FIXED_IDS.tab1)).toHaveAttribute('aria-selected', 'true');
    await expect(cell(page, textId)).toHaveCount(0);
    expect(await tabIdsOf(page)).toEqual([FIXED_IDS.tab1, FIXED_IDS.tab2]);
    expectBuilderPayload(await saveAndCapture(page, dash.id), 'gap-d-tabs-undo-jump-put');
  });
});
