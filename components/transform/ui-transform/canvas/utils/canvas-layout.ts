import dagre from 'dagre';
import type { Edge, Node } from 'reactflow';
import { CanvasNodeTypeEnum, type CanvasNodeRenderData } from '@/types/transform';

export const DAGRE_NODESEP = 200;
export const DAGRE_EDGESEP = 100;
export const DAGRE_RANKSEP = 350;
export const DAGRE_MARGIN_X = 100;
export const DAGRE_MARGIN_Y = 100;

const SOURCE_MODEL_DIMENSIONS = { width: 250, height: 68 };
const OPERATION_DIMENSIONS = { width: 96, height: 96 };

export function getNodeDimensions(node: Node): { width: number; height: number } {
  const fallback =
    node.type === CanvasNodeTypeEnum.Operation ||
    node.data?.node_type === CanvasNodeTypeEnum.Operation
      ? OPERATION_DIMENSIONS
      : SOURCE_MODEL_DIMENSIONS;

  return {
    width: node.width || fallback.width,
    height: node.height || fallback.height,
  };
}

export function dagreCenterToTopLeft(
  center: { x: number; y: number },
  dimensions: { width: number; height: number }
): { x: number; y: number } {
  return {
    x: center.x - dimensions.width / 2,
    y: center.y - dimensions.height / 2,
  };
}

/**
 * Dagre stores node centers while React Flow (nodeOrigin [0, 0]) stores
 * top-left positions. Register dimensions and convert the result explicitly.
 */
export function getLayoutedElements(
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
  });

  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
  nodes.forEach((node) => dagreGraph.setNode(node.id, getNodeDimensions(node)));

  dagre.layout(dagreGraph);

  return {
    nodes: nodes.map((node) => {
      const dagreNode = dagreGraph.node(node.id);
      return {
        ...node,
        position: dagreCenterToTopLeft(dagreNode, getNodeDimensions(node)),
      };
    }),
    edges,
  };
}
