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
  | 'kpi_time_column'
  | 'kpi_type'
  | 'dashboard_intro'
  | 'builder_add_kpi'
  | 'builder_add_chart'
  | 'builder_save'
  | 'builder_preview'
  | 'share';

export const WALKTHROUGH_STAGE_ORDER: WalkthroughStage[] = [
  'fork2',
  'kpi_intro',
  'kpi_metric',
  'kpi_target',
  'kpi_direction',
  'kpi_time_column',
  'kpi_type',
  'dashboard_intro',
  'builder_add_kpi',
  'builder_add_chart',
  'builder_save',
  'builder_preview',
  'share',
];

const STAGE_STORAGE_PREFIX = 'dalgo_insight_walkthrough_stage_';
const DONE_STORAGE_PREFIX = 'dalgo_insight_walkthrough_done_';

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
