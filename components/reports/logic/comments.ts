import type {
  Comment,
  CommentIconState,
  CommentStates,
  MarkReadPayload,
  MentionableUser,
} from '@/types/comments';

export type CommentTargetType = Comment['target_type'];

// Threshold (ms) between created_at and updated_at to consider a comment "edited".
// Small buffer accounts for backend processing time on initial create.
export const EDITED_THRESHOLD_MS = 1000;

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
 * Comment icon state for a chart widget — reads a `chart_id` field the states API never sends.
 * PINNED-BUGS: "Chart comment icon never shows state — looks up `chart_id`, state has `target_id` (KPI works)"
 */
export function findChartCommentStateBuggyChartIdLookup(
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

/** "· edited" label: updated_at differs from created_at by more than the threshold. */
export function isCommentEdited(comment: Pick<Comment, 'created_at' | 'updated_at'>): boolean {
  return (
    Math.abs(new Date(comment.updated_at).getTime() - new Date(comment.created_at).getTime()) >
    EDITED_THRESHOLD_MS
  );
}

/**
 * Hide deleted comment placeholders when there are no non-deleted comments in the thread.
 * Per Figma spec: "Instant comment deletion when it is the only comment" — no placeholder shown.
 */
export function getVisibleComments(comments: Comment[]): Comment[] {
  const hasNonDeletedComments = comments.some((c) => !c.is_deleted);
  if (!hasNonDeletedComments) {
    return comments.filter((c) => !c.is_deleted);
  }
  return comments;
}

/** The first unseen comment (scroll target), or null. */
export function findFirstNewCommentId(comments: Comment[]): number | null {
  for (const c of comments) {
    if (c.is_new) return c.id;
  }
  return null;
}

/** Comments in the thread that are not deleted — the analytics "thread size" before posting. */
export function countLiveComments(comments: Comment[]): number {
  return comments.filter((c) => !c.is_deleted).length;
}

/** Mark-read body sent when a thread is opened by a click. */
export function buildMarkReadOnOpenPayload(
  targetType: CommentTargetType,
  chartId: number | undefined
): MarkReadPayload {
  return { target_type: targetType, target_id: chartId };
}

/**
 * Mark-read body sent right after posting a comment — uses `chart_id`, which the API ignores.
 * PINNED-BUGS: "Own KPI comment stays unread — post-submit mark-read sends `chart_id`"
 */
export function buildMarkReadAfterPostPayload(
  targetType: CommentTargetType,
  chartId: number | undefined
): MarkReadPayload {
  return { target_type: targetType, chart_id: chartId } as unknown as MarkReadPayload;
}
