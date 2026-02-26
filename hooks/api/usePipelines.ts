import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import {
  Pipeline,
  TransformTask,
  Connection,
  DeploymentRun,
  PipelineDetailResponse,
  TaskProgressResponse,
  DashboardPipeline,
} from '@/types/pipeline';
import {
  POLLING_INTERVAL_WHEN_LOCKED,
  POLLING_INTERVAL_IDLE,
  DEFAULT_LOAD_MORE_LIMIT,
  FLOW_RUN_LOGS_OFFSET_LIMIT,
} from '@/constants/pipeline';

/**
 * Fetch all pipelines with smart polling
 * Polling is active (3s) when any pipeline is locked/running
 * Polling is idle (0) when all pipelines are complete
 */
export function usePipelines() {
  const { data, error, mutate, isLoading } = useSWR<Pipeline[]>('/api/prefect/v1/flows/', apiGet, {
    refreshInterval: (latestData) => {
      // Enable polling when any pipeline has a lock
      const hasLockedPipeline = latestData?.some((p) => p.lock);
      return hasLockedPipeline ? POLLING_INTERVAL_WHEN_LOCKED : POLLING_INTERVAL_IDLE; // when locked refresh interval value is 3 seconds and at last 0 hence polling stops.
    },
    revalidateOnFocus: false,
  });

  return {
    pipelines: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

/**
 * Fetch a single pipeline by ID
 */
export function usePipeline(deploymentId: string | null) {
  const { data, error, mutate, isLoading } = useSWR<PipelineDetailResponse>(
    deploymentId ? `/api/prefect/v1/flows/${deploymentId}` : null,
    apiGet,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    pipeline: data,
    isLoading,
    isError: error,
    mutate,
  };
}

/**
 * Fetch all transform tasks
 */
export function useTransformTasks() {
  const { data, error, mutate, isLoading } = useSWR<TransformTask[]>(
    '/api/prefect/tasks/transform/',
    apiGet,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    tasks: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

/**
 * Fetch all connections for pipeline creation
 */
export function useConnections() {
  const { data, error, mutate, isLoading } = useSWR<Connection[]>(
    '/api/airbyte/v1/connections',
    apiGet,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    connections: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

/**
 * Fetch pipeline run history with pagination
 */
export function usePipelineHistory(
  deploymentId: string | null,
  offset: number = 0,
  limit: number = DEFAULT_LOAD_MORE_LIMIT
) {
  const { data, error, mutate, isLoading } = useSWR<DeploymentRun[]>(
    deploymentId
      ? `/api/prefect/v1/flows/${deploymentId}/flow_runs/history?limit=${limit}&offset=${offset}`
      : null,
    apiGet,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    runs: data || [],
    isLoading,
    isError: error,
    mutate,
    hasMore: data ? data.length >= limit : false,
  };
}

// ============ Mutation Functions ============

/**
 * Create a new pipeline
 */
export async function createPipeline(data: {
  name: string;
  connections: { id: string; seq: number }[];
  cron: string;
  transformTasks: { uuid: string; seq: number }[];
}): Promise<{ name: string }> {
  return apiPost('/api/prefect/v1/flows/', data);
}

/**
 * Update an existing pipeline
 */
export async function updatePipeline(
  deploymentId: string,
  data: {
    name: string;
    connections: { id: string; seq: number }[];
    cron: string;
    transformTasks: { uuid: string; seq: number }[];
  }
): Promise<void> {
  return apiPut(`/api/prefect/v1/flows/${deploymentId}`, data);
}

/**
 * Delete a pipeline
 */
export async function deletePipeline(deploymentId: string): Promise<{ success: boolean }> {
  return apiDelete(`/api/prefect/v1/flows/${deploymentId}`);
}

/**
 * Trigger a manual pipeline run
 */
export async function triggerPipelineRun(deploymentId: string): Promise<void> {
  return apiPost(`/api/prefect/v1/flows/${deploymentId}/flow_run/`, {});
}

/**
 * Set pipeline schedule status (active/inactive)
 */
export async function setScheduleStatus(deploymentId: string, active: boolean): Promise<void> {
  return apiPost(
    `/api/prefect/flows/${deploymentId}/set_schedule/${active ? 'active' : 'inactive'}`,
    {}
  );
}

/**
 * Fetch flow run logs with pagination
 */
export async function fetchFlowRunLogs(
  flowRunId: string,
  taskRunId?: string,
  offset: number = 0,
  limit: number = FLOW_RUN_LOGS_OFFSET_LIMIT
): Promise<{
  logs: { logs: { message: string }[] };
}> {
  const params = new URLSearchParams({
    offset: Math.max(offset, 0).toString(),
    limit: limit.toString(),
  });

  if (taskRunId) {
    params.append('task_run_id', taskRunId);
  }

  return apiGet(`/api/prefect/flow_runs/${flowRunId}/logs?${params.toString()}`);
}

/**
 * Trigger log summary generation (for pipeline run history modal)
 */
export async function triggerLogSummary(
  flowRunId: string,
  taskId: string
): Promise<{ task_id: string }> {
  return apiGet(`/api/prefect/v1/flow_runs/${flowRunId}/logsummary?task_id=${taskId}`);
}

/**
 * Fetch log summaries for a flow run (for pipeline overview page)
 * Returns pre-computed summaries if available
 */
export async function fetchFlowRunLogSummary(flowRunId: string): Promise<any[]> {
  return apiGet(`/api/prefect/flow_runs/${flowRunId}/logsummary`);
}

/**
 * Poll for task run status (used for AI summary)
 */
export function useLogSummaryPoll(taskId: string | null) {
  const { data, error } = useSWR<TaskProgressResponse>(
    taskId ? `/api/tasks/stp/${taskId}` : null,
    apiGet,
    {
      refreshInterval: (latestData) => {
        if (!latestData) return POLLING_INTERVAL_WHEN_LOCKED;
        const lastMessage = latestData.progress[latestData.progress.length - 1];
        return ['completed', 'failed'].includes(lastMessage?.status)
          ? POLLING_INTERVAL_IDLE
          : POLLING_INTERVAL_WHEN_LOCKED;
      },
      revalidateOnFocus: false,
    }
  );

  const lastMessage = data?.progress?.[data.progress.length - 1];
  const isComplete = !!lastMessage && ['completed', 'failed'].includes(lastMessage.status);

  const summary =
    isComplete && lastMessage.result && lastMessage.result.length > 0
      ? lastMessage.result.map((r) => r.response).join('\n\n')
      : isComplete
        ? 'No summary available'
        : null;

  return {
    summary,
    isPolling: !!taskId && !isComplete,
    isComplete,
    error,
  };
}

/**
 * Fetch pipeline overview data for the /pipeline page
 * Uses smart polling: active (3s) when any pipeline is locked/running
 */
export function usePipelineOverview() {
  const { data, error, mutate, isLoading } = useSWR<DashboardPipeline[]>(
    '/api/dashboard/v1',
    apiGet,
    {
      refreshInterval: (latestData) => {
        const hasLockedPipeline = latestData?.some((p) => p.lock);
        return hasLockedPipeline ? POLLING_INTERVAL_WHEN_LOCKED : POLLING_INTERVAL_IDLE;
      },
      revalidateOnFocus: false,
    }
  );

  return {
    pipelines: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}
