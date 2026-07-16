/**
 * Shared logic for the dashboard-broadening confirm and the embed-time
 * warning — both consume the same ChartCoverageVerdict[] payload. Everything
 * is capability-driven off the verdicts (no rtype conditionals), so the
 * dialogs stay reusable for any future container rtype.
 */
import type { ChartCoverageVerdict, PrincipalGap } from '@/hooks/api/useResourceAccess';

export interface CoverageDecision {
  /** Charts YES will extend (subset of the warned charts — the backend
   * validates this). Empty when nothing is extendable by this viewer. */
  extendChartIds: number[];
  /** Always true on YES: commits while acknowledging any exposure extend
   * can't close (either confirm field present commits). */
  proceed: boolean;
}

export interface CoverageSummary {
  chartTitles: string[];
  chartCount: number;
  /** Extendable charts the CALLING viewer resolves to Edit on — the ids a
   * YES may send as `extend_chart_ids`. */
  extendChartIds: number[];
  /** Titles of extendable charts the viewer CANNOT edit — extend needs Edit
   * on the chart, so these drive the request-Edit/ask-owner prompt. */
  editBlockedTitles: string[];
  /** True when at least one chart keeps exposure extend can't close — the
   * copy must say those charts stay visible inline regardless. */
  hasResidualExposure: boolean;
  /** Who gains visibility — e.g. "Funders group", "Members and anyone with
   * the link". */
  audienceLabel: string;
}

function principalLabel(gap: PrincipalGap): string {
  if (gap.principal_type === 'group') return `${gap.name ?? 'A'} group`;
  if (gap.principal_type === 'invite') return 'the invited user';
  return gap.name || gap.email || 'a person with access';
}

function joinNaturally(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** "Analysts, Meera Das and anyone with the link" — the union of every gap
 * class across the verdicts, deduplicated, in a stable order (roles, then
 * principals, then public exposure). */
export function formatAudienceLabel(verdicts: ChartCoverageVerdict[]): string {
  const roles: string[] = [];
  const principals: string[] = [];
  let publicExposure = false;

  for (const v of verdicts) {
    if (v.role_gaps.includes('analyst') && !roles.includes('Analysts')) roles.push('Analysts');
    if (v.role_gaps.includes('member') && !roles.includes('Members')) roles.push('Members');
    for (const gap of v.principal_gaps) {
      const label = principalLabel(gap);
      if (!principals.includes(label)) principals.push(label);
    }
    if (v.public_exposure) publicExposure = true;
  }

  const parts = [...roles, ...principals, ...(publicExposure ? ['anyone with the link'] : [])];
  return parts.length > 0 ? joinNaturally(parts) : 'some viewers';
}

/** True when extend (by THIS viewer) would close every gap on the chart —
 * i.e. no informational exposure class and no Edit blocker remains. */
function fullyExtendable(v: ChartCoverageVerdict): boolean {
  return (
    v.extendable &&
    v.viewer_can_edit &&
    !v.public_exposure &&
    !v.role_gaps.includes('member') &&
    !v.principal_gaps.some((gap) => gap.skipped_member)
  );
}

/** One aggregated verdict list from several sources, deduped by chart with
 * gap classes OR-merged — extendable in one source stays extendable in the
 * union. Display + extend-id aggregation only; per-source subsets stay with
 * their source. */
export function unionCoverageVerdicts(lists: ChartCoverageVerdict[][]): ChartCoverageVerdict[] {
  const byChartId = new Map<number, ChartCoverageVerdict>();
  for (const list of lists) {
    for (const v of list) {
      const prev = byChartId.get(v.chart_id);
      byChartId.set(
        v.chart_id,
        prev
          ? {
              ...prev,
              covered: prev.covered && v.covered,
              role_gaps: [...new Set([...prev.role_gaps, ...v.role_gaps])],
              principal_gaps: [...prev.principal_gaps, ...v.principal_gaps],
              public_exposure: prev.public_exposure || v.public_exposure,
              extendable: prev.extendable || v.extendable,
              viewer_can_edit: prev.viewer_can_edit || v.viewer_can_edit,
            }
          : v
      );
    }
  }
  return [...byChartId.values()];
}

export function summarizeCoverage(verdicts: ChartCoverageVerdict[]): CoverageSummary {
  const extendChartIds = verdicts
    .filter((v) => v.extendable && v.viewer_can_edit)
    .map((v) => v.chart_id);
  return {
    chartTitles: verdicts.map((v) => v.title),
    chartCount: verdicts.length,
    extendChartIds,
    editBlockedTitles: verdicts
      .filter((v) => v.extendable && !v.viewer_can_edit)
      .map((v) => v.title),
    hasResidualExposure: verdicts.some((v) => !fullyExtendable(v)),
    audienceLabel: formatAudienceLabel(verdicts),
  };
}
