// Analytics event names. Convention: snake_case, `category:object_action`,
// fixed strings only. Never interpolate variables into names — pass them as
// properties to trackEvent instead (keeps the PostHog event list filterable).
export const ANALYTICS_EVENTS = {
  // Auth & onboarding
  USER_LOGGED_IN: 'auth:user_logged_in',
  USER_LOGGED_OUT: 'auth:user_logged_out',
  ORG_SWITCHED: 'auth:org_switched',
  RESOURCE_SHARING_NOTICE_VIEWED: 'trial_onboarding:resource_sharing_notice_viewed',
  RESOURCE_SHARING_NOTICE_DISMISSED: 'trial_onboarding:resource_sharing_notice_dismissed',
  // Guided product tour (driver.js) for trial-plan orgs — see components/onboarding/tour-gate.tsx
  TOUR_INTENT_MODAL_VIEWED: 'trial_onboarding:tour_intent_modal_viewed',
  // Carries { choice: 'tour' | 'insight' | 'pipeline' | 'close' } — which option was picked.
  TOUR_INTENT_MODAL_DISMISSED: 'trial_onboarding:tour_intent_modal_dismissed',
  TOUR_STARTED: 'trial_onboarding:tour_started',
  // Carries { step, title } — 1-based step number.
  TOUR_STEP_VIEWED: 'trial_onboarding:tour_step_viewed',
  // Carries { step } — the step the user was on when they clicked Skip.
  TOUR_SKIPPED: 'trial_onboarding:tour_skipped',
  TOUR_COMPLETED: 'trial_onboarding:tour_completed',
  GETTING_STARTED_TOUR_LINK_CLICKED: 'trial_onboarding:getting_started_tour_link_clicked',
  // The docs link that replaces the tour link in the widget's all-done state.
  GETTING_STARTED_DOCS_LINK_CLICKED: 'trial_onboarding:getting_started_docs_link_clicked',
  // Carries { item: 'build-insight' | 'automate-pipeline' } — which checklist row was
  // clicked. What it then does (open the fork dialog, resume, start a flow) depends on
  // walkthrough state and is covered by that flow's own events.
  GETTING_STARTED_ITEM_CLICKED: 'trial_onboarding:getting_started_item_clicked',
  GETTING_STARTED_VIDEO_PLAYED: 'trial_onboarding:getting_started_video_played',
  // The "Schedule a call with us" / "Book a call" link out to the Dalgo team's booking page.
  // Carries { source: 'widget' | 'nudge' } — the widget row vs the trial nudge modals, which
  // fire at very different moments of the trial and convert differently.
  BOOK_A_CALL_CLICKED: 'trial_onboarding:book_a_call_clicked',
  // The GetStartedModal's 'choice' screen — shown only when the tour is finished via its
  // last step's "Finish Tour" button, not on Skip.
  //
  // One Dialog hosts both this screen and the fork below, but each screen owns its own
  // viewed/dismissed PAIR, fired per screen VISIT. Sharing one dismissal across both used to
  // log a choice-screen dismissal for a close that happened on the fork (a screen the user may
  // never have seen), and double-counted it whenever they went choice -> fork -> close.
  POST_TOUR_MODAL_VIEWED: 'trial_onboarding:post_tour_modal_viewed',
  // Carries { choice: 'insight' | 'pipeline' | 'close', entry } — which option was picked.
  POST_TOUR_MODAL_DISMISSED: 'trial_onboarding:post_tour_modal_dismissed',
  // The GetStartedModal's 'insight' screen (sample vs own data). Carries
  // { entry: 'post_tour' | 'widget' | 'resume' | 'intent_modal' } — how the user got to it.
  INSIGHT_FORK_MODAL_VIEWED: 'trial_onboarding:insight_fork_modal_viewed',
  // Carries { choice: 'sample' | 'own_data' | 'back' | 'close', entry } — how the fork screen
  // ended. One event for every exit (see the pairing note above), so the total is fork-screen
  // visits resolved and take-rate is a breakdown; 'back' is a return to the choice screen, not
  // an abandonment, so filter it out when counting drop-off.
  INSIGHT_FORK_MODAL_DISMISSED: 'trial_onboarding:insight_fork_modal_dismissed',
  // Carries { choice: 'sample' | 'own_data' } — which fork was taken. Kept alongside the
  // dismissal above (existing insights depend on it), same as the legacy tour_* events.
  INSIGHT_FORK_CHOSEN: 'trial_onboarding:insight_fork_chosen',
  // The two walkthrough celebration dialogs (see celebration-modal.tsx). Both carry
  // { choice: 'cta' | 'close' }.
  KPI_LIVE_MODAL_DISMISSED: 'trial_onboarding:kpi_live_modal_dismissed',
  CHART_LIVE_MODAL_DISMISSED: 'trial_onboarding:chart_live_modal_dismissed',
  PIPELINE_LIVE_MODAL_DISMISSED: 'trial_onboarding:pipeline_live_modal_dismissed',
  DASHBOARD_LIVE_MODAL_DISMISSED: 'trial_onboarding:dashboard_live_modal_dismissed',
  // Sample-data insight walkthrough (Fork2 -> KPI created -> dashboard shared)
  INSIGHT_WALKTHROUGH_STARTED: 'trial_onboarding:insight_walkthrough_started',
  // Carries { stage } — the stage that was just shown.
  INSIGHT_WALKTHROUGH_STEP_VIEWED: 'trial_onboarding:insight_walkthrough_step_viewed',
  INSIGHT_WALKTHROUGH_COMPLETED: 'trial_onboarding:insight_walkthrough_completed',
  // Carries { stage } — the stage the user was on when they skipped.
  INSIGHT_WALKTHROUGH_SKIPPED: 'trial_onboarding:insight_walkthrough_skipped',
  // Unified onboarding-path lifecycle. The tour and the walkthroughs each keep their own
  // legacy events above (existing insights depend on them); these five are the cross-path
  // set, every one carrying `path` (see ONBOARDING_PATHS) so "which walkthrough, how far,
  // how long, where did they quit" is one query per question instead of one per flow.
  // Carries { path, entry? }.
  PATH_STARTED: 'trial_onboarding:path_started',
  // Carries { path, stage, stage_index? } — fired on each real checkpoint (a Next click or
  // a completed action), never on automatic advancement.
  PATH_STAGE_VIEWED: 'trial_onboarding:path_stage_viewed',
  // Carries { path, stage } — a stored flow picked back up on a later page load.
  PATH_RESUMED: 'trial_onboarding:path_resumed',
  // Carries { path, duration_seconds? }. duration_seconds spans reloads and browser
  // sessions, so it is NOT the same thing as PostHog's own $session_duration; it is absent
  // when no start time was recorded (see lib/onboarding-analytics.ts).
  PATH_COMPLETED: 'trial_onboarding:path_completed',
  // Carries { path, stage, stage_index?, duration_seconds? } — abandoned deliberately
  // (Skip / close). `stage_index` mirrors PATH_STAGE_VIEWED so "they quit on step 3" reads off
  // this one event instead of needing the stage order or a join back to the stage events.
  // A silent abandon fires nothing by design: derive it as started - completed - exited.
  PATH_EXITED: 'trial_onboarding:path_exited',
  // One-shot feature coachmarks on /reports, /alerts and /metrics — no flow, no ordering.
  // Both carry { nudge: 'reports_nudge' | 'alerts_nudge' | 'metrics_nudge' }. VIEWED can
  // fire on repeat visits (the nudge returns until dismissed); DISMISSED fires once.
  FEATURE_NUDGE_VIEWED: 'trial_onboarding:feature_nudge_viewed',
  FEATURE_NUDGE_DISMISSED: 'trial_onboarding:feature_nudge_dismissed',
  // Free trial onboarding
  TRIAL_SIGNUP_SUBMITTED: 'trial_onboarding:signup_submitted',
  // Verification link re-sent from the check-your-email card (re-POSTs signup).
  TRIAL_LINK_RESENT: 'trial_onboarding:link_resent',
  TRIAL_ACTIVATED: 'trial_onboarding:trial_activated',
  TRIAL_PROVISIONING_VIDEO_PLAYED: 'trial_onboarding:provisioning_video_played',
  // A failed clone was re-enqueued. Carries { from: 'failed' | 'timeout' } — which
  // fallback card the user retried from.
  TRIAL_RETRY_TRIGGERED: 'trial_onboarding:retry_triggered',
  TRIAL_CLONE_COMPLETED: 'trial_onboarding:clone_completed',
  TRIAL_CLONE_FAILED: 'trial_onboarding:clone_failed',
  // Clone succeeded but auto-login could not run (login call failed, or the
  // stashed creds were missing e.g. after a reload) — user must log in manually.
  TRIAL_MANUAL_LOGIN_REQUIRED: 'trial_onboarding:manual_login_required',
  // Status polling gave up (too many consecutive failures or hard timeout) before
  // a terminal clone status arrived — screen fell back from the spinner.
  TRIAL_POLL_TIMEOUT: 'trial_onboarding:poll_timeout',
  // An upgrade CTA opened the confirm modal. Carries { days_left, source } — `source` is the
  // surface it was opened from ('header_badge' | 'trial_nudge'), which is what tells us which
  // one converts now that the Settings → Billing page is gone.
  SUBSCRIPTION_REQUEST_OPENED: 'trial_onboarding:subscription_request_opened',
  // The request POST succeeded. Carries { days_left, already_requested, source }.
  SUBSCRIPTION_REQUEST_SENT: 'trial_onboarding:subscription_request_sent',
  // The confirm dialog was closed WITHOUT sending (Cancel, ✕, Esc, outside click). Carries
  // { days_left, source }. Without it, OPENED -> SENT has an invisible drop-off step, and that
  // gap is exactly "who bounced off subscribing". Never fires after a successful send — closing
  // the success screen is not an abandonment.
  SUBSCRIPTION_REQUEST_ABANDONED: 'trial_onboarding:subscription_request_abandoned',
  // The trial lifecycle nudges (7 / 2 / 1 days LEFT — see TRIAL_NUDGE_DAYS). Both carry `day`,
  // so each day's nudge is measured on its own: they are separate prompts with separate copy
  // and separate dismissal state, and the day is what makes "shown -> converted" answerable
  // per nudge instead of as one blended number.
  TRIAL_NUDGE_VIEWED: 'trial_onboarding:nudge_viewed',
  // Carries { day, choice: 'cta' | 'close' }. ONE event for both exits, same shape as the
  // celebration modals: two separate events would make the total meaningless and the
  // take-rate a hand-computed ratio.
  TRIAL_NUDGE_DISMISSED: 'trial_onboarding:nudge_dismissed',
  // Breadth — every menu / submenu / tab
  FEATURE_VIEWED: 'feature:viewed',
  // Charts. Lifecycle is exactly three events: created / updated / deleted.
  // CHART_CREATED covers EVERY way a chart row comes into existence (new build,
  // save-as-new, duplicate) — the path is the `source` property, not a separate
  // event name (see CHART_CREATE_SOURCES). That keeps "how many charts were
  // created" a single number while still allowing a per-path breakdown.
  CHART_CREATED: 'chart:chart_created',
  CHART_UPDATED: 'chart:chart_updated',
  CHART_DELETED: 'chart:chart_deleted',
  CHART_VIEWED: 'chart:chart_viewed',
  CHARTS_BULK_DELETED: 'chart:charts_bulk_deleted',
  CHART_EXPORTED: 'chart:chart_exported',
  // Selection-intent (funnel): which chart types users pick in the builder,
  // distinct from CHART_CREATED which only fires if they actually save.
  CHART_TYPE_SELECTED: 'chart:chart_type_selected',
  CHART_DATASET_SELECTOR_STATE_VIEWED: 'chart:dataset_selector_state_viewed',
  // Consumption depth: the viewer drilled INTO the data (map region click, table
  // dimension click). Only drilling down fires — drill-up/home is backtracking,
  // not new intent. Fired from the chart detail page and dashboard embeds, not
  // from builder previews (there it's the author testing their own config).
  CHART_DRILLED_DOWN: 'chart:chart_drilled_down',
  // Dashboards
  DASHBOARD_CREATED: 'dashboard:dashboard_created',
  // The edit event, fired from three places (see DASHBOARD_UPDATE_SOURCES): the two
  // explicit save buttons and opening the builder via EDIT DASHBOARD. Never from the
  // 5s autosave, which is deliberately untracked.
  //
  // Note the `edit_button` source writes nothing — it is an editor OPEN, so the raw
  // event total counts opens alongside real saves. Filter `source != 'edit_button'`
  // for a true save count; that property is the only way to separate them, so keep
  // sending it from every call site.
  DASHBOARD_UPDATED: 'dashboard:dashboard_updated',
  DASHBOARD_DELETED: 'dashboard:dashboard_deleted',
  DASHBOARD_DUPLICATED: 'dashboard:dashboard_duplicated',
  DASHBOARD_VIEWED: 'dashboard:dashboard_viewed',
  // Public-access toggle turned ON. Toggling it OFF fires nothing — un-sharing is
  // not an outcome we measure, and firing one event for both directions made the
  // total meaningless.
  DASHBOARD_MADE_PUBLIC: 'dashboard:dashboard_made_public',
  // The actual share act: the user copied the public link. Distinct from
  // DASHBOARD_MADE_PUBLIC, which only means the link now exists.
  DASHBOARD_SHARED: 'dashboard:dashboard_shared',
  // Fired on the anonymous public share route, NOT by a logged-in user. Carries
  // org_slug/org_name as event properties because there is no person and no
  // organization group to attach on a public view (see PublicDashboardView).
  PUBLIC_DASHBOARD_VIEWED: 'dashboard:public_dashboard_viewed',
  DASHBOARD_EMBED_CODE_COPIED: 'dashboard:embed_code_copied',
  // Both landing scopes (my landing page, and the admin-only ORG DEFAULT) share this
  // event and are told apart by `scope` from LANDING_SCOPES. Removing a landing page
  // fires nothing — same rule as un-sharing: the off direction is not an outcome.
  DASHBOARD_SET_AS_LANDING: 'dashboard:dashboard_set_as_landing',
  DASHBOARD_CHART_ADDED: 'dashboard:chart_added',
  DASHBOARD_KPI_ADDED: 'dashboard:kpi_added',
  DASHBOARD_ELEMENT_REMOVED: 'dashboard:element_removed',
  DASHBOARD_FILTER_CREATED: 'dashboard:filter_created',
  DASHBOARD_FILTER_UPDATED: 'dashboard:filter_updated',
  DASHBOARD_FILTER_DELETED: 'dashboard:filter_deleted',
  // Consumption depth: someone hit Apply on the filter panel. The CRUD events above are
  // the author BUILDING a filter; this is a reader USING one — the only way to tell
  // whether shipped filters get touched (and the one interaction an anonymous public
  // viewer can have). `context` from DASHBOARD_FILTER_CONTEXTS separates real reading
  // from an author testing their own config in the builder.
  //
  // Carries counts and filter TYPES only. Never the selected values, column, table or
  // schema names — those are warehouse data (see the PII rule).
  DASHBOARD_FILTER_APPLIED: 'dashboard:filter_applied',
  DASHBOARD_TEXT_ELEMENT_ADDED: 'dashboard:text_element_added',
  // All four fire from the builder's tab handlers, not from TabBar — that component has
  // no dashboardId, and the handlers are the choke point every tab control funnels through.
  DASHBOARD_TAB_CREATED: 'dashboard:tab_created',
  DASHBOARD_TAB_DELETED: 'dashboard:tab_deleted',
  DASHBOARD_TAB_RENAMED: 'dashboard:tab_renamed',
  DASHBOARD_TAB_REORDERED: 'dashboard:tab_reordered',
  DASHBOARD_WIDGET_MOVED_BETWEEN_TABS: 'dashboard:widget_moved_between_tabs',
  DASHBOARD_RICH_TEXT_EDIT_STARTED: 'dashboard:rich_text_edit_started',
  DASHBOARD_RICH_TEXT_FORMAT_APPLIED: 'dashboard:rich_text_format_applied',
  // Reports. Mirrors the dashboard set: one create, one share act, one made-public.
  // Fired from the GENERATE REPORT button in create-snapshot-dialog, on the success path,
  // so it carries the new report_id the POST returns.
  REPORT_CREATED: 'report:report_created',
  // NOT report_updated: a snapshot is frozen and can never be edited. The only mutable
  // field is the summary text (updateSnapshot accepts `{summary}` and nothing else), so
  // the event says exactly that.
  REPORT_SUMMARY_UPDATED: 'report:summary_updated',
  REPORT_DELETED: 'report:report_deleted',
  REPORT_VIEWED: 'report:report_viewed',
  // Public-access toggle turned ON. Toggling it OFF fires nothing (see
  // DASHBOARD_MADE_PUBLIC for the reasoning).
  REPORT_MADE_PUBLIC: 'report:report_made_public',
  // The actual share act — the link was copied, or the report was emailed. One event,
  // split by `source` from REPORT_SHARE_SOURCES. Distinct from REPORT_MADE_PUBLIC, which
  // only means a link now exists.
  REPORT_SHARED: 'report:report_shared',
  REPORT_EXPORTED: 'report:report_exported',
  // Fired on the anonymous public share route, NOT by a logged-in user. Carries org_name
  // (the public report payload has no org_slug) because there is no person or org group
  // to attach on a public view — same shape as PUBLIC_DASHBOARD_VIEWED.
  PUBLIC_REPORT_VIEWED: 'report:public_report_viewed',
  // Comments are a flat thread per target (there is no parent_id in the API), so a reply
  // is a comment on a target that already has one — carried as `is_reply` rather than a
  // second event name, keeping "comments added" a single number. Who commented needs no
  // property: PostHog attaches the person. Mention COUNTS are safe, emails are not.
  REPORT_COMMENT_CREATED: 'report:comment_created',
  REPORT_COMMENT_UPDATED: 'report:comment_updated',
  REPORT_COMMENT_DELETED: 'report:comment_deleted',
  // KPIs & metrics
  KPI_CREATED: 'kpi:kpi_created',
  // A KPI was CONSUMED by something built on it. The mirror of METRIC_USED: without it,
  // "which KPIs do people actually build on" had no answer and KPI adoption undercounted
  // alerts entirely. Carries the KPI's id, the consuming resource's id, and `source`.
  KPI_USED: 'kpi:kpi_used',
  // Opening a KPI's detail drawer. Carries `source` (KPI_VIEW_SOURCES) because the card
  // body, the ⋮ "View KPI" item and an ?open={id} deep link all land here.
  KPI_VIEWED: 'kpi:kpi_viewed',
  KPI_UPDATED: 'kpi:kpi_updated',
  KPI_DELETED: 'kpi:kpi_deleted',
  // Downloading a KPI card as PNG or CSV. `source` separates the KPIs page from a KPI
  // embedded in a dashboard — the same card component serves both.
  KPI_EXPORTED: 'kpi:kpi_exported',
  KPI_ANNOTATION_CREATED: 'kpi:annotation_created',
  KPI_ANNOTATION_UPDATED: 'kpi:annotation_updated',
  KPI_ANNOTATION_DELETED: 'kpi:annotation_deleted',
  // Funnel through the create/edit wizard. Carries `is_edit` — the same steps are shown
  // when editing, and without it an abandoned create looks like an abandoned edit.
  KPI_WIZARD_STEP_VIEWED: 'kpi:wizard_step_viewed',
  METRIC_USED: 'metric:metric_used',
  METRIC_CREATED: 'metric:metric_created',
  METRIC_UPDATED: 'metric:metric_updated',
  METRIC_DELETED: 'metric:metric_deleted',
  // Ingest
  // Both carry `has_post_sync_transform`: whether the connection was saved with any post-sync
  // transform (column casting, offered only for cast-supported sources — see
  // isCastSupportedSource). A plain boolean taken from the payload that was actually sent;
  // the transform's contents are column names and types, i.e. warehouse data, and never go out.
  CONNECTION_CREATED: 'connection:connection_created',
  CONNECTION_UPDATED: 'connection:connection_updated',
  CONNECTION_DELETED: 'connection:connection_deleted',
  CONNECTION_SYNC_TRIGGERED: 'connection:connection_sync_triggered',
  CONNECTION_RESET: 'connection:connection_reset',
  CONNECTION_SYNC_CANCELLED: 'connection:sync_cancelled',
  CONNECTION_SCHEMA_CHANGES_APPLIED: 'connection:schema_changes_applied',
  CONNECTION_LOG_SUMMARY_REQUESTED: 'connection:log_summary_requested',
  // Fires on the wizard's success path with source_id and, for Google Sheets, `auth_mode`
  // from SOURCE_AUTH_MODES — which of the three routes the user actually completed.
  SOURCE_CREATED: 'source:source_created',
  SOURCE_UPDATED: 'source:source_updated',
  SOURCE_DELETED: 'source:source_deleted',
  SOURCE_OAUTH_STARTED: 'source:oauth_started',
  SOURCE_OAUTH_CONNECTED: 'source:oauth_connected',
  // Funnel through the Add Source wizard (warehouse? → select → create → connection), so
  // the step people abandon on is visible. Carries `step` and `has_warehouse_step`.
  SOURCE_WIZARD_STEP_VIEWED: 'source:wizard_step_viewed',
  // A warehouse can be created from its Settings page or from the extra first step of the
  // Add Source wizard — very different moments (deliberate setup vs unblocking a first
  // source), so `source` from WAREHOUSE_CREATE_SOURCES separates them. All three carry
  // warehouse_type; no id, since an org has exactly one warehouse.
  WAREHOUSE_CREATED: 'warehouse:warehouse_created',
  WAREHOUSE_UPDATED: 'warehouse:warehouse_updated',
  WAREHOUSE_DELETED: 'warehouse:warehouse_deleted',
  // Transform (dbt + UI4T canvas)
  DBT_RUN_TRIGGERED: 'transform:dbt_run_triggered',
  // The single event for pointing dbt at a Git repo, from the DBT Repository card — a
  // first-time connection and a later repo swap both fire it, told apart by properties
  // rather than by a second event name:
  //   is_first_connection — the workspace had no repo before
  //   was_managed         — moved off the Dalgo-managed repo onto their own
  // Note this is NOT a measure of "orgs with dbt set up": a Dalgo-managed repo is created
  // server-side during org setup, so those orgs arrive already connected and never fire it.
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
  // Alerts. Carries `source` (ALERT_CREATE_SOURCES) — the wizard is opened from the alerts
  // page, the metrics library, the KPI list and the KPI drawer, and an alert created next to
  // a KPI means something different from one built from scratch.
  ALERT_CREATED: 'alert:alert_created',
  ALERT_UPDATED: 'alert:alert_updated',
  ALERT_DELETED: 'alert:alert_deleted',
  ALERT_TOGGLED: 'alert:alert_toggled',
  // Funnel through the alert wizard (Define → Notify → Test), mirroring
  // KPI_WIZARD_STEP_VIEWED. This is how alert-creation abandonment is measured; the
  // dry-run on the Test step is deliberately NOT tracked because it runs automatically
  // on mount and on every payload change, so it measures the wizard, not the user.
  ALERT_WIZARD_STEP_VIEWED: 'alert:wizard_step_viewed',
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

// `source` values shared by the three SUBSCRIPTION_REQUEST_* events — which surface the
// upgrade was started from. Both surfaces run the same one-per-org POST, so `source` is the
// only thing that tells you which one converts.
export const SUBSCRIPTION_REQUEST_SOURCES = {
  /** The days-left pill in the header. */
  HEADER_BADGE: 'header_badge',
  /** The 2-days-left / 1-day-left lifecycle nudge modal. */
  TRIAL_NUDGE: 'trial_nudge',
} as const;

export type SubscriptionRequestSource =
  (typeof SUBSCRIPTION_REQUEST_SOURCES)[keyof typeof SUBSCRIPTION_REQUEST_SOURCES];

// `entry` values for the insight walkthrough — which surface sent the user into the fork.
// Without this, a walkthrough begun from a trial nudge is indistinguishable from one begun in
// the getting-started widget or the post-tour modal.
export const WALKTHROUGH_ENTRIES = {
  /** The GetStartedModal's insight screen — the normal sample-vs-own-data fork. */
  FORK_MODAL: 'fork_modal',
  /** The 7-days-left nudge's "Start with sample data" button. */
  TRIAL_NUDGE: 'trial_nudge',
  /** Entered straight at the chart tail, with real data already in place. */
  CHART: 'chart',
} as const;

export type WalkthroughEntry = (typeof WALKTHROUGH_ENTRIES)[keyof typeof WALKTHROUGH_ENTRIES];

// `path` values for the PATH_* events — the onboarding walkthroughs a user can run.
// Four values, not three: the two insight forks (sample data vs your own data) are
// different amounts of work with different drop-off, and merging them here would make the
// split unrecoverable. Collapsing them for reporting is a PostHog-side filter.
export const ONBOARDING_PATHS = {
  // The driver.js guided product tour — see components/onboarding/product-tour.tsx.
  WALKTHROUGH: 'walkthrough',
  // Build insights on the pre-loaded sample data: KPI → dashboard → share.
  INSIGHT_SAMPLE: 'insight_sample',
  // Build insights on your own data: ingest → chart → dashboard → share.
  INSIGHT_OWN_DATA: 'insight_own_data',
  // Automate your pipeline: ingest → transform → orchestrate.
  PIPELINE: 'pipeline',
} as const;

export type OnboardingPath = (typeof ONBOARDING_PATHS)[keyof typeof ONBOARDING_PATHS];

// `source` values for CHART_CREATED — which path produced the chart. One event
// with this property (instead of one event per path) means the total is a plain
// event count and the split is a single PostHog breakdown. Adding a new create
// path later = a new value here; existing insights pick it up automatically.
export const CHART_CREATE_SOURCES = {
  // Charts list → CREATE CHART → picker → configure → Save Chart
  NEW: 'new',
  // Dashboard builder → add chart → /charts/new?from=dashboard → Save Chart
  NEW_FROM_DASHBOARD: 'new_from_dashboard',
  // Chart edit → Save Chart → SAVE AS NEW CHART
  SAVE_AS_NEW: 'save_as_new',
  // Charts list row action → Duplicate
  DUPLICATE: 'duplicate',
} as const;

export type ChartCreateSource = (typeof CHART_CREATE_SOURCES)[keyof typeof CHART_CREATE_SOURCES];

// `source` values for CHART_EXPORTED — the two export dropdowns are separate
// components, so without this the event can't tell list exports from detail ones.
export const CHART_EXPORT_SOURCES = {
  CHART_DETAIL: 'chart_detail',
  CHARTS_LIST: 'charts_list',
} as const;

export type ChartExportSource = (typeof CHART_EXPORT_SOURCES)[keyof typeof CHART_EXPORT_SOURCES];

// `source` values for CHART_DRILLED_DOWN — the same chart can be drilled from its
// own page or from inside a dashboard, and those are different viewing contexts.
export const CHART_DRILL_SOURCES = {
  CHART_DETAIL: 'chart_detail',
  DASHBOARD: 'dashboard',
} as const;

export type ChartDrillSource = (typeof CHART_DRILL_SOURCES)[keyof typeof CHART_DRILL_SOURCES];

// `source` values for DASHBOARD_UPDATED — one event, three entry points, told apart
// by this property. Always send it: without it the save paths and the editor-open path
// are indistinguishable after the fact.
export const DASHBOARD_UPDATE_SOURCES = {
  // Builder toolbar → Save (stays in the builder)
  SAVE_BUTTON: 'save_button',
  // Builder toolbar → View (saves via cleanup, then navigates to view mode)
  SAVE_AND_VIEW: 'save_and_view',
  // EDIT DASHBOARD on the dashboard view, or an Edit link in the dashboard list.
  // Opening the builder only — nothing is persisted on this path.
  EDIT_BUTTON: 'edit_button',
} as const;

export type DashboardUpdateSource =
  (typeof DASHBOARD_UPDATE_SOURCES)[keyof typeof DASHBOARD_UPDATE_SOURCES];

// `source` values for KPI_VIEWED — three affordances open the same detail drawer, and
// knowing which one people actually use is the point of tracking it separately.
export const KPI_VIEW_SOURCES = {
  // Clicking the KPI card body
  CARD: 'card',
  // The card's ⋮ menu → View KPI
  MENU: 'menu',
  // Arriving on /kpis?open={id} (e.g. from an alert or notification link)
  DEEP_LINK: 'deep_link',
} as const;

export type KpiViewSource = (typeof KPI_VIEW_SOURCES)[keyof typeof KPI_VIEW_SOURCES];

// `source` values for KPI_EXPORTED — kpi-card is rendered both on the KPIs page and as a
// dashboard element, which are different consumption contexts.
export const KPI_EXPORT_SOURCES = {
  KPI_PAGE: 'kpi_page',
  DASHBOARD: 'dashboard',
} as const;

export type KpiExportSource = (typeof KPI_EXPORT_SOURCES)[keyof typeof KPI_EXPORT_SOURCES];

// `source` values for WAREHOUSE_CREATED. The wizard path means the user hit the warehouse
// requirement on the way to their first source; the settings path means they went to set one
// up deliberately. Same outcome, different intent.
export const WAREHOUSE_CREATE_SOURCES = {
  SETTINGS: 'settings',
  ADD_SOURCE_WIZARD: 'add_source_wizard',
} as const;

export type WarehouseCreateSource =
  (typeof WAREHOUSE_CREATE_SOURCES)[keyof typeof WAREHOUSE_CREATE_SOURCES];

// `auth_mode` values for SOURCE_CREATED on Google Sheets. The three routes cost the user
// very different amounts of effort, so which one they finish on is the whole question:
// the managed key exists precisely so a trial user doesn't have to go and mint a service
// account first. Create-time only — Airbyte returns a stored key masked and which key a
// source uses isn't recorded, so this cannot be reported on edit.
export const SOURCE_AUTH_MODES = {
  // Google sign-in (OAuth consent popup)
  OAUTH: 'oauth',
  // Dalgo's own service account — the user just shares the sheet with our email
  MANAGED_KEY: 'managed_key',
  // The user pasted their own service-account JSON
  OWN_KEY: 'own_key',
  // EDIT ONLY. On edit the two service-account routes are indistinguishable: Airbyte returns
  // a stored key masked and which key a source uses isn't recorded, so the choice isn't even
  // offered while a key is present. Reported as-is rather than guessed at.
  SERVICE_ACCOUNT: 'service_account',
} as const;

export type SourceAuthMode = (typeof SOURCE_AUTH_MODES)[keyof typeof SOURCE_AUTH_MODES];

// `source` values for REPORT_SHARED — a report can be handed out two ways, and they are
// different behaviours (a link is passive, an email is a push to named people).
export const REPORT_SHARE_SOURCES = {
  // Share via link dialog → COPY PUBLIC LINK
  COPY_LINK: 'copy_link',
  // Share via email dialog → Send. Sends recipients_count only, never the addresses.
  EMAIL: 'email',
} as const;

export type ReportShareSource = (typeof REPORT_SHARE_SOURCES)[keyof typeof REPORT_SHARE_SOURCES];

// `context` values for DASHBOARD_FILTER_APPLIED — the same panel is mounted in four
// places, and they mean very different things. Filter to 'view'/'public' for genuine
// consumption; 'edit' is the author trying their own filter, the same reason
// CHART_DRILLED_DOWN ignores builder previews.
export const DASHBOARD_FILTER_CONTEXTS = {
  // Dashboard builder — the author testing filters they just built
  EDIT: 'edit',
  // Logged-in dashboard view
  VIEW: 'view',
  // Anonymous public share link or embed iframe
  PUBLIC: 'public',
  // Report snapshot, which reuses the same filter panel
  REPORT: 'report',
} as const;

export type DashboardFilterContext =
  (typeof DASHBOARD_FILTER_CONTEXTS)[keyof typeof DASHBOARD_FILTER_CONTEXTS];

// `scope` values for DASHBOARD_SET_AS_LANDING — "my landing page" is a per-user
// preference, ORG DEFAULT is an admin setting the whole org's home. Very different
// actions, so the event is useless without this property.
export const LANDING_SCOPES = {
  PERSONAL: 'personal',
  ORG_DEFAULT: 'org_default',
} as const;

export type LandingScope = (typeof LANDING_SCOPES)[keyof typeof LANDING_SCOPES];

// `source` values for METRIC_CREATED — a metric can be born in three places.
// Every site also sends `metric_type` ('saved' | 'calculated' | 'simple', see
// METRIC_TYPES in components/charts/utils.ts) so one breakdown works across all.
export const METRIC_CREATE_SOURCES = {
  METRICS_PAGE: 'metrics_page',
  // "Save to library" inside MetricsSelector while building a chart.
  CHART_BUILDER: 'chart_builder',
  // Step 1 of the Create KPI wizard (components/kpis/KpiMetricStep.tsx) — the
  // inline "create" mode, as opposed to picking an existing metric.
  KPI_WIZARD: 'kpi_wizard',
} as const;

export type MetricCreateSource = (typeof METRIC_CREATE_SOURCES)[keyof typeof METRIC_CREATE_SOURCES];

// `source` values for METRIC_USED — a metric is consumed by three different things, and
// "which of them do metrics actually get used in" is the whole point of the event. Every
// site also sends the consuming resource's id (chart_id / kpi_id / alert_id) where it has
// one, so a metric can be traced to what was built on it.
export const METRIC_USE_SOURCES = {
  // A saved metric selected in the chart builder and saved with the chart
  CHART: 'chart',
  // A KPI created or re-pointed onto this metric
  KPI: 'kpi',
  // A metric_threshold alert created on this metric
  ALERT: 'alert',
} as const;

export type MetricUseSource = (typeof METRIC_USE_SOURCES)[keyof typeof METRIC_USE_SOURCES];

// `source` values for KPI_USED — what consumed the KPI. One value today; it exists so a
// second consumer is a new value here rather than a new event, exactly as METRIC_USE_SOURCES
// does. (Adding a KPI to a dashboard is NOT here — `dashboard:kpi_added` already covers that
// surface with its dashboard_id, and duplicating it would double-count adoption.)
export const KPI_USE_SOURCES = {
  // A kpi_rag alert created on this KPI
  ALERT: 'alert',
} as const;

export type KpiUseSource = (typeof KPI_USE_SOURCES)[keyof typeof KPI_USE_SOURCES];

// `source` values for KPI_CREATED — the KPIs page and the metrics library both open the
// KPI wizard, and without this they are one indistinguishable number.
export const KPI_CREATE_SOURCES = {
  KPIS_PAGE: 'kpis_page',
  // Metrics library row ⋮ → Create KPI (metric preselected)
  METRICS_LIBRARY: 'metrics_library',
} as const;

export type KpiCreateSource = (typeof KPI_CREATE_SOURCES)[keyof typeof KPI_CREATE_SOURCES];

// `source` values for ALERT_CREATED — four surfaces open the alert wizard, and an alert set
// up from a KPI or a metric is a different behaviour from one built on the alerts page.
export const ALERT_CREATE_SOURCES = {
  ALERTS_PAGE: 'alerts_page',
  // Metrics library row ⋮ → Create alert (metric preselected)
  METRICS_LIBRARY: 'metrics_library',
  // KPI card ⋮ → Create alert (KPI preselected)
  KPI_LIST: 'kpi_list',
  // Create alert from inside the KPI detail drawer
  KPI_DRAWER: 'kpi_drawer',
} as const;

export type AlertCreateSource = (typeof ALERT_CREATE_SOURCES)[keyof typeof ALERT_CREATE_SOURCES];

// Value actions — "creating or consuming insight" (spec §2.1). Every event here
// is auto-stamped with `is_value_action: true` by trackEvent, so the North Star
// ("unique users doing ≥1 value action") is one PostHog filter
// (is_value_action = true) instead of a hand-maintained list of event names.
// Add a new value event HERE and it's counted automatically — nothing to change
// in PostHog. Plumbing (pipeline/connection/source/warehouse/transform), config
// (alert toggle, set-as-landing), deletes, and granular dashboard sub-edits
// (DASHBOARD_UPDATED already covers the edit) are deliberately NOT value actions.
// PUBLIC_DASHBOARD_VIEWED is also deliberately excluded: every event in this set
// is fired by an identified user, but a public view is an anonymous device with
// no person profile, so including it would add non-users to a unique-USERS count.
// Public reach is measured on its own (views + unique orgs), and the value credit
// for sharing already lands on the sharer via DASHBOARD_SHARED.
export const VALUE_ACTION_EVENTS: ReadonlySet<AnalyticsEvent> = new Set([
  // Charts — view / create (all paths) / update / export
  ANALYTICS_EVENTS.CHART_VIEWED,
  ANALYTICS_EVENTS.CHART_CREATED,
  ANALYTICS_EVENTS.CHART_UPDATED,
  ANALYTICS_EVENTS.CHART_EXPORTED,
  // Dashboards — view / edit / create / share
  ANALYTICS_EVENTS.DASHBOARD_VIEWED,
  ANALYTICS_EVENTS.DASHBOARD_CREATED,
  ANALYTICS_EVENTS.DASHBOARD_UPDATED,
  ANALYTICS_EVENTS.DASHBOARD_DUPLICATED,
  ANALYTICS_EVENTS.DASHBOARD_MADE_PUBLIC,
  ANALYTICS_EVENTS.DASHBOARD_SHARED,
  // Reports — view / edit / create / share / export / comment
  ANALYTICS_EVENTS.REPORT_VIEWED,
  ANALYTICS_EVENTS.REPORT_CREATED,
  ANALYTICS_EVENTS.REPORT_SUMMARY_UPDATED,
  ANALYTICS_EVENTS.REPORT_MADE_PUBLIC,
  ANALYTICS_EVENTS.REPORT_SHARED,
  ANALYTICS_EVENTS.REPORT_EXPORTED,
  ANALYTICS_EVENTS.REPORT_COMMENT_CREATED,
  // KPIs — view / edit / create / annotate
  ANALYTICS_EVENTS.KPI_VIEWED,
  ANALYTICS_EVENTS.KPI_CREATED,
  ANALYTICS_EVENTS.KPI_UPDATED,
  ANALYTICS_EVENTS.KPI_EXPORTED,
  ANALYTICS_EVENTS.KPI_ANNOTATION_CREATED,
  ANALYTICS_EVENTS.KPI_ANNOTATION_UPDATED,
  ANALYTICS_EVENTS.KPI_USED,
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
  // The warehouse moved out of the ingest page onto its own Settings route; without an
  // entry here (and in PATHNAME_TO_FEATURE) that page fired no feature:viewed at all.
  SETTINGS_WAREHOUSE: 'settings_warehouse',
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
  { prefix: '/settings/access', feature: FEATURES.SETTINGS_USER_MANAGEMENT },
  { prefix: '/settings/about', feature: FEATURES.SETTINGS_ABOUT },
  { prefix: '/settings/branding', feature: FEATURES.SETTINGS_BRANDING },
  { prefix: '/settings/warehouse', feature: FEATURES.SETTINGS_WAREHOUSE },
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
