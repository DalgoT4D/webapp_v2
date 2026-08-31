import type { Edge, Node } from 'reactflow';
import type {
  CanvasEdgeDataResponse,
  CanvasNodeDataResponse,
  CanvasNodePositionUpdate,
  CanvasNodeRenderData,
} from '@/types/transform';
import { DAGRE_NODESEP, DAGRE_RANKSEP, getLayoutedElements } from './canvas-layout';
import { spreadNewNodesAfterLayout } from './node-positioning';

// Extra vertical separation when multiple new nodes share an anchor.
const NEW_NODE_ANCHOR_OFFSET = 100;

interface ResolveCanvasElementsInput {
  apiNodes: CanvasNodeDataResponse[];
  apiEdges: CanvasEdgeDataResponse[];
  currentNodes: Node<CanvasNodeRenderData>[];
  currentEdges: Edge[];
}

interface ResolvedCanvasElements {
  nodes: Node<CanvasNodeRenderData>[];
  edges: Edge[];
  initialPositionUpdates: CanvasNodePositionUpdate[];
}

export function transformToFlowNodes(
  apiNodes: CanvasNodeDataResponse[]
): Node<CanvasNodeRenderData>[] {
  return apiNodes.map((node) => ({
    id: node.uuid,
    type: node.node_type as string,
    data: { ...node, isDummy: false },
    position: node.position ?? { x: 0, y: 0 },
  }));
}

export function transformToFlowEdges(apiEdges: CanvasEdgeDataResponse[]): Edge[] {
  return apiEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }));
}

/**
 * Resolve server graph data into the visible React Flow graph. Persisted and
 * live positions win over Dagre; only genuinely new legacy nodes are placed.
 */
export function resolveCanvasElements({
  apiNodes,
  apiEdges,
  currentNodes,
  currentEdges,
}: ResolveCanvasElementsInput): ResolvedCanvasElements {
  const flowNodes = transformToFlowNodes(apiNodes);
  const flowEdges = transformToFlowEdges(apiEdges);
  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(flowNodes, flowEdges);

  const currentPosMap = new Map(
    currentNodes.filter((node) => !node.data?.isDummy).map((node) => [node.id, node.position])
  );
  const persistedPosMap = new Map(
    apiNodes.filter((node) => node.position !== null).map((node) => [node.uuid, node.position!])
  );
  const resolvedPosMap = new Map(persistedPosMap);
  currentPosMap.forEach((position, id) => resolvedPosMap.set(id, position));
  const existingNodeIds = new Set(resolvedPosMap.keys());

  const parentMap = new Map<string, string>();
  const childMap = new Map<string, string>();
  flowEdges.forEach((edge) => {
    parentMap.set(edge.target, edge.source);
    if (!childMap.has(edge.source)) childMap.set(edge.source, edge.target);
  });

  const assignedPositions = new Map<string, number>();
  const offsetPosition = (x: number, y: number) => {
    const key = `${Math.round(x)},${Math.round(y)}`;
    const count = assignedPositions.get(key) ?? 0;
    assignedPositions.set(key, count + 1);
    return { x, y: y + count * (DAGRE_NODESEP + NEW_NODE_ANCHOR_OFFSET) };
  };

  let layoutShift = { x: 0, y: 0 };
  for (const layoutedNode of layoutedNodes) {
    const resolved = resolvedPosMap.get(layoutedNode.id);
    if (resolved) {
      layoutShift = {
        x: resolved.x - layoutedNode.position.x,
        y: resolved.y - layoutedNode.position.y,
      };
      break;
    }
  }

  const finalNodes = layoutedNodes.map((node) => {
    const livePosition = currentPosMap.get(node.id);
    if (livePosition) return { ...node, position: livePosition };

    const persistedPosition = persistedPosMap.get(node.id);
    if (persistedPosition) return { ...node, position: persistedPosition };

    const parentPosition = resolvedPosMap.get(parentMap.get(node.id) ?? '');
    const childPosition = resolvedPosMap.get(childMap.get(node.id) ?? '');
    let position;

    if (parentPosition) {
      position = offsetPosition(parentPosition.x + DAGRE_RANKSEP, parentPosition.y);
    } else if (childPosition) {
      position = offsetPosition(childPosition.x - DAGRE_RANKSEP, childPosition.y);
    } else {
      position = {
        x: node.position.x + layoutShift.x,
        y: node.position.y + layoutShift.y,
      };
    }

    resolvedPosMap.set(node.id, position);
    return { ...node, position };
  });

  spreadNewNodesAfterLayout(finalNodes, existingNodeIds);

  const dummyNodes = currentNodes.filter((node) => node.data?.isDummy);
  const dummyEdges = currentEdges.filter(
    (edge) => edge.id.startsWith('edge-dummy-') || edge.animated
  );
  const unpositionedNodeIds = new Set(
    apiNodes.filter((node) => node.position === null).map((node) => node.uuid)
  );

  return {
    nodes: [...finalNodes, ...dummyNodes],
    edges: [...layoutedEdges, ...dummyEdges],
    initialPositionUpdates: finalNodes
      .filter((node) => unpositionedNodeIds.has(node.id))
      .map((node) => ({ uuid: node.id, position: node.position })),
  };
}

export function getAutoArrangedCanvas(
  currentNodes: Node<CanvasNodeRenderData>[],
  currentEdges: Edge[]
): { nodes: Node<CanvasNodeRenderData>[]; updates: CanvasNodePositionUpdate[] } {
  const realNodes = currentNodes.filter((node) => !node.data?.isDummy);
  const realNodeIds = new Set(realNodes.map((node) => node.id));
  const realEdges = currentEdges.filter(
    (edge) => realNodeIds.has(edge.source) && realNodeIds.has(edge.target)
  );
  const { nodes } = getLayoutedElements(realNodes, realEdges);

  return {
    nodes,
    updates: nodes.map((node) => ({ uuid: node.id, position: node.position })),
  };
}
