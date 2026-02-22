/**
 * Pipeline Hooks - Comprehensive Tests
 */

import { renderHook, act } from '@testing-library/react';
import useSWR from 'swr';
import { useSyncLock } from '../useSyncLock';
import {
  usePipelines,
  usePipeline,
  useTransformTasks,
  useConnections,
  usePipelineHistory,
  createPipeline,
  updatePipeline,
  deletePipeline,
  triggerPipelineRun,
  setScheduleStatus,
  fetchFlowRunLogs,
  triggerLogSummary,
} from '../api/usePipelines';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { TaskLock } from '@/types/pipeline';

jest.mock('swr');
jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiPut: jest.fn(),
  apiDelete: jest.fn(),
}));

describe('useSyncLock Hook', () => {
  it('manages optimistic UI state through lock lifecycle', () => {
    const runningLock: TaskLock = {
      lockedBy: 'user@example.com',
      lockedAt: new Date().toISOString(),
      status: 'running',
    };

    // Initial state
    const { result, rerender } = renderHook(({ lock }) => useSyncLock(lock), {
      initialProps: { lock: null as TaskLock | null },
    });
    expect(result.current.tempSyncState).toBe(false);

    // User clicks run button
    act(() => result.current.setTempSyncState(true));
    expect(result.current.tempSyncState).toBe(true);

    // Lock appears from polling (running)
    rerender({ lock: runningLock });
    expect(result.current.tempSyncState).toBe(true);

    // Pipeline completes, lock becomes null
    rerender({ lock: null });
    expect(result.current.tempSyncState).toBe(false);
  });

  it('handles all lock status transitions', () => {
    const { result, rerender } = renderHook(({ lock }) => useSyncLock(lock), {
      initialProps: { lock: null as TaskLock | null },
    });

    act(() => result.current.setTempSyncState(true));

    // Test queued -> running -> complete -> null
    const statuses: Array<TaskLock['status']> = ['queued', 'running', 'complete'];
    statuses.forEach((status) => {
      rerender({ lock: { lockedBy: 'user@test.com', lockedAt: new Date().toISOString(), status } });
      expect(result.current.tempSyncState).toBe(true);
    });

    rerender({ lock: null });
    expect(result.current.tempSyncState).toBe(false);
  });
});

describe('SWR Pipeline Hooks', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches pipelines with smart polling configuration', () => {
    const mockData = [{ name: 'Pipeline 1', deploymentId: 'dep-1', lock: null as TaskLock | null }];
    (useSWR as jest.Mock).mockReturnValue({
      data: mockData,
      error: null,
      mutate: jest.fn(),
      isLoading: false,
    });

    const { result } = renderHook(() => usePipelines());

    expect(useSWR).toHaveBeenCalledWith(
      '/api/prefect/v1/flows/',
      apiGet,
      expect.objectContaining({
        revalidateOnFocus: false,
      })
    );
    expect(result.current.pipelines).toEqual(mockData);
    expect(result.current.isLoading).toBe(false);

    // Returns empty array when data is null
    (useSWR as jest.Mock).mockReturnValue({
      data: null,
      error: null,
      mutate: jest.fn(),
      isLoading: false,
    });
    const { result: result2 } = renderHook(() => usePipelines());
    expect(result2.current.pipelines).toEqual([]);
  });

  it('fetches single pipeline, tasks, connections, and history', () => {
    (useSWR as jest.Mock).mockReturnValue({
      data: { name: 'Test' },
      error: null,
      mutate: jest.fn(),
      isLoading: false,
    });

    // usePipeline
    renderHook(() => usePipeline('dep-id'));
    expect(useSWR).toHaveBeenCalledWith('/api/prefect/v1/flows/dep-id', apiGet, expect.any(Object));

    // usePipeline with null
    renderHook(() => usePipeline(null));
    expect(useSWR).toHaveBeenCalledWith(null, apiGet, expect.any(Object));

    // useTransformTasks
    renderHook(() => useTransformTasks());
    expect(useSWR).toHaveBeenCalledWith(
      '/api/prefect/tasks/transform/',
      apiGet,
      expect.any(Object)
    );

    // useConnections
    renderHook(() => useConnections());
    expect(useSWR).toHaveBeenCalledWith('/api/airbyte/v1/connections', apiGet, expect.any(Object));

    // usePipelineHistory with pagination
    renderHook(() => usePipelineHistory('dep-id', 10, 5));
    expect(useSWR).toHaveBeenCalledWith(
      '/api/prefect/v1/flows/dep-id/flow_runs/history?limit=5&offset=10',
      apiGet,
      expect.any(Object)
    );
  });

  it('calculates hasMore correctly for pagination', () => {
    // Has more when data.length >= limit
    (useSWR as jest.Mock).mockReturnValue({
      data: [{ id: '1' }, { id: '2' }, { id: '3' }],
      error: null,
      mutate: jest.fn(),
      isLoading: false,
    });
    const { result } = renderHook(() => usePipelineHistory('dep-id', 0, 3));
    expect(result.current.hasMore).toBe(true);

    // No more when data.length < limit
    (useSWR as jest.Mock).mockReturnValue({
      data: [{ id: '1' }, { id: '2' }],
      error: null,
      mutate: jest.fn(),
      isLoading: false,
    });
    const { result: result2 } = renderHook(() => usePipelineHistory('dep-id', 0, 3));
    expect(result2.current.hasMore).toBe(false);
  });
});

describe('Pipeline Mutation Functions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('performs all CRUD operations correctly', async () => {
    // Create
    (apiPost as jest.Mock).mockResolvedValue({ name: 'New Pipeline' });
    const createResult = await createPipeline({
      name: 'New Pipeline',
      connections: [{ id: 'conn-1', seq: 1 }],
      cron: '0 9 * * *',
      transformTasks: [{ uuid: 'task-1', seq: 1 }],
    });
    expect(apiPost).toHaveBeenCalledWith('/api/prefect/v1/flows/', expect.any(Object));
    expect(createResult.name).toBe('New Pipeline');

    // Update
    (apiPut as jest.Mock).mockResolvedValue({});
    await updatePipeline('dep-id', {
      name: 'Updated',
      connections: [],
      cron: '',
      transformTasks: [],
    });
    expect(apiPut).toHaveBeenCalledWith('/api/prefect/v1/flows/dep-id', expect.any(Object));

    // Delete
    (apiDelete as jest.Mock).mockResolvedValue({ success: true });
    const deleteResult = await deletePipeline('dep-id');
    expect(apiDelete).toHaveBeenCalledWith('/api/prefect/v1/flows/dep-id');
    expect(deleteResult.success).toBe(true);

    // Trigger run
    (apiPost as jest.Mock).mockResolvedValue({});
    await triggerPipelineRun('dep-id');
    expect(apiPost).toHaveBeenCalledWith('/api/prefect/v1/flows/dep-id/flow_run/', {});

    // Set schedule status
    await setScheduleStatus('dep-id', true);
    expect(apiPost).toHaveBeenCalledWith('/api/prefect/flows/dep-id/set_schedule/active', {});
    await setScheduleStatus('dep-id', false);
    expect(apiPost).toHaveBeenCalledWith('/api/prefect/flows/dep-id/set_schedule/inactive', {});
  });

  it('fetches logs and handles AI summary', async () => {
    // Fetch logs with and without task_run_id
    (apiGet as jest.Mock).mockResolvedValue({ logs: { logs: [{ message: 'test' }] } });

    await fetchFlowRunLogs('flow-id', 'task-id', 0, 100);
    expect(apiGet).toHaveBeenCalledWith(
      '/api/prefect/flow_runs/flow-id/logs?offset=0&limit=100&task_run_id=task-id'
    );

    await fetchFlowRunLogs('flow-id', undefined, -10, 100); // negative offset becomes 0
    expect(apiGet).toHaveBeenCalledWith('/api/prefect/flow_runs/flow-id/logs?offset=0&limit=100');

    // Trigger log summary
    (apiGet as jest.Mock).mockResolvedValue({ task_id: 'summary-1' });
    const summaryResult = await triggerLogSummary('flow-id', 'task-id');
    expect(apiGet).toHaveBeenCalledWith(
      '/api/prefect/v1/flow_runs/flow-id/logsummary?task_id=task-id'
    );
    expect(summaryResult.task_id).toBe('summary-1');

    // pollTaskStatus replaced by useLogSummaryPoll SWR hook
  });
});
