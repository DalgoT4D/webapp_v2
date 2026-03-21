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
    selected: true,
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

// Positioning constants matching webapp v1 (src/utils/editor.tsx)
const NODE_GAP = 30;
const DEFAULT_NODE_HEIGHT = 100;

/**
 * Calculates position for a new node based on the rightmost
 * existing node on the canvas — matches webapp v1's getNextNodePosition.
 * Stacks vertically below the rightmost node (same X, Y + height + gap).
 */
export function calculateNewNodePosition(
  existingNodes: Node[],
  height?: number
): { x: number; y: number } {
  if (existingNodes.length === 0) {
    return { x: 50, y: 50 };
  }

  let rightMostX = 0;
  let rightMostY = 0;
  let rightMostHeight = DEFAULT_NODE_HEIGHT;

  for (const node of existingNodes) {
    const nodeX = node?.position?.x || 0;
    const nodeY = node?.position?.y || 0;
    const nodeHeight = height ?? (node?.height || DEFAULT_NODE_HEIGHT);

    if (isNaN(nodeX) || isNaN(nodeY)) continue;

    if (nodeX > rightMostX) {
      rightMostX = nodeX;
      rightMostY = nodeY;
      rightMostHeight = nodeHeight;
    }
  }

  const x = isNaN(rightMostX) ? 50 : rightMostX;
  const y =
    isNaN(rightMostY) || isNaN(rightMostHeight)
      ? 50
      : rightMostY + rightMostHeight + NODE_GAP;

  return { x, y };
}
