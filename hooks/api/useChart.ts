import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useState, useEffect } from 'react';
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
    (url: string, { arg }: { arg: { chart_id: number; format: string } }) =>
      apiPost(url, {
        ...arg,
        responseType: arg.format === 'png' ? 'blob' : 'json',
      })
  );
}

// Warehouse hooks for chart builder
export function useSchemas() {
  return useSWR<string[]>('/api/warehouse/schemas', apiGet);
}

export function useTables(schema: string | null) {
  return useSWR<any[]>(schema ? `/api/warehouse/tables/${schema}` : null, apiGet);
}

// Hook to get all tables from all schemas - proper hook that doesn't violate rules
export function useAllSchemaTables() {
  const { data: schemas, isLoading: schemasLoading, error: schemasError } = useSchemas();

  const [allTables, setAllTables] = useState<
    Array<{ schema_name: string; table_name: string; full_name: string }>
  >([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  useEffect(() => {
    if (!schemas || schemas.length === 0) {
      setAllTables([]);
      return;
    }

    async function fetchAllTables() {
      setIsLoadingTables(true);
      try {
        const allTablesData: Array<{ schema_name: string; table_name: string; full_name: string }> =
          [];

        // Fetch tables for each schema (schemas is an array of strings)
        for (const schemaName of schemas) {
          try {
            const tables = await apiGet(`/api/warehouse/tables/${schemaName}`);
            if (tables && Array.isArray(tables)) {
              tables.forEach((table: any) => {
                // Handle both string and object formats (like existing components do)
                const tableName = typeof table === 'string' ? table : table.table_name;
                if (tableName) {
                  allTablesData.push({
                    schema_name: schemaName,
                    table_name: tableName,
                    full_name: `${schemaName}.${tableName}`,
                  });
                }
              });
            }
          } catch (error) {
            console.error(`Error fetching tables for schema ${schemaName}:`, error);
          }
        }

        setAllTables(allTablesData);
      } catch (error) {
        console.error('Error fetching all tables:', error);
      } finally {
        setIsLoadingTables(false);
      }
    }

    fetchAllTables();
  }, [schemas]);

  return {
    data: allTables,
    isLoading: schemasLoading || isLoadingTables,
    error: schemasError,
  };
}

export function useColumns(schema: string | null, table: string | null) {
  return useSWR<any[]>(
    schema && table ? `/api/warehouse/table_columns/${schema}/${table}` : null,
    apiGet
  );
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
export function useRegionHierarchy(countryCode: string = 'IND') {
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
  } | null
) {
  return useSWR(payload ? ['/api/charts/map-data-overlay/', payload] : null, ([url, data]) =>
    apiPost(url, data)
  );
}
