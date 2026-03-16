// components/transform/canvas/layout/FlowEditor.tsx
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { Resizable } from 'react-resizable';
import Canvas from '../Canvas';
import CanvasHeader from '../CanvasHeader';
import CanvasMessages from '../CanvasMessages';
import { ProjectTree } from '@/components/explore/ProjectTree';
import { OperationConfigLayout } from '../panels/OperationConfigLayout';
import { LowerSectionTabs } from './LowerSectionTabs';
import { PublishModal, PatRequiredModal } from '../modals';
import { useCanvasSources } from '@/hooks/api/useCanvasSources';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { useCanvasLock } from '@/hooks/api/useCanvasLock';
import { useGitIntegration } from '@/hooks/api/useGitIntegration';
import { useWorkflowExecution, type RunWorkflowParams } from '@/hooks/api/useWorkflowExecution';
import { useTransformStore, useOperationPanelOpen, useCanvasAction } from '@/stores/transformStore';
import { CanvasNodeTypeEnum } from '@/types/transform';
import { CANVAS_GRAPH_KEY } from '@/hooks/api/useCanvasGraph';
import { useSWRConfig } from 'swr';
import { toast } from 'sonner';

import 'reactflow/dist/style.css';
import 'react-resizable/css/styles.css';

// Layout constants
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 500;
const SIDEBAR_DEFAULT_WIDTH = 280;
const HEADER_HEIGHT = 48;
const LOWER_SECTION_DEFAULT_HEIGHT = 300;
const LOWER_SECTION_MIN_HEIGHT = 100;

interface FlowEditorProps {
  onClose?: () => void;
  isPreview?: boolean;
}

export function FlowEditor({ isPreview = false }: FlowEditorProps) {
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [lowerSectionHeight, setLowerSectionHeight] = useState(LOWER_SECTION_DEFAULT_HEIGHT);
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
      toast.error('Canvas lock was lost. Another user may have taken control.');
    },
  });

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

  // Sync workflow logs to store for LowerSectionTabs
  useEffect(() => {
    if (workflowLogs.length > 0) {
      setDbtRunLogs(workflowLogs);
    }
  }, [workflowLogs, setDbtRunLogs]);

  // Check for running tasks on mount
  useEffect(() => {
    if (hasCheckedRunningTasks.current || isPreview) return;
    hasCheckedRunningTasks.current = true;

    const check = async () => {
      const runningTaskId = await checkRunningTasks();
      if (runningTaskId) {
        setSelectedLowerTab('logs');
        await resumePolling(runningTaskId);
      }
    };
    check();
  }, [checkRunningTasks, resumePolling, setSelectedLowerTab, isPreview]);

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
            await deleteOperationNode(deleteId);
            toast.success(
              nodeType === CanvasNodeTypeEnum.Operation || nodeType === 'operation'
                ? 'Operation deleted'
                : 'Node removed from canvas'
            );
            await mutate(CANVAS_GRAPH_KEY);
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to delete node';
            toast.error(message);
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
            toast.error(message);
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

        default:
          clearCanvasAction();
      }
    };

    handleAction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasAction.type]);

  // Handle sync sources
  const handleSyncSources = useCallback(async () => {
    setIsSyncing(true);
    setSelectedLowerTab('logs');
    try {
      await syncSources();
      await refreshSources();
      toast.success('Sources synced successfully');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to sync sources';
      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  }, [syncSources, refreshSources, setSelectedLowerTab]);

  // Handle table select from project tree (for preview)
  const handleTableSelect = useCallback(
    (schema: string, table: string) => {
      useTransformStore.getState().setPreviewAction({
        type: 'preview',
        data: { schema, table },
      });
      setSelectedLowerTab('preview');
    },
    [setSelectedLowerTab]
  );

  // Handle add to canvas
  const handleAddToCanvas = useCallback(
    async (schema: string, table: string) => {
      const model = sourcesModels.find((m) => m.schema === schema && m.name === table);

      if (!model) {
        toast.error(`Could not find ${schema}.${table}`);
        return;
      }

      setTempLockCanvas(true);
      try {
        await addNodeToCanvas(model.uuid);
        await mutate(CANVAS_GRAPH_KEY);
        toast.success(`Added ${table} to canvas`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : `Failed to add ${table} to canvas`;
        toast.error(message);
      } finally {
        setTempLockCanvas(false);
      }
    },
    [sourcesModels, addNodeToCanvas, mutate, setTempLockCanvas]
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
        setLowerSectionHeight(LOWER_SECTION_DEFAULT_HEIGHT);
      } else if (containerRef.current) {
        setLowerSectionHeight(containerRef.current.clientHeight - HEADER_HEIGHT);
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
        <div className="flex-shrink-0" style={{ height: HEADER_HEIGHT }}>
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
                minConstraints={[SIDEBAR_MIN_WIDTH, 0]}
                maxConstraints={[SIDEBAR_MAX_WIDTH, 0]}
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
                  />
                </div>
              </Resizable>
            )}

            {/* Canvas Area */}
            {!isLowerFullScreen && (
              <div className="flex-1 flex flex-col min-w-0 relative">
                {/* Canvas Messages (lock/unpublished/PAT overlays) */}
                <CanvasMessages hasUnpublishedChanges={false} />

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
            minConstraints={[0, LOWER_SECTION_MIN_HEIGHT]}
            maxConstraints={[
              0,
              containerRef.current ? containerRef.current.clientHeight - HEADER_HEIGHT - 100 : 600,
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
