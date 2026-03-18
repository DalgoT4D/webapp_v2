// components/transform/canvas/Canvas.tsx
'use client';

import { useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MarkerType,
  type NodeTypes,
  type Node,
  type Edge,
  type DefaultEdgeOptions,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

import DbtSourceModelNode from './nodes/DbtSourceModelNode';
import OperationNode from './nodes/OperationNode';
import { useCanvasGraph } from '@/hooks/api/useCanvasGraph';
import { useTransformStore } from '@/stores/transformStore';
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
  const { setSelectedNode, tempLockCanvas, lockUpperSection, isWorkflowRunning } =
    useTransformStore();
  const finalLockCanvas = tempLockCanvas || lockUpperSection;

  const {
    nodes: apiNodes,
    edges: apiEdges,
    isLoading,
  } = useCanvasGraph({ skipInitialFetch: isPreviewMode });

  // Process API data when it changes
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
      return;
    }

    const flowNodes = transformToFlowNodes(apiNodes);
    const flowEdges = transformToFlowEdges(apiEdges);
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      flowNodes,
      flowEdges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [apiNodes, apiEdges, setNodes, setEdges]);

  // canEdit: gates dragging, connecting, and edge changes (disabled when locked or preview)
  const canEdit = !finalLockCanvas && !isPreviewMode;

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  return (
    <div className="h-full w-full relative" style={{ backgroundColor: '#fff' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={canEdit ? onEdgesChange : undefined}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable={canEdit}
        nodesConnectable={canEdit}
        elementsSelectable={!isPreviewMode}
        zoomOnDoubleClick={canEdit}
        panOnDrag
        zoomOnScroll
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
