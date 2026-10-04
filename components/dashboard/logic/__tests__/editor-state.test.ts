import { DashboardComponentType, type DashboardTab } from '@/types/dashboard';
import { getChartTypeFromConfig, getMinGridDimensions } from '@/lib/chart-size-constraints';
import {
  addTab,
  applyRichTextUpdates,
  buildDashboardSavePayload,
  constrainLayoutItems,
  ensureTextContentConstraints,
  getActiveEditorTab,
  getPlacedChartIds,
  getPlacedKpiIds,
  moveTab,
  normalizeEditorTabs,
  removeTab,
  removeWidgetFromLayout,
  renameTab,
  updateActiveEditorTab,
  type DashboardEditorState,
} from '@/components/dashboard/logic/editor-state';

const chart = {
  id: 'chart-1',
  type: DashboardComponentType.CHART,
  config: { chartId: 42, chartType: 'bar' },
};
const kpi = {
  id: 'kpi-1',
  type: DashboardComponentType.KPI,
  config: { kpiId: 441, title: 'Scores' },
};
const emptyText = {
  id: 'text-1',
  type: DashboardComponentType.TEXT,
  config: { content: '', type: 'paragraph', fontSize: 16, fontWeight: 'normal', textAlign: 'left' },
};

const tab = (id: string, extra: Partial<DashboardTab> = {}): DashboardTab => ({
  id,
  title: `Tab ${id}`,
  layout_config: [],
  components: {},
  ...extra,
});

const threeTabs = (): DashboardEditorState => ({
  tabs: [tab('a'), tab('b'), tab('c')],
  activeTabId: 'b',
});

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('active tab', () => {
  it('finds the active tab, falling back to the first', () => {
    expect(getActiveEditorTab(threeTabs()).id).toBe('b');
    expect(getActiveEditorTab({ ...threeTabs(), activeTabId: 'gone' }).id).toBe('a');
  });

  it('updates only the active tab', () => {
    const next = updateActiveEditorTab(threeTabs(), {
      layout_config: [{ i: 'x', x: 0, y: 0, w: 1, h: 1 }],
    });
    expect(next.tabs.map((t) => t.layout_config.length)).toEqual([0, 1, 0]);
  });
});

describe('ensureTextContentConstraints', () => {
  it('adds constraints to a text widget without them (empty paragraph → 250 × 160, as saved in E2E)', () => {
    const out = ensureTextContentConstraints({ 'text-1': emptyText });
    expect(out['text-1'].config.contentConstraints).toEqual({ minWidth: 250, minHeight: 160 });
    expect(console.log).toHaveBeenCalledTimes(1);
  });

  it('leaves existing constraints and non-text widgets alone', () => {
    const withConstraints = {
      ...emptyText,
      config: { ...emptyText.config, contentConstraints: { minWidth: 1, minHeight: 2 } },
    };
    const out = ensureTextContentConstraints({ 'text-1': withConstraints, 'chart-1': chart });
    expect(out['text-1']).toBe(withConstraints);
    expect(out['chart-1']).toBe(chart);
    expect(console.log).not.toHaveBeenCalled();
  });
});

describe('normalizeEditorTabs', () => {
  it('stamps min sizes and full-width maxW on every tab, keeping w/h that are set', () => {
    const tabs = normalizeEditorTabs({
      tabs: [
        tab('t1', {
          layout_config: [{ i: 'chart-1', x: 0, y: 0, w: 6, h: 4 }],
          components: { 'chart-1': chart },
        }),
        tab('t2', {
          layout_config: [{ i: 'kpi-1', x: 0, y: 0, w: 0, h: 0 }],
          components: { 'kpi-1': kpi },
        }),
      ],
    });
    // bar: min 1 × 2 (d-b5 snapshot)
    expect(tabs[0].layout_config[0]).toEqual({
      i: 'chart-1',
      x: 0,
      y: 0,
      w: 6,
      h: 4,
      minW: 1,
      minH: 2,
      maxW: 12,
    });
    // a KPI config has no chartType → "default" sizing (today's behavior, not the KPI minimum)
    const def = getMinGridDimensions(getChartTypeFromConfig(kpi.config));
    expect(getChartTypeFromConfig(kpi.config)).toBe('default');
    expect(tabs[1].layout_config[0]).toEqual({
      i: 'kpi-1',
      x: 0,
      y: 0,
      w: def.w,
      h: def.h,
      minW: def.w,
      minH: def.h,
      maxW: 12,
    });
  });

  it('a layout item without a component passes through', () => {
    const orphan = { i: 'gone', x: 0, y: 0, w: 2, h: 2 };
    const tabs = normalizeEditorTabs({ tabs: [tab('t1', { layout_config: [orphan] })] });
    expect(tabs[0].layout_config[0]).toBe(orphan);
  });

  it('a pre-tab dashboard becomes one "Untitled Tab 1" holding its layout and components', () => {
    const tabs = normalizeEditorTabs({
      layout_config: [{ i: 'chart-1', x: 0, y: 0, w: 6, h: 4 }],
      components: { 'chart-1': chart },
    });
    expect(tabs).toHaveLength(1);
    expect(tabs[0].title).toBe('Untitled Tab 1');
    expect(tabs[0].components['chart-1']).toEqual(chart);
  });

  it('no data → one empty default tab', () => {
    const tabs = normalizeEditorTabs(undefined);
    expect(tabs).toHaveLength(1);
    expect(tabs[0].layout_config).toEqual([]);
  });
});

describe('constrainLayoutItems', () => {
  it('clamps w/h up to the minimum and stamps minW/minH/maxW; text uses the base text minimum', () => {
    const textWithBigConstraints = {
      ...emptyText,
      config: { ...emptyText.config, contentConstraints: { minWidth: 900, minHeight: 900 } },
    };
    const out = constrainLayoutItems(
      [
        { i: 'chart-1', x: 3, y: 5, w: 0, h: 1 },
        { i: 'text-1', x: 0, y: 0, w: 4, h: 4 },
        { i: 'gone', x: 0, y: 0, w: 1, h: 1 },
      ],
      { 'chart-1': chart, 'text-1': textWithBigConstraints }
    );
    expect(out[0]).toEqual({ i: 'chart-1', x: 3, y: 5, w: 1, h: 2, minW: 1, minH: 2, maxW: 12 });
    expect(out[1]).toEqual({ i: 'text-1', x: 0, y: 0, w: 4, h: 4, minW: 1, minH: 1, maxW: 12 });
    expect(out[2]).toEqual({ i: 'gone', x: 0, y: 0, w: 1, h: 1 });
  });
});

describe('buildDashboardSavePayload (d-b5 / gap-d-tablet-text snapshots)', () => {
  const tabs = [tab('t1')];

  it('builds the PUT body', () => {
    expect(
      buildDashboardSavePayload({
        title: 'My dash',
        description: '',
        targetScreenSize: 'desktop',
        filterLayout: 'vertical',
        tabs,
      })
    ).toEqual({
      title: 'My dash',
      description: '',
      grid_columns: 12,
      target_screen_size: 'desktop',
      filter_layout: 'vertical',
      tabs: [tab('t1')],
    });
  });

  it('a blank title saves as "Untitled Dashboard"; overrides win; tabs are a deep copy', () => {
    const payload = buildDashboardSavePayload({
      title: '   ',
      description: 'd',
      targetScreenSize: 'desktop',
      filterLayout: 'horizontal',
      tabs,
      overrides: { filter_layout: 'vertical' },
    });
    expect(payload.title).toBe('Untitled Dashboard');
    expect(payload.filter_layout).toBe('vertical');
    expect(payload.tabs).not.toBe(tabs);
    expect(payload.tabs).toEqual(tabs);
  });
});

describe('applyRichTextUpdates', () => {
  it('writes each flushed config into the tab that holds the widget', () => {
    const state: DashboardEditorState = {
      tabs: [tab('a', { components: { 'text-1': emptyText } }), tab('b')],
      activeTabId: 'b',
    };
    const config = { ...emptyText.config, content: 'Hi' } as never;
    const next = applyRichTextUpdates(state, [{ componentId: 'text-1', config }]);
    expect(next.tabs[0].components['text-1'].config).toBe(config);
    expect(next.tabs[1]).toBe(state.tabs[1]);
    expect(applyRichTextUpdates(state, [])).toBe(state);
  });
});

describe('placed widget ids', () => {
  it('lists numeric chart / KPI ids on the tab only', () => {
    const components = {
      'chart-1': chart,
      'chart-2': { id: 'chart-2', type: DashboardComponentType.CHART, config: { chartId: '7' } },
      'kpi-1': kpi,
      'text-1': emptyText,
    };
    expect(getPlacedChartIds(components)).toEqual([42]);
    expect(getPlacedKpiIds(components)).toEqual([441]);
    expect(getPlacedChartIds(undefined)).toEqual([]);
  });
});

describe('removeWidgetFromLayout', () => {
  it('drops the widget and lets widgets below slide up', () => {
    const out = removeWidgetFromLayout(
      [
        { i: 'chart-1', x: 0, y: 0, w: 12, h: 4 },
        { i: 'kpi-1', x: 0, y: 4, w: 12, h: 3 },
      ],
      { 'chart-1': chart, 'kpi-1': kpi },
      'chart-1'
    );
    expect(out.components).toEqual({ 'kpi-1': kpi });
    expect(out.layout_config).toEqual([{ i: 'kpi-1', x: 0, y: 0, w: 12, h: 3 }]);
  });
});

describe('tab operations', () => {
  it('addTab appends and activates', () => {
    const next = addTab(threeTabs(), tab('d'));
    expect(next.tabs.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(next.activeTabId).toBe('d');
  });

  it('removeTab: removing the active middle tab activates the previous one', () => {
    const next = removeTab(threeTabs(), 'b');
    expect(next.tabs.map((t) => t.id)).toEqual(['a', 'c']);
    expect(next.activeTabId).toBe('a');
  });

  it('removeTab: an inactive tab keeps the active one; the first tab hands over to the next', () => {
    expect(removeTab(threeTabs(), 'c').activeTabId).toBe('b');
    expect(removeTab({ ...threeTabs(), activeTabId: 'a' }, 'a').activeTabId).toBe('b');
  });

  it('removeTab: the last tab and unknown ids are no-ops (same object)', () => {
    const single: DashboardEditorState = { tabs: [tab('a')], activeTabId: 'a' };
    expect(removeTab(single, 'a')).toBe(single);
    const state = threeTabs();
    expect(removeTab(state, 'zzz')).toBe(state);
  });

  it('renameTab and moveTab (index clamped)', () => {
    expect(renameTab(threeTabs(), 'c', 'New').tabs[2].title).toBe('New');
    expect(moveTab(threeTabs(), 'a', 99).tabs.map((t) => t.id)).toEqual(['b', 'c', 'a']);
    expect(moveTab(threeTabs(), 'c', -5).tabs.map((t) => t.id)).toEqual(['c', 'a', 'b']);
    const state = threeTabs();
    expect(moveTab(state, 'zzz', 0)).toBe(state);
  });
});
