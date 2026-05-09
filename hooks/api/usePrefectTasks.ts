// hooks/api/usePrefectTasks.ts
'use client';

import useSWR from 'swr';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import type { TransformTask, PrefectFlowRun, TaskProgress } from '@/types/transform';

// Polling interval when any task is locked (ms) - frequent enough for near-real-time status
const LOCKED_TASK_POLL_INTERVAL_MS = 3000;

// Polling interval for task progress (ms) - balances responsiveness with server load
const TASK_STATUS_POLL_INTERVAL_MS = 2000;

// Fetch transform tasks
export function usePrefectTasks() {
  return useSWR<TransformTask[]>('/api/prefect/tasks/transform/', apiGet, {
    refreshInterval: (data) => {
      if (data?.some((task) => task.lock)) {
        return LOCKED_TASK_POLL_INTERVAL_MS;
      }
      return 0;
    },
    revalidateOnFocus: false,
  });
}

// Run a Prefect deployment (mutation)
export async function runPrefectDeployment(deploymentId: string) {
  return apiPost(`/api/prefect/v1/flows/${deploymentId}/flow_run/`, {});
}

// Run a Prefect task directly (non-deployment, e.g., dbt-test, dbt-deps)
export async function runPrefectTask(taskUuid: string): Promise<{
  status: string;
  result: Array<string | { id?: string; state_details?: { flow_run_id?: string } }>;
}> {
  return apiPost(`/api/prefect/tasks/${taskUuid}/run/`, {});
}

// Delete a Prefect task (mutation)
export async function deletePrefectTask(taskUuid: string) {
  return apiDelete(`/api/prefect/tasks/${taskUuid}/`);
}

// Fetch flow run status (for polling during deployment execution)
export async function fetchFlowRunStatus(flowRunId: string): Promise<string> {
  try {
    const flowRun: PrefectFlowRun = await apiGet(`/api/prefect/flow_runs/${flowRunId}`);
    return flowRun?.state_type || 'FAILED';
  } catch {
    return 'FAILED';
  }
}

// Poll task status
export function useTaskStatus(taskId: string | null, hashkey: string = 'run-dbt-commands') {
  const orgSlug = typeof window !== 'undefined' ? localStorage.getItem('org-slug') : null;
  const computedHashkey = `${hashkey}-${orgSlug}`;

  const url = taskId ? `/api/tasks/${taskId}?hashkey=${computedHashkey}` : null;

  return useSWR<{ progress: TaskProgress[] }>(url, apiGet, {
    refreshInterval: (data) => {
      if (!data) return TASK_STATUS_POLL_INTERVAL_MS;
      const latest = data.progress?.[data.progress.length - 1];
      if (['completed', 'failed'].includes(latest?.status)) {
        return 0;
      }
      return TASK_STATUS_POLL_INTERVAL_MS;
    },
    revalidateOnFocus: false,
  });
}
