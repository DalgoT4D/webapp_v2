/**
 * Stage list + localStorage persistence for the three onboarding walkthroughs.
 *
 * THREE SEPARATE FLOWS — not variations of one sequence:
 *  a. sample           — "Build your insights with sample data": KPI -> dashboard -> share.
 *  b. own_data         — "Build your insights with own data":    ingest -> chart -> dashboard
 *                        -> share. Deliberately NO transform and NO orchestrate.
 *  c. automate_pipeline— "Automate your pipeline": ingest -> transform -> orchestrate. STOPS
 *                        there — a scheduled pipeline is the deliverable, not a chart.
 *
 * (b) and (c) are separate products a user may run independently and in either order, so their
 * stored progress must not collide — see the storage section at the bottom of this file.
 *
 * They also compose: someone who finishes (c) has real data in the platform, so clicking
 * "Build insights" afterwards skips the sample/own-data question and drops them straight into
 * (b)'s chart tail. See TourGate.handleBuildInsightClick.
 */
import { getWalkthroughScope, scopeSuffix, type WalkthroughScope } from './walkthrough-scope';

export type WalkthroughStage =
  | 'fork2'
  | 'kpi_intro'
  | 'kpi_metric'
  // Step 1's Continue, which is what actually renders step 2. Without a stage of its own the
  // coachmark jumped from the metric field straight to the Target field — a field that does
  // not exist until this button is clicked — and spent the hint timeout walking blindly
  // through step 2's stages while the user sat on step 1.
  | 'kpi_step1_continue'
  | 'kpi_target'
  | 'kpi_direction'
  | 'kpi_continue'
  | 'kpi_time_column'
  | 'kpi_type'
  | 'kpi_submit'
  | 'dashboard_nudge'
  | 'dashboard_intro'
  | 'builder_add_kpi'
  | 'builder_add_chart'
  | 'builder_resize'
  | 'builder_save'
  | 'builder_preview'
  | 'share'
  // Inside the share dialog: the Public Access switch, which is what actually produces a
  // link. Nothing to copy until it's on, so it gets its own step ahead of share_copy_link.
  | 'share_public_toggle'
  // Inside the share dialog, once public access is on: the last thing the user does before
  // the walkthrough ends. The dialog deliberately stays open through it.
  | 'share_copy_link'
  // Own-data fork (Fork2 "CONNECT MY DATA"). own_data_ingest points at the New Source
  // button; own_data_pick_source points at the Google Sheets card inside the wizard the
  // button opens. Neither has an advance signal of its own past that — the wait for the
  // first sync can outlive the browser session, so the fork rejoins via a real API check
  // (see tour-gate.tsx) rather than a route match.
  | 'own_data_ingest'
  | 'own_data_pick_source'
  | 'own_data_source_next'
  // The two states of waiting on the tracked connection's first sync, shared by BOTH real-data
  // forks (own_data and automate_pipeline) — the wait is identical, only what comes after it
  // differs (see POST_SYNC_STAGE_FOR), so one pair of stages serves both.
  //
  // Deliberately absent from every order array. They aren't steps in either walkthrough, they're
  // a holding pattern the checkpoint puts the user in and takes them out of; leaving them
  // unordered means isStageBefore reads them as "before everything", so the success checkpoint
  // can advance straight off either one whenever the sync finally lands.
  | 'sync_running'
  | 'sync_failed'
  // The chart -> dashboard -> share tail (see CHART_TO_SHARE_TAIL). Unprefixed because it is
  // entered two ways — after the own-data fork's first sync, and directly by a user who
  // already has real data — so naming it after either entry point would mislead.
  | 'chart_intro'
  | 'chart_create'
  | 'chart_pick_table'
  | 'chart_pick_type'
  | 'chart_continue'
  | 'chart_data_config'
  | 'chart_styling'
  | 'chart_save'
  | 'chart_dashboard_nudge'
  // Distinct from builder_add_kpi/builder_add_chart because this tail adds the tiles in the
  // opposite order to the sample fork: a chart already exists by this point, so it goes first.
  | 'builder_add_chart_first'
  | 'builder_add_kpi_second'
  // Automate-pipeline fork (the GetStartedModal's "Setup an automated data pipeline"
  // option — see get-started-modal.tsx). No fork2 step — it routes straight here, and it ends
  // at pipeline_create_it. pipeline_ingest/pipeline_pick_source are this fork's copies of the
  // own-data ingest pair (same two targets, same coachmark copy); they're separate stages so
  // each fork's order and resume anchor stay self-contained. Both then wait on the tracked
  // connection's sync status (see tour-gate.tsx).
  // Sidebar nudge on the Ingest nav item — the automate-pipeline fork's opening beat. The
  // flow used to router.push('/ingest') the moment the user picked it, which moved them
  // somewhere they hadn't asked to go and taught them nothing about where the feature lives.
  // Same illustrated-card treatment as pipeline_transform_intro and
  // pipeline_orchestrate_nudge: every leg of this fork now starts by pointing at the nav item
  // and letting the user click it.
  | 'pipeline_ingest_nudge'
  | 'pipeline_ingest'
  | 'pipeline_pick_source'
  | 'pipeline_source_next'
  | 'pipeline_transform_intro'
  | 'pipeline_workflow_intro'
  | 'pipeline_pick_table'
  | 'pipeline_select_node'
  | 'pipeline_pick_function'
  | 'pipeline_drop_columns'
  | 'pipeline_save_table'
  | 'pipeline_name_table'
  // The create-table form's own Save button. Split from pipeline_name_table because naming the
  // output and committing the form are two separate coachmarks in the design: the first says
  // what to type, the second says what Save actually does (build this table now, or chain more
  // functions first).
  | 'pipeline_save_new_table'
  | 'pipeline_table_built'
  // The commit-message box inside the Publish Changes dialog, which pipeline_table_built's
  // Publish click opens. Nothing publishes without a message, so it gets its own step.
  | 'pipeline_publish_commit'
  // Sidebar nudge on the Orchestrate nav item, shown the moment the publish lands. The stage
  // after it lives on /orchestrate, and coachmarks never navigate on their own — without this
  // beat the flow went silent on the canvas until the user guessed where to go next. Same
  // illustrated-card treatment as pipeline_transform_intro, which does the identical job for
  // the transform leg.
  | 'pipeline_orchestrate_nudge'
  | 'pipeline_orchestrate_intro'
  | 'pipeline_add_connection'
  | 'pipeline_run_transform'
  | 'pipeline_set_schedule'
  | 'pipeline_create_it';

export const WALKTHROUGH_STAGE_ORDER: WalkthroughStage[] = [
  'fork2',
  'kpi_intro',
  'kpi_metric',
  'kpi_step1_continue',
  'kpi_target',
  'kpi_direction',
  // Runtime order, which the wizard's own handlers follow: Direction picks the time column
  // next (when the metric has date columns), and Continue is what leaves step 2. Listing
  // these the other way round silently breaks isStageBefore — the time-column stage would
  // count as AFTER Continue, so the checkpoint could never catch anyone up from it.
  'kpi_time_column',
  'kpi_continue',
  'kpi_type',
  'kpi_submit',
  'dashboard_nudge',
  'dashboard_intro',
  'builder_add_kpi',
  'builder_add_chart',
  'builder_resize',
  'builder_save',
  'builder_preview',
  'share',
  'share_public_toggle',
  'share_copy_link',
];

/**
 * Build a chart from real tables, put it on a dashboard, share it — the build-insights flow's
 * own-data half, and the only place charts are built.
 *
 * Reached two ways, which is why it's a named constant rather than inline: by the own-data
 * fork after its first sync, and by a user who clicks "Build insights" once real data already
 * exists (having automated a pipeline, say). That second entry skips the sample/own-data
 * question entirely — the platform already has their data — and lands straight on 'chart_intro'.
 */
const CHART_TO_SHARE_TAIL: WalkthroughStage[] = [
  'chart_intro',
  'chart_create',
  'chart_pick_table',
  'chart_pick_type',
  'chart_continue',
  'chart_data_config',
  'chart_styling',
  'chart_save',
  'chart_dashboard_nudge',
  'dashboard_intro',
  'builder_add_chart_first',
  'builder_add_kpi_second',
  'builder_resize',
  'builder_save',
  'builder_preview',
  'share',
  'share_public_toggle',
  'share_copy_link',
];

/** Shape the raw tables into one clean table, then make it repeatable. automate_pipeline only. */
const TRANSFORM_ORCHESTRATE_STAGES: WalkthroughStage[] = [
  'pipeline_transform_intro',
  'pipeline_workflow_intro',
  'pipeline_pick_table',
  'pipeline_select_node',
  'pipeline_pick_function',
  'pipeline_drop_columns',
  'pipeline_save_table',
  'pipeline_name_table',
  'pipeline_save_new_table',
  'pipeline_table_built',
  'pipeline_publish_commit',
  'pipeline_orchestrate_nudge',
  'pipeline_orchestrate_intro',
  'pipeline_add_connection',
  'pipeline_run_transform',
  'pipeline_set_schedule',
  'pipeline_create_it',
];

// The own-data path's own linear order — kept separate from WALKTHROUGH_STAGE_ORDER
// since the two forks aren't a single sequence (they diverge at fork2 and converge
// again at dashboard_intro, which both paths reuse). Contains no pipeline_* stage by
// design: connecting your own data and charting it is the whole flow. Also the order used
// when the chart tail is entered directly, without the fork — see CHART_ENTRY_STAGE.
export const OWN_DATA_WALKTHROUGH_STAGE_ORDER: WalkthroughStage[] = [
  'fork2',
  'own_data_ingest',
  'own_data_pick_source',
  'own_data_source_next',
  ...CHART_TO_SHARE_TAIL,
];

// The automate-pipeline path's own linear order. Diverges at the very first step (no fork2 —
// the GetStartedModal routes straight here) and ENDS at the created pipeline: a scheduled
// pipeline is what this walkthrough set out to build. Charting what it produces is the
// build-insights flow, started separately from the Get Started checklist.
export const AUTOMATE_PIPELINE_STAGE_ORDER: WalkthroughStage[] = [
  'pipeline_ingest_nudge',
  'pipeline_ingest',
  'pipeline_pick_source',
  'pipeline_source_next',
  ...TRANSFORM_ORCHESTRATE_STAGES,
];

/** The linear order the given fork runs in — the three arrays above, keyed by path. */
export function stageOrderFor(path: WalkthroughPath | null): WalkthroughStage[] {
  if (path === 'own_data') return OWN_DATA_WALKTHROUGH_STAGE_ORDER;
  if (path === 'automate_pipeline') return AUTOMATE_PIPELINE_STAGE_ORDER;
  return WALKTHROUGH_STAGE_ORDER;
}

/**
 * The stage the chart tail starts at. Used when build-insights is entered with real data
 * already in the platform (typically right after the automate-pipeline walkthrough): there's
 * nothing to ask at fork2 — the user's own data is already there — so the flow opens here.
 */
export const CHART_ENTRY_STAGE: WalkthroughStage = 'chart_intro';

/**
 * Where each path goes the moment its tracked connection's first sync SUCCEEDS. own_data has no
 * transform/orchestrate leg, so it rejoins at the chart tail; automate_pipeline rejoins at
 * Transform. Read by tour-gate's sync checkpoint.
 */
export const POST_SYNC_STAGE_FOR: Record<'own_data' | 'automate_pipeline', WalkthroughStage> = {
  own_data: 'chart_intro',
  automate_pipeline: 'pipeline_transform_intro',
};

/**
 * Where each path goes when the user dismisses the sync-failure coachmark with "Got it".
 *
 * Back to its own ingest stage rather than to a "dismissed" flag: that stage is already silent
 * while a tracked connection exists (see INGEST_STAGES), so the coachmark goes away and stays
 * away — shown once, as intended — while the walkthrough itself stays live and the checkpoint
 * keeps watching. Retrying the sync or connecting a different source then picks the flow back
 * up on its own, with no extra state to remember or clear.
 */
export const SYNC_RETRY_STAGE_FOR: Record<'own_data' | 'automate_pipeline', WalkthroughStage> = {
  own_data: 'own_data_ingest',
  automate_pipeline: 'pipeline_ingest',
};

/**
 * Both forks' ingest stages — every stage that lives on /ingest before the first sync.
 *
 * Two consumers:
 *  - the coachmark, which goes silent on these while a tracked connection is mid-sync ("add a
 *    source" is actively misleading once they already have), and
 *  - tour-gate's checkpoint, which only puts a user into the sync_running/sync_failed holding
 *    pattern FROM one of these (plus the holding stages themselves — see SYNC_WAIT_STAGES).
 *    Without that guard, a second connection created later in the flow would drag someone who
 *    is already building charts back to "your sync is running".
 */
export const INGEST_STAGES: WalkthroughStage[] = [
  'own_data_ingest',
  'own_data_pick_source',
  'own_data_source_next',
  // The nudge included: "go connect your data" is just as misleading as "add a source" once
  // the connection they already made is mid-sync.
  'pipeline_ingest_nudge',
  'pipeline_ingest',
  'pipeline_pick_source',
  'pipeline_source_next',
];

/** Every stage from which the sync checkpoint may show a waiting/failed coachmark. */
export const SYNC_WAIT_STAGES: WalkthroughStage[] = [
  ...INGEST_STAGES,
  'sync_running',
  'sync_failed',
];

/**
 * Is `stage` earlier than `target` in this fork's order? Used to keep progress monotonic:
 * a checkpoint can then say "move to X unless we're already past it", which is what lets a
 * user who skipped a hint (left a defaulted dropdown alone, clicked past a field) rejoin the
 * flow at the next real action instead of stalling on a step that will never fire.
 *
 * Unknown stages (not in this fork's order) count as "before" — better to advance than to
 * leave the walkthrough stuck behind a stage that isn't part of this path at all.
 */
export function isStageBefore(
  path: WalkthroughPath | null,
  stage: WalkthroughStage,
  target: WalkthroughStage
): boolean {
  const order = stageOrderFor(path);
  const targetIndex = order.indexOf(target);
  if (targetIndex === -1) return true;
  const stageIndex = order.indexOf(stage);
  return stageIndex === -1 || stageIndex < targetIndex;
}

/**
 * Each fork's source-picker stage, mapped to the "click New Source" stage that reopens the
 * wizard it lives in.
 */
const PICK_SOURCE_TO_INGEST_STAGE: Record<string, WalkthroughStage> = {
  own_data_pick_source: 'own_data_ingest',
  pipeline_pick_source: 'pipeline_ingest',
};

/**
 * Which picker stage each "click New Source" stage hands off to. SelectSourceStep advances
 * through this on mount, which is the one signal that holds however the picker was reached —
 * a New Source click, Back from the configure step, or the wizard auto-opening on its
 * warehouse step for an org that has none yet (that org has no New Source button to click at
 * all, so a click-based handoff would never fire for the very users this fork targets).
 *
 * Derived rather than written out twice so the pair can't drift.
 */
export const PICK_SOURCE_STAGE_FOR: Partial<Record<WalkthroughStage, WalkthroughStage>> =
  Object.fromEntries(
    Object.entries(PICK_SOURCE_TO_INGEST_STAGE).map(([pickStage, ingestStage]) => [
      ingestStage,
      pickStage,
    ])
  );

/**
 * Which "click Next" stage each picker stage hands off to, once the user has selected a
 * source. The picker coachmark deliberately doesn't name a source — any of them is a valid
 * choice, popular card or search result — so the handoff is the selection itself, whatever
 * was selected (see SelectSourceStep). Without this the coachmark stayed parked on the
 * picker and never told the user the Next button was now live.
 */
export const SOURCE_NEXT_STAGE_FOR: Partial<Record<WalkthroughStage, WalkthroughStage>> = {
  own_data_pick_source: 'own_data_source_next',
  pipeline_pick_source: 'pipeline_source_next',
};

/**
 * Every stage whose coachmark target lives INSIDE the add-source wizard dialog — the picker
 * and its Next button — mapped to the "click New Source" stage that reopens it.
 *
 * Two consumers, both needing the same set:
 *  - ingest-view.tsx, which otherwise hides every coachmark while the wizard is open (these
 *    are the exception — they're pointing at something in it) and which rewinds through this
 *    map when the wizard is dismissed without a connection, so the walkthrough isn't left
 *    waiting on a card that no longer exists.
 *  - RESUME_ANCHOR_STAGES below, for the same reason on a cold page load.
 */
export const PICK_SOURCE_REWIND_STAGES: Partial<Record<WalkthroughStage, WalkthroughStage>> =
  Object.fromEntries(
    Object.entries(PICK_SOURCE_TO_INGEST_STAGE).flatMap(([pickStage, ingestStage]) => [
      [pickStage, ingestStage],
      [SOURCE_NEXT_STAGE_FOR[pickStage as WalkthroughStage]!, ingestStage],
    ])
  );

/** Is this stage's coachmark target inside the add-source wizard? */
export function isWizardCoachedStage(stage: WalkthroughStage | null): boolean {
  return stage !== null && stage in PICK_SOURCE_REWIND_STAGES;
}

/**
 * Where a flow re-enters when the user comes back to it from the Get Started widget.
 *
 * Most stages can simply be navigated back to, but many target something that only exists
 * mid-interaction — a field inside the KPI dialog, a form inside the transform canvas's
 * right panel, a tile in a dashboard that was never saved. Landing on those routes cold
 * shows no coachmark at all (the highlight just waits for a selector that never appears),
 * so each one maps back to the last stage reachable from a freshly-loaded page.
 *
 * Stages absent from this map resume as themselves.
 */
export const RESUME_ANCHOR_STAGES: Partial<Record<WalkthroughStage, WalkthroughStage>> = {
  // Everything from kpi_metric on lives inside the KPI form dialog.
  kpi_metric: 'kpi_intro',
  kpi_step1_continue: 'kpi_intro',
  kpi_target: 'kpi_intro',
  kpi_direction: 'kpi_intro',
  kpi_continue: 'kpi_intro',
  kpi_time_column: 'kpi_intro',
  kpi_type: 'kpi_intro',
  kpi_submit: 'kpi_intro',
  // The builder stages need a dashboard in progress — an unsaved one is gone on reload, so
  // re-enter at "create a dashboard". 'share' needs a dashboard id we can't know either.
  builder_add_kpi: 'dashboard_intro',
  builder_add_chart: 'dashboard_intro',
  builder_resize: 'dashboard_intro',
  builder_save: 'dashboard_intro',
  builder_preview: 'dashboard_intro',
  share: 'dashboard_intro',
  // Lives inside the share dialog of a dashboard we can't identify on a cold load.
  share_public_toggle: 'dashboard_intro',
  share_copy_link: 'dashboard_intro',
  builder_add_chart_first: 'dashboard_intro',
  builder_add_kpi_second: 'dashboard_intro',
  ...PICK_SOURCE_REWIND_STAGES,
  // chart_intro and chart_dashboard_nudge are deliberately ABSENT: both point at a sidebar
  // link, which is on screen on every route, so a cold load can show them exactly where the
  // user is. Anchoring chart_intro to chart_create (a /charts-only stage) meant refreshing
  // anywhere else parked the coachmark until the user happened to navigate there.
  //
  // /charts/new cold-loads with no dataset picked and no type chosen, and /charts/new/configure
  // can't be reached at all without a chart in progress — so the whole builder run re-enters
  // at "click Create chart".
  chart_pick_table: 'chart_create',
  chart_pick_type: 'chart_create',
  chart_continue: 'chart_create',
  chart_data_config: 'chart_create',
  chart_styling: 'chart_create',
  chart_save: 'chart_create',
  pipeline_transform_intro: 'pipeline_workflow_intro',
  // Canvas stages that depend on a selected node or an open operation panel.
  pipeline_select_node: 'pipeline_pick_table',
  pipeline_pick_function: 'pipeline_pick_table',
  pipeline_drop_columns: 'pipeline_pick_table',
  pipeline_save_table: 'pipeline_pick_table',
  pipeline_name_table: 'pipeline_pick_table',
  pipeline_save_new_table: 'pipeline_pick_table',
  // The Publish dialog is gone on a cold load, but the Publish button that opens it is right
  // there on the canvas — re-enter one step back rather than at the top of the canvas run.
  pipeline_publish_commit: 'pipeline_table_built',
};

export function getResumeAnchorStage(stage: WalkthroughStage): WalkthroughStage {
  return RESUME_ANCHOR_STAGES[stage] ?? stage;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
//
// Two kinds of key, scoped differently on purpose:
//
//  1. PER-FLOW state — "where am I in THIS walkthrough": stage, chosen fork, done flag,
//     tracked connection. Keyed `<prefix><flow>_<userId>_<orgSlug>`. Without the flow segment,
//     starting the automate-pipeline walkthrough overwrote a half-finished build-insights run
//     (one `stage_` slot for both), and finishing either one set a single `done_` flag that
//     stopped the other from ever resuming.
//
//  2. SHARED milestones — "what has this user actually done in this org": connected real data,
//     created a chart, shared a dashboard. Keyed `<prefix><userId>_<orgSlug>`, with no flow
//     segment, because they're facts rather than progress. Doing the work once counts for both
//     flows, so a user who connected data via automate-pipeline isn't asked to connect it again
//     by build-insights.
//
// Every key ends with `<userId>_<orgSlug>`: progress is per-org, and a shared browser (or one
// user in several orgs) must not blur two participants together. That pair is exactly the
// backend's granularity too — UserPreferences.trial_walkthrough hangs off a OneToOne to OrgUser.

const WALKTHROUGH_STORAGE_NAMESPACE = 'dalgo_insight_walkthrough_';

const STAGE_STORAGE_PREFIX = 'dalgo_insight_walkthrough_stage_';
const DONE_STORAGE_PREFIX = 'dalgo_insight_walkthrough_done_';
const PATH_STORAGE_PREFIX = 'dalgo_insight_walkthrough_path_';
const CONNECTION_STORAGE_PREFIX = 'dalgo_insight_walkthrough_conn_';
// When the connection above was tracked, as epoch ms. Written with it and read only by the
// sync checkpoint, which needs to tell "created seconds ago and not in the list YET" from
// "gone from the list because it was deleted" — see getTrackedConnectionAt.
const CONNECTION_TRACKED_AT_PREFIX = 'dalgo_insight_walkthrough_conn_at_';

export type WalkthroughPath = 'sample' | 'own_data' | 'automate_pipeline';

/**
 * Which of the independently-runnable walkthroughs a piece of state belongs to. Mirrors the
 * backend's flow keys (minus 'product_tour', which has its own storage): both insight forks
 * record against 'insights', because fork2 asks the user to pick one of the two — they're
 * branches of a single walkthrough, not two.
 */
export type WalkthroughFlow = 'insights' | 'automate_pipeline';

export function flowForPath(path: WalkthroughPath | null): WalkthroughFlow {
  return path === 'automate_pipeline' ? 'automate_pipeline' : 'insights';
}

/** Per-flow key: `<prefix><flow>_<userId>_<orgSlug>`. */
function flowKey(prefix: string, flow: WalkthroughFlow, scope: WalkthroughScope): string {
  return `${prefix}${flow}_${scopeSuffix(scope)}`;
}

/** Shared-milestone key: `<prefix><userId>_<orgSlug>`, no flow segment. */
function scopedKey(prefix: string, scope: WalkthroughScope): string {
  return `${prefix}${scopeSuffix(scope)}`;
}

/**
 * Read a flow-scoped value. Returns null when there's no scope yet (pre-login) or storage is
 * unavailable (private mode) — callers treat both as "nothing recorded".
 */
function readFlowValue(prefix: string, flow: WalkthroughFlow): string | null {
  try {
    const scope = getWalkthroughScope();
    if (!scope) return null;
    return localStorage.getItem(flowKey(prefix, flow, scope));
  } catch {
    return null;
  }
}

function writeFlowValue(prefix: string, flow: WalkthroughFlow, value: string): void {
  try {
    const scope = getWalkthroughScope();
    if (!scope) return;
    localStorage.setItem(flowKey(prefix, flow, scope), value);
  } catch {
    // localStorage unavailable (e.g. private mode) — worst case the walkthrough restarts.
  }
}

function removeFlowValue(prefix: string, flow: WalkthroughFlow): void {
  try {
    const scope = getWalkthroughScope();
    if (!scope) return;
    localStorage.removeItem(flowKey(prefix, flow, scope));
  } catch {
    // no-op
  }
}

/** Set a shared milestone flag. Milestones are write-once — there's no "unmark". */
function markMilestone(prefix: string): void {
  try {
    const scope = getWalkthroughScope();
    if (!scope) return;
    localStorage.setItem(scopedKey(prefix, scope), '1');
  } catch {
    // no-op
  }
}

function hasMilestone(prefix: string): boolean {
  try {
    const scope = getWalkthroughScope();
    if (!scope) return false;
    return localStorage.getItem(scopedKey(prefix, scope)) === '1';
  } catch {
    return false;
  }
}

export function getStoredWalkthroughStage(flow: WalkthroughFlow): WalkthroughStage | null {
  return (readFlowValue(STAGE_STORAGE_PREFIX, flow) as WalkthroughStage) || null;
}

export function saveWalkthroughStage(flow: WalkthroughFlow, stage: WalkthroughStage): void {
  writeFlowValue(STAGE_STORAGE_PREFIX, flow, stage);
}

export function clearWalkthroughState(flow: WalkthroughFlow): void {
  removeFlowValue(STAGE_STORAGE_PREFIX, flow);
}

export function markWalkthroughDone(flow: WalkthroughFlow): void {
  writeFlowValue(DONE_STORAGE_PREFIX, flow, '1');
}

export function hasFinishedWalkthrough(flow: WalkthroughFlow): boolean {
  return readFlowValue(DONE_STORAGE_PREFIX, flow) === '1';
}

// Persists across skip()/finish() (unlike stage) — the getting-started widget reads
// this after completion to know which branch the user took.
export function getStoredPath(flow: WalkthroughFlow): WalkthroughPath | null {
  return (readFlowValue(PATH_STORAGE_PREFIX, flow) as WalkthroughPath) || null;
}

export function savePath(flow: WalkthroughFlow, path: WalkthroughPath): void {
  writeFlowValue(PATH_STORAGE_PREFIX, flow, path);
}

// Tracks the specific connection created during the own-data or automate-pipeline fork,
// so a later page load (possibly a new session, if the user left before the first sync
// finished) can tell whether THIS connection has synced — not just any connection in the org.
// Per-flow: each walkthrough tracks the connection IT created, so running one doesn't leave
// the other watching a connection it never saw made.
export function getStoredTrackedConnection(flow: WalkthroughFlow): string | null {
  return readFlowValue(CONNECTION_STORAGE_PREFIX, flow);
}

// Which failed sync run the user has already acknowledged ("Got it" on the sync_failed
// coachmark), as its Airbyte job id.
//
// Keyed by RUN, not by connection or by a plain "dismissed" flag, so the coachmark behaves the
// way the user expects in all three cases: the same failure never nags twice (including across
// reloads, since this is persisted), while a retry that fails again — or a different connection
// that fails — is a new job id and does speak up. Per flow, like the tracked connection it
// belongs to.
const SYNC_DISMISSED_RUN_STORAGE_PREFIX = 'dalgo_insight_walkthrough_sync_dismissed_run_';

export function getDismissedSyncRun(flow: WalkthroughFlow): string | null {
  return readFlowValue(SYNC_DISMISSED_RUN_STORAGE_PREFIX, flow);
}

export function saveDismissedSyncRun(flow: WalkthroughFlow, runId: string): void {
  writeFlowValue(SYNC_DISMISSED_RUN_STORAGE_PREFIX, flow, runId);
}

/**
 * When the tracked connection was recorded, or null if unknown (tracking written by a build
 * that predates this key). Null reads as "long ago": the checkpoint's grace period only ever
 * protects a connection we know was created moments ago.
 */
export function getTrackedConnectionAt(flow: WalkthroughFlow): number | null {
  const raw = readFlowValue(CONNECTION_TRACKED_AT_PREFIX, flow);
  const at = raw === null ? NaN : Number(raw);
  return Number.isFinite(at) ? at : null;
}

export function saveTrackedConnection(flow: WalkthroughFlow, connectionId: string): void {
  writeFlowValue(CONNECTION_TRACKED_AT_PREFIX, flow, String(Date.now()));
  writeFlowValue(CONNECTION_STORAGE_PREFIX, flow, connectionId);
}

export function clearTrackedConnection(flow: WalkthroughFlow): void {
  removeFlowValue(CONNECTION_STORAGE_PREFIX, flow);
  removeFlowValue(CONNECTION_TRACKED_AT_PREFIX, flow);
}

// Which flow the user was last driving. Scoped to the user+org (NOT per flow — it's the
// pointer that picks between them), and needed because both flows can hold a half-finished
// stage at once: on a cold page load "resume the walkthrough" would otherwise have to guess,
// and would keep dragging someone back to whichever flow won an arbitrary tie-break.
const ACTIVE_FLOW_STORAGE_PREFIX = 'dalgo_insight_walkthrough_active_flow_';

export function getActiveWalkthroughFlow(): WalkthroughFlow | null {
  try {
    const scope = getWalkthroughScope();
    if (!scope) return null;
    const raw = localStorage.getItem(scopedKey(ACTIVE_FLOW_STORAGE_PREFIX, scope));
    return raw === 'insights' || raw === 'automate_pipeline' ? raw : null;
  } catch {
    return null;
  }
}

export function saveActiveWalkthroughFlow(flow: WalkthroughFlow): void {
  try {
    const scope = getWalkthroughScope();
    if (!scope) return;
    localStorage.setItem(scopedKey(ACTIVE_FLOW_STORAGE_PREFIX, scope), flow);
  } catch {
    // no-op
  }
}

export function clearActiveWalkthroughFlow(): void {
  try {
    const scope = getWalkthroughScope();
    if (!scope) return;
    localStorage.removeItem(scopedKey(ACTIVE_FLOW_STORAGE_PREFIX, scope));
  } catch {
    // no-op
  }
}

// --- Shared milestones ---
// Set unconditionally on the real user action, regardless of which flow (if any) is running.
// That's what lets a returning user (new session, tour not running) get an accurate
// "resume here" nudge computed from actual progress — see flow-resume.ts — and what lets work
// done in one walkthrough count towards the other.

const CONNECTED_REAL_DATA_STORAGE_PREFIX = 'dalgo_insight_walkthrough_connected_';
const PIPELINE_CREATED_STORAGE_PREFIX = 'dalgo_insight_walkthrough_pipeline_created_';
const KPI_CREATED_STORAGE_PREFIX = 'dalgo_insight_walkthrough_kpi_created_';
const CHART_CREATED_STORAGE_PREFIX = 'dalgo_insight_walkthrough_chart_created_';
const CHART_IN_DASHBOARD_STORAGE_PREFIX = 'dalgo_insight_walkthrough_chart_in_dash_';
const KPI_IN_DASHBOARD_STORAGE_PREFIX = 'dalgo_insight_walkthrough_kpi_in_dash_';
const DASHBOARD_SHARED_STORAGE_PREFIX = 'dalgo_insight_walkthrough_shared_';
const TRANSFORM_PUBLISHED_STORAGE_PREFIX = 'dalgo_insight_walkthrough_transform_published_';

// Set the moment a walkthrough's tracked connection syncs successfully, whichever flow was
// running and whether or not that flow later finishes or is skipped. Figma's automate-pipeline
// widget screenshot shows "Connect your own data" checked right after ingest completes, well
// before the rest of that flow finishes.
export function markConnectedRealData(): void {
  markMilestone(CONNECTED_REAL_DATA_STORAGE_PREFIX);
}

export function hasConnectedRealData(): boolean {
  return hasMilestone(CONNECTED_REAL_DATA_STORAGE_PREFIX);
}

// Set the moment "Create Pipeline" succeeds — independent of the flow's done flag, which only
// fires once the automate-pipeline fork's chart/dashboard/share tail also completes. The
// getting-started widget's "Automate data pipeline" item needs to check in right away.
export function markPipelineCreated(): void {
  markMilestone(PIPELINE_CREATED_STORAGE_PREFIX);
}

export function hasPipelineCreated(): boolean {
  return hasMilestone(PIPELINE_CREATED_STORAGE_PREFIX);
}

export function markKpiCreated(): void {
  markMilestone(KPI_CREATED_STORAGE_PREFIX);
}

export function hasKpiCreated(): boolean {
  return hasMilestone(KPI_CREATED_STORAGE_PREFIX);
}

export function markChartCreated(): void {
  markMilestone(CHART_CREATED_STORAGE_PREFIX);
}

export function hasChartCreated(): boolean {
  return hasMilestone(CHART_CREATED_STORAGE_PREFIX);
}

export function markChartAddedToDashboard(): void {
  markMilestone(CHART_IN_DASHBOARD_STORAGE_PREFIX);
}

export function hasChartAddedToDashboard(): boolean {
  return hasMilestone(CHART_IN_DASHBOARD_STORAGE_PREFIX);
}

export function markKpiAddedToDashboard(): void {
  markMilestone(KPI_IN_DASHBOARD_STORAGE_PREFIX);
}

export function hasKpiAddedToDashboard(): boolean {
  return hasMilestone(KPI_IN_DASHBOARD_STORAGE_PREFIX);
}

export function markDashboardShared(): void {
  markMilestone(DASHBOARD_SHARED_STORAGE_PREFIX);
}

export function hasDashboardShared(): boolean {
  return hasMilestone(DASHBOARD_SHARED_STORAGE_PREFIX);
}

// Set once a dbt workflow has been created, run, AND published — publish is the last of the
// three, so its success handler is the single point that marks this (see PublishModal.tsx).
export function markTransformPublished(): void {
  markMilestone(TRANSFORM_PUBLISHED_STORAGE_PREFIX);
}

export function hasTransformPublished(): boolean {
  return hasMilestone(TRANSFORM_PUBLISHED_STORAGE_PREFIX);
}

/**
 * Drops ONE flow's scratch space — its stage, fork, done flag and tracked connection. Called
 * once that flow resolves AND its backend write lands: from then on the record lives
 * server-side (see hooks/api/useTrialWalkthrough.ts).
 *
 * Deliberately leaves alone:
 *  - the other flow's keys, which may belong to a run the user is still in the middle of, and
 *  - the shared milestones, which are facts about work actually done. Clearing those would make
 *    the other flow ask the user to connect data or build a chart they already have. (This is
 *    the opposite of what the old org-wide version did — it prefix-matched and wiped
 *    everything, which is exactly how finishing one walkthrough erased the other.)
 *
 * Matched by prefix rather than an explicit key list so a per-flow key added later can't be
 * forgotten here.
 */
export function clearWalkthroughStorage(flow: WalkthroughFlow): void {
  try {
    const scope = getWalkthroughScope();
    if (!scope) return;
    const suffix = `${flow}_${scopeSuffix(scope)}`;
    Object.keys(localStorage)
      .filter((key) => key.startsWith(WALKTHROUGH_STORAGE_NAMESPACE) && key.endsWith(suffix))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // no-op
  }
}
