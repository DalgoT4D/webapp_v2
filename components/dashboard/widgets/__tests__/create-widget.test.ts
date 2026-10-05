import { DashboardComponentType } from '@/types/dashboard';
import {
  createChartWidget,
  createKpiWidget,
  createTextWidget,
  fallbackChartWidgetDetails,
  insertWidget,
} from '@/components/dashboard/widgets/create-widget';
import type { DashboardEditorState } from '@/components/dashboard/logic/editor-state';

const NOW = 1700000000000;
const existing = [
  { i: 'a', x: 0, y: 0, w: 6, h: 5 },
  { i: 'b', x: 6, y: 2, w: 6, h: 7 },
];

describe('createChartWidget (d-b5 snapshot)', () => {
  it('builds the component and a full-width layout item at the bottom', () => {
    const w = createChartWidget(
      42,
      { title: 'Bar shot', chart_type: 'bar', description: null },
      [],
      NOW
    );
    expect(w.component).toEqual({
      id: `chart-${NOW}`,
      type: DashboardComponentType.CHART,
      config: {
        chartId: 42,
        title: 'Bar shot',
        chartType: 'bar',
        computation_type: undefined,
        description: null,
        contentConstraints: null,
      },
    });
    expect(w.layoutItem).toEqual({
      i: `chart-${NOW}`,
      x: 0,
      y: 0,
      w: 12,
      h: 18,
      minW: 1,
      maxW: 12,
      minH: 2,
    });
  });

  it('lands below the lowest widget', () => {
    expect(
      createChartWidget(1, { title: 't', chart_type: 'bar' }, existing, NOW).layoutItem.y
    ).toBe(9);
  });

  it('fallback details when the chart GET fails', () => {
    expect(fallbackChartWidgetDetails(9)).toEqual({
      id: 9,
      title: 'Chart #9',
      chart_type: 'bar',
      computation_type: 'aggregated',
    });
  });
});

describe('createKpiWidget (d-b6 snapshot)', () => {
  it('builds the component and layout item', () => {
    const w = createKpiWidget(441, 'Average Female Scores', [], NOW);
    expect(w.component).toEqual({
      id: `kpi-${NOW}`,
      type: DashboardComponentType.KPI,
      config: { kpiId: 441, title: 'Average Female Scores' },
    });
    expect(w.layoutItem).toEqual({
      i: `kpi-${NOW}`,
      x: 0,
      y: 0,
      w: 12,
      h: 11,
      minW: 1,
      maxW: 12,
      minH: 2,
    });
  });
});

describe('createTextWidget (gap-d-tablet-text snapshot)', () => {
  it('builds an empty paragraph with content constraints', () => {
    const w = createTextWidget(existing, NOW);
    expect(w.component).toEqual({
      id: `text-${NOW}`,
      type: DashboardComponentType.TEXT,
      config: {
        content: '',
        type: 'paragraph',
        fontSize: 16,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textDecoration: 'none',
        textAlign: 'left',
        color: '#000000',
        contentConstraints: { minWidth: 250, minHeight: 160 },
      },
    });
    expect(w.layoutItem).toEqual({
      i: `text-${NOW}`,
      x: 0,
      y: 9,
      w: 12,
      h: 8,
      minW: 1,
      maxW: 12,
      minH: 1,
    });
  });
});

describe('insertWidget', () => {
  it('adds the widget to the active tab only', () => {
    const state: DashboardEditorState = {
      activeTabId: 't2',
      tabs: [
        { id: 't1', title: 'A', layout_config: [], components: {} },
        { id: 't2', title: 'B', layout_config: [], components: {} },
      ],
    };
    const w = createKpiWidget(1, 'K', [], NOW);
    const next = insertWidget(state, w);
    expect(next.tabs[0]).toBe(state.tabs[0]);
    expect(next.tabs[1].layout_config).toEqual([w.layoutItem]);
    expect(next.tabs[1].components).toEqual({ [`kpi-${NOW}`]: w.component });
  });
});
