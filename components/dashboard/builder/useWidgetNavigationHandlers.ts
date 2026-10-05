import { useCallback } from 'react';
import type { useRouter } from 'next/navigation';
import {
  getChartEditUrl,
  getChartViewUrl,
  getKpiEditUrl,
  getKpiViewUrl,
  WIDGET_NAVIGATION_SOURCES,
} from '@/lib/widget-navigation';

/** View / edit a chart or KPI from its builder cell; the target page shows "Back to Dashboard". */
export function useWidgetNavigationHandlers(router: ReturnType<typeof useRouter>) {
  const handleViewChart = useCallback(
    (chartId: number) => {
      router.push(getChartViewUrl(chartId, WIDGET_NAVIGATION_SOURCES.DASHBOARD));
    },
    [router]
  );

  const handleEditChart = useCallback(
    (chartId: number) => {
      router.push(getChartEditUrl(chartId, WIDGET_NAVIGATION_SOURCES.DASHBOARD));
    },
    [router]
  );

  const handleViewKpi = useCallback(
    (kpiId: number) => {
      router.push(getKpiViewUrl(kpiId, WIDGET_NAVIGATION_SOURCES.DASHBOARD));
    },
    [router]
  );

  const handleEditKpi = useCallback(
    (kpiId: number) => {
      router.push(getKpiEditUrl(kpiId, WIDGET_NAVIGATION_SOURCES.DASHBOARD));
    },
    [router]
  );

  return { handleViewChart, handleEditChart, handleViewKpi, handleEditKpi };
}
