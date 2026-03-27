// components/transform/canvas/utils/node-positioning.ts
// Functions for calculating node positions on the canvas

import type { Node } from 'reactflow';
import type { CanvasNodeRenderData } from '@/types/transform';

// Default node dimensions used for position calculations
const NODE_WIDTH = 250;
// Source/model nodes with column tables are taller than operation nodes.
// Use a reasonable estimate that prevents overlap without excessive gaps.
const NODE_HEIGHT = 200;

// Minimum gap between nodes (pixels)
const NODE_GAP = 30;

/**
 * Returns a corrected position for a node after it has been dragged,
 * ensuring it doesn't sit on top of any other node on the canvas.
 */
export function getNodePositionAfterDrag(
  draggedNode: Node,
  allNodes: Node<CanvasNodeRenderData>[]
): { x: number; y: number } {
  let x = draggedNode.position.x;
  let y = draggedNode.position.y;
  const draggedWidth = draggedNode.width || NODE_WIDTH;
  const draggedHeight = draggedNode.height || NODE_HEIGHT;

  for (const otherNode of allNodes) {
    if (otherNode.id === draggedNode.id) continue;

    const otherWidth = otherNode.width || NODE_WIDTH;
    const otherHeight = otherNode.height || NODE_HEIGHT;

    const xOverlap = Math.max(
      0,
      Math.min(x + draggedWidth, otherNode.position.x + otherWidth) -
        Math.max(x, otherNode.position.x)
    );
    const yOverlap = Math.max(
      0,
      Math.min(y + draggedHeight, otherNode.position.y + otherHeight) -
        Math.max(y, otherNode.position.y)
    );

    if (xOverlap > 0 && yOverlap > 0) {
      if (x < otherNode.position.x) {
        x -= xOverlap + NODE_GAP;
      } else {
        x += xOverlap + NODE_GAP;
      }

      if (y < otherNode.position.y) {
        y -= yOverlap + NODE_GAP;
      } else {
        y += yOverlap + NODE_GAP;
      }
    }
  }

  return { x, y };
}

/**
 * After dagre calculates layout, newly added nodes may land on top of
 * existing ones (dagre uses zero-size nodes). This spreads them apart
 * by pushing new nodes below any node they collide with.
 */
export function spreadNewNodesAfterLayout(
  nodes: Node<CanvasNodeRenderData>[],
  existingNodeIds: Set<string>
): void {
  for (const node of nodes) {
    if (existingNodeIds.has(node.id)) continue; // skip existing nodes
    for (const other of nodes) {
      if (other.id === node.id) continue;
      const dx = Math.abs(node.position.x - other.position.x);
      const dy = Math.abs(node.position.y - other.position.y);
      if (dx < NODE_WIDTH && dy < NODE_HEIGHT) {
        node.position = {
          x: node.position.x,
          y: other.position.y + NODE_HEIGHT + NODE_GAP,
        };
      }
    }
  }
}
