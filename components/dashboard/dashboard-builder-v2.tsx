'use client';

import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useMemo,
  memo,
} from 'react';
import { useCharts } from '@/hooks/api/useChart';
import { useRouter } from 'next/navigation';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { ChartSelectorModal } from './chart-selector-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import {
  refreshDashboardLock,
  updateDashboardFilter,
  createDashboardFilter,
  deleteDashboardFilter,
  useDashboard,
} from '@/hooks/api/useDashboards';
import { useDebounce } from '@/hooks/useDebounce';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useDashboardAnimation } from '@/hooks/useDashboardAnimation';
import {
  getDefaultGridDimensions,
  getMinGridDimensions,
  getChartTypeFromConfig,
  pixelsToGridUnits,
  calculateTextDimensions,
} from '@/lib/chart-size-constraints';
import {
  Plus,
  Undo,
  Redo,
  Save,
  Loader2,
  Type,
  X,
  Lock,
  Unlock,
  Check,
  AlertCircle,
  Filter,
  ArrowLeft,
  Eye,
  Edit,
  Wand2,
  LayoutGrid,
} from 'lucide-react';
// Removed toast import - using console for notifications
import { ChartElementV2 } from './chart-element-v2';
import { UnifiedTextElement } from './text-element-unified';
import type { UnifiedTextConfig } from './text-element-unified';
import { FilterConfigModal } from './filter-config-modal';
import { UnifiedFiltersPanel } from './unified-filters-panel';
import { SnapIndicators } from './SnapIndicators';
import { SpaceMakingIndicators } from './SpaceMakingIndicators';
import { GridGuides } from './GridGuides';
import { DashboardFilterType } from '@/types/dashboard-filters';
import type {
  CreateFilterPayload,
  DashboardFilterConfig,
  ValueFilterSettings,
  NumericalFilterSettings,
  DateTimeFilterSettings,
} from '@/types/dashboard-filters';
import type { DashboardFilter } from '@/hooks/api/useDashboards';

// Grid layout constants - used across GridLayout, SnapIndicators, SpaceMakingIndicators, and animation hooks
const ROW_HEIGHT = 20;

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
export enum DashboardComponentType {
  CHART = 'chart',
  TEXT = 'text',
  FILTER = 'filter',
}

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

interface DashboardState {
  layout: DashboardLayout[];
  layouts?: ResponsiveLayouts;
  components: Record<string, DashboardComponent>;
  // filters removed - now managed independently outside undo/redo
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
  cleanup: () => Promise<void>;
}

// Helper function to adjust layout for different column counts
// With fixed 12 columns (Superset-style), this simply returns the original layout
function getAdjustedLayout(layout: DashboardLayout[], _targetCols: number): DashboardLayout[] {
  if (!layout || layout.length === 0) return layout;

  // Since we always use 12 columns (Superset-style), just return the original layout
  // The column widths scale automatically with the container width
  return layout;
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

interface DashboardCellProps {
  componentId: string;
  component: DashboardComponent;
  isAnimating: boolean;
  isBeingPushed: boolean;
  isDraggedSpaceMaking: boolean;
  isResizing: boolean;
  appliedFilters: Record<string, any>;
  // Typed as any[] to match the pre-existing loose shape that ChartElementV2 accepts
  // (the mapped filters from the SWR payload don't include a `position` property).
  dashboardFilterConfigs: any[];
  animationStyles: React.CSSProperties | undefined;
  onRemove: (componentId: string) => void;
  onUpdateConfig: (componentId: string, config: any) => void;
  onViewChart: (chartId: string) => void;
  onEditChart: (chartId: string) => void;
}

// Memoized per-cell renderer. Receives only stable/primitive props so that
// during a drag (when parent re-renders every frame), cells whose boolean
// flags haven't flipped skip re-render entirely.
const DashboardCell = memo(function DashboardCell({
  componentId,
  component,
  isAnimating,
  isBeingPushed,
  isDraggedSpaceMaking,
  isResizing,
  appliedFilters,
  dashboardFilterConfigs,
  animationStyles,
  onRemove,
  onUpdateConfig,
  onViewChart,
  onEditChart,
}: DashboardCellProps) {
  const handleRemove = useCallback(() => onRemove(componentId), [onRemove, componentId]);
  const handleUpdate = useCallback(
    (config: any) => onUpdateConfig(componentId, config),
    [onUpdateConfig, componentId]
  );
  const handleView = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (component.type === DashboardComponentType.CHART) {
        onViewChart(component.config.chartId);
      }
    },
    [onViewChart, component]
  );
  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (component.type === DashboardComponentType.CHART) {
        onEditChart(component.config.chartId);
      }
    },
    [onEditChart, component]
  );
  const handleClickRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove(componentId);
    },
    [onRemove, componentId]
  );

  const isTextComponent = component.type === DashboardComponentType.TEXT;
  const isChartComponent = component.type === DashboardComponentType.CHART;

  return (
    <div
      data-component-id={componentId}
      className={`dashboard-item bg-transparent relative group transition-all duration-200 ${
        isAnimating ? 'animating' : ''
      } ${isBeingPushed ? 'being-pushed' : ''} ${
        isDraggedSpaceMaking ? 'space-making-active' : ''
      } ${isTextComponent ? 'text-component' : ''}`}
      style={animationStyles}
    >
      {isChartComponent && (
        <div className="absolute top-2 right-2 z-50 flex gap-1 drag-cancel opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={handleView}
            className="h-7 w-7 flex items-center justify-center bg-white/90 hover:bg-white rounded shadow-sm transition-all drag-cancel hover:text-blue-600"
            title="View Chart"
          >
            <Eye className="w-3.5 h-3.5 text-gray-600" />
          </button>
          <button
            onClick={handleEdit}
            className="h-7 w-7 flex items-center justify-center bg-white/90 hover:bg-white rounded shadow-sm transition-all drag-cancel hover:text-green-600"
            title="Edit Chart"
          >
            <Edit className="w-3.5 h-3.5 text-gray-600" />
          </button>
          <button
            onClick={handleClickRemove}
            className="h-7 w-7 flex items-center justify-center bg-white/90 hover:bg-white rounded shadow-sm transition-all drag-cancel hover:text-red-600"
            title="Remove Chart From Dashboard"
          >
            <X className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>
      )}

      {isTextComponent && (
        <div className="absolute top-2 right-2 z-50 flex gap-1 drag-cancel opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={handleClickRemove}
            className="p-1 bg-white/80 hover:bg-white rounded transition-all drag-cancel hover:text-red-600"
            title="Remove text"
          >
            <X className="w-3 h-3 text-gray-500" />
          </button>
        </div>
      )}

      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-blue-50/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-move flex items-center justify-center z-20">
        <div className="text-xs text-gray-400 font-medium">Drag to move</div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 drag-cancel">
        {isChartComponent && (
          <ChartElementV2
            onRemove={handleRemove}
            onUpdate={handleUpdate}
            chartId={component.config.chartId}
            config={component.config}
            isResizing={isResizing}
            appliedFilters={appliedFilters}
            dashboardFilterConfigs={dashboardFilterConfigs}
          />
        )}
        {isTextComponent && (
          <UnifiedTextElement onUpdate={handleUpdate} config={component.config} isEditMode={true} />
        )}
      </div>
    </div>
  );
});

export const DashboardBuilderV2 = forwardRef<DashboardBuilderV2Ref, DashboardBuilderV2Props>(
  function DashboardBuilderV2(
    { dashboardId, initialData, isNewDashboard, onBack, onPreview, isNavigating },
    ref
  ) {
    const router = useRouter();

    // Ensure layout_config is always an array
    let initialLayout = Array.isArray(initialData?.layout_config) ? initialData.layout_config : [];
    const initialComponents = initialData?.components || {};

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
          }
        }
      });
      return updatedComponents;
    };

    // Ensure all text components have content constraints
    const componentsWithConstraints = ensureTextContentConstraints(initialComponents);

    // Apply minimum size constraints to existing layout items
    initialLayout = initialLayout.map((item: any) => {
      const component = componentsWithConstraints[item.i];
      if (component) {
        const chartType = getChartTypeFromConfig(component.config);
        // Always use base chart type constraints for minW/minH (resize limits)
        // This ensures users can freely resize components
        const baseMinDimensions = getMinGridDimensions(chartType);

        return {
          ...item,
          // Keep the saved dimensions - don't force expand based on content constraints
          w: item.w || baseMinDimensions.w,
          h: item.h || baseMinDimensions.h,
          // Use base constraints for resize limits (allows flexible resizing)
          minW: baseMinDimensions.w,
          minH: baseMinDimensions.h,
        };
      }
      return item;
    });

    // Load responsive layouts if available, otherwise they'll be generated later
    const initialResponsiveLayouts = initialData?.responsive_layouts || null;

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

    // Load filters from backend with proper error handling.
    // Memoized on the source reference so child components receive a stable array ref.
    const initialFilters = useMemo(() => {
      if (!Array.isArray(dashboardFilters)) return [];
      return dashboardFilters
        .map((filter: any) => {
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
            filter_type: filter.filter_type || 'value',
            settings: filter.settings || {},
          };
        })
        .filter(Boolean);
    }, [dashboardFilters]);

    // Don't create filter components - they should already be in initialComponents
    // Just use the components and layout as they are
    const mergedComponents = componentsWithConstraints;
    const mergedLayout = initialLayout;

    // Use saved responsive layouts if available, otherwise generate them
    const initialLayouts = initialResponsiveLayouts || generateResponsiveLayouts(mergedLayout);

    // State management with undo/redo (canvas only - no filters)
    const {
      state,
      setState,
      setStateWithoutHistory,
      undo: undoBase,
      redo: redoBase,
      canUndo,
      canRedo,
    } = useUndoRedo<DashboardState>(
      {
        layout: mergedLayout,
        layouts: initialLayouts,
        components: mergedComponents,
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
    const [isLocked, setIsLocked] = useState(false);
    const [lockToken, setLockToken] = useState<string | null>(null);
    const [lockRefreshInterval, setLockRefreshInterval] = useState<NodeJS.Timeout | null>(null);

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
      if (!dashboardContainerRef.current) return;

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

    // Auto-save (but not during undo/redo operations)
    useEffect(() => {
      if (dashboardId && debouncedState && !isUndoRedoOperation) {
        saveDashboard();
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
      if (!dashboardId) return;

      // Clear any existing interval first
      if (lockRefreshInterval) {
        clearInterval(lockRefreshInterval);
        setLockRefreshInterval(null);
      }

      try {
        const response = await apiPost(`/api/dashboards/${dashboardId}/lock/`, {});
        setIsLocked(true);
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
            setIsLocked(false);
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

        setIsLocked(false);
        setLockToken(null);
      } catch (error) {
        console.error('Failed to unlock dashboard:', error);
      }
    };

    // Save dashboard
    const saveDashboard = async (overrides: any = {}) => {
      if (!dashboardId) return;

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
          layout_config: JSON.parse(JSON.stringify(state.layout)), // Safe deep clone
          components: JSON.parse(JSON.stringify(state.components)), // Safe deep clone
          // filters removed - managed via separate API endpoints
          ...overrides, // Apply any overrides passed to the function
        };

        await apiPut(`/api/dashboards/${dashboardId}/`, payload);

        setSaveStatus('saved');
        // Reset save status after 3 seconds
        setTimeout(() => {
          setSaveStatus('idle');
        }, 3000);
      } catch (error: any) {
        console.error('Failed to save dashboard:', error.message || 'Please try again');
        setSaveStatus('error');
        setSaveError(error.message || 'Failed to save dashboard. Please try again.');

        // Reset error status after 5 seconds
        setTimeout(() => {
          setSaveStatus('idle');
          setSaveError(null);
        }, 5000);
      } finally {
        setIsSaving(false);
      }
    };

    // Expose cleanup function to parent component
    useImperativeHandle(
      ref,
      () => ({
        cleanup: async () => {
          // First save any pending changes
          if (dashboardId) {
            try {
              await saveDashboard();
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
        },
      }),
      [dashboardId, lockToken, saveDashboard, unlockDashboard]
    );

    // Track if we're currently dragging
    // Keep state for UI rendering purposes
    const [isDragging, setIsDragging] = useState(false);
    const [draggedItem, setDraggedItem] = useState<DashboardLayout | null>(null);

    // IMPORTANT: Use refs for synchronous access in callbacks
    // React state updates are async, but react-grid-layout calls handlers synchronously
    // Without refs, the values won't be available when handleLayoutChange is called
    const isDraggingRef = useRef(false);

    // RAF-coalesced snap zone update: RGL fires onLayoutChange at high frequency
    // during drag/resize; we only need to recompute zones once per paint.
    const snapZoneFrameRef = useRef<number | null>(null);
    const pendingSnapZoneLayoutRef = useRef<any[] | null>(null);
    const requestSnapZoneUpdate = useCallback(
      (layout: any[]) => {
        pendingSnapZoneLayoutRef.current = layout;
        if (snapZoneFrameRef.current !== null) return;
        snapZoneFrameRef.current = requestAnimationFrame(() => {
          snapZoneFrameRef.current = null;
          const next = pendingSnapZoneLayoutRef.current;
          pendingSnapZoneLayoutRef.current = null;
          if (next) dashboardAnimation.updateSnapZones(next);
        });
      },
      [dashboardAnimation]
    );
    useEffect(() => {
      return () => {
        if (snapZoneFrameRef.current !== null) {
          cancelAnimationFrame(snapZoneFrameRef.current);
          snapZoneFrameRef.current = null;
        }
      };
    }, []);

    // Handle layout changes for responsive grid
    const handleLayoutChange = (currentLayout: any[], allLayouts: ResponsiveLayouts) => {
      const isInteracting = isDraggingRef.current || isResizing;

      // Only update snap zones while the user is actively interacting; RAF-throttle
      // to at most once per animation frame to avoid flooding React with setState calls.
      if (isInteracting) {
        requestSnapZoneUpdate(currentLayout);
      }

      // Reuse the previous layouts object reference if RGL handed back the same one.
      const nextLayouts = allLayouts === state.layouts ? state.layouts : allLayouts;

      // During drag, resize, or undo/redo operations, use setStateWithoutHistory to avoid
      // flooding history with intermediate positions produced by RGL's collision cascade.
      if (isInteracting || isUndoRedoOperation) {
        setStateWithoutHistory({
          ...state,
          layout: currentLayout,
          layouts: nextLayouts,
        });
      } else {
        // Only save to history for user-initiated layout changes
        setState({
          ...state,
          layout: currentLayout,
          layouts: nextLayouts,
        });
      }
    };

    // Handle drag start
    const handleDragStart = (layout: any[], oldItem: any, newItem: any) => {
      // IMPORTANT: Set ref FIRST (synchronous) before state (async).
      // react-grid-layout calls onLayoutChange synchronously after onDragStart,
      // so the ref must be set before the state updates for handleLayoutChange
      // to route intermediate layouts to setStateWithoutHistory.
      isDraggingRef.current = true;

      // Also update state for UI purposes (async)
      setIsDragging(true);
      setDraggedItem(newItem);
    };

    // Handle drag (real-time updates during drag)
    const handleDrag = (layout: any[], oldItem: any, newItem: any) => {
      // Update the dragged item position for real-time space making
      setDraggedItem(newItem);
    };

    // Handle drag stop - save final position to history
    const handleDragStop = (layout: any[], oldItem: any, newItem: any) => {
      // Clear space-making state
      dashboardAnimation.clearSpaceMaking();

      // Apply magnetic snapping to the dropped item. RGL has already pushed
      // colliding items out of the way (preventCollision={false}); we just commit
      // the resulting layout to history.
      const snappedItem = dashboardAnimation.applySnapping(newItem, layout);
      const finalLayout = layout.map((item) => (item.i === snappedItem.i ? snappedItem : item));

      // Clear ref FIRST (synchronous)
      isDraggingRef.current = false;

      // Clear state (async)
      setIsDragging(false);
      setDraggedItem(null);

      // Only save to history if we're not in an undo/redo operation
      if (!isUndoRedoOperation) {
        const allLayouts = state.layouts || {};
        setState({
          ...state,
          layout: finalLayout,
          layouts: allLayouts,
        });
      }
    };

    // Handle breakpoint changes
    const [currentBreakpoint, setCurrentBreakpoint] = useState('lg');
    const handleBreakpointChange = (newBreakpoint: string) => {
      setCurrentBreakpoint(newBreakpoint);
    };

    // Track if we're currently resizing
    const [isResizing, setIsResizing] = useState(false);

    // Handle resize start
    const handleResizeStart = (
      layout: DashboardLayout[],
      oldItem: DashboardLayout,
      newItem: DashboardLayout
    ) => {
      setResizingItems(new Set([...resizingItems, newItem.i]));
      setIsResizing(true);
    };

    // Handle resize stop - save final size to history
    const handleResizeStop = (
      layout: DashboardLayout[],
      oldItem: DashboardLayout,
      newItem: DashboardLayout
    ) => {
      const newResizingItems = new Set(resizingItems);
      newResizingItems.delete(newItem.i);
      setResizingItems(newResizingItems);
      setIsResizing(false);

      // Enforce minimum dimensions on final resize
      const component = state.components[newItem.i];
      let finalLayout = layout;

      if (component) {
        const chartType = getChartTypeFromConfig(component.config);
        let minDimensions;

        // Use stored content constraints if available, otherwise use generic constraints
        if (component.config.contentConstraints) {
          // Convert content constraints to grid dimensions
          minDimensions = {
            w: Math.max(
              1,
              Math.min(12, pixelsToGridUnits(component.config.contentConstraints.minWidth, true))
            ),
            h: Math.max(1, pixelsToGridUnits(component.config.contentConstraints.minHeight, false)),
          };
        } else {
          minDimensions = getMinGridDimensions(chartType);
        }

        // Ensure the resized item meets minimum requirements
        const constrainedItem = {
          ...newItem,
          w: Math.max(newItem.w, minDimensions.w),
          h: Math.max(newItem.h, minDimensions.h),
          minW: minDimensions.w,
          minH: minDimensions.h,
        };

        // Update layout with constrained item
        finalLayout = layout.map((item) => (item.i === newItem.i ? constrainedItem : item));
      }

      // Only save to history if we're not in an undo/redo operation
      if (!isUndoRedoOperation) {
        const allLayouts = state.layouts || {};
        setState({
          ...state,
          layout: finalLayout,
          layouts: allLayouts,
        });
      }
    };

    // Handle resize (during resize)
    const handleResize = (layout: DashboardLayout[]) => {
      // Enforce minimum dimensions during resize
      const constrainedLayout = layout.map((item) => {
        const component = state.components[item.i];
        if (component) {
          const chartType = getChartTypeFromConfig(component.config);
          let minDimensions;

          // Use stored content constraints if available
          if (component.config.contentConstraints) {
            minDimensions = {
              w: Math.max(
                1,
                Math.min(12, pixelsToGridUnits(component.config.contentConstraints.minWidth, true))
              ),
              h: Math.max(
                1,
                pixelsToGridUnits(component.config.contentConstraints.minHeight, false)
              ),
            };
          } else {
            minDimensions = getMinGridDimensions(chartType);
          }

          // Ensure item doesn't go below minimum dimensions
          return {
            ...item,
            w: Math.max(item.w, minDimensions.w),
            h: Math.max(item.h, minDimensions.h),
            minW: minDimensions.w,
            minH: minDimensions.h,
          };
        }
        return item;
      });

      // Use setStateWithoutHistory during resize to avoid flooding history
      const allLayouts = state.layouts || {};
      setStateWithoutHistory({
        ...state,
        layout: constrainedLayout,
        layouts: allLayouts,
      });
    };

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

        const position = dashboardAnimation.findBestPosition(defaultDimensions, state.layout);

        const newLayoutItem: DashboardLayout = {
          i: newComponent.id,
          x: position.x,
          y: position.y,
          w: defaultDimensions.w,
          h: defaultDimensions.h,
          minW: minDimensions.w,
          maxW: 12,
          minH: minDimensions.h,
        };

        const newLayout = [...state.layout, newLayoutItem];
        const newLayouts = generateResponsiveLayouts(newLayout);

        setState({
          layout: newLayout,
          layouts: newLayouts,
          components: {
            ...state.components,
            [newComponent.id]: newComponent,
          },
        });

        // Animate component entrance
        dashboardAnimation.animateComponent(newComponent.id, 500);

        // Smart scroll to show the newly added component if needed
        scrollToComponentIfNeeded(newComponent.id);
      } catch (error) {
        console.error('Failed to add chart');
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

      // Find the best available position for the new text component using smart positioning
      const position = dashboardAnimation.findBestPosition(textDimensions, state.layout);

      const newLayoutItem: DashboardLayout = {
        i: newComponent.id,
        x: position.x,
        y: position.y,
        w: textDimensions.w,
        h: textDimensions.h,
        minW: textMinDimensions.w,
        maxW: 12,
        minH: textMinDimensions.h,
      };

      const newLayout = [...state.layout, newLayoutItem];
      const newLayouts = generateResponsiveLayouts(newLayout);

      setState({
        layout: newLayout,
        layouts: newLayouts,
        components: {
          ...state.components,
          [newComponent.id]: newComponent,
        },
      });

      // Animate component entrance
      dashboardAnimation.animateComponent(newComponent.id, 500);

      // Smart scroll to show the newly added component if needed
      scrollToComponentIfNeeded(newComponent.id);
    };

    // Remove component — implementation held in a ref so the exposed `removeComponent`
    // keeps a stable identity across renders (lets `DashboardCell`'s memo work).
    const removeComponentImplRef = useRef<(id: string) => void>(() => {});
    removeComponentImplRef.current = (componentId: string) => {
      const newComponents = { ...state.components };
      delete newComponents[componentId];

      const newLayout = state.layout.filter((item) => item.i !== componentId);
      const newLayouts = generateResponsiveLayouts(newLayout);

      setState({
        layout: newLayout,
        layouts: newLayouts,
        components: newComponents,
      });
    };
    const removeComponent = useCallback(
      (componentId: string) => removeComponentImplRef.current(componentId),
      []
    );

    // Stable navigation callbacks passed into memoized cells.
    const handleViewChart = useCallback(
      (chartId: string) => {
        router.push(`/charts/${chartId}?from=dashboard`);
      },
      [router]
    );
    const handleEditChart = useCallback(
      (chartId: string) => {
        router.push(`/charts/${chartId}/edit?from=dashboard`);
      },
      [router]
    );

    // Handle when filters are applied (causes chart re-renders)
    const handleFiltersApplied = (newAppliedFilters: Record<string, any>) => {
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

      // Guard against state.components being null/undefined during state transitions
      if (state.components) {
        Object.values(state.components).forEach((component) => {
          if (component.type === DashboardComponentType.CHART && component.config.chartId) {
            chartIds.push(component.config.chartId);
          }
        });
      }

      return chartIds;
    };

    // Update component config — stable identity via ref (see removeComponent above).
    const updateComponentImplRef = useRef<(id: string, newConfig: any) => void>(() => {});
    updateComponentImplRef.current = (componentId: string, newConfig: any) => {
      setState({
        ...state,
        components: {
          ...state.components,
          [componentId]: {
            ...state.components[componentId],
            config: newConfig,
          },
        },
      });
    };
    const updateComponent = useCallback(
      (componentId: string, newConfig: any) =>
        updateComponentImplRef.current(componentId, newConfig),
      []
    );

    // Find next available position for new component
    const findAvailablePosition = (width: number, height: number): { x: number; y: number } => {
      const layout = state.layout || [];
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

    // Precompute per-frame derived state once, then hand O(1) booleans to memoized cells.
    // `isBeingPushed` preserves the existing key shape (`${x}-${y}`) used by the animation hook.
    const draggedId = draggedItem?.i;
    const spaceMakingActive = dashboardAnimation.spaceMakingActive;
    const animatingComponents = dashboardAnimation.animatingComponents;
    const affectedComponentIdSet = useMemo(() => {
      return new Set(dashboardAnimation.affectedComponents.map((a) => a.componentId));
    }, [dashboardAnimation.affectedComponents]);

    const renderDashboardCells = (Array.isArray(state.layout) ? state.layout : []).map((item) => {
      const component = state.components[item.i];
      if (!component) return null;

      const isAnimating = animatingComponents.has(item.i);
      const isBeingPushed = affectedComponentIdSet.has(`${item.x}-${item.y}`);
      const isDraggedComponent = draggedId === item.i;
      // Only allocate an animation style object when the cell is actually animating.
      const animationStyles = isAnimating
        ? dashboardAnimation.getAnimationStyles(item.i)
        : undefined;

      return (
        <div key={item.i}>
          <DashboardCell
            componentId={item.i}
            component={component}
            isAnimating={isAnimating}
            isBeingPushed={isBeingPushed}
            isDraggedSpaceMaking={isDraggedComponent && spaceMakingActive}
            isResizing={resizingItems.has(item.i)}
            appliedFilters={appliedFilters}
            dashboardFilterConfigs={initialFilters}
            animationStyles={animationStyles}
            onRemove={removeComponent}
            onUpdateConfig={updateComponent}
            onViewChart={handleViewChart}
            onEditChart={handleEditChart}
          />
        </div>
      );
    });

    return (
      <div className="dashboard-builder h-full flex flex-col overflow-hidden">
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

                {isEditingTitle ? (
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Dashboard title..."
                      className="text-sm font-semibold h-8 flex-1"
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
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-1 flex-1 min-w-0 cursor-pointer"
                    onClick={() => setIsEditingTitle(true)}
                  >
                    <h1 className="text-sm font-semibold truncate flex-1 min-w-0 dashboard-header-title">
                      {title}
                    </h1>
                  </div>
                )}
              </div>

              {/* Mobile Quick Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button onClick={() => saveDashboard()} size="sm" variant="ghost" className="p-1.5">
                  <Save className="w-4 h-4" />
                </Button>
                {onPreview && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onPreview}
                    className="p-1.5"
                    disabled={isNavigating}
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
                onClick={addTextComponent}
                size="sm"
                variant="outline"
                className="flex-shrink-0 h-8 text-xs"
              >
                <Type className="w-3 h-3 mr-1" />
                Text
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-shrink-0 h-8 text-xs"
                    disabled={dashboardAnimation.isAnimating}
                  >
                    <Wand2 className="w-3 h-3 mr-1" />
                    Auto
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56">
                  <div className="grid gap-2">
                    <h4 className="font-medium text-sm">Auto-Arrange</h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="justify-start h-8 text-xs"
                      onClick={async () => {
                        const newLayout = await dashboardAnimation.autoArrange(
                          state.layout,
                          'dashboard'
                        );
                        setState({
                          ...state,
                          layout: newLayout,
                          layouts: generateResponsiveLayouts(newLayout),
                        });
                      }}
                    >
                      <LayoutGrid className="w-3 h-3 mr-2" />
                      Smart Pack
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
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
            {(isLocked || saveStatus !== 'idle') && (
              <div className="px-4 pb-2 flex items-center justify-between text-xs">
                {isLocked && (
                  <div className="flex items-center gap-1 text-green-600">
                    <Lock className="w-3 h-3" />
                    <span>Locked</span>
                  </div>
                )}
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Back button */}
                {onBack && (
                  <Button variant="ghost" size="sm" onClick={onBack}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                )}

                <div className="h-6 w-px bg-gray-300" />

                {/* Title editing */}
                {isEditingTitle ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Dashboard title..."
                      className="text-lg font-semibold"
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
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1"
                    onClick={() => setIsEditingTitle(true)}
                  >
                    <h1 className="text-lg font-semibold dashboard-header-title">{title}</h1>
                  </div>
                )}

                <div className="h-6 w-px bg-gray-300" />

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
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Chart
                </Button>

                <Button onClick={addTextComponent} size="sm" variant="outline">
                  <Type className="w-4 h-4 mr-2" />
                  Add Text
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={dashboardAnimation.isAnimating}
                      data-testid="auto-arrange-btn"
                    >
                      <Wand2 className="w-4 h-4 mr-2" />
                      Auto
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56">
                    <div className="grid gap-2">
                      <h4 className="font-medium text-sm">Auto-Arrange</h4>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="justify-start h-8 text-xs"
                        data-testid="auto-arrange-smart-pack-btn"
                        onClick={async () => {
                          const newLayout = await dashboardAnimation.autoArrange(
                            state.layout,
                            'dashboard'
                          );
                          setState({
                            ...state,
                            layout: newLayout,
                            layouts: generateResponsiveLayouts(newLayout),
                          });
                        }}
                      >
                        <LayoutGrid className="w-3 h-3 mr-2" />
                        Smart Pack
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <div className="ml-2 flex gap-1">
                  <Button onClick={undo} disabled={!canUndo} size="sm" variant="ghost">
                    <Undo className="w-4 h-4" />
                  </Button>

                  <Button onClick={redo} disabled={!canRedo} size="sm" variant="ghost">
                    <Redo className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Lock Status */}
                {isLocked ? (
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <Lock className="w-4 h-4" />
                    <span className="hidden xl:inline">Locked for editing</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-sm text-yellow-600">
                    <Unlock className="w-4 h-4" />
                    <span className="hidden xl:inline">Not locked</span>
                  </div>
                )}

                <div className="h-6 w-px bg-gray-300 mx-1" />

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

                <Button onClick={() => saveDashboard()} size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  <span className="hidden lg:inline">Save</span>
                </Button>

                {/* Preview button */}
                {onPreview && (
                  <Button size="sm" variant="outline" onClick={onPreview} disabled={isNavigating}>
                    {isNavigating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4 mr-2" />
                    )}
                    <span className="hidden lg:inline">
                      {isNavigating ? 'Switching...' : 'Preview'}
                    </span>
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
                  Array.isArray(state.layout) && state.layout.length > 0
                    ? Math.max(...state.layout.map((item) => (item.y + item.h) * ROW_HEIGHT)) + 100
                    : 0
                ),
                position: 'relative',
              }}
            >
              {/* Visual grid guides - disabled, using SnapIndicators with neon effect instead */}
              <GridGuides
                containerWidth={actualContainerWidth}
                containerHeight={dashboardActualHeight}
                cols={12}
                visible={false}
              />

              <GridLayout
                className="layout relative z-10"
                layout={getAdjustedLayout(state.layout, currentScreenConfig.cols)}
                cols={currentScreenConfig.cols} // Always exactly 12 columns (Superset-style)
                rowHeight={ROW_HEIGHT}
                width={actualContainerWidth} // Use available container width - columns adjust to fit
                onLayoutChange={(newLayout) => handleLayoutChange(newLayout, state.layouts || {})}
                onDragStart={handleDragStart}
                onDrag={handleDrag}
                onDragStop={handleDragStop}
                onResizeStart={handleResizeStart}
                onResize={handleResize}
                onResizeStop={handleResizeStop}
                draggableCancel=".drag-cancel"
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
                {renderDashboardCells}
              </GridLayout>

              {/* Snap Indicators */}
              <SnapIndicators
                snapZones={dashboardAnimation.snapZones}
                containerWidth={actualContainerWidth}
                containerHeight={dashboardActualHeight}
                rowHeight={ROW_HEIGHT}
                visible={isDragging || isResizing}
              />

              {/* Space Making Indicators */}
              <SpaceMakingIndicators
                affectedComponents={dashboardAnimation.affectedComponents}
                containerWidth={actualContainerWidth}
                containerHeight={dashboardActualHeight}
                rowHeight={ROW_HEIGHT}
                colWidth={actualContainerWidth / currentScreenConfig.cols}
                visible={dashboardAnimation.spaceMakingActive}
              />
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
