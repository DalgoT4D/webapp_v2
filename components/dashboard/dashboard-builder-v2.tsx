'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useCharts } from '@/hooks/api/useChart';
import { useRouter } from 'next/navigation';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDashboard } from '@/hooks/api/useDashboards';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useDashboardAnimation } from '@/hooks/useDashboardAnimation';
import { Filter } from 'lucide-react';
import { UnifiedFiltersPanel } from './unified-filters-panel';
import { TabBar } from './tabs/TabBar';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS, DASHBOARD_UPDATE_SOURCES } from '@/constants/analytics';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import {
  getChartEditUrl,
  getChartViewUrl,
  getKpiEditUrl,
  getKpiViewUrl,
  WIDGET_NAVIGATION_SOURCES,
} from '@/lib/widget-navigation';
import { GRID_ROW_HEIGHT, type ScreenSizeKey } from '@/components/dashboard/grid/grid-constants';
import {
  getActiveEditorTab,
  getPlacedChartIds,
  getPlacedKpiIds,
  normalizeEditorTabs,
  removeWidgetFromLayout,
  updateActiveEditorTab,
  type DashboardEditorState,
} from '@/components/dashboard/logic/editor-state';
import { normalizeBuilderFilters } from '@/components/dashboard/logic/builder-filters';
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

/** Undo history keeps this many steps (E2E: "Undo history keeps 20 steps"). */
const UNDO_HISTORY_DEPTH = 20;

interface DashboardBuilderV2Props {
  dashboardId?: number;
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
export type DashboardBuilderV2Ref = BuilderCleanupHandle;

export const DashboardBuilderV2 = forwardRef<DashboardBuilderV2Ref, DashboardBuilderV2Props>(
  function DashboardBuilderV2(
    { dashboardId, initialData, isNewDashboard, onBack, onPreview, isNavigating },
    ref
  ) {
    const router = useRouter();

    // Normalize every tab up front (computed each render as before; only the first render's
    // value seeds the editor state).
    const initialTabs = normalizeEditorTabs(initialData);

    // Fetch live dashboard data to get updated filters
    const {
      data: liveDashboardData,
      isLoading: isLoadingLiveDashboard,
      isError: isErrorLiveDashboard,
    } = useDashboard(dashboardId!);

    // Log error if live dashboard fetch fails
    if (isErrorLiveDashboard) {
      console.error('Failed to fetch live dashboard data:', {
        dashboardId,
        error: isErrorLiveDashboard,
        context: 'Dashboard filter synchronization',
      });
      // TODO: Add telemetry/error reporting here if available
    }

    // Stable filter source selection: use initialData while loading to avoid mid-lifecycle switches
    // Once loaded, use live data with fallback to initial data
    const dashboardFilters = isLoadingLiveDashboard
      ? initialData?.filters // Stable: don't switch sources while loading
      : liveDashboardData?.filters || initialData?.filters; // Live data once loaded

    // Filters for the panel. Rebuilt every render on purpose (see normalizeBuilderFilters).
    const initialFilters = normalizeBuilderFilters(dashboardFilters);

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

    // Keyboard shortcuts for undo/redo
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('input, textarea, select, [contenteditable="true"], .ProseMirror')) {
          return;
        }
        if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          if (canUndo) undo();
        } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
          e.preventDefault();
          if (canRedo) redo();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo, canUndo, canRedo]);

    // Expose cleanup function to parent component
    useImperativeHandle(
      ref,
      () => ({
        // Returns whether the pending save succeeded, so the Save-and-View path can avoid
        // reporting an update that did not happen. Navigation/unlock still proceed either
        // way — a failed save must not trap the user in the builder.
        cleanup: async (): Promise<boolean> => {
          let saved = false;
          // First save any pending changes
          if (dashboardId) {
            try {
              saved = await saveDashboard();
            } catch (error) {
              console.error('Error saving dashboard before cleanup:', error);
            }
          }

          // Then unlock the dashboard
          if (dashboardId && lockToken) {
            await unlockDashboard();
          }

          // Clear SWR cache to ensure dashboard list refreshes
          try {
            const { mutate } = await import('swr');
            mutate('/api/dashboards/'); // Refresh dashboard list
            if (dashboardId) {
              mutate(`/api/dashboards/${dashboardId}/`); // Refresh current dashboard
            }
          } catch (error) {
            console.error('Error clearing SWR cache:', error);
          }

          return saved;
        },
      }),
      [dashboardId, lockToken, saveDashboard, unlockDashboard]
    );

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

    // Remove component. Anything below the removed widget slides up (gravity-up);
    // side neighbours stay where they are. One history entry.
    const removeComponent = (componentId: string) => {
      const removedComponent = activeComponents[componentId];
      const removedType = removedComponent?.type;

      const nextTab = removeWidgetFromLayout(activeLayout, activeComponents, componentId);

      setState((prev) => updateActiveEditorTab(prev, nextTab));
      trackEvent(ANALYTICS_EVENTS.DASHBOARD_ELEMENT_REMOVED, {
        dashboard_id: dashboardId,
        element_type: removedType,
      });
    };

    // Handle when filters are applied (causes chart re-renders)
    const handleFiltersApplied = (newAppliedFilters: Record<string, any>) => {
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

    // Update component config
    const updateComponent = (componentId: string, newConfig: any) => {
      // Skip constraint-driven updates while the user is dragging to prevent layout jumps.
      // Content constraints (minWidth/minHeight) are stored in config and propagated to RGL
      // as minW/minH; changing them mid-drag causes items to reflow under the pointer.
      if (isDraggingRef.current && newConfig.contentConstraints !== undefined) return;

      setState((prev) => {
        const tab = getActiveEditorTab(prev);
        return updateActiveEditorTab(prev, {
          components: {
            ...tab.components,
            [componentId]: {
              ...tab.components[componentId],
              config: newConfig,
            },
          },
        });
      });
    };

    // Stable ref-stabilized callbacks for DashboardCell so React.memo can do its job.
    // Each wraps a mutable ref so the stable identity never goes stale.
    const removeComponentRef = useRef(removeComponent);
    removeComponentRef.current = removeComponent;
    const stableRemoveComponent = useCallback((id: string) => removeComponentRef.current(id), []);

    const updateComponentRef = useRef(updateComponent);
    updateComponentRef.current = updateComponent;
    const stableUpdateComponent = useCallback(
      (id: string, config: any) => updateComponentRef.current(id, config),
      []
    );

    const handleViewChart = useCallback(
      (chartId: number) => {
        router.push(getChartViewUrl(chartId, WIDGET_NAVIGATION_SOURCES.DASHBOARD));
      },
      [router]
    );

    const handleEditChart = useCallback(
      (chartId: number) => {
        router.push(getChartEditUrl(chartId, WIDGET_NAVIGATION_SOURCES.DASHBOARD));
      },
      [router]
    );

    const handleViewKpi = useCallback(
      (kpiId: number) => {
        router.push(getKpiViewUrl(kpiId, WIDGET_NAVIGATION_SOURCES.DASHBOARD));
      },
      [router]
    );

    const handleEditKpi = useCallback(
      (kpiId: number) => {
        router.push(getKpiEditUrl(kpiId, WIDGET_NAVIGATION_SOURCES.DASHBOARD));
      },
      [router]
    );

    // Title edit ends (Enter or blur): blank → "Untitled Dashboard", then save.
    const handleTitleCommit = () => {
      const finalTitle = title.trim() || 'Untitled Dashboard';
      setTitle(finalTitle);
      setIsEditingTitle(false);
      saveDashboard();
    };

    // PINNED-BUGS: ""No charts → go create one" redirect can never fire — builder expects plain array, API returns paginated object"
    const handleAddChartClick = () => {
      if (!chartsLoading && chartsData && Array.isArray(chartsData) && chartsData.length === 0) {
        router.push('/charts/new?from=dashboard');
      } else {
        setShowChartSelector(true);
      }
    };

    const handleSaveClick = async () => {
      // Fire only on explicit user save (not the autosave/title-blur/resize
      // paths), and only once the PUT has actually succeeded — saveDashboard
      // handles its own errors, so firing before the await counted failed
      // saves as updates. The Save-and-View path fires the same event from
      // the edit page with source: SAVE_AND_VIEW.
      const saved = await saveDashboard();
      if (saved) {
        trackEvent(ANALYTICS_EVENTS.DASHBOARD_UPDATED, {
          dashboard_id: dashboardId,
          source: DASHBOARD_UPDATE_SOURCES.SAVE_BUTTON,
        });
      }
      const walkthrough = useInsightWalkthroughStore.getState();
      if (
        walkthrough.active &&
        (walkthrough.stage === 'builder_save' || walkthrough.stage === 'builder_resize')
      ) {
        walkthrough.advanceTo('builder_preview');
      }
    };

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
        {/* Horizontal Filters Bar */}
        {filterLayout === 'horizontal' && !isFiltersCollapsed && (
          <UnifiedFiltersPanel
            initialFilters={initialFilters}
            dashboardId={dashboardId!}
            isEditMode={true}
            layout="horizontal"
            onAddFilter={openFilterModal}
            onEditFilter={handleEditFilter}
            onFiltersApplied={handleFiltersApplied}
            onFiltersCleared={handleFiltersCleared}
            onCollapseChange={setIsFiltersCollapsed}
          />
        )}
        {/* Show Filters Button - appears when horizontal filters are collapsed */}
        {filterLayout === 'horizontal' && isFiltersCollapsed && initialFilters.length > 0 && (
          <div className="border-b border-gray-200 bg-white p-2">
            <div className="flex items-center justify-center">
              <Button
                onClick={() => setIsFiltersCollapsed(false)}
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                data-testid="dashboard-builder-show-filters-btn"
              >
                <Filter className="w-3 h-3 mr-1" />
                Show Filters ({initialFilters.length})
              </Button>
            </div>
          </div>
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
