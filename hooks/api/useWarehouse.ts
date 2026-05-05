'use client';

import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete, apiGetBinary } from '@/lib/api';
import type { Warehouse, DestinationDefinition } from '@/types/warehouse';
import type { ConnectionSpecification } from '@/components/connectors/types';

import type {
  WarehouseTable,
  TableColumn,
  TableColumnWithType,
  MetricsRequest,
} from '@/types/explore';

// ============ Raw API Response Types ============

interface WarehouseApiItem {
  wtype: string;
  name: string;
  airbyte_destination: {
    destinationDefinitionId: string;
    destinationId: string;
    workspaceId?: string;
    connectionConfiguration: Record<string, unknown>;
    name: string;
    destinationName: string;
    icon: string;
  };
  airbyte_docker_repository: string;
  airbyte_docker_image_tag: string;
}

interface WarehouseListResponse {
  warehouses: WarehouseApiItem[];
}

/** Maps the raw API warehouse item to the flat Warehouse type used by UI */
function mapWarehouseResponse(raw: WarehouseApiItem): Warehouse {
  return {
    wtype: raw.wtype,
    name: raw.name,
    destinationId: raw.airbyte_destination.destinationId,
    destinationDefinitionId: raw.airbyte_destination.destinationDefinitionId,
    icon: raw.airbyte_destination.icon,
    connectionConfiguration: raw.airbyte_destination.connectionConfiguration ?? {},
    airbyteDockerRepository: raw.airbyte_docker_repository,
    tag: raw.airbyte_docker_image_tag,
    airbyteWorkspaceId: raw.airbyte_destination.workspaceId,
  };
}

// ============ Warehouse CRUD Hooks ============

/** Current warehouse for the org (single warehouse per org) */
export function useWarehouse() {
  const { data, error, mutate, isLoading } = useSWR<WarehouseListResponse>(
    '/api/organizations/warehouses',
    apiGet,
    { revalidateOnFocus: false }
  );
  const warehouse = data?.warehouses?.[0] ? mapWarehouseResponse(data.warehouses[0]) : undefined;
  return { data: warehouse, isLoading, isError: error, mutate };
}

/** Available destination type definitions */
export function useDestinationDefinitions() {
  const { data, error, isLoading } = useSWR<DestinationDefinition[]>(
    '/api/airbyte/destination_definitions',
    apiGet,
    { revalidateOnFocus: false }
  );
  return { data: data || [], isLoading, isError: error };
}

/** Raw API response wraps the spec in a connectionSpecification key */
interface SpecResponse {
  connectionSpecification: ConnectionSpecification;
}

/** Unwrap the spec from the API response envelope */
function unwrapSpec(
  data: SpecResponse | ConnectionSpecification | undefined
): ConnectionSpecification | undefined {
  if (!data) return undefined;
  if ('connectionSpecification' in data) return data.connectionSpecification;
  return data;
}

/** Spec for a selected destination definition (for creating new warehouse) */
export function useDestinationSpec(defId: string | null) {
  const { data, error, isLoading } = useSWR<SpecResponse>(
    defId ? `/api/airbyte/destination_definitions/${defId}/specifications` : null,
    apiGet,
    { revalidateOnFocus: false }
  );
  return { data: unwrapSpec(data), isLoading, isError: error };
}

/** Spec for an existing destination (for editing warehouse) */
export function useDestinationEditSpec(destId: string | null) {
  const { data, error, isLoading } = useSWR<SpecResponse>(
    destId ? `/api/airbyte/destinations/${destId}/specifications` : null,
    apiGet,
    { revalidateOnFocus: false }
  );
  return { data: unwrapSpec(data), isLoading, isError: error };
}

// ============ Warehouse CRUD Mutations ============

export async function createWarehouse(payload: {
  wtype: string;
  name: string;
  destinationDefId: string;
  airbyteConfig: Record<string, unknown>;
}): Promise<Warehouse> {
  const raw: WarehouseApiItem = await apiPost('/api/organizations/warehouse/', payload);
  return mapWarehouseResponse(raw);
}

export async function updateWarehouse(
  destId: string,
  payload: {
    name: string;
    config: Record<string, unknown>;
    destinationDefId: string;
  }
): Promise<void> {
  await apiPut(`/api/airbyte/v1/destinations/${destId}/`, payload);
}

export async function deleteWarehouse(): Promise<void> {
  return apiDelete('/api/v1/organizations/warehouses/');
}

// ============ Warehouse Data Exploration Hooks ============

// Fetch all warehouse tables
export function useWarehouseTables(fresh?: boolean) {
  const url = fresh ? '/api/warehouse/sync_tables?fresh=1' : '/api/warehouse/sync_tables';

  return useSWR<WarehouseTable[]>(url, apiGet, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });
}

// Fetch table columns
export function useTableColumns(schema: string | null, table: string | null) {
  const url = schema && table ? `/api/warehouse/table_columns/${schema}/${table}` : null;

  return useSWR<TableColumn[]>(url, apiGet, {
    revalidateOnFocus: false,
  });
}

// Fetch table column types (for statistics)
export function useTableColumnTypes(schema: string | null, table: string | null) {
  const url = schema && table ? `/api/warehouse/v1/table_data/${schema}/${table}` : null;

  return useSWR<TableColumnWithType[]>(url, apiGet, {
    revalidateOnFocus: false,
  });
}

// Fetch table data (paginated)
export function useTableData(
  schema: string | null,
  table: string | null,
  params: {
    page: number;
    limit: number;
    order_by?: string;
    order?: 1 | -1;
  }
) {
  const searchParams = new URLSearchParams({
    page: params.page.toString(),
    limit: params.limit.toString(),
  });

  if (params.order_by) {
    searchParams.set('order_by', params.order_by);
    searchParams.set('order', (params.order ?? 1).toString());
  }

  const url =
    schema && table
      ? `/api/warehouse/table_data/${schema}/${table}?${searchParams.toString()}`
      : null;

  return useSWR<Record<string, unknown>[]>(url, apiGet, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
}

// Fetch row count
export function useTableCount(schema: string | null, table: string | null) {
  const url = schema && table ? `/api/warehouse/table_count/${schema}/${table}` : null;

  return useSWR<{ total_rows: number }>(url, apiGet, {
    revalidateOnFocus: false,
  });
}

// Download table as CSV (imperative, not hook)
export async function downloadTableCSV(schema: string, table: string): Promise<void> {
  const blob = await apiGetBinary(`/api/warehouse/download/${schema}/${table}`);

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${schema}_${table}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// Request statistics calculation (returns task_id)
export async function requestTableMetrics(params: MetricsRequest): Promise<{ task_id: string }> {
  return apiPost('/api/warehouse/insights/metrics/', params);
}

// Poll task status
export function useTaskStatus(taskId: string | null, options?: { refreshInterval?: number }) {
  const url = taskId ? `/api/tasks/${taskId}?hashkey=data-insights` : null;

  return useSWR<{ progress: Array<{ status: string; results?: unknown }> }>(url, apiGet, {
    refreshInterval: (data) => {
      if (!data) return options?.refreshInterval ?? 5000;
      const latest = data.progress?.[data.progress.length - 1];
      if (
        latest?.status === 'completed' ||
        latest?.status === 'failed' ||
        latest?.status === 'error'
      ) {
        return 0; // Stop polling
      }
      return options?.refreshInterval ?? 5000;
    },
    revalidateOnFocus: false,
  });
}

// Sync warehouse tables (trigger refresh)
export async function syncWarehouseTables(): Promise<WarehouseTable[]> {
  return apiGet('/api/warehouse/sync_tables?fresh=1');
}
