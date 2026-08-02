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
  | 'own_data_builder_add_kpi';

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

const STAGE_STORAGE_PREFIX = 'dalgo_insight_walkthrough_stage_';
const DONE_STORAGE_PREFIX = 'dalgo_insight_walkthrough_done_';
const PATH_STORAGE_PREFIX = 'dalgo_insight_walkthrough_path_';
const CONNECTION_STORAGE_PREFIX = 'dalgo_insight_walkthrough_conn_';

export type WalkthroughPath = 'sample' | 'own_data';

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

// Tracks the specific connection created during the own-data fork, so a later page
// load (possibly a new session, if the user left before the first sync finished)
// can tell whether THIS connection has synced — not just any connection in the org.
export function getStoredOwnDataConnection(orgSlug: string): string | null {
  try {
    return localStorage.getItem(`${CONNECTION_STORAGE_PREFIX}${orgSlug}`);
  } catch {
    return null;
  }
}

export function saveOwnDataConnection(orgSlug: string, connectionId: string): void {
  try {
    localStorage.setItem(`${CONNECTION_STORAGE_PREFIX}${orgSlug}`, connectionId);
  } catch {
    // no-op
  }
}

export function clearOwnDataConnection(orgSlug: string): void {
  try {
    localStorage.removeItem(`${CONNECTION_STORAGE_PREFIX}${orgSlug}`);
  } catch {
    // no-op
  }
}
