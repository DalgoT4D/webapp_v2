export const WIDGET_NAVIGATION_SOURCES = {
  DASHBOARD: 'dashboard',
  REPORT: 'report',
} as const;

export type WidgetNavigationSource =
  (typeof WIDGET_NAVIGATION_SOURCES)[keyof typeof WIDGET_NAVIGATION_SOURCES];

export function parseWidgetNavigationSource(value: string | null): WidgetNavigationSource | null {
  return value === WIDGET_NAVIGATION_SOURCES.DASHBOARD || value === WIDGET_NAVIGATION_SOURCES.REPORT
    ? value
    : null;
}

export function getChartViewUrl(chartId: number | string, source?: WidgetNavigationSource | null) {
  return `/charts/${chartId}${source ? `?from=${source}` : ''}`;
}

export function getChartEditUrl(chartId: number | string, source?: WidgetNavigationSource | null) {
  return `/charts/${chartId}/edit${source ? `?from=${source}` : ''}`;
}

export function getKpiViewUrl(kpiId: number | string, source: WidgetNavigationSource) {
  return `/kpis?open=${kpiId}&from=${source}`;
}

export function getKpiEditUrl(kpiId: number | string, source: WidgetNavigationSource) {
  return `/kpis?edit=${kpiId}&from=${source}`;
}

export function getWidgetBackLabel(source: WidgetNavigationSource) {
  return source === WIDGET_NAVIGATION_SOURCES.REPORT ? 'Back to Report' : 'Back to Dashboard';
}
