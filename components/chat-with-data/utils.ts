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
    default:
      return request.description || `Run ${request.tool}?`;
  }
}

/** `schema.table` — how the checkbox list groups columns */
export function tableKey(column: PiiColumn): string {
  return `${column.schema}.${column.table}`;
}

/**
 * The headline for a pause. The backend resumes every pending request with one
 * decision, so the card is one block — a single call keeps its own wording, and
 * several collapse into a count rather than repeating near-identical lines.
 */
export function approvalSummary(requests: ApprovalRequest[]): string {
  if (requests.length === 0) return 'Approve this step?';
  if (requests.length === 1) return requestSummary(requests[0]);

  const tools = new Set(requests.map((request) => request.tool));
  if (tools.size === 1 && requests[0].tool === 'profile_column') {
    const tables = new Set(
      requests.map((request) => `${request.args?.schema_name}.${request.args?.table_name}`)
    );
    const where = tables.size === 1 ? ` in ${[...tables][0]}` : '';
    return `Profile ${requests.length} columns${where}?`;
  }
  if (tools.size === 1 && requests[0].tool === 'execute_sql') {
    return `Run ${requests.length} queries on your data warehouse?`;
  }
  return `Approve ${requests.length} steps?`;
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
