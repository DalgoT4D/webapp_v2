'use client';

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, AlertCircle, Home, Eye, Edit, Loader2 } from 'lucide-react';
import { useChart } from '@/hooks/api/useCharts';
import {
  useChartDataPreview,
  useMapDataOverlay,
  useGeoJSONData,
  useRegions,
  useRegionGeoJSONs,
} from '@/hooks/api/useChart';
import useSWR from 'swr';
import { apiGet, apiPost } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { ChartTitleEditor } from './chart-title-editor';
import { DataPreview } from '@/components/charts/DataPreview';
import { MapPreview } from '@/components/charts/map/MapPreview';
import type { ChartTitleConfig } from '@/lib/chart-title-utils';
import {
  resolveDashboardFilters,
  formatAsChartFilters,
  type DashboardFilterConfig,
} from '@/lib/dashboard-filter-utils';
import type { ChartDataPayload } from '@/types/charts';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, GaugeChart, ScatterChart, MapChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  VisualMapComponent,
  GeoComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Register necessary ECharts components
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GaugeChart,
  ScatterChart,
  MapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  VisualMapComponent,
  GeoComponent,
  CanvasRenderer,
]);

interface ChartElementV2Props {
  chartId: number;
  config: any & ChartTitleConfig;
  onRemove: () => void;
  onUpdate: (config: any & ChartTitleConfig) => void;
  isResizing?: boolean;
  isEditMode?: boolean;
  appliedFilters?: Record<string, any>;
  dashboardFilterConfigs?: DashboardFilterConfig[];
}

interface DrillDownLevel {
  level: number;
  name: string;
  geographic_column: string;
  geojson_id: number;
  region_id?: number;
  parent_selections: Array<{
    column: string;
    value: string;
  }>;
}

export function ChartElementV2({
  chartId,
  config,
  onRemove,
  onUpdate,
  isResizing,
  isEditMode = true,
  appliedFilters = {},
  dashboardFilterConfigs = [],
}: ChartElementV2Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Use chartId as unique identifier to isolate drill-down state per chart
  const [drillDownPath, setDrillDownPath] = useState<DrillDownLevel[]>([]);

  // Navigation
  const router = useRouter();

  // Navigation handler functions
  const handleViewChart = () => {
    router.push(`/charts/${chartId}`);
  };

  const handleEditChart = () => {
    router.push(`/charts/${chartId}/edit`);
  };

  // Resolve dashboard filters to complete column information for maps and tables
  const resolvedDashboardFilters = useMemo(() => {
    console.log(`🔍 [Chart ${chartId}] Filter Resolution:`, {
      appliedFilters,
      dashboardFilterConfigs,
      hasAppliedFilters: Object.keys(appliedFilters).length > 0,
      hasFilterConfigs: dashboardFilterConfigs.length > 0,
    });

    if (Object.keys(appliedFilters).length === 0 || dashboardFilterConfigs.length === 0) {
      console.log(`❌ [Chart ${chartId}] Skipping filter resolution - no filters or configs`);
      return [];
    }

    const resolved = resolveDashboardFilters(appliedFilters, dashboardFilterConfigs);
    console.log(`✅ [Chart ${chartId}] Resolved filters:`, resolved);
    return resolved;
  }, [appliedFilters, dashboardFilterConfigs, chartId]);

  // Create a stable chart instance identifier to prevent state bleeding
  const chartInstanceId = useRef(`chart-${chartId}-${Date.now()}`).current;

  const {
    data: chart,
    isLoading: chartLoading,
    isError: chartError,
    error: chartFetchError,
  } = useChart(chartId);

  // Handle title configuration updates
  const handleTitleChange = (titleConfig: ChartTitleConfig) => {
    onUpdate({
      ...config,
      ...titleConfig,
    });
  };

  // Create a unique identifier for when filters change to trigger data refetch
  const filterHash = useMemo(() => JSON.stringify(appliedFilters), [appliedFilters]);

  // Build query params with filters
  const queryParams = new URLSearchParams();
  if (Object.keys(appliedFilters).length > 0) {
    queryParams.append('dashboard_filters', JSON.stringify(appliedFilters));
  }

  const apiUrl = `/api/charts/${chartId}/data/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  // Determine if this is a map chart
  const isMapChart = useMemo(() => {
    return chart ? chart.chart_type === 'map' : false;
  }, [chart]);

  // Determine current level for drill-down
  const currentLevel = drillDownPath.length;
  const currentLayer =
    chart?.chart_type === 'map' && chart?.extra_config?.layers
      ? chart.extra_config.layers[currentLevel]
      : null;

  // activeGeojsonId and activeGeographicColumn will be determined after hooks are declared

  // Build data overlay payload for map charts based on current level
  // Include filters for drill-down selections - flatten all parent selections
  const filters: Record<string, string> = {};
  if (drillDownPath.length > 0) {
    // Collect all parent selections from the drill-down path
    drillDownPath.forEach((level) => {
      level.parent_selections.forEach((selection) => {
        filters[selection.column] = selection.value;
      });
    });
  }

  // mapDataOverlayPayload will be defined after activeGeographicColumn is available

  // Fetch regions data for dynamic geojson lookup
  const { data: regions } = useRegions('IND', 'state');

  // Get the current drill-down region ID for dynamic geojson fetching
  const currentDrillDownRegionId =
    drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1].region_id : null;

  // Fetch geojsons for the current drill-down region (e.g., Karnataka districts)
  const { data: regionGeojsons } = useRegionGeoJSONs(currentDrillDownRegionId);

  // For map charts, determine which geojson and data to fetch based on drill-down state
  let activeGeojsonId = null;
  let activeGeographicColumn = null;

  if (chart?.chart_type === 'map') {
    if (drillDownPath.length > 0) {
      // We're in a drill-down state, use the first available geojson for this region
      const lastDrillDown = drillDownPath[drillDownPath.length - 1];
      activeGeographicColumn = lastDrillDown.geographic_column;

      if (regionGeojsons && regionGeojsons.length > 0) {
        // Use the first available geojson for this region (e.g., Karnataka districts)
        activeGeojsonId = regionGeojsons[0].id;
        console.log(`🗺️ Using geojson ID ${activeGeojsonId} for region ${lastDrillDown.name}`);
      } else {
        // Fallback to the stored geojson_id (if any)
        activeGeojsonId = lastDrillDown.geojson_id;
      }
    } else if (currentLayer) {
      // Use current layer configuration (first layer)
      activeGeojsonId = currentLayer.geojson_id;
      activeGeographicColumn = currentLayer.geographic_column;
    } else {
      // Fallback to first layer or original configuration
      const firstLayer = chart.extra_config?.layers?.[0];
      activeGeojsonId = firstLayer?.geojson_id || chart.extra_config?.selected_geojson_id;
      activeGeographicColumn =
        firstLayer?.geographic_column || chart.extra_config?.geographic_column;
    }
  }

  // Now that activeGeographicColumn is defined, create the map data overlay payload
  const mapDataOverlayPayload = useMemo(() => {
    return chart?.chart_type === 'map' && chart.extra_config && activeGeographicColumn
      ? {
          schema_name: chart.schema_name,
          table_name: chart.table_name,
          geographic_column: activeGeographicColumn,
          value_column: chart.extra_config.aggregate_column || chart.extra_config.value_column,
          aggregate_function: chart.extra_config.aggregate_function || 'sum',
          filters: filters, // Drill-down filters
          chart_filters: [
            ...(chart.extra_config.filters || []), // Chart-level filters
            ...formatAsChartFilters(
              resolvedDashboardFilters.filter(
                (filter) =>
                  filter.schema_name === chart.schema_name && filter.table_name === chart.table_name
              )
            ), // Only apply dashboard filters that match the chart's schema/table
          ],
          // Remove the old dashboard_filters format since we're using chart_filters now
          // Include full extra_config for pagination, sorting, and other features
          extra_config: {
            filters: [
              ...(chart.extra_config.filters || []),
              ...formatAsChartFilters(
                resolvedDashboardFilters.filter(
                  (filter) =>
                    filter.schema_name === chart.schema_name &&
                    filter.table_name === chart.table_name
                )
              ),
            ],
            pagination: chart.extra_config.pagination,
            sort: chart.extra_config.sort,
          },
        }
      : null;
  }, [
    chart?.chart_type,
    chart?.schema_name,
    chart?.table_name,
    chart?.extra_config,
    activeGeographicColumn,
    filters,
    resolvedDashboardFilters, // Updated: Use resolved filters instead of raw dashboardFilters
  ]);

  // Log map payload only when drill down is active
  useEffect(() => {
    if (isMapChart && mapDataOverlayPayload && drillDownPath.length > 0) {
      console.log(
        `🗺️ Map data overlay for ${drillDownPath[drillDownPath.length - 1]?.name || 'region'}`
      );
    }
  }, [isMapChart, mapDataOverlayPayload, drillDownPath]);

  // Now fetch the data that depends on the above variables
  const {
    data: geojsonData,
    error: geojsonError,
    isLoading: geojsonLoading,
  } = useGeoJSONData(activeGeojsonId);

  // Fetch map data using the working map-data-overlay endpoint
  const {
    data: mapDataOverlay,
    error: mapError,
    isLoading: mapLoading,
    mutate: mutateMapData,
  } = useMapDataOverlay(mapDataOverlayPayload);

  // Keep important drill down logging for debugging
  useEffect(() => {
    if (drillDownPath.length > 0) {
      console.log(
        `🗺️ Map drill down active: Level ${currentLevel}, GeoJSON ID: ${activeGeojsonId}`
      );
    }
  }, [drillDownPath.length, currentLevel, activeGeojsonId]);

  // Fetch chart data with filters (skip for map and table charts - they use specialized endpoints)
  const shouldFetchChartData = chart
    ? chart.chart_type !== 'map' && chart.chart_type !== 'table'
    : false; // Don't fetch if chart is not loaded yet

  const {
    data: chartData,
    isLoading: dataLoading,
    error: dataError,
    mutate: mutateChartData,
  } = useSWR(shouldFetchChartData ? apiUrl : null, apiGet, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: 0, // Disable auto-refresh
    // Don't retry on 404 errors or data generation errors
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      // Never retry on 404 or data generation errors
      if (
        error?.message?.includes('404') ||
        error?.message?.includes('not found') ||
        error?.message?.includes('Error generating chart data')
      ) {
        return;
      }
      // Only retry up to 1 time for other errors (reduced from 3)
      if (retryCount >= 1) return;

      // Retry after 1 second
      setTimeout(() => revalidate({ retryCount }), 1000);
    },
    onSuccess: (data) => {
      // Chart data fetched successfully
    },
    onError: (error) => {
      // Only log errors for non-map charts since maps should use specialized endpoints
      if (chart?.chart_type !== 'map') {
        console.error(
          `❌ [${chart?.chart_type?.toUpperCase()}] Error fetching data for chart ${chartId}:`,
          {
            chart_type: chart?.chart_type,
            filters: appliedFilters,
            apiUrl,
            error: error.message,
            shouldFetch: shouldFetchChartData,
          }
        );
      }
    },
  });

  // For table charts, also fetch raw data using data preview API
  const chartDataPayload: ChartDataPayload | null = useMemo(() => {
    if (chart?.chart_type === 'table' && chart) {
      const formattedFilters = formatAsChartFilters(
        resolvedDashboardFilters.filter(
          (filter) =>
            filter.schema_name === chart.schema_name && filter.table_name === chart.table_name
        )
      );
      console.log(`📊 [Table ${chartId}] Building payload:`, {
        resolvedDashboardFilters,
        formattedFilters,
        existingFilters: chart.extra_config?.filters || [],
      });

      return {
        chart_type: chart.chart_type,
        computation_type: chart.computation_type as 'raw' | 'aggregated',
        schema_name: chart.schema_name,
        table_name: chart.table_name,
        x_axis: chart.extra_config?.x_axis_column,
        y_axis: chart.extra_config?.y_axis_column,
        dimension_col: chart.extra_config?.dimension_column,
        aggregate_col: chart.extra_config?.aggregate_column,
        aggregate_func: chart.extra_config?.aggregate_function || 'sum',
        extra_dimension: chart.extra_config?.extra_dimension_column,
        metrics: chart.extra_config?.metrics,
        extra_config: {
          filters: [...(chart.extra_config?.filters || []), ...formattedFilters],
          pagination: chart.extra_config?.pagination,
          sort: chart.extra_config?.sort,
        },
        // Remove dashboard_filters since we're using filters in extra_config now
      };
    }
    return null;
  }, [chart, resolvedDashboardFilters, chartId]);

  const {
    data: tableData,
    error: tableError,
    isLoading: tableLoading,
    mutate: mutateTableData,
  } = useChartDataPreview(chartDataPayload, 1, 50);

  // Compute derived state
  const isLoading =
    chartLoading ||
    (chart?.chart_type === 'table'
      ? tableLoading
      : isMapChart
        ? mapLoading || geojsonLoading
        : dataLoading);
  const isError =
    chartError ||
    (chart?.chart_type === 'table'
      ? tableError
      : isMapChart
        ? mapError || geojsonError
        : dataError);

  // Get the actual error message
  const errorMessage =
    chartFetchError?.message ||
    (chart?.chart_type === 'table'
      ? tableError?.message
      : isMapChart
        ? mapError?.message || geojsonError?.message
        : dataError?.message) ||
    'Chart configuration needs adjustment';

  // Handle region click for drill-down - EXACT COPY FROM WORKING VIEW MODE
  const handleRegionClick = (regionName: string, regionData: any) => {
    if (chart?.chart_type !== 'map') return;

    // Check for dynamic drill-down configuration (new system)
    const hasDynamicDrillDown =
      chart?.extra_config?.geographic_hierarchy?.drill_down_levels?.length > 0;

    // NEW DYNAMIC SYSTEM: Use geographic hierarchy
    if (hasDynamicDrillDown) {
      const hierarchy = chart.extra_config.geographic_hierarchy;
      const nextLevel = hierarchy.drill_down_levels.find(
        (level: any) => level.level === currentLevel + 1
      );

      if (nextLevel) {
        // Find the clicked region in the regions data
        const selectedRegion = regions?.find(
          (region: any) => region.name === regionName || region.display_name === regionName
        );

        if (!selectedRegion) {
          toast.error(`Region "${regionName}" not found in database`);
          return;
        }

        toast.success(`Drilling down to ${nextLevel.label.toLowerCase()} in ${regionName}`);

        // Create drill-down level for dynamic system
        const newLevel: DrillDownLevel = {
          level: currentLevel + 1,
          name: regionName,
          geographic_column: nextLevel.column,
          geojson_id: 0, // Will be resolved dynamically
          region_id: selectedRegion.id,
          parent_selections: [
            ...drillDownPath.flatMap((level) => level.parent_selections),
            {
              column: activeGeographicColumn || '',
              value: regionName,
            },
          ],
        };

        setDrillDownPath([...drillDownPath, newLevel]);
        return;
      } else {
        // No more levels available in dynamic system
        toast.info('No further drill-down levels configured');
        return;
      }
    }

    // Check for legacy simplified drill-down configuration
    const hasSimplifiedDrillDown =
      chart?.extra_config?.district_column ||
      chart?.extra_config?.ward_column ||
      chart?.extra_config?.subward_column;

    if (hasSimplifiedDrillDown) {
      let nextGeographicColumn = null;
      let levelName = '';

      // Determine next level based on current drill-down state
      if (currentLevel === 0 && chart.extra_config.district_column) {
        nextGeographicColumn = chart.extra_config.district_column;
        levelName = 'districts';
      } else if (currentLevel === 1 && chart.extra_config.ward_column) {
        nextGeographicColumn = chart.extra_config.ward_column;
        levelName = 'wards';
      } else if (currentLevel === 2 && chart.extra_config.subward_column) {
        nextGeographicColumn = chart.extra_config.subward_column;
        levelName = 'sub-wards';
      }

      if (nextGeographicColumn) {
        toast.success(`Drilling down to ${levelName} in ${regionName}`);

        // Find the region ID for the clicked region (e.g., Karnataka)
        const selectedRegion = regions?.find(
          (region: any) => region.name === regionName || region.display_name === regionName
        );

        if (!selectedRegion) {
          toast.error(`Region "${regionName}" not found in database`);
          return;
        }

        // Create drill-down level for simplified system
        const newLevel: DrillDownLevel = {
          level: currentLevel + 1,
          name: regionName,
          geographic_column: nextGeographicColumn,
          geojson_id: 0, // Will be resolved dynamically
          region_id: selectedRegion.id,
          parent_selections: [
            ...drillDownPath.flatMap((level) => level.parent_selections),
            {
              column: activeGeographicColumn || '',
              value: regionName,
            },
          ],
        };

        setDrillDownPath([...drillDownPath, newLevel]);
        return;
      }
    }

    // No drill-down configuration found
    toast.info('No drill-down configuration found for this chart');
  };

  // Handle drill up to a specific level
  const handleDrillUp = (targetLevel: number) => {
    if (targetLevel < 0) {
      setDrillDownPath([]);
    } else {
      setDrillDownPath(drillDownPath.slice(0, targetLevel + 1));
    }
  };

  // Handle drill to home (first level)
  const handleDrillHome = () => {
    setDrillDownPath([]);
  };

  // Force refetch when filters change
  useEffect(() => {
    if (Object.keys(appliedFilters).length > 0) {
      mutateChartData();
    }
  }, [appliedFilters, mutateChartData, chartId]);

  // Force refetch for map data when filters change (same behavior as regular charts)
  useEffect(() => {
    if (isMapChart && Object.keys(appliedFilters).length > 0 && mutateMapData) {
      mutateMapData();
    }
  }, [appliedFilters, mutateMapData, chartId, isMapChart]);

  // Force refetch for table data when filters change
  useEffect(() => {
    if (
      chart?.chart_type === 'table' &&
      Object.keys(appliedFilters).length > 0 &&
      mutateTableData
    ) {
      mutateTableData();
    }
  }, [appliedFilters, mutateTableData, chartId, chart?.chart_type]);

  // Debug logging
  useEffect(() => {
    // Chart config availability check
  }, [chart, chartData, chartId, appliedFilters]);

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
      // Disable ECharts internal title since we use HTML titles
      const modifiedConfig = {
        ...chartConfig,
        title: {
          ...(chartConfig.title || {}),
          show: false, // Disable ECharts built-in title
        },
      };

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
    drillDownPath,
    handleRegionClick,
  ]); // Update when data or filters change

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
  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimeoutId: NodeJS.Timeout | null = null;

    if (chartRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver((entries) => {
        // Clear any pending resize
        if (resizeTimeoutId) {
          clearTimeout(resizeTimeoutId);
        }

        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            // Debounce rapid resize events
            resizeTimeoutId = setTimeout(() => {
              if (chartInstance.current) {
                // Constrain dimensions to ensure chart fits within bounds
                const maxWidth = Math.floor(width);
                const maxHeight = Math.floor(height);

                // Force explicit resize with constrained dimensions
                chartInstance.current.resize({
                  width: maxWidth,
                  height: maxHeight,
                });

                // Force chart to redraw and refit content
                const currentOption = chartInstance.current.getOption();
                chartInstance.current.setOption(currentOption, {
                  notMerge: false,
                  lazyUpdate: false,
                });

                // Additional resize call to ensure proper fitting
                setTimeout(() => {
                  if (chartInstance.current) {
                    chartInstance.current.resize();
                  }
                }, 50);
              }
            }, 50); // Even faster response for browser zoom
          }
        }
      });

      resizeObserver.observe(chartRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
    };
  }, []); // No dependencies to avoid re-creating observer

  // Handle resize when isResizing prop changes
  useEffect(() => {
    if (!isResizing && chartInstance.current && chartRef.current) {
      // Clear any pending resize
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      // Perform final resize after drag/resize stops
      resizeTimeoutRef.current = setTimeout(() => {
        if (chartInstance.current && chartRef.current) {
          const { width, height } = chartRef.current.getBoundingClientRect();
          chartInstance.current.resize({
            width: Math.floor(width),
            height: Math.floor(height),
          });
        }
      }, 300); // Slightly longer delay for final resize
    }

    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [isResizing]);

  return (
    <div className="h-full w-full relative">
      {/* Action buttons moved to dashboard level for proper drag-cancel behavior */}
      <Card className="h-full w-full flex flex-col">
        <CardContent className="p-4 flex-1 flex flex-col min-h-0">
          {/* Chart Title Editor */}
          <ChartTitleEditor
            chartData={chart}
            config={config}
            onTitleChange={handleTitleChange}
            isEditMode={isEditMode}
            className="flex-shrink-0"
          />

          {/* Drill-down navigation for maps */}
          {isMapChart && drillDownPath.length > 0 && (
            <div className="px-2 py-1 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-1 text-xs">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDrillHome}
                  className="h-6 px-2 text-xs"
                  title="Go to top level"
                >
                  <Home className="h-3 w-3 mr-1" />
                  Home
                </Button>
                {drillDownPath.map((level, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <span className="text-gray-400">/</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDrillUp(index - 1)}
                      className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800"
                    >
                      {level.name}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chart Content */}
          <div className="flex-1 w-full h-full">
            {isLoading ? (
              <div className="relative w-full h-full min-h-[300px]">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    <p className="text-sm text-muted-foreground">
                      {chart?.chart_type === 'table'
                        ? 'Loading table data...'
                        : chart?.chart_type === 'map'
                          ? 'Loading map...'
                          : 'Loading chart...'}
                    </p>
                  </div>
                </div>
              </div>
            ) : isError ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-4">
                  <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                  <p className="text-sm text-destructive">Chart Error</p>
                  <p className="text-xs text-muted-foreground mt-1">{errorMessage}</p>
                </div>
              </div>
            ) : chart?.chart_type === 'table' ? (
              <DataPreview
                data={Array.isArray(tableData?.data) ? tableData.data : []}
                columns={tableData?.columns || []}
                columnTypes={tableData?.column_types || {}}
                isLoading={tableLoading}
                error={tableError}
              />
            ) : chart?.chart_type === 'map' ? (
              <MapPreview
                geojsonData={geojsonData?.geojson_data}
                geojsonLoading={geojsonLoading}
                geojsonError={geojsonError}
                mapData={mapDataOverlay?.data}
                mapDataLoading={mapLoading}
                mapDataError={mapError}
                title=""
                valueColumn={chart?.extra_config?.aggregate_column}
                onRegionClick={handleRegionClick}
                drillDownPath={drillDownPath}
                onDrillUp={handleDrillUp}
                onDrillHome={handleDrillHome}
                showBreadcrumbs={false}
                isResizing={isResizing}
              />
            ) : (
              <div ref={chartRef} className="w-full h-full chart-container" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
