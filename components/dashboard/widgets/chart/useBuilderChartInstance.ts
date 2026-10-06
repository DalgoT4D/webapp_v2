import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';
import * as echarts from 'echarts/core';
import { buildChartWidgetOption } from '@/components/dashboard/widgets/chart/logic/chart-widget-option';
import type { BuilderChartData } from '@/components/dashboard/widgets/chart/useBuilderChartData';
import type { useMapDrillPath } from '@/components/dashboard/widgets/chart/useMapDrillPath';

type ContainerSize = { width: number; height: number };

interface BuilderChartInstanceOptions
  extends Pick<
    BuilderChartData,
    | 'chartData'
    | 'mapDataOverlay'
    | 'geojsonData'
    | 'chart'
    | 'isLoading'
    | 'filterHash'
    | 'isMapChart'
    | 'isLineChart'
    | 'isBarChart'
    | 'isPieChart'
    | 'isNumberChart'
    | 'handleRegionClick'
  > {
  chartId: number;
  chartRef: RefObject<HTMLDivElement | null>;
  chartInstance: RefObject<echarts.ECharts | null>;
  resizeTimeoutRef: RefObject<NodeJS.Timeout | null>;
  isResizingRef: RefObject<boolean | undefined>;
  isResizing: boolean | undefined;
  drillDownPath: ReturnType<typeof useMapDrillPath>['drillDownPath'];
  containerSize: ContainerSize;
  setContainerSize: Dispatch<SetStateAction<ContainerSize>>;
}

/**
 * The builder widget's ECharts instance: init once, set the option on every data / size change,
 * window resize, ResizeObserver (trailing-debounced while a cell is being resized) and the final
 * resize after a drag. Moved verbatim from chart-element-builder — dependency lists unchanged.
 */
export function useBuilderChartInstance({
  chartId,
  chartRef,
  chartInstance,
  resizeTimeoutRef,
  isResizingRef,
  isResizing,
  chartData,
  mapDataOverlay,
  geojsonData,
  chart,
  isLoading,
  filterHash,
  isMapChart,
  isLineChart,
  isBarChart,
  isPieChart,
  isNumberChart,
  drillDownPath,
  handleRegionClick,
  containerSize,
  setContainerSize,
}: BuilderChartInstanceOptions) {
  // Initialize chart instance once
  useEffect(() => {
    // Use a small delay to ensure DOM is ready and container has dimensions
    const initTimer = setTimeout(() => {
      if (chartRef.current && !chartInstance.current) {
        const { width, height } = chartRef.current.getBoundingClientRect();

        // Only initialize if container has dimensions
        if (width > 0 && height > 0) {
          chartInstance.current = echarts.init(chartRef.current);
        }
      }
    }, 50);

    // Cleanup only on unmount
    return () => {
      clearTimeout(initTimer);
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []); // Empty dependency array - only run on mount/unmount

  // Update chart data separately
  useEffect(() => {
    // Get the appropriate data source based on chart type
    const activeChartData = isMapChart
      ? { geojson: geojsonData?.geojson_data, data: mapDataOverlay }
      : chartData;

    let chartConfig;

    // Maps now use MapPreview component, skip manual ECharts creation
    if (isMapChart) {
      return; // Early return for map charts
    }

    // Use regular echarts_config for non-map charts
    chartConfig = activeChartData?.echarts_config;

    // If we have data but no chart instance yet, try to initialize
    if (!chartInstance.current && chartRef.current && chartConfig) {
      const { width, height } = chartRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) {
        chartInstance.current = echarts.init(chartRef.current);
      }
    }

    if (chartInstance.current && chartConfig) {
      const modifiedConfig = buildChartWidgetOption({
        baseConfig: chartConfig,
        chartType: chart?.chart_type,
        customizations: chart?.extra_config?.customizations || {},
        containerSize,
        variant: 'builder',
      });

      // Set chart option with animation disabled for better performance
      chartInstance.current.setOption(modifiedConfig, {
        notMerge: true,
        lazyUpdate: false,
        silent: false,
      });

      // Click event listeners for non-map charts only (maps use MapPreview component)
      if (!isMapChart) {
        // Add any non-map click handlers here if needed
      }

      // Force resize after setting options to ensure proper rendering
      setTimeout(() => {
        if (chartInstance.current) {
          chartInstance.current.resize();
        }
      }, 100);
    }
  }, [
    chartData,
    mapDataOverlay,
    geojsonData,
    chart,
    chartId,
    isLoading,
    filterHash,
    isMapChart,
    isLineChart,
    isBarChart,
    isPieChart,
    isNumberChart,
    drillDownPath,
    handleRegionClick,
    containerSize, // Update when container size changes for responsive legends
  ]); // Update when data, filters, or container size change

  // Handle window resize and container resize - separate from chart data changes
  useEffect(() => {
    let resizeTimeoutId: NodeJS.Timeout | null = null;

    const handleResize = () => {
      if (chartInstance.current) {
        // Clear any pending resize
        if (resizeTimeoutId) {
          clearTimeout(resizeTimeoutId);
        }

        // Debounce resize calls
        resizeTimeoutId = setTimeout(() => {
          if (chartInstance.current) {
            chartInstance.current.resize();
          }
        }, 100);
      }
    };

    // Handle window resize
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
    };
  }, []); // No dependencies to avoid infinite loops

  // Handle container resize using ResizeObserver - separate effect
  // OPTIMIZED: Debounce containerSize state updates to prevent re-renders during resize
  // The chart data effect depends on containerSize, so updating it on every frame causes
  // massive lag (entire chart config recalculates). Only update state when resize settles.
  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;
    let rafId: number | null = null;
    let containerSizeTimeoutId: NodeJS.Timeout | null = null;
    // Trailing-debounce timer + latest size for the "active resize" path (see below).
    let activeResizeTimer: NodeJS.Timeout | null = null;
    let latestSize = { width: 0, height: 0 };
    // While a chart is being dragged-to-resize, the ResizeObserver fires ~60×/sec.
    // Re-laying-out ECharts on every one of those frames competes with react-grid-layout's
    // placeholder/handle updates on the main thread and makes the resize feel laggy
    // ("ghost lags"). Instead we trailing-debounce the ECharts resize: during continuous
    // dragging the timer keeps resetting so ECharts never re-layouts mid-motion (snappy
    // ghost), and it fires only when the pointer pauses or the drag ends — always using the
    // latest real container size, so the chart still re-fits correctly. Idle changes (mount,
    // screen-size switch, neighbour reflow) resize immediately.
    const ACTIVE_RESIZE_SETTLE_MS = 60;

    if (chartRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver((entries) => {
        // Cancel any pending animation frame
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        // Cancel any pending containerSize state update
        if (containerSizeTimeoutId) {
          clearTimeout(containerSizeTimeoutId);
        }

        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            latestSize = { width, height };

            if (isResizingRef.current) {
              // ACTIVE RESIZE: trailing-debounce so ECharts doesn't re-layout every frame.
              if (activeResizeTimer) {
                clearTimeout(activeResizeTimer);
              }
              activeResizeTimer = setTimeout(() => {
                if (chartInstance.current) {
                  chartInstance.current.resize({
                    width: Math.floor(latestSize.width),
                    height: Math.floor(latestSize.height),
                  });
                }
              }, ACTIVE_RESIZE_SETTLE_MS);
            } else {
              // IDLE: immediate visual resize via RAF — no React state, no re-renders
              rafId = requestAnimationFrame(() => {
                if (chartInstance.current) {
                  chartInstance.current.resize({
                    width: Math.floor(width),
                    height: Math.floor(height),
                  });
                }
              });

              // DEBOUNCED: update containerSize state once the resize settles
              containerSizeTimeoutId = setTimeout(() => {
                setContainerSize((prev) => {
                  if (prev.width !== width || prev.height !== height) {
                    return { width, height };
                  }
                  return prev;
                });
              }, 150); // Wait for resize to settle before updating state
            }
          }
        }
      });

      resizeObserver.observe(chartRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (containerSizeTimeoutId) {
        clearTimeout(containerSizeTimeoutId);
      }
      if (activeResizeTimer) {
        clearTimeout(activeResizeTimer);
      }
    };
  }, []); // No dependencies to avoid re-creating observer

  // Handle resize when isResizing prop changes - final cleanup after drag stops
  useEffect(() => {
    if (!isResizing && chartInstance.current && chartRef.current) {
      // Clear any pending resize
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      // Quick final resize after drag stops
      resizeTimeoutRef.current = setTimeout(() => {
        if (chartInstance.current && chartRef.current) {
          const { width, height } = chartRef.current.getBoundingClientRect();
          chartInstance.current.resize({
            width: Math.floor(width),
            height: Math.floor(height),
          });
          // Also update containerSize state for responsive legend recalculation
          setContainerSize((prev) => {
            if (prev.width !== width || prev.height !== height) {
              return { width, height };
            }
            return prev;
          });
        }
      }, 50); // Fast response
    }

    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [isResizing]);
}
