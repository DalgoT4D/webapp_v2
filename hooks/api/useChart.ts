import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type {
  Chart,
  ChartCreate,
  ChartUpdate,
  ChartDataPayload,
  ChartDataResponse,
  DataPreviewResponse,
} from '@/types/charts';

// Fetchers
const chartsFetcher = (url: string) => apiGet(url);
const chartFetcher = (url: string) => apiGet(url);
const chartDataFetcher = ([url, data]: [string, ChartDataPayload]) => apiPost(url, data);
const dataPreviewFetcher = ([url, data]: [string, ChartDataPayload]) => apiPost(url, data);

// Mutations
const createChart = (url: string, { arg }: { arg: ChartCreate }) => apiPost(url, arg);

const updateChart = (url: string, { arg }: { arg: { id: number; data: ChartUpdate } }) =>
  apiPut(`${url}${arg.id}/`, arg.data);

const deleteChart = (url: string, { arg }: { arg: number }) => apiDelete(`${url}${arg}/`);

const bulkDeleteCharts = (url: string, { arg }: { arg: number[] }) =>
  apiPost(`${url}bulk-delete/`, { chart_ids: arg });

// Hooks
export function useCharts() {
  return useSWR('/api/charts/', chartsFetcher);
}

export function useChart(id: number | null) {
  return useSWR(id ? `/api/charts/${id}/` : null, chartFetcher);
}

export function useCreateChart() {
  return useSWRMutation('/api/charts/', createChart);
}

export function useUpdateChart() {
  return useSWRMutation('/api/charts/', updateChart);
}

export function useDeleteChart() {
  return useSWRMutation('/api/charts/', deleteChart);
}

export function useBulkDeleteCharts() {
  return useSWRMutation('/api/charts/', bulkDeleteCharts);
}

export function useChartData(payload: ChartDataPayload | null) {
  return useSWR(payload ? ['/api/charts/chart-data/', payload] : null, chartDataFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 2000,
  });
}

export function useChartDataPreview(
  payload: ChartDataPayload | null,
  page: number = 1,
  pageSize: number = 50
) {
  const enrichedPayload = payload
    ? {
        ...payload,
        offset: (page - 1) * pageSize,
        limit: pageSize,
      }
    : null;

  return useSWR(
    enrichedPayload ? ['/api/charts/chart-data-preview/', enrichedPayload] : null,
    dataPreviewFetcher
  );
}

// Chart export hook
export function useChartExport() {
  return useSWRMutation(
    '/api/charts/export/',
    (url: string, { arg }: { arg: { chart_id: number; format: string } }) => apiPost(url, arg)
  );
}

// Warehouse hooks for chart builder
export function useSchemas() {
  return useSWR<string[]>('/api/warehouse/schemas', apiGet);
}

export function useTables(schema: string | null) {
  return useSWR<any[]>(schema ? `/api/warehouse/tables/${schema}` : null, apiGet);
}

// Hook to get all tables from all schemas using optimized sync_tables API
export function useAllSchemaTables() {
  const {
    data: syncTablesData,
    isLoading,
    error,
  } = useSWR('/api/warehouse/sync_tables', apiGet, {
    dedupingInterval: 300000, // 5 minute cache
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });

  // Transform sync_tables API response to match existing format exactly
  const allTables = React.useMemo(() => {
    if (!syncTablesData || !Array.isArray(syncTablesData)) {
      return [];
    }

    return syncTablesData.map((item: any) => ({
      schema_name: item.schema,
      table_name: item.input_name,
      full_name: `${item.schema}.${item.input_name}`, // Format: "schema.table"
    }));
  }, [syncTablesData]);

  return {
    data: allTables,
    isLoading,
    error,
  };
}

export function useColumns(schema: string | null, table: string | null) {
  return useSWR<any[]>(
    schema && table ? `/api/warehouse/table_columns/${schema}/${table}` : null,
    apiGet
  );
}

export function useColumnValues(
  schema: string | null,
  table: string | null,
  column: string | null
) {
  return useSWR<string[]>(
    schema && table && column ? `/api/warehouse/column-values/${schema}/${table}/${column}` : null,
    apiGet,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 minutes cache
    }
  );
}

// Raw table data hooks
export function useRawTableData(
  schema: string | null,
  table: string | null,
  page: number = 1,
  pageSize: number = 50
) {
  return useSWR(
    schema && table
      ? `/api/warehouse/table_data/${schema}/${table}?page=${page}&limit=${pageSize}`
      : null,
    apiGet,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );
}

export function useTableCount(schema: string | null, table: string | null) {
  return useSWR(schema && table ? `/api/warehouse/table_count/${schema}/${table}` : null, apiGet);
}

// Re-export types for convenience
export type { ChartDataPayload, ChartCreate as ChartCreatePayload } from '@/types/charts';

// Alias for backward compatibility with tests
export const useChartSave = useCreateChart;

// Map-specific hooks

export interface GeoJSONListItem {
  id: number;
  name: string;
  display_name: string;
  is_default: boolean;
  layer_name: string;
  properties_key: string;
}

export interface GeoJSONDetail {
  id: number;
  name: string;
  display_name: string;
  geojson_data: any;
  properties_key: string;
}

const geojsonListFetcher = (url: string) => apiGet(url);
const geojsonDetailFetcher = (url: string) => apiGet(url);

export function useAvailableGeoJSONs(countryCode: string = 'IND', layerLevel: number = 1) {
  return useSWR(
    `/api/charts/geojsons/?country_code=${countryCode}&layer_level=${layerLevel}`,
    geojsonListFetcher
  );
}

export function useGeoJSONData(geojsonId: number | null) {
  return useSWR(geojsonId ? `/api/charts/geojsons/${geojsonId}/` : null, geojsonDetailFetcher);
}

// New map hooks for phase one implementation

export interface Region {
  id: number;
  name: string;
  display_name: string;
  type: string;
  parent_id: number | null;
  country_code: string;
  region_code: string;
}

export interface RegionGeoJSON {
  id: number;
  region_id: number;
  name: string;
  description: string | null;
  is_default: boolean;
  properties_key: string;
  file_size: number;
}

const regionsFetcher = (url: string) => apiGet(url);
const regionGeoJSONsFetcher = (url: string) => apiGet(url);

export function useRegions(countryCode: string = 'IND', regionType?: string) {
  const params = new URLSearchParams({ country_code: countryCode });
  if (regionType) {
    params.append('region_type', regionType);
  }

  return useSWR(`/api/charts/regions/?${params.toString()}`, regionsFetcher);
}

export function useChildRegions(
  parentRegionId: number | null | undefined,
  enabled: boolean = true
) {
  return useSWR(
    enabled && parentRegionId ? `/api/charts/regions/${parentRegionId}/children/` : null,
    regionsFetcher
  );
}

export function useRegionGeoJSONs(regionId: number | null | undefined) {
  return useSWR(
    regionId ? `/api/charts/regions/${regionId}/geojsons/` : null,
    regionGeoJSONsFetcher
  );
}

// New hook for region hierarchy
const regionHierarchyFetcher = (url: string) => apiGet(url);

export function useRegionHierarchy(countryCode: string = 'IND') {
  return useSWR(
    countryCode ? `/api/charts/hierarchy/?country=${countryCode}` : null,
    regionHierarchyFetcher
  );
}

export function useMapData(payload: ChartDataPayload | null) {
  return useSWR(
    payload ? ['/api/charts/map-data/', payload] : null,
    ([url, data]: [string, ChartDataPayload]) => apiPost(url, data)
  );
}

// New hooks for separated data fetching

export interface LayerOption {
  id: number;
  code: string;
  name: string;
  display_name: string;
  type: string;
  parent_id: number | null;
}

// Fetch available layers (countries, states, districts, etc.) dynamically
export function useAvailableLayers(layerType: string = 'country') {
  return useSWR<LayerOption[]>(`/api/charts/available-layers/?layer_type=${layerType}`, apiGet);
}

// Get region hierarchy by fetching all available region types for a country
export function useAvailableRegionTypes(countryCode: string = 'IND') {
  // First, get all regions without specifying type to see what types are available
  return useSWR(`/api/charts/regions/?country_code=${countryCode}`, apiGet);
}

// Get the next layer type by looking at child regions of a specific parent
export function useNextLayerType(parentRegionId: number | null) {
  return useSWR(parentRegionId ? `/api/charts/regions/${parentRegionId}/children/` : null, apiGet);
}

// Fetch map data separately (for data overlay on existing GeoJSON)
export function useMapDataOverlay(
  payload: {
    schema_name: string;
    table_name: string;
    geographic_column: string;
    value_column: string;
    aggregate_function: string;
    filters?: Record<string, any>;
    chart_filters?: any[];
    dashboard_filters?: Array<{ filter_id: string; value: any }>;
    extra_config?: {
      filters?: any[];
      pagination?: any;
      sort?: any[];
    };
    chart_id?: number; // Add chart ID for cache isolation
  } | null
) {
  // Transform payload to match backend requirements
  const transformedPayload =
    payload &&
    payload.schema_name &&
    payload.table_name &&
    payload.geographic_column &&
    payload.value_column &&
    payload.aggregate_function
      ? {
          schema_name: payload.schema_name,
          table_name: payload.table_name,
          geographic_column: payload.geographic_column,
          value_column: payload.value_column,
          metrics: [
            {
              column: payload.value_column,
              aggregation: payload.aggregate_function,
              alias: 'value',
            },
          ],
          filters: payload.filters || {},
          chart_filters: payload.chart_filters || [],
          // Remove dashboard_filters since they're now included in chart_filters
          extra_config: {
            ...payload.extra_config,
            filters: payload.chart_filters || payload.extra_config?.filters || [],
          },
        }
      : null;

  // Create a simple, stable key similar to regular charts for better filter change detection
  // Use a hash-based approach like regular charts do with query parameters
  const filterHash = transformedPayload
    ? JSON.stringify({
        chart_filters: transformedPayload.chart_filters || [],
        filters: transformedPayload.filters || {},
        extra_config: transformedPayload.extra_config || {},
      })
    : '';

  const swrKey = transformedPayload
    ? `/api/charts/map-data-overlay/?chart_id=${payload?.chart_id || 'unknown'}&payload=${encodeURIComponent(JSON.stringify(transformedPayload))}&filters=${encodeURIComponent(filterHash)}`
    : null;

  return useSWR(
    swrKey,
    (url: string) => {
      // Extract the payload from URL params for the API call
      const urlParams = new URLSearchParams(url.split('?')[1]);
      const payloadParam = urlParams.get('payload');
      const payload = payloadParam ? JSON.parse(decodeURIComponent(payloadParam)) : null;
      return apiPost('/api/charts/map-data-overlay/', payload);
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 2000, // Same 2s dedupe interval as regular charts
    }
  );
}
