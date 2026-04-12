'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  Pencil,
  ArrowLeft,
  Database,
  Filter,
  Bell,
  Clock,
  Mail,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAlert, useAlertEvaluations } from '@/hooks/api/useAlerts';
import { cronToString } from '@/components/pipeline/utils';

interface AlertDetailProps {
  alertId: number;
}

function formatFilterValue(value: string): string {
  if (value === '__today__') return 'Today';
  if (value === '__yesterday__') return 'Yesterday';
  return value;
}

export function AlertDetail({ alertId }: AlertDetailProps) {
  const router = useRouter();
  const { alert, isLoading } = useAlert(alertId);
  const [evalPage, setEvalPage] = useState(1);
  const EVAL_PAGE_SIZE = 20;
  const { evaluations, total: evalTotal } = useAlertEvaluations(alertId, evalPage, EVAL_PAGE_SIZE);

  const evalTotalPages = useMemo(() => Math.ceil(evalTotal / EVAL_PAGE_SIZE), [evalTotal]);

  if (isLoading || !alert) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading alert...</p>
      </div>
    );
  }

  const qc = alert.query_config;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/alerts')}
              data-testid="back-to-alerts"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{alert.name}</h1>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    alert.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {alert.is_active ? 'Active' : 'Paused'}
                </span>
              </div>
              <p className="text-muted-foreground mt-1">{cronToString(alert.cron)}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="text-white hover:opacity-90 shadow-xs"
            style={{ backgroundColor: 'var(--primary)' }}
            onClick={() => router.push(`/alerts/${alertId}/edit`)}
            data-testid="edit-alert-btn"
          >
            <Pencil className="h-4 w-4 mr-2" />
            EDIT
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left: Config summary */}
        <div className="w-[35%] overflow-y-auto border-r px-5 py-5 space-y-3">
          {/* Condition */}
          <div className="border rounded-lg bg-white p-4 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              Condition
            </h3>
            <p className="text-sm">
              Check if <span className="font-semibold text-primary">{qc.aggregation}</span>
              {' of '}
              <span className="font-mono font-medium">{qc.measure_column || '*'}</span>
              {qc.group_by_column && (
                <>
                  {' per '}
                  <span className="font-mono font-medium">{qc.group_by_column}</span>
                </>
              )}
              {' is '}
              <span className="font-semibold text-red-600">
                {qc.condition_operator} {qc.condition_value}
              </span>
            </p>
          </div>

          {/* Data Source */}
          <div className="border rounded-lg bg-white p-4 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" />
              Data Source
            </h3>
            <p className="text-sm font-mono">
              {qc.schema_name}.{qc.table_name}
            </p>
          </div>

          {/* Filters */}
          {qc.filters.length > 0 && (
            <div className="border rounded-lg bg-white p-4 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                Filters
                <span className="text-[10px] font-normal bg-gray-100 px-1 py-0.5 rounded">
                  {qc.filter_connector}
                </span>
              </h3>
              <div className="space-y-1">
                {qc.filters.map((f, i) => (
                  <p key={`filter-${i}`} className="text-sm font-mono">
                    {f.column} <span className="text-muted-foreground">{f.operator}</span>{' '}
                    <span className="font-semibold">{formatFilterValue(f.value)}</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Schedule */}
          <div className="border rounded-lg bg-white p-4 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Schedule
            </h3>
            <p className="text-sm">{cronToString(alert.cron)}</p>
          </div>

          {/* Recipients */}
          <div className="border rounded-lg bg-white p-4 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Recipients ({alert.recipients.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {alert.recipients.map((email) => (
                <span key={email} className="text-xs bg-gray-50 border rounded px-2 py-1">
                  {email}
                </span>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="border rounded-lg bg-white p-4 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Message
            </h3>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{alert.message}</p>
          </div>
        </div>

        {/* Right: Evaluation History */}
        <div className="w-[65%] overflow-y-auto px-5 py-5">
          <h2 className="text-lg font-semibold mb-4">Evaluation History</h2>

          {evaluations.length === 0 ? (
            <div className="border rounded-lg bg-white p-8 text-center">
              <p className="text-muted-foreground">
                No evaluations yet. The alert will be checked based on its schedule.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-medium">Checked At</TableHead>
                    <TableHead className="font-medium">Status</TableHead>
                    <TableHead className="font-medium">Rows</TableHead>
                    <TableHead className="font-medium">Sent To</TableHead>
                    <TableHead className="font-medium">Query</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluations.map((evaluation) => (
                    <TableRow key={evaluation.id} data-testid={`evaluation-row-${evaluation.id}`}>
                      <TableCell className="text-sm">
                        {format(new Date(evaluation.created_at), 'MMM d, h:mm a')}
                      </TableCell>
                      <TableCell>
                        {evaluation.error_message ? (
                          <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                            Error
                          </span>
                        ) : evaluation.fired ? (
                          <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            Fired
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            OK
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{evaluation.rows_returned}</TableCell>
                      <TableCell className="text-sm">{evaluation.num_recipients}</TableCell>
                      <TableCell>
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            View SQL
                          </summary>
                          <pre className="mt-2 p-3 bg-gray-50 rounded-md text-xs overflow-x-auto whitespace-pre-wrap border">
                            {evaluation.query_executed}
                          </pre>
                          {evaluation.error_message && (
                            <p className="mt-2 text-red-600 text-xs bg-red-50 rounded-md p-2">
                              {evaluation.error_message}
                            </p>
                          )}
                        </details>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {evalTotalPages > 1 && (
                <div className="flex items-center justify-end gap-2 p-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={evalPage <= 1}
                    onClick={() => setEvalPage((p) => p - 1)}
                    data-testid="eval-prev-page"
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {evalPage} of {evalTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={evalPage >= evalTotalPages}
                    onClick={() => setEvalPage((p) => p + 1)}
                    data-testid="eval-next-page"
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
