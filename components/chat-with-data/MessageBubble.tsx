'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BarChart3, ChevronDown, ChevronUp, LayoutDashboard, TriangleAlert } from 'lucide-react';
import { ToolProgress } from './ToolProgress';
import { ResultTable } from './ResultTable';
import { AssistantMarkdown } from './AssistantMarkdown';
import { SqlBlock } from './SqlBlock';
import { ThinkingIndicator } from './ThinkingIndicator';
import {
  type ApprovalRequest,
  type ChatMessage,
  type PiiColumn,
  type PiiMemory,
  piiColumnKey,
} from '@/types/chat-with-data';
import { approvalSummary, groupByTable, mergeColumns } from './utils';

const EMPTY_PII_MEMORY: PiiMemory = { decided: [], pii: [] };

const DECIDED_LABELS: Record<string, string> = {
  approved: 'Approved — running now',
  cancelled: 'Cancelled — nothing was run',
};

/**
 * The pause's columns as one row of checkboxes per table. The table name only
 * appears once the pause spans more than one — for the common single-table case
 * the headline already names it, and repeating it reads as clutter.
 */
function ColumnGroups({
  columns,
  ticked,
  onToggle,
}: {
  columns: PiiColumn[];
  ticked: string[];
  onToggle: (key: string) => void;
}) {
  const groups = groupByTable(columns);
  return (
    <>
      {groups.map((group) => (
        <div key={group.table} className="flex flex-col gap-1">
          {groups.length > 1 && <p className="font-mono text-xs text-[#A3A3B0]">{group.table}</p>}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {group.columns.map((column) => {
              const key = piiColumnKey(column);
              return (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 text-sm text-[#1A1A2E]"
                >
                  <input
                    type="checkbox"
                    aria-label={key}
                    checked={ticked.includes(key)}
                    onChange={() => onToggle(key)}
                  />
                  <span className="font-mono">{column.column}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * One pause, one card. The backend resumes every pending request with a single
 * decision, so rendering a card per request showed several Approve buttons that
 * all did the same thing. Columns are merged across the requests and deduped.
 *
 * The card leads with the data — which table, which columns — because that is
 * what the user is being asked to judge. The SQL is the mechanism, so it sits
 * collapsed underneath for anyone who wants to check it.
 */
function ApprovalCard({
  requests,
  status,
  onRespond,
  piiMemory,
}: {
  requests: ApprovalRequest[];
  status: string;
  onRespond?: (approve: boolean, piiColumns: string[], offeredColumns: string[]) => void;
  piiMemory: PiiMemory;
}) {
  const { columns, reviewable } = mergeColumns(requests);
  const allColumns = columns || [];
  const offered = allColumns.map(piiColumnKey);

  const [queryOpen, setQueryOpen] = useState(true);
  // columns marked personal earlier in the chat come back already ticked
  const [ticked, setTicked] = useState<string[]>(() =>
    offered.filter((key) => piiMemory.pii.includes(key))
  );

  const unavailable = reviewable && columns === null;
  const literalTicked = allColumns.some(
    (column) => column.has_literal && ticked.includes(piiColumnKey(column))
  );

  const sqlRequests = requests.filter((request) => request.sql);
  const QueryChevron = queryOpen ? ChevronUp : ChevronDown;

  const toggle = (key: string) =>
    setTicked((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]
    );

  const approveLabel = ticked.length === 0 ? 'Approve' : `Approve & hash ${ticked.length}`;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] leading-[22px] text-[#1A1A2E]">{approvalSummary(requests)}</p>
      {sqlRequests.length > 0 && (
        <>
          <button
            type="button"
            data-testid="chat-approval-query-toggle"
            onClick={() => setQueryOpen((open) => !open)}
            className="flex items-center gap-1 self-start text-sm text-primary"
          >
            <QueryChevron className="size-4" />
            {sqlRequests.length === 1 ? 'View query' : `View ${sqlRequests.length} queries`}
          </button>
          {queryOpen &&
            sqlRequests.map((request, index) => (
              // requests are fixed for the life of the card; index is stable
              // eslint-disable-next-line react/no-array-index-key
              <SqlBlock key={`query-${index}`} sql={request.sql as string} />
            ))}
        </>
      )}
      {reviewable && !unavailable && (
        <div className="flex flex-col gap-2" data-testid="chat-pii-columns">
          {allColumns.length === 0 ? (
            <p className="text-sm text-[#7A7A8C]">
              This query returns no column values, so there is nothing to mask.
            </p>
          ) : (
            <>
              <p className="text-sm text-[#7A7A8C]">Tick any column that holds personal data.</p>
              <ColumnGroups columns={allColumns} ticked={ticked} onToggle={toggle} />
            </>
          )}
        </div>
      )}
      {unavailable && (
        <p
          className="flex items-start gap-2 text-sm text-[#B45309]"
          data-testid="chat-pii-unavailable"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          Column list unavailable — this query cannot be reviewed for personal data. Cancel and try
          asking again.
        </p>
      )}
      {literalTicked && (
        <p
          className="flex items-start gap-2 text-sm text-[#B45309]"
          data-testid="chat-pii-literal-warning"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          This query contains a value for a column you marked as personal data. That value came from
          your message and stays in this conversation.
        </p>
      )}
      {status === 'pending' && (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            data-testid="chat-approve"
            disabled={unavailable}
            onClick={() => onRespond?.(true, ticked, offered)}
            className="rounded-md bg-primary px-[19px] py-2 text-[13px] font-medium uppercase tracking-wide text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {approveLabel}
          </button>
          <button
            type="button"
            data-testid="chat-cancel"
            onClick={() => onRespond?.(false, [], [])}
            className="rounded-md border border-[#CBD5E1] bg-white px-6 py-2 text-[13px] font-medium uppercase tracking-wide text-[#1A1A2E] hover:bg-[#F8FAFB]"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * One conversation turn. User messages render as the compact grey bubble on
 * the right; assistant answers render as an open column of text, reasoning,
 * tables, and cards — per the Dalgo 2.0 Copilot design.
 */
export function MessageBubble({
  message,
  onApprovalRespond,
  piiMemory = EMPTY_PII_MEMORY,
}: {
  message: ChatMessage;
  onApprovalRespond?: (approve: boolean, piiColumns: string[], offeredColumns: string[]) => void;
  piiMemory?: PiiMemory;
}) {
  const isUser = message.role === 'user';
  const showThinking = message.streaming && !message.content && !message.error;
  const inputRequest = message.inputRequest;

  if (isUser) {
    return (
      <div className="flex w-full justify-end" data-testid={`chat-message-${message.id}`}>
        <div className="max-w-[75%] rounded-xl rounded-br-[4px] bg-[#E8ECEF] px-3.5 py-2.5">
          <p className="whitespace-pre-wrap text-[15px] leading-[22px] text-[#1A1A2E]">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3" data-testid={`chat-message-${message.id}`}>
      <ToolProgress tools={message.tools} streaming={message.streaming} />

      {showThinking && message.tools.length === 0 && (
        <ThinkingIndicator data-testid="chat-thinking" />
      )}

      {message.content && <AssistantMarkdown content={message.content} />}

      {inputRequest?.kind === 'approval' && (
        <div data-testid="chat-approval-card" className="flex flex-col gap-3">
          <ApprovalCard
            requests={inputRequest.requests}
            status={inputRequest.status}
            onRespond={onApprovalRespond}
            piiMemory={piiMemory}
          />

          {inputRequest.status !== 'pending' && (
            <p className="text-xs text-[#7A7A8C]" data-testid="chat-approval-state">
              {DECIDED_LABELS[inputRequest.status] ?? inputRequest.status}
            </p>
          )}
        </div>
      )}

      {inputRequest?.kind === 'question' && inputRequest.status === 'pending' && (
        <p className="text-xs text-[#7A7A8C]" data-testid="chat-question-hint">
          Waiting for your reply — type your answer below.
        </p>
      )}

      {message.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {message.error}
        </p>
      )}

      {message.resultTable && <ResultTable table={message.resultTable} />}

      {message.validation?.verdict === 'warn' && message.validation.caveat && (
        <p
          data-testid="chat-validation-caveat"
          className="flex items-start gap-2 rounded-[10px] bg-[#FFFAF0] px-3 py-2.5 text-[13px] leading-snug text-[#9F2D00]"
        >
          <TriangleAlert className="mt-0.5 size-[15px] shrink-0" />
          <span>
            <span className="font-semibold">Worth checking </span>
            {message.validation.caveat}
          </span>
        </p>
      )}

      {message.charts?.map((chart) => (
        <Link
          key={chart.url_path}
          href={chart.url_path}
          data-testid={`chat-chart-link-${chart.chart_id}`}
          className="flex h-11 items-center justify-between rounded-md border border-[#E8ECEF] bg-[#F8FAFB] px-4 text-sm hover:border-primary/40"
        >
          <span className="flex min-w-0 items-center gap-2 text-[#1A1A2E]">
            {chart.url_path.startsWith('/dashboards') ? (
              <LayoutDashboard className="size-4 shrink-0 text-[#5C5C6D]" />
            ) : (
              <BarChart3 className="size-4 shrink-0 text-[#5C5C6D]" />
            )}
            <span className="truncate">{chart.title}</span>
          </span>
          <span className="shrink-0 font-semibold text-primary">
            {chart.url_path.startsWith('/dashboards') ? 'Open in Dashboards' : 'Open in Charts'}
          </span>
        </Link>
      ))}
    </div>
  );
}
