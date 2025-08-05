'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { ChartSelectorModal } from './chart-selector-modal';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
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
}

export function DashboardBuilderV2({ dashboardId, initialData }: DashboardBuilderV2Props) {
  // State management with undo/redo
  const { state, setState, undo, redo, canUndo, canRedo } = useUndoRedo<DashboardState>(
    {
      layout: initialData?.layout_config || [],
      components: initialData?.components || {},
    },
    20
  );

  // Component state
  const [showChartSelector, setShowChartSelector] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockToken, setLockToken] = useState<string | null>(null);
  const [title, setTitle] = useState(initialData?.title || 'Untitled Dashboard');
  const [description, setDescription] = useState(initialData?.description || '');

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
      toast({
        title: 'Failed to lock dashboard',
        description: error.message || 'Someone else might be editing this dashboard',
        variant: 'destructive',
      });
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
    try {
      await apiPut(`/api/dashboards/${dashboardId}/`, {
        title,
        description,
        layout_config: state.layout,
        components: state.components,
      });
    } catch (error: any) {
      toast({
        title: 'Failed to save dashboard',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
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
      toast({
        title: 'Failed to add chart',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    }
  };

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
      {/* Toolbar */}
      <div className="toolbar flex gap-2 p-4 border-b bg-white">
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
          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </div>
          )}

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

          <Button onClick={saveDashboard} size="sm" variant="outline">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      {/* Dashboard Canvas */}
      <div className="flex-1 overflow-auto bg-gray-50 p-4">
        <GridLayout
          className="layout"
          layout={state.layout}
          cols={12}
          rowHeight={30}
          width={1200}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".drag-handle"
          compactType={null}
          preventCollision={false}
        >
          {state.layout.map((item) => (
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
