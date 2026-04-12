'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Pencil, ArrowLeft } from 'lucide-react';
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="flex items-center justify-between mb-6 p-6 pb-0">
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
              <h1 className="text-3xl font-bold">{alert.name}</h1>
              <p className="text-muted-foreground mt-1">
                {alert.is_active ? 'Active' : 'Paused'} &middot; {cronToString(alert.cron)}
              </p>
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

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 mt-6">
        {/* Config summary */}
        <div className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">Configuration</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Data source:</span>{' '}
              {alert.query_config.schema_name}.{alert.query_config.table_name}
            </div>
            <div>
              <span className="text-muted-foreground">Measure:</span>{' '}
              {alert.query_config.aggregation}({alert.query_config.measure_column || '*'})
            </div>
            {alert.query_config.group_by_column && (
              <div>
                <span className="text-muted-foreground">Group by:</span>{' '}
                {alert.query_config.group_by_column}
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Condition:</span> computed{' '}
              {alert.query_config.condition_operator} {alert.query_config.condition_value}
            </div>
            {alert.query_config.filters.length > 0 && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Filters:</span>{' '}
                {alert.query_config.filters
                  .map((f) => `${f.column} ${f.operator} ${f.value}`)
                  .join(` ${alert.query_config.filter_connector} `)}
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Recipients:</span>{' '}
              {alert.recipients.join(', ')}
            </div>
            {alert.fire_streak > 0 && (
              <div>
                <span className="text-red-600 font-medium">
                  Firing for {alert.fire_streak} consecutive evaluation
                  {alert.fire_streak !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Evaluation History */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Evaluation History</h2>

          {evaluations.length === 0 ? (
            <p className="text-muted-foreground">
              No evaluations yet. The alert will be checked based on its schedule.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Checked At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rows Matched</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>Query Executed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluations.map((evaluation) => (
                    <TableRow key={evaluation.id} data-testid={`evaluation-row-${evaluation.id}`}>
                      <TableCell>
                        {format(new Date(evaluation.created_at), 'yyyy-MM-dd HH:mm')}
                      </TableCell>
                      <TableCell>
                        {evaluation.error_message ? (
                          <span className="text-orange-600 font-medium">Error</span>
                        ) : evaluation.fired ? (
                          <span className="text-red-600 font-medium">Fired</span>
                        ) : (
                          <span className="text-green-600">OK</span>
                        )}
                      </TableCell>
                      <TableCell>{evaluation.rows_returned}</TableCell>
                      <TableCell>{evaluation.num_recipients}</TableCell>
                      <TableCell className="max-w-xs">
                        <details className="text-xs">
                          <summary className="cursor-pointer truncate text-muted-foreground">
                            {evaluation.query_executed.slice(0, 60)}...
                          </summary>
                          <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto whitespace-pre-wrap">
                            {evaluation.query_executed}
                          </pre>
                          {evaluation.error_message && (
                            <p className="mt-1 text-red-600 text-xs">
                              Error: {evaluation.error_message}
                            </p>
                          )}
                        </details>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {evalTotalPages > 1 && (
                <div className="flex items-center justify-end gap-2 mt-4">
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
