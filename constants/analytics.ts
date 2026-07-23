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
  // Charts
  CHART_CREATED: 'chart:chart_created',
  CHART_SAVED: 'chart:chart_saved',
  CHART_EXPORTED: 'chart:chart_exported',
  // Dashboards
  DASHBOARD_CREATED: 'dashboard:dashboard_created',
  DASHBOARD_SAVED: 'dashboard:dashboard_saved',
  DASHBOARD_VIEWED: 'dashboard:dashboard_viewed',
  DASHBOARD_SHARED: 'dashboard:dashboard_shared',
  DASHBOARD_SET_AS_LANDING: 'dashboard:dashboard_set_as_landing',
  // Reports
  REPORT_CREATED: 'report:report_created',
  REPORT_VIEWED: 'report:report_viewed',
  REPORT_SHARED: 'report:report_shared',
  // KPIs & metrics
  KPI_CREATED: 'kpi:kpi_created',
  METRIC_CREATED: 'metric:metric_created',
  // Ingest
  CONNECTION_CREATED: 'connection:connection_created',
  CONNECTION_SYNC_TRIGGERED: 'connection:connection_sync_triggered',
  SOURCE_CREATED: 'source:source_created',
  WAREHOUSE_CREATED: 'warehouse:warehouse_created',
  // Transform
  DBT_RUN_TRIGGERED: 'transform:dbt_run_triggered',
  TRANSFORM_GITHUB_CONNECTED: 'transform:github_connected',
  TRANSFORM_OPERATION_CREATED: 'transform:operation_created',
  TRANSFORM_MODEL_CREATED: 'transform:model_created',
  // Orchestrate (pipelines)
  PIPELINE_CREATED: 'pipeline:pipeline_created',
  PIPELINE_TRIGGERED: 'pipeline:pipeline_triggered',
  // Explore
  EXPLORE_TABLE_PREVIEWED: 'explore:table_previewed',
  EXPLORE_SYNCED: 'explore:synced',
  // Data quality (Elementary-based)
  DATA_QUALITY_SETUP_COMPLETED: 'data_quality:setup_completed',
  DATA_QUALITY_REPORT_GENERATED: 'data_quality:report_generated',
  // Settings
  USER_INVITED: 'settings:user_invited',
  // Notifications
  NOTIFICATION_PREFERENCES_UPDATED: 'notification:preferences_updated',
  // Admin portal — a separate, higher-privilege surface with its own session,
  // so its sign-in is tracked apart from auth:user_logged_in.
  ADMIN_LOGGED_IN: 'admin:admin_logged_in',
  ADMIN_LOGIN_FAILED: 'admin:admin_login_failed',
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
  ADMIN_LOGIN: 'admin_login',
  ADMIN_PORTAL: 'admin_portal',
  ADMIN_ORGANIZATIONS: 'admin_organizations',
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
  // more specific first: /admin/login is the public sign-in, not the portal itself
  { prefix: '/admin/login', feature: FEATURES.ADMIN_LOGIN },
  { prefix: '/admin/organizations', feature: FEATURES.ADMIN_ORGANIZATIONS },
  { prefix: '/admin', feature: FEATURES.ADMIN_PORTAL },
];

export function featureForPathname(pathname: string): Feature | null {
  const match = PATHNAME_TO_FEATURE.find(
    (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`)
  );
  return match ? match.feature : null;
}
