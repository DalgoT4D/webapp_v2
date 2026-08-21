// components/transform/canvas/Canvas.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  Background,
  ControlButton,
  Controls,
  MarkerType,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type DefaultEdgeOptions,
  type Node,
  type NodeTypes,
} from 'reactflow';
import { LayoutGrid, RefreshCw, RotateCcw } from 'lucide-react';
import 'reactflow/dist/style.css';

import DbtSourceModelNode from './nodes/DbtSourceModelNode';
import OperationNode from './nodes/OperationNode';
import CanvasMessages from './CanvasMessages';
import { useCanvasGraph } from '@/hooks/api/useCanvasGraph';
import { useCanvasLayout } from '@/hooks/api/useCanvasLayout';
import { useCanvasAction, useTransformStore } from '@/stores/transformStore';
import { toastError } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { type CanvasNodePositionUpdate, type CanvasNodeRenderData } from '@/types/transform';
import { getNodePositionAfterDrag } from './utils/node-positioning';
import { getNodeDimensions } from './utils/canvas-layout';
import { getAutoArrangedCanvas, resolveCanvasElements } from './utils/canvas-state';

const nodeTypes: NodeTypes = {
  source: DbtSourceModelNode,
  model: DbtSourceModelNode,
  operation: OperationNode,
};

const NODE_ORIGIN: [number, number] = [0, 0];
const EDGE_COLOR = '#9E9E9E';
const FOCUS_DELAY_MS = 300;
const FOCUS_ZOOM_LEVEL = 1.2;
const FOCUS_ANIMATION_DURATION_MS = 800;
const AUTO_ARRANGE_PADDING = 0.2;
const AUTO_ARRANGE_ANIMATION_DURATION_MS = 300;

const defaultEdgeOptions: DefaultEdgeOptions = {
  type: 'default',
  style: { stroke: EDGE_COLOR, strokeWidth: 1 },
  markerEnd: {
    type: MarkerType.Arrow,
    width: 20,
    height: 20,
    color: EDGE_COLOR,
  },
};

interface CanvasProps {
  isPreviewMode?: boolean;
  /** Callback to trigger a full refresh (graph + sources + running tasks) from parent */
  onRefresh?: () => Promise<void>;
}

export default function Canvas({ isPreviewMode = false, onRefresh }: CanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNodeRenderData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const processedDataRef = useRef('');
  const initializationInFlightRef = useRef<Set<string>>(new Set());

  const {
    closeOperationPanel,
    tempLockCanvas,
    lockUpperSection,
    isWorkflowRunning,
    canvasLockStatus,
    canInteractWithCanvas,
  } = useTransformStore();
  const finalLockCanvas = tempLockCanvas || lockUpperSection;
  const ownsCanvasLock = canvasLockStatus?.locked_by_current_user === true;
  const canEdit = canInteractWithCanvas() && ownsCanvasLock && !isPreviewMode;

  const {
    nodes: apiNodes,
    edges: apiEdges,
    isLoading,
    refresh: refreshGraph,
  } = useCanvasGraph({ skipInitialFetch: false, autoSync: false });
  const { savePositions, retryFailed, isSaving, error: layoutError } = useCanvasLayout();
  const { setCenter, fitView, getNodes: getFlowNodes, getEdges: getFlowEdges } = useReactFlow();

  const hasUnpublishedChanges = useMemo(
    () => apiNodes.some((node) => node.isPublished === false),
    [apiNodes]
  );

  useEffect(() => {
    const dataHash = JSON.stringify({
      nodes: [...apiNodes].sort((a, b) => a.uuid.localeCompare(b.uuid)),
      edges: [...apiEdges].sort((a, b) => a.id.localeCompare(b.id)),
      canPersistLayout: canEdit,
    });

    if (dataHash === processedDataRef.current) return;
    processedDataRef.current = dataHash;

    if (apiNodes.length === 0 && apiEdges.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const currentNodes = getFlowNodes();
    const currentEdges = getFlowEdges();
    const resolved = resolveCanvasElements({ apiNodes, apiEdges, currentNodes, currentEdges });
    setNodes(resolved.nodes);
    setEdges(resolved.edges);

    if (!canEdit) return;

    const updates: CanvasNodePositionUpdate[] = resolved.initialPositionUpdates.filter(
      (update) => !initializationInFlightRef.current.has(update.uuid)
    );

    if (updates.length > 0) {
      updates.forEach((update) => initializationInFlightRef.current.add(update.uuid));
      void savePositions(updates)
        .catch((error) => toastError.api(error, 'Canvas layout could not be saved.'))
        .finally(() => {
          updates.forEach((update) => initializationInFlightRef.current.delete(update.uuid));
        });
    }
  }, [apiNodes, apiEdges, canEdit, getFlowNodes, getFlowEdges, savePositions, setEdges, setNodes]);

  const canvasAction = useCanvasAction();
  const clearCanvasAction = useTransformStore((state) => state.clearCanvasAction);

  useEffect(() => {
    if (canvasAction.type !== 'focus-node') return undefined;

    const actionData = (canvasAction.data || {}) as Record<string, unknown>;
    const nodeId = actionData.nodeId as string | undefined;
    if (!nodeId) {
      clearCanvasAction();
      return undefined;
    }

    const timer = setTimeout(() => {
      const targetNode = getFlowNodes().find((node) => node.id === nodeId);
      if (targetNode) {
        const { width, height } = getNodeDimensions(targetNode);
        setCenter(targetNode.position.x + width / 2, targetNode.position.y + height / 2, {
          zoom: FOCUS_ZOOM_LEVEL,
          duration: FOCUS_ANIMATION_DURATION_MS,
        });
      }
      clearCanvasAction();
    }, FOCUS_DELAY_MS);

    return () => clearTimeout(timer);
  }, [canvasAction.type, canvasAction.data, clearCanvasAction, getFlowNodes, setCenter]);

  const clearPreviewAction = useTransformStore((state) => state.clearPreviewAction);
  const setPreviewData = useTransformStore((state) => state.setPreviewData);

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: Node<CanvasNodeRenderData>) => {
      if (draggedNode.data?.isDummy) return;
      const finalPosition = getNodePositionAfterDrag(draggedNode, nodes);
      setNodes((current) =>
        current.map((node) =>
          node.id === draggedNode.id ? { ...node, position: finalPosition } : node
        )
      );
      void savePositions([{ uuid: draggedNode.id, position: finalPosition }]).catch((error) =>
        toastError.api(error, 'Canvas layout could not be saved.')
      );
    },
    [nodes, savePositions, setNodes]
  );

  const handleAutoArrange = useCallback(() => {
    const currentNodes = getFlowNodes();
    const { nodes: arrangedNodes, updates } = getAutoArrangedCanvas(currentNodes, getFlowEdges());
    if (updates.length === 0) return;

    const arrangedById = new Map(arrangedNodes.map((node) => [node.id, node.position]));

    setNodes((current) =>
      current.map((node) => {
        const position = arrangedById.get(node.id);
        return position ? { ...node, position } : node;
      })
    );

    void savePositions(updates)
      .then(() => {
        trackEvent(ANALYTICS_EVENTS.TRANSFORM_CANVAS_AUTO_ARRANGED, {
          node_count: updates.length,
        });
      })
      .catch((error) => toastError.api(error, 'Auto-arranged layout could not be saved.'));

    requestAnimationFrame(() =>
      fitView({
        padding: AUTO_ARRANGE_PADDING,
        duration: AUTO_ARRANGE_ANIMATION_DURATION_MS,
      })
    );
  }, [fitView, getFlowEdges, getFlowNodes, savePositions, setNodes]);

  const handleRetryLayout = useCallback(() => {
    void retryFailed().catch((error) => toastError.api(error, 'Canvas layout could not be saved.'));
  }, [retryFailed]);

  const handlePaneClick = useCallback(() => {
    closeOperationPanel();
    clearPreviewAction();
    setPreviewData(null);
  }, [closeOperationPanel, clearPreviewAction, setPreviewData]);

  const handleRefreshCanvas = useCallback(async () => {
    processedDataRef.current = '';
    if (onRefresh) await onRefresh();
    else await refreshGraph();
  }, [onRefresh, refreshGraph]);

  return (
    <div className="h-full w-full relative" style={{ backgroundColor: '#fff' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        nodeOrigin={NODE_ORIGIN}
        defaultEdgeOptions={defaultEdgeOptions}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        minZoom={0.1}
        maxZoom={4}
        onNodeDragStop={canEdit ? handleNodeDragStop : undefined}
        nodesDraggable={canEdit}
        nodesConnectable={false}
        elementsSelectable
        zoomOnDoubleClick={canEdit}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        proOptions={{ hideAttribution: true }}
      >
        {!isPreviewMode && (
          <Controls showInteractive={false} className="!bottom-4 !left-4">
            <ControlButton
              onClick={handleRefreshCanvas}
              title="Refresh canvas"
              data-testid="refresh-canvas-button"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </ControlButton>
            <ControlButton
              onClick={handleAutoArrange}
              disabled={!canEdit || isSaving || isWorkflowRunning || apiNodes.length === 0}
              title="Auto-arrange and save layout"
              data-testid="auto-arrange-canvas-button"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </ControlButton>
            {layoutError && (
              <ControlButton
                onClick={handleRetryLayout}
                disabled={!canEdit || isSaving}
                title="Retry saving canvas layout"
                data-testid="retry-canvas-layout-button"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </ControlButton>
            )}
          </Controls>
        )}
        <Background color="#e0e0e0" gap={20} />
      </ReactFlow>

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-40">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-lg font-medium text-gray-500">Loading canvas...</p>
          </div>
        </div>
      )}

      {finalLockCanvas && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-50">
          <div className="bg-white rounded-lg shadow-lg px-6 py-4 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-700 font-medium">
              {isWorkflowRunning ? 'Running workflow...' : 'Processing...'}
            </span>
          </div>
        </div>
      )}

      <CanvasMessages hasUnpublishedChanges={hasUnpublishedChanges} />

      {!isLoading && nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-gray-500">
            <p className="text-lg font-medium">No nodes on canvas</p>
            <p className="text-sm mt-1">Add sources or models from the project tree</p>
          </div>
        </div>
      )}
    </div>
  );
}
