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
  filter_type: 'value' | 'numerical';
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

  const { data, error, mutate } = useSWR<Dashboard[]>(url, apiGet);

  // Mock data for now to test UI
  const mockData: Dashboard[] = [
    {
      id: 1,
      title: 'Sales Dashboard',
      description: 'Monthly sales performance metrics',
      dashboard_type: 'native',
      grid_columns: 12,
      layout_config: [],
      components: {},
      is_published: true,
      published_at: '2024-01-01T00:00:00Z',
      is_locked: false,
      created_by: 'John Doe',
      org_id: 10,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      filters: [],
    },
    {
      id: 2,
      title: 'Analytics Overview',
      description: 'Comprehensive analytics dashboard from Superset',
      dashboard_type: 'superset',
      grid_columns: 12,
      layout_config: [],
      components: {},
      is_published: true,
      published_at: '2024-01-01T00:00:00Z',
      is_locked: false,
      created_by: 'Jane Smith',
      org_id: 10,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      filters: [],
    },
  ];

  return {
    data: error ? undefined : mockData,
    isLoading: false,
    isError: error,
    mutate,
  };
}

export function useDashboard(id: number) {
  const { data, error, mutate } = useSWR<Dashboard>(id ? `/api/dashboards/${id}/` : null, apiGet);

  // Mock data for testing
  const mockDashboard: Dashboard = {
    id,
    title: 'Sales Dashboard',
    description: 'Monthly sales performance metrics',
    dashboard_type: 'native',
    grid_columns: 12,
    layout_config: [
      { i: 'chart-1', x: 0, y: 0, w: 6, h: 4 },
      { i: 'text-1', x: 6, y: 0, w: 6, h: 2 },
      { i: 'heading-1', x: 6, y: 2, w: 6, h: 2 },
    ],
    components: {
      'chart-1': { type: 'chart', config: { chartId: 1 } },
      'text-1': { type: 'text', config: { content: 'Welcome to the Sales Dashboard' } },
      'heading-1': { type: 'heading', config: { content: 'Monthly Overview', level: 'h2' } },
    },
    is_published: true,
    published_at: '2024-01-01T00:00:00Z',
    is_locked: false,
    created_by: 'John Doe',
    org_id: 10,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    filters: [],
  };

  return {
    data: error ? undefined : mockDashboard,
    isLoading: false,
    isError: error,
    mutate,
  };
}

export async function createDashboard(data: {
  title: string;
  description?: string;
  grid_columns?: number;
}) {
  return apiPost('/api/dashboards/', data);
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

export async function getFilteredDashboardData(dashboardId: number, filters: any) {
  return apiPost(`/api/dashboards/${dashboardId}/filter-data/`, filters);
}
