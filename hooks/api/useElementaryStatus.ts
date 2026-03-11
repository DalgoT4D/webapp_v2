import useSWR from 'swr';
import { apiGet, apiPost } from '@/lib/api';
import {
  ElementarySetupStatusResponse,
  ElementaryReportTokenResponse,
  ElementaryRefreshResponse,
  ElementaryStatus,
  GitPullResponse,
  ElementaryProfileResponse,
  CreateTrackingTablesResponse,
  EdrDeploymentResponse,
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
 * Pull latest dbt changes from git
 */
export async function gitPull(): Promise<GitPullResponse> {
  return apiPost('/api/dbt/git_pull/', {});
}

/**
 * Check dbt files for Elementary config (packages.yml, dbt_project.yml)
 */
export async function checkDbtFiles(): Promise<ElementaryStatus> {
  return apiGet('/api/dbt/check-dbt-files');
}

/**
 * Create Elementary credentials profile
 */
export async function createElementaryProfile(): Promise<ElementaryProfileResponse> {
  return apiPost('/api/dbt/create-elementary-profile/', {});
}

/**
 * Start async task to create Elementary tracking tables
 */
export async function createElementaryTrackingTables(): Promise<CreateTrackingTablesResponse> {
  return apiPost('/api/dbt/create-elementary-tracking-tables/', {});
}

/**
 * Create EDR (Elementary Data Reliability) deployment in Prefect
 */
export async function createEdrDeployment(): Promise<EdrDeploymentResponse> {
  return apiPost('/api/dbt/create-edr-deployment/', {});
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
 * Poll for async task progress (used during tracking table creation)
 */
export async function pollTaskProgress(
  taskId: string,
  hashKey: string
): Promise<TaskProgressResponse> {
  return apiGet(`/api/tasks/${taskId}?hashkey=${hashKey}`);
}
