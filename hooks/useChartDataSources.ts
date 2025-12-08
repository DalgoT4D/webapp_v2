import { useMemo } from 'react';
import {
  useChartData,
  useChartDataPreview,
  useChartDataPreviewTotalRows,
  useGeoJSONData,
  useMapDataOverlay,
  useRawTableData,
  useTableCount,
  useColumns,
} from '@/hooks/api/useChart';
import { buildChartDataPayload } from '@/lib/chart-validation';
import type { ChartBuilderFormData, ChartDataPayload } from '@/types/charts';
import type { DrillDownLevel } from './useMapDrillDown';

export interface PaginationState {
  page: number;
  pageSize: number;
}

export interface UseChartDataSourcesParams {
  formData: ChartBuilderFormData;
  drillDownPath: DrillDownLevel[];
  drillDownFilters: Record<string, string>;
  currentGeojsonId: number | null;
  dataPreviewPagination: PaginationState;
  rawDataPagination: PaginationState;
  tableChartPagination: PaginationState;
}

export interface ChartDataSource<T> {
  data: T | undefined;
  error: any;
  isLoading: boolean;
}

export interface UseChartDataSourcesReturn {
  // Computed payload
  chartDataPayload: ChartDataPayload | null;

  // Chart preview data
  chartData: ChartDataSource<any>;

  // Map data
  geojsonData: ChartDataSource<any>;
  mapDataOverlay: ChartDataSource<any>;

  // Table chart data
  tableChartData: ChartDataSource<any>;
  tableChartTotalRows: number;

  // Chart data preview (for DATA tab)
  dataPreview: ChartDataSource<any>;
  chartDataTotalRows: number;

  // Raw table data
  rawTableData: ChartDataSource<any>;
  tableCount: any;

  // Column metadata
  columns: any;
}

/**
 * Hook that consolidates all chart data fetching.
 * Handles chart preview, map data, table data, and raw data.
 */
export function useChartDataSources({
  formData,
  drillDownPath,
  drillDownFilters,
  currentGeojsonId,
  dataPreviewPagination,
  rawDataPagination,
  tableChartPagination,
}: UseChartDataSourcesParams): UseChartDataSourcesReturn {
  // Build payload for chart data
  const chartDataPayload: ChartDataPayload | null = buildChartDataPayload(formData);

  // Fetch chart data (for non-map, non-table charts)
  const {
    data: chartDataRaw,
    error: chartError,
    isLoading: chartLoading,
  } = useChartData(
    formData.chart_type !== 'map' && formData.chart_type !== 'table' ? chartDataPayload : null
  );

  // Fetch GeoJSON data for maps
  const {
    data: geojsonDataRaw,
    error: geojsonError,
    isLoading: geojsonLoading,
  } = useGeoJSONData(currentGeojsonId);

  // Build data overlay payload with drill-down awareness
  const dataOverlayPayload = useMemo(() => {
    const basePayload =
      formData.chart_type === 'map' && formData.dataOverlayPayload
        ? formData.dataOverlayPayload
        : null;

    if (!basePayload) return null;

    // Ensure value_column is always defined (required by useMapDataOverlay)
    const valueColumn = basePayload.value_column || basePayload.geographic_column;

    // If no drill-down, use original payload with guaranteed value_column
    if (drillDownPath.length === 0) {
      return {
        ...basePayload,
        value_column: valueColumn,
      };
    }

    // Determine active geographic column for drill-down
    const hasDynamicDrillDown = formData.geographic_hierarchy?.drill_down_levels?.length > 0;
    const drillDownColumn = hasDynamicDrillDown
      ? formData.geographic_hierarchy?.drill_down_levels?.[0]?.column
      : formData.district_column;

    return {
      ...basePayload,
      value_column: valueColumn,
      geographic_column: drillDownColumn || basePayload.geographic_column,
      filters: {
        ...basePayload.filters,
        ...drillDownFilters,
      },
    };
  }, [formData, drillDownPath, drillDownFilters]);

  // Fetch map data overlay
  const {
    data: mapDataOverlayRaw,
    error: mapDataError,
    isLoading: mapDataLoading,
  } = useMapDataOverlay(dataOverlayPayload);

  // Fetch data preview for DATA tab
  const {
    data: dataPreviewRaw,
    error: previewError,
    isLoading: previewLoading,
  } = useChartDataPreview(
    chartDataPayload,
    dataPreviewPagination.page,
    dataPreviewPagination.pageSize
  );

  // Fetch total rows for chart data preview pagination
  const { data: chartDataTotalRows } = useChartDataPreviewTotalRows(chartDataPayload);

  // Fetch table chart data with server-side pagination
  const {
    data: tableChartDataRaw,
    error: tableChartError,
    isLoading: tableChartLoading,
  } = useChartDataPreview(
    formData.chart_type === 'table' ? chartDataPayload : null,
    tableChartPagination.page,
    tableChartPagination.pageSize
  );

  // Fetch total rows for table chart pagination
  const { data: tableChartDataTotalRows } = useChartDataPreviewTotalRows(
    formData.chart_type === 'table' ? chartDataPayload : null
  );

  // Fetch raw table data
  const {
    data: rawTableDataRaw,
    error: rawDataError,
    isLoading: rawDataLoading,
  } = useRawTableData(
    formData.schema_name || null,
    formData.table_name || null,
    rawDataPagination.page,
    rawDataPagination.pageSize
  );

  // Get table count for raw data pagination
  const { data: tableCount } = useTableCount(
    formData.schema_name || null,
    formData.table_name || null
  );

  // Get all columns for raw data
  const { data: columns } = useColumns(formData.schema_name || null, formData.table_name || null);

  return {
    chartDataPayload,

    chartData: {
      data: chartDataRaw,
      error: chartError,
      isLoading: chartLoading,
    },

    geojsonData: {
      data: geojsonDataRaw,
      error: geojsonError,
      isLoading: geojsonLoading,
    },

    mapDataOverlay: {
      data: mapDataOverlayRaw,
      error: mapDataError,
      isLoading: mapDataLoading,
    },

    tableChartData: {
      data: tableChartDataRaw,
      error: tableChartError,
      isLoading: tableChartLoading,
    },
    tableChartTotalRows: tableChartDataTotalRows || 0,

    dataPreview: {
      data: dataPreviewRaw,
      error: previewError,
      isLoading: previewLoading,
    },
    chartDataTotalRows: chartDataTotalRows || 0,

    rawTableData: {
      data: rawTableDataRaw,
      error: rawDataError,
      isLoading: rawDataLoading,
    },
    tableCount,

    columns,
  };
}
