'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, BellRing, Database, Filter, Mail, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAlert, useAlertEvaluations } from '@/hooks/api/useAlerts';

interface AlertDetailProps {
  alertId: number;
}

function formatFilterValue(value: string) {
  if (value === '__today__') return 'Today';
  if (value === '__yesterday__') return 'Yesterday';
  return value;
}

function evaluationTone(fired: boolean, errorMessage: string | null) {
  if (errorMessage) {
    return 'border-orange-200 bg-orange-50 text-orange-700';
  }
  return fired
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

export function AlertDetail({ alertId }: AlertDetailProps) {
  const router = useRouter();
  const { alert, isLoading } = useAlert(alertId);
  const [evalPage, setEvalPage] = useState(1);
  const { evaluations, total } = useAlertEvaluations(alertId, evalPage, 10);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / 10)), [total]);

  if (isLoading || !alert) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading alert...</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-slate-50/60">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" className="gap-2 px-0" onClick={() => router.push('/alerts')}>
            <ArrowLeft className="h-4 w-4" />
            Alerts
          </Button>
          <Button onClick={() => router.push(`/alerts/${alertId}/edit`)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>

        <section className="rounded-[32px] border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50 p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-center gap-2">
            {alert.metric_name ? <Badge variant="secondary">{alert.metric_name}</Badge> : null}
            {alert.query_config.group_by_column ? (
              <Badge variant="outline">Group by {alert.query_config.group_by_column}</Badge>
            ) : null}
            {!alert.is_active ? <Badge variant="outline">Paused</Badge> : null}
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">{alert.name}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Last checked{' '}
            {alert.last_evaluated_at
              ? formatDistanceToNow(new Date(alert.last_evaluated_at), { addSuffix: true })
              : 'never'}
            . Last fired{' '}
            {alert.last_fired_at
              ? formatDistanceToNow(new Date(alert.last_fired_at), { addSuffix: true })
              : 'never'}
            .
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border bg-white/85 px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Dataset
              </div>
              <div className="mt-2 font-mono text-sm">
                {alert.query_config.schema_name}.{alert.query_config.table_name}
              </div>
            </div>
            <div className="rounded-2xl border bg-white/85 px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Condition
              </div>
              <div className="mt-2 text-sm font-medium">
                {alert.query_config.aggregation} {alert.query_config.condition_operator}{' '}
                {alert.query_config.condition_value}
                {alert.query_config.measure_column
                  ? ` on ${alert.query_config.measure_column}`
                  : ' on rows'}
              </div>
            </div>
            <div className="rounded-2xl border bg-white/85 px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Recipients
              </div>
              <div className="mt-2 text-sm font-medium">
                {alert.recipients.length} recipient{alert.recipients.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            {alert.query_config.filters.length > 0 ? (
              <section className="rounded-[28px] border bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                <div className="mb-4 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Filters</h2>
                  <Badge variant="outline">{alert.query_config.filter_connector}</Badge>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {alert.query_config.filters.map((filter, index) => (
                    <p key={`${filter.column}-${index}`} className="font-mono">
                      {filter.column} {filter.operator} {formatFilterValue(filter.value)}
                    </p>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-[28px] border bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="mb-4 flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Recipients</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {alert.recipients.map((email) => (
                  <Badge key={email} variant="outline">
                    {email}
                  </Badge>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="mb-4 flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Email template</h2>
              </div>
              <Tabs defaultValue="intro" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted/40 p-1">
                  <TabsTrigger value="intro" className="rounded-full">
                    Body
                  </TabsTrigger>
                  <TabsTrigger
                    value="group"
                    className="rounded-full"
                    disabled={!alert.query_config.group_by_column}
                  >
                    Per group
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="intro" className="mt-0">
                  <pre className="whitespace-pre-wrap rounded-2xl bg-muted/20 p-4 text-sm text-muted-foreground">
                    {alert.message}
                  </pre>
                </TabsContent>
                <TabsContent value="group" className="mt-0">
                  <pre className="whitespace-pre-wrap rounded-2xl bg-muted/20 p-4 text-sm text-muted-foreground">
                    {alert.group_message || 'No per-group section configured.'}
                  </pre>
                </TabsContent>
              </Tabs>
            </section>
          </div>

          <section className="rounded-[28px] border bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center gap-2">
              <BellRing className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold">History</h2>
            </div>

            {evaluations.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                No evaluations yet.
              </div>
            ) : (
              <div className="space-y-3">
                {evaluations.map((evaluation) => (
                  <div key={evaluation.id} className="rounded-[24px] border bg-muted/5 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={evaluationTone(evaluation.fired, evaluation.error_message)}
                          >
                            {evaluation.error_message ? 'Error' : evaluation.fired ? 'Fired' : 'OK'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(evaluation.created_at), 'MMM d, yyyy h:mm a')}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">
                            {evaluation.rows_returned} failing result(s)
                          </Badge>
                          <Badge variant="outline">
                            {evaluation.num_recipients} recipient
                            {evaluation.num_recipients === 1 ? '' : 's'}
                          </Badge>
                        </div>

                        {evaluation.rendered_message || evaluation.message ? (
                          <p className="mt-4 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                            {evaluation.rendered_message || evaluation.message}
                          </p>
                        ) : null}
                      </div>

                      {evaluation.fired ? (
                        <Button
                          variant="outline"
                          onClick={() => router.push(`/alerts/${alertId}/fired/${evaluation.id}`)}
                        >
                          View instance
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}

                {totalPages > 1 ? (
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={evalPage <= 1}
                      onClick={() => setEvalPage((page) => page - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {evalPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={evalPage >= totalPages}
                      onClick={() => setEvalPage((page) => page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
