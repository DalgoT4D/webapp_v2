'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Mail,
  Slack,
  AlertCircle,
  FileText,
  Loader2,
} from 'lucide-react';
import { FullScreenModal } from '@/components/ui/full-screen-modal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAlertLogs } from '@/hooks/api/useAlerts';
import { AlertChannel, type AlertLog, type AlertLogDelivery } from '@/types/alerts';
import { cn } from '@/lib/utils';

interface AlertLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alertId: number | null;
  alertName?: string;
}

/** Strip leading "value " so the cell shows just the operator + threshold. */
function minimalCondition(pretty: string): string {
  return pretty.replace(/^value\s+/i, '').trim() || pretty;
}

/** "Today · 14:30" / "Yesterday · 09:00" / "May 4 · 09:00" */
function formatTimeLabel(iso: string): string {
  const d = new Date(iso);
  const hhmm = format(d, 'HH:mm');
  if (isToday(d)) return `Today · ${hhmm}`;
  if (isYesterday(d)) return `Yesterday · ${hhmm}`;
  return `${format(d, 'MMM d')} · ${hhmm}`;
}

/** Channel summary string for the row: "Email", "Slack", or "Email · Slack". */
function channelLabel(deliveries: AlertLogDelivery[]): string {
  const channels = new Set(deliveries.map((d) => d.channel));
  const parts: string[] = [];
  if (channels.has(AlertChannel.EMAIL)) parts.push('Email');
  if (channels.has(AlertChannel.SLACK)) parts.push('Slack');
  return parts.join(' · ') || '—';
}

/** "anjali@org.com, xyz@ngo.com +2" — first 2 visible, rest as overflow count. */
function recipientSummary(deliveries: AlertLogDelivery[]): {
  visible: string[];
  overflow: number;
} {
  const targets = deliveries.map((d) => d.target);
  const visible = targets.slice(0, 2);
  const overflow = Math.max(0, targets.length - visible.length);
  return { visible, overflow };
}

function DeliveryRow({ d }: { d: AlertLogDelivery }) {
  const isSent = d.status === 'sent';
  const Icon = d.channel === AlertChannel.SLACK ? Slack : Mail;
  return (
    <div className="flex items-start gap-2 py-1 text-sm">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-xs text-gray-700">{d.target}</span>
          {isSent ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700">
              <CheckCircle2 className="h-3 w-3" />
              Sent
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-red-700">
              <XCircle className="h-3 w-3" />
              Failed{d.http_status ? ` · HTTP ${d.http_status}` : ''}
            </span>
          )}
        </div>
        {!isSent && d.error_reason && (
          <div className="mt-0.5 break-all text-xs text-red-600">{d.error_reason}</div>
        )}
      </div>
    </div>
  );
}

function LogRowCard({ log }: { log: AlertLog }) {
  const [expanded, setExpanded] = useState(false);
  const [sqlOpen, setSqlOpen] = useState(false);
  const emailDeliveries = log.deliveries.filter((d) => d.channel === AlertChannel.EMAIL);
  const slackDeliveries = log.deliveries.filter((d) => d.channel === AlertChannel.SLACK);
  const { visible, overflow } = recipientSummary(log.deliveries);
  const showRecipients = visible.length > 0;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200/70 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="grid w-full grid-cols-12 items-center text-left hover:bg-gray-50/60"
        data-testid={`log-row-${log.id}`}
      >
        {/* Time */}
        <div className="col-span-2 min-w-0 px-4 py-4">
          <div className="text-sm font-medium text-gray-900">
            {formatTimeLabel(log.evaluated_at)}
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            {formatDistanceToNow(new Date(log.evaluated_at), { addSuffix: true })}
          </div>
        </div>

        {/* Current value */}
        <div className="col-span-2 px-4 py-4 text-sm text-gray-900">
          <span>{log.value ?? '—'}</span>
        </div>

        {/* Alert condition */}
        <div
          className="col-span-2 truncate px-4 py-4 text-sm text-gray-700"
          title={log.condition_pretty}
        >
          {minimalCondition(log.condition_pretty)}
        </div>

        {/* Delivery channel */}
        <div className="col-span-2 px-4 py-4 text-sm text-gray-700">
          {channelLabel(log.deliveries)}
        </div>

        {/* Recipients */}
        <div className="col-span-3 min-w-0 px-4 py-4 text-sm text-gray-700">
          {showRecipients ? (
            <div className="flex items-center gap-1">
              <span className="truncate">{visible.join(', ')}</span>
              {overflow > 0 && <span className="shrink-0 text-gray-500">+{overflow}</span>}
            </div>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>

        {/* Action — expand chevron */}
        <div className="col-span-1 flex justify-end px-4 py-4">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </div>
      </button>

      {expanded && (
        // Mirrors the visual language of the wizard's step 3 (AlertTestStep):
        // muted section labels, bordered cards, and a single-shell SQL accordion.
        <div className="space-y-5 border-t bg-gray-50/40 px-4 py-4 text-sm">
          {!log.fired && (
            <div
              className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-gray-700"
              data-testid={`log-not-fired-${log.id}`}
            >
              <AlertCircle className="h-5 w-5 shrink-0 text-gray-500" />
              <p className="font-medium">
                This evaluation did not fire — no notifications were sent.
              </p>
            </div>
          )}

          {/* Message preview */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Message Preview</p>
            <div className="whitespace-pre-wrap break-words rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
              {log.message || <span className="italic text-gray-400">(empty template)</span>}
            </div>
          </div>

          {/* Deliveries */}
          {(emailDeliveries.length > 0 || slackDeliveries.length > 0) && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Deliveries</p>
              <div className="space-y-2">
                {emailDeliveries.length > 0 && (
                  <div className="divide-y rounded-md border border-gray-200 bg-white px-3">
                    {emailDeliveries.map((d, i) => (
                      <DeliveryRow key={`e-${i}`} d={d} />
                    ))}
                  </div>
                )}
                {slackDeliveries.length > 0 && (
                  <div className="divide-y rounded-md border border-gray-200 bg-white px-3">
                    {slackDeliveries.map((d, i) => (
                      <DeliveryRow key={`s-${i}`} d={d} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SQL collapsible — one bordered accordion, header + body share the same shell */}
          <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => setSqlOpen((v) => !v)}
              data-testid={`toggle-sql-${log.id}`}
              className={cn(
                'flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-gray-50',
                sqlOpen && 'border-b border-gray-200'
              )}
            >
              <span>View generated Sql</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-gray-500 transition-transform',
                  sqlOpen && 'rotate-180'
                )}
              />
            </button>
            {sqlOpen && (
              <pre className="overflow-x-auto whitespace-pre bg-gray-50 px-4 py-3 font-mono text-sm text-gray-600">
                {log.sql_executed || '(no SQL captured)'}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LogsTableSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

/**
 * Same teal-header shell as `pipeline/logs-table` and `connections/connection-sync-history`
 * — matched class-for-class so the three log surfaces stay visually consistent. If a
 * primitive ever gets extracted, all three should adopt it together.
 */
function HeaderRow() {
  return (
    <div
      className="grid grid-cols-12 bg-teal-700 text-white text-sm font-semibold rounded-t-xl"
      data-testid="alert-log-table-header"
    >
      <div className="col-span-2 px-4 py-3">Time</div>
      <div className="col-span-2 px-4 py-3">Current value</div>
      <div className="col-span-2 px-4 py-3">Alert condition</div>
      <div className="col-span-2 px-4 py-3">Delivery channel</div>
      <div className="col-span-3 px-4 py-3">Recipients</div>
      <div className="col-span-1 px-4 py-3 text-right">Action</div>
    </div>
  );
}

export function AlertLogModal({ open, onOpenChange, alertId, alertName }: AlertLogModalProps) {
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<AlertLog[]>([]);
  const pageSize = 10;

  useEffect(() => {
    setPage(1);
    setAccumulated([]);
  }, [alertId]);

  const {
    data: newLogs,
    totalPages,
    isLoading,
  } = useAlertLogs(open ? alertId : null, { page, pageSize });

  useEffect(() => {
    if (newLogs.length === 0) return;
    setAccumulated((prev) => {
      if (page === 1) return newLogs;
      const existingIds = new Set(prev.map((l) => l.id));
      const fresh = newLogs.filter((l) => !existingIds.has(l.id));
      if (fresh.length === 0) return prev;
      return [...prev, ...fresh];
    });
  }, [newLogs, page]);

  const displayedLogs = accumulated.length > 0 ? accumulated : newLogs;
  const hasMore = page < totalPages;
  const showInitialLoading = isLoading && displayedLogs.length === 0;
  const loadingMore = isLoading && displayedLogs.length > 0;

  const subtitle = useMemo(() => alertName ?? null, [alertName]);

  return (
    <FullScreenModal open={open} onOpenChange={onOpenChange} title="Alert log" subtitle={subtitle}>
      <div className="flex h-full flex-col px-7 py-5">
        <HeaderRow />

        <div className="mt-2 flex-1 space-y-2 overflow-y-auto pb-4" data-testid="alert-log-list">
          {showInitialLoading && <LogsTableSkeleton />}
          {!showInitialLoading && displayedLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <FileText className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="mb-1 text-lg font-medium text-gray-900">No evaluations yet</h3>
              <p className="text-sm text-gray-500">
                Once this alert runs, its history will appear here.
              </p>
            </div>
          )}
          {displayedLogs.map((log) => (
            <LogRowCard key={log.id} log={log} />
          ))}

          {hasMore && (
            <div className="flex justify-center py-6">
              <Button
                variant="outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={loadingMore}
                className="min-w-[200px]"
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ChevronDown className="h-4 w-4 mr-2" />
                )}
                Load More
              </Button>
            </div>
          )}
        </div>
      </div>
    </FullScreenModal>
  );
}
