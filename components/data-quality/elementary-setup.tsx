'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toastError } from '@/lib/toast';
import {
  ElementaryStatus,
  ElementaryCheckResponse,
  InstallStepProgress,
  InstallStepStatus,
} from '@/types/data-quality';
import { TASK_POLL_INTERVAL_MS, KEY_TO_FILENAME } from '@/constants/data-quality';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import {
  elementaryCheck,
  elementaryInstall,
  pollTaskProgress,
} from '@/hooks/api/useElementaryStatus';

// Backend enumerates 3 sub-steps in the install_elementary celery task.
// Order + labels must match ddpui/celeryworkers/tasks.py:install_elementary.
const INSTALL_STEPS: Array<{ index: number; label: string }> = [
  { index: 0, label: 'Creating dbt profile' },
  { index: 1, label: 'Installing elementary package' },
  { index: 2, label: 'Scheduling reports' },
];

// UI state machine.
type Phase =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'needs_repo_changes'; status: ElementaryStatus }
  | { kind: 'installing'; steps: InstallStepProgress[]; taskId: string; hashKey: string }
  | { kind: 'error'; message: string };

function makeInitialSteps(): InstallStepProgress[] {
  return INSTALL_STEPS.map((s) => ({ stepIndex: s.index, step: s.label, status: 'pending' }));
}

function InstallProgress({ steps }: { steps: InstallStepProgress[] }) {
  // Priority order: running → failed → first pending → last completed.
  // Choosing "first pending" over "last completed" avoids flashing the last
  // step's label during (a) initial render before the first poll, and
  // (b) the brief window between all-completed and the parent unmounting us.
  const current =
    steps.find((s) => s.status === 'running') ??
    steps.find((s) => s.status === 'failed') ??
    steps.find((s) => s.status === 'pending') ??
    steps[steps.length - 1];

  if (current.status === 'failed') {
    return (
      <div className="flex items-center gap-3" data-testid="install-progress">
        <X className="h-5 w-5 text-red-600" />
        <p className="text-base text-red-600">
          {current.step} failed{current.message ? `: ${current.message}` : ''}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3" data-testid="install-progress">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <p className="text-base text-gray-700">{current.step}…</p>
    </div>
  );
}

function MissingConfig({
  status,
  onCheckAgain,
  checking,
}: {
  status: ElementaryStatus;
  onCheckAgain: () => void;
  checking: boolean;
}) {
  const hasExists = Object.keys(status.exists).length > 0;
  const hasMissing = Object.keys(status.missing).length > 0;

  return (
    <div className="flex flex-col gap-4 w-full" data-testid="needs-repo-changes">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          A couple of edits needed in your dbt project
        </h3>
        <p className="text-base text-gray-500">
          Add the snippets below to the listed files in your git repo, commit, push, and click{' '}
          <span className="font-medium text-gray-700">Check again</span>.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 w-full">
        {hasExists && (
          <Card className="flex-1" data-testid="existing-config">
            <CardHeader>
              <CardTitle>Already configured</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {Object.entries(status.exists).map(([key, value]) => (
                  <li key={key}>
                    <p className="font-medium">{KEY_TO_FILENAME[key] ?? key}</p>
                    {typeof value === 'object' ? (
                      <pre className="whitespace-pre-wrap bg-gray-100 p-3 rounded font-mono text-sm mt-1">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-muted-foreground mt-1">{value}</p>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {hasMissing && (
          <Card className="flex-[2]" data-testid="missing-config">
            <CardHeader>
              <CardTitle>Add these to your dbt project</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {Object.entries(status.missing).map(([key, value]) => (
                  <li key={key}>
                    <p className="font-medium">{KEY_TO_FILENAME[key] ?? key}</p>
                    <pre className="whitespace-pre-wrap bg-gray-100 p-3 rounded font-mono text-sm mt-1">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
                    </pre>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <Button
        variant="primary"
        onClick={onCheckAgain}
        disabled={checking}
        className="self-start"
        data-testid="check-again-btn"
      >
        {checking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Check again
      </Button>
    </div>
  );
}

interface ElementarySetupProps {
  onSetupComplete: () => void;
}

export function ElementarySetup({ onSetupComplete }: ElementarySetupProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const abortRef = useRef(false);

  const { hasPermission } = useRbac();
  // Setting up Elementary mutates the dbt workspace — gate on edit access so
  // read-only roles (e.g. analyst) can't trigger it.
  const canSetup = hasPermission(PERMISSIONS.CAN_EDIT_DBT_WORKSPACE);

  // Poll the install task's progress; update phase.steps as new entries arrive.
  const pollInstallProgress = useCallback(
    async (taskId: string, hashKey: string) => {
      // Recursive poller with abort support.
      const loop = async (): Promise<void> => {
        if (abortRef.current) return;

        const response = await pollTaskProgress(taskId, hashKey);

        // Fold all progress entries with a stepIndex into per-step state.
        // Later entries win, so a step's final status is whatever we saw last.
        const stepStates: Record<number, InstallStepProgress> = Object.fromEntries(
          INSTALL_STEPS.map((s) => [
            s.index,
            { stepIndex: s.index, step: s.label, status: 'pending' as InstallStepStatus },
          ])
        );
        let lastFailedMessage: string | null = null;
        for (const entry of response.progress ?? []) {
          if (typeof entry.stepIndex === 'number') {
            stepStates[entry.stepIndex] = {
              stepIndex: entry.stepIndex,
              step: entry.step ?? INSTALL_STEPS[entry.stepIndex]?.label ?? '',
              status: entry.status as InstallStepStatus,
              message: entry.message,
            };
          }
          if (entry.status === 'failed') {
            lastFailedMessage = entry.message ?? 'Install failed';
          }
        }
        const steps = INSTALL_STEPS.map((s) => stepStates[s.index]);
        setPhase({ kind: 'installing', steps, taskId, hashKey });

        const allCompleted = steps.every((s) => s.status === 'completed');
        const anyFailed = steps.some((s) => s.status === 'failed');

        if (allCompleted) {
          trackEvent(ANALYTICS_EVENTS.DATA_QUALITY_SETUP_COMPLETED);
          onSetupComplete();
          return;
        }
        if (anyFailed) {
          setPhase({ kind: 'error', message: lastFailedMessage ?? 'Install failed' });
          return;
        }

        await new Promise((r) => setTimeout(r, TASK_POLL_INTERVAL_MS));
        return loop();
      };
      await loop();
    },
    [onSetupComplete]
  );

  const startInstall = useCallback(async () => {
    try {
      const { task_id, hashkey } = await elementaryInstall();
      setPhase({
        kind: 'installing',
        steps: makeInitialSteps(),
        taskId: task_id,
        hashKey: hashkey,
      });
      // Give the celery task a moment to emit its first progress entry before polling.
      await new Promise((r) => setTimeout(r, TASK_POLL_INTERVAL_MS));
      await pollInstallProgress(task_id, hashkey);
    } catch (err: unknown) {
      toastError.api(err, 'Install failed');
      setPhase({ kind: 'error', message: 'Install failed to start' });
    }
  }, [pollInstallProgress]);

  const runCheck = useCallback(async () => {
    setPhase({ kind: 'checking' });
    abortRef.current = false;
    try {
      const response: ElementaryCheckResponse = await elementaryCheck();
      if (response.status === 'needs_repo_changes') {
        setPhase({
          kind: 'needs_repo_changes',
          status: { exists: response.exists, missing: response.missing },
        });
        return;
      }
      // status === 'ready' — kick straight into install
      await startInstall();
    } catch (err: unknown) {
      toastError.api(err, 'Check failed');
      setPhase({ kind: 'error', message: 'Check failed' });
    }
  }, [startInstall]);

  return (
    <div
      id="elementary-setup"
      className="flex flex-col items-center justify-center gap-8 mt-6"
      data-testid="elementary-setup"
    >
      {phase.kind === 'idle' && (
        <>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Elementary is not set up yet
            </h3>
            <p className="text-base text-gray-500 max-w-md">
              Set up Elementary to monitor data quality and generate reports for your dbt project.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={runCheck}
            disabled={!canSetup}
            data-testid="setup-elementary-btn"
          >
            Setup Elementary
          </Button>
        </>
      )}

      {phase.kind === 'checking' && (
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" data-testid="check-loader" />
          <p className="text-base text-gray-700">Checking your dbt project…</p>
        </div>
      )}

      {phase.kind === 'needs_repo_changes' && (
        <MissingConfig status={phase.status} onCheckAgain={runCheck} checking={false} />
      )}

      {phase.kind === 'installing' && <InstallProgress steps={phase.steps} />}

      {phase.kind === 'error' && (
        <div className="flex flex-col items-center gap-4" data-testid="setup-error">
          <p className="text-base text-red-600">{phase.message}</p>
          <Button variant="primary" onClick={runCheck} data-testid="retry-btn">
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
