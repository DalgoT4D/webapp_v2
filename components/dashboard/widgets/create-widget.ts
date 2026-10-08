import {
  DashboardComponentType,
  type DashboardComponentConfig,
  type DashboardLayoutItem,
} from '@/types/dashboard';
import { bottomY } from '@/lib/dashboard-animation-utils';
import {
  calculateTextDimensions,
  getDefaultGridDimensions,
  getMinGridDimensions,
  type GridDimensions,
} from '@/lib/chart-size-constraints';
import { GRID_COLUMN_COUNT } from '@/components/dashboard/grid/grid-constants';
import type { UnifiedTextConfig } from '@/components/dashboard/widgets/text/rich-text-config';
import {
  getActiveEditorTab,
  updateActiveEditorTab,
  type DashboardEditorState,
} from '@/components/dashboard/logic/editor-state';

/** A widget ready to insert: its component entry and its grid position. */
export interface NewWidget {
  component: DashboardComponentConfig;
  layoutItem: DashboardLayoutItem;
}

/** The chart metadata a chart widget stores (from GET /api/charts/<id>/). */
export interface ChartWidgetDetails {
  id?: number;
  title: string;
  chart_type?: string;
  computation_type?: string;
  description?: string | null;
}

/** Used when GET /api/charts/<id>/ fails — the widget is still added. */
export function fallbackChartWidgetDetails(chartId: number): ChartWidgetDetails {
  return {
    id: chartId,
    title: `Chart #${chartId}`,
    chart_type: 'bar',
    computation_type: 'aggregated',
  };
}

/**
 * Grid model: a new widget lands full-width at the bottom of the canvas. The user drags &
 * resizes it from there. Nothing else on the canvas reorganizes.
 */
function bottomFullWidthItem(
  id: string,
  layout: DashboardLayoutItem[],
  height: number,
  minDimensions: GridDimensions
): DashboardLayoutItem {
  return {
    i: id,
    x: 0,
    y: bottomY(layout),
    w: GRID_COLUMN_COUNT,
    h: height,
    minW: minDimensions.w,
    maxW: GRID_COLUMN_COUNT,
    minH: minDimensions.h,
  };
}

export function createChartWidget(
  chartId: number,
  chartDetails: ChartWidgetDetails,
  layout: DashboardLayoutItem[],
  now: number
): NewWidget {
  // Use default sizing based on chart type (no slow data fetch needed)
  const chartType = chartDetails.chart_type || 'default';
  const id = `chart-${now}`;
  return {
    component: {
      id,
      type: DashboardComponentType.CHART,
      config: {
        chartId,
        title: chartDetails.title,
        chartType: chartDetails.chart_type,
        computation_type: chartDetails.computation_type,
        description: chartDetails.description,
        contentConstraints: null,
      },
    },
    layoutItem: bottomFullWidthItem(
      id,
      layout,
      getDefaultGridDimensions(chartType).h,
      getMinGridDimensions(chartType)
    ),
  };
}

export function createKpiWidget(
  kpiId: number,
  kpiName: string,
  layout: DashboardLayoutItem[],
  now: number
): NewWidget {
  const id = `kpi-${now}`;
  return {
    component: { id, type: DashboardComponentType.KPI, config: { kpiId, title: kpiName } },
    layoutItem: bottomFullWidthItem(
      id,
      layout,
      getDefaultGridDimensions('kpi').h,
      getMinGridDimensions('kpi')
    ),
  };
}

export function createTextWidget(layout: DashboardLayoutItem[], now: number): NewWidget {
  // Calculate minimum dimensions for empty text component
  const defaultTextDimensions = calculateTextDimensions({
    content: '', // Empty content
    fontSize: 16,
    fontWeight: 'normal',
    type: 'paragraph',
    textAlign: 'left',
  });
  const config: UnifiedTextConfig = {
    content: '',
    type: 'paragraph',
    fontSize: 16,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    textAlign: 'left',
    color: '#000000',
    contentConstraints: {
      minWidth: defaultTextDimensions.width,
      minHeight: defaultTextDimensions.height,
    },
  };
  const id = `text-${now}`;
  return {
    component: {
      id,
      type: DashboardComponentType.TEXT,
      config: config as unknown as Record<string, unknown>,
    },
    layoutItem: bottomFullWidthItem(
      id,
      layout,
      getDefaultGridDimensions('text').h,
      getMinGridDimensions('text')
    ),
  };
}

/** Adds a new widget to the active tab (one history entry when used in setState). */
export function insertWidget(state: DashboardEditorState, widget: NewWidget): DashboardEditorState {
  const tab = getActiveEditorTab(state);
  return updateActiveEditorTab(state, {
    layout_config: [...tab.layout_config, widget.layoutItem],
    components: { ...tab.components, [widget.component.id]: widget.component },
  });
}
