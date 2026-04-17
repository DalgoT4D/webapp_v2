import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type { Connection, ConnectionSyncJob, SchemaChange } from '@/types/connections';
import {
  CONNECTION_API,
  SYNC_HISTORY_PAGE_SIZE,
  TASK_PROGRESS_POLL_INTERVAL_MS,
} from '@/constants/connections';

// ============ SWR Read Hooks ============

/** All connections with smart polling (polls when any connection has a lock) */
export function useConnectionsList() {
  const { data, error, mutate, isLoading } = useSWR<Connection[]>(
    CONNECTION_API.CONNECTIONS,
    apiGet,
    {
      revalidateOnFocus: false,
      refreshInterval: (latestData) => {
        const connections = latestData as Connection[] | undefined;
        if (connections?.some((c) => c.lock !== null)) {
          return 3000;
        }
        return 0;
      },
    }
  );
  return { data: data || [], isLoading, isError: error, mutate };
}

/** Single connection detail */
export function useConnection(connectionId: string | null) {
  const { data, error, mutate, isLoading } = useSWR<Connection>(
    connectionId ? `${CONNECTION_API.CONNECTIONS}/${connectionId}` : null,
    apiGet,
    { revalidateOnFocus: false }
  );
  return { data, isLoading, isError: error, mutate };
}

/** Pending schema changes */
export function useSchemaChanges() {
  const { data, error, mutate, isLoading } = useSWR<SchemaChange[]>(
    CONNECTION_API.SCHEMA_CHANGES,
    apiGet,
    { revalidateOnFocus: false }
  );
  return { data: data || [], isLoading, isError: error, mutate };
}

/** Paginated sync history */
export function useSyncHistory(
  connectionId: string | null,
  offset: number = 0,
  limit: number = SYNC_HISTORY_PAGE_SIZE
) {
  const { data, error, mutate, isLoading } = useSWR<{
    history: ConnectionSyncJob[];
    totalSyncs: number;
  }>(
    connectionId
      ? `${CONNECTION_API.CONNECTIONS}/${connectionId}/sync/history?limit=${limit}&offset=${offset}`
      : null,
    apiGet,
    { revalidateOnFocus: false }
  );
  return {
    syncJobs: data?.history || [],
    totalSyncs: data?.totalSyncs || 0,
    isLoading,
    isError: error,
    mutate,
  };
}

interface TaskProgressMessage {
  status: string;
  message?: string;
  result?: unknown;
}

interface TaskProgressResponse {
  progress: TaskProgressMessage[];
}

/** Poll async task status — reads the last item in the `progress` array */
export function useTaskProgress(taskId: string | null) {
  const { data, error, isLoading } = useSWR<TaskProgressResponse>(
    taskId ? `/api/tasks/stp/${taskId}` : null,
    apiGet,
    {
      refreshInterval: (latestData) => {
        const messages = latestData?.progress;
        const lastStatus = messages?.[messages.length - 1]?.status;
        if (lastStatus === 'completed' || lastStatus === 'failed') {
          return 0;
        }
        return TASK_PROGRESS_POLL_INTERVAL_MS;
      },
      revalidateOnFocus: false,
    }
  );
  const lastMessage = data?.progress?.[data.progress.length - 1];
  return {
    progress: lastMessage,
    isComplete: lastMessage?.status === 'completed',
    isFailed: lastMessage?.status === 'failed',
    isLoading,
    isError: error,
  };
}

// ============ Mutation Functions ============

export async function createConnection(payload: {
  name: string;
  sourceId: string;
  destinationSchema?: string;
  streams: unknown[];
  normalize: boolean;
  syncCatalog?: unknown;
  catalogId?: string;
}): Promise<Connection> {
  return apiPost(`${CONNECTION_API.CONNECTIONS}/`, payload);
}

export async function updateConnection(
  connectionId: string,
  payload: {
    name: string;
    sourceId?: string;
    streams: unknown[];
    normalize: boolean;
    destinationSchema?: string;
    syncCatalog?: unknown;
    catalogId?: string;
  }
): Promise<Connection> {
  return apiPut(`${CONNECTION_API.CONNECTIONS}/${connectionId}/update`, payload);
}

export async function deleteConnection(connectionId: string): Promise<void> {
  return apiDelete(`${CONNECTION_API.CONNECTIONS}/${connectionId}`);
}

export async function triggerSync(deploymentId: string): Promise<{ flow_run_id: string }> {
  return apiPost(`/api/prefect/v1/flows/${deploymentId}/flow_run/`, {});
}

export async function cancelQueuedSync(flowRunId: string): Promise<void> {
  return apiPost(`/api/prefect/flow_runs/${flowRunId}/set_state`, {
    state: { name: 'Cancelling', type: 'CANCELLING' },
    force: true,
  });
}

export async function refreshConnectionCatalog(connectionId: string): Promise<{ task_id: string }> {
  return apiGet(`${CONNECTION_API.CONNECTIONS}/${connectionId}/catalog`);
}

export async function clearAllStreams(
  clearConnDeploymentId: string
): Promise<{ flow_run_id: string }> {
  return apiPost(`/api/prefect/v1/flows/${clearConnDeploymentId}/flow_run/`, {});
}

export async function clearSelectedStreams(
  clearConnDeploymentId: string,
  connectionId: string,
  streams: { streamName: string; streamNamespace?: string }[]
): Promise<{ flow_run_id: string }> {
  return apiPost(`/api/prefect/v1/flows/${clearConnDeploymentId}/clear_streams/`, {
    connectionId,
    streams,
  });
}

export async function scheduleSchemaUpdate(connectionId: string, payload: unknown): Promise<void> {
  return apiPost(`${CONNECTION_API.CONNECTIONS}/${connectionId}/schema_update/schedule`, payload);
}

export async function fetchSyncLogs(jobId: number, attemptNumber: number): Promise<string[]> {
  return apiGet(`/api/airbyte/v1/logs?job_id=${jobId}&attempt_number=${attemptNumber}`);
}

export async function fetchFlowRunStatus(
  flowRunId: string
): Promise<{ state_type: string; state_name: string }> {
  return apiGet(`/api/prefect/flow_runs/${flowRunId}`);
}

interface PrefectFlowRunLog {
  level: number;
  timestamp: string;
  message: string;
}

export async function fetchFlowRunLogs(
  flowRunId: string
): Promise<{ logs: { logs: PrefectFlowRunLog[] } }> {
  return apiGet(`/api/prefect/flow_runs/${flowRunId}/logs`);
}

/** Extract log message strings from the nested Prefect flow run logs response */
export function extractFlowRunLogMessages(response: {
  logs: { logs: PrefectFlowRunLog[] };
}): string[] {
  return response?.logs?.logs?.map((log) => log.message) ?? [];
}

export async function triggerLogSummary(
  connectionId: string,
  jobId: number,
  attemptNumber: number
): Promise<{ task_id: string }> {
  return apiGet(
    `${CONNECTION_API.CONNECTIONS}/${connectionId}/logsummary?job_id=${jobId}&attempt_number=${attemptNumber}`
  );
}
