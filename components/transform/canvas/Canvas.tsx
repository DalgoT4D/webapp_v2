// components/transform/canvas/Canvas.tsx
'use client';

import { useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  Controls,
  Background,
  MarkerType,
  type NodeTypes,
  type Node,
  type Edge,
  type DefaultEdgeOptions,
  type Connection,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

import DbtSourceModelNode from './nodes/DbtSourceModelNode';
import OperationNode from './nodes/OperationNode';
import { useCanvasGraph } from '@/hooks/api/useCanvasGraph';
import { useTransformStore, useCanvasAction } from '@/stores/transformStore';
import {
  type CanvasNodeRenderData,
  type CanvasNodeDataResponse,
  type CanvasEdgeDataResponse,
} from '@/types/transform';
import { getNodePositionAfterDrag, spreadNewNodesAfterLayout } from './utils/node-positioning';

// Node types - must be defined outside component
const nodeTypes: NodeTypes = {
  source: DbtSourceModelNode,
  model: DbtSourceModelNode,
  operation: OperationNode,
};

// Layout constants matching webapp v1
const NODE_WIDTH = 250;
const NODE_HEIGHT = 120;
const DAGRE_NODESEP = 200;
const DAGRE_EDGESEP = 100;
const DAGRE_RANKSEP = 350;
const DAGRE_MARGIN_X = 100;
const DAGRE_MARGIN_Y = 100;

// Default edge styling — smoothstep (right-angle with rounded corners) + arrow marker
const defaultEdgeOptions: DefaultEdgeOptions = {
  type: 'default',
  style: { stroke: '#000', strokeWidth: 1 },
  markerEnd: {
    type: MarkerType.Arrow,
    width: 20,
    height: 20,
    color: '#000',
  },
};

// Create a dagre graph for layout calculation — matches webapp v1 exactly
function getLayoutedElements(
  nodes: Node<CanvasNodeRenderData>[],
  edges: Edge[]
): { nodes: Node<CanvasNodeRenderData>[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: 'LR',
    nodesep: DAGRE_NODESEP,
    edgesep: DAGRE_EDGESEP,
    ranksep: DAGRE_RANKSEP,
    marginx: DAGRE_MARGIN_X,
    marginy: DAGRE_MARGIN_Y,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {});
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const { x, y } = dagreGraph.node(node.id);
    return {
      ...node,
      position: { x, y },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// Transform API data to React Flow format
function transformToFlowNodes(apiNodes: CanvasNodeDataResponse[]): Node<CanvasNodeRenderData>[] {
  return apiNodes.map((node) => ({
    id: node.uuid,
    type: node.node_type as string,
    data: {
      ...node,
      isDummy: false,
    },
    position: { x: 0, y: 0 },
  }));
}

function transformToFlowEdges(apiEdges: CanvasEdgeDataResponse[]): Edge[] {
  return apiEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }));
}

interface CanvasProps {
  isPreviewMode?: boolean;
}

export default function Canvas({ isPreviewMode = false }: CanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNodeRenderData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const processedDataRef = useRef<string>('');
  const {
    setSelectedNode,
    tempLockCanvas,
    lockUpperSection,
    isWorkflowRunning,
    canInteractWithCanvas,
  } = useTransformStore();
  const finalLockCanvas = tempLockCanvas || lockUpperSection;

  const {
    nodes: apiNodes,
    edges: apiEdges,
    isLoading,
  } = useCanvasGraph({ skipInitialFetch: isPreviewMode, autoSync: !isPreviewMode });

  const { setCenter, getNodes: getFlowNodes } = useReactFlow();

  // Process API data when it changes.
  // On first load: full dagre layout (like v1's fetchDbtProjectGraph).
  // On incremental updates: run dagre on the full graph to get ideal positions for NEW nodes,
  // but preserve existing node positions so the canvas doesn't jump.
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    const dataHash = JSON.stringify({
      nodeIds: apiNodes.map((n) => n.uuid).sort(),
      edgeIds: apiEdges.map((e) => e.id).sort(),
    });

    if (dataHash === processedDataRef.current) return;
    processedDataRef.current = dataHash;

    if (apiNodes.length === 0 && apiEdges.length === 0) {
      setNodes([]);
      setEdges([]);
      isFirstLoadRef.current = true;
      return;
    }

    const flowNodes = transformToFlowNodes(apiNodes);
    const flowEdges = transformToFlowEdges(apiEdges);

    // Run dagre on the full graph to get ideal positions
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      flowNodes,
      flowEdges
    );

    if (isFirstLoadRef.current) {
      // First load: use all dagre positions (like v1)
      isFirstLoadRef.current = false;
      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);
      return;
    }

    // Incremental update: preserve existing positions, use dagre only for new nodes
    // Read current positions from React Flow's live state (always up-to-date)
    const currentNodes = getFlowNodes();
    const currentPosMap = new Map<string, { x: number; y: number }>(
      currentNodes
        .filter((n: Node<CanvasNodeRenderData>) => !n.data?.isDummy)
        .map((n: Node<CanvasNodeRenderData>) => [n.id, n.position])
    );

    // Calculate offset between dagre's coordinate space and actual canvas positions.
    // Dagre computes from scratch starting near (0,0), but existing nodes are elsewhere.
    // Sample one existing node to find the translation so new nodes (e.g. second table
    // in a union/join) land near the rest of the graph, not at the canvas origin.
    let shiftX = 0;
    let shiftY = 0;
    let hasShift = false;

    for (const layoutedNode of layoutedNodes) {
      const existingPos = currentPosMap.get(layoutedNode.id);
      if (existingPos) {
        shiftX = existingPos.x - layoutedNode.position.x;
        shiftY = existingPos.y - layoutedNode.position.y;
        hasShift = true;
        break;
      }
    }

    const finalNodes = layoutedNodes.map((n) => {
      const existingPos = currentPosMap.get(n.id);
      if (existingPos) {
        // Keep the existing position — don't let dagre move it
        return { ...n, position: existingPos };
      }
      // New node — shift dagre's position into the canvas coordinate space
      if (hasShift) {
        return { ...n, position: { x: n.position.x + shiftX, y: n.position.y + shiftY } };
      }
      return n;
    });

    // Push new nodes away from existing nodes if they overlap.
    // dagre uses zero-size nodes so its spacing can be tighter than the visual node size.
    spreadNewNodesAfterLayout(finalNodes, new Set(currentPosMap.keys()));

    setNodes([...finalNodes]);
    setEdges([...layoutedEdges]);
  }, [apiNodes, apiEdges, setNodes, setEdges, getFlowNodes]);

  // Focus on a specific node when focus-node action is dispatched
  const canvasAction = useCanvasAction();
  const { clearCanvasAction } = useTransformStore();

  useEffect(() => {
    if (canvasAction.type !== 'focus-node') return undefined;

    const actionData = (canvasAction.data || {}) as Record<string, unknown>;
    const nodeId = actionData.nodeId as string | undefined;
    if (!nodeId) {
      clearCanvasAction();
      return undefined;
    }

    // Small delay to allow React Flow to render new nodes after graph refresh
    const FOCUS_DELAY_MS = 300;
    const FOCUS_ZOOM_LEVEL = 1.2;
    const FOCUS_ANIMATION_DURATION_MS = 800;

    const timer = setTimeout(() => {
      const flowNodes = getFlowNodes();
      const targetNode = flowNodes.find((n) => n.id === nodeId);
      if (targetNode) {
        // Center on the node's midpoint
        const x = targetNode.position.x + NODE_WIDTH / 2;
        const y = targetNode.position.y + NODE_HEIGHT / 2;
        setCenter(x, y, { zoom: FOCUS_ZOOM_LEVEL, duration: FOCUS_ANIMATION_DURATION_MS });
      }
      clearCanvasAction();
    }, FOCUS_DELAY_MS);

    return () => clearTimeout(timer);
  }, [canvasAction.type, canvasAction.data, clearCanvasAction, setCenter, getFlowNodes]);

  // canEdit: gates dragging, connecting, and edge changes
  // Uses store's canInteractWithCanvas which checks lock, PAT, view-only, and isLockedByOther
  const canEdit = canInteractWithCanvas() && !isPreviewMode;

  const handleConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  const clearPreviewAction = useTransformStore((s) => s.clearPreviewAction);
  const setPreviewData = useTransformStore((s) => s.setPreviewData);

  // Overlap detection — matches webapp v1 Canvas.tsx onNodeDragStop
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      const finalPosition = getNodePositionAfterDrag(draggedNode, nodes);
      setNodes((nds) =>
        nds.map((n) => (n.id === draggedNode.id ? { ...n, position: finalPosition } : n))
      );
    },
    [nodes, setNodes]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    clearPreviewAction();
    setPreviewData(null);
  }, [setSelectedNode, clearPreviewAction, setPreviewData]);

  return (
    <div className="h-full w-full relative" style={{ backgroundColor: '#fff' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={canEdit ? onEdgesChange : undefined}
        onConnect={canEdit ? handleConnect : undefined}
        onPaneClick={canEdit ? handlePaneClick : undefined}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        minZoom={0.1}
        maxZoom={4}
        onNodeDragStop={canEdit ? handleNodeDragStop : undefined}
        nodesDraggable={canEdit}
        nodesConnectable={canEdit}
        elementsSelectable={!isPreviewMode}
        zoomOnDoubleClick={canEdit}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
      >
        <Controls showInteractive={false} className="!bottom-4 !left-4" />
        <Background color="#e0e0e0" gap={20} />
      </ReactFlow>

      {/* Loading overlay — blocks interaction while graph is fetching */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-40">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-lg font-medium text-gray-500">Loading canvas...</p>
          </div>
        </div>
      )}

      {/* Lock overlay — shown for tempLockCanvas (short ops) or lockUpperSection (workflow running) */}
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
