'use client';

import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type {
  Alert,
  AlertEvaluation,
  AlertTestResult,
  AlertQueryConfig,
  AlertMessagePlaceholder,
  TriggeredAlertEvent,
} from '@/types/alert';

interface AlertListResponse {
  success: boolean;
  data: {
    data: Alert[];
    total: number;
    page: number;
    page_size: number;
  };
}

interface AlertDetailResponse {
  success: boolean;
  data: Alert;
}

interface AlertEvaluationListResponse {
  success: boolean;
  data: {
    data: AlertEvaluation[];
    total: number;
    page: number;
    page_size: number;
  };
}

interface AlertTestResponse {
  success: boolean;
  data: AlertTestResult;
}

interface TriggeredAlertListResponse {
  success: boolean;
  data: {
    data: TriggeredAlertEvent[];
    total: number;
    page: number;
    page_size: number;
  };
}

// --- SWR Read Hooks ---

export function useAlerts(page: number = 1, pageSize: number = 10, metricId?: number | null) {
  const searchParams = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (metricId != null) {
    searchParams.set('metric_id', String(metricId));
  }
  const url = `/api/alerts/?${searchParams.toString()}`;

  const { data, error, mutate, isLoading } = useSWR<AlertListResponse>(url, apiGet, {
    revalidateOnFocus: false,
  });

  return {
    alerts: data?.data?.data ?? [],
    total: data?.data?.total ?? 0,
    page: data?.data?.page ?? 1,
    pageSize: data?.data?.page_size ?? pageSize,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useTriggeredAlerts(
  page: number = 1,
  pageSize: number = 20,
  metricId?: number | null
) {
  const searchParams = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (metricId != null) {
    searchParams.set('metric_id', String(metricId));
  }
  const url = `/api/alerts/fired/?${searchParams.toString()}`;

  const { data, error, mutate, isLoading } = useSWR<TriggeredAlertListResponse>(url, apiGet, {
    revalidateOnFocus: false,
  });

  return {
    events: data?.data?.data ?? [],
    total: data?.data?.total ?? 0,
    page: data?.data?.page ?? 1,
    pageSize: data?.data?.page_size ?? pageSize,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useAlert(id: number | null) {
  const url = id ? `/api/alerts/${id}/` : null;

  const { data, error, mutate, isLoading } = useSWR<AlertDetailResponse>(url, apiGet, {
    revalidateOnFocus: false,
  });

  return {
    alert: data?.data ?? null,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useAlertEvaluations(
  alertId: number | null,
  page: number = 1,
  pageSize: number = 20
) {
  const url = alertId
    ? `/api/alerts/${alertId}/evaluations/?page=${page}&page_size=${pageSize}`
    : null;

  const { data, error, mutate, isLoading } = useSWR<AlertEvaluationListResponse>(url, apiGet, {
    revalidateOnFocus: false,
  });

  return {
    evaluations: data?.data?.data ?? [],
    total: data?.data?.total ?? 0,
    page: data?.data?.page ?? 1,
    pageSize: data?.data?.page_size ?? pageSize,
    isLoading,
    isError: error,
    mutate,
  };
}

// --- Mutation Functions ---

export async function createAlert(data: {
  name: string;
  metric_id?: number | null;
  query_config: AlertQueryConfig;
  recipients: string[];
  message: string;
  group_message?: string;
  message_placeholders?: AlertMessagePlaceholder[];
}): Promise<Alert> {
  const response = await apiPost('/api/alerts/', data);
  return response.data;
}

export async function updateAlert(
  id: number,
  data: {
    name?: string;
    metric_id?: number | null;
    query_config?: AlertQueryConfig;
    recipients?: string[];
    message?: string;
    group_message?: string;
    message_placeholders?: AlertMessagePlaceholder[];
    is_active?: boolean;
  }
): Promise<Alert> {
  const response = await apiPut(`/api/alerts/${id}/`, data);
  return response.data;
}

export async function deleteAlert(id: number): Promise<void> {
  await apiDelete(`/api/alerts/${id}/`);
}

export async function testAlert(data: {
  metric_id?: number | null;
  query_config: AlertQueryConfig;
  message?: string;
  group_message?: string;
  message_placeholders?: AlertMessagePlaceholder[];
  page?: number;
  page_size?: number;
}): Promise<AlertTestResult> {
  const response: AlertTestResponse = await apiPost('/api/alerts/test', {
    metric_id: data.metric_id ?? null,
    query_config: data.query_config,
    message: data.message ?? '',
    group_message: data.group_message ?? '',
    message_placeholders: data.message_placeholders ?? [],
    page: data.page ?? 1,
    page_size: data.page_size ?? 20,
  });
  return response.data;
}
