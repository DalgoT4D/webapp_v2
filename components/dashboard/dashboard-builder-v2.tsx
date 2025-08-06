'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { TextElement } from './text-element';
import { HeadingElement } from './heading-element';

// Types
export enum DashboardComponentType {
  CHART = 'chart',
  TEXT = 'text',
  HEADING = 'heading',
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
}

export function DashboardBuilderV2({
  dashboardId,
  initialData,
  isNewDashboard,
}: DashboardBuilderV2Props) {
  // Ensure layout_config is always an array
  const initialLayout = Array.isArray(initialData?.layout_config) ? initialData.layout_config : [];
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
  const [title, setTitle] = useState(initialData?.title || 'Untitled Dashboard');
  const [description, setDescription] = useState(initialData?.description || '');
  const [isEditingTitle, setIsEditingTitle] = useState(isNewDashboard || false);
  const [gridColumns, setGridColumns] = useState(initialData?.grid_columns || 12);
  const [showSettings, setShowSettings] = useState(false);
  const [resizingItems, setResizingItems] = useState<Set<string>>(new Set());

  // Debounced state for auto-save
  const debouncedState = useDebounce(state, 5000);

  // Lock management
  useEffect(() => {
    if (dashboardId) {
      lockDashboard();
    }

    return () => {
      if (dashboardId && lockToken) {
        unlockDashboard();
      }
    };
  }, [dashboardId]);

  // Auto-save
  useEffect(() => {
    if (dashboardId && debouncedState) {
      saveDashboard();
    }
  }, [debouncedState]);

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

  // Lock dashboard for editing
  const lockDashboard = async () => {
    try {
      const response = await apiPost(`/api/dashboards/${dashboardId}/lock/`, {});
      setIsLocked(true);
      setLockToken(response.lock_token);
    } catch (error: any) {
      console.error(
        'Failed to lock dashboard:',
        error.message || 'Someone else might be editing this dashboard'
      );
    }
  };

  // Unlock dashboard
  const unlockDashboard = async () => {
    try {
      await apiDelete(`/api/dashboards/${dashboardId}/lock/`);
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

      const newLayoutItem: DashboardLayout = {
        i: newComponent.id,
        x: 0,
        y: 0,
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
        content: 'Enter your text here...',
        fontSize: 14,
        fontWeight: 'normal',
        color: '#000000',
      },
    };

    const newLayoutItem: DashboardLayout = {
      i: newComponent.id,
      x: 0,
      y: 0,
      w: 3,
      h: 4,
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

  // Add heading component
  const addHeadingComponent = () => {
    const newComponent: DashboardComponent = {
      id: `heading-${Date.now()}`,
      type: DashboardComponentType.HEADING,
      config: {
        text: 'Dashboard Section',
        level: 2,
        color: '#000000',
      },
    };

    const newLayoutItem: DashboardLayout = {
      i: newComponent.id,
      x: 0,
      y: 0,
      w: 6,
      h: 2,
      minW: 2,
      maxW: 12,
      minH: 1,
      maxH: 3,
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
        return <TextElement {...commonProps} config={component.config} />;

      case DashboardComponentType.HEADING:
        return <HeadingElement {...commonProps} config={component.config} />;

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
                    <p className="text-sm text-muted-foreground">Configure your dashboard layout</p>
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

        <Button onClick={addHeadingComponent} size="sm" variant="outline">
          <Heading1 className="w-4 h-4 mr-2" />
          Add Heading
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
      <div className="flex-1 overflow-auto bg-gray-50 p-4">
        <GridLayout
          className="layout"
          layout={Array.isArray(state.layout) ? state.layout : []}
          cols={gridColumns}
          rowHeight={30}
          width={1200}
          onLayoutChange={handleLayoutChange}
          onResizeStart={handleResizeStart}
          onResizeStop={handleResizeStop}
          draggableHandle=".drag-handle"
          compactType={null}
          preventCollision={false}
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
      />
    </div>
  );
}
