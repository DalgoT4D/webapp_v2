'use client';

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

        {message.error && (
          <p className="mt-1 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {message.error}
          </p>
        )}

        {!isUser && message.resultTable && <ResultTable table={message.resultTable} />}
      </div>
    </div>
  );
}
