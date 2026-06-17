/**
 * Shared RAG-band helpers.
 *
 * Backend equivalent: `ddpui.core.kpi.kpi_service.compute_rag_status`.
 *
 * Anything that needs to describe — or compute — the numeric boundary between
 * Green / Amber / Red bands of a KPI should use these helpers so the math
 * stays in one place. Currently consumed by:
 *   - AlertsTable: RAG-chip tooltip text on KPI alerts.
 * Future consumers (KPI drawer band labels, wizard preview, etc.) can import
 * `bandStatement` / `bandBoundaries` without duplicating the math.
 */

import type { RagState } from '@/types/alerts';

export interface RagThresholds {
  target_value: number | null;
  direction: 'increase' | 'decrease';
  /** Percentage of target that defines the Green band edge (e.g. 100). */
  green_threshold_pct: number;
  /** Percentage of target that defines the Amber band edge (e.g. 80). */
  amber_threshold_pct: number;
}

/** Strip trailing zeros: 80.0 → "80", 79.5 → "79.5". */
export function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
}

/** Numeric band edges in absolute units (not %). */
export function bandBoundaries(
  ctx: RagThresholds
): { greenEdge: number; amberEdge: number } | null {
  if (ctx.target_value == null) return null;
  return {
    greenEdge: (ctx.target_value * ctx.green_threshold_pct) / 100,
    amberEdge: (ctx.target_value * ctx.amber_threshold_pct) / 100,
  };
}

/**
 * Human-readable statement of when an alert in the given RAG `state` would fire,
 * using the KPI's target/direction/thresholds.
 *
 * For direction="increase" (higher is better):
 *   Green: current ≥ greenEdge   Amber: amberEdge ≤ current < greenEdge   Red: current < amberEdge
 * For direction="decrease" (lower is better):
 *   Green: current ≤ greenEdge   Amber: greenEdge < current ≤ amberEdge   Red: current > amberEdge
 */
export function bandStatement(state: RagState, ctx: RagThresholds): string {
  const edges = bandBoundaries(ctx);
  if (!edges) {
    return `Fires when KPI lands in ${state} band.`;
  }
  const g = formatNumber(edges.greenEdge);
  const a = formatNumber(edges.amberEdge);
  if (ctx.direction === 'increase') {
    if (state === 'green') return `Fires when current value is at or above ${g}.`;
    if (state === 'amber') return `Fires when current value is between ${a} and ${g}.`;
    return `Fires when current value falls below ${a}.`;
  }
  if (state === 'green') return `Fires when current value is at or below ${g}.`;
  if (state === 'amber') return `Fires when current value is between ${g} and ${a}.`;
  return `Fires when current value rises above ${a}.`;
}
