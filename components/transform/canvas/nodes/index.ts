// components/transform/canvas/nodes/index.ts

import DbtSourceModelNode from './DbtSourceModelNode';
import OperationNode from './OperationNode';

// Re-export components
export { DbtSourceModelNode, OperationNode };

// Node type mapping for React Flow
export const nodeTypes = {
  source: DbtSourceModelNode,
  model: DbtSourceModelNode,
  operation: OperationNode,
} as const;
