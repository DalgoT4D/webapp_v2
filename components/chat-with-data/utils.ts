import { type ApprovalRequest, type PiiColumn, piiColumnKey } from '@/types/chat-with-data';

/** Plain-language receipt for one tool call awaiting approval */
export function requestSummary(request: ApprovalRequest): string {
  const args = request.args || {};
  const chartCount = Array.isArray(args.chart_ids) ? args.chart_ids.length : 0;
  switch (request.tool) {
    case 'execute_sql':
      return 'Run this query on your data warehouse?';
    case 'profile_column':
      return `Profile ${args.schema_name}.${args.table_name}.${args.column_name}?`;
    case 'create_chart':
      return `Create the chart “${args.title}” (${args.chart_type}) from ${args.schema_name}.${args.table_name}?`;
    case 'create_dashboard':
      return `Create the dashboard “${args.title}” with ${chartCount} chart${chartCount === 1 ? '' : 's'}?`;
    case 'add_charts_to_dashboard':
      return `Add ${chartCount} chart${chartCount === 1 ? '' : 's'} to your dashboard?`;
    case 'create_metric':
      return `Create the metric “${args.name}” from ${args.schema_name}.${args.table_name}?`;
    case 'create_kpi':
      return args.name ? `Create the KPI “${args.name}”?` : 'Create a KPI from this metric?';
    case 'create_report':
      return `Create the report “${args.title}” from your dashboard?`;
    default:
      return request.description || `Run ${request.tool}?`;
  }
}

/** `schema.table` — how the checkbox list groups columns */
export function tableKey(column: PiiColumn): string {
  return `${column.schema}.${column.table}`;
}

/** Tools whose several calls collapse into one counted headline */
const GROUPABLE_TOOLS = new Set(['profile_column', 'execute_sql']);

/** Several calls that share no wording — the headline can only count them */
function isMixedPause(requests: ApprovalRequest[]): boolean {
  if (requests.length < 2) return false;
  const tools = new Set(requests.map((request) => request.tool));
  return tools.size > 1 || !GROUPABLE_TOOLS.has(requests[0].tool);
}

/**
 * The headline for a pause. The backend resumes every pending request with one
 * decision, so the card is one block — a single call keeps its own wording, and
 * several collapse into a count rather than repeating near-identical lines.
 */
export function approvalSummary(requests: ApprovalRequest[]): string {
  if (requests.length === 0) return 'Approve this step?';
  if (requests.length === 1) return requestSummary(requests[0]);
  if (isMixedPause(requests)) return `Approve ${requests.length} steps?`;

  if (requests[0].tool === 'profile_column') {
    const tables = new Set(
      requests.map((request) => `${request.args?.schema_name}.${request.args?.table_name}`)
    );
    const where = tables.size === 1 ? ` in ${[...tables][0]}` : '';
    return `Profile ${requests.length} columns${where}?`;
  }
  return `Run ${requests.length} queries on your data warehouse?`;
}

/**
 * One line per call when the headline is only a count ("Approve 2 steps?"), so
 * the user can see what each step does. Empty when the headline says it all.
 */
export function approvalSteps(requests: ApprovalRequest[]): string[] {
  // Each line is a statement under the question headline, so drop its own "?"
  return isMixedPause(requests)
    ? requests.map((request) => requestSummary(request).replace(/\?$/, ''))
    : [];
}

/**
 * Every column the pause would read, deduped across its requests.
 *
 * Fail-closed: a single request the backend could not resolve (`columns: null`)
 * makes the whole card unreviewable, because one decision approves them all.
 * `undefined` means the tool returns no values at all (create_chart), so it
 * contributes nothing rather than blocking.
 */
export function mergeColumns(requests: ApprovalRequest[]): {
  columns: PiiColumn[] | null;
  reviewable: boolean;
} {
  const reviewable = requests.some((request) => request.columns !== undefined);
  if (requests.some((request) => request.columns === null)) {
    return { columns: null, reviewable: true };
  }

  const byKey = new Map<string, PiiColumn>();
  for (const request of requests) {
    for (const column of request.columns || []) {
      const key = piiColumnKey(column);
      const seen = byKey.get(key);
      // has_literal is a property of the query text, so any request that
      // compares this column against a literal taints the merged entry
      if (!seen) byKey.set(key, column);
      else if (column.has_literal && !seen.has_literal) byKey.set(key, column);
    }
  }
  return { columns: [...byKey.values()], reviewable };
}

/** Columns grouped under their `schema.table`, both in first-seen order */
export function groupByTable(columns: PiiColumn[]): { table: string; columns: PiiColumn[] }[] {
  const groups = new Map<string, PiiColumn[]>();
  for (const column of columns) {
    const key = tableKey(column);
    const group = groups.get(key);
    if (group) group.push(column);
    else groups.set(key, [column]);
  }
  return [...groups.entries()].map(([table, entries]) => ({ table, columns: entries }));
}
