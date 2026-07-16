/**
 * The dashboard editor's half of the embed-warning contract.
 * update_dashboard 409s when a save adds under-covering charts without
 * confirm fields. These helpers keep that plumbing testable outside the
 * builder: picker decisions accumulate into PendingCoverage and ride on the
 * next save; a rejected save's verdicts are parsed back for the recovery dialog.
 */
import { getApiErrorBody, getApiErrorStatus } from '@/lib/utils';
import type { ChartCoverageVerdict } from '@/hooks/api/useResourceAccess';
import type { CoverageDecision } from '@/components/sharing/coverage-confirm-utils';

export interface PendingCoverage {
  extendChartIds: number[];
  proceed: boolean;
}

export const EMPTY_PENDING_COVERAGE: PendingCoverage = { extendChartIds: [], proceed: false };

/** Fold one dialog decision into the accumulated pending confirmation
 * (several picks can confirm between two autosave ticks). */
export function mergeCoverageDecision(
  pending: PendingCoverage,
  decision: CoverageDecision
): PendingCoverage {
  return {
    extendChartIds: [...new Set([...pending.extendChartIds, ...decision.extendChartIds])],
    proceed: pending.proceed || decision.proceed,
  };
}

/** The save-payload fields for the pending confirmation — {} when there is
 * none, so every already-working save keeps its exact payload shape. */
export function coveragePayloadFields(pending: PendingCoverage): {
  extend_chart_ids?: number[];
  proceed?: boolean;
} {
  return {
    ...(pending.extendChartIds.length > 0 ? { extend_chart_ids: pending.extendChartIds } : {}),
    ...(pending.proceed ? { proceed: true } : {}),
  };
}

/** The under-covering verdicts from a save rejected with 409
 * `EmbedCoverageConfirmation`, or null for any other failure. */
export function parseEmbedCoverage409(error: unknown): ChartCoverageVerdict[] | null {
  if (getApiErrorStatus(error) !== 409) return null;
  const body = getApiErrorBody<{ under_covering_charts?: ChartCoverageVerdict[] }>(error);
  const verdicts = body?.under_covering_charts;
  return verdicts && verdicts.length > 0 ? verdicts : null;
}

/** Header/toast copy naming the rejected charts. */
export function coverage409Message(verdicts: ChartCoverageVerdict[]): string {
  const names = verdicts.map((v) => `"${v.title}"`).join(', ');
  return `Not saved yet — ${names} ${
    verdicts.length === 1 ? "isn't" : "aren't"
  } shared with everyone who can see this dashboard.`;
}

/** Stable identity for a cancelled prompt, so the autosave loop doesn't
 * reopen the same dialog every 5 seconds. */
export function coverageDismissKey(verdicts: ChartCoverageVerdict[]): string {
  return verdicts
    .map((v) => v.chart_id)
    .sort((a, b) => a - b)
    .join(',');
}
