'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, BellRing } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAlerts } from '@/hooks/api/useAlerts';

interface KPIAlertsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kpiId: number | null;
  kpiName?: string | null;
  onAlertSelected?: (alertId: number) => void;
}

function formatThresholdConditionText(
  aggregation: string,
  measureColumn: string | null,
  operator: string,
  value: number
) {
  const subject = measureColumn ? `${aggregation}(${measureColumn})` : `${aggregation}(rows)`;
  return `${subject} ${operator} ${value}`;
}

function formatRagConditionText(level: 'red' | 'amber' | 'green' | null) {
  if (!level) return null;
  return `When KPI is ${level.charAt(0).toUpperCase()}${level.slice(1)}`;
}

function formatTimestamp(value: string | null) {
  if (!value) return 'Never fired';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function KPIAlertsDialog({
  open,
  onOpenChange,
  kpiId,
  kpiName,
  onAlertSelected,
}: KPIAlertsDialogProps) {
  const router = useRouter();
  const { alerts, isLoading } = useAlerts(1, 50, open ? { kpiId } : null);

  if (!kpiId) return null;

  const handleSelectAlert = (alertId: number) => {
    onOpenChange(false);
    onAlertSelected?.(alertId);
    router.push(`/alerts/${alertId}/edit`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            Alerts for {kpiName || 'KPI'}
          </DialogTitle>
          <DialogDescription>
            Open any linked alert to edit its condition, recipients, or message.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-3 p-6">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-3xl border bg-muted/30" />
              ))
            ) : alerts.length === 0 ? (
              <div className="rounded-[28px] border border-dashed bg-muted/10 px-6 py-12 text-center">
                <BellRing className="mx-auto mb-4 h-8 w-8 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold">No alerts linked yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create an alert from this KPI to start monitoring it.
                </p>
              </div>
            ) : (
              alerts.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => handleSelectAlert(alert.id)}
                  className="flex w-full items-start justify-between gap-4 rounded-[28px] border border-slate-200 bg-white px-5 py-5 text-left shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition hover:border-primary/30 hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)]"
                >
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">{alert.name}</h3>
                      {!alert.is_active ? <Badge variant="outline">Paused</Badge> : null}
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="rounded-full bg-muted/20 font-normal">
                        {formatRagConditionText(alert.metric_rag_level) ||
                          formatThresholdConditionText(
                            alert.query_config.aggregation,
                            alert.query_config.measure_column,
                            alert.query_config.condition_operator,
                            alert.query_config.condition_value
                          )}
                      </Badge>
                      {alert.query_config.group_by_column ? (
                        <Badge variant="outline" className="rounded-full bg-muted/20 font-normal">
                          Group by {alert.query_config.group_by_column}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>
                        {alert.recipients.length} recipient
                        {alert.recipients.length === 1 ? '' : 's'}
                      </span>
                      <span>Last fired {formatTimestamp(alert.last_fired_at)}</span>
                    </div>
                  </div>

                  <div className="mt-1 flex items-center gap-2 text-sm font-medium text-foreground">
                    Edit alert
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
