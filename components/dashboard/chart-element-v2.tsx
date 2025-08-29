'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, AlertCircle, Home } from 'lucide-react';
import { useChart } from '@/hooks/api/useCharts';
import { useChartDataPreview, useMapDataOverlay, useGeoJSONData } from '@/hooks/api/useChart';
import useSWR from 'swr';
import { apiGet, apiPost } from '@/lib/api';
import { ChartTitleEditor } from './chart-title-editor';
import { DataPreview } from '@/components/charts/DataPreview';
import { MapPreview } from '@/components/charts/map/MapPreview';
import type { ChartTitleConfig } from '@/lib/chart-title-utils';
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
}: ChartElementV2Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [drillDownPath, setDrillDownPath] = useState<DrillDownLevel[]>([]);

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

  // For map charts, determine which geojson and data to fetch based on drill-down state
  let activeGeojsonId = null;
  let activeGeographicColumn = null;

  if (chart?.chart_type === 'map') {
    if (drillDownPath.length > 0) {
      // We're in a drill-down state, use the geojson from the last drill-down level
      const lastDrillDown = drillDownPath[drillDownPath.length - 1];
      activeGeojsonId = lastDrillDown.geojson_id;
      activeGeographicColumn = lastDrillDown.geographic_column;
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

  const mapDataOverlayPayload = useMemo(() => {
    return chart?.chart_type === 'map' && chart.extra_config && activeGeographicColumn
      ? {
          schema_name: chart.schema_name,
          table_name: chart.table_name,
          geographic_column: activeGeographicColumn,
          value_column: chart.extra_config.aggregate_column || chart.extra_config.value_column,
          aggregate_function: chart.extra_config.aggregate_function || 'sum',
          filters: filters, // Drill-down filters
          chart_filters: chart.extra_config.filters || [], // Chart-level filters
          dashboard_filters:
            Object.keys(appliedFilters).length > 0
              ? Object.entries(appliedFilters).map(([filterId, value]) => ({
                  filter_id: filterId,
                  value: value,
                }))
              : undefined,
          // Include full extra_config for pagination, sorting, and other features
          extra_config: {
            filters: chart.extra_config.filters || [],
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
    appliedFilters, // Critical: Include appliedFilters as dependency
  ]);

  // Debug logging for map payload
  useEffect(() => {
    if (isMapChart && mapDataOverlayPayload) {
      console.log('🗺️ ChartElementV2 Map Payload:', mapDataOverlayPayload);
    }
  }, [isMapChart, mapDataOverlayPayload]);

  // activeGeojsonId is already defined above based on drill-down state

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

  // Debug logging for API URL generation

  // Fetch chart data with filters (skip for map charts - they use map-data-overlay)
  const shouldFetchChartData = chart ? chart.chart_type !== 'map' : true;
  const {
    data: chartData,
    isLoading: dataLoading,
    error: dataError,
    mutate: mutateChartData,
  } = useSWR(shouldFetchChartData ? apiUrl : null, apiGet, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: 0, // Disable auto-refresh
    // Don't retry on 404 errors
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      // Never retry on 404
      if (error?.message?.includes('404') || error?.message?.includes('not found')) {
        return;
      }
      // Only retry up to 3 times for other errors
      if (retryCount >= 3) return;

      // Retry after 1 second
      setTimeout(() => revalidate({ retryCount }), 1000);
    },
    onSuccess: (data) => {
      // Chart data fetched successfully
    },
    onError: (error) => {
      console.error(
        '❌ Error fetching chart data for chart',
        chartId,
        'with filters:',
        appliedFilters,
        'API URL:',
        apiUrl,
        'Error:',
        error
      );
    },
  });

  // For table charts, also fetch raw data using data preview API
  const chartDataPayload: ChartDataPayload | null =
    chart?.chart_type === 'table' && chart
      ? {
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
            filters: chart.extra_config?.filters,
            pagination: chart.extra_config?.pagination,
            sort: chart.extra_config?.sort,
          },
          // Include dashboard filters in the payload
          dashboard_filters:
            Object.keys(appliedFilters).length > 0
              ? Object.entries(appliedFilters).map(([filterId, value]) => ({
                  filter_id: filterId,
                  value: value,
                }))
              : undefined,
        }
      : null;

  const {
    data: tableData,
    error: tableError,
    isLoading: tableLoading,
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
    'Failed to load chart';

  // Handle region click for drill-down
  const handleRegionClick = (regionName: string, regionData: any) => {
    if (!chart?.extra_config?.layers || chart.chart_type !== 'map') return;

    const nextLevel = currentLevel + 1;
    const nextLayer = chart.extra_config.layers[nextLevel];

    if (!nextLayer) {
      // No next layer configured
      toast.info('No further drill-down levels configured');
      return;
    }

    // Validate drill-down is possible for the clicked region
    let nextGeojsonId = nextLayer.geojson_id;
    let regionSupported = true;
    let validationMessage = '';

    // If this layer has specific regions configured, check if clicked region is supported
    if (nextLayer.selected_regions && nextLayer.selected_regions.length > 0) {
      const matchingRegion = nextLayer.selected_regions.find(
        (region: any) => region.region_name === regionName
      );

      if (!matchingRegion) {
        regionSupported = false;
        validationMessage = `Drill-down not available for "${regionName}". This region is not configured for the next level.`;
      } else if (matchingRegion.geojson_id) {
        nextGeojsonId = matchingRegion.geojson_id;
      }
    }

    // Validate that we have a valid geojson_id
    if (regionSupported && (!nextGeojsonId || nextGeojsonId === 0)) {
      regionSupported = false;
      validationMessage = `Drill-down not available for "${regionName}". Geographic data is not configured for this region.`;
    }

    // If region is not supported, show toast and exit
    if (!regionSupported) {
      toast.info(validationMessage);
      return;
    }

    // Create new drill-down level
    const newLevel: DrillDownLevel = {
      level: nextLevel,
      name: regionName,
      geographic_column: nextLayer.geographic_column || '',
      geojson_id: nextGeojsonId || 0,
      region_id: nextLayer.region_id,
      parent_selections: [
        ...drillDownPath.flatMap((level) => level.parent_selections),
        {
          column: activeGeographicColumn || '',
          value: regionName,
        },
      ],
    };

    setDrillDownPath([...drillDownPath, newLevel]);
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
      {isEditMode && (
        <div className="absolute -top-2 -right-2 z-10">
          <button
            onClick={onRemove}
            className="p-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all"
            title="Remove chart"
          >
            <X className="w-3 h-3 text-gray-600 hover:text-red-600" />
          </button>
        </div>
      )}
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
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-xs text-muted-foreground">Loading chart...</p>
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
