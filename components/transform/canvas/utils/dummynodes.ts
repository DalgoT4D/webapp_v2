// components/transform/canvas/utils/dummynodes.ts

import type { Node } from 'reactflow';
import type { CanvasNodeRenderData, CanvasNodeTypeEnum } from '@/types/transform';

interface GenerateDummySrcModelNodeParams {
  schema: string;
  name: string;
  type: 'source' | 'model';
  position?: { x: number; y: number };
}

/**
 * Creates a temporary source/model node for the canvas.
 * Used when user selects a secondary table in Join/Union forms
 * to show immediate visual feedback before API persistence.
 */
export function generateDummySrcModelNode({
  schema,
  name,
  type,
  position = { x: 0, y: 0 },
}: GenerateDummySrcModelNodeParams): Node<CanvasNodeRenderData> {
  const id = `dummy-${crypto.randomUUID()}`;

  return {
    id,
    type,
    position,
    data: {
      uuid: id,
      name,
      output_columns: [],
      node_type: type as CanvasNodeTypeEnum,
      dbtmodel: null,
      operation_config: { type: '', config: {} },
      is_last_in_chain: false,
      isPublished: null,
      isDummy: true,
    },
  };
}

interface GenerateDummyOperationNodeParams {
  operationType: string;
  inputNodeId: string;
  position?: { x: number; y: number };
}

/**
 * Creates a temporary operation node for the canvas.
 * Used during operation creation to show the node before
 * it's saved to the backend.
 */
export function generateDummyOperationNode({
  operationType,
  inputNodeId,
  position = { x: 0, y: 0 },
}: GenerateDummyOperationNodeParams): Node<CanvasNodeRenderData> {
  const id = `dummy-${crypto.randomUUID()}`;

  return {
    id,
    type: 'operation',
    position,
    data: {
      uuid: id,
      name: operationType,
      output_columns: [],
      node_type: 'operation' as CanvasNodeTypeEnum,
      dbtmodel: null,
      operation_config: {
        type: operationType,
        config: {},
      },
      input_nodes: [{ uuid: inputNodeId } as CanvasNodeRenderData],
      is_last_in_chain: true,
      isPublished: null,
      isDummy: true,
    },
  };
}

/**
 * Calculates position for a new node based on the rightmost
 * existing node on the canvas.
 */
export function calculateNewNodePosition(
  existingNodes: Node[],
  offset = { x: 350, y: 0 }
): { x: number; y: number } {
  if (existingNodes.length === 0) {
    return { x: 100, y: 100 };
  }

  // Find rightmost node
  const rightmostNode = existingNodes.reduce((rightmost, node) =>
    node.position.x > rightmost.position.x ? node : rightmost
  );

  return {
    x: rightmostNode.position.x + offset.x,
    y: rightmostNode.position.y + offset.y,
  };
}
