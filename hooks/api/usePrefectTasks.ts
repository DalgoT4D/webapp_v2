// hooks/api/usePrefectTasks.ts
'use client';

import useSWR from 'swr';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import type { TransformTask, PrefectFlowRun, TaskProgress } from '@/types/transform';

// Fetch transform tasks
export function usePrefectTasks() {
  return useSWR<TransformTask[]>('/api/prefect/tasks/transform/', apiGet, {
    refreshInterval: (data) => {
      // Poll every 3 seconds if any task is locked
      if (data?.some((task) => task.lock)) {
        return 3000;
      }
      return 0; // Don't poll if no tasks are locked
    },
    revalidateOnFocus: false,
  });
}

// Run a Prefect deployment (mutation)
export async function runPrefectDeployment(deploymentId: string) {
  return apiPost(`/api/prefect/v1/flows/${deploymentId}/flow_run/`, {});
}

// Delete a Prefect task (mutation)
export async function deletePrefectTask(taskUuid: string) {
  return apiDelete(`/api/prefect/tasks/${taskUuid}`);
}

// Poll task status
export function useTaskStatus(taskId: string | null, hashkey: string = 'run-dbt-commands') {
  const orgSlug = typeof window !== 'undefined' ? localStorage.getItem('org-slug') : null;
  const computedHashkey = `${hashkey}-${orgSlug}`;

  const url = taskId ? `/api/tasks/${taskId}?hashkey=${computedHashkey}` : null;

  return useSWR<{ progress: TaskProgress[] }>(url, apiGet, {
    refreshInterval: (data) => {
      if (!data) return 2000;
      const latest = data.progress?.[data.progress.length - 1];
      if (['completed', 'failed'].includes(latest?.status)) {
        return 0; // Stop polling
      }
      return 2000; // Continue polling every 2 seconds
    },
    revalidateOnFocus: false,
  });
}
