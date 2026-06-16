// Analytics event names. Convention: snake_case, `category:object_action`,
// fixed strings only. Never interpolate variables into names — pass them as
// properties to trackEvent instead (keeps the PostHog event list filterable).
export const ANALYTICS_EVENTS = {
  // Auth & onboarding
  USER_LOGGED_IN: 'auth:user_logged_in',
  USER_LOGGED_OUT: 'auth:user_logged_out',
  ORG_SWITCHED: 'auth:org_switched',
  // Breadth — every menu / submenu / tab
  FEATURE_VIEWED: 'feature:viewed',
  // Charts (CHART_SAVED is the edit/update event)
  CHART_CREATED: 'chart:chart_created',
  CHART_SAVED: 'chart:chart_saved',
  CHART_DELETED: 'chart:chart_deleted',
  CHART_DUPLICATED: 'chart:chart_duplicated',
  CHARTS_BULK_DELETED: 'chart:charts_bulk_deleted',
  CHART_SAVED_AS_NEW: 'chart:chart_saved_as_new',
  CHART_EXPORTED: 'chart:chart_exported',
  // Dashboards (DASHBOARD_SAVED is the edit/update event)
  DASHBOARD_CREATED: 'dashboard:dashboard_created',
  DASHBOARD_SAVED: 'dashboard:dashboard_saved',
  DASHBOARD_DELETED: 'dashboard:dashboard_deleted',
  DASHBOARD_DUPLICATED: 'dashboard:dashboard_duplicated',
  DASHBOARD_VIEWED: 'dashboard:dashboard_viewed',
  DASHBOARD_SHARED: 'dashboard:dashboard_shared',
  DASHBOARD_SET_AS_LANDING: 'dashboard:dashboard_set_as_landing',
  DASHBOARD_CHART_ADDED: 'dashboard:chart_added',
  DASHBOARD_KPI_ADDED: 'dashboard:kpi_added',
  DASHBOARD_ELEMENT_REMOVED: 'dashboard:element_removed',
  DASHBOARD_FILTER_CREATED: 'dashboard:filter_created',
  DASHBOARD_FILTER_UPDATED: 'dashboard:filter_updated',
  DASHBOARD_FILTER_DELETED: 'dashboard:filter_deleted',
  DASHBOARD_TEXT_ELEMENT_ADDED: 'dashboard:text_element_added',
  DASHBOARD_TAB_CREATED: 'dashboard:tab_created',
  DASHBOARD_TAB_DELETED: 'dashboard:tab_deleted',
  // Reports
  REPORT_CREATED: 'report:report_created',
  REPORT_UPDATED: 'report:report_updated',
  REPORT_DELETED: 'report:report_deleted',
  REPORT_VIEWED: 'report:report_viewed',
  REPORT_SHARED: 'report:report_shared',
  REPORT_EXPORTED: 'report:report_exported',
  REPORT_COMMENT_CREATED: 'report:comment_created',
  REPORT_COMMENT_UPDATED: 'report:comment_updated',
  REPORT_COMMENT_DELETED: 'report:comment_deleted',
  // KPIs & metrics
  KPI_CREATED: 'kpi:kpi_created',
  KPI_UPDATED: 'kpi:kpi_updated',
  KPI_DELETED: 'kpi:kpi_deleted',
  KPI_ANNOTATION_CREATED: 'kpi:annotation_created',
  KPI_ANNOTATION_UPDATED: 'kpi:annotation_updated',
  KPI_ANNOTATION_DELETED: 'kpi:annotation_deleted',
  METRIC_CREATED: 'metric:metric_created',
  METRIC_UPDATED: 'metric:metric_updated',
  METRIC_DELETED: 'metric:metric_deleted',
  // Ingest
  CONNECTION_CREATED: 'connection:connection_created',
  CONNECTION_UPDATED: 'connection:connection_updated',
  CONNECTION_DELETED: 'connection:connection_deleted',
  CONNECTION_SYNC_TRIGGERED: 'connection:connection_sync_triggered',
  CONNECTION_RESET: 'connection:connection_reset',
  CONNECTION_SYNC_CANCELLED: 'connection:sync_cancelled',
  CONNECTION_SCHEMA_CHANGES_APPLIED: 'connection:schema_changes_applied',
  CONNECTION_LOG_SUMMARY_REQUESTED: 'connection:log_summary_requested',
  SOURCE_CREATED: 'source:source_created',
  SOURCE_UPDATED: 'source:source_updated',
  SOURCE_DELETED: 'source:source_deleted',
  WAREHOUSE_CREATED: 'warehouse:warehouse_created',
  WAREHOUSE_UPDATED: 'warehouse:warehouse_updated',
  WAREHOUSE_DELETED: 'warehouse:warehouse_deleted',
  // Transform (dbt + UI4T canvas)
  DBT_RUN_TRIGGERED: 'transform:dbt_run_triggered',
  TRANSFORM_GITHUB_CONNECTED: 'transform:github_connected',
  TRANSFORM_GITHUB_REPO_UPDATED: 'transform:github_repo_updated',
  TRANSFORM_SCHEMA_UPDATED: 'transform:schema_updated',
  TRANSFORM_SOURCE_ADDED: 'transform:source_added',
  TRANSFORM_MODEL_CREATED: 'transform:model_created',
  TRANSFORM_MODEL_DELETED: 'transform:model_deleted',
  TRANSFORM_OPERATION_CREATED: 'transform:operation_created',
  TRANSFORM_OPERATION_UPDATED: 'transform:operation_updated',
  TRANSFORM_OPERATION_DELETED: 'transform:operation_deleted',
  TRANSFORM_CHANGES_PUBLISHED: 'transform:changes_published',
  TRANSFORM_CHANGES_DISCARDED: 'transform:changes_discarded',
  TRANSFORM_GIT_PAT_SAVED: 'transform:git_pat_saved',
  TRANSFORM_DATA_PREVIEWED: 'transform:data_previewed',
  TRANSFORM_DATA_STATISTICS_VIEWED: 'transform:data_statistics_viewed',
  TRANSFORM_CUSTOM_TASK_CREATED: 'transform:custom_task_created',
  TRANSFORM_CUSTOM_TASK_DELETED: 'transform:custom_task_deleted',
  TRANSFORM_DBT_TASK_TRIGGERED: 'transform:dbt_task_triggered',
  // Orchestrate (pipelines)
  PIPELINE_CREATED: 'pipeline:pipeline_created',
  PIPELINE_UPDATED: 'pipeline:pipeline_updated',
  PIPELINE_DELETED: 'pipeline:pipeline_deleted',
  PIPELINE_TRIGGERED: 'pipeline:pipeline_triggered',
  PIPELINE_SCHEDULE_TOGGLED: 'pipeline:schedule_toggled',
  PIPELINE_LOGS_VIEWED: 'pipeline:logs_viewed',
  PIPELINE_LOG_SUMMARY_REQUESTED: 'pipeline:log_summary_requested',
  // Explore
  EXPLORE_TABLE_PREVIEWED: 'explore:table_previewed',
  EXPLORE_SYNCED: 'explore:synced',
  // Warehouse table data preview pane (shared by Explore + Transform canvas)
  DATA_TABLE_DOWNLOADED: 'data:table_downloaded',
  // Data quality (Elementary-based)
  DATA_QUALITY_SETUP_COMPLETED: 'data_quality:setup_completed',
  DATA_QUALITY_REPORT_GENERATED: 'data_quality:report_generated',
  // Settings — user management & org
  USER_INVITED: 'settings:user_invited',
  INVITATION_RESENT: 'settings:invitation_resent',
  INVITATION_DELETED: 'settings:invitation_deleted',
  INVITATION_ACCEPTED: 'settings:invitation_accepted',
  USER_ROLE_CHANGED: 'settings:user_role_changed',
  USER_DELETED: 'settings:user_deleted',
  ORG_CREATED: 'settings:org_created',
  BILLING_UPGRADE_REQUESTED: 'settings:billing_upgrade_requested',
  // Auth / account
  PASSWORD_CHANGED: 'auth:password_changed',
  // Notifications
  NOTIFICATION_PREFERENCES_UPDATED: 'notification:preferences_updated',
  NOTIFICATIONS_ALL_READ: 'notification:all_marked_read',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

// Stable feature identifiers for the feature:viewed breadth event. One per
// nav item / submenu (see components/main-layout.tsx).
export const FEATURES = {
  IMPACT: 'impact',
  KPIS: 'kpis',
  CHARTS: 'charts',
  DASHBOARDS: 'dashboards',
  REPORTS: 'reports',
  DATA_OVERVIEW: 'data_overview',
  INGEST: 'ingest',
  TRANSFORM: 'transform',
  ORCHESTRATE: 'orchestrate',
  EXPLORE: 'explore',
  METRICS: 'metrics',
  DATA_QUALITY: 'data_quality',
  ALERTS: 'alerts',
  NOTIFICATIONS: 'notifications',
  SETTINGS_BILLING: 'settings_billing',
  SETTINGS_USER_MANAGEMENT: 'settings_user_management',
  SETTINGS_ABOUT: 'settings_about',
  SETTINGS_SUPERSET_USAGE: 'settings_superset_usage',
} as const;

export type Feature = (typeof FEATURES)[keyof typeof FEATURES];

// Maps an exact pathname (or its first matching prefix) to a feature. Used by
// useFeatureTracking to fire feature:viewed on navigation. Order matters:
// longer/more-specific prefixes first.
export const PATHNAME_TO_FEATURE: ReadonlyArray<{ prefix: string; feature: Feature }> = [
  { prefix: '/impact', feature: FEATURES.IMPACT },
  { prefix: '/kpis', feature: FEATURES.KPIS },
  { prefix: '/charts', feature: FEATURES.CHARTS },
  { prefix: '/dashboards/usage', feature: FEATURES.SETTINGS_SUPERSET_USAGE },
  { prefix: '/dashboards', feature: FEATURES.DASHBOARDS },
  { prefix: '/reports', feature: FEATURES.REPORTS },
  { prefix: '/pipeline', feature: FEATURES.DATA_OVERVIEW },
  { prefix: '/ingest', feature: FEATURES.INGEST },
  { prefix: '/transform', feature: FEATURES.TRANSFORM },
  { prefix: '/orchestrate', feature: FEATURES.ORCHESTRATE },
  { prefix: '/explore', feature: FEATURES.EXPLORE },
  { prefix: '/metrics', feature: FEATURES.METRICS },
  { prefix: '/data-quality', feature: FEATURES.DATA_QUALITY },
  { prefix: '/alerts', feature: FEATURES.ALERTS },
  { prefix: '/notifications', feature: FEATURES.NOTIFICATIONS },
  { prefix: '/settings/billing', feature: FEATURES.SETTINGS_BILLING },
  { prefix: '/settings/user-management', feature: FEATURES.SETTINGS_USER_MANAGEMENT },
  { prefix: '/settings/about', feature: FEATURES.SETTINGS_ABOUT },
];

export function featureForPathname(pathname: string): Feature | null {
  const match = PATHNAME_TO_FEATURE.find(
    (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`)
  );
  return match ? match.feature : null;
}
