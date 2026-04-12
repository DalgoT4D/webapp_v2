'use client';

import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type { Alert, AlertEvaluation, AlertTestResult, AlertQueryConfig } from '@/types/alert';

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

// --- SWR Read Hooks ---

export function useAlerts(page: number = 1, pageSize: number = 10) {
  const url = `/api/alerts/?page=${page}&page_size=${pageSize}`;

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
  query_config: AlertQueryConfig;
  cron: string;
  recipients: string[];
  message: string;
}): Promise<Alert> {
  const response = await apiPost('/api/alerts/', data);
  return response.data;
}

export async function updateAlert(
  id: number,
  data: {
    name?: string;
    query_config?: AlertQueryConfig;
    cron?: string;
    recipients?: string[];
    message?: string;
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
  query_config: AlertQueryConfig;
  page?: number;
  page_size?: number;
}): Promise<AlertTestResult> {
  const response: AlertTestResponse = await apiPost('/api/alerts/test', {
    query_config: data.query_config,
    page: data.page ?? 1,
    page_size: data.page_size ?? 20,
  });
  return response.data;
}
