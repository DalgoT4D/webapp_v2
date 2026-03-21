# Dummy Nodes Utility Specification

## Overview

Utility functions for generating temporary (dummy) nodes on the canvas before they are persisted to the backend. These nodes provide immediate visual feedback during the create flow.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/dummynodes.ts` (~72 lines)

**v2 Target:** `webapp_v2/src/utils/transform/dummynodes.ts`

**Complexity:** Low

---

## Purpose

When a user initiates a create operation (adding a new source/model or operation to the canvas), we need to:
1. Show a visual representation immediately (before API call completes)
2. Provide a unique ID for the temporary node
3. Mark the node as "dummy" so we know it's not persisted yet
4. Position the node appropriately on the canvas

---

## Functions

### generateDummySrcModelNode

Creates a temporary source/model node for the canvas.

```typescript
import { v4 as uuidv4 } from 'uuid';
import type { Node } from '@xyflow/react';
import type { SrcModelNodeData } from '@/types/transform.types';

interface GenerateDummySrcModelNodeParams {
  schema: string;
  name: string;
  type: 'source' | 'model';
  position?: { x: number; y: number };
}

export function generateDummySrcModelNode({
  schema,
  name,
  type,
  position = { x: 0, y: 0 },
}: GenerateDummySrcModelNodeParams): Node<SrcModelNodeData> {
  const id = `dummy-${uuidv4()}`;

  return {
    id,
    type: type, // 'source' or 'model'
    position,
    data: {
      id,
      uuid: id,
      name,
      schema,
      type,
      isDummy: true, // <-- Key flag
      output_columns: [],
      is_last_in_chain: false,
      dbtmodel: null,
    },
  };
}
```

### generateDummyOperationNode

Creates a temporary operation node for the canvas.

```typescript
import { v4 as uuidv4 } from 'uuid';
import type { Node } from '@xyflow/react';
import type { OperationNodeData } from '@/types/transform.types';

interface GenerateDummyOperationNodeParams {
  operationType: string;
  inputNodeId: string;
  position?: { x: number; y: number };
}

export function generateDummyOperationNode({
  operationType,
  inputNodeId,
  position = { x: 0, y: 0 },
}: GenerateDummyOperationNodeParams): Node<OperationNodeData> {
  const id = `dummy-${uuidv4()}`;

  return {
    id,
    type: 'operation',
    position,
    data: {
      id,
      uuid: id,
      isDummy: true, // <-- Key flag
      input_node_uuid: inputNodeId,
      operation_config: {
        type: operationType,
        config: {},
      },
      output_columns: [],
      is_last_in_chain: true, // New operations are at end of chain
      dbtmodel: null,
    },
  };
}
```

---

## Usage

### In OperationConfigLayout (Creating Operations)

```typescript
import { generateDummyOperationNode } from '@/utils/transform/dummynodes';

// When user selects an operation to create
const handleOperationSelect = (operationType: string) => {
  const selectedNode = useTransformStore.getState().selectedNode;

  if (!selectedNode) return;

  // Generate dummy node
  const dummyNode = generateDummyOperationNode({
    operationType,
    inputNodeId: selectedNode.id,
    position: {
      x: selectedNode.position.x + 350, // Offset to the right
      y: selectedNode.position.y,
    },
  });

  // Add to canvas
  setNodes((nodes) => [...nodes, dummyNode]);

  // Track the dummy node ID for cleanup if form is cancelled
  dummyNodeIdRef.current = dummyNode.id;

  // Show the form
  setSelectedOp({ slug: operationType, label: operationType });
  panelOpFormState.current = 'create';
};
```

### In Canvas (Adding Source/Model from Tree)

```typescript
import { generateDummySrcModelNode } from '@/utils/transform/dummynodes';

// When user clicks a table in ProjectTree
const handleAddSrcModelNode = (model: DbtModelResponse) => {
  const dummyNode = generateDummySrcModelNode({
    schema: model.schema,
    name: model.name,
    type: model.type,
    position: calculateNewNodePosition(),
  });

  // Add to canvas
  setNodes((nodes) => [...nodes, dummyNode]);

  // Persist to backend
  createModelNode(model.uuid).then((response) => {
    // Replace dummy node with real node
    setNodes((nodes) =>
      nodes.map((n) =>
        n.id === dummyNode.id
          ? { ...n, id: response.uuid, data: { ...n.data, id: response.uuid, isDummy: false } }
          : n
      )
    );
  });
};
```

---

## Cleanup on Cancel

When a user cancels an operation creation, dummy nodes must be removed:

```typescript
const handleDiscardChanges = () => {
  // Get all dummy node IDs
  const dummyNodeIds = getNodes()
    .filter((node) => node.data.isDummy)
    .map((node) => node.id);

  // Remove from canvas
  deleteElements({
    nodes: dummyNodeIds.map((id) => ({ id })),
  });

  // Reset state
  setSelectedOp(null);
  panelOpFormState.current = 'view';
};
```

---

## isDummy Flag

The `isDummy` flag is critical for:

1. **Visual Styling**: Dummy nodes may have different border styles
2. **Interaction Prevention**: Some actions disabled on dummy nodes
3. **Form State**: Determines create vs edit mode
4. **Cleanup**: Identifies nodes to remove on cancel

```typescript
// In form submission
const onSubmit = async (data: FormData) => {
  const finalAction = node?.data.isDummy ? 'create' : action;

  if (finalAction === 'create') {
    await createOperation(node!.id, payload);
  } else {
    await editOperation(node!.id, payload);
  }
};
```

---

## Position Calculation

For auto-positioning new nodes:

```typescript
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
```

---

## Implementation Checklist

- [ ] Create `utils/transform/dummynodes.ts`
- [ ] Implement `generateDummySrcModelNode` function
- [ ] Implement `generateDummyOperationNode` function
- [ ] Implement `calculateNewNodePosition` helper
- [ ] Add types for dummy node data
- [ ] Test dummy node creation and cleanup
- [ ] Verify isDummy flag handling in forms
