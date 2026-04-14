'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, BellRing, Database, Mail, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataPreview } from '@/components/charts/DataPreview';
import { useAlert, useAlertEvaluations } from '@/hooks/api/useAlerts';

interface TriggeredAlertDetailProps {
  alertId: number;
  evaluationId: number;
}

function evaluationTone(fired: boolean, errorMessage: string | null) {
  if (errorMessage) {
    return 'border-orange-200 bg-orange-50 text-orange-700';
  }
  return fired
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

export function TriggeredAlertDetail({ alertId, evaluationId }: TriggeredAlertDetailProps) {
  const router = useRouter();
  const { alert, isLoading: alertLoading } = useAlert(alertId);
  const { evaluations, isLoading: evaluationsLoading } = useAlertEvaluations(alertId, 1, 200);

  const evaluation = useMemo(
    () => evaluations.find((item) => item.id === evaluationId) ?? null,
    [evaluationId, evaluations]
  );
  const resultColumns =
    evaluation?.result_preview && evaluation.result_preview.length > 0
      ? Object.keys(evaluation.result_preview[0])
      : [];

  if (alertLoading || evaluationsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading triggered alert...</p>
      </div>
    );
  }

  if (!alert || !evaluation) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Triggered alert instance not found.</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-slate-50/60">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6">
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" className="gap-2 px-0" onClick={() => router.push('/alerts')}>
            <ArrowLeft className="h-4 w-4" />
            Back to alerts
          </Button>
          <Button variant="outline" onClick={() => router.push(`/alerts/${alertId}`)}>
            View alert
          </Button>
        </div>

        <section className="rounded-[32px] border border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-slate-50 p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={evaluationTone(evaluation.fired, evaluation.error_message)}
            >
              {evaluation.error_message ? 'Error' : evaluation.fired ? 'Triggered' : 'OK'}
            </Badge>
            {alert.metric_name ? <Badge variant="secondary">{alert.metric_name}</Badge> : null}
            {alert.query_config.group_by_column ? (
              <Badge variant="outline">Group by {alert.query_config.group_by_column}</Badge>
            ) : null}
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight">{alert.name}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Fired {formatDistanceToNow(new Date(evaluation.created_at), { addSuffix: true })} on{' '}
            {format(new Date(evaluation.created_at), 'MMM d, yyyy h:mm a')}
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
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
              </div>
            </div>
            <div className="rounded-2xl border bg-white/85 px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Failing results
              </div>
              <div className="mt-2 text-sm font-medium">{evaluation.rows_returned}</div>
            </div>
            <div className="rounded-2xl border bg-white/85 px-4 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Recipients
              </div>
              <div className="mt-2 text-sm font-medium">{evaluation.num_recipients}</div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)]">
          <div className="min-w-0 space-y-6">
            <section className="rounded-[28px] border bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="mb-4 flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Rendered email</h2>
              </div>
              <pre className="whitespace-pre-wrap rounded-2xl bg-muted/20 p-4 text-sm text-muted-foreground">
                {evaluation.rendered_message || evaluation.message}
              </pre>
            </section>

            <section className="rounded-[28px] border bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="mb-4 flex items-center gap-2">
                <BellRing className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Recipients</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {evaluation.recipients.map((email) => (
                  <Badge key={email} variant="outline">
                    {email}
                  </Badge>
                ))}
              </div>
            </section>
          </div>

          <div className="min-w-0 space-y-6">
            <section className="min-w-0 rounded-[28px] border bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Query</h2>
              </div>
              <pre className="overflow-hidden whitespace-pre-wrap break-all rounded-2xl bg-muted/20 p-4 font-mono text-[11px] leading-5 text-muted-foreground">
                {evaluation.query_executed}
              </pre>
            </section>

            <section className="min-w-0 overflow-hidden rounded-[28px] border bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              <div className="mb-4 flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Query result</h2>
              </div>

              {evaluation.result_preview.length > 0 ? (
                <div className="min-w-0 overflow-hidden">
                  <DataPreview data={evaluation.result_preview} columns={resultColumns} />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  No query result is available for this triggered instance.
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
