'use client';

import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { useCharts } from '@/hooks/api/useChart';
import { useRouter } from 'next/navigation';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { cn } from '@/lib/utils';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useDashboardAnimation } from '@/hooks/useDashboardAnimation';
import { UnifiedFiltersPanel } from './unified-filters-panel';
import { TabBar } from './tabs/TabBar';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { GRID_ROW_HEIGHT, type ScreenSizeKey } from '@/components/dashboard/grid/grid-constants';
import {
  getActiveEditorTab,
  getPlacedChartIds,
  getPlacedKpiIds,
  normalizeEditorTabs,
  type DashboardEditorState,
} from '@/components/dashboard/logic/editor-state';
import { useBuilderFilters } from '@/components/dashboard/hooks/useBuilderFilters';
import {
  useDashboardLock,
  type BuilderCleanupHandle,
} from '@/components/dashboard/hooks/useDashboardLock';
import { useDashboardAutosave } from '@/components/dashboard/hooks/useDashboardAutosave';
import { useCrossTabDrag } from '@/components/dashboard/hooks/useCrossTabDrag';
import { buildAddWidgetHandlers } from '@/components/dashboard/widgets/add-widget-handlers';
import { DashboardBuilderHeader } from '@/components/dashboard/builder/DashboardBuilderHeader';
import { useDashboardSave } from '@/components/dashboard/builder/useDashboardSave';
import { useBuilderCanvasSize } from '@/components/dashboard/builder/useBuilderCanvasSize';
import { useBuilderTabs } from '@/components/dashboard/builder/useBuilderTabs';
import { useGridCommits } from '@/components/dashboard/builder/useGridCommits';
import { scrollToWidgetIfNeeded } from '@/components/dashboard/builder/scroll-to-widget';
import { BuilderCanvas } from '@/components/dashboard/builder/BuilderCanvas';
import { BuilderModals } from '@/components/dashboard/builder/BuilderModals';
import { CrossTabDragOverlay } from '@/components/dashboard/builder/CrossTabDragOverlay';
import { useBuilderFilterSource } from '@/components/dashboard/builder/useBuilderFilterSource';
import { useUndoRedoShortcuts } from '@/components/dashboard/builder/useUndoRedoShortcuts';
import { useBuilderCleanupHandle } from '@/components/dashboard/builder/useBuilderCleanupHandle';
import { useBuilderComponentActions } from '@/components/dashboard/builder/useBuilderComponentActions';
import { useWidgetNavigationHandlers } from '@/components/dashboard/builder/useWidgetNavigationHandlers';
import { buildBuilderHeaderActions } from '@/components/dashboard/builder/builder-header-actions';
import { BuilderHorizontalFilters } from '@/components/dashboard/builder/BuilderHorizontalFilters';

/** Undo history keeps this many steps (E2E: "Undo history keeps 20 steps"). */
const UNDO_HISTORY_DEPTH = 20;

interface DashboardBuilderProps {
  dashboardId?: number;
  // any: app/dashboards/[id]/edit/page.tsx's mockDashboard fallback doesn't satisfy
  // BuilderInitialData (missing tabs, components entries missing id) — TS2322 — kept any, see Task 13 row 12
  initialData?: any;
  isNewDashboard?: boolean;
  dashboardLockInfo?: {
    isLocked: boolean;
    lockedBy?: string;
  };
  onBack?: () => void;
  onPreview?: () => void;
  isNavigating?: boolean;
}

// Ref methods exposed to parent — shared with the edit page's ref via BuilderCleanupHandle.
export type DashboardBuilderRef = BuilderCleanupHandle;

export const DashboardBuilder = forwardRef<DashboardBuilderRef, DashboardBuilderProps>(
  function DashboardBuilder(
    { dashboardId, initialData, isNewDashboard, onBack, onPreview, isNavigating },
    ref
  ) {
    const router = useRouter();

    // Normalize every tab up front (computed each render as before; only the first render's
    // value seeds the editor state).
    const initialTabs = normalizeEditorTabs(initialData);

    // Filters for the panel: live once loaded, rebuilt every render (see useBuilderFilterSource).
    const initialFilters = useBuilderFilterSource(dashboardId, initialData);

    // All tab content participates in one history so a cross-tab move is atomic.
    const {
      state,
      setState,
      setStateWithoutHistory,
      undo: undoBase,
      redo: redoBase,
      canUndo,
      canRedo,
    } = useUndoRedo<DashboardEditorState>(
      {
        tabs: initialTabs,
        activeTabId: initialTabs[0].id,
      },
      UNDO_HISTORY_DEPTH
    );

    // Applied filters state - only updates when filters are applied (causes chart re-renders)
    const [appliedFilters, setAppliedFilters] = useState<Record<string, unknown>>({});

    // Get initial target screen size from initialData, default to desktop
    const initialTargetScreenSize: ScreenSizeKey =
      (initialData?.target_screen_size as ScreenSizeKey) || 'desktop';
    // Target screen size (fixed for the builder's lifetime — nothing changes it)
    const [targetScreenSize] = useState<ScreenSizeKey>(initialTargetScreenSize);

    // Component state
    const [showChartSelector, setShowChartSelector] = useState(false);
    const [showKPISelector, setShowKPISelector] = useState(false);

    // The picker modals are plain interactions with no coachmark of their own (per design) —
    // hide the walkthrough spotlight while either is open so its overlay doesn't darken it.
    useEffect(() => {
      useInsightWalkthroughStore
        .getState()
        .setSuppressCoachmark(showChartSelector || showKPISelector);
    }, [showChartSelector, showKPISelector]);
    // Fetch all charts
    const { data: chartsData, isLoading: chartsLoading } = useCharts
      ? useCharts()
      : { data: [], isLoading: false };

    const {
      showFilterModal,
      selectedFilterForEdit,
      openFilterModal,
      closeFilterModal,
      handleFilterSave,
      handleEditFilter,
    } = useBuilderFilters(dashboardId);
    const { lockToken, unlockDashboard } = useDashboardLock(dashboardId);

    // Filters panel collapse state
    const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);
    const [title, setTitle] = useState(initialData?.title || 'Untitled Dashboard');
    const [description, setDescription] = useState(initialData?.description || '');
    const [isEditingTitle, setIsEditingTitle] = useState(isNewDashboard || false);

    const [dragPreviewTabId, setDragPreviewTabId] = useState<string | null>(null);
    const renderedActiveTabId = dragPreviewTabId || state.activeTabId;
    const activeTab =
      state.tabs.find((tab) => tab.id === renderedActiveTabId) || getActiveEditorTab(state);
    const activeLayout = activeTab?.layout_config || [];
    const activeComponents = activeTab?.components || {};

    // Ref to always access the latest editor state in pointer/grid callbacks.
    const stateRef = useRef(state);
    useEffect(() => {
      stateRef.current = state;
    }, [state]);

    // Ref for the canvas container (gray area)
    const canvasRef = useRef<HTMLDivElement>(null);
    // Ref for the white dashboard container (actual boundary)
    const dashboardContainerRef = useRef<HTMLDivElement>(null);

    // Responsive layout hook
    const responsive = useResponsiveLayout();
    const { currentScreenConfig, actualContainerWidth } = useBuilderCanvasSize(
      targetScreenSize,
      dashboardContainerRef
    );

    // Dashboard animation hook
    // Note: spaceMakingConfig.enabled is set to false to prevent charts from
    // automatically moving/squeezing when dragging near them
    const dashboardAnimation = useDashboardAnimation({
      gridCols: currentScreenConfig.cols,
      containerWidth: actualContainerWidth,
      rowHeight: GRID_ROW_HEIGHT,
      enabled: true,
      spaceMakingConfig: {
        enabled: false, // Disable automatic space-making to preserve layout alignment
      },
    });

    // Effective filter layout (combines user choice with responsive logic)
    // For desktop: always use vertical (sidebar), for mobile/tablet: use horizontal (top bar)
    const filterLayout = responsive.isDesktop ? 'vertical' : 'horizontal';

    const { saveStatus, saveError, saveDashboard, flushActiveRichText } = useDashboardSave({
      dashboardId,
      stateRef,
      setState,
      title,
      description,
      targetScreenSize,
      filterLayout,
    });

    const { holdAfterUndoRedo, isUndoRedoOperationRef } = useDashboardAutosave(
      dashboardId,
      state,
      () => saveDashboard({}, false)
    );

    // Undo/redo hold autosave back for a second (see useDashboardAutosave).
    const undo = useCallback(() => {
      undoBase();
      holdAfterUndoRedo();
    }, [undoBase, holdAfterUndoRedo]);

    const redo = useCallback(() => {
      redoBase();
      holdAfterUndoRedo();
    }, [redoBase, holdAfterUndoRedo]);

    useUndoRedoShortcuts(undo, redo, canUndo, canRedo);

    useBuilderCleanupHandle(ref, { dashboardId, lockToken, unlockDashboard, saveDashboard });

    const { handleTabChange, handleTabAdd, handleTabRemove, handleTabRename, handleTabReorder } =
      useBuilderTabs({
        dashboardId,
        stateRef,
        setState,
        setStateWithoutHistory,
        flushActiveRichText,
        setDragPreviewTabId,
      });

    const { resizingItems, handleGridDragStop, handleResizeStart, handleResizeStop } =
      useGridCommits({ stateRef, setState, isUndoRedoOperationRef });

    // onLayoutChange is a no-op for state. In the grid model each widget owns its (x, y, w, h);
    // RGL owns positions during a gesture and reports the final, gravity-up-compacted layout via
    // onDragStop / onResizeStop — those are the single commit points to history. Writing here too
    // would double-commit and pollute undo history.
    const handleLayoutChange = useCallback(() => {}, []);

    const {
      crossTabDrag,
      draggedItem,
      isDraggingRef,
      handleDragStart,
      handleDrag,
      handleDragStop,
      handoffPlaceholderStyle,
    } = useCrossTabDrag({
      dashboardId,
      stateRef,
      setState,
      canvasRef,
      dashboardContainerRef,
      cols: currentScreenConfig.cols,
      actualContainerWidth,
      setDragPreviewTabId,
      onGridDragStop: handleGridDragStop,
    });

    // Smart scroll function - only scrolls if component is actually out of view
    const scrollToComponentIfNeeded = (componentId: string) =>
      scrollToWidgetIfNeeded(canvasRef, dashboardContainerRef, componentId);

    const { handleChartSelected, handleKPISelected, addTextComponent } = buildAddWidgetHandlers({
      dashboardId,
      activeLayout,
      setState,
      animateComponent: dashboardAnimation.animateComponent,
      scrollToComponentIfNeeded,
    });

    // Handle when filters are applied (causes chart re-renders)
    const handleFiltersApplied = (newAppliedFilters: Record<string, unknown>) => {
      console.log('🔄 Dashboard Builder - Filters Applied:', {
        newAppliedFilters,
        initialFilters,
      });
      setAppliedFilters(newAppliedFilters);
    };

    // Handle when filters are cleared
    const handleFiltersCleared = () => {
      setAppliedFilters({});
    };

    // Chart and KPI ids already on this tab (the pickers mark them "Already added")
    const getExcludedChartIds = (): number[] => getPlacedChartIds(activeComponents);
    const getExcludedKPIIds = (): number[] => getPlacedKpiIds(activeComponents);

    const { stableRemoveComponent, stableUpdateComponent } = useBuilderComponentActions({
      dashboardId,
      activeLayout,
      activeComponents,
      setState,
      isDraggingRef,
    });

    const { handleViewChart, handleEditChart, handleViewKpi, handleEditKpi } =
      useWidgetNavigationHandlers(router);

    const { handleTitleCommit, handleAddChartClick, handleSaveClick } = buildBuilderHeaderActions({
      dashboardId,
      title,
      setTitle,
      setIsEditingTitle,
      saveDashboard,
      chartsData,
      chartsLoading,
      router,
      setShowChartSelector,
    });

    return (
      <div className="dashboard-builder h-full flex flex-col overflow-hidden">
        <CrossTabDragOverlay session={crossTabDrag} />
        {/* Fixed Header with Title and Toolbar */}
        <DashboardBuilderHeader
          title={title}
          isEditingTitle={isEditingTitle}
          onTitleChange={setTitle}
          onTitleEditStart={() => setIsEditingTitle(true)}
          onTitleCommit={handleTitleCommit}
          description={description}
          onDescriptionChange={setDescription}
          onDescriptionSave={() => saveDashboard()}
          onBack={onBack}
          onPreview={onPreview}
          isNavigating={isNavigating}
          onAddChart={handleAddChartClick}
          onAddChartCompact={() => setShowChartSelector(true)}
          onAddKpi={() => setShowKPISelector(true)}
          onAddText={addTextComponent}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          saveStatus={saveStatus}
          saveError={saveError}
          onSave={handleSaveClick}
        />
        {/* Horizontal Filters Bar (or its "Show Filters" button) */}
        {filterLayout === 'horizontal' && (
          <BuilderHorizontalFilters
            initialFilters={initialFilters}
            dashboardId={dashboardId!}
            isCollapsed={isFiltersCollapsed}
            onCollapseChange={setIsFiltersCollapsed}
            onAddFilter={openFilterModal}
            onEditFilter={handleEditFilter}
            onFiltersApplied={handleFiltersApplied}
            onFiltersCleared={handleFiltersCleared}
          />
        )}
        {/* Main Content Area */}
        <div
          className={cn(
            'flex-1 flex overflow-hidden',
            filterLayout === 'vertical' ? 'flex-col md:flex-row' : ''
          )}
        >
          {/* Vertical Filters Sidebar */}
          {filterLayout === 'vertical' && (
            <UnifiedFiltersPanel
              initialFilters={initialFilters}
              dashboardId={dashboardId!}
              isEditMode={true}
              layout="vertical"
              onAddFilter={openFilterModal}
              onEditFilter={handleEditFilter}
              onFiltersApplied={handleFiltersApplied}
              onFiltersCleared={handleFiltersCleared}
              onCollapseChange={setIsFiltersCollapsed}
            />
          )}

          {/* Right side: Tab Bar + Canvas stacked vertically */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tab Bar */}
            <TabBar
              tabs={state.tabs}
              activeTabId={renderedActiveTabId}
              isEditMode={true}
              onTabChange={handleTabChange}
              onTabAdd={handleTabAdd}
              onTabRemove={handleTabRemove}
              onTabRename={handleTabRename}
              onTabReorder={handleTabReorder}
              dragTargetTabId={crossTabDrag?.hoverTabId || crossTabDrag?.targetTabId}
              isWidgetDragging={Boolean(crossTabDrag)}
            />

            {/* Dashboard Canvas - Responsive Container */}
            <BuilderCanvas
              canvasRef={canvasRef}
              dashboardContainerRef={dashboardContainerRef}
              screenHeight={currentScreenConfig.height}
              cols={currentScreenConfig.cols}
              containerWidth={actualContainerWidth}
              activeLayout={activeLayout}
              activeComponents={activeComponents}
              renderedActiveTabId={renderedActiveTabId}
              isHandoff={crossTabDrag?.phase === 'handoff'}
              handoffPlaceholderStyle={handoffPlaceholderStyle}
              onLayoutChange={handleLayoutChange}
              onDragStart={handleDragStart}
              onDrag={handleDrag}
              onDragStop={handleDragStop}
              onResizeStart={handleResizeStart}
              onResizeStop={handleResizeStop}
              animatingComponents={dashboardAnimation.animatingComponents}
              getAnimationStyles={dashboardAnimation.getAnimationStyles}
              draggedItemId={draggedItem?.i}
              resizingItems={resizingItems}
              appliedFilters={appliedFilters}
              initialFilters={initialFilters}
              dashboardId={dashboardId}
              onViewChart={handleViewChart}
              onEditChart={handleEditChart}
              onViewKpi={handleViewKpi}
              onEditKpi={handleEditKpi}
              onRemove={stableRemoveComponent}
              onUpdate={stableUpdateComponent}
            />
          </div>
        </div>{' '}
        {/* Close Main Content Area */}
        <BuilderModals
          showChartSelector={showChartSelector}
          onCloseChartSelector={() => setShowChartSelector(false)}
          onChartSelected={handleChartSelected}
          excludedChartIds={getExcludedChartIds()}
          showKPISelector={showKPISelector}
          onCloseKPISelector={() => setShowKPISelector(false)}
          onKPISelected={handleKPISelected}
          excludedKPIIds={getExcludedKPIIds()}
          showFilterModal={showFilterModal}
          onCloseFilterModal={closeFilterModal}
          onFilterSave={handleFilterSave}
          selectedFilterForEdit={selectedFilterForEdit}
          dashboardId={dashboardId}
        />
      </div>
    );
  }
);
