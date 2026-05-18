// Report Types

import type { Dashboard } from '@/hooks/api/useDashboards';

export interface DateColumn {
  schema_name: string;
  table_name: string;
  column_name: string;
}

export interface ReportSnapshot {
  id: number;
  title: string;
  dashboard_title?: string;
  date_column?: DateColumn;
  period_start?: string;
  period_end: string;
  summary?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface FrozenChartConfig {
  id: number;
  title: string;
  description?: string;
  chart_type: string;
  schema_name: string;
  table_name: string;
  extra_config: Record<string, unknown>;
}

export interface ReportMetadata {
  snapshot_id: number;
  title: string;
  date_column?: DateColumn;
  period_start?: string;
  period_end: string;
  summary?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  last_modified_by?: string;
  dashboard_title: string;
  dashboard_id?: number;
}

export interface SnapshotViewData {
  dashboard_data: Dashboard;
  report_metadata: ReportMetadata;
  frozen_chart_configs: Record<string, FrozenChartConfig>;
}

export interface DiscoveredDatetimeColumn {
  schema_name: string;
  table_name: string;
  column_name: string;
  data_type: string;
  is_dashboard_filter: boolean;
}

export interface CreateSnapshotPayload {
  title: string;
  dashboard_id: number;
  date_column?: DateColumn;
  period_start?: string;
  period_end?: string;
  description?: string;
}

export interface ShareStatus {
  is_public: boolean;
  public_url?: string;
  public_access_count: number;
  last_public_accessed?: string;
  public_shared_at?: string;
}
