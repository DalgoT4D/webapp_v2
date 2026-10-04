'use client';

import { apiGet } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import {
  markChartAddedToDashboard,
  markKpiAddedToDashboard,
} from '@/components/onboarding/insight-walkthrough-constants';
import type { DashboardLayoutItem } from '@/types/dashboard';
import type { DashboardEditorState } from '@/components/dashboard/logic/editor-state';
import {
  createChartWidget,
  createKpiWidget,
  createTextWidget,
  fallbackChartWidgetDetails,
  insertWidget,
  type ChartWidgetDetails,
} from '@/components/dashboard/widgets/create-widget';

/** How long a new widget's entrance animation runs. */
export const NEW_WIDGET_ANIMATION_MS = 500;

export interface AddWidgetContext {
  dashboardId: number | undefined;
  /** The rendered tab's layout — the new widget goes below its lowest item. */
  activeLayout: DashboardLayoutItem[];
  setState: (update: (prev: DashboardEditorState) => DashboardEditorState) => void;
  animateComponent: (componentId: string, durationMs: number) => void;
  scrollToComponentIfNeeded: (componentId: string) => void;
}

/**
 * The builder's three "add" actions: insert into the active tab → track → onboarding milestone →
 * animate → scroll → advance the walkthrough. Rebuilt on every render, like the handlers it
 * replaces (they close over the rendered layout).
 */
export function buildAddWidgetHandlers({
  dashboardId,
  activeLayout,
  setState,
  animateComponent,
  scrollToComponentIfNeeded,
}: AddWidgetContext) {
  // Add chart component - optimized for speed
  const handleChartSelected = async (chartId: number) => {
    try {
      // Only fetch chart metadata (fast ~50ms) - skip data fetch (slow ~2.5s)
      // The chart component will fetch its own data when it renders
      let chartDetails: ChartWidgetDetails;
      try {
        chartDetails = await apiGet(`/api/charts/${chartId}/`);
      } catch {
        chartDetails = fallbackChartWidgetDetails(chartId);
      }

      // Use default sizing based on chart type (no slow data fetch needed)
      const chartType = chartDetails.chart_type || 'default';
      const widget = createChartWidget(chartId, chartDetails, activeLayout, Date.now());

      setState((prev) => insertWidget(prev, widget));

      trackEvent(ANALYTICS_EVENTS.DASHBOARD_CHART_ADDED, {
        // Both ids: chart_type says what KIND was added, chart_id says WHICH chart — only
        // the id answers "which charts get reused across dashboards" and "built but never
        // placed anywhere".
        chart_id: chartId,
        chart_type: chartType,
        dashboard_id: dashboardId,
      });

      // Resume-nudge milestone — set regardless of an active coachmark session.
      markChartAddedToDashboard();

      // Animate component entrance
      animateComponent(widget.component.id, NEW_WIDGET_ANIMATION_MS);

      // Smart scroll to show the newly added component if needed
      scrollToComponentIfNeeded(widget.component.id);

      const walkthrough = useInsightWalkthroughStore.getState();
      if (walkthrough.active && walkthrough.stage === 'builder_add_chart') {
        walkthrough.advanceTo('builder_resize');
      } else if (walkthrough.active && walkthrough.stage === 'builder_add_chart_first') {
        // Own-data path adds chart-then-KPI (opposite of the sample path) — next is
        // the KPI-add stage, not resize.
        walkthrough.advanceTo('builder_add_kpi_second');
      }
    } catch {
      console.error('Failed to add chart');
    }
  };

  // Add KPI component
  const handleKPISelected = (kpiId: number, kpiName: string) => {
    // Grid model: new KPI lands full-width at the bottom (same as charts/text).
    const widget = createKpiWidget(kpiId, kpiName, activeLayout, Date.now());

    setState((prev) => insertWidget(prev, widget));

    trackEvent(ANALYTICS_EVENTS.DASHBOARD_KPI_ADDED, {
      kpi_id: kpiId,
      dashboard_id: dashboardId,
    });
    // Resume-nudge milestone — set regardless of an active coachmark session.
    markKpiAddedToDashboard();
    animateComponent(widget.component.id, NEW_WIDGET_ANIMATION_MS);
    scrollToComponentIfNeeded(widget.component.id);

    const walkthrough = useInsightWalkthroughStore.getState();
    if (walkthrough.active && walkthrough.stage === 'builder_add_kpi') {
      walkthrough.advanceTo('builder_add_chart');
    } else if (walkthrough.active && walkthrough.stage === 'builder_add_kpi_second') {
      // Own-data path already added its chart first — next is resize, converging
      // back into the shared tail (resize → save → preview → share).
      walkthrough.advanceTo('builder_resize');
    }
  };

  // Add text component
  const addTextComponent = () => {
    // Grid model: new text widget lands full-width at the bottom of the canvas.
    const widget = createTextWidget(activeLayout, Date.now());

    setState((prev) => insertWidget(prev, widget));

    trackEvent(ANALYTICS_EVENTS.DASHBOARD_TEXT_ELEMENT_ADDED, { dashboard_id: dashboardId });

    // Animate component entrance
    animateComponent(widget.component.id, NEW_WIDGET_ANIMATION_MS);

    // Smart scroll to show the newly added component if needed
    scrollToComponentIfNeeded(widget.component.id);
  };

  return { handleChartSelected, handleKPISelected, addTextComponent };
}
