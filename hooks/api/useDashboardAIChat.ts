'use client';

import useSWR from 'swr';
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
    data: data?.res,
    settings: data?.res,
    isLoading,
    isError: error,
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
    data: data?.res,
    status: data?.res,
    isLoading,
    isError: error,
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
    data,
    context: data,
    isLoading,
    isError: error,
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
    data,
    status: data,
    isLoading,
    isError: error,
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
    data,
    piiColumns: data,
    isLoading,
    isError: error,
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
    data,
    bootstrap: data,
    isLoading,
    isError: error,
    error,
    mutate,
  };
}

export function useDashboardAIChatActions() {
  const updateSettings = async (payload: UpdateOrgDashboardAIChatPayload) => {
    const response = await apiPut('/api/orgpreferences/ai-dashboard-chat', payload);
    return (response as SuccessResponse<OrgDashboardAIChatSettings>).res;
  };

  const updateDashboardContext = async (
    dashboardId: number,
    payload: UpdateDashboardAIContextPayload
  ) => {
    return (await apiPut(
      `/api/dashboards/${dashboardId}/ai-context/`,
      payload
    )) as DashboardAIContext;
  };

  const buildDashboardMetadata = async (payload: TriggerDashboardMetadataBuildPayload) => {
    return (await apiPost(
      '/api/orgpreferences/ai-dashboard-chat/metadata/build',
      payload
    )) as OrgDashboardAIChatMetadataStatus;
  };

  const updatePIIColumnOverrides = async (payload: UpdateDashboardChatPIIOverridesPayload) => {
    return (await apiPut(
      '/api/orgpreferences/ai-dashboard-chat/pii-columns',
      payload
    )) as DashboardChatPIIColumnsResponse;
  };

  return {
    updateSettings,
    updateDashboardContext,
    buildDashboardMetadata,
    updatePIIColumnOverrides,
  };
}
