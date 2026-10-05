'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  useChart,
  useChartData,
  useChartDataPreview,
  useChartDataPreviewTotalRows,
} from '@/hooks/api/useChart';
import type { PivotTableResponse } from '@/types/pivot-table';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Lock } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShareModal } from '@/components/share/ShareModal';
import { useOpenShareDeepLink } from '@/hooks/useOpenShareDeepLink';
import { useRbac } from '@/lib/rbac';
import { getRolePermissions } from '@/components/access/logic/resource-permissions';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS, CHART_DRILL_SOURCES } from '@/constants/analytics';
import { useDrillDownAnalytics } from '@/components/charts/useDrillDownAnalytics';
import { useTableDrillDown } from '@/components/charts/hooks/useTableDrillDown';
import { useSavedMapDrillDown } from '@/components/charts/hooks/useSavedMapDrillDown';
import { useFilteredMapToasts } from '@/components/charts/hooks/useFilteredMapToasts';
import { ChartDetailHeader } from '@/components/charts/detail/ChartDetailHeader';
import { ChartDetailBody } from '@/components/charts/detail/ChartDetailBody';
import { buildSavedChartDataPayload } from '@/components/charts/logic/saved-chart-payload';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { CelebrationModal } from '@/components/onboarding/celebration-modal';
import type { ChartDataPayload } from '@/types/charts';
import type * as echarts from 'echarts';
import { parseWidgetNavigationSource } from '@/lib/widget-navigation';

interface ChartDetailClientProps {
  chartId: number;
}

export function ChartDetailClient({ chartId }: ChartDetailClientProps) {
  const celebrationPending = useInsightWalkthroughStore((s) => s.pendingCelebration === 'chart');
  const router = useRouter();
  const searchParams = useSearchParams();
  const navigationSource = parseWidgetNavigationSource(searchParams.get('from'));
  const { hasPermission } = useRbac();
  const canViewCharts = getRolePermissions('chart', hasPermission).canView;
  // Computed once per render so it's a stable primitive in handleRegionClick's deps,
  // instead of calling the (unstable-reference) hasPermission multiple times inside the callback
  const canEditCharts = hasPermission('can_edit_charts');
  // Don't start the chart request without view permission; the access-denied
  // return lives below, after all hooks (Rules of Hooks)
  const {
    data: chart,
    error: chartError,
    isLoading: chartLoading,
  } = useChart(canViewCharts ? chartId : null);
  // Fire CHART_VIEWED once per mount when the chart loads (WAVO consume signal).
  const chartViewedTracked = useRef(false);
  useEffect(() => {
    if (chart && !chartViewedTracked.current) {
      trackEvent(ANALYTICS_EVENTS.CHART_VIEWED, {
        chart_type: chart.chart_type,
        chart_id: chartId,
      });
      chartViewedTracked.current = true;
    }
  }, [chart]);
  const [tableChartPage, setTableChartPage] = useState(1);
  const [tableChartPageSize, setTableChartPageSize] = useState(20);

  // ✅ ADD: Drill-down state management for table charts
  const resetTablePage = useCallback(() => setTableChartPage(1), []);
  const tableDrill = useTableDrillDown({
    dimensions: chart?.extra_config?.dimensions,
    isTable: chart?.chart_type === 'table',
    drillUpColumns: 'drillEnabled',
    onLevelChange: resetTablePage,
  });

  // Map drill-down: path, geojson + overlay requests, region click handling
  const map = useSavedMapDrillDown({ chart, chartId, canEditCharts });

  useDrillDownAnalytics({
    chartId,
    chartType: chart?.chart_type,
    source: CHART_DRILL_SOURCES.CHART_DETAIL,
    mapLevel: map.drillDownPath.length,
    tableLevel: tableDrill.tableDrillDownState?.currentLevel ?? null,
  });

  // Stable reference for map customizations — avoids a new {} literal every render,
  // which would otherwise re-trigger MapPreview's chart-init effect in a loop via onChartReady
  const mapCustomizations = useMemo(
    () => chart?.extra_config?.customizations || {},
    [chart?.extra_config?.customizations]
  );

  // Build payload for chart data - use useMemo to update when drill-down state changes
  const chartDataPayload: ChartDataPayload | null = useMemo(
    () => (chart ? buildSavedChartDataPayload(chart, tableDrill.tableDrillDownState) : null),
    [chart, tableDrill.tableDrillDownState]
  );

  // For non-map charts (including tables), use the standard chart data hook
  const {
    data: chartData,
    error: dataError,
    isLoading: dataLoading,
  } = useChartData(chart?.chart_type !== 'map' ? chartDataPayload : null);

  // For table charts, use data preview API with pagination
  const {
    data: tableData,
    error: tableError,
    isLoading: tableLoading,
  } = useChartDataPreview(
    chart?.chart_type === 'table' ? chartDataPayload : null,
    tableChartPage,
    tableChartPageSize
  );

  // Fetch total rows for table chart pagination
  const { data: tableDataTotalRows } = useChartDataPreviewTotalRows(
    chart?.chart_type === 'table' ? chartDataPayload : null
  );

  // Handler for table page size change
  const handleTableChartPageSizeChange = useCallback((newPageSize: number) => {
    setTableChartPageSize(newPageSize);
    setTableChartPage(1); // Reset to first page when page size changes
  }, []);

  useFilteredMapToasts({
    chart,
    geojsonData: map.geojsonData,
    geojsonLoading: map.geojsonLoading,
    geojsonError: map.geojsonError,
    chartId,
    canEditCharts,
  });

  // Chart refs for export
  const [chartElement, setChartElement] = useState<HTMLElement | null>(null);
  const [chartInstance, setChartInstance] = useState<echarts.ECharts | null>(null);
  const { initialOpen: shouldAutoOpenShare, clearParam: clearShareDeepLink } =
    useOpenShareDeepLink();
  const [shareModalOpen, setShareModalOpen] = useState(shouldAutoOpenShare);

  // Handle share (mirrors dashboard-native-view)
  const handleShare = () => {
    setShareModalOpen(true);
  };

  const handleShareModalClose = () => {
    setShareModalOpen(false);
    clearShareDeepLink();
  };
  const chartContentRef = useRef<HTMLDivElement>(null);

  // Update chart element ref when content is rendered
  useEffect(() => {
    if (chartContentRef.current) {
      setChartElement(chartContentRef.current);
    }
  }, [chart, chartData, map.mapDataOverlay]);

  // Check if user has view permissions (after all hooks — Rules of Hooks)
  if (!canViewCharts) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">You don't have permission to view charts.</p>
          <Button
            variant="outline"
            onClick={() => router.push('/charts')}
            data-testid="chart-detail-access-denied-back-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Charts
          </Button>
        </div>
      </div>
    );
  }

  if (chartLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (chartError || !chart) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600">
          Chart isn't ready yet. Please check your settings or try again later.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <ChartDetailHeader
        chart={chart}
        chartId={chartId}
        navigationSource={navigationSource}
        onShare={handleShare}
        exportProps={{
          chartId: chart.id,
          chartTitle: chart.title,
          chartElement,
          chartInstance,
          chartType: chart.chart_type,
          chartDataPayload,
          pivotData:
            chart.chart_type === 'pivot_table'
              ? (chartData?.data as unknown as PivotTableResponse | undefined)
              : undefined,
          pivotExtraConfig: chart.extra_config,
          tableData:
            chart.chart_type === 'table' && tableData
              ? {
                  data: tableData.data || [],
                  columns: tableData.columns || [],
                }
              : undefined,
          tableElement:
            chart.chart_type === 'table' || chart.chart_type === 'pivot_table'
              ? chartContentRef.current
              : undefined,
          drillFilters:
            chart.chart_type === 'table' && tableDrill.tableDrillDownState?.appliedFilters
              ? tableDrill.tableDrillDownState.appliedFilters
              : undefined,
        }}
      />

      <ChartDetailBody
        chart={chart}
        chartContentRef={chartContentRef}
        map={map}
        mapCustomizations={mapCustomizations}
        tableDrill={tableDrill}
        table={{
          data: tableData,
          isLoading: tableLoading,
          error: tableError,
          totalRows: tableDataTotalRows,
          page: tableChartPage,
          pageSize: tableChartPageSize,
          onPageChange: setTableChartPage,
          onPageSizeChange: handleTableChartPageSizeChange,
          hasPayload: !!chartDataPayload,
        }}
        chartData={chartData}
        dataLoading={dataLoading}
        dataError={dataError}
        onChartReady={setChartInstance}
      />

      {/* Walkthrough handover: the chart is built and on screen behind this — now put it on a
          dashboard. Raised by the save handler on the builder page (which can't render it, it's
          a different route) and consumed here. Closing it either way releases the
          dashboard-nudge coachmark, so that's what the user sees next. */}
      <CelebrationModal
        open={celebrationPending}
        onOpenChange={(open) => {
          if (open) return;
          const walkthrough = useInsightWalkthroughStore.getState();
          walkthrough.setPendingCelebration(null);
          walkthrough.setSuppressCoachmark(false);
        }}
        title="Congratulations, your Chart is live!"
        description="Your insight is built, and you can now add it to a dashboard!"
        ctaLabel="Add to Dashboard"
        dismissEvent={ANALYTICS_EVENTS.CHART_LIVE_MODAL_DISMISSED}
        testId="chart-live-modal"
      />
      {/* Share Modal */}
      {chart && (
        <ShareModal
          rtype="chart"
          entityId={chart.id}
          entityLabel={chart.title || 'Chart'}
          isOpen={shareModalOpen}
          onClose={handleShareModalClose}
        />
      )}
    </div>
  );
}
