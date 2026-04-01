// Hook that handles canvas action dispatch (delete-node, run-workflow, sync-sources, etc.)
// and the sync-sources polling logic.

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSWRConfig } from 'swr';
import { useTransformStore, useCanvasAction } from '@/stores/transformStore';
import { useCanvasSources } from '@/hooks/api/useCanvasSources';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import type { RunWorkflowParams } from '@/hooks/api/useWorkflowExecution';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { CANVAS_GRAPH_KEY } from '@/hooks/api/useCanvasGraph';
import { CanvasNodeTypeEnum } from '@/types/transform';
import { apiGet } from '@/lib/api';
import { toastSuccess, toastError } from '@/lib/toast';
import { CANVAS_CONSTANTS } from '@/constants/transform';
import { TaskProgressStatus } from '@/constants/pipeline';

interface UseCanvasActionsParams {
  isPreview: boolean;
  /** Shared runWorkflow function from the single useWorkflowExecution instance */
  runWorkflow: (params: RunWorkflowParams) => Promise<void>;
}

export function useCanvasActions({ isPreview, runWorkflow }: UseCanvasActionsParams) {
  const [isSyncing, setIsSyncing] = useState(false);

  const { mutate } = useSWRConfig();
  const canvasAction = useCanvasAction();

  const {
    clearCanvasAction,
    openOperationPanel,
    setTempLockCanvas,
    setSelectedLowerTab,
    setLockUpperSection,
    setDbtRunLogs,
  } = useTransformStore();

  const { refresh: refreshSources, syncSources } = useCanvasSources();
  const { deleteOperationNode } = useCanvasOperations();
  const { hasPermission } = useUserPermissions();

  // Handle sync sources — locks upper section, polls progress into logs pane
  const handleSyncSources = useCallback(async () => {
    setIsSyncing(true);
    setLockUpperSection(true);
    setSelectedLowerTab('logs');
    setDbtRunLogs([]);

    const POLL_INTERVAL_MS = CANVAS_CONSTANTS.SYNC_POLL_INTERVAL;

    try {
      const { taskId, hashKey } = await syncSources();

      // Poll for task progress
      let isComplete = false;
      while (!isComplete) {
        try {
          const response = await apiGet(`/api/tasks/${taskId}?hashkey=${hashKey}`);

          if (response?.progress) {
            const now = new Date().toISOString();
            const progressItems = response.progress as Array<{
              message?: string;
              status?: string;
              timestamp?: string;
            }>;
            const logs = progressItems.map((log) => ({
              message: log.message || '',
              status: log.status || 'running',
              timestamp: log.timestamp || now,
            }));
            setDbtRunLogs(logs);

            const lastLog = response.progress[response.progress.length - 1] as
              | { status?: string }
              | undefined;
            if (
              lastLog?.status === TaskProgressStatus.COMPLETED ||
              lastLog?.status === TaskProgressStatus.FAILED
            ) {
              isComplete = true;
            }
          }
        } catch {
          // Polling failed — continue trying
        }

        if (!isComplete) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      }

      await refreshSources();
      await mutate(CANVAS_GRAPH_KEY);
      toastSuccess.generic('Sources synced successfully');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to sync sources';
      toastError.api(message);
    } finally {
      setIsSyncing(false);
      setLockUpperSection(false);
    }
  }, [
    syncSources,
    refreshSources,
    setSelectedLowerTab,
    setLockUpperSection,
    setDbtRunLogs,
    mutate,
  ]);

  // Auto-sync sources on first canvas open
  const hasAutoSynced = useRef(false);
  useEffect(() => {
    if (hasAutoSynced.current || isPreview) return;
    if (!hasPermission('can_sync_sources')) return;
    hasAutoSynced.current = true;
    handleSyncSources();
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle canvas actions (delete-node, open-opconfig-panel, run-workflow, sync-sources, etc.)
  useEffect(() => {
    if (!canvasAction.type) return;

    const handleAction = async () => {
      switch (canvasAction.type) {
        case 'delete-node': {
          const actionData = (canvasAction.data || {}) as Record<string, unknown>;
          const nodeId = actionData.nodeId as string | undefined;
          const nodeType = actionData.nodeType as string | undefined;
          const isDummy = actionData.isDummy as boolean | undefined;
          const canvasNodeUuid = actionData.canvasNodeUuid as string | undefined;
          const deleteId = canvasNodeUuid || nodeId;

          if (!deleteId) {
            clearCanvasAction();
            return;
          }

          // Don't delete dummy nodes via API
          if (isDummy) {
            clearCanvasAction();
            return;
          }

          setTempLockCanvas(true);
          try {
            // v1 uses unified /nodes/ endpoint for all canvas node deletions
            // deleteOperationNode already calls refreshGraph() internally
            await deleteOperationNode(deleteId);
            toastSuccess.generic(
              nodeType === CanvasNodeTypeEnum.Operation || nodeType === 'operation'
                ? 'Operation deleted'
                : 'Node removed from canvas'
            );
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to delete node';
            toastError.api(message);
          } finally {
            setTempLockCanvas(false);
          }
          clearCanvasAction();
          break;
        }

        case 'open-opconfig-panel': {
          openOperationPanel();
          break;
        }

        case 'run-workflow': {
          try {
            setSelectedLowerTab('logs');
            const runData = (canvasAction.data || { run_type: 'run' }) as RunWorkflowParams;
            await runWorkflow(runData);
            // Refresh canvas after workflow completes
            await mutate(CANVAS_GRAPH_KEY);
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to run workflow';
            toastError.api(message);
          }
          clearCanvasAction();
          break;
        }

        case 'delete-source-tree-node': {
          const actionData = (canvasAction.data || {}) as Record<string, unknown>;
          const nodeId = actionData.nodeId as string | undefined;
          if (!nodeId) {
            clearCanvasAction();
            return;
          }

          setTempLockCanvas(true);
          try {
            // deleteOperationNode already calls refreshGraph() internally
            await deleteOperationNode(nodeId);
            toastSuccess.generic('Source removed from canvas');
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to remove source';
            toastError.api(message);
          } finally {
            setTempLockCanvas(false);
          }
          clearCanvasAction();
          break;
        }

        case 'sync-sources': {
          handleSyncSources();
          clearCanvasAction();
          break;
        }

        case 'refresh-canvas': {
          await Promise.all([mutate(CANVAS_GRAPH_KEY), refreshSources()]);
          clearCanvasAction();
          break;
        }

        case 'focus-node': {
          // Handled by Canvas component — do not clear here
          break;
        }

        default:
          clearCanvasAction();
      }
    };

    handleAction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasAction.type]);

  return {
    isSyncing,
    handleSyncSources,
  };
}
