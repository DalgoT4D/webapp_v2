'use client';

import Link from 'next/link';
import { BarChart3, LayoutDashboard, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolProgress } from './ToolProgress';
import { ResultTable } from './ResultTable';
import type { ChatMessage } from '@/types/chat-with-data';

/**
 * One conversation bubble. Assistant text renders as plain text
 * (whitespace preserved) — the agent is prompted not to emit markdown.
 */
export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const showThinking = message.streaming && !message.content && !message.error;

  return (
    <div
      className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
      data-testid={`chat-message-${message.id}`}
    >
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

        {message.content && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
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
