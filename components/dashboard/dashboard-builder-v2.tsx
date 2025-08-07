'use client';

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useRouter } from 'next/navigation';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { ChartSelectorModal } from './chart-selector-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { refreshDashboardLock } from '@/hooks/api/useDashboards';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Plus,
  Undo,
  Redo,
  Save,
  Loader2,
  Type,
  Heading1,
  BarChart3,
  Grip,
  X,
  Lock,
  Unlock,
  Settings,
  Edit2,
  Check,
  AlertCircle,
} from 'lucide-react';
// Removed toast import - using console for notifications
import { ChartElementV2 } from './chart-element-v2';
import { UnifiedTextElement, UnifiedTextConfig } from './text-element-unified';

// Types
export enum DashboardComponentType {
  CHART = 'chart',
  TEXT = 'text',
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

interface DashboardComponent {
  id: string;
  type: DashboardComponentType;
  config: any;
}

interface DashboardState {
  layout: DashboardLayout[];
  components: Record<string, DashboardComponent>;
}

interface DashboardBuilderV2Props {
  dashboardId?: number;
  initialData?: any;
  isNewDashboard?: boolean;
  dashboardLockInfo?: {
    isLocked: boolean;
    lockedBy?: string;
  };
}

// Interface for the ref methods exposed to parent
interface DashboardBuilderV2Ref {
  cleanup: () => Promise<void>;
}

export const DashboardBuilderV2 = forwardRef<DashboardBuilderV2Ref, DashboardBuilderV2Props>(
  function DashboardBuilderV2({ dashboardId, initialData, isNewDashboard }, ref) {
    const router = useRouter();

    // Ensure layout_config is always an array
    const initialLayout = Array.isArray(initialData?.layout_config)
      ? initialData.layout_config
      : [];
    const initialComponents = initialData?.components || {};

    // State management with undo/redo
    const { state, setState, undo, redo, canUndo, canRedo } = useUndoRedo<DashboardState>(
      {
        layout: initialLayout,
        components: initialComponents,
      },
      20
    );

    // Component state
    const [showChartSelector, setShowChartSelector] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isLocked, setIsLocked] = useState(false);
    const [lockToken, setLockToken] = useState<string | null>(null);
    const [lockRefreshInterval, setLockRefreshInterval] = useState<NodeJS.Timeout | null>(null);

    // Refs to store current values for event handlers without causing re-renders
    const lockStateRef = useRef({ dashboardId, lockToken, lockRefreshInterval });

    // Update refs when values change
    useEffect(() => {
      lockStateRef.current = { dashboardId, lockToken, lockRefreshInterval };
    }, [dashboardId, lockToken, lockRefreshInterval]);
    const [title, setTitle] = useState(initialData?.title || 'Untitled Dashboard');
    const [description, setDescription] = useState(initialData?.description || '');
    const [isEditingTitle, setIsEditingTitle] = useState(isNewDashboard || false);
    const [gridColumns, setGridColumns] = useState(initialData?.grid_columns || 12);
    const [showSettings, setShowSettings] = useState(false);
    const [resizingItems, setResizingItems] = useState<Set<string>>(new Set());
    const [containerWidth, setContainerWidth] = useState(1200);

    // Ref for the canvas container to measure its width
    const canvasRef = useRef<HTMLDivElement>(null);

    // Debounced state for auto-save (keep original 5-second delay for responsive auto-save)
    const debouncedState = useDebounce(state, 5000);

    // Measure container width and update on resize
    useEffect(() => {
      let lastWidth = 0;

      const updateWidth = () => {
        if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          const newWidth = Math.max(rect.width - 32, 800); // Subtract padding, minimum 800px

          // Only update if width has changed significantly (prevent infinite loops)
          if (Math.abs(newWidth - lastWidth) > 10) {
            lastWidth = newWidth;
            setContainerWidth(newWidth);
          }
        }
      };

      // Initial measurement with delay to ensure DOM is ready
      const timer = setTimeout(updateWidth, 100);

      // Update on window resize with debouncing
      let resizeTimeout: NodeJS.Timeout;
      const debouncedResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(updateWidth, 150);
      };

      window.addEventListener('resize', debouncedResize);

      return () => {
        clearTimeout(timer);
        clearTimeout(resizeTimeout);
        window.removeEventListener('resize', debouncedResize);
      };
    }, []);

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

    // Auto-save
    useEffect(() => {
      if (dashboardId && debouncedState) {
        saveDashboard();
      }
    }, [debouncedState]);

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
    const saveDashboard = async () => {
      if (!dashboardId) return;

      setIsSaving(true);
      setSaveStatus('saving');
      setSaveError(null);

      try {
        await apiPut(`/api/dashboards/${dashboardId}/`, {
          title,
          description,
          grid_columns: gridColumns,
          layout_config: state.layout,
          components: state.components,
        });

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
              console.log('Dashboard saved before cleanup');
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

    // Handle layout changes
    const handleLayoutChange = (newLayout: GridLayout.Layout[]) => {
      setState({
        ...state,
        layout: newLayout,
      });
    };

    // Handle resize start
    const handleResizeStart = (
      layout: GridLayout.Layout[],
      oldItem: GridLayout.Layout,
      newItem: GridLayout.Layout
    ) => {
      setResizingItems(new Set([...resizingItems, newItem.i]));
    };

    // Handle resize stop
    const handleResizeStop = (
      layout: GridLayout.Layout[],
      oldItem: GridLayout.Layout,
      newItem: GridLayout.Layout
    ) => {
      const newResizingItems = new Set(resizingItems);
      newResizingItems.delete(newItem.i);
      setResizingItems(newResizingItems);
    };

    // Add chart component
    const handleChartSelected = async (chartId: number) => {
      try {
        console.log('Adding chart with ID:', chartId);
        // Fetch chart details - for now, use mock data
        let chartDetails;
        try {
          chartDetails = await apiGet(`/api/charts/${chartId}/`);
        } catch (error) {
          console.log('Failed to fetch chart, using mock data');
          // Use mock data if API fails
          chartDetails = {
            id: chartId,
            title: `Chart #${chartId}`,
            chart_type: 'bar',
            computation_type: 'raw',
          };
        }

        const newComponent: DashboardComponent = {
          id: `chart-${Date.now()}`,
          type: DashboardComponentType.CHART,
          config: {
            chartId,
            title: chartDetails.title,
            chartType: chartDetails.chart_type,
            ...chartDetails,
          },
        };

        // Find the best available position for the new chart
        const position = findAvailablePosition(4, 8);

        const newLayoutItem: DashboardLayout = {
          i: newComponent.id,
          x: position.x,
          y: position.y,
          w: 4,
          h: 8,
          minW: 2,
          maxW: 12,
          minH: 4,
        };

        setState({
          layout: [...state.layout, newLayoutItem],
          components: {
            ...state.components,
            [newComponent.id]: newComponent,
          },
        });
      } catch (error: any) {
        console.error('Failed to add chart:', error.message || 'Please try again');
      }
    };

    console.log(state);

    // Add text component
    const addTextComponent = () => {
      const newComponent: DashboardComponent = {
        id: `text-${Date.now()}`,
        type: DashboardComponentType.TEXT,
        config: {
          content: '',
          type: 'paragraph',
          fontSize: 14,
          fontWeight: 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
          textAlign: 'left',
          color: '#000000',
        } as UnifiedTextConfig,
      };

      // Find the best available position for the new text component
      const position = findAvailablePosition(4, 3);

      const newLayoutItem: DashboardLayout = {
        i: newComponent.id,
        x: position.x,
        y: position.y,
        w: 4,
        h: 3,
        minW: 2,
        maxW: 12,
        minH: 2,
      };

      setState({
        layout: [...state.layout, newLayoutItem],
        components: {
          ...state.components,
          [newComponent.id]: newComponent,
        },
      });
    };

    // Remove component
    const removeComponent = (componentId: string) => {
      const newComponents = { ...state.components };
      delete newComponents[componentId];

      setState({
        layout: state.layout.filter((item) => item.i !== componentId),
        components: newComponents,
      });
    };

    // Get chart IDs that are already added to the dashboard
    const getExcludedChartIds = (): number[] => {
      const chartIds: number[] = [];

      Object.values(state.components).forEach((component) => {
        if (component.type === DashboardComponentType.CHART && component.config.chartId) {
          chartIds.push(component.config.chartId);
        }
      });

      return chartIds;
    };

    // Update component config
    const updateComponent = (componentId: string, newConfig: any) => {
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

    // Find next available position for new component
    const findAvailablePosition = (width: number, height: number): { x: number; y: number } => {
      const layout = state.layout || [];
      const maxCols = gridColumns;

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

    // Render components
    const renderComponent = (componentId: string) => {
      const component = state.components[componentId];
      if (!component) return null;

      const commonProps = {
        onRemove: () => removeComponent(componentId),
        onUpdate: (config: any) => updateComponent(componentId, config),
      };

      switch (component.type) {
        case DashboardComponentType.CHART:
          return (
            <ChartElementV2
              {...commonProps}
              chartId={component.config.chartId}
              config={component.config}
              isResizing={resizingItems.has(componentId)}
            />
          );

        case DashboardComponentType.TEXT:
          return <UnifiedTextElement {...commonProps} config={component.config} />;

        default:
          return null;
      }
    };

    return (
      <div className="dashboard-builder h-full flex flex-col">
        {/* Header with Title */}
        <div className="border-b px-6 py-3 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Dashboard title..."
                    className="text-xl font-semibold"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setIsEditingTitle(false);
                        saveDashboard();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditingTitle(false);
                      saveDashboard();
                    }}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1"
                  onClick={() => setIsEditingTitle(true)}
                >
                  <h1 className="text-xl font-semibold">{title}</h1>
                  <Edit2 className="w-4 h-4 text-gray-400" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Save Status Indicator */}
              {saveStatus === 'saving' && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </div>
              )}
              {saveStatus === 'saved' && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  Saved
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  {saveError || 'Save failed'}
                </div>
              )}

              <Popover>
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
                        Configure your dashboard layout
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <div className="grid grid-cols-3 items-center gap-4">
                        <Label htmlFor="grid-columns">Grid Columns</Label>
                        <select
                          id="grid-columns"
                          value={gridColumns}
                          onChange={(e) => {
                            setGridColumns(Number(e.target.value));
                            saveDashboard();
                          }}
                          className="col-span-2 px-3 py-2 border rounded-md"
                        >
                          <option value={12}>12 Columns</option>
                          <option value={14}>14 Columns</option>
                          <option value={16}>16 Columns</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Button onClick={saveDashboard} size="sm" variant="outline">
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="toolbar flex gap-2 p-4 border-b bg-gray-50">
          <Button onClick={() => setShowChartSelector(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Chart
          </Button>

          <Button onClick={addTextComponent} size="sm" variant="outline">
            <Type className="w-4 h-4 mr-2" />
            Add Text
          </Button>

          <div className="ml-4 flex gap-1">
            <Button onClick={undo} disabled={!canUndo} size="sm" variant="ghost">
              <Undo className="w-4 h-4" />
            </Button>

            <Button onClick={redo} disabled={!canRedo} size="sm" variant="ghost">
              <Redo className="w-4 h-4" />
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {isLocked ? (
              <div className="flex items-center gap-1 text-sm text-green-600">
                <Lock className="w-4 h-4" />
                Locked for editing
              </div>
            ) : (
              <div className="flex items-center gap-1 text-sm text-yellow-600">
                <Unlock className="w-4 h-4" />
                Not locked
              </div>
            )}
          </div>
        </div>

        {/* Dashboard Canvas */}
        <div ref={canvasRef} className="flex-1 overflow-auto bg-gray-50 p-4">
          <GridLayout
            className="layout"
            layout={Array.isArray(state.layout) ? state.layout : []}
            cols={gridColumns}
            rowHeight={30}
            width={containerWidth}
            onLayoutChange={handleLayoutChange}
            onResizeStart={handleResizeStart}
            onResizeStop={handleResizeStop}
            draggableHandle=".drag-handle"
            compactType={null}
            preventCollision={true}
            allowOverlap={false}
          >
            {(Array.isArray(state.layout) ? state.layout : []).map((item) => (
              <div key={item.i} className="dashboard-item bg-white rounded-lg shadow-sm border">
                <div className="drag-handle absolute top-2 left-2 cursor-move p-1 hover:bg-gray-100 rounded">
                  <Grip className="w-4 h-4 text-gray-400" />
                </div>
                <button
                  onClick={() => removeComponent(item.i)}
                  className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
                <div className="p-4 h-full">{renderComponent(item.i)}</div>
              </div>
            ))}
          </GridLayout>
        </div>

        {/* Chart Selector Modal */}
        <ChartSelectorModal
          open={showChartSelector}
          onClose={() => setShowChartSelector(false)}
          onSelect={handleChartSelected}
          excludedChartIds={getExcludedChartIds()}
        />
      </div>
    );
  }
);
