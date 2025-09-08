import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

export interface Dashboard {
  id: number;
  title: string;
  dashboard_type: 'native' | 'superset';
  grid_columns: number;
  target_screen_size?: 'desktop' | 'tablet' | 'mobile' | 'a4'; // Target screen size for design
  filter_layout?: 'vertical' | 'horizontal'; // Filter layout position
  layout_config: any;
  responsive_layouts?: any; // Optional responsive layouts for different breakpoints
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
  // Sharing fields
  is_public: boolean;
  public_share_token?: string;
  public_shared_at?: string;
  public_disabled_at?: string;
  public_access_count: number;
  last_public_accessed?: string;
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
  page?: number;
  pageSize?: number;
}

interface PaginatedDashboardsResponse {
  data: Dashboard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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
  if (params?.page) {
    queryParams.append('page', params.page.toString());
  }
  if (params?.pageSize) {
    queryParams.append('page_size', params.pageSize.toString());
  }

  const queryString = queryParams.toString();
  const url = `/api/dashboards/${queryString ? `?${queryString}` : ''}`;

  const { data, error, mutate } = useSWR<PaginatedDashboardsResponse | Dashboard[]>(url, apiGet, {
    revalidateOnFocus: true, // Refresh when tab/window gets focus
    revalidateOnReconnect: true, // Refresh on network reconnect
    dedupingInterval: 5000, // Avoid duplicate requests for 5 seconds
  });

  // Handle both paginated and non-paginated responses
  const isArray = Array.isArray(data);
  const dashboards = isArray
    ? (data as Dashboard[])
    : (data as PaginatedDashboardsResponse)?.data || [];
  const total = isArray ? dashboards.length : (data as PaginatedDashboardsResponse)?.total || 0;
  const page = isArray ? 1 : (data as PaginatedDashboardsResponse)?.page || 1;
  const pageSize = isArray
    ? dashboards.length
    : (data as PaginatedDashboardsResponse)?.pageSize || 10;
  const totalPages = isArray ? 1 : (data as PaginatedDashboardsResponse)?.totalPages || 1;

  return {
    data: dashboards,
    total,
    page,
    pageSize,
    totalPages,
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

export async function deleteDashboardFilter(
  dashboardId: number,
  filterId: number
): Promise<{ success: boolean }> {
  return apiDelete(`/api/dashboards/${dashboardId}/filters/${filterId}/`);
}

export async function duplicateDashboard(dashboardId: number): Promise<Dashboard> {
  // Use the backend duplicate endpoint that handles all the copying server-side
  return await apiPost(`/api/dashboards/${dashboardId}/duplicate/`, {});
}

// Dashboard sharing functions
export async function updateDashboardSharing(dashboardId: number, data: { is_public: boolean }) {
  return apiPut(`/api/dashboards/${dashboardId}/share/`, data);
}

export async function getDashboardSharingStatus(dashboardId: number) {
  return apiGet(`/api/dashboards/${dashboardId}/share/`);
}

export function usePublicDashboard(token: string) {
  const { data, error, mutate } = useSWR(
    token ? `/api/v1/public/dashboards/${token}/` : null,
    async (url: string) => {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002';
      const fullUrl = `${backendUrl}${url}`;

      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error('Dashboard not found');
      const data = await response.json();

      return data;
    }
  );

  return {
    dashboard: data,
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}
