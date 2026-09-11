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
  // Step 3's two explainers, ahead of KPI Type. Both are things an NGO has to understand
  // before the numbers on the card mean anything — what makes a KPI green rather than red,
  // and which programme the KPI belongs to — and neither was coached at all.
  | 'kpi_thresholds'
  | 'kpi_program_tags'
  | 'kpi_type'
  | 'kpi_submit'
  // Look at the KPI you just built. All three live inside the detail drawer, which the
  // celebration dialog's "View KPI" opens directly — no stage rings the new card first.
  | 'kpi_duration'
  | 'kpi_add_note'
  // The drawer's ✕. Coached because the next stage rings the Dashboards nav item, which the
  // 600px drawer covers — closing it is a real step, not an escape.
  | 'kpi_close_drawer'
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
  // The rest of the add-source wizard, which used to run uncoached. Split by wizard step
  // because the two halves have different audiences:
  //  - *_sheet_link / *_sheet_auth / *_config_next are the CONFIGURE step, whose fields are
  //    the chosen source's own. Only a Google Sheets run enters them (see
  //    CreateSourceStep) — a Postgres user has no spreadsheet link to be coached about.
  //  - *_streams_scroll / *_streams_cast / *_connection_create are the SELECT DATA step,
  //    which looks the same whatever the source, so every run enters it. The cast stage is
  //    the one exception and is stepped over where casting isn't offered (see
  //    connection-form-body.tsx).
  | 'own_data_sheet_link'
  | 'own_data_sheet_auth'
  | 'own_data_config_next'
  | 'own_data_streams_scroll'
  | 'own_data_streams_cast'
  | 'own_data_connection_create'
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
  // This fork's copies of the wizard stages above — same wizard, same copy, separate ids so
  // each fork rewinds to its own ingest step.
  | 'pipeline_sheet_link'
  | 'pipeline_sheet_auth'
  | 'pipeline_config_next'
  | 'pipeline_streams_scroll'
  | 'pipeline_streams_cast'
  | 'pipeline_connection_create'
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
  // Step 3, in the order the step renders: RAG thresholds, then Program Tags, then KPI Type.
  'kpi_thresholds',
  'kpi_program_tags',
  'kpi_type',
  'kpi_submit',
  'kpi_duration',
  'kpi_add_note',
  'kpi_close_drawer',
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
/**
 * The add-source wizard's own steps, in the order the wizard renders them, for each fork.
 *
 * Named arrays rather than inline entries because five separate places need exactly this set:
 * the fork's order, INGEST_STAGES (and through it the sync-watch sets), and the wizard-rewind
 * map. Spelling it out at each of those was how the earlier ingest stages drifted.
 */
export const OWN_DATA_WIZARD_STAGES: WalkthroughStage[] = [
  'own_data_sheet_link',
  'own_data_sheet_auth',
  'own_data_config_next',
  'own_data_streams_scroll',
  'own_data_streams_cast',
  'own_data_connection_create',
];

export const PIPELINE_WIZARD_STAGES: WalkthroughStage[] = [
  'pipeline_sheet_link',
  'pipeline_sheet_auth',
  'pipeline_config_next',
  'pipeline_streams_scroll',
  'pipeline_streams_cast',
  'pipeline_connection_create',
];

export const OWN_DATA_WALKTHROUGH_STAGE_ORDER: WalkthroughStage[] = [
  'fork2',
  'own_data_ingest',
  'own_data_pick_source',
  'own_data_source_next',
  ...OWN_DATA_WIZARD_STAGES,
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
  ...PIPELINE_WIZARD_STAGES,
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
  // The wizard's own steps count as ingest: the connection is CREATED on the last of them, and
  // CONNECTION_WATCH_STAGES (built from this list) is what decides whether that connection
  // becomes the one the walkthrough follows to its first sync. Omit them and the flow parks on
  // "connect your data" with the data already syncing.
  ...OWN_DATA_WIZARD_STAGES,
  // The nudge included: "go connect your data" is just as misleading as "add a source" once
  // the connection they already made is mid-sync.
  'pipeline_ingest_nudge',
  'pipeline_ingest',
  'pipeline_pick_source',
  'pipeline_source_next',
  ...PIPELINE_WIZARD_STAGES,
];

/** Every stage from which the sync checkpoint may show a waiting/failed coachmark. */
export const SYNC_WAIT_STAGES: WalkthroughStage[] = [
  ...INGEST_STAGES,
  'sync_running',
  'sync_failed',
];

/**
 * The only stages at which a newly created connection becomes the one the walkthrough WATCHES
 * (see connection-form-body.tsx).
 *
 * The flow follows exactly one connection — the one it asked the user to make — through to its
 * first sync. Any connection created outside these stages is the user doing their own thing:
 * a second source added while an earlier one is still syncing, or anything added after the flow
 * moved on to transform. Letting one of those take over the watch is how the walkthrough ended
 * up parked on "connect your data" with data already in the warehouse — the new connection's
 * own sync may never be triggered, and the old, successful one was no longer being watched.
 *
 * 'sync_failed' IS included: its coachmark explicitly offers "connect a different source", and
 * that replacement has to become the watched connection for the promise to hold. 'sync_running'
 * is not — something is already being watched there.
 */
export const CONNECTION_WATCH_STAGES: WalkthroughStage[] = [...INGEST_STAGES, 'sync_failed'];

/**
 * Is `stage` earlier than `target` in this fork's order? Used to keep progress monotonic:
 * a checkpoint can then say "move to X unless we're already past it", which is what lets a
 * user who skipped a hint (left a defaulted dropdown alone, clicked past a field) rejoin the
 * flow at the next real action instead of stalling on a step that will never fire.
 *
 * Unknown stages (not in this fork's order) count as "before" — better to advance than to
 * leave the walkthrough stuck behind a stage that isn't part of this path at all.
 */
/**
 * Target prefilled into the KPI created during the walkthrough, and quoted in the coachmark
 * copy that explains it.
 *
 * A round, obviously-a-placeholder number, left editable. Lives here because the form fills the
 * field and the coachmark names it — the two must not disagree.
 */
export const WALKTHROUGH_DEFAULT_TARGET = '10000000';

/** The same target, grouped for prose ("10,000,000"). The input needs the bare string. */
export const WALKTHROUGH_DEFAULT_TARGET_DISPLAY = Number(WALKTHROUGH_DEFAULT_TARGET).toLocaleString(
  'en-US'
);

/**
 * Program tag prefilled into the KPI created during the walkthrough.
 *
 * The tag is how an NGO later filters its KPIs by programme, and an empty field taught none of
 * that. One filled-in tag shows what a tag looks like and leaves the user something to remove or
 * rename — see the kpi_program_tags coachmark. Editable, like the target above.
 */
export const WALKTHROUGH_DEFAULT_PROGRAM_TAG = 'Education';

/**
 * KPI type prefilled into the KPI created during the walkthrough. Must stay one of
 * METRIC_TYPE_TAG_OPTIONS' values (types/kpis.ts).
 *
 * Impact is the top of a results framework and the tag most NGOs recognise, so it's the one that
 * explains the field on sight. Prefilled — like the target and the programme tag — so the whole
 * KPI flow is Got it clicks rather than decisions; the coachmark names it and it stays editable.
 */
export const WALKTHROUGH_DEFAULT_KPI_TYPE = 'impact';

/** The same KPI type, capitalised as it reads on the button and in coachmark prose. */
export const WALKTHROUGH_DEFAULT_KPI_TYPE_DISPLAY = 'Impact';

/**
 * Time column preselected into the KPI created during the walkthrough, matched case-insensitively
 * against the metric table's date columns.
 *
 * The sample dataset's date column is called "date", so a walkthrough on sample data lands on the
 * intended column by name. Any other table falls back to its first date column — see kpi-form.tsx.
 */
export const WALKTHROUGH_PREFERRED_TIME_COLUMN = 'date';

/**
 * The metric the walkthrough's KPI is built on, when the org has one by this name.
 *
 * The picker is capped at a single option for a walkthrough run (see WALKTHROUGH_METRIC_LIMIT in
 * KpiMetricStep) so the step needs a click rather than a decision. Which option that is used to
 * be "whatever the API returned first" — an arbitrary metric whose value could be anything,
 * including one that charts as nothing. This names the seeded sample metric instead, so the
 * guided KPI lands on a number that reads sensibly. Falls back to the first metric wherever it
 * doesn't exist (an org with its own metrics library, sample data not seeded).
 */
export const WALKTHROUGH_METRIC_NAME = 'total_students';

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
 * Where the walkthrough picks up when the CONFIGURE step of the add-source wizard mounts —
 * keyed by the stage the run is currently on, so only a run that is genuinely at the wizard's
 * door walks through it.
 *
 * Entered from the picker's Next stage, and Google Sheets only (see CreateSourceStep): the
 * stages behind this map describe Google's own fields. Everything else carries on as it did
 * before these stages existed — silent through configure, rejoining at the connection step.
 */
export const WIZARD_CONFIG_ENTRY_STAGE_FOR: Partial<Record<WalkthroughStage, WalkthroughStage>> = {
  own_data_source_next: 'own_data_sheet_link',
  pipeline_source_next: 'pipeline_sheet_link',
};

/**
 * Where the walkthrough picks up when the SELECT DATA step mounts, keyed by the fork.
 *
 * Unlike the configure step this is source-agnostic — the connection form looks the same
 * whatever was picked — so every run enters it, including the ones that skipped the configure
 * coachmarks entirely. `advanceIfBefore` is what makes that safe: a Google Sheets run is
 * already past these, and jumping a Postgres run forward from the picker's Next stage is
 * exactly the intent.
 */
export const WIZARD_STREAMS_ENTRY_STAGE_FOR: Partial<Record<WalkthroughPath, WalkthroughStage>> = {
  own_data: 'own_data_streams_scroll',
  automate_pipeline: 'pipeline_streams_scroll',
};

/**
 * The stage to skip the cast coachmark forward to, keyed by the cast stage itself.
 *
 * Casting is offered for Google Sheets alone (see isCastSupportedSource), so for every other
 * source the "cast a numeric column" stage points at a column that isn't rendered. Rather than
 * let it sit there waiting, the connection form steps straight over it.
 */
export const WIZARD_CAST_SKIP_STAGE_FOR: Partial<Record<WalkthroughStage, WalkthroughStage>> = {
  own_data_streams_cast: 'own_data_connection_create',
  pipeline_streams_cast: 'pipeline_connection_create',
};

/**
 * Every stage whose coachmark target lives INSIDE the add-source wizard dialog — the picker,
 * its Next button, and each of the wizard's own steps — mapped to the "click New Source" stage
 * that reopens it.
 *
 * Two consumers, both needing the same set:
 *  - ingest-view.tsx, which otherwise hides every coachmark while the wizard is open (these
 *    are the exception — they're pointing at something in it) and which rewinds through this
 *    map when the wizard is dismissed without a connection, so the walkthrough isn't left
 *    waiting on a card that no longer exists.
 *  - RESUME_ANCHOR_STAGES below, for the same reason on a cold page load.
 */
const WIZARD_STAGES_FOR_PICK_SOURCE: Partial<Record<WalkthroughStage, WalkthroughStage[]>> = {
  own_data_pick_source: OWN_DATA_WIZARD_STAGES,
  pipeline_pick_source: PIPELINE_WIZARD_STAGES,
};

export const PICK_SOURCE_REWIND_STAGES: Partial<Record<WalkthroughStage, WalkthroughStage>> =
  Object.fromEntries(
    Object.entries(PICK_SOURCE_TO_INGEST_STAGE).flatMap(([pickStage, ingestStage]) => [
      [pickStage, ingestStage],
      [SOURCE_NEXT_STAGE_FOR[pickStage as WalkthroughStage]!, ingestStage],
      // Every later step of the same wizard rewinds to the same place. They are all inside the
      // dialog, so closing it strands them exactly as it strands the picker.
      ...(WIZARD_STAGES_FOR_PICK_SOURCE[pickStage as WalkthroughStage] ?? []).map(
        (wizardStage) => [wizardStage, ingestStage] as const
      ),
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
  kpi_thresholds: 'kpi_intro',
  kpi_program_tags: 'kpi_intro',
  kpi_type: 'kpi_intro',
  kpi_submit: 'kpi_intro',
  // A reload closes the drawer and nothing on a cold /kpis reopens it, so these resume FORWARD.
  // Looking at the KPI is optional; the dashboard is what's still owed.
  kpi_duration: 'dashboard_nudge',
  kpi_add_note: 'dashboard_nudge',
  kpi_close_drawer: 'dashboard_nudge',
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

/**
 * Retired stage ids still sitting in localStorage, mapped forward. Without this a stale id
 * resumes into a stage with no coachmark: nothing renders and the entry point reads as dead.
 */
const RETIRED_WALKTHROUGH_STAGES: Record<string, WalkthroughStage> = {
  kpi_view_card: 'dashboard_nudge',
};

export function getStoredWalkthroughStage(flow: WalkthroughFlow): WalkthroughStage | null {
  const stored = readFlowValue(STAGE_STORAGE_PREFIX, flow);
  if (!stored) return null;
  return RETIRED_WALKTHROUGH_STAGES[stored] ?? (stored as WalkthroughStage);
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

/**
 * Flows the user walked out of on purpose — "Exit walkthrough" on the leave prompt — and has
 * not restarted since.
 *
 * An intentional exit RESETS its flow: restarting asks the fork question again instead of
 * fast-forwarding off milestones earned in the run that was just abandoned. This is the record
 * of that, and it exists because neither other source can carry it:
 *  - the flow's own scratch keys (stage, chosen fork) are dropped the moment skip()'s backend
 *    write lands, so localStorage otherwise can't tell an exited flow from one never started;
 *  - the backend's `skipped` flag is refreshed by an async refetch, which a user clicking
 *    straight back into the checklist can easily beat.
 *
 * So the key is written synchronously by skip(), and is scoped per user+org WITHOUT the flow
 * segment — deliberately, so clearWalkthroughStorage (which matches keys ending
 * `<flow>_<userId>_<orgSlug>`) can't take it along with the scratch space it's there to outlive.
 * The flows themselves are held in the value.
 *
 * Cleared when the flow is actually restarted (a fork picked, or a forkless flow started), not
 * when the fork is merely offered: a user who closes that dialog without choosing hasn't
 * restarted anything and must be asked again.
 */
const EXITED_FLOWS_STORAGE_PREFIX = 'dalgo_insight_walkthrough_exited_';

function readExitedFlows(): WalkthroughFlow[] {
  try {
    const scope = getWalkthroughScope();
    if (!scope) return [];
    const raw = localStorage.getItem(scopedKey(EXITED_FLOWS_STORAGE_PREFIX, scope));
    if (!raw) return [];
    return raw
      .split(',')
      .filter(
        (flow): flow is WalkthroughFlow => flow === 'insights' || flow === 'automate_pipeline'
      );
  } catch {
    return [];
  }
}

function writeExitedFlows(flows: WalkthroughFlow[]): void {
  try {
    const scope = getWalkthroughScope();
    if (!scope) return;
    const key = scopedKey(EXITED_FLOWS_STORAGE_PREFIX, scope);
    if (flows.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, flows.join(','));
  } catch {
    // no-op
  }
}

export function markWalkthroughExited(flow: WalkthroughFlow): void {
  const flows = readExitedFlows();
  if (!flows.includes(flow)) writeExitedFlows([...flows, flow]);
}

export function hasWalkthroughExited(flow: WalkthroughFlow): boolean {
  return readExitedFlows().includes(flow);
}

export function clearWalkthroughExited(flow: WalkthroughFlow): void {
  const flows = readExitedFlows();
  if (flows.includes(flow)) writeExitedFlows(flows.filter((entry) => entry !== flow));
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
