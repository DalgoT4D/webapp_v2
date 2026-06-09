'use client';

import useSWR from 'swr';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPut } from '@/lib/api';

interface SuccessResponse<T> {
  success: boolean;
  res: T;
}

export interface OrgDashboardAIChatSettings {
  feature_flag_enabled: boolean;
  ai_data_sharing_enabled: boolean;
  dashboard_chat_share_pii_with_llms: boolean;
  ai_data_sharing_consented_by: string | null;
  ai_data_sharing_consented_at: string | null;
  org_context_markdown: string;
  org_context_updated_by: string | null;
  org_context_updated_at: string | null;
  dbt_configured: boolean;
  metadata_last_built_at: string | null;
  metadata_ready_dashboard_count: number;
  metadata_total_dashboard_count: number;
}

export interface OrgDashboardAIChatStatus {
  feature_flag_enabled: boolean;
  ai_data_sharing_enabled: boolean;
  chat_available: boolean;
  dbt_configured: boolean;
  metadata_last_built_at: string | null;
  metadata_ready_dashboard_count: number;
  metadata_total_dashboard_count: number;
}

export interface DashboardMetadataStatusItem {
  dashboard_id: number;
  dashboard_title: string;
  status: string;
  table_count: number;
  chart_count: number;
  builder_model: string;
  source_fingerprint: string;
  built_at: string | null;
  error_message: string | null;
}

export interface OrgDashboardAIChatMetadataStatus {
  dashboards: DashboardMetadataStatusItem[];
  total_dashboard_count: number;
  ready_dashboard_count: number;
  failed_dashboard_count: number;
  stale_dashboard_count: number;
  missing_dashboard_count: number;
  last_built_at: string | null;
}

export interface DashboardAIContext {
  dashboard_id: number;
  dashboard_title: string;
  dashboard_context_markdown: string;
  dashboard_context_updated_by: string | null;
  dashboard_context_updated_at: string | null;
  metadata_last_built_at: string | null;
}

export interface DashboardChatBootstrap {
  dashboard_id: number;
  suggested_prompts: string[];
}

export interface UpdateOrgDashboardAIChatPayload {
  ai_data_sharing_enabled?: boolean;
  dashboard_chat_share_pii_with_llms?: boolean;
  org_context_markdown?: string;
}

export interface UpdateDashboardAIContextPayload {
  dashboard_context_markdown: string;
}

export interface TriggerDashboardMetadataBuildPayload {
  dashboard_id?: number;
  builder_model?: string;
}

export interface DashboardChatPIIColumn {
  dashboard_id: number;
  dashboard_title: string;
  schema_name: string;
  table_name: string;
  full_table_name: string;
  model_name: string;
  column_name: string;
  data_type: string;
  description: string;
  semantic_role: string;
  value_semantics: string;
  inferred_pii: boolean;
  override_pii: boolean | null;
  effective_pii: boolean;
}

export interface DashboardChatPIIColumnsResponse {
  columns: DashboardChatPIIColumn[];
  total_column_count: number;
  pii_column_count: number;
}

export interface UpdateDashboardChatPIIOverridesPayload {
  overrides: Array<{
    schema_name: string;
    table_name: string;
    column_name: string;
    pii: boolean;
  }>;
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

export function useDashboardMetadataStatus(enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<OrgDashboardAIChatMetadataStatus>(
    enabled ? '/api/orgpreferences/ai-dashboard-chat/metadata/status' : null,
    apiGet,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    status: data,
    isLoading,
    error,
    mutate,
  };
}

export function useDashboardPIIColumns(enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<DashboardChatPIIColumnsResponse>(
    enabled ? '/api/orgpreferences/ai-dashboard-chat/pii-columns' : null,
    apiGet,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    piiColumns: data,
    isLoading,
    error,
    mutate,
  };
}

export function useDashboardChatBootstrap(dashboardId: number | null, enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<DashboardChatBootstrap>(
    enabled && dashboardId ? `/api/dashboards/${dashboardId}/chat-bootstrap/` : null,
    apiGet,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    bootstrap: data,
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

  const buildDashboardMetadata = async (payload: TriggerDashboardMetadataBuildPayload) => {
    try {
      return (await apiPost(
        '/api/orgpreferences/ai-dashboard-chat/metadata/build',
        payload
      )) as OrgDashboardAIChatMetadataStatus;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to build dashboard chat metadata';
      toast.error(message);
      throw error;
    }
  };

  const updatePIIColumnOverrides = async (payload: UpdateDashboardChatPIIOverridesPayload) => {
    try {
      return (await apiPut(
        '/api/orgpreferences/ai-dashboard-chat/pii-columns',
        payload
      )) as DashboardChatPIIColumnsResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update PII column review';
      toast.error(message);
      throw error;
    }
  };

  return {
    updateSettings,
    updateDashboardContext,
    buildDashboardMetadata,
    updatePIIColumnOverrides,
  };
}
