import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from 'react';
import * as echarts from 'echarts/core';
import { buildChartWidgetOption } from '@/components/dashboard/widgets/chart/logic/chart-widget-option';
import type { useChartViewData } from '@/components/dashboard/widgets/chart/useChartViewData';
import type { useChartViewMetadata } from '@/components/dashboard/widgets/chart/useChartViewMetadata';
import type { WidgetMapDrillLevel } from '@/components/dashboard/widgets/chart/logic/chart-widget-map';
import type { FrozenChartConfig } from '@/types/reports';

type ViewData = ReturnType<typeof useChartViewData>;
type ContainerSize = { width: number; height: number };

interface ViewChartLifecycleOptions {
  chartId: number;
  chartRef: RefObject<HTMLDivElement | null>;
  chartInstance: MutableRefObject<echarts.ECharts | null>;
  mapChartInstance: MutableRefObject<echarts.ECharts | null>;
  previousFilterHash: MutableRefObject<string>;
  filterHash: ViewData['filterHash'];
  chartData: ViewData['chartData'];
  mapDataOverlay: ViewData['mapDataOverlay'];
  geojsonData: ViewData['geojsonData'];
  mutate: ViewData['mutate'];
  mutateMapData: ViewData['mutateMapData'];
  effectiveChart: ReturnType<typeof useChartViewMetadata>['effectiveChart'];
  isMapChart: boolean;
  isTableChart: boolean;
  isPivotTableChart: boolean;
  drillDownPath: WidgetMapDrillLevel[];
  handleRegionClick: (regionName: string) => void;
  isFullscreen: boolean;
  containerSize: ContainerSize;
  setContainerSize: Dispatch<SetStateAction<ContainerSize>>;
  dashboardFilters: Record<string, unknown>;
  frozenChartConfig?: FrozenChartConfig;
}

/**
 * The view widget's ECharts lifecycle — build/refresh the instance, refetch when dashboard filters
 * change (dashboard mode), dispose on chart change, resize after fullscreen toggles. Moved verbatim
 * from chart-element-view; the five effects keep their order and dependency lists.
 */
export function useViewChartLifecycle({
  chartId,
  chartRef,
  chartInstance,
  mapChartInstance,
  previousFilterHash,
  filterHash,
  chartData,
  mapDataOverlay,
  geojsonData,
  mutate,
  mutateMapData,
  effectiveChart,
  isMapChart,
  isTableChart,
  isPivotTableChart,
  drillDownPath,
  handleRegionClick,
  isFullscreen,
  containerSize,
  setContainerSize,
  dashboardFilters,
  frozenChartConfig,
}: ViewChartLifecycleOptions) {
  // Initialize and update chart
  useEffect(() => {
    if (!chartRef.current) {
      return undefined;
    }

    // Check if filters changed and we need to recreate the chart instance
    const filtersChanged = previousFilterHash.current !== filterHash;

    // Get the appropriate data source based on chart type
    let activeChartData;

    if (isMapChart) {
      // Maps now use MapPreview component, skip manual ECharts creation
      return undefined;
    } else {
      activeChartData = chartData;
    }

    if (filtersChanged && chartInstance.current && activeChartData?.echarts_config) {
      chartInstance.current.dispose();
      chartInstance.current = null;
      previousFilterHash.current = filterHash;
    }

    // Initialize chart instance if it doesn't exist
    if (!chartInstance.current) {
      try {
        chartInstance.current = echarts.init(chartRef.current, null, {
          renderer: 'canvas',
        });
      } catch (error) {
        console.error('Failed to create chart instance:', error);
        return undefined;
      }
    }

    // Only proceed with config if we have valid echarts_config
    if (!activeChartData?.echarts_config) {
      // Clear chart but don't dispose instance
      if (chartInstance.current) {
        chartInstance.current.clear();
      }
      return undefined;
    }

    // Styled option: legend for the container size, HTML title, labels/axes/tooltip, formatting
    const styledConfig = buildChartWidgetOption({
      baseConfig: activeChartData.echarts_config,
      chartType: effectiveChart?.chart_type,
      customizations: effectiveChart?.extra_config?.customizations || {},
      containerSize,
      variant: 'view',
    });

    try {
      // Force notMerge to ensure axis title styling is applied
      chartInstance.current.setOption(styledConfig, true);

      // Click event listeners for non-map charts only (maps use MapPreview component)
      if (!isMapChart) {
        // Add any non-map click handlers here if needed
      }

      // Ensure the chart is properly sized after setting options
      chartInstance.current.resize();
    } catch (error) {
      console.error('Error setting chart option for chart', chartId, error);
    }

    // Handle resize
    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    // Resize observer for container changes - also tracks container size for responsive legends
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          // Update container size state for responsive legends
          setContainerSize((prev) => {
            if (prev.width !== width || prev.height !== height) {
              return { width, height };
            }
            return prev;
          });
          chartInstance.current?.resize();
        }
      }
    });

    resizeObserver.observe(chartRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref/setter passed as a parameter is stable; deps kept as before R6
  }, [
    chartData,
    mapDataOverlay,
    geojsonData,
    isMapChart,
    chartId,
    filterHash,
    drillDownPath,
    handleRegionClick,
    isFullscreen, // Add fullscreen state to trigger chart resize
    containerSize, // Update when container size changes for responsive legends
  ]);

  // Re-fetch data when filters change (dashboard mode only).
  // In report mode, SWR keys already include filterHash so refetch is automatic.
  useEffect(() => {
    if (!frozenChartConfig) {
      mutate();
    }
  }, [dashboardFilters, mutate, chartId, frozenChartConfig]);

  // Re-fetch map data when filters change (dashboard mode only, same reason as above)
  useEffect(() => {
    if (isMapChart && mutateMapData && !frozenChartConfig) {
      mutateMapData();
    }
  }, [dashboardFilters, mutateMapData, chartId, isMapChart, frozenChartConfig]);

  // Cleanup on unmount and when chartId changes
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref passed as a parameter is stable; deps kept as before R6
  }, [chartId]);

  // Handle chart resize when fullscreen state changes
  useEffect(() => {
    // Trigger chart resize after fullscreen change
    const resizeTimer = setTimeout(() => {
      if (!isTableChart && !isPivotTableChart) {
        // Only resize ECharts instances, not tables/pivots
        if (chartInstance.current) {
          chartInstance.current.resize();
        }
        if (mapChartInstance.current) {
          mapChartInstance.current.resize();
        }
      }
      // Tables/pivots don't need explicit resize - they automatically adjust with CSS flexbox
    }, 100);

    return () => clearTimeout(resizeTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs passed as parameters are stable; deps kept as before R6
  }, [isFullscreen, isTableChart, isPivotTableChart]);
}
