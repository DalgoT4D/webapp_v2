'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useCharts } from '@/hooks/api/useChart';
import { useRouter } from 'next/navigation';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { ChartSelectorModal } from './chart-selector-modal';
import { KPISelectorModal } from './kpi-selector-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import {
  refreshDashboardLock,
  updateDashboardFilter,
  createDashboardFilter,
  deleteDashboardFilter,
  useDashboard,
  type DashboardFilter,
} from '@/hooks/api/useDashboards';
import { useDebounce } from '@/hooks/useDebounce';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useDashboardAnimation } from '@/hooks/useDashboardAnimation';
import {
  getDefaultGridDimensions,
  getMinGridDimensions,
  getChartTypeFromConfig,
  calculateTextDimensions,
} from '@/lib/chart-size-constraints';
import { compactVertical, bottomY } from '@/lib/dashboard-animation-utils';
import {
  Plus,
  Save,
  Undo,
  Redo,
  Loader2,
  Type,
  Check,
  AlertCircle,
  Filter,
  ArrowLeft,
  Eye,
  Edit,
  Target,
} from 'lucide-react';
// Removed toast import - using console for notifications
// Charts, KPIs and text are rendered via DashboardCell
import { FilterConfigModal } from './filter-config-modal';
import { UnifiedFiltersPanel } from './unified-filters-panel';
import { DashboardCell } from './DashboardCell';
import { TabBar } from './tabs/TabBar';
import {
  DASHBOARD_RICH_TEXT_FLUSH_EVENT,
  DASHBOARD_WIDGET_DRAG_START_EVENT,
  type RichTextFlushEventDetail,
  type UnifiedTextConfig,
} from './text-element-unified';
import {
  DashboardFilterType,
  type CreateFilterPayload,
  type DashboardFilterConfig,
  type ValueFilterSettings,
  type NumericalFilterSettings,
  type DateTimeFilterSettings,
} from '@/types/dashboard-filters';
import { DashboardComponentType, type DashboardTab } from '@/types/dashboard';
import { initializeTabsData } from './tabs/tab-utils';
import { moveWidgetBetweenTabs, pointerToGridPosition } from './tabs/cross-tab-drag';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS, DASHBOARD_UPDATE_SOURCES } from '@/constants/analytics';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { useAuthStore } from '@/stores/authStore';
import {
  markChartAddedToDashboard,
  markKpiAddedToDashboard,
} from '@/components/onboarding/insight-walkthrough-constants';

// Grid layout constants
const ROW_HEIGHT = 20;
// Grid is fixed at 12 columns regardless of viewport (Superset-style). The grid model
// gives each widget its own (x, y, w, h); RGL's vertical compaction (gravity-up) is the
// only automatic behavior. New widgets land full-width at the bottom of the canvas.
const FLUID_GRID_COLS = 12;
const FULL_WIDTH_COLS = 12;

// Autoscroll while dragging near a canvas edge (DALGO-1219: drag bottom→top must reach the top).
// Distance from the edge (px) at which autoscroll engages.
const AUTOSCROLL_EDGE_PX = 60;
// Max scroll speed (px/frame), capped to prevent runaway scroll. Spec: ~30px/frame.
const AUTOSCROLL_MAX_SPEED_PX = 30;
const CROSS_TAB_HOVER_DELAY_MS = 500;
const GRID_MARGIN = 8;
const GRID_PADDING = 8;

// Max length for the dashboard description (keeps the header compact).
const DESCRIPTION_MAX_LENGTH = 100;

/**
 * Compact description trigger in the header that opens an anchored popover with
 * a full textarea. Save commits (caller persists via onSave); Escape / outside
 * click reverts to the pre-edit value.
 */
function DashboardDescriptionEditor({
  value,
  onChange,
  onSave,
  testId,
}: {
  value: string;
  onChange: (next: string) => void;
  onSave: () => void;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  // Snapshot captured when the popover opens, used to revert on dismiss
  const snapshotRef = useRef(value);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      snapshotRef.current = value;
    } else {
      // Dismissed without an explicit Save -> revert unsaved edits
      onChange(snapshotRef.current);
    }
    setOpen(next);
  };

  const handleSave = () => {
    setOpen(false);
    onSave();
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-left rounded px-2 py-0.5 hover:bg-gray-50 max-w-full"
          data-testid={`${testId}-display`}
        >
          {value ? (
            <span className="block truncate text-xs text-gray-600">{value}</span>
          ) : (
            <span className="text-xs text-gray-400 italic">+ Add description</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${testId}-input`} className="text-sm font-medium">
            Dashboard description
          </Label>
          <Textarea
            id={`${testId}-input`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Describe what this dashboard shows (optional)..."
            className="h-24 resize-none text-sm"
            maxLength={DESCRIPTION_MAX_LENGTH}
            autoFocus
            data-testid={`${testId}-input`}
            onKeyDown={(e) => {
              // Cmd/Ctrl+Enter saves; Escape is handled by the Popover (reverts)
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                handleSave();
              }
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {value.length}/{DESCRIPTION_MAX_LENGTH}
            </span>
            <Button size="sm" onClick={handleSave} data-testid={`${testId}-save`}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Convert DashboardFilter (API response) to DashboardFilterConfig (frontend format)
function convertFilterToConfig(
  filter: DashboardFilter,
  position: { x: number; y: number; w: number; h: number }
): DashboardFilterConfig | null {
  // Validate required filter properties
  if (!filter || !filter.id || !filter.schema_name || !filter.table_name || !filter.column_name) {
    console.error('Invalid filter data:', filter);
    return null;
  }

  const baseConfig = {
    id: filter.id.toString(),
    name: filter.name || filter.column_name || 'Unnamed Filter',
    schema_name: filter.schema_name,
    table_name: filter.table_name,
    column_name: filter.column_name,
    filter_type: filter.filter_type as DashboardFilterType,
    position,
  };

  // Ensure settings object exists
  const settings = filter.settings || {};

  if (filter.filter_type === 'value') {
    return {
      ...baseConfig,
      filter_type: DashboardFilterType.VALUE,
      settings: {
        has_default_value: false,
        can_select_multiple: false,
        ...settings,
      } as ValueFilterSettings,
    };
  } else if (filter.filter_type === 'numerical') {
    return {
      ...baseConfig,
      filter_type: DashboardFilterType.NUMERICAL,
      settings: {
        ...settings,
      } as NumericalFilterSettings,
    };
  } else if (filter.filter_type === 'datetime') {
    return {
      ...baseConfig,
      filter_type: DashboardFilterType.DATETIME,
      settings: {
        ...settings,
      } as DateTimeFilterSettings,
    };
  } else {
    // Fallback to VALUE type for unknown types
    return {
      ...baseConfig,
      filter_type: DashboardFilterType.VALUE,
      settings: {
        has_default_value: false,
        can_select_multiple: false,
        ...settings,
      } as ValueFilterSettings,
    };
  }
}

// Types
// DashboardComponentType is imported from '@/types/dashboard' (single source, includes KPI).

interface DashboardLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
}

// Define responsive breakpoints and column configurations
// Superset-style: Always 12 columns, they just scale with container width
const BREAKPOINTS = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0,
};

// Fixed 12 columns at all breakpoints - columns scale with container width
const COLS = {
  lg: 12,
  md: 12,
  sm: 12,
  xs: 12,
  xxs: 12,
};

// Screen size configurations for targeted design
// All use 12 columns - the column width scales based on container size
const SCREEN_SIZES = {
  desktop: {
    name: 'Desktop',
    width: 1200,
    height: 800,
    cols: 12,
    breakpoint: 'lg',
  },
  tablet: {
    name: 'Tablet',
    width: 768,
    height: 1024,
    cols: 12,
    breakpoint: 'sm',
  },
  mobile: {
    name: 'Mobile',
    width: 375,
    height: 667,
    cols: 12,
    breakpoint: 'xxs',
  },
};

type ScreenSizeKey = keyof typeof SCREEN_SIZES;

// Type for responsive layouts
type ResponsiveLayouts = {
  [key: string]: DashboardLayout[];
};

interface DashboardComponent {
  id: string;
  type: DashboardComponentType;
  config: any;
}

interface DashboardEditorState {
  tabs: DashboardTab[];
  activeTabId: string;
}

interface DashboardSavePayloadOverrides {
  filter_layout?: 'vertical' | 'horizontal';
}

interface CrossTabDragSession {
  componentId: string;
  componentType: DashboardComponentType;
  sourceTabId: string;
  hoverTabId: string | null;
  targetTabId: string | null;
  item: DashboardLayout;
  clientX: number;
  clientY: number;
  targetPosition: { x: number; y: number } | null;
  phase: 'grid' | 'handoff';
}

function getActiveEditorTab(state: DashboardEditorState): DashboardTab {
  return state.tabs.find((tab) => tab.id === state.activeTabId) || state.tabs[0];
}

function updateActiveEditorTab(
  state: DashboardEditorState,
  update: Partial<Pick<DashboardTab, 'layout_config' | 'components'>>
): DashboardEditorState {
  return {
    ...state,
    tabs: state.tabs.map((tab) => (tab.id === state.activeTabId ? { ...tab, ...update } : tab)),
  };
}

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

// Interface for the ref methods exposed to parent
interface DashboardBuilderV2Ref {
  /** Saves pending changes, unlocks, refreshes caches. Resolves to whether the save
   *  succeeded — callers must not report an update the PUT never completed. */
  cleanup: () => Promise<boolean>;
}

// Helper function to generate responsive layouts from base layout
// With fixed 12 columns (Superset-style), all breakpoints use the same layout
function generateResponsiveLayouts(layout: DashboardLayout[]): ResponsiveLayouts {
  const layouts: ResponsiveLayouts = {};

  // Since all breakpoints use 12 columns (Superset-style),
  // the same layout works for all screen sizes - columns just scale in width
  Object.keys(COLS).forEach((breakpoint) => {
    // Use the same layout for all breakpoints - the grid columns scale with container width
    layouts[breakpoint] = layout.map((item) => ({
      ...item,
      // Ensure valid constraints
      w: Math.max(1, Math.min(item.w, 12)),
      x: Math.max(0, Math.min(item.x, 12 - Math.max(1, item.w))),
      y: Math.max(0, item.y),
      minW: Math.max(1, Math.min(item.minW || 1, 12)),
      minH: item.minH || 1,
      maxW: 12,
    }));
  });

  return layouts;
}

export const DashboardBuilderV2 = forwardRef<DashboardBuilderV2Ref, DashboardBuilderV2Props>(
  function DashboardBuilderV2(
    { dashboardId, initialData, isNewDashboard, onBack, onPreview, isNavigating },
    ref
  ) {
    const router = useRouter();

    // Canvas is always driven by tab content — layout and components live inside tabs only.
    // If tabs exist, load the first tab's canvas. Otherwise start empty (new dashboard).
    const firstTab =
      initialData?.tabs && Array.isArray(initialData.tabs) && initialData.tabs.length > 0
        ? initialData.tabs[0]
        : null;

    let initialLayout = Array.isArray(firstTab?.layout_config) ? firstTab.layout_config : [];
    const initialComponents = firstTab?.components ?? {};

    // Helper function to ensure text components have content constraints
    const ensureTextContentConstraints = (components: any) => {
      const updatedComponents = { ...components };
      Object.keys(updatedComponents).forEach((componentId) => {
        const component = updatedComponents[componentId];
        if (component.type === DashboardComponentType.TEXT && component.config) {
          // Calculate content constraints if they don't exist (for both empty and filled content)
          if (!component.config.contentConstraints) {
            const textDimensions = calculateTextDimensions({
              content: component.config.content || '', // Handle empty content
              fontSize: component.config.fontSize || 16,
              fontWeight: component.config.fontWeight || 'normal',
              type: component.config.type || 'paragraph',
              textAlign: component.config.textAlign || 'left',
            });

            updatedComponents[componentId] = {
              ...component,
              config: {
                ...component.config,
                contentConstraints: {
                  minWidth: textDimensions.width,
                  minHeight: textDimensions.height,
                },
              },
            };

            console.log(`📐 Added missing content constraints for text component ${componentId}:`, {
              content: component.config.content,
              constraints: {
                minWidth: textDimensions.width,
                minHeight: textDimensions.height,
              },
            });
          }
        }
      });
      return updatedComponents;
    };

    const rawInitialTabs = initializeTabsData(
      initialData?.tabs,
      Array.isArray(initialData?.layout_config) ? initialData.layout_config : [],
      initialData?.components || {}
    ).tabs;

    // Normalize every tab up front. Tabs are the single source of truth for the canvas,
    // so inactive tabs must receive the same constraints as the initially visible tab.
    const initialTabs = rawInitialTabs.map((tab) => {
      const components = ensureTextContentConstraints(tab.components || {});
      const layout = (Array.isArray(tab.layout_config) ? tab.layout_config : []).map(
        (item: DashboardLayout) => {
          const component = components[item.i];
          if (!component) return item;
          const chartType = getChartTypeFromConfig(component.config);
          const baseMinDimensions = getMinGridDimensions(chartType);
          return {
            ...item,
            w: item.w || baseMinDimensions.w,
            h: item.h || baseMinDimensions.h,
            minW: baseMinDimensions.w,
            minH: baseMinDimensions.h,
            maxW: FULL_WIDTH_COLS,
          };
        }
      );
      return { ...tab, layout_config: layout, components };
    });

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

    // Load filters from backend with proper error handling
    const initialFilters = Array.isArray(dashboardFilters)
      ? dashboardFilters
          .map((filter: any) => {
            // Validate filter data before processing
            if (
              !filter ||
              !filter.id ||
              !filter.schema_name ||
              !filter.table_name ||
              !filter.column_name
            ) {
              console.warn('Skipping invalid filter:', filter);
              return null;
            }

            return {
              id: filter.id,
              name: filter.name || filter.column_name || 'Unnamed Filter',
              schema_name: filter.schema_name,
              table_name: filter.table_name,
              column_name: filter.column_name,
              filter_type: filter.filter_type || 'value', // Default to 'value' if missing
              settings: filter.settings || {},
            };
          })
          .filter(Boolean) // Remove null entries
      : [];

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
      20
    );

    // Create custom undo/redo functions that prevent auto-save interference
    const undo = useCallback(() => {
      undoBase();
      // Set flag after operation to prevent subsequent auto-save interference
      setIsUndoRedoOperation(true);
      setTimeout(() => {
        setIsUndoRedoOperation(false);
      }, 1000); // Longer delay to prevent auto-save after undo
    }, [undoBase]);

    const redo = useCallback(() => {
      redoBase();
      // Set flag after operation to prevent subsequent auto-save interference
      setIsUndoRedoOperation(true);
      setTimeout(() => {
        setIsUndoRedoOperation(false);
      }, 1000); // Longer delay to prevent auto-save after redo
    }, [redoBase]);

    // Applied filters state - only updates when filters are applied (causes chart re-renders)
    const [appliedFilters, setAppliedFilters] = useState<Record<string, any>>({});

    // Get initial target screen size from initialData, default to desktop
    const initialTargetScreenSize: ScreenSizeKey =
      (initialData?.target_screen_size as ScreenSizeKey) || 'desktop';

    // Target screen size state (separate from undo/redo state)
    const [targetScreenSize, setTargetScreenSize] =
      useState<ScreenSizeKey>(initialTargetScreenSize);

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
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [selectedFilterForEdit, setSelectedFilterForEdit] = useState<DashboardFilter | null>(
      null
    );
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [saveError, setSaveError] = useState<string | null>(null);
    const [lockToken, setLockToken] = useState<string | null>(null);
    const [lockRefreshInterval, setLockRefreshInterval] = useState<NodeJS.Timeout | null>(null);
    const lockRequestInFlightRef = useRef(false);
    const hasDashboardLockRef = useRef(false);

    // Filters panel collapse state
    const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);

    // Refs to store current values for event handlers without causing re-renders
    const lockStateRef = useRef({ dashboardId, lockToken, lockRefreshInterval });

    // Update refs when values change
    useEffect(() => {
      lockStateRef.current = { dashboardId, lockToken, lockRefreshInterval };
    }, [dashboardId, lockToken, lockRefreshInterval]);
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

    const flushActiveRichText = useCallback((): DashboardEditorState => {
      const detail: RichTextFlushEventDetail = { updates: [] };
      document.dispatchEvent(new CustomEvent(DASHBOARD_RICH_TEXT_FLUSH_EVENT, { detail }));
      if (!detail.updates.length) return stateRef.current;

      const nextState = detail.updates.reduce<DashboardEditorState>(
        (currentState, update) => ({
          ...currentState,
          tabs: currentState.tabs.map((tab) =>
            tab.components[update.componentId]
              ? {
                  ...tab,
                  components: {
                    ...tab.components,
                    [update.componentId]: {
                      ...tab.components[update.componentId],
                      config: update.config,
                    },
                  },
                }
              : tab
          ),
        }),
        stateRef.current
      );
      stateRef.current = nextState;
      setState(nextState);
      return nextState;
    }, [setState]);
    const [showSettings, setShowSettings] = useState(false);
    const [resizingItems, setResizingItems] = useState<Set<string>>(new Set());
    const [containerWidth, setContainerWidth] = useState(
      SCREEN_SIZES[targetScreenSize]?.width || 1200
    );
    const [actualContainerWidth, setActualContainerWidth] = useState(
      SCREEN_SIZES[targetScreenSize]?.width || 1200
    );

    // Responsive layout hook
    const responsive = useResponsiveLayout();

    // Get current screen size config
    const currentScreenConfig = SCREEN_SIZES[targetScreenSize];

    // Dashboard animation hook
    // Note: spaceMakingConfig.enabled is set to false to prevent charts from
    // automatically moving/squeezing when dragging near them
    const dashboardAnimation = useDashboardAnimation({
      gridCols: currentScreenConfig.cols,
      containerWidth: actualContainerWidth,
      rowHeight: ROW_HEIGHT,
      enabled: true,
      spaceMakingConfig: {
        enabled: false, // Disable automatic space-making to preserve layout alignment
      },
    });

    // Track actual dashboard container height for snap indicators
    const [dashboardActualHeight, setDashboardActualHeight] = useState(
      Math.max(currentScreenConfig.height, 400)
    );

    // Filter layout state with responsive behavior
    const [userFilterLayoutChoice, setUserFilterLayoutChoice] = useState<'vertical' | 'horizontal'>(
      (initialData?.filter_layout as 'vertical' | 'horizontal') || 'vertical'
    );

    // Effective filter layout (combines user choice with responsive logic)
    // For desktop: always use vertical (sidebar), for mobile/tablet: use horizontal (top bar)
    const filterLayout = responsive.isDesktop ? 'vertical' : 'horizontal';

    // Ref for the canvas container (gray area)
    const canvasRef = useRef<HTMLDivElement>(null);
    // Ref for the white dashboard container (actual boundary)
    const dashboardContainerRef = useRef<HTMLDivElement>(null);

    // Smart scroll function - only scrolls if component is actually out of view
    const scrollToComponentIfNeeded = (componentId: string) => {
      setTimeout(() => {
        if (!canvasRef.current || !dashboardContainerRef.current) return;

        const canvas = canvasRef.current;
        const dashboardContainer = dashboardContainerRef.current;

        // Find the newly added component element
        const componentElement = canvas.querySelector(`[data-component-id="${componentId}"]`);
        if (!componentElement) return;

        // Get container and component positions
        const canvasRect = canvas.getBoundingClientRect();
        const componentRect = componentElement.getBoundingClientRect();

        // Check if component is actually outside the visible area
        const isComponentBelowView = componentRect.bottom > canvasRect.bottom;
        const isComponentAboveView = componentRect.top < canvasRect.top;

        // Only scroll if there's actual content to scroll and component is out of view
        const hasScrollableContent = canvas.scrollHeight > canvas.clientHeight;
        const needsScroll = hasScrollableContent && (isComponentBelowView || isComponentAboveView);

        if (needsScroll) {
          // Smart scroll: scroll to show the component, not just to bottom
          if (isComponentBelowView) {
            // Scroll down to show component
            canvas.scrollTo({
              top: canvas.scrollTop + (componentRect.bottom - canvasRect.bottom) + 20, // 20px padding
              behavior: 'smooth',
            });
          } else if (isComponentAboveView) {
            // Scroll up to show component
            canvas.scrollTo({
              top: canvas.scrollTop - (canvasRect.top - componentRect.top) - 20, // 20px padding
              behavior: 'smooth',
            });
          }
        }
      }, 100); // Small delay to ensure component is rendered
    };

    // Track if we're in an undo/redo operation to prevent auto-save interference
    const [isUndoRedoOperation, setIsUndoRedoOperation] = useState(false);

    // Debounced state for auto-save (keep original 5-second delay for responsive auto-save)
    const debouncedState = useDebounce(state, 5000);

    // Update container width when target screen size changes
    useEffect(() => {
      const newWidth = SCREEN_SIZES[targetScreenSize].width;
      setContainerWidth(newWidth);
      setActualContainerWidth(newWidth);
    }, [targetScreenSize]);

    // Sync dashboardActualHeight when screen config changes (ResizeObserver may not fire on config change)
    useEffect(() => {
      setDashboardActualHeight((prevHeight) =>
        Math.max(prevHeight, currentScreenConfig.height, 400)
      );
    }, [currentScreenConfig.height, targetScreenSize]);

    // Observe WHITE dashboard container for responsive width (not gray outer container)
    useEffect(() => {
      if (!dashboardContainerRef.current) return undefined;

      const handleResize = (entries: ResizeObserverEntry[]): void => {
        for (const entry of entries) {
          const { width } = entry.contentRect;
          // Use full available WHITE container width - let charts fill all available space
          setActualContainerWidth(width);

          // Track actual container height for snap indicators
          // Use scrollHeight to get the full content height including overflow
          const actualHeight = (entry.target as HTMLElement).scrollHeight;
          setDashboardActualHeight(Math.max(actualHeight, currentScreenConfig.height, 400));
        }
      };

      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(dashboardContainerRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }, [containerWidth, currentScreenConfig.height]);

    // Save target screen size changes (separate from auto-save to avoid conflicts)
    useEffect(() => {
      // Only save if this is not the initial render and we have a dashboard ID
      if (dashboardId && targetScreenSize !== initialTargetScreenSize) {
        const timeoutId = setTimeout(async () => {
          try {
            await saveDashboard();
          } catch (error) {
            console.error('Error saving target screen size:', error);
          }
        }, 500); // Longer delay to ensure it doesn't conflict with other saves

        return () => clearTimeout(timeoutId);
      }
      // Return undefined when condition is not met
      return undefined;
    }, [targetScreenSize, dashboardId]); // Keep the dependency but add initial value check

    // Initial lock acquisition - only run once when dashboard changes
    useEffect(() => {
      if (dashboardId) {
        lockDashboard();
      }

      // Cleanup only on dashboard change or unmount
      return () => {
        if (dashboardId) {
          unlockDashboard();
        }
      };
    }, [dashboardId]); // Only depend on dashboardId

    // Set up cleanup event listeners once (use refs to access latest values)
    useEffect(() => {
      // Handle page unload/navigation
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        // Use current values from ref
        const { dashboardId: currentDashboardId, lockToken: currentLockToken } =
          lockStateRef.current;
        if (currentDashboardId && currentLockToken) {
          navigator.sendBeacon(
            `/api/dashboards/${currentDashboardId}/lock/`,
            JSON.stringify({ method: 'DELETE' })
          );
        }
      };

      // Handle visibility change (tab switching, minimizing)
      const handleVisibilityChange = () => {
        // Only unlock if user switches away, not when returning
        if (document.hidden) {
          const { dashboardId: currentDashboardId, lockToken: currentLockToken } =
            lockStateRef.current;
          if (currentDashboardId && currentLockToken) {
            // Use fetch with keepalive for more reliable cleanup
            fetch(`/api/dashboards/${currentDashboardId}/lock/`, {
              method: 'DELETE',
              keepalive: true,
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`,
                'x-dalgo-org': localStorage.getItem('selectedOrg') || '',
              },
            }).catch(console.error);
          }
        }
      };

      // Add event listeners only once
      window.addEventListener('beforeunload', handleBeforeUnload);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }, []); // No dependencies - set up once

    // Cleanup interval when component unmounts or lock changes
    useEffect(() => {
      return () => {
        if (lockRefreshInterval) {
          clearInterval(lockRefreshInterval);
        }
      };
    }, [lockRefreshInterval]);

    // Auto-save (but not during undo/redo operations).
    // Deliberately NOT tracked in analytics: autosave is time-triggered, not user
    // intent, and useDebounce seeds with its initial value so this effect also runs
    // on mount — any event here would log builder opens as edits. DASHBOARD_UPDATED
    // fires only from the explicit Save / Save-and-View buttons.
    useEffect(() => {
      if (dashboardId && debouncedState && !isUndoRedoOperation) {
        saveDashboard({}, false);
      }
    }, [debouncedState, isUndoRedoOperation]);

    // Component unmount cleanup
    useEffect(() => {
      return () => {
        // Clean up on component unmount
        if (lockRefreshInterval) {
          clearInterval(lockRefreshInterval);
        }
        if (dashboardId && lockToken) {
          // Note: This won't work reliably on page refresh, but handles component unmount
          unlockDashboard();
        }
      };
    }, []); // Empty dependencies - cleanup on unmount only

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

    // Lock dashboard for editing with auto-refresh setup
    const lockDashboard = async () => {
      if (!dashboardId || lockRequestInFlightRef.current || hasDashboardLockRef.current) return;

      lockRequestInFlightRef.current = true;

      // Clear any existing interval first
      if (lockRefreshInterval) {
        clearInterval(lockRefreshInterval);
        setLockRefreshInterval(null);
      }

      try {
        const response = await apiPost(`/api/dashboards/${dashboardId}/lock/`, {});
        hasDashboardLockRef.current = true;
        setLockToken(response.lock_token);

        // Set up auto-refresh every 60 seconds (half of 2-minute lock duration)
        const interval = setInterval(async () => {
          try {
            await refreshDashboardLock(dashboardId!);
          } catch (error) {
            console.error('Failed to refresh lock:', error);
            // If refresh fails, clear interval and update UI
            clearInterval(interval);
            setLockRefreshInterval(null);
            setLockToken(null);
          }
        }, 60000); // 60 seconds

        setLockRefreshInterval(interval);
      } catch (error: any) {
        console.error('Failed to lock dashboard:', error.message);

        // If dashboard is locked by another user (423 error), redirect to dashboard list
        if (error.status === 423 || error.message?.includes('locked by')) {
          alert(`This dashboard is currently being edited by another user: ${error.message}`);
          // Redirect back to dashboard list
          if (typeof window !== 'undefined') {
            window.location.href = '/dashboards';
          }
          return;
        }

        // For other errors, just log them
        console.error('Lock acquisition failed:', error.message || 'Unknown error');
      } finally {
        lockRequestInFlightRef.current = false;
      }
    };

    // Unlock dashboard with cleanup
    const unlockDashboard = async () => {
      if (!dashboardId) return;

      try {
        // Clear refresh interval first
        if (lockRefreshInterval) {
          clearInterval(lockRefreshInterval);
          setLockRefreshInterval(null);
        }

        // Only make API call if we have a lock token
        if (lockToken) {
          await apiDelete(`/api/dashboards/${dashboardId}/lock/`);
        }

        setLockToken(null);
        hasDashboardLockRef.current = false;
      } catch (error) {
        console.error('Failed to unlock dashboard:', error);
      }
    };

    // Save dashboard.
    // Resolves to whether the PUT succeeded. Errors are handled here (save status + inline
    // error) rather than thrown, so without a return value a caller cannot tell a failed
    // save from a successful one — and DASHBOARD_UPDATED must never count a failure.
    const saveDashboard = async (
      overrides: DashboardSavePayloadOverrides = {},
      flushRichText = true
    ): Promise<boolean> => {
      if (!dashboardId) return false;

      const editorState = flushRichText ? flushActiveRichText() : stateRef.current;

      setIsSaving(true);
      setSaveStatus('saving');
      setSaveError(null);

      try {
        // Filters are no longer included in dashboard PUT payload - managed via separate endpoints

        // Ensure title is not empty, use default if needed
        const finalTitle = title.trim() || 'Untitled Dashboard';

        // Create safe serializable payload (filters removed - managed independently)
        const payload = {
          title: finalTitle,
          description,
          grid_columns: SCREEN_SIZES[targetScreenSize].cols,
          target_screen_size: targetScreenSize,
          filter_layout: filterLayout,
          tabs: JSON.parse(JSON.stringify(editorState.tabs)),
          // filters removed - managed via separate API endpoints
          ...overrides, // Apply any overrides passed to the function
        };

        await apiPut(`/api/dashboards/${dashboardId}/`, payload);

        setSaveStatus('saved');
        // Reset save status after 3 seconds
        setTimeout(() => {
          setSaveStatus('idle');
        }, 3000);
        return true;
      } catch (error: any) {
        console.error('Failed to save dashboard:', error.message || 'Please try again');
        setSaveStatus('error');
        setSaveError(error.message || 'Failed to save dashboard. Please try again.');

        // Reset error status after 5 seconds
        setTimeout(() => {
          setSaveStatus('idle');
          setSaveError(null);
        }, 5000);
        return false;
      } finally {
        setIsSaving(false);
      }
    };

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

    // Track if we're currently dragging (for cursor/visual state on the dragged cell)
    const [isDragging, setIsDragging] = useState(false);
    const [draggedItem, setDraggedItem] = useState<DashboardLayout | null>(null);
    const [crossTabDrag, setCrossTabDrag] = useState<CrossTabDragSession | null>(null);
    const crossTabDragRef = useRef<CrossTabDragSession | null>(null);
    const crossTabHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      crossTabDragRef.current = crossTabDrag;
    }, [crossTabDrag]);

    // ===== Tab Handlers =====

    // Tab selection is navigation, not an edit, so it does not add a history entry.
    const handleTabChange = useCallback(
      (tabId: string) => {
        if (!stateRef.current.tabs.some((tab) => tab.id === tabId)) return;
        flushActiveRichText();
        setDragPreviewTabId(null);
        setStateWithoutHistory((prev) => ({ ...prev, activeTabId: tabId }));
      },
      [flushActiveRichText, setStateWithoutHistory]
    );

    // The three tab-lifecycle events fire from these handlers rather than from TabBar,
    // which has no dashboardId. Every add/remove/rename control in TabBar funnels through
    // here, so this is also the one place that can't be bypassed by a new button.
    const handleTabAdd = useCallback(
      (newTab: DashboardTab) => {
        setState((prev) => ({
          tabs: [...prev.tabs, newTab],
          activeTabId: newTab.id,
        }));
        trackEvent(ANALYTICS_EVENTS.DASHBOARD_TAB_CREATED, { dashboard_id: dashboardId });
      },
      [setState]
    );

    // Handle removing a tab
    const handleTabRemove = useCallback(
      (tabId: string) => {
        let removed = false;
        setState((prev) => {
          if (prev.tabs.length <= 1) return prev;
          const tabIndex = prev.tabs.findIndex((tab) => tab.id === tabId);
          if (tabIndex < 0) return prev;
          const tabs = prev.tabs.filter((tab) => tab.id !== tabId);
          const activeTabId =
            prev.activeTabId === tabId
              ? tabs[Math.max(0, tabIndex - 1)]?.id || tabs[0].id
              : prev.activeTabId;
          removed = true;
          return { tabs, activeTabId };
        });
        // Only on a real removal — the last tab can't be deleted, and an unknown id is a
        // no-op, so tracking before this guard would count deletions that never happened.
        if (removed) {
          trackEvent(ANALYTICS_EVENTS.DASHBOARD_TAB_DELETED, { dashboard_id: dashboardId });
        }
      },
      [setState]
    );

    // Handle renaming a tab
    const handleTabRename = useCallback(
      (tabId: string, newTitle: string) => {
        setState((prev) => ({
          ...prev,
          tabs: prev.tabs.map((tab) => (tab.id === tabId ? { ...tab, title: newTitle } : tab)),
        }));
        trackEvent(ANALYTICS_EVENTS.DASHBOARD_TAB_RENAMED, { dashboard_id: dashboardId });
      },
      [setState]
    );

    const handleTabReorder = useCallback(
      (tabId: string, toIndex: number) => {
        const currentTabs = stateRef.current.tabs;
        const fromIndex = currentTabs.findIndex((tab) => tab.id === tabId);
        const destinationIndex = Math.max(0, Math.min(currentTabs.length - 1, toIndex));
        if (fromIndex < 0 || destinationIndex === fromIndex) return;

        setState((prev) => {
          const nextFromIndex = prev.tabs.findIndex((tab) => tab.id === tabId);
          if (nextFromIndex < 0) return prev;
          const nextDestinationIndex = Math.max(0, Math.min(prev.tabs.length - 1, toIndex));
          const tabs = [...prev.tabs];
          const [movedTab] = tabs.splice(nextFromIndex, 1);
          tabs.splice(nextDestinationIndex, 0, movedTab);
          return { ...prev, tabs };
        });
        trackEvent(ANALYTICS_EVENTS.DASHBOARD_TAB_REORDERED, {
          dashboard_id: dashboardId,
          from_index: fromIndex,
          to_index: destinationIndex,
        });
      },
      [setState]
    );

    // ===== End Tab Handlers =====

    // IMPORTANT: Use refs for synchronous access in callbacks
    // React state updates are async, but react-grid-layout calls handlers synchronously
    const isDraggingRef = useRef(false);

    // Reapply per-component min-size constraints to a layout returned by RGL. Positions are
    // owned by RGL's grid model; this only clamps w/h and stamps minW/minH/maxW so subsequent
    // drags/resizes enforce them natively. Text widgets use content-aware minimums.
    const applyItemConstraints = useCallback((items: DashboardLayout[]): DashboardLayout[] => {
      const components = getActiveEditorTab(stateRef.current).components;
      return items.map((item) => {
        const component = components[item.i];
        if (!component) return item;
        const chartType = getChartTypeFromConfig(component.config);
        // Always use base chart-type constraints for resize limits so every
        // component (including text) stays freely resizable. This matches the
        // initial-load and creation paths. Previously text used the stored
        // contentConstraints here, which ratcheted minW/minH up after the first
        // resize/drag and blocked any further shrinking.
        const minDimensions = getMinGridDimensions(chartType);
        return {
          ...item,
          w: Math.max(item.w, minDimensions.w),
          h: Math.max(item.h, minDimensions.h),
          minW: minDimensions.w,
          minH: minDimensions.h,
          maxW: FULL_WIDTH_COLS,
        };
      });
    }, []);

    // onLayoutChange is a no-op for state. In the grid model each widget owns its (x, y, w, h);
    // RGL owns positions during a gesture and reports the final, gravity-up-compacted layout via
    // onDragStop / onResizeStop — those are the single commit points to history. Writing here too
    // would double-commit and pollute undo history.
    const handleLayoutChange = useCallback(() => {}, []);

    // Ref mirror for isUndoRedoOperation so *Stop handlers don't need it as a dep
    const isUndoRedoOperationRef = useRef(isUndoRedoOperation);
    useEffect(() => {
      isUndoRedoOperationRef.current = isUndoRedoOperation;
    }, [isUndoRedoOperation]);

    // --- Edge autoscroll while dragging -------------------------------------------------
    // RGL has no native autoscroll. Scroll the canvas when the pointer nears its top/bottom
    // edge so a widget can be dragged from the bottom of a tall dashboard up to the top
    // (DALGO-1219 bug #2). Velocity is proportional to edge proximity, capped per frame.
    const autoscrollPointerYRef = useRef<number | null>(null);
    const autoscrollRafRef = useRef<number | null>(null);

    const runAutoscroll = useCallback(() => {
      const canvas = canvasRef.current;
      const pointerY = autoscrollPointerYRef.current;
      if (canvas && pointerY !== null) {
        const rect = canvas.getBoundingClientRect();
        const distTop = pointerY - rect.top;
        const distBottom = rect.bottom - pointerY;
        let dy = 0;
        if (distTop < AUTOSCROLL_EDGE_PX) {
          const intensity = Math.min(
            1,
            Math.max(0, (AUTOSCROLL_EDGE_PX - distTop) / AUTOSCROLL_EDGE_PX)
          );
          dy = -intensity * AUTOSCROLL_MAX_SPEED_PX;
        } else if (distBottom < AUTOSCROLL_EDGE_PX) {
          const intensity = Math.min(
            1,
            Math.max(0, (AUTOSCROLL_EDGE_PX - distBottom) / AUTOSCROLL_EDGE_PX)
          );
          dy = intensity * AUTOSCROLL_MAX_SPEED_PX;
        }
        if (dy !== 0) canvas.scrollTop += dy;
      }
      autoscrollRafRef.current = requestAnimationFrame(runAutoscroll);
    }, []);

    const startAutoscroll = useCallback(() => {
      if (autoscrollRafRef.current === null) {
        autoscrollRafRef.current = requestAnimationFrame(runAutoscroll);
      }
    }, [runAutoscroll]);

    const stopAutoscroll = useCallback(() => {
      if (autoscrollRafRef.current !== null) {
        cancelAnimationFrame(autoscrollRafRef.current);
        autoscrollRafRef.current = null;
      }
      autoscrollPointerYRef.current = null;
    }, []);

    // Stop autoscroll if the component unmounts mid-drag
    useEffect(() => () => stopAutoscroll(), [stopAutoscroll]);

    const clearCrossTabHoverTimer = useCallback(() => {
      if (crossTabHoverTimerRef.current) {
        clearTimeout(crossTabHoverTimerRef.current);
        crossTabHoverTimerRef.current = null;
      }
    }, []);

    // Prevent a pending tab-hover handoff from firing after the builder unmounts.
    useEffect(() => () => clearCrossTabHoverTimer(), [clearCrossTabHoverTimer]);

    const publishCrossTabDrag = useCallback((session: CrossTabDragSession | null) => {
      crossTabDragRef.current = session;
      setCrossTabDrag(session);
    }, []);

    const getTargetPosition = useCallback(
      (session: CrossTabDragSession, clientX: number, clientY: number) => {
        const container = dashboardContainerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return null;
        const rect = container.getBoundingClientRect();
        return pointerToGridPosition(clientX, clientY, session.item, {
          containerWidth: rect.width,
          containerLeft: rect.left,
          containerTop: rect.top,
          cols: currentScreenConfig.cols,
          rowHeight: ROW_HEIGHT,
          marginX: GRID_MARGIN,
          marginY: GRID_MARGIN,
          paddingX: GRID_PADDING,
          paddingY: GRID_PADDING,
        });
      },
      [currentScreenConfig.cols]
    );

    const beginCrossTabHandoff = useCallback(
      (targetTabId: string) => {
        const session = crossTabDragRef.current;
        if (!session || session.phase !== 'grid' || session.sourceTabId === targetTabId) return;
        clearCrossTabHoverTimer();
        const next: CrossTabDragSession = {
          ...session,
          hoverTabId: targetTabId,
          targetTabId,
          targetPosition: null,
          phase: 'handoff',
        };
        // End RGL's source-grid gesture while that grid is still mounted. The physical
        // pointer remains down and the document-level handoff listeners take over on the
        // next render, but react-draggable can now remove its document listeners cleanly
        // instead of throwing "DraggableCore: Unmounted during event" on the final mouseup.
        publishCrossTabDrag(next);
        document.dispatchEvent(
          new MouseEvent('mouseup', {
            bubbles: true,
            clientX: session.clientX,
            clientY: session.clientY,
          })
        );
        setDragPreviewTabId(targetTabId);
        autoscrollPointerYRef.current = session.clientY;
        startAutoscroll();
      },
      [clearCrossTabHoverTimer, publishCrossTabDrag, startAutoscroll]
    );

    const updateCrossTabHover = useCallback(
      (clientX: number, clientY: number) => {
        const session = crossTabDragRef.current;
        if (!session || session.phase !== 'grid') return;

        const tabElement = document
          .elementsFromPoint(clientX, clientY)
          .map((element) =>
            (element as HTMLElement).closest<HTMLElement>('[data-dashboard-tab-id]')
          )
          .find(Boolean);
        const hoverTabId = tabElement?.dataset.dashboardTabId || null;
        const validHoverTabId =
          hoverTabId && hoverTabId !== session.sourceTabId ? hoverTabId : null;

        if (session.hoverTabId === validHoverTabId) return;
        clearCrossTabHoverTimer();
        const next = { ...session, clientX, clientY, hoverTabId: validHoverTabId };
        publishCrossTabDrag(next);

        if (validHoverTabId) {
          crossTabHoverTimerRef.current = setTimeout(
            () => beginCrossTabHandoff(validHoverTabId),
            CROSS_TAB_HOVER_DELAY_MS
          );
        }
      },
      [beginCrossTabHandoff, clearCrossTabHoverTimer, publishCrossTabDrag]
    );

    const finishCrossTabDrag = useCallback(
      (commit: boolean) => {
        const session = crossTabDragRef.current;
        clearCrossTabHoverTimer();
        stopAutoscroll();

        if (
          commit &&
          session?.phase === 'handoff' &&
          session.targetTabId &&
          session.targetPosition
        ) {
          setState((prev) =>
            moveWidgetBetweenTabs(
              prev,
              {
                componentId: session.componentId,
                sourceTabId: session.sourceTabId,
                targetTabId: session.targetTabId!,
                ...session.targetPosition!,
              },
              currentScreenConfig.cols
            )
          );
          trackEvent(ANALYTICS_EVENTS.DASHBOARD_WIDGET_MOVED_BETWEEN_TABS, {
            dashboard_id: dashboardId,
            element_type: session.componentType,
          });
        }

        setDragPreviewTabId(null);
        publishCrossTabDrag(null);
        isDraggingRef.current = false;
        setIsDragging(false);
        setDraggedItem(null);
      },
      [
        clearCrossTabHoverTimer,
        currentScreenConfig.cols,
        publishCrossTabDrag,
        setState,
        stopAutoscroll,
      ]
    );

    // Once the source grid unmounts, keep the gesture alive at document level.
    useEffect(() => {
      if (crossTabDrag?.phase !== 'handoff') return undefined;

      const initialPositionFrame = requestAnimationFrame(() => {
        const session = crossTabDragRef.current;
        if (!session || session.phase !== 'handoff') return;
        publishCrossTabDrag({
          ...session,
          targetPosition: getTargetPosition(session, session.clientX, session.clientY),
        });
      });

      const handleMouseMove = (event: MouseEvent) => {
        const session = crossTabDragRef.current;
        if (!session || session.phase !== 'handoff') return;
        autoscrollPointerYRef.current = event.clientY;
        publishCrossTabDrag({
          ...session,
          clientX: event.clientX,
          clientY: event.clientY,
          targetPosition: getTargetPosition(session, event.clientX, event.clientY),
        });
      };
      const handleCanvasScroll = () => {
        const session = crossTabDragRef.current;
        if (!session || session.phase !== 'handoff') return;
        publishCrossTabDrag({
          ...session,
          targetPosition: getTargetPosition(session, session.clientX, session.clientY),
        });
      };
      const handleMouseUp = (event: MouseEvent) => {
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        const isInsideCanvas = Boolean(
          canvasRect &&
            event.clientX >= canvasRect.left &&
            event.clientX <= canvasRect.right &&
            event.clientY >= canvasRect.top &&
            event.clientY <= canvasRect.bottom
        );
        const session = crossTabDragRef.current;
        if (isInsideCanvas && session?.phase === 'handoff') {
          publishCrossTabDrag({
            ...session,
            clientX: event.clientX,
            clientY: event.clientY,
            targetPosition: getTargetPosition(session, event.clientX, event.clientY),
          });
        }
        finishCrossTabDrag(isInsideCanvas);
      };
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          finishCrossTabDrag(false);
        }
      };
      const handleWindowBlur = () => finishCrossTabDrag(false);

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('blur', handleWindowBlur);
      const canvas = canvasRef.current;
      canvas?.addEventListener('scroll', handleCanvasScroll, { passive: true });
      return () => {
        cancelAnimationFrame(initialPositionFrame);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('blur', handleWindowBlur);
        canvas?.removeEventListener('scroll', handleCanvasScroll);
      };
    }, [crossTabDrag?.phase, finishCrossTabDrag, getTargetPosition, publishCrossTabDrag]);

    // --- Drag handlers ------------------------------------------------------------------
    const handleDragStart = useCallback(
      (
        _layout: DashboardLayout[],
        _oldItem: DashboardLayout,
        newItem: DashboardLayout,
        _placeholder: DashboardLayout,
        event: MouseEvent
      ) => {
        document.dispatchEvent(
          new CustomEvent(DASHBOARD_WIDGET_DRAG_START_EVENT, {
            detail: { componentId: newItem.i },
          })
        );
        isDraggingRef.current = true;
        setIsDragging(true);
        setDraggedItem(newItem);
        const editorState = stateRef.current;
        const component = getActiveEditorTab(editorState).components[newItem.i];
        if (component) {
          publishCrossTabDrag({
            componentId: newItem.i,
            componentType: component.type,
            sourceTabId: editorState.activeTabId,
            hoverTabId: null,
            targetTabId: null,
            item: { ...newItem },
            clientX: event?.clientX || 0,
            clientY: event?.clientY || 0,
            targetPosition: null,
            phase: 'grid',
          });
        }
        startAutoscroll();
      },
      [publishCrossTabDrag, startAutoscroll]
    );

    // Track the pointer Y so the autoscroll loop knows how close we are to an edge.
    const handleDrag = useCallback(
      (
        _layout: DashboardLayout[],
        _oldItem: DashboardLayout,
        _newItem: DashboardLayout,
        _placeholder: DashboardLayout,
        e: MouseEvent
      ) => {
        if (e && typeof e.clientY === 'number') {
          autoscrollPointerYRef.current = e.clientY;
          const session = crossTabDragRef.current;
          if (session?.phase === 'grid') {
            publishCrossTabDrag({ ...session, clientX: e.clientX, clientY: e.clientY });
            updateCrossTabHover(e.clientX, e.clientY);
          }
        }
      },
      [publishCrossTabDrag, updateCrossTabHover]
    );

    // Handle drag stop - RGL returns the final, gravity-up-compacted layout. Commit it as
    // one history entry. Each widget keeps its own (x, y, w, h); nothing is re-derived from
    // array order, which is what made the old fluid model unpredictable (DALGO-1219).
    const handleDragStop = useCallback(
      (layout: DashboardLayout[], _oldItem: DashboardLayout, _newItem: DashboardLayout) => {
        const session = crossTabDragRef.current;
        if (session?.phase === 'handoff') return;

        isDraggingRef.current = false;
        setIsDragging(false);
        setDraggedItem(null);
        clearCrossTabHoverTimer();
        publishCrossTabDrag(null);
        stopAutoscroll();

        // Releasing over a tab before the dwell completes cancels instead of committing
        // a surprising edge position back into the source grid.
        if (!session?.hoverTabId && !isUndoRedoOperationRef.current) {
          const next = applyItemConstraints(layout);
          setState((prev) => updateActiveEditorTab(prev, { layout_config: next }));
        }

        const walkthrough = useInsightWalkthroughStore.getState();
        if (walkthrough.active && walkthrough.stage === 'builder_resize') {
          walkthrough.advanceTo('builder_save');
        }
      },
      [applyItemConstraints, clearCrossTabHoverTimer, publishCrossTabDrag, setState, stopAutoscroll]
    );

    // Handle breakpoint changes
    const [currentBreakpoint, setCurrentBreakpoint] = useState('lg');
    const handleBreakpointChange = (newBreakpoint: string) => {
      setCurrentBreakpoint(newBreakpoint);
    };

    // Track if we're currently resizing
    const [isResizing, setIsResizing] = useState(false);

    // Handle resize start
    const handleResizeStart = useCallback(
      (_layout: DashboardLayout[], _oldItem: DashboardLayout, newItem: DashboardLayout) => {
        setResizingItems((prev) => new Set([...prev, newItem.i]));
        setIsResizing(true);
      },
      []
    );

    // Handle resize stop - RGL pushes overlapped neighbors down and compacts; commit the
    // final layout to history with min-size constraints reapplied. Live min-size enforcement
    // during the drag is handled natively by RGL via each item's minW/minH.
    const handleResizeStop = useCallback(
      (layout: DashboardLayout[], _oldItem: DashboardLayout, newItem: DashboardLayout) => {
        setResizingItems((prev) => {
          const next = new Set(prev);
          next.delete(newItem.i);
          return next;
        });
        setIsResizing(false);

        if (!isUndoRedoOperationRef.current) {
          const next = applyItemConstraints(layout);
          setState((prev) => updateActiveEditorTab(prev, { layout_config: next }));
        }

        const walkthrough = useInsightWalkthroughStore.getState();
        if (walkthrough.active && walkthrough.stage === 'builder_resize') {
          walkthrough.advanceTo('builder_save');
        }
      },
      [setState, applyItemConstraints]
    );

    // Add chart component - optimized for speed
    const handleChartSelected = async (chartId: number) => {
      try {
        // Only fetch chart metadata (fast ~50ms) - skip data fetch (slow ~2.5s)
        // The chart component will fetch its own data when it renders
        let chartDetails;
        try {
          chartDetails = await apiGet(`/api/charts/${chartId}/`);
        } catch (error) {
          chartDetails = {
            id: chartId,
            title: `Chart #${chartId}`,
            chart_type: 'bar',
            computation_type: 'aggregated',
          };
        }

        // Use default sizing based on chart type (no slow data fetch needed)
        const chartType = chartDetails.chart_type || 'default';
        const defaultDimensions = getDefaultGridDimensions(chartType);
        const minDimensions = getMinGridDimensions(chartType);

        const newComponent: DashboardComponent = {
          id: `chart-${Date.now()}`,
          type: DashboardComponentType.CHART,
          config: {
            chartId,
            title: chartDetails.title,
            chartType: chartDetails.chart_type,
            computation_type: chartDetails.computation_type,
            description: chartDetails.description,
            contentConstraints: null,
          },
        };

        // Grid model: new widget lands full-width at the bottom of the canvas. The user
        // drags & resizes it from there. Nothing else on the canvas reorganizes.
        const newLayoutItem: DashboardLayout = {
          i: newComponent.id,
          x: 0,
          y: bottomY(activeLayout),
          w: FULL_WIDTH_COLS,
          h: defaultDimensions.h,
          minW: minDimensions.w,
          maxW: FULL_WIDTH_COLS,
          minH: minDimensions.h,
        };

        setState((prev) => {
          const tab = getActiveEditorTab(prev);
          return updateActiveEditorTab(prev, {
            layout_config: [...tab.layout_config, newLayoutItem],
            components: { ...tab.components, [newComponent.id]: newComponent },
          });
        });

        trackEvent(ANALYTICS_EVENTS.DASHBOARD_CHART_ADDED, {
          // Both ids: chart_type says what KIND was added, chart_id says WHICH chart — only
          // the id answers "which charts get reused across dashboards" and "built but never
          // placed anywhere".
          chart_id: chartId,
          chart_type: chartType,
          dashboard_id: dashboardId,
        });

        // Resume-nudge milestone — set regardless of an active coachmark session.
        markChartAddedToDashboard();

        // Animate component entrance
        dashboardAnimation.animateComponent(newComponent.id, 500);

        // Smart scroll to show the newly added component if needed
        scrollToComponentIfNeeded(newComponent.id);

        const walkthrough = useInsightWalkthroughStore.getState();
        if (walkthrough.active && walkthrough.stage === 'builder_add_chart') {
          walkthrough.advanceTo('builder_resize');
        } else if (walkthrough.active && walkthrough.stage === 'builder_add_chart_first') {
          // Own-data path adds chart-then-KPI (opposite of the sample path) — next is
          // the KPI-add stage, not resize.
          walkthrough.advanceTo('builder_add_kpi_second');
        }
      } catch (error) {
        console.error('Failed to add chart');
      }
    };

    // Add KPI component
    const handleKPISelected = (kpiId: number, kpiName: string) => {
      const newComponent: DashboardComponent = {
        id: `kpi-${Date.now()}`,
        type: DashboardComponentType.KPI,
        config: {
          kpiId,
          title: kpiName,
        },
      };

      const defaultDimensions = getDefaultGridDimensions('kpi');
      const minDimensions = getMinGridDimensions('kpi');

      // Grid model: new KPI lands full-width at the bottom (same as charts/text).
      const newLayoutItem: DashboardLayout = {
        i: newComponent.id,
        x: 0,
        y: bottomY(activeLayout),
        w: FULL_WIDTH_COLS,
        h: defaultDimensions.h,
        minW: minDimensions.w,
        maxW: FULL_WIDTH_COLS,
        minH: minDimensions.h,
      };

      setState((prev) => {
        const tab = getActiveEditorTab(prev);
        return updateActiveEditorTab(prev, {
          layout_config: [...tab.layout_config, newLayoutItem],
          components: { ...tab.components, [newComponent.id]: newComponent },
        });
      });

      trackEvent(ANALYTICS_EVENTS.DASHBOARD_KPI_ADDED, {
        kpi_id: kpiId,
        dashboard_id: dashboardId,
      });
      // Resume-nudge milestone — set regardless of an active coachmark session.
      markKpiAddedToDashboard();
      dashboardAnimation.animateComponent(newComponent.id, 500);
      scrollToComponentIfNeeded(newComponent.id);

      const walkthrough = useInsightWalkthroughStore.getState();
      if (walkthrough.active && walkthrough.stage === 'builder_add_kpi') {
        walkthrough.advanceTo('builder_add_chart');
      } else if (walkthrough.active && walkthrough.stage === 'builder_add_kpi_second') {
        // Own-data path already added its chart first — next is resize, converging
        // back into the shared tail (resize → save → preview → share).
        walkthrough.advanceTo('builder_resize');
      }
    };

    // Add text component
    const addTextComponent = () => {
      // Calculate minimum dimensions for empty text component
      const defaultTextDimensions = calculateTextDimensions({
        content: '', // Empty content
        fontSize: 16,
        fontWeight: 'normal',
        type: 'paragraph',
        textAlign: 'left',
      });

      const newComponent: DashboardComponent = {
        id: `text-${Date.now()}`,
        type: DashboardComponentType.TEXT,
        config: {
          content: '',
          type: 'paragraph',
          fontSize: 16,
          fontWeight: 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
          textAlign: 'left',
          color: '#000000',
          contentConstraints: {
            minWidth: defaultTextDimensions.width,
            minHeight: defaultTextDimensions.height,
          },
        } as UnifiedTextConfig,
      };

      // Get appropriate dimensions for text component
      const textDimensions = getDefaultGridDimensions('text');
      const textMinDimensions = getMinGridDimensions('text');

      // Grid model: new text widget lands full-width at the bottom of the canvas.
      const newLayoutItem: DashboardLayout = {
        i: newComponent.id,
        x: 0,
        y: bottomY(activeLayout),
        w: FULL_WIDTH_COLS,
        h: textDimensions.h,
        minW: textMinDimensions.w,
        maxW: FULL_WIDTH_COLS,
        minH: textMinDimensions.h,
      };

      setState((prev) => {
        const tab = getActiveEditorTab(prev);
        return updateActiveEditorTab(prev, {
          layout_config: [...tab.layout_config, newLayoutItem],
          components: { ...tab.components, [newComponent.id]: newComponent },
        });
      });

      trackEvent(ANALYTICS_EVENTS.DASHBOARD_TEXT_ELEMENT_ADDED, { dashboard_id: dashboardId });

      // Animate component entrance
      dashboardAnimation.animateComponent(newComponent.id, 500);

      // Smart scroll to show the newly added component if needed
      scrollToComponentIfNeeded(newComponent.id);
    };

    // Remove component. Anything below the removed widget slides up (gravity-up);
    // side neighbours stay where they are. One history entry.
    const removeComponent = (componentId: string) => {
      const removedType = activeComponents[componentId]?.type;
      const newComponents = { ...activeComponents };
      delete newComponents[componentId];

      const newLayout = compactVertical(
        activeLayout.filter((item) => item.i !== componentId),
        FLUID_GRID_COLS
      );

      setState((prev) =>
        updateActiveEditorTab(prev, { layout_config: newLayout, components: newComponents })
      );
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

    // Handle filter layout changes
    const handleFilterLayoutChange = (newLayout: 'vertical' | 'horizontal') => {
      setUserFilterLayoutChoice(newLayout);
      // Auto-save the layout preference (only save user's choice, not responsive overrides)
      saveDashboard({ filter_layout: newLayout }).catch((error) => {
        console.error('❌ Failed to save filter layout:', error);
      });
    };

    // Add filter
    const handleFilterSave = async (
      filterPayload: CreateFilterPayload | any,
      filterId?: number
    ) => {
      if (!dashboardId) return;

      // Check if this is an update or create
      if (filterId && selectedFilterForEdit) {
        // Update existing filter
        try {
          const updateData = {
            name: filterPayload.name,
            schema_name: filterPayload.schema_name,
            table_name: filterPayload.table_name,
            column_name: filterPayload.column_name,
            filter_type: filterPayload.filter_type || selectedFilterForEdit.filter_type,
            settings: filterPayload.settings,
          };

          // Use the new typed API function that returns complete filter data
          const updatedFilterFromAPI = await updateDashboardFilter(
            dashboardId,
            filterId,
            updateData
          );
          trackEvent(ANALYTICS_EVENTS.DASHBOARD_FILTER_UPDATED, {
            dashboard_id: dashboardId,
            filter_type: updateData.filter_type,
          });

          // Note: Filter components will handle their own state updates

          setSelectedFilterForEdit(null);
          setShowFilterModal(false);

          // Refresh dashboard data to update filter list
          if (dashboardId) {
            const { mutate } = await import('swr');
            mutate(`/api/dashboards/${dashboardId}/`);
          }
        } catch (error) {
          console.error('Error updating filter:', error);
        }
      } else {
        // Create new filter (existing logic)
        handleFilterCreate(filterPayload as CreateFilterPayload);
      }
    };

    const handleFilterCreate = async (filterPayload: CreateFilterPayload) => {
      if (!dashboardId) return;

      try {
        // Create filter in database first using typed API
        const newFilterFromAPI = await createDashboardFilter(dashboardId, {
          name: filterPayload.name,
          filter_type: filterPayload.filter_type,
          schema_name: filterPayload.schema_name,
          table_name: filterPayload.table_name,
          column_name: filterPayload.column_name,
          settings: filterPayload.settings,
        });
        trackEvent(ANALYTICS_EVENTS.DASHBOARD_FILTER_CREATED, {
          dashboard_id: dashboardId,
          filter_type: filterPayload.filter_type,
        });

        // Convert API response to frontend config format (no position needed)
        const filterConfig = convertFilterToConfig(newFilterFromAPI, {
          x: 0,
          y: 0,
          w: 4,
          h: 3,
        });

        // Note: Filter components will handle their own state updates

        setShowFilterModal(false);

        // Refresh dashboard data to update filter list
        if (dashboardId) {
          const { mutate } = await import('swr');
          mutate(`/api/dashboards/${dashboardId}/`);
        }
      } catch (error: any) {
        console.error('Failed to create filter:', error.message || 'Please try again');
        // Could add error handling/notification here
      }
    };

    // Remove filter - note: filter state is now managed by filter components
    const removeFilter = async (filterId: string) => {
      if (!dashboardId) return;

      try {
        // Call backend API to delete the filter
        await deleteDashboardFilter(dashboardId, parseInt(filterId));
        trackEvent(ANALYTICS_EVENTS.DASHBOARD_FILTER_DELETED, { dashboard_id: dashboardId });

        // Refresh dashboard data to update filter list
        const { mutate } = await import('swr');
        mutate(`/api/dashboards/${dashboardId}/`);
      } catch (error: any) {
        console.error('Failed to delete filter:', error.message || 'Please try again');
        // Could add error handling/notification here
      }
    };

    // Edit filter
    const handleEditFilter = (filter: DashboardFilterConfig) => {
      // Convert DashboardFilterConfig back to DashboardFilter format for editing
      const filterForEdit: DashboardFilter = {
        id: parseInt(filter.id),
        dashboard_id: dashboardId!,
        name: filter.name,
        filter_type: filter.filter_type,
        schema_name: filter.schema_name,
        table_name: filter.table_name,
        column_name: filter.column_name,
        settings: filter.settings,
        order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setSelectedFilterForEdit(filterForEdit);
      setShowFilterModal(true);
    };

    // Note: Apply filters functionality is now handled by individual filter components

    // Clear all filters
    const handleClearAllFilters = () => {
      setAppliedFilters({});
    };

    // Reorder filters - note: filter state is now managed by filter components
    const handleReorderFilters = (newOrder: DashboardFilterConfig[]) => {
      // Filter components handle their own reordering
    };

    // Get chart IDs that are already added to the dashboard
    const getExcludedChartIds = (): number[] => {
      const chartIds: number[] = [];

      if (activeComponents) {
        Object.values(activeComponents).forEach((component) => {
          const chartId = component.config.chartId;
          if (component.type === DashboardComponentType.CHART && typeof chartId === 'number') {
            chartIds.push(chartId);
          }
        });
      }

      return chartIds;
    };

    const getExcludedKPIIds = (): number[] => {
      const kpiIds: number[] = [];
      if (activeComponents) {
        Object.values(activeComponents).forEach((component) => {
          const kpiId = component.config.kpiId;
          if (component.type === DashboardComponentType.KPI && typeof kpiId === 'number') {
            kpiIds.push(kpiId);
          }
        });
      }
      return kpiIds;
    };

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
        router.push(`/charts/${chartId}?from=dashboard`);
      },
      [router]
    );

    const handleEditChart = useCallback(
      (chartId: number) => {
        router.push(`/charts/${chartId}/edit?from=dashboard`);
      },
      [router]
    );

    // Find next available position for new component
    const findAvailablePosition = (width: number, height: number): { x: number; y: number } => {
      const layout = activeLayout;
      const maxCols = currentScreenConfig.cols;

      // Create a grid to track occupied spaces
      const occupiedGrid: boolean[][] = [];

      // Initialize grid - find max Y coordinate to determine grid height
      const maxY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
      const gridHeight = Math.max(maxY + height + 5, 20); // Add some buffer

      for (let y = 0; y < gridHeight; y++) {
        occupiedGrid[y] = new Array(maxCols).fill(false);
      }

      // Mark occupied positions
      layout.forEach((item) => {
        for (let y = item.y; y < item.y + item.h; y++) {
          for (let x = item.x; x < item.x + item.w; x++) {
            if (y < gridHeight && x < maxCols) {
              occupiedGrid[y][x] = true;
            }
          }
        }
      });

      // Find first available position that fits the component
      for (let y = 0; y <= gridHeight - height; y++) {
        for (let x = 0; x <= maxCols - width; x++) {
          let canPlace = true;

          // Check if this position and size is available
          for (let dy = 0; dy < height && canPlace; dy++) {
            for (let dx = 0; dx < width && canPlace; dx++) {
              if (y + dy < gridHeight && x + dx < maxCols && occupiedGrid[y + dy][x + dx]) {
                canPlace = false;
              }
            }
          }

          if (canPlace) {
            return { x, y };
          }
        }
      }

      // If no position found, place at the end
      return { x: 0, y: maxY + 1 };
    };

    const handoffPlaceholderStyle = (() => {
      if (crossTabDrag?.phase !== 'handoff' || !crossTabDrag.targetPosition) return null;
      const usableWidth =
        actualContainerWidth - GRID_PADDING * 2 - GRID_MARGIN * (currentScreenConfig.cols - 1);
      const columnWidth = usableWidth / currentScreenConfig.cols;
      const { x, y } = crossTabDrag.targetPosition;
      return {
        left: GRID_PADDING + x * (columnWidth + GRID_MARGIN),
        top: GRID_PADDING + y * (ROW_HEIGHT + GRID_MARGIN),
        width: crossTabDrag.item.w * columnWidth + (crossTabDrag.item.w - 1) * GRID_MARGIN,
        height: crossTabDrag.item.h * ROW_HEIGHT + (crossTabDrag.item.h - 1) * GRID_MARGIN,
      };
    })();

    return (
      <div className="dashboard-builder h-full flex flex-col overflow-hidden">
        {crossTabDrag?.phase === 'handoff' &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              className="pointer-events-none fixed z-[10000] -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-blue-500 bg-blue-50/95 px-3 py-2 text-sm font-medium text-blue-700 shadow-xl"
              style={{ left: crossTabDrag.clientX, top: crossTabDrag.clientY }}
              data-testid="cross-tab-drag-overlay"
            >
              Move {crossTabDrag.componentType} to this tab
            </div>,
            document.body
          )}
        {/* Fixed Header with Title and Toolbar */}
        <div className="border-b bg-white flex-shrink-0">
          {/* Mobile Header */}
          <div className="lg:hidden">
            {/* Mobile Top Row - Title and Essential Actions */}
            <div className="px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {onBack && (
                  <Button variant="ghost" size="sm" onClick={onBack} className="p-1 flex-shrink-0">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                )}

                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  {isEditingTitle ? (
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Dashboard title..."
                      className="text-sm font-semibold h-8"
                      data-testid="dashboard-title-input-mobile"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const finalTitle = title.trim() || 'Untitled Dashboard';
                          setTitle(finalTitle);
                          setIsEditingTitle(false);
                          saveDashboard();
                        }
                      }}
                      onBlur={() => {
                        const finalTitle = title.trim() || 'Untitled Dashboard';
                        setTitle(finalTitle);
                        setIsEditingTitle(false);
                        saveDashboard();
                      }}
                    />
                  ) : (
                    <div className="cursor-pointer min-w-0" onClick={() => setIsEditingTitle(true)}>
                      <h1 className="text-sm font-semibold truncate dashboard-header-title">
                        {title}
                      </h1>
                    </div>
                  )}

                  <DashboardDescriptionEditor
                    value={description}
                    onChange={setDescription}
                    onSave={() => saveDashboard()}
                    testId="dashboard-description-mobile"
                  />
                </div>
              </div>

              {/* Mobile Quick Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {onPreview && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onPreview}
                    className="p-1.5"
                    disabled={isNavigating}
                    data-testid="view-dashboard-mobile-btn"
                    aria-label={
                      isNavigating ? 'Saving and opening dashboard view' : 'View dashboard'
                    }
                    title={isNavigating ? 'Saving and opening dashboard view' : 'View dashboard'}
                  >
                    {isNavigating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                )}
                {/* COMMENTED OUT: Dashboard Settings - not needed anymore */}
                {/* <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="ghost" className="p-1.5">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium leading-none">Dashboard Settings</h4>
                        <p className="text-sm text-muted-foreground">
                          Choose the target screen size for your dashboard design
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <Label className="text-sm font-medium">
                          Filter Layout
                          <span className="ml-2 text-xs text-blue-600 font-normal">
                            (Auto: {responsive.currentBreakpoint})
                          </span>
                        </Label>
                        <ToggleGroup
                          type="single"
                          value={filterLayout}
                          onValueChange={(value) =>
                            value && handleFilterLayoutChange(value as 'vertical' | 'horizontal')
                          }
                          className="grid grid-cols-2 gap-2"
                          disabled={true}
                        >
                          <ToggleGroupItem value="vertical" className="text-xs">
                            <PanelLeft className="w-3 h-3 mr-1" />
                            Vertical
                          </ToggleGroupItem>
                          <ToggleGroupItem value="horizontal" className="text-xs">
                            <PanelTop className="w-3 h-3 mr-1" />
                            Horizontal
                          </ToggleGroupItem>
                        </ToggleGroup>
                        <div className="text-xs text-muted-foreground">
                          <span className="text-blue-600">
                            Layout automatically set to '{filterLayout}' for{' '}
                            {responsive.currentBreakpoint} screens to optimize space usage. Desktop
                            uses sidebar, mobile/tablet use top bar.
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <div className="grid grid-cols-3 items-center gap-4">
                          <Label htmlFor="target-screen-mobile">Screen Size</Label>
                          <select
                            id="target-screen-mobile"
                            value={targetScreenSize}
                            onChange={(e) => {
                              const newScreenSize = e.target.value as ScreenSizeKey;
                              setTargetScreenSize(newScreenSize);
                            }}
                            className="col-span-2 px-3 py-2 border rounded-md text-sm"
                          >
                            <option value="desktop">
                              {SCREEN_SIZES.desktop.name} ({SCREEN_SIZES.desktop.width}px)
                            </option>
                            <option value="tablet">
                              {SCREEN_SIZES.tablet.name} ({SCREEN_SIZES.tablet.width}px)
                            </option>
                            <option value="mobile">
                              {SCREEN_SIZES.mobile.name} ({SCREEN_SIZES.mobile.width}px)
                            </option>
                          </select>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Canvas: {SCREEN_SIZES[targetScreenSize].width} ×{' '}
                          {SCREEN_SIZES[targetScreenSize].height}px
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover> */}
              </div>
            </div>

            {/* Mobile Bottom Row - Component Actions */}
            <div className="px-4 pb-2 flex items-center gap-2 overflow-x-auto mobile-action-row">
              <Button
                onClick={() => setShowChartSelector(true)}
                size="sm"
                className="flex-shrink-0 h-8 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Chart
              </Button>
              <Button
                onClick={() => setShowKPISelector(true)}
                size="sm"
                variant="outline"
                className="flex-shrink-0 h-8 text-xs"
              >
                <Target className="w-3 h-3 mr-1" />
                KPI
              </Button>
              <Button
                onClick={addTextComponent}
                size="sm"
                variant="outline"
                className="flex-shrink-0 h-8 text-xs"
              >
                <Type className="w-3 h-3 mr-1" />
                Text
              </Button>
              <div className="flex gap-1 ml-auto flex-shrink-0">
                <Button
                  onClick={undo}
                  disabled={!canUndo}
                  size="sm"
                  variant="ghost"
                  className="p-1 h-8"
                >
                  <Undo className="w-3 h-3" />
                </Button>
                <Button
                  onClick={redo}
                  disabled={!canRedo}
                  size="sm"
                  variant="ghost"
                  className="p-1 h-8"
                >
                  <Redo className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Mobile Status Bar */}
            {saveStatus !== 'idle' && (
              <div className="px-4 pb-2 flex items-center justify-between text-xs">
                {saveStatus === 'saving' && (
                  <div className="flex items-center gap-1 text-gray-500">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Saving...</span>
                  </div>
                )}
                {saveStatus === 'saved' && (
                  <div className="flex items-center gap-1 text-green-600">
                    <Check className="w-3 h-3" />
                    <span>Saved</span>
                  </div>
                )}
                {saveStatus === 'error' && (
                  <div className="flex items-center gap-1 text-red-600">
                    <AlertCircle className="w-3 h-3" />
                    <span>Error</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:block px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {/* Back button */}
                {onBack && (
                  <Button variant="ghost" size="sm" onClick={onBack}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                )}

                <div className="h-6 w-px bg-gray-300" />

                {/* Title + Description editing — fixed width so the toolbar
                    doesn't shift as the description text grows/shrinks */}
                <div className="flex flex-col gap-0.5 w-64 flex-shrink-0">
                  {isEditingTitle ? (
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Dashboard title..."
                      className="text-lg font-semibold h-8 w-full"
                      data-testid="dashboard-title-input"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const finalTitle = title.trim() || 'Untitled Dashboard';
                          setTitle(finalTitle);
                          setIsEditingTitle(false);
                          saveDashboard();
                        }
                      }}
                      onBlur={() => {
                        const finalTitle = title.trim() || 'Untitled Dashboard';
                        setTitle(finalTitle);
                        setIsEditingTitle(false);
                        saveDashboard();
                      }}
                    />
                  ) : (
                    <div
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-0.5"
                      onClick={() => setIsEditingTitle(true)}
                      data-testid="dashboard-title-display"
                    >
                      <h1 className="text-lg font-semibold dashboard-header-title truncate">
                        {title}
                      </h1>
                    </div>
                  )}

                  <DashboardDescriptionEditor
                    value={description}
                    onChange={setDescription}
                    onSave={() => saveDashboard()}
                    testId="dashboard-description"
                  />
                </div>
              </div>

              <div className="h-6 w-px bg-gray-300 flex-shrink-0" />

              {/* Canvas actions — grouped right next to the title */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  onClick={() => {
                    if (
                      !chartsLoading &&
                      chartsData &&
                      Array.isArray(chartsData) &&
                      chartsData.length === 0
                    ) {
                      router.push('/charts/new?from=dashboard');
                    } else {
                      setShowChartSelector(true);
                    }
                  }}
                  size="sm"
                  variant="outline"
                  data-testid="add-chart-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Chart
                </Button>

                <Button
                  onClick={() => setShowKPISelector(true)}
                  size="sm"
                  variant="outline"
                  data-testid="add-kpi-btn"
                >
                  <Target className="w-4 h-4 mr-2" />
                  Add KPI
                </Button>

                <Button onClick={addTextComponent} size="sm" variant="outline">
                  <Type className="w-4 h-4 mr-2" />
                  Add Text
                </Button>

                <div className="ml-2 flex gap-1">
                  <Button onClick={undo} disabled={!canUndo} size="sm" variant="ghost">
                    <Undo className="w-4 h-4" />
                  </Button>

                  <Button onClick={redo} disabled={!canRedo} size="sm" variant="ghost">
                    <Redo className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Right zone: status + save/preview */}
              <div className="flex items-center gap-2 flex-1 justify-end">
                {/* Save Status Indicator */}
                {saveStatus === 'saving' && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden xl:inline">Saving...</span>
                  </div>
                )}
                {saveStatus === 'saved' && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <Check className="w-4 h-4" />
                    <span className="hidden xl:inline">Saved</span>
                  </div>
                )}
                {saveStatus === 'error' && (
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span className="hidden xl:inline">{saveError || 'Save failed'}</span>
                  </div>
                )}

                {/* COMMENTED OUT: Dashboard Settings - not needed anymore */}
                {/* <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium leading-none">Dashboard Settings</h4>
                        <p className="text-sm text-muted-foreground">
                          Choose the target screen size for your dashboard design
                        </p>
                      </div>

                      <div className="grid gap-2">
                        <Label className="text-sm font-medium">
                          Filter Layout
                          <span className="ml-2 text-xs text-blue-600 font-normal">
                            (Auto: {responsive.currentBreakpoint})
                          </span>
                        </Label>
                        <ToggleGroup
                          type="single"
                          value={filterLayout}
                          onValueChange={(value) =>
                            value && handleFilterLayoutChange(value as 'vertical' | 'horizontal')
                          }
                          className="grid grid-cols-2 gap-2"
                          disabled={true}
                        >
                          <ToggleGroupItem value="vertical" className="text-xs">
                            <PanelLeft className="w-4 h-4 mr-2" />
                            Vertical
                          </ToggleGroupItem>
                          <ToggleGroupItem value="horizontal" className="text-xs">
                            <PanelTop className="w-4 h-4 mr-2" />
                            Horizontal
                          </ToggleGroupItem>
                        </ToggleGroup>
                        <div className="text-xs text-muted-foreground">
                          <span className="text-blue-600">
                            Layout automatically set to '{filterLayout}' for{' '}
                            {responsive.currentBreakpoint} screens to optimize space usage. Desktop
                            uses sidebar, mobile/tablet use top bar.
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <div className="grid grid-cols-3 items-center gap-4">
                          <Label htmlFor="target-screen-desktop">Screen Size</Label>
                          <select
                            id="target-screen-desktop"
                            value={targetScreenSize}
                            onChange={(e) => {
                              const newScreenSize = e.target.value as ScreenSizeKey;
                              setTargetScreenSize(newScreenSize);
                            }}
                            className="col-span-2 px-3 py-2 border rounded-md text-sm"
                          >
                            <option value="desktop">
                              {SCREEN_SIZES.desktop.name} ({SCREEN_SIZES.desktop.width}px)
                            </option>
                            <option value="tablet">
                              {SCREEN_SIZES.tablet.name} ({SCREEN_SIZES.tablet.width}px)
                            </option>
                            <option value="mobile">
                              {SCREEN_SIZES.mobile.name} ({SCREEN_SIZES.mobile.width}px)
                            </option>
                          </select>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Canvas will resize to {SCREEN_SIZES[targetScreenSize].width} ×{' '}
                          {SCREEN_SIZES[targetScreenSize].height}px
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover> */}

                <Button
                  onClick={async () => {
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
                      (walkthrough.stage === 'builder_save' ||
                        walkthrough.stage === 'builder_resize')
                    ) {
                      walkthrough.advanceTo('builder_preview');
                    }
                  }}
                  size="sm"
                  data-testid="dashboard-save-btn"
                >
                  <Save className="w-4 h-4 mr-2" />
                  <span className="hidden lg:inline">Save</span>
                </Button>

                {/* Save changes and return to dashboard view mode. */}
                {onPreview && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onPreview}
                    disabled={isNavigating}
                    data-testid="dashboard-preview-btn"
                    className="min-w-[104px] justify-center px-4"
                    aria-label={
                      isNavigating ? 'Saving and opening dashboard view' : 'View dashboard'
                    }
                  >
                    {isNavigating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                    <span>{isNavigating ? 'Saving and opening view...' : 'View'}</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Horizontal Filters Bar */}
        {filterLayout === 'horizontal' && !isFiltersCollapsed && (
          <UnifiedFiltersPanel
            initialFilters={initialFilters}
            dashboardId={dashboardId!}
            isEditMode={true}
            layout="horizontal"
            onAddFilter={() => setShowFilterModal(true)}
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
              onAddFilter={() => setShowFilterModal(true)}
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
            <div ref={canvasRef} className="flex-1 overflow-auto bg-gray-50 p-4 pb-[150px] min-w-0">
              {/* Canvas container with full width */}
              <div
                ref={dashboardContainerRef}
                className="bg-white dashboard-canvas-responsive"
                style={{
                  width: '100%',
                  // Calculate minimum height based on actual content:
                  // Find the lowest item (y + h) and multiply by ROW_HEIGHT + padding
                  minHeight: Math.max(
                    currentScreenConfig.height,
                    400,
                    // Calculate content height from layout items
                    activeLayout.length > 0
                      ? Math.max(...activeLayout.map((item) => (item.y + item.h) * ROW_HEIGHT)) +
                          100
                      : 0
                  ),
                  position: 'relative',
                }}
              >
                {handoffPlaceholderStyle && (
                  <div
                    className="pointer-events-none absolute z-30 rounded-md border-2 border-dashed border-blue-500 bg-blue-100/50 shadow-inner"
                    style={handoffPlaceholderStyle}
                    data-testid="cross-tab-drop-placeholder"
                  />
                )}
                <GridLayout
                  // The handoff grid can receive the tail of RGL's original mouse gesture.
                  // Remount it once more when the handoff settles so RGL cannot retain an
                  // activeDrag placeholder over the newly inserted destination widget.
                  key={`dashboard-grid-${renderedActiveTabId}-${
                    crossTabDrag?.phase === 'handoff' ? 'handoff' : 'settled'
                  }`}
                  className="layout relative z-10"
                  data-grid-instance={`${renderedActiveTabId}-${
                    crossTabDrag?.phase === 'handoff' ? 'handoff' : 'settled'
                  }`}
                  data-grid-model="true"
                  layout={activeLayout}
                  cols={currentScreenConfig.cols} // Always exactly 12 columns (Superset-style)
                  rowHeight={ROW_HEIGHT}
                  width={actualContainerWidth} // Use available container width - columns adjust to fit
                  onLayoutChange={handleLayoutChange}
                  onDragStart={handleDragStart}
                  onDrag={handleDrag}
                  onDragStop={handleDragStop}
                  onResizeStart={handleResizeStart}
                  onResizeStop={handleResizeStop}
                  draggableCancel=".drag-cancel"
                  // Grid model: each widget owns its (x, y, w, h). Gravity-up is the only
                  // automatic behaviour; neighbours are pushed down (never sideways) on collision.
                  compactType="vertical"
                  preventCollision={false}
                  allowOverlap={false}
                  margin={[8, 8]} // Match preview mode spacing
                  containerPadding={[8, 8]} // Match preview mode padding
                  autoSize={true}
                  useCSSTransforms={true}
                  transformScale={1}
                  isDraggable={true}
                  isResizable={true}
                  resizeHandles={['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne']}
                >
                  {activeLayout.map((item) => {
                    const component = activeComponents[item.i];
                    if (!component) return null;
                    return (
                      // RGL requires the immediate child to carry key={item.i}; the wrapping div
                      // preserves that contract while DashboardCell handles all visual content.
                      <div key={item.i}>
                        <DashboardCell
                          item={item}
                          component={component}
                          isAnimating={dashboardAnimation.animatingComponents.has(item.i)}
                          isBeingPushed={false}
                          isDraggedComponent={draggedItem?.i === item.i}
                          spaceMakingActive={false}
                          animationStyles={dashboardAnimation.getAnimationStyles(item.i)}
                          isResizing={resizingItems.has(item.i)}
                          appliedFilters={appliedFilters}
                          initialFilters={initialFilters}
                          dashboardId={dashboardId}
                          onViewChart={handleViewChart}
                          onEditChart={handleEditChart}
                          onRemove={stableRemoveComponent}
                          onUpdate={stableUpdateComponent}
                        />
                      </div>
                    );
                  })}
                </GridLayout>
              </div>
            </div>
          </div>
        </div>{' '}
        {/* Close Main Content Area */}
        {/* Chart Selector Modal */}
        <ChartSelectorModal
          open={showChartSelector}
          onClose={() => setShowChartSelector(false)}
          onSelect={handleChartSelected}
          excludedChartIds={getExcludedChartIds()}
        />
        <KPISelectorModal
          open={showKPISelector}
          onClose={() => setShowKPISelector(false)}
          onSelect={handleKPISelected}
          excludedKPIIds={getExcludedKPIIds()}
        />
        {/* Filter Config Modal */}
        <FilterConfigModal
          open={showFilterModal}
          onClose={() => {
            setShowFilterModal(false);
            setSelectedFilterForEdit(null);
          }}
          onSave={handleFilterSave}
          mode={selectedFilterForEdit ? 'edit' : 'create'}
          filterId={selectedFilterForEdit?.id ? Number(selectedFilterForEdit.id) : undefined}
          dashboardId={dashboardId}
          initialData={
            selectedFilterForEdit
              ? {
                  name: selectedFilterForEdit.name,
                  schema_name: selectedFilterForEdit.schema_name,
                  table_name: selectedFilterForEdit.table_name,
                  column_name: selectedFilterForEdit.column_name,
                  filter_type: selectedFilterForEdit.filter_type as DashboardFilterType,
                  settings: selectedFilterForEdit.settings,
                }
              : undefined
          }
        />
      </div>
    );
  }
);
