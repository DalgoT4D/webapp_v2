import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

export interface Dashboard {
  id: number;
  title: string;
  description?: string;
  dashboard_type: 'native' | 'superset';
  grid_columns: number;
  layout_config: any;
  components: any;
  is_published: boolean;
  published_at?: string;
  is_locked: boolean;
  locked_by?: string;
  created_by: string;
  org_id: number;
  last_modified_by?: string;
  created_at: string;
  updated_at: string;
  filters: DashboardFilter[];
}

export interface DashboardFilter {
  id: number;
  dashboard_id: number;
  name: string;
  filter_type: 'value' | 'numerical' | 'datetime';
  schema_name: string;
  table_name: string;
  column_name: string;
  settings: any;
  order: number;
  created_at: string;
  updated_at: string;
}

interface UseDashboardsParams {
  dashboard_type?: 'native' | 'superset';
  search?: string;
  is_published?: boolean;
}

export function useDashboards(params?: UseDashboardsParams) {
  const queryParams = new URLSearchParams();

  if (params?.dashboard_type) {
    queryParams.append('dashboard_type', params.dashboard_type);
  }
  if (params?.search) {
    queryParams.append('search', params.search);
  }
  if (params?.is_published !== undefined) {
    queryParams.append('is_published', params.is_published.toString());
  }

  const queryString = queryParams.toString();
  const url = `/api/dashboards/${queryString ? `?${queryString}` : ''}`;

  const { data, error, mutate } = useSWR<Dashboard[]>(url, apiGet, {
    revalidateOnFocus: true, // Refresh when tab/window gets focus
    revalidateOnReconnect: true, // Refresh on network reconnect
    dedupingInterval: 5000, // Avoid duplicate requests for 5 seconds
  });

  return {
    data: data,
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}

export function useDashboard(id: number) {
  const { data, error, mutate } = useSWR<Dashboard>(id ? `/api/dashboards/${id}/` : null, apiGet);

  return {
    data: data,
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}

export async function createDashboard(data: {
  title: string;
  description?: string;
  grid_columns?: number;
}) {
  return await apiPost('/api/dashboards/', data);
}

export async function updateDashboard(id: number, data: Partial<Dashboard>) {
  return apiPut(`/api/dashboards/${id}/`, data);
}

export async function deleteDashboard(id: number) {
  return apiDelete(`/api/dashboards/${id}/`);
}

export async function lockDashboard(id: number) {
  return apiPost(`/api/dashboards/${id}/lock/`, {});
}

export async function refreshDashboardLock(id: number) {
  return apiPut(`/api/dashboards/${id}/lock/refresh/`, {});
}

export async function unlockDashboard(id: number) {
  return apiDelete(`/api/dashboards/${id}/lock/`);
}

export async function getFilterOptions(params: {
  schema_name: string;
  table_name: string;
  column_name: string;
  limit?: number;
}) {
  const queryParams = new URLSearchParams({
    schema_name: params.schema_name,
    table_name: params.table_name,
    column_name: params.column_name,
    ...(params.limit && { limit: params.limit.toString() }),
  });

  return apiGet(`/api/dashboards/filter-options/?${queryParams}`);
}

export async function updateDashboardFilter(
  dashboardId: number,
  filterId: number,
  data: {
    name?: string;
    filter_type?: 'value' | 'numerical' | 'datetime';
    schema_name?: string;
    table_name?: string;
    column_name?: string;
    settings?: any;
    order?: number;
  }
): Promise<DashboardFilter> {
  return apiPut(`/api/dashboards/${dashboardId}/filters/${filterId}/`, data);
}

export function useDashboardFilter(dashboardId: number, filterId: number | undefined) {
  const { data, error, mutate } = useSWR<DashboardFilter>(
    dashboardId && filterId ? `/api/dashboards/${dashboardId}/filters/${filterId}/` : null,
    apiGet,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    data: data,
    isLoading: !error && !data && !!filterId,
    isError: error,
    mutate,
  };
}

export async function createDashboardFilter(
  dashboardId: number,
  data: {
    name: string;
    filter_type: 'value' | 'numerical' | 'datetime';
    schema_name: string;
    table_name: string;
    column_name: string;
    settings: any;
  }
): Promise<DashboardFilter> {
  return apiPost(`/api/dashboards/${dashboardId}/filters/`, data);
}
