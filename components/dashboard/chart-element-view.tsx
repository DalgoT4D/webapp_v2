'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  AlertCircle,
  RefreshCw,
  Maximize2,
  Download,
  Home,
  Loader2,
  FileImage,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import { apiGet, apiPost } from '@/lib/api';
import {
  useChart,
  useChartDataPreview,
  useChartDataPreviewTotalRows,
  useMapDataOverlay,
  useGeoJSONData,
  useRegions,
  useRegionGeoJSONs,
} from '@/hooks/api/useChart';
import { ChartTitleEditor } from './chart-title-editor';
import { DataPreview } from '@/components/charts/DataPreview';
import { TableChart } from '@/components/charts/TableChart';
import { MapPreview } from '@/components/charts/map/MapPreview';
import { type ChartTitleConfig } from '@/lib/chart-title-utils';
import { resolveDashboardFilters, formatAsChartFilters } from '@/lib/dashboard-filter-utils';
import {
  applyLegendPosition,
  extractLegendPosition,
  isLegendPaginated,
  type LegendPosition,
} from '@/lib/chart-legend-utils';
import type { ChartDataPayload } from '@/types/charts';
import { useFullscreen } from '@/hooks/useFullscreen';
import { ChartExporter, generateFilename } from '@/lib/chart-export';
import { apiPostBinary } from '@/lib/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import * as echarts from 'echarts/core';
import {
  BarChart,
  LineChart,
  PieChart,
  GaugeChart,
  ScatterChart,
  HeatmapChart,
  MapChart,
} from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  ToolboxComponent,
  DataZoomComponent,
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
  HeatmapChart,
  MapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  ToolboxComponent,
  DataZoomComponent,
  VisualMapComponent,
  GeoComponent,
  CanvasRenderer,
]);

interface ChartElementViewProps {
  chartId: number;
  dashboardFilters?: Record<string, any>;
  dashboardFilterConfigs?: Array<{
    id: string;
    name: string;
    schema_name: string;
    table_name: string;
    column_name: string;
    filter_type: 'value' | 'numerical' | 'datetime';
    settings?: any;
  }>; // Dashboard filter configurations for resolution
  viewMode?: boolean;
  className?: string;
  isPublicMode?: boolean;
  publicToken?: string; // Required when isPublicMode=true
  config?: ChartTitleConfig; // For dashboard title configuration
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

export function ChartElementView({
  chartId,
  dashboardFilters = {},
  dashboardFilterConfigs = [],
  viewMode = true,
  className,
  isPublicMode = false,
  publicToken,
  config = {},
}: ChartElementViewProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null); // Separate ref for table charts
  const wrapperRef = useRef<HTMLDivElement>(null); // Wrapper ref for fullscreen (stable element)
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const mapChartInstance = useRef<echarts.ECharts | null>(null); // Separate ref for map charts
  const [drillDownPath, setDrillDownPath] = useState<DrillDownLevel[]>([]);

  // Table pagination state
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(20);

  // Use unified fullscreen hook
  const { isFullscreen, toggleFullscreen } = useFullscreen('chart');

  // Fetch regions data - use public API for public mode, private API for private mode
  const { data: privateRegions } = useRegions(!isPublicMode ? 'IND' : null, 'state');

  // Use public regions API for public mode
  const publicRegionsUrl =
    isPublicMode && publicToken
      ? `/api/v1/public/regions/?country_code=IND&region_type=state`
      : null;

  const { data: publicRegions } = useSWR(publicRegionsUrl, async (url: string) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`);
    if (!response.ok) {
      throw new Error('Failed to fetch public regions');
    }
    return response.json();
  });

  const regions = isPublicMode ? publicRegions : privateRegions;

  // Fetch chart metadata to determine chart type (only in authenticated mode)
  const {
    data: chart,
    isLoading: chartLoading,
    isError: chartError,
    error: chartFetchError,
  } = useChart(isPublicMode ? null : chartId);

  // Resolve dashboard filters to complete column information for maps and tables
  const resolvedDashboardFilters = useMemo(() => {
    if (Object.keys(dashboardFilters).length === 0 || dashboardFilterConfigs.length === 0) {
      return [];
    }
    return resolveDashboardFilters(dashboardFilters, dashboardFilterConfigs);
  }, [dashboardFilters, dashboardFilterConfigs]);

  // Create a unique identifier for when filters change to trigger instance recreation
  const filterHash = useMemo(() => JSON.stringify(dashboardFilters), [dashboardFilters]);
  const previousFilterHash = useRef<string>(filterHash);

  // Build query params with filters
  const queryParams = new URLSearchParams();
  if (Object.keys(dashboardFilters).length > 0) {
    queryParams.append('dashboard_filters', JSON.stringify(dashboardFilters));
  }

  // Use public API endpoint if in public mode, otherwise use regular API
  const apiUrl =
    isPublicMode && publicToken
      ? `/api/v1/public/dashboards/${publicToken}/charts/${chartId}/data${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      : `/api/charts/${chartId}/data/${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  // Custom fetcher for public mode
  const fetcher = isPublicMode
    ? async (url: string) => {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`);
        if (!response.ok) {
          throw new Error('Failed to fetch chart data');
        }
        const data = await response.json();
        return data;
      }
    : apiGet;

  // Fetch chart metadata - public vs private mode
  const publicChartMetadataUrl =
    isPublicMode && publicToken
      ? `/api/v1/public/dashboards/${publicToken}/charts/${chartId}/`
      : null;

  const {
    data: publicChartMetadata,
    error: publicChartError,
    isLoading: publicChartLoading,
  } = useSWR(
    publicChartMetadataUrl,
    isPublicMode
      ? async (url: string) => {
          const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.json();
        }
      : null,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0,
    }
  );

  // Private mode metadata
  const { data: chartMetadata, error: metadataError } = useSWR(
    !isPublicMode ? `/api/charts/${chartId}` : null,
    apiGet,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0,
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
    }
  );

  // Use public chart metadata when in public mode, chart when in private mode
  const effectiveChart = isPublicMode ? publicChartMetadata : chart;

  // Determine chart type using effective chart
  const isTableChart = effectiveChart?.chart_type === 'table';
  const isMapChart = effectiveChart?.chart_type === 'map';
  const isPieChart = effectiveChart?.chart_type === 'pie';
  const isNumberChart = effectiveChart?.chart_type === 'number';

  // Fetch chart data with filters (skip for map and table charts - they use specialized endpoints)
  // Only fetch when we know the chart type and it's not a map or table
  const shouldFetchChartData = effectiveChart
    ? effectiveChart.chart_type !== 'map' && effectiveChart.chart_type !== 'table'
    : false;
  const {
    data: chartData,
    isLoading,
    error: isError,
    mutate,
  } = useSWR(shouldFetchChartData ? apiUrl : null, fetcher, {
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
      console.error('Error fetching chart data:', error);
    },
  });

  // Determine current level for drill-down
  const currentLevel = drillDownPath.length;
  const currentLayer =
    effectiveChart?.chart_type === 'map' && effectiveChart?.extra_config?.layers
      ? effectiveChart.extra_config.layers[currentLevel]
      : null;

  // Build chartDataPayload for ALL chart types (for CSV export and table data)
  const chartDataPayload: ChartDataPayload | null = effectiveChart
    ? {
        chart_type: effectiveChart.chart_type,
        computation_type: effectiveChart.computation_type as 'raw' | 'aggregated',
        schema_name: effectiveChart.schema_name,
        table_name: effectiveChart.table_name,
        x_axis: effectiveChart.extra_config?.x_axis_column,
        y_axis: effectiveChart.extra_config?.y_axis_column,
        // For map charts, use geographic_column as dimension_col
        dimension_col:
          effectiveChart.chart_type === 'map'
            ? effectiveChart.extra_config?.geographic_column
            : effectiveChart.extra_config?.dimension_column,
        // For map charts, use value_column or aggregate_column
        aggregate_col:
          effectiveChart.chart_type === 'map'
            ? effectiveChart.extra_config?.value_column ||
              effectiveChart.extra_config?.aggregate_column
            : effectiveChart.extra_config?.aggregate_column,
        aggregate_func: effectiveChart.extra_config?.aggregate_function || 'sum',
        extra_dimension: effectiveChart.extra_config?.extra_dimension_column,
        metrics: effectiveChart.extra_config?.metrics,
        geographic_column: effectiveChart.extra_config?.geographic_column,
        value_column: effectiveChart.extra_config?.value_column,
        selected_geojson_id: effectiveChart.extra_config?.selected_geojson_id,
        customizations: effectiveChart.extra_config?.customizations,
        extra_config: {
          filters: [
            // Include chart-level filters
            ...(effectiveChart.extra_config?.filters || []),
            // Include resolved dashboard filters for all chart types
            ...formatAsChartFilters(
              resolvedDashboardFilters.filter(
                (filter) =>
                  filter.schema_name === effectiveChart.schema_name &&
                  filter.table_name === effectiveChart.table_name
              )
            ),
          ],
          pagination: effectiveChart.extra_config?.pagination,
          sort: effectiveChart.extra_config?.sort,
        },
        // Dashboard filters passed separately
        dashboard_filters:
          Object.keys(dashboardFilters).length > 0
            ? Object.entries(dashboardFilters).map(([filter_id, value]) => ({
                filter_id,
                value,
              }))
            : undefined,
      }
    : null;

  // For table charts - public vs private mode
  const publicTableDataUrl =
    isPublicMode && publicToken && chartDataPayload && isTableChart
      ? `/api/v1/public/dashboards/${publicToken}/charts/${chartId}/data-preview/`
      : null;

  const {
    data: publicTableData,
    error: publicTableError,
    isLoading: publicTableLoading,
  } = useSWR(
    publicTableDataUrl
      ? [publicTableDataUrl, chartDataPayload, tablePage, tablePageSize, dashboardFilters]
      : null,
    isPublicMode && isTableChart
      ? async ([url, payload, page, size, filters]: [
          string,
          ChartDataPayload,
          number,
          number,
          Record<string, any>,
        ]) => {
          // Send page and limit as query parameters (0-based page for backend)
          const queryParams = new URLSearchParams({
            page: (page - 1).toString(),
            limit: size.toString(),
          });

          // Add dashboard filters if present
          if (Object.keys(filters).length > 0) {
            queryParams.append('dashboard_filters', JSON.stringify(filters));
          }

          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001'}${url}?${queryParams}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }
          );
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          return response.json();
        }
      : null,
    { revalidateOnFocus: false, revalidateOnReconnect: false, refreshInterval: 0 }
  );

  // Private mode table data
  const {
    data: privateTableData,
    error: privateTableError,
    isLoading: privateTableLoading,
  } = useChartDataPreview(
    !isPublicMode ? chartDataPayload : null,
    tablePage,
    tablePageSize,
    dashboardFilters
  );

  // Get total rows for table pagination (private mode)
  const { data: privateTableTotalRows } = useChartDataPreviewTotalRows(
    !isPublicMode ? chartDataPayload : null,
    dashboardFilters
  );

  // Get total rows for table pagination (public mode) - POST call like data-preview
  const publicTableTotalRowsUrl =
    isPublicMode && publicToken && chartDataPayload && isTableChart
      ? `/api/v1/public/dashboards/${publicToken}/charts/${chartId}/data-preview/total-rows/`
      : null;

  const { data: publicTableTotalRowsData } = useSWR(
    publicTableTotalRowsUrl ? [publicTableTotalRowsUrl, chartDataPayload, dashboardFilters] : null,
    isPublicMode && isTableChart
      ? async ([url, payload, filters]: [string, ChartDataPayload, Record<string, any>]) => {
          // Add dashboard filters as query parameters if present
          const queryParams = new URLSearchParams();
          if (Object.keys(filters).length > 0) {
            queryParams.append('dashboard_filters', JSON.stringify(filters));
          }

          const finalUrl = queryParams.toString()
            ? `${process.env.NEXT_PUBLIC_BACKEND_URL}${url}?${queryParams}`
            : `${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`;

          const response = await fetch(finalUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          return response.json();
        }
      : null,
    { revalidateOnFocus: false, revalidateOnReconnect: false, refreshInterval: 0 }
  );

  const publicTableTotalRows = publicTableTotalRowsData?.total_rows;

  // Handle table pagination page size change
  const handleTablePageSizeChange = (newPageSize: number) => {
    setTablePageSize(newPageSize);
    setTablePage(1); // Reset to first page when page size changes
  };

  // Use appropriate table data based on mode
  const tableData = isPublicMode ? publicTableData : privateTableData;
  const tableError = isPublicMode ? publicTableError : privateTableError;
  const tableLoading = isPublicMode ? publicTableLoading : privateTableLoading;

  // Get the current drill-down region ID for dynamic geojson fetching
  const currentDrillDownRegionId =
    drillDownPath.length > 0 ? drillDownPath[drillDownPath.length - 1].region_id : null;

  // Fetch geojsons for the current drill-down region - use public API for public mode
  const { data: privateRegionGeojsons } = useRegionGeoJSONs(
    !isPublicMode ? currentDrillDownRegionId : null
  );

  // Use public geojsons API for public mode
  const publicGeojsonsUrl =
    isPublicMode && publicToken && currentDrillDownRegionId
      ? `/api/v1/public/regions/${currentDrillDownRegionId}/geojsons/`
      : null;

  const { data: publicRegionGeojsons } = useSWR(publicGeojsonsUrl, async (url: string) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`);
    if (!response.ok) {
      throw new Error('Failed to fetch public geojsons');
    }
    return response.json();
  });

  const regionGeojsons = isPublicMode ? publicRegionGeojsons : privateRegionGeojsons;

  // For map charts, determine which geojson and data to fetch based on drill-down state
  let activeGeojsonId = null;
  let activeGeographicColumn = null;

  if (effectiveChart?.chart_type === 'map') {
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
      const firstLayer = effectiveChart.extra_config?.layers?.[0];
      activeGeojsonId = firstLayer?.geojson_id || effectiveChart.extra_config?.selected_geojson_id;
      activeGeographicColumn =
        firstLayer?.geographic_column || effectiveChart.extra_config?.geographic_column;
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
    return effectiveChart?.chart_type === 'map' &&
      effectiveChart.extra_config &&
      activeGeographicColumn
      ? {
          schema_name: effectiveChart.schema_name,
          table_name: effectiveChart.table_name,
          geographic_column: activeGeographicColumn,
          value_column:
            effectiveChart.extra_config.aggregate_column ||
            effectiveChart.extra_config.value_column,
          aggregate_function: effectiveChart.extra_config.aggregate_function || 'sum',
          filters: filters, // Drill-down filters
          // Send dashboardFilters directly as dashboard_filters (dict format)
          dashboard_filters: dashboardFilters,
          // Chart-level filters go in extra_config.filters
          extra_config: {
            filters: effectiveChart.extra_config.filters || [], // Chart-level filters only
            pagination: effectiveChart.extra_config.pagination,
            sort: effectiveChart.extra_config.sort,
          },
        }
      : null;
  }, [
    effectiveChart?.chart_type,
    effectiveChart?.schema_name,
    effectiveChart?.table_name,
    effectiveChart?.extra_config,
    activeGeographicColumn,
    filters,
    dashboardFilters, // Use raw dashboardFilters (filter_id -> value mapping)
  ]);

  // Fetch GeoJSON data - public vs private mode
  const publicGeojsonUrl =
    isPublicMode && publicToken && activeGeojsonId && isMapChart
      ? `/api/v1/public/geojsons/${activeGeojsonId}/`
      : null;

  const {
    data: publicGeojsonData,
    error: publicGeojsonError,
    isLoading: publicGeojsonLoading,
  } = useSWR(
    publicGeojsonUrl,
    isPublicMode && isMapChart
      ? async (url: string) => {
          const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`);
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          return response.json();
        }
      : null,
    { revalidateOnFocus: false, revalidateOnReconnect: false, refreshInterval: 0 }
  );

  // Private mode geojson data
  const {
    data: privateGeojsonData,
    error: privateGeojsonError,
    isLoading: privateGeojsonLoading,
  } = useGeoJSONData(!isPublicMode ? activeGeojsonId : null);

  // Use appropriate geojson data based on mode
  const geojsonData = isPublicMode ? publicGeojsonData : privateGeojsonData;
  const geojsonError = isPublicMode ? publicGeojsonError : privateGeojsonError;
  const geojsonLoading = isPublicMode ? publicGeojsonLoading : privateGeojsonLoading;

  // Fetch map data overlay - public vs private mode
  const publicMapDataUrl =
    isPublicMode && publicToken && mapDataOverlayPayload && isMapChart
      ? `/api/v1/public/dashboards/${publicToken}/charts/${chartId}/map-data/`
      : null;

  const {
    data: publicMapData,
    error: publicMapError,
    isLoading: publicMapLoading,
    mutate: mutatePublicMapData,
  } = useSWR(
    publicMapDataUrl ? [publicMapDataUrl, JSON.stringify(mapDataOverlayPayload)] : null,
    isPublicMode && isMapChart
      ? async (key: string | [string, string]) => {
          const url = Array.isArray(key) ? key[0] : key;
          const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mapDataOverlayPayload),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          return response.json();
        }
      : null,
    { revalidateOnFocus: false, revalidateOnReconnect: false, refreshInterval: 0 }
  );

  // Private mode map data
  const {
    data: privateMapDataOverlay,
    error: privateMapError,
    isLoading: privateMapLoading,
    mutate: mutatePrivateMapData,
  } = useMapDataOverlay(!isPublicMode ? mapDataOverlayPayload : null);

  // Use appropriate map data based on mode
  const mapDataOverlay = isPublicMode ? publicMapData : privateMapDataOverlay;
  const mapError = isPublicMode ? publicMapError : privateMapError;
  const mapLoading = isPublicMode ? publicMapLoading : privateMapLoading;
  const mutateMapData = isPublicMode ? mutatePublicMapData : mutatePrivateMapData;

  // Get the actual error message with improved messaging
  const rawErrorMessage =
    metadataError?.message ||
    (isTableChart
      ? tableError?.message
      : isMapChart
        ? mapError?.message || geojsonError?.message
        : isError?.message) ||
    'Chart configuration needs adjustment';

  // Determine if this is a data-related error and provide helpful message
  const isDataError =
    rawErrorMessage.toLowerCase().includes('data') ||
    rawErrorMessage.toLowerCase().includes('column') ||
    rawErrorMessage.toLowerCase().includes('metric') ||
    rawErrorMessage.toLowerCase().includes('dimension') ||
    rawErrorMessage.toLowerCase().includes('aggregate') ||
    rawErrorMessage.toLowerCase().includes('no rows') ||
    rawErrorMessage.toLowerCase().includes('empty result');

  const errorMessage = isDataError
    ? 'Please check the dataset or metrics selected and try again'
    : 'Chart configuration needs adjustment. Please review your settings and try again';

  // Handle region click for drill-down
  const handleRegionClick = (regionName: string, regionData: any) => {
    if (effectiveChart.chart_type !== 'map') return;

    // Check for dynamic drill-down configuration (new system)
    const hasDynamicDrillDown =
      effectiveChart?.extra_config?.geographic_hierarchy?.drill_down_levels?.length > 0;

    // NEW DYNAMIC SYSTEM: Use geographic hierarchy
    if (hasDynamicDrillDown) {
      const hierarchy = effectiveChart.extra_config.geographic_hierarchy;
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
      if (currentLevel === 0 && effectiveChart.extra_config.district_column) {
        nextGeographicColumn = effectiveChart.extra_config.district_column;
        levelName = 'districts';
      } else if (currentLevel === 1 && effectiveChart.extra_config.ward_column) {
        nextGeographicColumn = effectiveChart.extra_config.ward_column;
        levelName = 'wards';
      } else if (currentLevel === 2 && effectiveChart.extra_config.subward_column) {
        nextGeographicColumn = effectiveChart.extra_config.subward_column;
        levelName = 'sub-wards';
      }

      if (nextGeographicColumn) {
        toast.success(`Drilling down to ${levelName} in ${regionName}`);

        // Create drill-down level for simplified system
        // Find the region ID for the clicked region (e.g., Karnataka)
        const selectedRegion = regions?.find(
          (region: any) => region.name === regionName || region.display_name === regionName
        );

        if (!selectedRegion) {
          toast.error(`Region "${regionName}" not found in database`);
          return;
        }

        // For now, we'll create the drill-down level and let the useRegionGeoJSONs
        // hook handle fetching the correct geojson in the data fetching logic
        const regionId = selectedRegion.id;
        console.log(`🔍 Found region "${regionName}" with ID: ${regionId}`);

        const newLevel: DrillDownLevel = {
          level: currentLevel + 1,
          name: regionName,
          geographic_column: nextGeographicColumn,
          geojson_id: 0, // Will be resolved dynamically
          region_id: regionId, // Store the region ID for geojson lookup
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
        // No more levels available in simplified system
        toast.info('No further drill-down levels configured');
        return;
      }
    }

    // Fallback to legacy layers system
    if (!chart?.extra_config?.layers) {
      toast.info('No further drill-down levels configured');
      return;
    }

    const nextLevel = currentLevel + 1;
    const nextLayer = effectiveChart.extra_config.layers[nextLevel];

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

    // Get base config (already includes map registration for map charts)
    let baseConfig = activeChartData.echarts_config;

    // Extract legend position from chart's customizations
    const customizations = chart?.extra_config?.customizations || {};
    const legendPosition = extractLegendPosition(customizations, baseConfig) as LegendPosition;
    const isPaginatedLegend = isLegendPaginated(customizations);

    // Apply legend positioning (handles both legend config and pie chart center adjustment)
    const configWithLegend = baseConfig.legend
      ? applyLegendPosition(baseConfig, legendPosition, isPaginatedLegend, chart?.chart_type)
      : baseConfig;

    // Apply beautiful theme and styling
    const styledConfig = {
      ...configWithLegend,
      // Disable ECharts internal title since we use HTML titles
      title: {
        ...activeChartData.echarts_config.title,
        show: false,
      },
      animation: true,
      animationDuration: 500,
      animationEasing: 'cubicOut',
      textStyle: {
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      // Enhanced data labels styling (preserve pie chart center from configWithLegend)
      series: Array.isArray(configWithLegend.series)
        ? configWithLegend.series.map((series: any) => ({
            ...series,
            label: {
              ...series.label,
              fontSize: series.label?.fontSize ? series.label.fontSize + 0.5 : 12.5,
              fontFamily: 'Inter, system-ui, sans-serif',
              fontWeight: 'normal',
            },
          }))
        : configWithLegend.series
          ? {
              ...configWithLegend.series,
              label: {
                ...configWithLegend.series.label,
                fontSize: configWithLegend.series.label?.fontSize
                  ? configWithLegend.series.label.fontSize + 0.5
                  : 12.5,
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: 'normal',
              },
            }
          : undefined,
      // Only set default colors if chart doesn't have custom colors
      ...(baseConfig.color
        ? {}
        : {
            color: [
              '#3b82f6', // blue-500
              '#10b981', // emerald-500
              '#f59e0b', // amber-500
              '#ef4444', // red-500
              '#8b5cf6', // violet-500
              '#ec4899', // pink-500
              '#14b8a6', // teal-500
              '#f97316', // orange-500
            ],
          }),
      // For pie and number charts, completely remove grid and axis configurations
      ...(isPieChart || isNumberChart
        ? {
            // Remove grid entirely
            grid: undefined,
            // Remove axes entirely
            xAxis: undefined,
            yAxis: undefined,
          }
        : {
            // For other chart types, apply normal grid and axis styling
            // Dynamically adjust margins based on legend position and label rotation
            grid: (() => {
              const hasRotatedXLabels =
                baseConfig.xAxis?.axisLabel?.rotate !== undefined &&
                baseConfig.xAxis?.axisLabel?.rotate !== 0;
              const hasLegend = baseConfig.legend?.show !== false;

              // Adjust margins based on legend position
              let topMargin = hasLegend && legendPosition === 'top' ? '18%' : '10%';
              let bottomMargin = hasRotatedXLabels ? '18%' : '16%';
              if (hasLegend && legendPosition === 'bottom') {
                bottomMargin = hasRotatedXLabels ? '22%' : '20%';
              }
              let leftMargin = '10%';
              let rightMargin = '6%';
              if (hasLegend && legendPosition === 'left') {
                leftMargin = '18%';
              }
              if (hasLegend && legendPosition === 'right') {
                rightMargin = '15%';
              }

              return {
                ...baseConfig.grid,
                containLabel: true,
                left: leftMargin,
                bottom: bottomMargin,
                right: rightMargin,
                top: topMargin,
              };
            })(),
            xAxis: Array.isArray(baseConfig.xAxis)
              ? baseConfig.xAxis.map((axis: any) => ({
                  ...axis,
                  nameGap: axis.name ? 80 : 15,
                  nameTextStyle: {
                    fontSize: 14,
                    color: '#374151',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  },
                  axisLabel: {
                    ...axis.axisLabel,
                    interval: 0,
                    margin: 15, // Increased margin from axis line to labels
                    overflow: 'truncate',
                    width: axis.axisLabel?.rotate ? 100 : undefined,
                  },
                }))
              : baseConfig.xAxis
                ? {
                    ...baseConfig.xAxis,
                    nameGap: baseConfig.xAxis.name ? 80 : 15,
                    nameTextStyle: {
                      fontSize: 14,
                      color: '#374151',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    },
                    axisLabel: {
                      ...baseConfig.xAxis.axisLabel,
                      interval: 0,
                      margin: 15, // Increased margin from axis line to labels
                      overflow: 'truncate',
                      width: baseConfig.xAxis.axisLabel?.rotate ? 100 : undefined,
                    },
                  }
                : undefined,
            yAxis: Array.isArray(baseConfig.yAxis)
              ? baseConfig.yAxis.map((axis: any) => ({
                  ...axis,
                  nameGap: axis.name ? 100 : 15,
                  nameTextStyle: {
                    fontSize: 14,
                    color: '#374151',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  },
                  axisLabel: {
                    ...axis.axisLabel,
                    margin: 15, // Increased margin from axis line to labels
                  },
                }))
              : baseConfig.yAxis
                ? {
                    ...baseConfig.yAxis,
                    nameGap: baseConfig.yAxis.name ? 100 : 15,
                    nameTextStyle: {
                      fontSize: 14,
                      color: '#374151',
                      fontFamily: 'Inter, system-ui, sans-serif',
                    },
                    axisLabel: {
                      ...baseConfig.yAxis.axisLabel,
                      margin: 15, // Increased margin from axis line to labels
                    },
                  }
                : undefined,
          }),
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        textStyle: {
          color: '#1f2937',
          fontSize: 12,
        },
        extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);',
        formatter: function (params: any) {
          if (Array.isArray(params)) {
            // For multiple series (line/bar charts with multiple lines/bars)
            let result = '';
            params.forEach((param: any, index: number) => {
              if (index === 0) {
                result += param.name + '<br/>';
              }
              const value =
                typeof param.value === 'number' ? param.value.toLocaleString() : param.value;
              result += `${param.marker}${param.seriesName}: <b>${value}</b><br/>`;
            });
            return result;
          } else {
            // For single series (pie charts, single bar/line)
            const value =
              typeof params.value === 'number' ? params.value.toLocaleString() : params.value;
            if (params.percent !== undefined) {
              // Pie chart with percentage
              return `${params.marker}${params.seriesName}<br/><b>${value}</b>: ${params.name} (${params.percent}%)`;
            } else {
              // Regular chart
              return `${params.marker}${params.seriesName}<br/>${params.name}: <b>${value}</b>`;
            }
          }
        },
      },
    };

    // Check DOM element dimensions before setting options
    const rect = chartRef.current.getBoundingClientRect();

    try {
      // Use notMerge: true on first render after filter change, false otherwise
      const notMerge = filtersChanged || !chartInstance.current.getOption();

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

    // Resize observer for container changes
    const resizeObserver = new ResizeObserver(() => {
      chartInstance.current?.resize();
    });

    resizeObserver.observe(chartRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
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
  ]);

  // Re-fetch data when filters change
  useEffect(() => {
    mutate();
  }, [dashboardFilters, mutate, chartId]);

  // Re-fetch map data when filters change (same behavior as regular charts)
  useEffect(() => {
    if (isMapChart && mutateMapData) {
      mutateMapData();
    }
  }, [dashboardFilters, mutateMapData, chartId, isMapChart]);

  // Cleanup on unmount and when chartId changes
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [chartId]);

  const handleRefresh = () => {
    mutate();
  };

  // Handle map chart ready callback to capture the ECharts instance
  const handleMapChartReady = (chart: echarts.ECharts) => {
    mapChartInstance.current = chart;
  };

  // Original working download function for PNG/Image export
  const handleDownloadImage = async () => {
    try {
      // Handle table chart export
      if (isTableChart && tableRef.current) {
        const filename = generateFilename(chartMetadata?.title || `table-${chartId}`, 'png');
        await ChartExporter.exportTableAsImage(tableRef.current, {
          filename,
          format: 'png',
          backgroundColor: '#ffffff',
        });
        toast.success('Table downloaded successfully');
        return;
      }

      // Use the appropriate chart instance based on chart type (maps and regular charts)
      const activeChartInstance = isMapChart ? mapChartInstance.current : chartInstance.current;

      if (activeChartInstance) {
        const url = activeChartInstance.getDataURL({
          type: 'png',
          pixelRatio: 2,
          backgroundColor: '#fff',
        });
        const link = document.createElement('a');
        link.download = `${isMapChart ? 'map' : 'chart'}-${chartId}.png`;
        link.href = url;
        link.click();
        toast.success('Chart downloaded successfully');
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download. Please try again.');
    }
  };

  // New CSV export function
  const handleDownloadCSV = async () => {
    try {
      if (!chartDataPayload) {
        toast.error('Chart data is not available for CSV export');
        console.error('chartDataPayload is null');
        return;
      }

      // Skip CSV export for number charts (no meaningful data)
      if (effectiveChart?.chart_type === 'number') {
        toast.error('Number charts cannot be exported as CSV');
        return;
      }

      // Debug logging for maps
      if (effectiveChart?.chart_type === 'map') {
        console.log('Map CSV Export - Payload:', {
          chart_type: chartDataPayload.chart_type,
          dimension_col: chartDataPayload.dimension_col,
          aggregate_col: chartDataPayload.aggregate_col,
          aggregate_func: chartDataPayload.aggregate_func,
          geographic_column: chartDataPayload.geographic_column,
          value_column: chartDataPayload.value_column,
        });
      }

      toast.info('Preparing CSV download...', {
        description: 'Fetching chart data from server',
      });

      // Use appropriate endpoint based on public mode
      let blob: Blob;
      if (isPublicMode && publicToken) {
        // Public dashboard - use unauthenticated endpoint
        const publicUrl = `/api/v1/public/dashboards/${publicToken}/charts/${chartId}/download-csv/`;
        blob = await apiPostBinary(publicUrl, chartDataPayload);
      } else {
        // Authenticated dashboard - use authenticated endpoint
        blob = await apiPostBinary('/api/charts/download-csv/', chartDataPayload);
      }

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const sanitizedTitle = (chartMetadata?.title || `chart-${chartId}`)
        .replace(/[^a-z0-9]/gi, '_')
        .replace(/_+/g, '_')
        .toLowerCase();
      const csvFilename = `${sanitizedTitle}-${timestamp}.csv`;

      // Download using file-saver
      const fileSaver = await import('file-saver');
      const saveAs = fileSaver.default?.saveAs || fileSaver.saveAs || fileSaver.default;
      if (typeof saveAs !== 'function') {
        throw new Error('Failed to load file-saver library');
      }
      saveAs(blob, csvFilename);

      toast.success('CSV downloaded successfully', {
        description: `File: ${csvFilename}`,
      });
    } catch (error: any) {
      console.error('CSV download failed for chart type:', effectiveChart?.chart_type, error);
      console.error('chartDataPayload was:', chartDataPayload);
      toast.error('CSV Export Failed', {
        description: error.message || 'Failed to export chart data. Please try again.',
      });
    }
  };

  const handleToggleFullscreen = () => {
    // Use wrapper ref for stable fullscreen (prevents exit on drill down)
    // For tables, use tableRef; for all charts (including maps), use wrapperRef
    const targetRef = isTableChart ? tableRef.current : wrapperRef.current;
    if (!targetRef) return;

    toggleFullscreen(targetRef);
  };

  // Handle chart resize when fullscreen state changes
  useEffect(() => {
    // Trigger chart resize after fullscreen change
    const resizeTimer = setTimeout(() => {
      if (!isTableChart) {
        // Only resize ECharts instances, not tables
        if (chartInstance.current) {
          chartInstance.current.resize();
        }
        if (mapChartInstance.current) {
          mapChartInstance.current.resize();
        }
      }
      // Tables don't need explicit resize - they automatically adjust with CSS flexbox
    }, 100);

    return () => clearTimeout(resizeTimer);
  }, [isFullscreen, isTableChart]);

  if (
    isLoading ||
    (!isPublicMode && chartLoading) ||
    (isTableChart && tableLoading) ||
    (isMapChart && (mapLoading || geojsonLoading))
  ) {
    return (
      <div className={cn('relative w-full h-full min-h-[300px]', className)}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-sm text-muted-foreground">
              {isTableChart && tableLoading
                ? 'Loading table data...'
                : isMapChart && (mapLoading || geojsonLoading)
                  ? geojsonLoading
                    ? 'Loading map boundaries...'
                    : 'Loading map data...'
                  : 'Loading chart...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (
    isError ||
    chartError ||
    (isTableChart && tableError) ||
    (isMapChart && (mapError || geojsonError)) ||
    (!isTableChart && !isMapChart && !chartData) ||
    (isMapChart && (!mapDataOverlay || !geojsonData))
  ) {
    return (
      <div className={cn('h-full flex flex-col items-center justify-start pt-20 p-4', className)}>
        <div className="w-full max-w-md">
          <div className="flex items-center p-4 border border-red-200 rounded-lg bg-red-50 shadow-lg">
            <AlertCircle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Chart Error</p>
              <p className="text-sm text-red-700 mt-1">{errorMessage}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="mt-3 h-8 text-xs border-red-300 text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'h-full relative group flex flex-col',
        className,
        isFullscreen && '!h-screen !w-screen !bg-white p-4'
      )}
      style={{
        ...(isFullscreen && {
          backgroundColor: 'white !important',
          background: 'white !important',
        }),
      }}
    >
      {/* Chart toolbar - only visible on hover in view mode */}
      {viewMode && (
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex gap-1 bg-white/90 backdrop-blur rounded-md shadow-sm p-1">
            {/* Download dropdown with PNG and CSV options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Download">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleDownloadImage} className="cursor-pointer">
                  <FileImage className="w-4 h-4 mr-2" />
                  <span>Download as PNG</span>
                </DropdownMenuItem>
                {effectiveChart?.chart_type !== 'number' && (
                  <DropdownMenuItem onClick={handleDownloadCSV} className="cursor-pointer">
                    <FileText className="w-4 h-4 mr-2" />
                    <span>Export Data as CSV</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleFullscreen}
              className="h-7 w-7 p-0"
              title="Fullscreen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Chart Title - HTML title for better styling and interaction */}
      <div className="px-2 pt-2">
        <ChartTitleEditor
          chartData={isPublicMode ? effectiveChart : chartMetadata}
          config={config}
          onTitleChange={() => {}} // Read-only in view mode
          isEditMode={false}
        />
      </div>

      {/* Drill-down navigation for maps */}
      {isMapChart && drillDownPath.length > 0 && (
        <div className="px-2 py-1 border-b border-gray-100">
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

      {/* Chart container */}
      {isTableChart ? (
        <div
          ref={tableRef}
          className={cn(
            'w-full p-4 overflow-auto',
            isFullscreen && '!h-full !min-h-[90vh] !bg-white p-4'
          )}
          style={{
            ...(isFullscreen && {
              backgroundColor: 'white !important',
              background: 'white !important',
            }),
          }}
        >
          <TableChart
            data={Array.isArray(tableData?.data) ? tableData.data : []}
            config={{
              table_columns: tableData?.columns || [],
              column_formatting: {},
              sort: effectiveChart?.extra_config?.sort || [],
              pagination: effectiveChart?.extra_config?.pagination || {
                enabled: true,
                page_size: 20,
              },
            }}
            isLoading={tableLoading}
            error={tableError}
            pagination={
              tableData?.data?.length > 0
                ? {
                    page: tablePage,
                    pageSize: tablePageSize,
                    total: isPublicMode ? publicTableTotalRows || 0 : privateTableTotalRows || 0,
                    onPageChange: setTablePage,
                    onPageSizeChange: handleTablePageSizeChange,
                  }
                : undefined
            }
          />
        </div>
      ) : isMapChart ? (
        <div
          ref={chartRef}
          className={cn(
            'w-full flex-1 min-h-[200px]',
            isFullscreen && '!h-full !min-h-[90vh] !bg-white'
          )}
          style={{
            padding: viewMode ? '8px' : '0',
            ...(isFullscreen && {
              backgroundColor: 'white !important',
              background: 'white !important',
            }),
          }}
        >
          <MapPreview
            geojsonData={geojsonData?.geojson_data}
            geojsonLoading={geojsonLoading}
            geojsonError={geojsonError}
            mapData={mapDataOverlay?.data}
            mapDataLoading={mapLoading}
            mapDataError={mapError}
            title=""
            valueColumn={
              effectiveChart?.extra_config?.metrics?.[0]?.alias ||
              effectiveChart?.extra_config?.aggregate_column
            }
            onRegionClick={handleRegionClick}
            drillDownPath={drillDownPath}
            onDrillUp={handleDrillUp}
            onDrillHome={handleDrillHome}
            showBreadcrumbs={false}
            onChartReady={handleMapChartReady}
          />
        </div>
      ) : (
        <div
          ref={chartRef}
          className={cn(
            'w-full flex-1 min-h-[200px]',
            isFullscreen && '!h-full !min-h-[90vh] !bg-white'
          )}
          style={{
            padding: viewMode ? '8px' : '0',
            ...(isFullscreen && {
              backgroundColor: 'white !important',
              background: 'white !important',
            }),
          }}
        />
      )}
    </div>
  );
}
