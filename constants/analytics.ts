// Analytics event names. Convention: snake_case, `category:object_action`,
// fixed strings only. Never interpolate variables into names — pass them as
// properties to trackEvent instead (keeps the PostHog event list filterable).
export const ANALYTICS_EVENTS = {
  // Auth & onboarding
  USER_LOGGED_IN: 'auth:user_logged_in',
  USER_LOGGED_OUT: 'auth:user_logged_out',
  ORG_SWITCHED: 'auth:org_switched',
  RBAC_NOTICE_VIEWED: 'onboarding:rbac_notice_viewed',
  RBAC_NOTICE_DISMISSED: 'onboarding:rbac_notice_dismissed',
  // Guided product tour (driver.js) for trial-plan orgs — see components/onboarding/tour-gate.tsx
  TOUR_INTENT_MODAL_VIEWED: 'onboarding:tour_intent_modal_viewed',
  // Carries { choice: 'tour' | 'insight' | 'pipeline' | 'close' } — which option was picked.
  TOUR_INTENT_MODAL_DISMISSED: 'onboarding:tour_intent_modal_dismissed',
  TOUR_STARTED: 'onboarding:tour_started',
  // Carries { step, title } — 1-based step number.
  TOUR_STEP_VIEWED: 'onboarding:tour_step_viewed',
  // Carries { step } — the step the user was on when they clicked Skip.
  TOUR_SKIPPED: 'onboarding:tour_skipped',
  TOUR_COMPLETED: 'onboarding:tour_completed',
  GETTING_STARTED_TOUR_LINK_CLICKED: 'onboarding:getting_started_tour_link_clicked',
  // The docs link that replaces the tour link in the widget's all-done state.
  GETTING_STARTED_DOCS_LINK_CLICKED: 'onboarding:getting_started_docs_link_clicked',
  // Carries { item: 'build-insight' | 'automate-pipeline' } — which checklist row was
  // clicked. What it then does (open the fork dialog, resume, start a flow) depends on
  // walkthrough state and is covered by that flow's own events.
  GETTING_STARTED_ITEM_CLICKED: 'onboarding:getting_started_item_clicked',
  GETTING_STARTED_VIDEO_PLAYED: 'onboarding:getting_started_video_played',
  // The "Schedule a call with us" / "Book a call" link out to the Dalgo team's booking page.
  // Carries { source: 'widget' | 'nudge' } — the widget row vs the trial nudge modals, which
  // fire at very different moments of the trial and convert differently.
  BOOK_A_CALL_CLICKED: 'onboarding:book_a_call_clicked',
  // The GetStartedModal's 'choice' screen — shown only when the tour is finished via its
  // last step's "Finish Tour" button, not on Skip.
  POST_TOUR_MODAL_VIEWED: 'onboarding:post_tour_modal_viewed',
  // Carries { choice: 'insight' | 'pipeline' | 'close' } — which option was picked.
  POST_TOUR_MODAL_DISMISSED: 'onboarding:post_tour_modal_dismissed',
  // The GetStartedModal's 'insight' screen (sample vs own data). Carries
  // { entry: 'post_tour' | 'widget' | 'resume' } — how the user got to it.
  INSIGHT_FORK_MODAL_VIEWED: 'onboarding:insight_fork_modal_viewed',
  // Carries { choice: 'sample' | 'own_data' } — which fork was taken.
  INSIGHT_FORK_CHOSEN: 'onboarding:insight_fork_chosen',
  // The two walkthrough celebration dialogs (see celebration-modal.tsx). Both carry
  // { choice: 'cta' | 'close' }.
  KPI_LIVE_MODAL_DISMISSED: 'onboarding:kpi_live_modal_dismissed',
  CHART_LIVE_MODAL_DISMISSED: 'onboarding:chart_live_modal_dismissed',
  PIPELINE_LIVE_MODAL_DISMISSED: 'onboarding:pipeline_live_modal_dismissed',
  DASHBOARD_LIVE_MODAL_DISMISSED: 'onboarding:dashboard_live_modal_dismissed',
  // Sample-data insight walkthrough (Fork2 -> KPI created -> dashboard shared)
  INSIGHT_WALKTHROUGH_STARTED: 'onboarding:insight_walkthrough_started',
  // Carries { stage } — the stage that was just shown.
  INSIGHT_WALKTHROUGH_STEP_VIEWED: 'onboarding:insight_walkthrough_step_viewed',
  INSIGHT_WALKTHROUGH_COMPLETED: 'onboarding:insight_walkthrough_completed',
  // Carries { stage } — the stage the user was on when they skipped.
  INSIGHT_WALKTHROUGH_SKIPPED: 'onboarding:insight_walkthrough_skipped',
  // One-shot feature coachmarks on /reports, /alerts and /metrics — no flow, no ordering.
  // Both carry { nudge: 'reports_nudge' | 'alerts_nudge' | 'metrics_nudge' }. VIEWED can
  // fire on repeat visits (the nudge returns until dismissed); DISMISSED fires once.
  FEATURE_NUDGE_VIEWED: 'onboarding:feature_nudge_viewed',
  FEATURE_NUDGE_DISMISSED: 'onboarding:feature_nudge_dismissed',
  // Free trial onboarding
  TRIAL_SIGNUP_SUBMITTED: 'trial:signup_submitted',
  // Verification link re-sent from the check-your-email card (re-POSTs signup).
  TRIAL_LINK_RESENT: 'trial:link_resent',
  TRIAL_ACTIVATED: 'trial:trial_activated',
  // A failed clone was re-enqueued. Carries { from: 'failed' | 'timeout' } — which
  // fallback card the user retried from.
  TRIAL_RETRY_TRIGGERED: 'trial:retry_triggered',
  TRIAL_CLONE_COMPLETED: 'trial:clone_completed',
  TRIAL_CLONE_FAILED: 'trial:clone_failed',
  // Clone succeeded but auto-login could not run (login call failed, or the
  // stashed creds were missing e.g. after a reload) — user must log in manually.
  TRIAL_MANUAL_LOGIN_REQUIRED: 'trial:manual_login_required',
  // Status polling gave up (too many consecutive failures or hard timeout) before
  // a terminal clone status arrived — screen fell back from the spinner.
  TRIAL_POLL_TIMEOUT: 'trial:poll_timeout',
  // An upgrade CTA opened the confirm modal. Carries { days_left, source } — `source` is the
  // surface it was opened from ('header_badge' | 'trial_nudge'), which is what tells us which
  // one converts now that the Settings → Billing page is gone.
  SUBSCRIPTION_REQUEST_OPENED: 'trial:subscription_request_opened',
  // The request POST succeeded. Carries { days_left, already_requested, source }.
  SUBSCRIPTION_REQUEST_SENT: 'trial:subscription_request_sent',
  // Breadth — every menu / submenu / tab
  FEATURE_VIEWED: 'feature:viewed',
  // Charts (CHART_SAVED is the edit/update event)
  CHART_CREATED: 'chart:chart_created',
  CHART_VIEWED: 'chart:chart_viewed',
  CHART_SAVED: 'chart:chart_saved',
  CHART_DELETED: 'chart:chart_deleted',
  CHART_DUPLICATED: 'chart:chart_duplicated',
  CHARTS_BULK_DELETED: 'chart:charts_bulk_deleted',
  CHART_SAVED_AS_NEW: 'chart:chart_saved_as_new',
  CHART_EXPORTED: 'chart:chart_exported',
  // Selection-intent (funnel): which chart types users pick in the builder,
  // distinct from CHART_CREATED which only fires if they actually save.
  CHART_TYPE_SELECTED: 'chart:chart_type_selected',
  // Dashboards (DASHBOARD_SAVED is the edit/update event)
  DASHBOARD_CREATED: 'dashboard:dashboard_created',
  DASHBOARD_SAVED: 'dashboard:dashboard_saved',
  DASHBOARD_DELETED: 'dashboard:dashboard_deleted',
  DASHBOARD_DUPLICATED: 'dashboard:dashboard_duplicated',
  DASHBOARD_VIEWED: 'dashboard:dashboard_viewed',
  DASHBOARD_SHARED: 'dashboard:dashboard_shared',
  DASHBOARD_EMBED_CODE_COPIED: 'dashboard:embed_code_copied',
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
  KPI_VIEWED: 'kpi:kpi_viewed',
  KPI_UPDATED: 'kpi:kpi_updated',
  KPI_DELETED: 'kpi:kpi_deleted',
  KPI_ANNOTATION_CREATED: 'kpi:annotation_created',
  KPI_ANNOTATION_UPDATED: 'kpi:annotation_updated',
  KPI_ANNOTATION_DELETED: 'kpi:annotation_deleted',
  KPI_WIZARD_STEP_VIEWED: 'kpi:wizard_step_viewed',
  METRIC_USED: 'metric:metric_used',
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
  CONNECTION_ADVANCED_OPTIONS_EXPANDED: 'connection:advanced_options_expanded',
  SOURCE_CREATED: 'source:source_created',
  SOURCE_UPDATED: 'source:source_updated',
  SOURCE_DELETED: 'source:source_deleted',
  SOURCE_OAUTH_STARTED: 'source:oauth_started',
  SOURCE_OAUTH_CONNECTED: 'source:oauth_connected',
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
  // Fired when a table click is blocked by RBAC (no warehouse-data read permission)
  EXPLORE_TABLE_SELECTION_DENIED: 'explore:table_selection_denied',
  // Warehouse table data preview pane (shared by Explore + Transform canvas)
  DATA_TABLE_DOWNLOADED: 'data:table_downloaded',
  // Alerts
  ALERT_CREATED: 'alert:alert_created',
  ALERT_UPDATED: 'alert:alert_updated',
  ALERT_DELETED: 'alert:alert_deleted',
  ALERT_TOGGLED: 'alert:alert_toggled',
  ALERT_SLACK_WEBHOOK_TESTED: 'alert:slack_webhook_tested',
  ALERT_LOGS_VIEWED: 'alert:logs_viewed',
  // Data quality (Elementary-based)
  DATA_QUALITY_SETUP_COMPLETED: 'data_quality:setup_completed',
  DATA_QUALITY_REPORT_GENERATED: 'data_quality:report_generated',
  // Settings — user management & org
  USER_INVITED: 'settings:user_invited',
  BRANDING_LOGO_SAVED: 'settings:branding_logo_saved',
  BRANDING_LOGO_REMOVED: 'settings:branding_logo_removed',
  INVITATION_RESENT: 'settings:invitation_resent',
  INVITATION_DELETED: 'settings:invitation_deleted',
  INVITATION_ACCEPTED: 'settings:invitation_accepted',
  USER_ROLE_CHANGED: 'settings:user_role_changed',
  USER_DELETED: 'settings:user_deleted',
  ORG_CREATED: 'settings:org_created',
  // Auth / account
  PASSWORD_CHANGED: 'auth:password_changed',
  // Notifications
  NOTIFICATION_PREFERENCES_UPDATED: 'notification:preferences_updated',
  NOTIFICATIONS_ALL_READ: 'notification:all_marked_read',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

// Value actions — "creating or consuming insight" (spec §2.1). Every event here
// is auto-stamped with `is_value_action: true` by trackEvent, so the North Star
// ("unique users doing ≥1 value action") is one PostHog filter
// (is_value_action = true) instead of a hand-maintained list of event names.
// Add a new value event HERE and it's counted automatically — nothing to change
// in PostHog. Plumbing (pipeline/connection/source/warehouse/transform), config
// (alert toggle, set-as-landing), deletes, and granular dashboard sub-edits
// (DASHBOARD_SAVED already covers the edit) are deliberately NOT value actions.
export const VALUE_ACTION_EVENTS: ReadonlySet<AnalyticsEvent> = new Set([
  // Charts — view / edit / create / export
  ANALYTICS_EVENTS.CHART_VIEWED,
  ANALYTICS_EVENTS.CHART_CREATED,
  ANALYTICS_EVENTS.CHART_SAVED,
  ANALYTICS_EVENTS.CHART_SAVED_AS_NEW,
  ANALYTICS_EVENTS.CHART_DUPLICATED,
  ANALYTICS_EVENTS.CHART_EXPORTED,
  // Dashboards — view / edit / create / share
  ANALYTICS_EVENTS.DASHBOARD_VIEWED,
  ANALYTICS_EVENTS.DASHBOARD_CREATED,
  ANALYTICS_EVENTS.DASHBOARD_SAVED,
  ANALYTICS_EVENTS.DASHBOARD_DUPLICATED,
  ANALYTICS_EVENTS.DASHBOARD_SHARED,
  // Reports — view / edit / create / share / export / comment
  ANALYTICS_EVENTS.REPORT_VIEWED,
  ANALYTICS_EVENTS.REPORT_CREATED,
  ANALYTICS_EVENTS.REPORT_UPDATED,
  ANALYTICS_EVENTS.REPORT_SHARED,
  ANALYTICS_EVENTS.REPORT_EXPORTED,
  ANALYTICS_EVENTS.REPORT_COMMENT_CREATED,
  // KPIs — view / edit / create / annotate
  ANALYTICS_EVENTS.KPI_VIEWED,
  ANALYTICS_EVENTS.KPI_CREATED,
  ANALYTICS_EVENTS.KPI_UPDATED,
  ANALYTICS_EVENTS.KPI_ANNOTATION_CREATED,
  ANALYTICS_EVENTS.KPI_ANNOTATION_UPDATED,
  // Metrics — use (consume) / edit / create
  ANALYTICS_EVENTS.METRIC_USED,
  ANALYTICS_EVENTS.METRIC_CREATED,
  ANALYTICS_EVENTS.METRIC_UPDATED,
  // Alerts — edit / create
  ANALYTICS_EVENTS.ALERT_CREATED,
  ANALYTICS_EVENTS.ALERT_UPDATED,
]);

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
  SETTINGS_USER_MANAGEMENT: 'settings_user_management',
  SETTINGS_SUPERSET_USAGE: 'settings_superset_usage',
  SETTINGS_BRANDING: 'settings_branding',
  // Pre-auth free-trial screens. Three separate features (not one `free_trial`)
  // because useFeatureTracking dedupes on the FEATURE, not the pathname — a single
  // id would make the three screens indistinguishable and destroy the funnel.
  FREE_TRIAL_SIGNUP: 'free_trial_signup',
  FREE_TRIAL_ACTIVATE: 'free_trial_activate',
  FREE_TRIAL_CONSENT: 'free_trial_consent',
  FREE_TRIAL_PROGRESS: 'free_trial_progress',
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
  { prefix: '/settings/user-management', feature: FEATURES.SETTINGS_USER_MANAGEMENT },
  { prefix: '/settings/branding', feature: FEATURES.SETTINGS_BRANDING },
  { prefix: '/free-trial/activate', feature: FEATURES.FREE_TRIAL_ACTIVATE },
  { prefix: '/free-trial/consent', feature: FEATURES.FREE_TRIAL_CONSENT },
  { prefix: '/free-trial/progress', feature: FEATURES.FREE_TRIAL_PROGRESS },
  { prefix: '/free-trial', feature: FEATURES.FREE_TRIAL_SIGNUP },
];

export function featureForPathname(pathname: string): Feature | null {
  const match = PATHNAME_TO_FEATURE.find(
    (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`)
  );
  return match ? match.feature : null;
}
