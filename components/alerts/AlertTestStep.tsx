'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, ChevronDown } from 'lucide-react';
import { dryRunAlert } from '@/hooks/api/useAlerts';
import {
  AlertType,
  ThresholdOperator,
  type AlertTestPayload,
  type AlertTestResponse,
} from '@/types/alerts';
import { cn } from '@/lib/utils';

interface AlertTestStepProps {
  /** Auto-dry-run runs once on mount and whenever this payload signature changes. */
  payload: AlertTestPayload;
}

const OPERATOR_LABEL: Record<ThresholdOperator, string> = {
  [ThresholdOperator.LT]: 'less than',
  [ThresholdOperator.GT]: 'greater than',
  [ThresholdOperator.EQ]: 'equal to',
};

/** "less than 500" / "in red or amber state" — for the Result card. */
function prettyCondition(payload: AlertTestPayload): string {
  if (payload.alert_type === AlertType.KPI_RAG && 'rag_states' in payload.condition) {
    const states = payload.condition.rag_states;
    if (states.length === 0) return '—';
    if (states.length === 1) return `in ${states[0]} state`;
    return `in ${states.join(' or ')} state`;
  }
  if ('operator' in payload.condition) {
    return `${OPERATOR_LABEL[payload.condition.operator]} ${payload.condition.value}`;
  }
  return '—';
}

/** Top status banner. Colour reflects the dry-run outcome. */
function StatusPill({
  tone,
  testId,
  children,
}: {
  tone: 'success' | 'warning' | 'error';
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'flex items-center gap-3 rounded-full border px-4 py-2.5',
        tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
        tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-800',
        tone === 'error' && 'border-red-200 bg-red-50 text-red-800'
      )}
    >
      {tone === 'success' ? (
        <CheckCircle2 className="h-5 w-5 shrink-0" />
      ) : (
        <AlertCircle className="h-5 w-5 shrink-0" />
      )}
      <p className="text-sm font-medium">{children}</p>
    </div>
  );
}

export function AlertTestStep({ payload }: AlertTestStepProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [result, setResult] = useState<AlertTestResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sqlOpen, setSqlOpen] = useState(false);

  // Stable signature of the payload so we don't re-run on referentially-changed identical content.
  const signature = JSON.stringify(payload);

  const conditionLabel = useMemo(() => prettyCondition(payload), [payload]);

  const run = async () => {
    setState('loading');
    setErrorMessage(null);
    try {
      const res = await dryRunAlert(payload);
      setResult(res);
      setState('done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Dry-run failed');
      setResult(null);
      setState('done');
    }
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Running this alert against your warehouse…</p>
      </div>
    );
  }

  // Network / server error
  if (errorMessage) {
    return (
      <div className="space-y-3" data-testid="test-step-error">
        <StatusPill tone="error" testId="test-step-error-banner">
          Dry-run failed — {errorMessage}
        </StatusPill>
        <Button type="button" variant="outline" size="sm" onClick={run}>
          <RefreshCw className="mr-1 h-4 w-4" /> Try again
        </Button>
      </div>
    );
  }

  if (!result) return null;

  // Backend validation error (e.g. no warehouse configured)
  if (result.error) {
    return (
      <div className="space-y-3" data-testid="test-step-backend-error">
        <StatusPill tone="warning" testId="test-step-backend-error-banner">
          Couldn&apos;t evaluate — {result.error}
        </StatusPill>
        <Button type="button" variant="outline" size="sm" onClick={run}>
          <RefreshCw className="mr-1 h-4 w-4" /> Re-run
        </Button>
      </div>
    );
  }

  const wouldFire = result.would_fire;
  const isEmpty = result.current_value === null;

  return (
    <div className="space-y-5">
      {/* Status pill */}
      {isEmpty ? (
        <StatusPill tone="warning" testId="test-step-empty">
          No data available — current value is empty.
        </StatusPill>
      ) : wouldFire ? (
        <StatusPill tone="warning" testId="test-step-would-fire">
          Alert will fire for current data
        </StatusPill>
      ) : (
        <StatusPill tone="success" testId="test-step-would-not-fire">
          Alert will not fire for current data
        </StatusPill>
      )}

      {/* Result card */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Result</p>
        <div
          className="space-y-1 rounded-md bg-gray-100 px-4 py-3 text-sm"
          data-testid="test-step-outcome"
        >
          <p className="font-semibold text-gray-900">
            Current value: {result.current_value === null ? '—' : result.current_value}
          </p>
          <p className="text-gray-600">Threshold condition : {conditionLabel}</p>
        </div>
      </div>

      {/* Message preview */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Message Preview</p>
        <div className="whitespace-pre-wrap break-words rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
          {result.message || <span className="italic text-gray-400">(empty template)</span>}
        </div>
      </div>

      {/* SQL collapsible — one bordered accordion, header + body share the same shell */}
      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <button
          type="button"
          onClick={() => setSqlOpen((v) => !v)}
          data-testid="test-step-sql-toggle"
          className={cn(
            'flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-gray-50',
            sqlOpen && 'border-b border-gray-200'
          )}
        >
          <span>View generated Sql</span>
          <ChevronDown
            className={cn('h-4 w-4 text-gray-500 transition-transform', sqlOpen && 'rotate-180')}
          />
        </button>
        {sqlOpen && (
          <pre className="overflow-x-auto whitespace-pre bg-gray-50 px-4 py-3 font-mono text-sm text-gray-600">
            {result.sql_executed || '(no SQL captured)'}
          </pre>
        )}
      </div>
    </div>
  );
}
