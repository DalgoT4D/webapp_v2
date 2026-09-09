'use client';

import Link from 'next/link';
import {
  BarChart3,
  LayoutDashboard,
  AlertTriangle,
  Sparkles,
  ShieldQuestion,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ToolProgress } from './ToolProgress';
import { ResultTable } from './ResultTable';
import { AssistantMarkdown } from './AssistantMarkdown';
import type { ApprovalRequest, ChatMessage } from '@/types/chat-with-data';

/** Plain-language receipt for a tool call awaiting approval */
function approvalSummary(request: ApprovalRequest): string {
  const args = request.args || {};
  const chartCount = Array.isArray(args.chart_ids) ? args.chart_ids.length : 0;
  switch (request.tool) {
    case 'execute_sql':
      return 'Run this query on your data warehouse?';
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

const DECIDED_LABELS: Record<string, string> = {
  approved: 'Approved — running now',
  cancelled: 'Cancelled — nothing was run',
};

/**
 * One conversation bubble. Assistant answers render through the markdown
 * SUBSET the agent is prompted to emit (AssistantMarkdown); user messages
 * stay literal text.
 */
export function MessageBubble({
  message,
  onApprovalRespond,
}: {
  message: ChatMessage;
  onApprovalRespond?: (approve: boolean) => void;
}) {
  const isUser = message.role === 'user';
  const showThinking = message.streaming && !message.content && !message.error;
  const inputRequest = message.inputRequest;

  return (
    <div
      className={cn('flex w-full gap-2', isUser ? 'justify-end' : 'justify-start')}
      data-testid={`chat-message-${message.id}`}
    >
      {!isUser && (
        <div
          className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10"
          aria-hidden="true"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      <div className={cn('max-w-[85%]', isUser && 'rounded-2xl bg-primary/10 px-4 py-2')}>
        {!isUser && <ToolProgress tools={message.tools} />}

        {showThinking && (
          <p
            className="mt-1 animate-pulse text-sm text-muted-foreground"
            data-testid="chat-thinking"
          >
            Thinking…
          </p>
        )}

        {message.content &&
          (isUser ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
          ) : (
            <AssistantMarkdown content={message.content} />
          ))}

        {!isUser && inputRequest?.kind === 'approval' && (
          <div
            data-testid="chat-approval-card"
            className="mt-2 rounded-md border bg-muted/30 px-3 py-2"
          >
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <ShieldQuestion className="h-4 w-4 text-primary" />
              Needs your go-ahead
            </p>
            {inputRequest.requests.map((request, index) => (
              <div key={index} className="mt-2">
                <p className="text-sm">{approvalSummary(request)}</p>
                {request.sql && (
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted px-2 py-1 font-mono text-xs">
                    {request.sql}
                  </pre>
                )}
              </div>
            ))}
            {inputRequest.status === 'pending' ? (
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  data-testid="chat-approve"
                  onClick={() => onApprovalRespond?.(true)}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="chat-cancel"
                  onClick={() => onApprovalRespond?.(false)}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground" data-testid="chat-approval-state">
                {DECIDED_LABELS[inputRequest.status] ?? inputRequest.status}
              </p>
            )}
          </div>
        )}

        {!isUser && inputRequest?.kind === 'question' && inputRequest.status === 'pending' && (
          <p className="mt-2 text-xs text-muted-foreground" data-testid="chat-question-hint">
            Waiting for your reply — type your answer below.
          </p>
        )}

        {!isUser && message.validation?.verdict === 'warn' && message.validation.caveat && (
          <p
            data-testid="chat-validation-caveat"
            className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Worth checking: {message.validation.caveat}</span>
          </p>
        )}

        {message.error && (
          <p className="mt-1 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {message.error}
          </p>
        )}

        {!isUser && message.resultTable && <ResultTable table={message.resultTable} />}

        {!isUser &&
          message.charts?.map((chart) => (
            <Link
              key={chart.url_path}
              href={chart.url_path}
              data-testid={`chat-chart-link-${chart.chart_id}`}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-primary hover:bg-accent"
            >
              {chart.url_path.startsWith('/dashboards') ? (
                <LayoutDashboard className="h-4 w-4" />
              ) : (
                <BarChart3 className="h-4 w-4" />
              )}
              {chart.title}
            </Link>
          ))}
      </div>
    </div>
  );
}
