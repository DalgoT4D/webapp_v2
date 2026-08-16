import { DashboardComponentType, type DashboardTabsData } from '@/types/dashboard';
import { moveWidgetBetweenTabs, placeItemInLayout, pointerToGridPosition } from '../cross-tab-drag';

const chart = {
  id: 'chart-1',
  type: DashboardComponentType.CHART,
  config: { chartId: 1 },
};

const makeState = (): DashboardTabsData => ({
  activeTabId: 'source',
  tabs: [
    {
      id: 'source',
      title: 'Source',
      layout_config: [
        { i: 'chart-1', x: 0, y: 0, w: 6, h: 4 },
        { i: 'text-1', x: 0, y: 4, w: 6, h: 3 },
      ],
      components: {
        'chart-1': chart,
        'text-1': {
          id: 'text-1',
          type: DashboardComponentType.TEXT,
          config: { content: 'Source text' },
        },
      },
    },
    {
      id: 'target',
      title: 'Target',
      layout_config: [{ i: 'kpi-1', x: 0, y: 0, w: 6, h: 3 }],
      components: {
        'kpi-1': {
          id: 'kpi-1',
          type: DashboardComponentType.KPI,
          config: { kpiId: 1 },
        },
      },
    },
  ],
});

describe('cross-tab dashboard moves', () => {
  it('moves a widget atomically while preserving its component and dimensions', () => {
    const state = makeState();
    const result = moveWidgetBetweenTabs(
      state,
      {
        componentId: 'chart-1',
        sourceTabId: 'source',
        targetTabId: 'target',
        x: 3,
        y: 2,
      },
      12
    );

    const source = result.tabs.find((tab) => tab.id === 'source')!;
    const target = result.tabs.find((tab) => tab.id === 'target')!;
    expect(result.activeTabId).toBe('target');
    expect(source.components['chart-1']).toBeUndefined();
    expect(source.layout_config.map((item) => item.i)).not.toContain('chart-1');
    expect(target.components['chart-1']).toEqual(chart);
    expect(target.layout_config.find((item) => item.i === 'chart-1')).toMatchObject({
      x: 3,
      y: 2,
      w: 6,
      h: 4,
    });
  });

  it('moves rich-text widgets without changing their structured content', () => {
    const state = makeState();
    const richText = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Partly bold', marks: [{ type: 'bold' }] }],
        },
      ],
    };
    state.tabs[0].components['text-1'].config = {
      content: 'Partly bold',
      richText,
      type: 'paragraph',
    };

    const result = moveWidgetBetweenTabs(
      state,
      {
        componentId: 'text-1',
        sourceTabId: 'source',
        targetTabId: 'target',
        x: 2,
        y: 5,
      },
      12
    );

    const source = result.tabs.find((tab) => tab.id === 'source')!;
    const target = result.tabs.find((tab) => tab.id === 'target')!;
    expect(source.components['text-1']).toBeUndefined();
    expect(source.layout_config.map((item) => item.i)).not.toContain('text-1');
    expect(target.components['text-1'].config.richText).toEqual(richText);
    expect(target.layout_config.find((item) => item.i === 'text-1')).toMatchObject({
      x: 2,
      y: 5,
      w: 6,
      h: 3,
    });
  });

  it('moves KPI widgets while preserving their identity and size', () => {
    const state = makeState();
    const result = moveWidgetBetweenTabs(
      state,
      {
        componentId: 'kpi-1',
        sourceTabId: 'target',
        targetTabId: 'source',
        x: 6,
        y: 1,
      },
      12
    );

    const source = result.tabs.find((tab) => tab.id === 'target')!;
    const target = result.tabs.find((tab) => tab.id === 'source')!;
    expect(source.components['kpi-1']).toBeUndefined();
    expect(target.components['kpi-1']).toEqual({
      id: 'kpi-1',
      type: DashboardComponentType.KPI,
      config: { kpiId: 1 },
    });
    expect(target.layout_config.find((item) => item.i === 'kpi-1')).toMatchObject({
      x: 6,
      y: 1,
      w: 6,
      h: 3,
    });
  });

  it('pushes colliding destination widgets downward while keeping the drop position', () => {
    const result = placeItemInLayout(
      [{ i: 'existing', x: 0, y: 0, w: 6, h: 3 }],
      { i: 'moved', x: 0, y: 0, w: 6, h: 4 },
      12
    );
    expect(result.find((item) => item.i === 'moved')).toMatchObject({ x: 0, y: 0 });
    expect(result.find((item) => item.i === 'existing')).toMatchObject({ y: 4 });
  });

  it('clamps pointer placement to the grid', () => {
    expect(
      pointerToGridPosition(
        2000,
        -100,
        { w: 4, h: 3 },
        {
          containerWidth: 1200,
          containerLeft: 0,
          containerTop: 100,
          cols: 12,
          rowHeight: 20,
          marginX: 8,
          marginY: 8,
          paddingX: 8,
          paddingY: 8,
        }
      )
    ).toEqual({ x: 8, y: 0 });
  });

  it('uses the scrolled container viewport position without double-counting scroll', () => {
    expect(
      pointerToGridPosition(
        100,
        108,
        { w: 4, h: 3 },
        {
          containerWidth: 1200,
          containerLeft: 0,
          // The inner grid has moved up by 100px in the viewport after scrolling.
          containerTop: -92,
          cols: 12,
          rowHeight: 20,
          marginX: 8,
          marginY: 8,
          paddingX: 8,
          paddingY: 8,
        }
      )
    ).toEqual({ x: 1, y: 7 });
  });

  it('leaves state unchanged for an invalid or same-tab move', () => {
    const state = makeState();
    expect(
      moveWidgetBetweenTabs(
        state,
        {
          componentId: 'chart-1',
          sourceTabId: 'source',
          targetTabId: 'source',
          x: 0,
          y: 0,
        },
        12
      )
    ).toBe(state);
  });
});
