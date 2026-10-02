import { test, expect } from '../support/fixtures';
import {
  FIXED_IDS,
  openBuilder,
  putTabs,
  releaseBuilderLocks,
  textComponent,
} from './helpers-builder';
import {
  applyFilters,
  buildFilterDashboard,
  chartDataWithFilters,
  createFilter,
  FILTERS,
  openView,
  selectSingleValue,
  waitForViewChart,
} from './helpers-view';

/**
 * Second-action behavior — added after mutation drill misses:
 *  - M18: deleting the active tab must select the PREVIOUS tab (a slip picked the next one;
 *    the existing test only deleted a tab that had no next tab).
 *  - M20: a SECOND Apply with changed filter values must refetch with the new values (a slip made
 *    later Applies no-ops; the existing tests only Apply once).
 */

test.describe('dashboard — second actions', () => {
  test.afterEach(async ({ api }) => releaseBuilderLocks(api));

  test('D-T1b deleting the active MIDDLE tab selects the previous tab; others keep their order', async ({
    page,
    api,
    factory,
  }) => {
    const dash = await factory.dashboard('tabs-delete-middle');
    const tabContent = (id: string, label: string) => ({
      id,
      title: label,
      layout_config: [{ i: `text-${id.slice(4)}`, x: 0, y: 0, w: 12, h: 4 }],
      components: { [`text-${id.slice(4)}`]: textComponent(`text-${id.slice(4)}`, label) },
    });
    await putTabs(api, dash, [
      tabContent(FIXED_IDS.tab1, 'First'),
      tabContent(FIXED_IDS.tab2, 'Second'),
      tabContent(FIXED_IDS.tab3, 'Third'),
    ]);
    await openBuilder(page, dash.id);

    const tab = (id: string) => page.getByTestId(`tab-item-${id}`);
    await tab(FIXED_IDS.tab2).click();
    await expect(tab(FIXED_IDS.tab2)).toHaveAttribute('aria-selected', 'true');

    await page.getByTestId(`tab-remove-btn-${FIXED_IDS.tab2}`).click();
    await page.getByTestId('delete-tab-confirm-btn').click();

    await expect(tab(FIXED_IDS.tab2)).toHaveCount(0);
    await expect(tab(FIXED_IDS.tab1), 'previous tab becomes active').toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(tab(FIXED_IDS.tab3)).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('[data-testid^="tab-item-"]')).toHaveText(['First', 'Third']);
  });

  test('D-F5b a SECOND Apply with a changed value refetches charts with the new value', async ({
    page,
    api,
    factory,
  }) => {
    const d = await buildFilterDashboard(api, factory, 'filter-reapply');
    const filter = await createFilter(api, d.id, FILTERS.stateSingle());
    await openView(page, d.id);
    await waitForViewChart(page, d.barChartId);

    const filteredFor = (value: string) =>
      page.waitForRequest((r) => {
        if (!chartDataWithFilters(d.barChartId).test(r.url())) return false;
        const raw = new URL(r.url()).searchParams.get('dashboard_filters') ?? '{}';
        return (JSON.parse(raw) as Record<string, unknown>)[String(filter.id)] === value;
      });

    // First Apply
    await selectSingleValue(page, filter.id, 'Assam');
    const first = filteredFor('Assam');
    await applyFilters(page);
    await first;

    // Change the value → second Apply must refetch with the NEW value
    await selectSingleValue(page, filter.id, 'Odisha');
    const second = filteredFor('Odisha');
    await applyFilters(page);
    await second;
  });
});
