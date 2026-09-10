import {
  getChartEditUrl,
  getChartViewUrl,
  getKpiEditUrl,
  getKpiViewUrl,
  getWidgetBackLabel,
  parseWidgetNavigationSource,
  WIDGET_NAVIGATION_SOURCES,
} from '@/lib/widget-navigation';

describe('widget navigation', () => {
  it('builds consistent dashboard routes for charts and KPIs', () => {
    expect(getChartViewUrl(42, WIDGET_NAVIGATION_SOURCES.DASHBOARD)).toBe(
      '/charts/42?from=dashboard'
    );
    expect(getChartEditUrl(42, WIDGET_NAVIGATION_SOURCES.DASHBOARD)).toBe(
      '/charts/42/edit?from=dashboard'
    );
    expect(getKpiViewUrl(42, WIDGET_NAVIGATION_SOURCES.DASHBOARD)).toBe(
      '/kpis?open=42&from=dashboard'
    );
    expect(getKpiEditUrl(42, WIDGET_NAVIGATION_SOURCES.DASHBOARD)).toBe(
      '/kpis?edit=42&from=dashboard'
    );
  });

  it('builds source-aware report routes and labels', () => {
    expect(getChartViewUrl(9, WIDGET_NAVIGATION_SOURCES.REPORT)).toBe('/charts/9?from=report');
    expect(getKpiViewUrl(9, WIDGET_NAVIGATION_SOURCES.REPORT)).toBe('/kpis?open=9&from=report');
    expect(getWidgetBackLabel(WIDGET_NAVIGATION_SOURCES.REPORT)).toBe('Back to Report');
    expect(getWidgetBackLabel(WIDGET_NAVIGATION_SOURCES.DASHBOARD)).toBe('Back to Dashboard');
  });

  it('accepts only known navigation sources', () => {
    expect(parseWidgetNavigationSource('dashboard')).toBe('dashboard');
    expect(parseWidgetNavigationSource('report')).toBe('report');
    expect(parseWidgetNavigationSource('public')).toBeNull();
    expect(parseWidgetNavigationSource(null)).toBeNull();
  });

  it('keeps chart library navigation unchanged without a source', () => {
    expect(getChartViewUrl(7)).toBe('/charts/7');
    expect(getChartEditUrl(7)).toBe('/charts/7/edit');
  });
});
