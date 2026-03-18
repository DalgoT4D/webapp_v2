'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { ElementaryStatus } from '@/types/data-quality';
import { TASK_POLL_INTERVAL_MS, KEY_TO_FILENAME } from '@/constants/data-quality';
import {
  gitPull,
  checkDbtFiles,
  createElementaryProfile,
  createElementaryTrackingTables,
  createEdrDeployment,
  pollTaskProgress,
} from '@/hooks/api/useElementaryStatus';

function MappingComponent({ elementaryStatus }: { elementaryStatus: ElementaryStatus }) {
  const hasExists = Object.keys(elementaryStatus.exists).length > 0;
  const hasMissing = Object.keys(elementaryStatus.missing).length > 0;

  if (!hasExists && !hasMissing) return null;

  return (
    <div className="flex flex-col md:flex-row gap-4 w-full" data-testid="mapping-component">
      {hasExists && (
        <Card className="flex-1" data-testid="existing-config">
          <CardHeader>
            <CardTitle>Existing</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {Object.entries(elementaryStatus.exists).map(([key, value]) => (
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
            <CardTitle>Missing: Please add these missing lines to your dbt project</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {Object.entries(elementaryStatus.missing).map(([key, value]) => (
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
  );
}

interface ElementarySetupProps {
  onSetupComplete: () => void;
}

export function ElementarySetup({ onSetupComplete }: ElementarySetupProps) {
  const [loading, setLoading] = useState(false);
  const [elementaryStatus, setElementaryStatus] = useState<ElementaryStatus | null>(null);
  const abortRef = useRef(false);

  const pollForTaskRun = useCallback(async (taskId: string, hashKey: string) => {
    const response = await pollTaskProgress(taskId, hashKey);
    const lastMessage =
      response.progress?.length > 0 ? response.progress[response.progress.length - 1] : null;

    if (!lastMessage || !['completed', 'failed'].includes(lastMessage.status)) {
      if (abortRef.current) return;
      await new Promise((r) => setTimeout(r, TASK_POLL_INTERVAL_MS));
      if (abortRef.current) return;
      await pollForTaskRun(taskId, hashKey);
    } else if (lastMessage.status === 'failed') {
      throw new Error(lastMessage.message || 'Task failed');
    } else {
      toastSuccess.generic(lastMessage.message || 'Task completed');
    }
  }, []);

  const handleSetup = async () => {
    setLoading(true);
    abortRef.current = false;
    try {
      // Step 1: Git pull
      const gitPullResponse = await gitPull();
      if (!gitPullResponse.success) {
        toastError.api('Something went wrong during git pull');
        return;
      }

      // Step 2: Check dbt files
      const filesStatus = await checkDbtFiles();
      setElementaryStatus(filesStatus);

      if (Object.keys(filesStatus.missing).length > 0) {
        // Missing config — show MappingComponent and stop
        return;
      }

      // Step 3: Create elementary profile
      const profileResponse = await createElementaryProfile();
      if (profileResponse.status === 'success') {
        toastSuccess.generic('Elementary profile created successfully');
      } else {
        throw new Error('Failed to create elementary profile');
      }

      // Step 4: Create tracking tables (async, poll)
      const trackingResponse = await createElementaryTrackingTables();
      if (trackingResponse.task_id && trackingResponse.hashkey) {
        await new Promise((r) => setTimeout(r, TASK_POLL_INTERVAL_MS));
        await pollForTaskRun(trackingResponse.task_id, trackingResponse.hashkey);
      } else {
        throw new Error('Failed to start tracking tables task');
      }

      // Step 5: Create EDR deployment
      const edrResponse = await createEdrDeployment();
      if (edrResponse.status === 'success') {
        toastSuccess.generic('EDR deployment created successfully');
      } else {
        throw new Error('Failed to create EDR deployment');
      }

      onSetupComplete();
    } catch (err: unknown) {
      toastError.api(err, 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="elementary-setup"
      className="flex flex-col items-center justify-center gap-8 mt-6"
      data-testid="elementary-setup"
    >
      {loading ? (
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="setup-loader" />
      ) : (
        <>
          <p className="text-xl text-center">
            You currently don&apos;t have Elementary setup. Please click the button below to setup
            Elementary.
          </p>
          <Button onClick={handleSetup} data-testid="setup-elementary-btn">
            Setup Elementary
          </Button>
        </>
      )}

      {elementaryStatus && <MappingComponent elementaryStatus={elementaryStatus} />}
    </div>
  );
}
