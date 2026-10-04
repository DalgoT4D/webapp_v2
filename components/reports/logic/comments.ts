import type { CommentIconState, CommentStates, MentionableUser } from '@/types/comments';

/** Comment icon state for the report summary. */
export function findSummaryCommentState(states: CommentStates | undefined): CommentIconState {
  return states?.find((s) => s.target_type === 'summary')?.state ?? 'none';
}

/** Comment icon state for a KPI widget. (Doesn't check target_type — a chart with the same id would match.) */
export function findKpiCommentState(
  states: CommentStates | undefined,
  kpiId: number
): CommentIconState {
  return (states?.find((s) => s.target_id === kpiId)?.state as CommentIconState) ?? 'none';
}

/** Shape the chart lookup expects; real entries carry `target_id`, not `chart_id`. */
type ChartIdStateEntry = { chart_id?: number; state: CommentIconState };

/**
 * Comment icon state for a chart widget.
 * PINNED-BUGS (Reports): "Chart comment icon never shows state — looks up chart_id, state has target_id".
 */
export function findChartCommentState(
  states: CommentStates | undefined,
  chartId: number
): CommentIconState {
  const entries = states as unknown as ChartIdStateEntry[] | undefined;
  return (entries?.find((s) => s.chart_id === chartId)?.state as CommentIconState) ?? 'none';
}

/** Users shown in the @mention dropdown: case-insensitive email match, at most `limit`. */
export function filterMentionableUsers(
  users: MentionableUser[],
  query: string,
  limit: number
): MentionableUser[] {
  if (!query) return users.slice(0, limit);
  const lowerQuery = query.toLowerCase();
  return users.filter((u) => u.email.toLowerCase().includes(lowerQuery)).slice(0, limit);
}
