// hooks/api/useWorkflowExecution.ts
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { useTransformStore } from '@/stores/transformStore';
import { useAuthStore } from '@/stores/authStore';
import type { TaskProgressLog, TransformTask } from '@/types/transform';

const POLL_INTERVAL = 2000; // 2 seconds

export type RunType = 'run' | 'run-to-node' | 'run-from-node';

export interface RunWorkflowParams {
  /** Run type: 'run', 'run-to-node', 'run-from-node' */
  run_type: RunType;
  /** Target node UUID (for run-to/from) */
  target_node?: string;
}

interface RunWorkflowResponse {
  task_id: string;
}

interface TaskProgressResponse {
  progress: TaskProgressLog[];
}

interface UseWorkflowExecutionReturn {
  /** Current task logs */
  logs: TaskProgressLog[];
  /** Whether workflow is running */
  isRunning: boolean;
  /** Current task ID */
  taskId: string | null;
  /** Run workflow */
  runWorkflow: (params: RunWorkflowParams) => Promise<void>;
  /** Check for existing running tasks */
  checkRunningTasks: () => Promise<string | null>;
  /** Clear logs */
  clearLogs: () => void;
  /** Resume polling for an existing task */
  resumePolling: (taskId: string) => Promise<void>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useWorkflowExecution(): UseWorkflowExecutionReturn {
  const selectedOrgSlug = useAuthStore((s) => s.selectedOrgSlug);
  const setLockUpperSection = useTransformStore((s) => s.setLockUpperSection);
  const setSelectedLowerTab = useTransformStore((s) => s.setSelectedLowerTab);
  const setWorkflowRunning = useTransformStore((s) => s.setWorkflowRunning);
  const setCurrentTaskId = useTransformStore((s) => s.setCurrentTaskId);
  const triggerRefresh = useTransformStore((s) => s.triggerRefresh);

  const [logs, setLogs] = useState<TaskProgressLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);

  const pollingRef = useRef(false);
  const abortRef = useRef(false);
  const unmountedRef = useRef(false);

  // Abort polling on unmount so the finally block doesn't clear store state
  // that a new component instance is managing
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      abortRef.current = true;
    };
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const pollTaskProgress = useCallback(
    async (taskIdToPoll: string): Promise<void> => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      abortRef.current = false;

      const hashKey = `run-dbt-commands-${selectedOrgSlug}`;

      try {
        while (!abortRef.current) {
          const response = await apiGet<TaskProgressResponse>(
            `/api/tasks/${taskIdToPoll}?hashkey=${hashKey}`
          );

          if (response?.progress) {
            // Add client-side timestamp when backend doesn't provide one
            const now = new Date().toISOString();
            const logsWithTimestamps = response.progress.map((log: TaskProgressLog) => ({
              ...log,
              timestamp: log.timestamp || now,
            }));
            if (!unmountedRef.current) {
              setLogs(logsWithTimestamps);
            }

            const lastLog = response.progress[response.progress.length - 1];
            if (lastLog?.status === 'completed' || lastLog?.status === 'failed') {
              break;
            }
          }

          await delay(POLL_INTERVAL);
        }
      } catch (error) {
        if (!unmountedRef.current) {
          console.error('Error polling task progress:', error);
          setLogs((prev) => [
            ...prev,
            {
              message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              status: 'failed',
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      } finally {
        pollingRef.current = false;
        // Only clear store state if component is still mounted
        // If unmounted, a new instance will manage the lock state
        if (!unmountedRef.current) {
          setIsRunning(false);
          setWorkflowRunning(false);
          setTaskId(null);
          setCurrentTaskId(null);
          setLockUpperSection(false);
          triggerRefresh();
        }
      }
    },
    [selectedOrgSlug, setLockUpperSection, setWorkflowRunning, setCurrentTaskId, triggerRefresh]
  );

  const runWorkflow = useCallback(
    async (params: RunWorkflowParams): Promise<void> => {
      setIsRunning(true);
      setWorkflowRunning(true);
      setLockUpperSection(true);
      setSelectedLowerTab('logs');
      clearLogs();

      try {
        const response = await apiPost<RunWorkflowResponse>('/api/dbt/run_dbt_via_celery/', params);

        if (response?.task_id) {
          setTaskId(response.task_id);
          setCurrentTaskId(response.task_id);
          // Wait a bit before starting to poll
          await delay(POLL_INTERVAL);
          await pollTaskProgress(response.task_id);
        }
      } catch (error) {
        setIsRunning(false);
        setWorkflowRunning(false);
        setLockUpperSection(false);
        throw error;
      }
    },
    [
      setLockUpperSection,
      setSelectedLowerTab,
      setWorkflowRunning,
      setCurrentTaskId,
      clearLogs,
      pollTaskProgress,
    ]
  );

  const checkRunningTasks = useCallback(async (): Promise<string | null> => {
    try {
      const tasks = await apiGet<TransformTask[]>('/api/prefect/tasks/transform/');

      for (const task of tasks) {
        if (task.lock?.celeryTaskId) {
          return task.lock.celeryTaskId;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to check running tasks:', error);
      return null;
    }
  }, []);

  const resumePolling = useCallback(
    async (existingTaskId: string): Promise<void> => {
      setIsRunning(true);
      setWorkflowRunning(true);
      setLockUpperSection(true);
      setSelectedLowerTab('logs');
      setTaskId(existingTaskId);
      setCurrentTaskId(existingTaskId);

      await pollTaskProgress(existingTaskId);
    },
    [
      setLockUpperSection,
      setSelectedLowerTab,
      setWorkflowRunning,
      setCurrentTaskId,
      pollTaskProgress,
    ]
  );

  return {
    logs,
    isRunning,
    taskId,
    runWorkflow,
    checkRunningTasks,
    clearLogs,
    resumePolling,
  };
}
