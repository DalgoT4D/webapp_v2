'use client';

import { useMemo, useState } from 'react';
import { Bot, Loader2, Send, Sparkles } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MarkdownContent } from '@/components/ui/markdown-content';
import { useDashboardChat, type DashboardChatMessage } from '@/hooks/api/useDashboardChat';

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
                <p className="text-xs font-medium text-slate-900">{citation.title}</p>
                <p className="mt-1 text-xs text-slate-600">{citation.snippet}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
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
  const { messages, isConnected, isThinking, error, sendMessage } = useDashboardChat({
    dashboardId,
    enabled,
  });
  const [draftMessage, setDraftMessage] = useState('');

  const hasMessages = messages.length > 0;
  const canSend = useMemo(
    () => draftMessage.trim().length > 0 && !isThinking,
    [draftMessage, isThinking]
  );

  const handleSend = () => {
    if (!canSend) {
      return;
    }

    const didSend = sendMessage(draftMessage);
    if (didSend) {
      setDraftMessage('');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-full flex-col p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            Chat with Dashboards
          </SheetTitle>
          <SheetDescription>{dashboardTitle}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          <div className="space-y-4 py-4">
            {!hasMessages ? (
              <div className="rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-slate-600">
                <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  Ask about this dashboard
                </div>
                <p>
                  Ask questions about the dashboard, the charts on it, or the underlying warehouse
                  data that powers it.
                </p>
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
                      ? 'max-w-[85%] rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white'
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
                      <AssistantMeta message={message} />
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                  )}
                </div>
              </div>
            ))}

            {isThinking ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  thinking
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
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
            <Badge variant={isConnected ? 'default' : 'secondary'}>
              {isConnected ? 'Connected' : 'Connecting'}
            </Badge>
            <span>Answers are grounded in the latest scheduled dashboard context build.</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
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
            <Button onClick={handleSend} disabled={!canSend}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
