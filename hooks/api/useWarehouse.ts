// hooks/api/useWarehouse.ts
'use client';

import useSWR from 'swr';
import { apiGet, apiPost, apiGetBinary } from '@/lib/api';
import type {
  WarehouseTable,
  TableColumn,
  TableColumnWithType,
  MetricsRequest,
} from '@/types/explore';

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
