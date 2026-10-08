'use client';

import { resolveDashboardFilters } from '@/lib/dashboard-filter-utils';
import type { FrozenChartConfig } from '@/types/reports';
import type { TableDrillDownState } from '@/components/charts/logic/payload';
import type { WidgetChartLike, WidgetMapDrillLevel } from './logic/chart-widget-map';
import { useChartViewChartData } from './useChartViewChartData';
import { useChartViewTableData } from './useChartViewTableData';
import { useChartViewMapData } from './useChartViewMapData';

interface ChartViewDataOptions {
  chartId: number;
  isPublicMode: boolean;
  publicToken?: string;
  frozenChartConfig?: FrozenChartConfig;
  snapshotId?: number;
  dashboardFilters: Record<string, unknown>;
  dashboardFilterConfigs: Parameters<typeof resolveDashboardFilters>[1];
  effectiveChart: (WidgetChartLike & { computation_type?: string }) | undefined;
  isTableChart: boolean;
  isMapChart: boolean;
  tablePage: number;
  tablePageSize: number;
  tableDrillDownState: TableDrillDownState | null;
  drillDownPath: WidgetMapDrillLevel[];
}

/** Every request a view chart widget makes (GET / report POST / public fetch; table; map), by mode. */
export function useChartViewData({
  chartId,
  isPublicMode,
  publicToken,
  frozenChartConfig,
  snapshotId,
  dashboardFilters,
  dashboardFilterConfigs,
  effectiveChart,
  isTableChart,
  isMapChart,
  tablePage,
  tablePageSize,
  tableDrillDownState,
  drillDownPath,
}: ChartViewDataOptions) {
  const main = useChartViewChartData({
    chartId,
    isPublicMode,
    publicToken,
    frozenChartConfig,
    snapshotId,
    dashboardFilters,
    dashboardFilterConfigs,
    effectiveChart,
    tableDrillDownState,
  });
  const table = useChartViewTableData({
    chartId,
    isPublicMode,
    publicToken,
    frozenChartConfig,
    snapshotId,
    dashboardFilters,
    isTableChart,
    tablePage,
    tablePageSize,
    chartDataPayload: main.chartDataPayload,
    isPublicReport: main.isPublicReport,
  });
  const map = useChartViewMapData({
    chartId,
    isPublicMode,
    publicToken,
    frozenChartConfig,
    snapshotId,
    dashboardFilters,
    isMapChart,
    effectiveChart,
    drillDownPath,
    isPublicReport: main.isPublicReport,
  });
  return { ...main, ...table, ...map };
}
