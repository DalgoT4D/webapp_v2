// Hook that checks for running tasks on mount and resumes polling when
// the browser tab regains visibility.

import { useEffect, useRef } from 'react';
import { useWorkflowExecution } from '@/hooks/api/useWorkflowExecution';
import { useTransformStore } from '@/stores/transformStore';

interface UseRunningTasksMonitorParams {
  isPreview: boolean;
}

export function useRunningTasksMonitor({ isPreview }: UseRunningTasksMonitorParams) {
  const hasCheckedRunningTasks = useRef(false);
  const { setSelectedLowerTab } = useTransformStore();

  const {
    logs: workflowLogs,
    isRunning: isWorkflowRunning,
    checkRunningTasks,
    resumePolling,
  } = useWorkflowExecution();

  // Sync workflow logs to store for LowerSectionTabs
  const { setDbtRunLogs } = useTransformStore();
  useEffect(() => {
    if (workflowLogs.length > 0) {
      setDbtRunLogs(workflowLogs);
    }
  }, [workflowLogs, setDbtRunLogs]);

  // Check for any running processes on mount (dbt jobs, sync sources)
  // If found, resumePolling will lock the canvas; otherwise leave it unlocked
  useEffect(() => {
    if (hasCheckedRunningTasks.current || isPreview) return;
    hasCheckedRunningTasks.current = true;

    const checkForRunningProcesses = async () => {
      try {
        const runningTaskId = await checkRunningTasks();
        if (runningTaskId) {
          // Found a running task — resumePolling sets lockUpperSection(true) internally
          setSelectedLowerTab('logs');
          await resumePolling(runningTaskId);
        }
      } catch {
        // API failed — nothing to do
      }
    };
    checkForRunningProcesses();
  }, [checkRunningTasks, resumePolling, setSelectedLowerTab, isPreview]);

  // Re-check for running tasks when tab regains visibility
  // Handles: user starts workflow, switches tab, comes back — polling needs to resume
  useEffect(() => {
    if (isPreview) return undefined;

    const handleVisibilityChange = () => {
      if (document.hidden || isWorkflowRunning) return;

      const recheck = async () => {
        const runningTaskId = await checkRunningTasks();
        if (runningTaskId) {
          setSelectedLowerTab('logs');
          await resumePolling(runningTaskId);
        }
      };
      recheck();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPreview, isWorkflowRunning, checkRunningTasks, resumePolling, setSelectedLowerTab]);

  return {
    isWorkflowRunning,
  };
}
