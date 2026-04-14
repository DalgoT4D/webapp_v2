'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import {
  BellRing,
  ChevronRight,
  Clock3,
  Eye,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useAlerts, useTriggeredAlerts, deleteAlert } from '@/hooks/api/useAlerts';
import { toastError, toastSuccess } from '@/lib/toast';
import type { Alert, TriggeredAlertEvent } from '@/types/alert';

const CONFIGURED_PAGE_SIZE = 24;
const TRIGGERED_PAGE_SIZE = 500;

interface TriggeredAlertGroup {
  alertId: number;
  alertName: string;
  metricName: string | null;
  latestCreatedAt: string;
  events: TriggeredAlertEvent[];
}

function formatRelativeDate(value: string | null) {
  if (!value) return 'Never';
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function alertTone(alert: Alert) {
  if (!alert.is_active) {
    return {
      border: 'border-slate-200',
      background: 'from-slate-50 via-white to-slate-50',
    };
  }

  if (alert.last_fired_at || alert.fire_streak > 0) {
    return {
      border: 'border-rose-200/80',
      background: 'from-rose-50 via-white to-rose-50/70',
    };
  }

  return {
    border: 'border-slate-200/80',
    background: 'from-white via-white to-slate-50',
  };
}

function buildTriggeredGroups(events: TriggeredAlertEvent[]) {
  const groups = new Map<number, TriggeredAlertGroup>();

  for (const event of events) {
    const current = groups.get(event.alert_id);
    if (!current) {
      groups.set(event.alert_id, {
        alertId: event.alert_id,
        alertName: event.alert_name,
        metricName: event.metric_name,
        latestCreatedAt: event.created_at,
        events: [event],
      });
      continue;
    }

    current.events.push(event);
    if (new Date(event.created_at).getTime() > new Date(current.latestCreatedAt).getTime()) {
      current.latestCreatedAt = event.created_at;
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      events: group.events.sort(
        (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      ),
    }))
    .sort(
      (left, right) =>
        new Date(right.latestCreatedAt).getTime() - new Date(left.latestCreatedAt).getTime()
    );
}

function TriggerSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white/80 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

export function AlertList() {
  const router = useRouter();
  const { confirm, DialogComponent: DeleteDialog } = useConfirmationDialog();
  const [currentPage, setCurrentPage] = useState(1);

  const { alerts, total, isLoading, mutate } = useAlerts(currentPage, CONFIGURED_PAGE_SIZE);
  const { events, isLoading: triggeredLoading } = useTriggeredAlerts(1, TRIGGERED_PAGE_SIZE);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / CONFIGURED_PAGE_SIZE)), [total]);
  const triggeredGroups = useMemo(() => buildTriggeredGroups(events), [events]);

  const handleDelete = async (alert: Alert) => {
    const confirmed = await confirm({
      title: 'Delete alert?',
      description: `This permanently removes "${alert.name}" and its evaluation history.`,
      confirmText: 'Delete',
      type: 'warning',
    });
    if (!confirmed) return;

    try {
      await deleteAlert(alert.id);
      toastSuccess.deleted('Alert');
      await mutate();
    } catch (error: unknown) {
      toastError.delete(error, 'Alert');
    }
  };

  const renderConfiguredAlerts = () => {
    if (isLoading) {
      return (
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-[28px] border bg-white p-6">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="mt-4 h-8 w-72" />
              <Skeleton className="mt-3 h-4 w-full" />
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (alerts.length === 0) {
      return (
        <div className="rounded-[32px] border border-dashed bg-white px-6 py-14 text-center">
          <BellRing className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h3 className="text-xl font-semibold">No alerts yet</h3>
          <Button className="mt-6" onClick={() => router.push('/alerts/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Create alert
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-2">
          {alerts.map((alert) => {
            const tone = alertTone(alert);

            return (
              <div
                key={alert.id}
                className={`overflow-hidden rounded-[30px] border ${tone.border} bg-gradient-to-br ${tone.background} shadow-[0_12px_30px_rgba(15,23,42,0.05)]`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => router.push(`/alerts/${alert.id}`)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {alert.metric_name ? (
                          <Badge variant="secondary">{alert.metric_name}</Badge>
                        ) : null}
                        {!alert.is_active ? <Badge variant="outline">Paused</Badge> : null}
                      </div>

                      <h3 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
                        {alert.name}
                      </h3>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {alert.query_config.schema_name}.{alert.query_config.table_name}
                      </p>
                      <p className="mt-1 text-sm text-foreground/80">
                        {alert.query_config.aggregation} {alert.query_config.condition_operator}{' '}
                        {alert.query_config.condition_value}
                        {alert.query_config.measure_column
                          ? ` on ${alert.query_config.measure_column}`
                          : ' on rows'}
                        {alert.query_config.group_by_column
                          ? ` · Group by ${alert.query_config.group_by_column}`
                          : ''}
                      </p>
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Alert actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/alerts/${alert.id}`)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/alerts/${alert.id}/edit`)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(alert)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <TriggerSummary
                      label="Last checked"
                      value={formatRelativeDate(alert.last_evaluated_at)}
                    />
                    <TriggerSummary
                      label="Last fired"
                      value={formatRelativeDate(alert.last_fired_at)}
                    />
                    <TriggerSummary
                      label="Recipients"
                      value={`${alert.recipients.length} recipient${alert.recipients.length === 1 ? '' : 's'}`}
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {alert.recipients.join(', ')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((page) => page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((page) => page + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>
    );
  };

  const renderTriggeredAlerts = () => {
    if (triggeredLoading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-[28px] border bg-white p-6">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="mt-4 h-8 w-64" />
              <Skeleton className="mt-4 h-24 w-full rounded-2xl" />
            </div>
          ))}
        </div>
      );
    }

    if (triggeredGroups.length === 0) {
      return (
        <div className="rounded-[32px] border border-dashed bg-white px-6 py-14 text-center">
          <BellRing className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h3 className="text-xl font-semibold">No triggered alerts yet</h3>
        </div>
      );
    }

    return (
      <Accordion type="multiple" className="space-y-4">
        {triggeredGroups.map((group) => (
          <AccordionItem key={group.alertId} value={String(group.alertId)} className="border-0">
            <div className="overflow-hidden rounded-[30px] border border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-slate-50 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
              <AccordionTrigger className="px-6 py-5 hover:no-underline">
                <div className="flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-rose-200 bg-rose-100/80 text-rose-800"
                    >
                      Triggered
                    </Badge>
                    {group.metricName ? (
                      <Badge variant="secondary">{group.metricName}</Badge>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight text-foreground">
                        {group.alertName}
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {group.events.length} fired instance
                        {group.events.length === 1 ? '' : 's'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1">
                        <Clock3 className="h-4 w-4" />
                        Last fired {formatRelativeDate(group.latestCreatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent className="px-6 pb-6">
                <div className="space-y-3 border-t border-rose-100 pt-4">
                  {group.events.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => router.push(`/alerts/${event.alert_id}/fired/${event.id}`)}
                      className="w-full rounded-[24px] border bg-white/90 p-4 text-left transition hover:border-primary/30 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="bg-background">
                              {format(new Date(event.created_at), 'MMM d, yyyy h:mm a')}
                            </Badge>
                            <Badge variant="outline">{event.rows_returned} failing result(s)</Badge>
                            <Badge variant="outline">{event.num_recipients} recipients</Badge>
                          </div>
                          <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                            {event.rendered_message}
                          </p>
                        </div>
                        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </div>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-slate-50/60">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
          <Button onClick={() => router.push('/alerts/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Create alert
          </Button>
        </div>

        <Tabs defaultValue="configured" className="space-y-5">
          <TabsList className="grid w-full max-w-sm grid-cols-2 rounded-full bg-white p-1 shadow-sm">
            <TabsTrigger value="configured" className="rounded-full">
              Configured
            </TabsTrigger>
            <TabsTrigger value="triggered" className="rounded-full">
              Triggered
            </TabsTrigger>
          </TabsList>

          <TabsContent value="configured" className="mt-0">
            {renderConfiguredAlerts()}
          </TabsContent>

          <TabsContent value="triggered" className="mt-0">
            {renderTriggeredAlerts()}
          </TabsContent>
        </Tabs>
      </div>

      <DeleteDialog />
    </div>
  );
}
