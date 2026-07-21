import useSWR from 'swr';
import { apiGet, apiPost } from '@/lib/api';
import {
  ElementarySetupStatusResponse,
  ElementaryReportTokenResponse,
  ElementaryRefreshResponse,
  ElementaryCheckResponse,
  ElementaryInstallResponse,
  ElementaryLockResponse,
  TaskProgressResponse,
} from '@/types/data-quality';

// ============ SWR Read Hook ============

/**
 * Fetch Elementary setup status with SWR caching.
 * Drives the top-level state machine (loading → set-up | not-set-up | error).
 */
export function useElementaryStatus() {
  const { data, error, mutate, isLoading } = useSWR<ElementarySetupStatusResponse>(
    '/api/dbt/elementary-setup-status',
    apiGet,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  return {
    status: data?.status ?? null,
    isLoading,
    isError: error,
    mutate,
  };
}

// ============ Mutation Functions ============

/**
 * Preflight check: pull latest dbt code + verify elementary config exists in
 * packages.yml and dbt_project.yml. Returns either `ready` or
 * `needs_repo_changes` with the exists/missing snippets.
 */
export async function elementaryCheck(): Promise<ElementaryCheckResponse> {
  return apiPost('/api/dbt/elementary/check', {});
}

/**
 * Kick off the consolidated Elementary install celery task. Returns a task
 * handle to poll via `pollTaskProgress`.
 */
export async function elementaryInstall(): Promise<ElementaryInstallResponse> {
  return apiPost('/api/dbt/elementary/install', {});
}

/**
 * Fetch the Elementary report token and generation timestamp
 */
export async function fetchElementaryReport(): Promise<ElementaryReportTokenResponse> {
  return apiPost('/api/dbt/fetch-elementary-report/', {});
}

/**
 * Trigger regeneration of the Elementary report
 */
export async function refreshElementaryReport(): Promise<ElementaryRefreshResponse> {
  return apiPost('/api/dbt/v1/refresh-elementary-report/', {});
}

/**
 * Check if a Prefect lock exists for Elementary report generation
 */
export async function checkElementaryLock(): Promise<ElementaryLockResponse> {
  return apiGet('/api/prefect/tasks/elementary-lock/');
}

/**
 * Poll for async task progress (used during install to render step list)
 */
export async function pollTaskProgress(
  taskId: string,
  hashKey: string
): Promise<TaskProgressResponse> {
  return apiGet(`/api/tasks/${taskId}?hashkey=${hashKey}`);
}
