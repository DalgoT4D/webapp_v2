'use client';

import useSWR from 'swr';
import { toast } from 'sonner';
import { apiGet, apiPut } from '@/lib/api';

interface SuccessResponse<T> {
  success: boolean;
  res: T;
}

export interface OrgDashboardAIChatSettings {
  feature_flag_enabled: boolean;
  ai_data_sharing_enabled: boolean;
  ai_data_sharing_consented_by: string | null;
  ai_data_sharing_consented_at: string | null;
  org_context_markdown: string;
  org_context_updated_by: string | null;
  org_context_updated_at: string | null;
  dbt_configured: boolean;
  docs_generated_at: string | null;
  vector_last_ingested_at: string | null;
}

export interface OrgDashboardAIChatStatus {
  feature_flag_enabled: boolean;
  ai_data_sharing_enabled: boolean;
  chat_available: boolean;
  dbt_configured: boolean;
  docs_generated_at: string | null;
  vector_last_ingested_at: string | null;
}

export interface DashboardAIContext {
  dashboard_id: number;
  dashboard_title: string;
  dashboard_context_markdown: string;
  dashboard_context_updated_by: string | null;
  dashboard_context_updated_at: string | null;
  vector_last_ingested_at: string | null;
}

export interface UpdateOrgDashboardAIChatPayload {
  ai_data_sharing_enabled?: boolean;
  org_context_markdown?: string;
}

export interface UpdateDashboardAIContextPayload {
  dashboard_context_markdown: string;
}

export function useDashboardAIChatSettings(enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<SuccessResponse<OrgDashboardAIChatSettings>>(
    enabled ? '/api/orgpreferences/ai-dashboard-chat' : null,
    apiGet,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    settings: data?.res,
    isLoading,
    error,
    mutate,
  };
}

export function useDashboardAIChatStatus(enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<SuccessResponse<OrgDashboardAIChatStatus>>(
    enabled ? '/api/orgpreferences/ai-dashboard-chat/status' : null,
    apiGet,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    status: data?.res,
    isLoading,
    error,
    mutate,
  };
}

export function useDashboardAIContext(dashboardId: number | null, enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<DashboardAIContext>(
    enabled && dashboardId ? `/api/dashboards/${dashboardId}/ai-context/` : null,
    apiGet,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    context: data,
    isLoading,
    error,
    mutate,
  };
}

export function useDashboardAIChatActions() {
  const updateSettings = async (payload: UpdateOrgDashboardAIChatPayload) => {
    try {
      const response = await apiPut('/api/orgpreferences/ai-dashboard-chat', payload);
      return (response as SuccessResponse<OrgDashboardAIChatSettings>).res;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update dashboard chat settings';
      toast.error(message);
      throw error;
    }
  };

  const updateDashboardContext = async (
    dashboardId: number,
    payload: UpdateDashboardAIContextPayload
  ) => {
    try {
      return (await apiPut(
        `/api/dashboards/${dashboardId}/ai-context/`,
        payload
      )) as DashboardAIContext;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update dashboard context';
      toast.error(message);
      throw error;
    }
  };

  return {
    updateSettings,
    updateDashboardContext,
  };
}
