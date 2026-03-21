// components/transform/canvas/layout/FlowEditor.tsx
'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { Resizable } from 'react-resizable';
import Canvas from '../Canvas';
import CanvasHeader from '../CanvasHeader';
import CanvasMessages from '../CanvasMessages';
import { ProjectTree } from '@/components/explore/ProjectTree';
import { OperationConfigLayout } from '../panels/OperationConfigLayout';
import { LowerSectionTabs } from './LowerSectionTabs';
import PublishModal from '../modals/PublishModal';
import PatRequiredModal from '../modals/PatRequiredModal';
import { useCanvasSources } from '@/hooks/api/useCanvasSources';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { useCanvasLock } from '@/hooks/api/useCanvasLock';
import { useGitIntegration } from '@/hooks/api/useGitIntegration';
import { useWorkflowExecution, type RunWorkflowParams } from '@/hooks/api/useWorkflowExecution';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { useTransformStore, useOperationPanelOpen, useCanvasAction } from '@/stores/transformStore';
import {
  CanvasNodeTypeEnum,
  type DbtProjectGraphResponse,
  type CanvasNodeDataResponse,
  type SelectedNodeData,
} from '@/types/transform';
import { CANVAS_GRAPH_KEY } from '@/hooks/api/useCanvasGraph';
import { apiGet } from '@/lib/api';
import { useSWRConfig } from 'swr';
import useSWR from 'swr';
import { toastSuccess, toastError } from '@/lib/toast';
import { CANVAS_CONSTANTS } from '@/constants/transform';

import 'reactflow/dist/style.css';
import 'react-resizable/css/styles.css';

interface FlowEditorProps {
  onClose?: () => void;
  isPreview?: boolean;
}

export function FlowEditor({ isPreview = false }: FlowEditorProps) {
  const [sidebarWidth, setSidebarWidth] = useState(CANVAS_CONSTANTS.SIDEBAR_DEFAULT_WIDTH);
  const [lowerSectionHeight, setLowerSectionHeight] = useState(
    CANVAS_CONSTANTS.LOWER_SECTION_DEFAULT_HEIGHT
  );
  const [isLowerFullScreen, setIsLowerFullScreen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasCheckedRunningTasks = useRef(false);

  const { mutate } = useSWRConfig();

  // Operation panel state
  const operationPanelOpen = useOperationPanelOpen();
  const canvasAction = useCanvasAction();
  const {
    closeOperationPanel,
    clearCanvasAction,
    openOperationPanel,
    setTempLockCanvas,
    setSelectedLowerTab,
    setViewOnlyMode,
    setLockUpperSection,
    publishModalOpen,
    closePublishModal,
    patModalOpen,
    closePatModal,
    dbtRunLogs,
    setDbtRunLogs,
    previewAction,
    previewData,
    gitRepoUrl: storeGitRepoUrl,
  } = useTransformStore();

  // Fetch sources for the project tree
  const {
    sourcesModels,
    isLoading: isLoadingSources,
    refresh: refreshSources,
    syncSources,
  } = useCanvasSources();

  // Operations for adding/deleting nodes
  const { addNodeToCanvas, deleteOperationNode } = useCanvasOperations();

  // Canvas lock - auto-acquires on mount, auto-releases on unmount
  const { isLockedByOther } = useCanvasLock({
    autoAcquire: !isPreview,
    onLockLost: () => {
      toastError.api('Canvas lock was lost. Another user may have taken control.');
    },
  });

  // Permissions
  const { hasPermission } = useUserPermissions();

  // Git integration
  const { gitRepoUrl, checkPatStatus } = useGitIntegration();

  // Workflow execution
  const {
    logs: workflowLogs,
    isRunning: isWorkflowRunning,
    runWorkflow,
    checkRunningTasks,
    resumePolling,
  } = useWorkflowExecution();

  // Read cached graph data to compute hasUnpublishedChanges
  const { data: graphData } = useSWR<DbtProjectGraphResponse>(isPreview ? null : CANVAS_GRAPH_KEY);
  const hasUnpublishedChanges = useMemo(() => {
    return graphData?.nodes?.some((node) => node.isPublished === false) ?? false;
  }, [graphData?.nodes]);

  // Sync workflow logs to store for LowerSectionTabs
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

  // Check PAT status on mount
  useEffect(() => {
    if (!isPreview) {
      checkPatStatus();
    }
  }, [checkPatStatus, isPreview]);

  // Handle canvas actions (delete-node, open-opconfig-panel, run-workflow, sync-sources)
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
          await mutate(CANVAS_GRAPH_KEY);
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
            if (lastLog?.status === 'completed' || lastLog?.status === 'failed') {
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

  // Find the canvas node for a given source model (by dbtmodel UUID match)
  const findCanvasNode = useCallback(
    (schema: string, table: string) => {
      const model = sourcesModels.find((m) => m.schema === schema && m.name === table);
      if (!model) return null;

      const canvasNode = graphData?.nodes?.find((n) => n.dbtmodel?.uuid === model.uuid);
      return canvasNode ?? null;
    },
    [sourcesModels, graphData?.nodes]
  );

  // Focus canvas viewport on a node AND select it so the operation panel targets it
  const focusAndSelectCanvasNode = useCallback(
    (canvasNodeUuid: string, nodeType: string, nodeData: CanvasNodeDataResponse) => {
      const store = useTransformStore.getState();
      store.setSelectedNode({
        id: canvasNodeUuid,
        type: nodeType,
        data: { ...nodeData, isDummy: false },
      } as SelectedNodeData);
      store.dispatchCanvasAction({
        type: 'focus-node',
        data: { nodeId: canvasNodeUuid },
      });
    },
    []
  );

  // Handle table select from project tree (for preview + focus)
  const handleTableSelect = useCallback(
    (schema: string, table: string) => {
      useTransformStore.getState().setPreviewAction({
        type: 'preview',
        data: { schema, table },
      });
      setSelectedLowerTab('preview');

      // If the table is on the canvas, focus on it and select it
      const canvasNode = findCanvasNode(schema, table);
      if (canvasNode) {
        focusAndSelectCanvasNode(canvasNode.uuid, canvasNode.node_type, canvasNode);
      }
    },
    [setSelectedLowerTab, findCanvasNode, focusAndSelectCanvasNode]
  );

  // Handle delete from canvas (via project tree)
  const handleDeleteFromCanvas = useCallback((nodeId: string) => {
    useTransformStore.getState().dispatchCanvasAction({
      type: 'delete-source-tree-node',
      data: { nodeId },
    });
  }, []);

  // Handle add to canvas — if already on canvas, just focus on it
  const handleAddToCanvas = useCallback(
    async (schema: string, table: string) => {
      const model = sourcesModels.find((m) => m.schema === schema && m.name === table);

      if (!model) {
        toastError.api(`Could not find ${schema}.${table}`);
        return;
      }

      // If already on the canvas, focus and select it instead of re-adding
      const existingNode = findCanvasNode(schema, table);
      if (existingNode) {
        focusAndSelectCanvasNode(existingNode.uuid, existingNode.node_type, existingNode);
        return;
      }

      setTempLockCanvas(true);
      try {
        // addNodeToCanvas already calls refreshGraph() internally
        const newNode = await addNodeToCanvas(model.uuid);
        toastSuccess.generic(`Added ${table} to canvas`);

        // Focus and select the newly added node
        focusAndSelectCanvasNode(newNode.uuid, newNode.node_type, newNode);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : `Failed to add ${table} to canvas`;
        toastError.api(message);
      } finally {
        setTempLockCanvas(false);
      }
    },
    [sourcesModels, addNodeToCanvas, setTempLockCanvas, findCanvasNode, focusAndSelectCanvasNode]
  );

  // Handle sidebar resize
  const handleSidebarResize = useCallback(
    (_e: React.SyntheticEvent, { size }: { size: { width: number } }) => {
      setSidebarWidth(size.width);
    },
    []
  );

  // Handle lower section resize
  const handleLowerResize = useCallback(
    (_e: React.SyntheticEvent, { size }: { size: { height: number } }) => {
      setLowerSectionHeight(size.height);
    },
    []
  );

  // Toggle fullscreen for lower section
  const toggleLowerFullScreen = useCallback(() => {
    setIsLowerFullScreen((prev) => {
      if (prev) {
        setLowerSectionHeight(CANVAS_CONSTANTS.LOWER_SECTION_DEFAULT_HEIGHT);
      } else if (containerRef.current) {
        setLowerSectionHeight(containerRef.current.clientHeight - CANVAS_CONSTANTS.HEADER_HEIGHT);
      }
      return !prev;
    });
  }, []);

  // PAT modal handlers
  const handlePatAdded = useCallback(() => {
    setViewOnlyMode(false);
    checkPatStatus();
  }, [setViewOnlyMode, checkPatStatus]);

  const handlePatViewOnly = useCallback(() => {
    setViewOnlyMode(true);
  }, [setViewOnlyMode]);

  // Publish success handler
  const handlePublishSuccess = useCallback(async () => {
    await mutate(CANVAS_GRAPH_KEY);
  }, [mutate]);

  // Derive preview data from node click (previewData) or explicit preview action
  const previewTable =
    previewAction?.type === 'preview' ? previewAction.data : (previewData ?? null);

  return (
    <div
      ref={containerRef}
      className="h-full flex flex-col bg-gray-100 overflow-hidden"
      data-testid="flow-editor"
    >
      <ReactFlowProvider>
        {/* Header */}
        <div className="flex-shrink-0" style={{ height: CANVAS_CONSTANTS.HEADER_HEIGHT }}>
          <CanvasHeader
            isLocked={isLockedByOther}
            isWorkflowRunning={isWorkflowRunning}
            gitRepoUrl={gitRepoUrl || storeGitRepoUrl}
            isPreviewMode={isPreview}
          />
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Upper section: Sidebar + Canvas */}
          <div
            className="flex min-h-0"
            style={{
              height: isLowerFullScreen ? 0 : `calc(100% - ${lowerSectionHeight}px)`,
            }}
          >
            {/* Resizable Sidebar */}
            {!isPreview && !isLowerFullScreen && (
              <Resizable
                width={sidebarWidth}
                height={0}
                onResize={handleSidebarResize}
                minConstraints={[CANVAS_CONSTANTS.SIDEBAR_MIN_WIDTH, 0]}
                maxConstraints={[CANVAS_CONSTANTS.SIDEBAR_MAX_WIDTH, 0]}
                handle={
                  <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-border hover:bg-primary/50 transition-colors z-10" />
                }
                axis="x"
              >
                <div
                  className="relative h-full border-r bg-white flex-shrink-0"
                  style={{ width: sidebarWidth }}
                >
                  <ProjectTree
                    tables={sourcesModels.map((m) => ({
                      id: m.uuid,
                      schema: m.schema,
                      name: m.name,
                      type: m.type,
                    }))}
                    loading={isLoadingSources || isSyncing}
                    onSync={handleSyncSources}
                    onTableSelect={handleTableSelect}
                    selectedTable={null}
                    mode="canvas"
                    onAddToCanvas={handleAddToCanvas}
                    onDeleteFromCanvas={handleDeleteFromCanvas}
                  />
                </div>
              </Resizable>
            )}

            {/* Canvas Area */}
            {!isLowerFullScreen && (
              <div className="flex-1 flex flex-col min-w-0 relative">
                {/* Canvas Messages (lock/unpublished/PAT overlays) */}
                <CanvasMessages hasUnpublishedChanges={hasUnpublishedChanges} />

                {/* Main Canvas */}
                <div className="flex-1 relative">
                  <Canvas isPreviewMode={isPreview} />

                  {/* Operation Configuration Panel */}
                  {!isPreview && (
                    <OperationConfigLayout
                      open={operationPanelOpen}
                      onClose={closeOperationPanel}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Lower Section: Preview / Logs */}
          <Resizable
            width={0}
            height={lowerSectionHeight}
            onResize={handleLowerResize}
            minConstraints={[0, CANVAS_CONSTANTS.LOWER_SECTION_MIN_HEIGHT]}
            maxConstraints={[
              0,
              containerRef.current
                ? containerRef.current.clientHeight - CANVAS_CONSTANTS.HEADER_HEIGHT - 100
                : 600,
            ]}
            handle={
              <div className="absolute top-0 left-0 right-0 h-1 cursor-row-resize bg-border hover:bg-primary/50 transition-colors z-10" />
            }
            axis="y"
            resizeHandles={['n']}
          >
            <div className="relative" style={{ height: lowerSectionHeight }}>
              <LowerSectionTabs
                height={lowerSectionHeight}
                isFullScreen={isLowerFullScreen}
                onToggleFullScreen={toggleLowerFullScreen}
                dbtRunLogs={dbtRunLogs}
                isLogsLoading={isWorkflowRunning}
                previewTable={previewTable}
              />
            </div>
          </Resizable>
        </div>
      </ReactFlowProvider>

      {/* Modals */}
      <PublishModal
        open={publishModalOpen}
        onClose={closePublishModal}
        onPublishSuccess={handlePublishSuccess}
      />

      <PatRequiredModal
        open={patModalOpen}
        onClose={closePatModal}
        onAddKey={handlePatAdded}
        onViewOnly={handlePatViewOnly}
        gitRepoUrl={gitRepoUrl || storeGitRepoUrl}
      />
    </div>
  );
}
