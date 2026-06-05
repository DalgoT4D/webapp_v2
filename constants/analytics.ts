// Analytics event names. Convention: snake_case, `category:object_action`,
// fixed strings only. Never interpolate variables into names — pass them as
// properties to trackEvent instead (keeps the PostHog event list filterable).
export const ANALYTICS_EVENTS = {
  // Auth & onboarding
  USER_LOGGED_IN: 'auth:user_logged_in',
  USER_LOGGED_OUT: 'auth:user_logged_out',
  ORG_SWITCHED: 'auth:org_switched',
  // Charts
  CHART_CREATED: 'chart:chart_created',
  CHART_SAVED: 'chart:chart_saved',
  CHART_EXPORTED: 'chart:chart_exported',
  // Dashboards
  DASHBOARD_CREATED: 'dashboard:dashboard_created',
  DASHBOARD_SAVED: 'dashboard:dashboard_saved',
  DASHBOARD_VIEWED: 'dashboard:dashboard_viewed',
  DASHBOARD_SHARED: 'dashboard:dashboard_shared',
  // Pipelines & data
  CONNECTION_CREATED: 'connection:connection_created',
  PIPELINE_TRIGGERED: 'pipeline:pipeline_triggered',
  DBT_RUN_TRIGGERED: 'transform:dbt_run_triggered',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
