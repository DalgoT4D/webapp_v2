import useSWR, { mutate } from 'swr';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '@/lib/api';

/**
 * Invalidate every cached alert-related SWR key so the next render refetches
 * fresh data. Covers the paginated list (`/api/alerts/?page=…`), individual
 * detail (`/api/alerts/<id>/`), and per-alert logs (`/api/alerts/<id>/logs/…`).
 * Call after any mutation that changes alert state on the server.
 */
function invalidateAlerts() {
  return mutate((key) => typeof key === 'string' && key.startsWith('/api/alerts/'));
}
import type {
  AlertCreatePayload,
  AlertListResponse,
  AlertLogListResponse,
  AlertResponse,
  AlertTestPayload,
  AlertTestResponse,
  AlertUpdatePayload,
  SlackWebhookTestResponse,
} from '@/types/alerts';

interface UseAlertsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
  frequency?: string;
}

function buildListUrl(base: string, params?: UseAlertsParams) {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.pageSize) queryParams.append('page_size', params.pageSize.toString());
  if (params?.search) queryParams.append('search', params.search);
  if (params?.isActive !== undefined) queryParams.append('is_active', String(params.isActive));
  if (params?.frequency) queryParams.append('frequency', params.frequency);
  const qs = queryParams.toString();
  return qs ? `${base}?${qs}` : base;
}

export function useAlerts(params?: UseAlertsParams) {
  const url = buildListUrl('/api/alerts/', params);
  const { data, error, mutate } = useSWR<AlertListResponse>(url, apiGet);

  return {
    data: data?.data || [],
    total: data?.total || 0,
    page: data?.page || 1,
    pageSize: data?.page_size || 10,
    totalPages: data?.total_pages || 1,
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}

export function useAlert(id: number | null) {
  const { data, error, mutate } = useSWR<AlertResponse>(id ? `/api/alerts/${id}/` : null, apiGet);

  return {
    alert: data,
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}

export function useAlertLogs(id: number | null, params?: { page?: number; pageSize?: number }) {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.pageSize) queryParams.append('page_size', params.pageSize.toString());
  const qs = queryParams.toString();
  const url = id ? `/api/alerts/${id}/logs/${qs ? `?${qs}` : ''}` : null;
  const { data, error, mutate } = useSWR<AlertLogListResponse>(url, apiGet);

  return {
    data: data?.data || [],
    total: data?.total || 0,
    page: data?.page || 1,
    pageSize: data?.page_size || 20,
    totalPages: data?.total_pages || 1,
    isLoading: !error && !data && !!id,
    isError: error,
    mutate,
  };
}

export async function createAlert(payload: AlertCreatePayload): Promise<AlertResponse> {
  const result = await apiPost('/api/alerts/', payload);
  invalidateAlerts();
  return result;
}

export async function updateAlert(id: number, payload: AlertUpdatePayload): Promise<AlertResponse> {
  const result = await apiPut(`/api/alerts/${id}/`, payload);
  invalidateAlerts();
  return result;
}

export async function toggleAlert(id: number, isActive: boolean): Promise<AlertResponse> {
  const result = await apiPatch(`/api/alerts/${id}/toggle/`, { is_active: isActive });
  invalidateAlerts();
  return result;
}

export async function deleteAlert(id: number): Promise<{ success: boolean }> {
  const result = await apiDelete(`/api/alerts/${id}/`);
  invalidateAlerts();
  return result;
}

export async function testSlackWebhook(webhookUrl: string): Promise<SlackWebhookTestResponse> {
  return apiPost('/api/alerts/test-slack-webhook/', { webhook_url: webhookUrl });
}

export async function dryRunAlert(payload: AlertTestPayload): Promise<AlertTestResponse> {
  return apiPost('/api/alerts/test/', payload);
}
