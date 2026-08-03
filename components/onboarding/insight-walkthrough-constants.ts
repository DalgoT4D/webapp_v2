/**
 * Stage list + localStorage persistence for the post-tour "Build your first insight"
 * walkthrough (Figma "tour flow" sample-data fork, frames 2672:856 -> 2683:7260).
 * Mirrors tour-constants.ts's localStorage-only convention (no backend field — same
 * decision as the main product tour).
 */

export type WalkthroughStage =
  | 'fork2'
  | 'kpi_intro'
  | 'kpi_metric'
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
  // Own-data fork (Fork2 "CONNECT MY DATA"). own_data_ingest has no coachmark — the
  // ingest wizard already explains itself — and can outlive the browser session (a
  // sync can take a while), so it's the one stage resumed via a real API check
  // (see tour-gate.tsx) rather than a route match. own_data_builder_add_chart/kpi
  // are separate from builder_add_chart/kpi (not reused) because this path adds
  // them in the opposite order (chart first, since that's what was just built).
  | 'own_data_ingest'
  | 'own_data_charts_intro'
  | 'own_data_chart_create'
  | 'own_data_chart_save'
  | 'own_data_dashboard_nudge'
  | 'own_data_builder_add_chart'
  | 'own_data_builder_add_kpi'
  // Automate-pipeline fork (PostTourModal's "Automate Pipeline" option). No fork2 step —
  // single linear path: Ingest -> Transform (one clean table) -> Orchestrate (scheduled
  // pipeline). pipeline_ingest has no coachmark, same silent-wait treatment as
  // own_data_ingest, resumed via the tracked connection's sync status (see tour-gate.tsx).
  | 'pipeline_ingest'
  | 'pipeline_transform_intro'
  | 'pipeline_workflow_intro'
  | 'pipeline_pick_table'
  | 'pipeline_select_node'
  | 'pipeline_pick_function'
  | 'pipeline_drop_columns'
  | 'pipeline_save_table'
  | 'pipeline_name_table'
  | 'pipeline_table_built'
  | 'pipeline_orchestrate_intro'
  | 'pipeline_add_connection'
  | 'pipeline_run_transform'
  | 'pipeline_set_schedule'
  | 'pipeline_create_it';

export const WALKTHROUGH_STAGE_ORDER: WalkthroughStage[] = [
  'fork2',
  'kpi_intro',
  'kpi_metric',
  'kpi_target',
  'kpi_direction',
  'kpi_continue',
  'kpi_time_column',
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
];

// The own-data path's own linear order — kept separate from WALKTHROUGH_STAGE_ORDER
// since the two forks aren't a single sequence (they diverge at fork2 and converge
// again at dashboard_intro, which both paths reuse).
export const OWN_DATA_WALKTHROUGH_STAGE_ORDER: WalkthroughStage[] = [
  'fork2',
  'own_data_ingest',
  'own_data_charts_intro',
  'own_data_chart_create',
  'own_data_chart_save',
  'own_data_dashboard_nudge',
  'dashboard_intro',
  'own_data_builder_add_chart',
  'own_data_builder_add_kpi',
  'builder_resize',
  'builder_save',
  'builder_preview',
  'share',
];

// The automate-pipeline path's own linear order — kept separate from
// WALKTHROUGH_STAGE_ORDER/OWN_DATA_WALKTHROUGH_STAGE_ORDER since it diverges at the
// very first step (no fork2 — PostTourModal routes straight here).
export const AUTOMATE_PIPELINE_STAGE_ORDER: WalkthroughStage[] = [
  'pipeline_ingest',
  'pipeline_transform_intro',
  'pipeline_workflow_intro',
  'pipeline_pick_table',
  'pipeline_select_node',
  'pipeline_pick_function',
  'pipeline_drop_columns',
  'pipeline_save_table',
  'pipeline_name_table',
  'pipeline_table_built',
  'pipeline_orchestrate_intro',
  'pipeline_add_connection',
  'pipeline_run_transform',
  'pipeline_set_schedule',
  'pipeline_create_it',
];

const STAGE_STORAGE_PREFIX = 'dalgo_insight_walkthrough_stage_';
const DONE_STORAGE_PREFIX = 'dalgo_insight_walkthrough_done_';
const PATH_STORAGE_PREFIX = 'dalgo_insight_walkthrough_path_';
const CONNECTION_STORAGE_PREFIX = 'dalgo_insight_walkthrough_conn_';

export type WalkthroughPath = 'sample' | 'own_data' | 'automate_pipeline';

export function getStoredWalkthroughStage(orgSlug: string): WalkthroughStage | null {
  try {
    const raw = localStorage.getItem(`${STAGE_STORAGE_PREFIX}${orgSlug}`);
    return (raw as WalkthroughStage) || null;
  } catch {
    return null;
  }
}

export function saveWalkthroughStage(orgSlug: string, stage: WalkthroughStage): void {
  try {
    localStorage.setItem(`${STAGE_STORAGE_PREFIX}${orgSlug}`, stage);
  } catch {
    // localStorage unavailable (e.g. private mode) — worst case the walkthrough restarts.
  }
}

export function clearWalkthroughState(orgSlug: string): void {
  try {
    localStorage.removeItem(`${STAGE_STORAGE_PREFIX}${orgSlug}`);
  } catch {
    // no-op
  }
}

export function markWalkthroughDone(orgSlug: string): void {
  try {
    localStorage.setItem(`${DONE_STORAGE_PREFIX}${orgSlug}`, '1');
  } catch {
    // no-op
  }
}

export function hasFinishedWalkthrough(orgSlug: string): boolean {
  try {
    return localStorage.getItem(`${DONE_STORAGE_PREFIX}${orgSlug}`) === '1';
  } catch {
    return false;
  }
}

// Persists across skip()/finish() (unlike stage) — the getting-started widget reads
// this after completion to know which branch the user took.
export function getStoredPath(orgSlug: string): WalkthroughPath | null {
  try {
    const raw = localStorage.getItem(`${PATH_STORAGE_PREFIX}${orgSlug}`);
    return (raw as WalkthroughPath) || null;
  } catch {
    return null;
  }
}

export function savePath(orgSlug: string, path: WalkthroughPath): void {
  try {
    localStorage.setItem(`${PATH_STORAGE_PREFIX}${orgSlug}`, path);
  } catch {
    // no-op
  }
}

// Tracks the specific connection created during the own-data or automate-pipeline fork,
// so a later page load (possibly a new session, if the user left before the first sync
// finished) can tell whether THIS connection has synced — not just any connection in the org.
export function getStoredTrackedConnection(orgSlug: string): string | null {
  try {
    return localStorage.getItem(`${CONNECTION_STORAGE_PREFIX}${orgSlug}`);
  } catch {
    return null;
  }
}

export function saveTrackedConnection(orgSlug: string, connectionId: string): void {
  try {
    localStorage.setItem(`${CONNECTION_STORAGE_PREFIX}${orgSlug}`, connectionId);
  } catch {
    // no-op
  }
}

export function clearTrackedConnection(orgSlug: string): void {
  try {
    localStorage.removeItem(`${CONNECTION_STORAGE_PREFIX}${orgSlug}`);
  } catch {
    // no-op
  }
}

const CONNECTED_REAL_DATA_STORAGE_PREFIX = 'dalgo_insight_walkthrough_connected_';

// Set the moment the fork's tracked connection syncs successfully, regardless of which
// fork (own_data or automate_pipeline) is running and regardless of whether that fork
// later finishes or is skipped. Decoupled from `path`/hasFinishedWalkthrough on purpose —
// Figma's automate-pipeline widget screenshot shows "Connect your own data" checked right
// after ingest completes, well before the rest of that flow finishes. Never cleared by
// skip()/finish() — like `path`, the getting-started widget reads it long-term.
export function markConnectedRealData(orgSlug: string): void {
  try {
    localStorage.setItem(`${CONNECTED_REAL_DATA_STORAGE_PREFIX}${orgSlug}`, '1');
  } catch {
    // no-op
  }
}

export function hasConnectedRealData(orgSlug: string): boolean {
  try {
    return localStorage.getItem(`${CONNECTED_REAL_DATA_STORAGE_PREFIX}${orgSlug}`) === '1';
  } catch {
    return false;
  }
}
