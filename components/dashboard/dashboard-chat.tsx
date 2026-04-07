'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Send, Square, ThumbsDown, ThumbsUp } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { useDashboardChat, type DashboardChatMessage } from '@/hooks/api/useDashboardChat';
import { useDashboardChatBootstrap } from '@/hooks/api/useDashboardAIChat';

interface DashboardChatProps {
  dashboardId: number;
  dashboardTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled: boolean;
}

const MAX_VISIBLE_TABLE_ROWS = 10;

function humanizeColumnName(columnName: string) {
  return columnName
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function parseNumericLike(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  if (!/^-?\d+(?:\.\d+)?(?:E-?\d+)?$/i.test(normalizedValue)) {
    return null;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function looksLikeRateColumn(columnName: string) {
  const normalizedColumn = columnName.toLowerCase();
  return ['rate', 'ratio', 'percentage', 'percent', 'share', 'pct'].some((token) =>
    normalizedColumn.includes(token)
  );
}

function formatNumericValue(columnName: string, value: number) {
  if (looksLikeRateColumn(columnName) && value >= 0 && value <= 1) {
    const percentageValue = (value * 100).toFixed(1).replace(/\.0$/, '');
    return `${percentageValue}%`;
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTableCellValue(columnName: string, value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  if (typeof value === 'boolean') {
    return value ? 'True' : 'False';
  }

  const numericValue = parseNumericLike(value);
  if (numericValue !== null) {
    return formatNumericValue(columnName, numericValue);
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function getResponseFormat(message: DashboardChatMessage) {
  const responseFormat = message.payload?.metadata?.response_format;
  return typeof responseFormat === 'string' ? responseFormat : null;
}

function getTableColumns(message: DashboardChatMessage, rows: Array<Record<string, unknown>>) {
  const metadataColumns = message.payload?.metadata?.table_columns;
  if (
    Array.isArray(metadataColumns) &&
    metadataColumns.every((value) => typeof value === 'string')
  ) {
    return metadataColumns as string[];
  }

  const firstRow = rows[0];
  return firstRow ? Object.keys(firstRow) : [];
}

function AssistantResultsTable({ message }: { message: DashboardChatMessage }) {
  const rows = Array.isArray(message.payload?.sql_results) ? message.payload.sql_results : [];
  const responseFormat = getResponseFormat(message);
  if (
    rows.length === 0 ||
    !responseFormat ||
    !['table', 'text_with_table'].includes(responseFormat)
  ) {
    return null;
  }

  const columns = getTableColumns(message, rows);
  if (columns.length === 0) {
    return null;
  }

  const visibleRows = rows.slice(0, MAX_VISIBLE_TABLE_ROWS);

  return (
    <div className="mt-4 space-y-2">
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 font-medium text-slate-700" scope="col">
                  {humanizeColumnName(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {visibleRows.map((row) => {
              const rowKey = `${message.id}-${JSON.stringify(row)}`;
              return (
                <tr key={rowKey}>
                  {columns.map((column) => (
                    <td key={`${rowKey}-${column}`} className="px-3 py-2 align-top text-slate-700">
                      {formatTableCellValue(column, row[column])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > MAX_VISIBLE_TABLE_ROWS ? (
        <p className="text-xs text-slate-500">
          Showing the first {MAX_VISIBLE_TABLE_ROWS} of {rows.length} rows.
        </p>
      ) : null}
    </div>
  );
}

function AssistantMeta({ message }: { message: DashboardChatMessage }) {
  const citations = message.payload?.citations || [];
  const warnings = message.payload?.warnings || [];
  const citationEntries = citations.reduce<
    Array<{ citation: (typeof citations)[number]; key: string }>
  >((entries, citation) => {
    const duplicateCount =
      entries.filter(
        (entry) =>
          entry.citation.source_type === citation.source_type &&
          entry.citation.source_identifier === citation.source_identifier
      ).length + 1;
    entries.push({
      citation,
      key: `${citation.source_type}-${citation.source_identifier}-${duplicateCount}`,
    });
    return entries;
  }, []);
  const warningEntries = warnings.reduce<Array<{ warning: string; key: string }>>(
    (entries, warning) => {
      const duplicateCount = entries.filter((entry) => entry.warning === warning).length + 1;
      entries.push({ warning, key: `${warning}-${duplicateCount}` });
      return entries;
    },
    []
  );

  if (citations.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3">
      {warnings.length > 0 ? (
        <div className="space-y-2">
          {warningEntries.map(({ warning, key }) => (
            <div
              key={key}
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            >
              {warning}
            </div>
          ))}
        </div>
      ) : null}

      {citations.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sources</p>
          <div className="space-y-2">
            {citationEntries.map(({ citation, key }) => (
              <div key={key} className="rounded-md border bg-slate-50 px-3 py-2">
                {citation.url ? (
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    {citation.title}
                  </a>
                ) : (
                  <p className="text-xs font-medium text-slate-900">{citation.title}</p>
                )}
                <p className="mt-1 text-xs text-slate-600">{citation.snippet}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssistantSqlDetails({ message }: { message: DashboardChatMessage }) {
  const sql = typeof message.payload?.sql === 'string' ? message.payload.sql.trim() : '';
  if (!sql) {
    return null;
  }

  return (
    <div className="mt-4">
      <Accordion type="single" collapsible className="rounded-md border bg-slate-50 px-3">
        <AccordionItem value={`sql-${message.id}`} className="border-b-0">
          <AccordionTrigger className="py-3 text-xs uppercase tracking-wide text-slate-600 hover:no-underline">
            View SQL
          </AccordionTrigger>
          <AccordionContent>
            <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs leading-5 text-slate-100">
              <code>{sql}</code>
            </pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function AssistantFeedback({
  message,
  isSubmitting,
  onSubmitFeedback,
}: {
  message: DashboardChatMessage;
  isSubmitting: boolean;
  onSubmitFeedback: (messageId: string, feedback: 'thumbs_up' | 'thumbs_down') => void;
}) {
  if (message.role !== 'assistant') {
    return null;
  }

  const selectedFeedback = message.feedback || null;
  const isLocked = Boolean(selectedFeedback);

  const getFeedbackButtonClassName = (feedback: 'thumbs_up' | 'thumbs_down', selected: boolean) => {
    if (selected) {
      return 'cursor-default border-teal-600 bg-teal-600 text-white hover:bg-teal-600 hover:text-white';
    }
    if (isLocked) {
      return 'cursor-default border-slate-200 bg-white text-slate-300 hover:bg-white hover:text-slate-300';
    }
    return 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700';
  };

  return (
    <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
      <span>{selectedFeedback ? 'Feedback saved' : 'Was this helpful?'}</span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Mark answer helpful"
          aria-pressed={selectedFeedback === 'thumbs_up'}
          disabled={isSubmitting}
          onClick={() => {
            if (!isLocked) {
              onSubmitFeedback(message.id, 'thumbs_up');
            }
          }}
          className={`h-7 w-7 rounded-full border p-0 ${getFeedbackButtonClassName(
            'thumbs_up',
            selectedFeedback === 'thumbs_up'
          )}`}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Mark answer not helpful"
          aria-pressed={selectedFeedback === 'thumbs_down'}
          disabled={isSubmitting}
          onClick={() => {
            if (!isLocked) {
              onSubmitFeedback(message.id, 'thumbs_down');
            }
          }}
          className={`h-7 w-7 rounded-full border p-0 ${getFeedbackButtonClassName(
            'thumbs_down',
            selectedFeedback === 'thumbs_down'
          )}`}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function DashboardChat({
  dashboardId,
  dashboardTitle,
  open,
  onOpenChange,
  enabled,
}: DashboardChatProps) {
  const {
    messages,
    isConnected,
    isThinking,
    isCancelling,
    progressLabel,
    error,
    sendMessage,
    cancelMessage,
    submitFeedback,
    feedbackSubmittingById,
  } = useDashboardChat({
    dashboardId,
    enabled,
  });
  const [draftMessage, setDraftMessage] = useState('');
  const [sessionSuggestedPrompts, setSessionSuggestedPrompts] = useState<string[]>([]);

  const hasMessages = messages.length > 0;
  const { bootstrap, isLoading: isLoadingBootstrap } = useDashboardChatBootstrap(
    open && enabled && !hasMessages ? dashboardId : null,
    open && enabled && !hasMessages
  );
  const canSend = useMemo(
    () => draftMessage.trim().length > 0 && !isThinking,
    [draftMessage, isThinking]
  );
  const openingMessage = "Hi, I'm Dalgo AI. I can help you understand the data on this dashboard.";

  useEffect(() => {
    if (!open || hasMessages) {
      return;
    }
    if (sessionSuggestedPrompts.length > 0) {
      return;
    }
    if (!bootstrap?.suggested_prompts?.length) {
      return;
    }
    setSessionSuggestedPrompts(bootstrap.suggested_prompts);
  }, [bootstrap, hasMessages, open, sessionSuggestedPrompts.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const inputElement = document.getElementById('dashboard-chat-input');
      if (!(inputElement instanceof HTMLInputElement)) {
        return;
      }
      inputElement.focus();
      const caretPosition = inputElement.value.length;
      inputElement.setSelectionRange(caretPosition, caretPosition);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [open]);

  const handleSend = () => {
    if (!canSend) {
      return;
    }

    const didSend = sendMessage(draftMessage);
    if (didSend) {
      setDraftMessage('');
    }
  };

  const handleSuggestedPromptClick = (prompt: string) => {
    const didSend = sendMessage(prompt);
    if (didSend) {
      setSessionSuggestedPrompts([]);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        overlayClassName="bg-transparent shadow-[inset_0_0_120px_rgba(15,23,42,0.08)]"
        className="flex h-full w-full flex-col p-0 shadow-2xl shadow-slate-900/12 sm:max-w-xl"
      >
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Dalgo AI</SheetTitle>
          <SheetDescription>{dashboardTitle}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <div className="space-y-4 py-4">
            {!hasMessages ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                <p className="text-sm leading-6 text-slate-700">{openingMessage}</p>
                {sessionSuggestedPrompts.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {sessionSuggestedPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handleSuggestedPromptClick(prompt)}
                        disabled={isThinking}
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-xs transition hover:border-blue-200 hover:bg-blue-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                ) : null}
                {isLoadingBootstrap && sessionSuggestedPrompts.length === 0 ? (
                  <p className="mt-4 text-xs text-slate-500">Loading suggested questions…</p>
                ) : null}
              </div>
            ) : null}

            {messages.map((message) => (
              <div
                key={message.id}
                className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={
                    message.role === 'user'
                      ? 'max-w-[85%] rounded-2xl bg-teal-600 px-4 py-3 text-sm text-white'
                      : 'max-w-[90%] rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm'
                  }
                >
                  {message.role === 'assistant' ? (
                    <>
                      <MarkdownContent
                        markdown={message.content}
                        className="[&_p]:text-sm [&_p]:leading-6"
                      />
                      <AssistantResultsTable message={message} />
                      <AssistantSqlDetails message={message} />
                      <AssistantMeta message={message} />
                      <AssistantFeedback
                        message={message}
                        isSubmitting={Boolean(feedbackSubmittingById[message.id])}
                        onSubmitFeedback={submitFeedback}
                      />
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                  )}
                </div>
              </div>
            ))}

            {isThinking ? (
              <div className="flex justify-start">
                <div className="inline-flex max-w-[90%] items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                  <span>{progressLabel || 'Thinking'}</span>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t p-4">
          <div className="mb-3 text-xs text-slate-500">
            Answers use the latest available Dalgo AI context refresh.
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="dashboard-chat-input"
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask a question about this dashboard..."
              disabled={isThinking}
            />
            {isThinking ? (
              <Button
                type="button"
                onClick={cancelMessage}
                disabled={isCancelling}
                aria-label={isCancelling ? 'Stopping generation' : 'Stop generating'}
              >
                <Square className="h-4 w-4 fill-current" />
              </Button>
            ) : (
              <Button onClick={handleSend} disabled={!canSend || !isConnected}>
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
