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
  // Track positions of nodes that have already been laid out
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const isInitialLayoutRef = useRef(true);
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

  // Process API data when it changes — preserve existing node positions on incremental updates
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
      nodePositionsRef.current.clear();
      isInitialLayoutRef.current = true;
      return;
    }

    const flowNodes = transformToFlowNodes(apiNodes);
    const flowEdges = transformToFlowEdges(apiEdges);

    // First load: run full dagre layout
    if (isInitialLayoutRef.current) {
      isInitialLayoutRef.current = false;
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        flowNodes,
        flowEdges
      );
      // Store all positions for future incremental updates
      layoutedNodes.forEach((n) => nodePositionsRef.current.set(n.id, n.position));
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      return;
    }

    // Incremental update: preserve existing positions, only layout new nodes
    const newNodeIds = flowNodes
      .filter((n) => !nodePositionsRef.current.has(n.id))
      .map((n) => n.id);

    if (newNodeIds.length > 0) {
      // Position new nodes relative to their input (source) node via edges,
      // instead of running dagre which calculates positions assuming all nodes
      // are at dagre-ideal positions (causing the "moves up" bug).
      const mergedNodes = flowNodes.map((n) => {
        const existingPos = nodePositionsRef.current.get(n.id);
        if (existingPos) {
          return { ...n, position: existingPos };
        }

        // New node — find its input node via edges and position to the right
        const incomingEdge = flowEdges.find((e) => e.target === n.id);
        if (incomingEdge) {
          const sourcePos = nodePositionsRef.current.get(incomingEdge.source);
          if (sourcePos) {
            const newPos = {
              x: sourcePos.x + DAGRE_RANKSEP,
              y: sourcePos.y,
            };
            nodePositionsRef.current.set(n.id, newPos);
            return { ...n, position: newPos };
          }
        }

        // Fallback: no edge found — run dagre for just this node's position
        const { nodes: layoutedNodes } = getLayoutedElements(flowNodes, flowEdges);
        const layoutedNode = layoutedNodes.find((ln) => ln.id === n.id);
        const fallbackPos = layoutedNode?.position ?? { x: 0, y: 0 };
        nodePositionsRef.current.set(n.id, fallbackPos);
        return { ...n, position: fallbackPos };
      });
      setNodes(mergedNodes);
    } else {
      // Nodes were removed or data updated — preserve all existing positions
      const updatedNodes = flowNodes.map((n) => {
        const existingPos = nodePositionsRef.current.get(n.id);
        return existingPos ? { ...n, position: existingPos } : n;
      });
      setNodes(updatedNodes);
    }

    // Clean up positions for removed nodes
    const currentNodeIds = new Set(flowNodes.map((n) => n.id));
    for (const id of nodePositionsRef.current.keys()) {
      if (!currentNodeIds.has(id)) {
        nodePositionsRef.current.delete(id);
      }
    }

    setEdges(flowEdges);
  }, [apiNodes, apiEdges, setNodes, setEdges]);

  // Focus on a specific node when focus-node action is dispatched
  const canvasAction = useCanvasAction();
  const { clearCanvasAction } = useTransformStore();
  const { setCenter, getNodes: getFlowNodes } = useReactFlow();

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

  // Overlap detection — push dragged node away if it overlaps another
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, draggedNode: Node) => {
      let finalPosition = draggedNode.position;

      for (const otherNode of nodes) {
        if (otherNode.id === draggedNode.id) continue;

        const xOverlap = Math.abs(draggedNode.position.x - otherNode.position.x) < NODE_WIDTH;
        const yOverlap = Math.abs(draggedNode.position.y - otherNode.position.y) < NODE_HEIGHT;

        if (xOverlap && yOverlap) {
          const OVERLAP_GAP = 20;
          const newX = otherNode.position.x + NODE_WIDTH + OVERLAP_GAP;
          finalPosition = { ...draggedNode.position, x: newX };
          setNodes((nds) =>
            nds.map((n) => (n.id === draggedNode.id ? { ...n, position: finalPosition } : n))
          );
          break;
        }
      }

      // Persist the final position so incremental updates don't reset it
      nodePositionsRef.current.set(draggedNode.id, finalPosition);
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
