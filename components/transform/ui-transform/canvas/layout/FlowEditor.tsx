// components/transform/canvas/layout/FlowEditor.tsx
'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { Resizable } from 'react-resizable';
import Canvas from '../Canvas';
import CanvasHeader from '../CanvasHeader';
import CanvasMessages from '../CanvasMessages';
import { ProjectTree } from '@/components/explore/ProjectTree';
import { ProjectTreeMode } from '@/constants/explore';
import { OperationConfigLayout } from '../panels/OperationConfigLayout';
import { LowerSectionTabs } from './LowerSectionTabs';
import PublishModal from '../modals/PublishModal';
import PatRequiredModal from '../modals/PatRequiredModal';
import { useCanvasLock } from '@/hooks/api/useCanvasLock';
import { useGitIntegration } from '@/hooks/api/useGitIntegration';
import { useWorkflowExecution } from '@/hooks/api/useWorkflowExecution';
import { useCanvasSources } from '@/hooks/api/useCanvasSources';
import { useTransformStore, useOperationPanelOpen } from '@/stores/transformStore';
import { CANVAS_CONSTANTS } from '@/constants/transform';
import { useSWRConfig } from 'swr';
import { CANVAS_GRAPH_KEY } from '@/hooks/api/useCanvasGraph';
import { toastError, toastSuccess } from '@/lib/toast';

import { useCanvasActions } from './hooks/useCanvasActions';
import { useRunningTasksMonitor } from './hooks/useRunningTasksMonitor';
import { useSourceTreeActions } from './hooks/useSourceTreeActions';

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
  const [isLowerMinimized, setIsLowerMinimized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { mutate } = useSWRConfig();

  // Operation panel state
  const operationPanelOpen = useOperationPanelOpen();
  const {
    closeOperationPanel,
    setViewOnlyMode,
    publishModalOpen,
    closePublishModal,
    patModalOpen,
    closePatModal,
    dbtRunLogs,
    previewAction,
    previewData,
    gitRepoUrl: storeGitRepoUrl,
    triggerRefresh,
  } = useTransformStore();

  // Single shared workflow execution instance — logs, run state, and
  // runWorkflow all come from the same hook so logs always reflect the
  // current run regardless of whether it was started here or resumed.
  const {
    logs: workflowLogs,
    isRunning: isWorkflowRunning,
    runWorkflow,
    checkRunningTasks,
    resumePolling,
  } = useWorkflowExecution();

  // Sources refresh (SWR deduplicates with useSourceTreeActions' instance)
  const { refresh: refreshSources } = useCanvasSources();

  // --- Extracted hooks ---
  const { isSyncing, handleSyncSources } = useCanvasActions({ isPreview, runWorkflow });
  useRunningTasksMonitor({
    isPreview,
    workflowLogs,
    isWorkflowRunning,
    checkRunningTasks,
    resumePolling,
  });
  const {
    sourcesModels,
    isLoadingSources,
    graphData,
    handleTableSelect,
    handleDeleteFromCanvas,
    handleAddToCanvas,
  } = useSourceTreeActions({ isPreview });

  // Canvas lock - auto-acquires on mount, auto-releases on unmount
  const { isLockedByOther } = useCanvasLock({
    autoAcquire: !isPreview,
    onLockLost: () => {
      toastError.api('Canvas lock was lost. Another user may have taken control.');
    },
  });

  // Git integration
  const { gitRepoUrl, checkPatStatus } = useGitIntegration();

  // Check PAT status on mount
  useEffect(() => {
    if (!isPreview) {
      checkPatStatus();
    }
  }, [checkPatStatus, isPreview]);

  // Read cached graph data to compute hasUnpublishedChanges
  const hasUnpublishedChanges = useMemo(() => {
    return graphData?.nodes?.some((node) => node.isPublished === false) ?? false;
  }, [graphData?.nodes]);

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
    setIsLowerMinimized(false);
    setIsLowerFullScreen((prev) => {
      if (prev) {
        setLowerSectionHeight(CANVAS_CONSTANTS.LOWER_SECTION_DEFAULT_HEIGHT);
      } else if (containerRef.current) {
        setLowerSectionHeight(containerRef.current.clientHeight - CANVAS_CONSTANTS.HEADER_HEIGHT);
      }
      return !prev;
    });
  }, []);

  // Toggle minimize for lower section (collapse to tab bar only)
  const TAB_BAR_HEIGHT = 40;
  const toggleLowerMinimized = useCallback(() => {
    setIsLowerFullScreen(false);
    setIsLowerMinimized((prev) => {
      if (prev) {
        setLowerSectionHeight(CANVAS_CONSTANTS.LOWER_SECTION_DEFAULT_HEIGHT);
      } else {
        setLowerSectionHeight(TAB_BAR_HEIGHT);
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

  // Full canvas refresh — matches old webapp v1 behavior:
  // 1. Sync remote dbt project to canvas (picks up external changes)
  // 2. Re-fetch graph (nodes + edges)
  // 3. Re-fetch sources/models (left sidebar)
  // 4. Check for any running tasks and resume polling if found
  const handleRefreshCanvas = useCallback(async () => {
    await Promise.all([mutate(CANVAS_GRAPH_KEY), refreshSources()]);
    // Bump refreshTrigger so every node re-fetches its table_columns
    triggerRefresh();
    const runningTaskId = await checkRunningTasks();
    if (runningTaskId) {
      await resumePolling(runningTaskId);
    }
    toastSuccess.generic('Graph has been refreshed');
  }, [mutate, refreshSources, triggerRefresh, checkRunningTasks, resumePolling]);

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
                  className="relative h-full border-r bg-white flex-shrink-0 pr-1"
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
                    mode={ProjectTreeMode.CANVAS}
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
                  <Canvas isPreviewMode={isPreview} onRefresh={handleRefreshCanvas} />

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
                isMinimized={isLowerMinimized}
                onToggleFullScreen={toggleLowerFullScreen}
                onToggleMinimize={toggleLowerMinimized}
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
