/** Which comment thread a link from a notification email asks the viewer to open. */
export interface CommentDeepLink {
  autoOpenSummary: boolean;
  /** Chart id as it appears in the URL (string), passed through to the dashboard canvas. */
  autoOpenChartId: string | undefined;
}

/**
 * Reads `?commentTarget=summary` or `?commentTarget=chart&chartId=<id>`.
 * PINNED-BUGS: "KPI comment deep links from emails don't open — viewer ignores `commentTarget=kpi`"
 */
export function parseCommentDeepLink(params: Pick<URLSearchParams, 'get'>): CommentDeepLink {
  const commentTarget = params.get('commentTarget');
  const commentChartId = params.get('chartId');
  return {
    autoOpenSummary: commentTarget === 'summary',
    autoOpenChartId: commentTarget === 'chart' && commentChartId ? commentChartId : undefined,
  };
}
