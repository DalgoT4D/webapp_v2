# useCanvasOperations Hook Specification

## Overview

Hook providing mutation functions for canvas node operations (CRUD on nodes).

**v1 Source:** Canvas.tsx functions + Form submissions

**v2 Target:** `webapp_v2/src/hooks/api/useCanvasOperations.ts`

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `transform/v2/dbt_project/models/{dbtmodel_uuid}/nodes/` | POST | Add source/model to canvas |
| `transform/v2/dbt_project/operations/nodes/` | POST | Create operation node (input_node_uuid in payload) |
| `transform/v2/dbt_project/operations/nodes/{node_uuid}/` | PUT | Edit operation node |
| `transform/v2/dbt_project/nodes/{node_uuid}/` | DELETE | Delete operation node |
| `transform/v2/dbt_project/model/{node_uuid}/` | DELETE | Delete source/model node |
| `transform/v2/dbt_project/operations/nodes/{node_uuid}/terminate/` | POST | Terminate chain, create model |

---

## Payload Types

### CreateOperationNodePayload
```typescript
interface CreateOperationNodePayload {
  op_type: string;
  config: any;
  input_node_uuid: string;
  source_columns: string[];
  other_inputs: ModelSrcOtherInputPayload[];
}
```

### EditOperationNodePayload
```typescript
interface EditOperationNodePayload {
  op_type: string;
  config: any;
  source_columns: string[];
  other_inputs: ModelSrcOtherInputPayload[];
}
```

### TerminateChainPayload
```typescript
interface TerminateChainPayload {
  name: string;
  display_name: string;
  dest_schema: string;
  rel_dir_to_models?: string;
}
```

---

## Hook Interface

```typescript
interface UseCanvasOperationsReturn {
  /** Add source/model to canvas */
  addNodeToCanvas: (dbtmodelUuid: string) => Promise<CanvasNodeDataResponse>;

  /** Create operation node */
  createOperation: (
    inputNodeUuid: string,
    payload: CreateOperationNodePayload
  ) => Promise<CanvasNodeDataResponse>;

  /** Edit operation node */
  editOperation: (
    nodeUuid: string,
    payload: EditOperationNodePayload
  ) => Promise<CanvasNodeDataResponse>;

  /** Delete operation node */
  deleteOperationNode: (nodeUuid: string) => Promise<void>;

  /** Delete source/model node */
  deleteModelNode: (nodeUuid: string) => Promise<void>;

  /** Terminate chain and create model */
  terminateChain: (
    nodeUuid: string,
    payload: TerminateChainPayload
  ) => Promise<void>;

  /** Loading states */
  isCreating: boolean;
  isEditing: boolean;
  isDeleting: boolean;
  isTerminating: boolean;
}
```

---

## Implementation

```typescript
import { useCallback, useState } from 'react';
import { apiPost, apiPut, apiDelete } from '@/lib/api';
import { useCanvasGraph } from './useCanvasGraph';
import type {
  CanvasNodeDataResponse,
  CreateOperationNodePayload,
  EditOperationNodePayload,
  TerminateChainPayload,
} from '@/types/transform.types';

export function useCanvasOperations(): UseCanvasOperationsReturn {
  const { mutate: mutateGraph } = useCanvasGraph();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);

  const addNodeToCanvas = useCallback(async (dbtmodelUuid: string) => {
    setIsCreating(true);
    try {
      const response = await apiPost<CanvasNodeDataResponse>(
        `transform/v2/dbt_project/models/${dbtmodelUuid}/nodes/`,
        {}
      );
      await mutateGraph(); // Refresh graph
      return response;
    } finally {
      setIsCreating(false);
    }
  }, [mutateGraph]);

  const createOperation = useCallback(async (
    inputNodeUuid: string,
    payload: CreateOperationNodePayload
  ) => {
    setIsCreating(true);
    try {
      // POST to operations/nodes/ with input_node_uuid in payload
      const response = await apiPost<CanvasNodeDataResponse>(
        `transform/v2/dbt_project/operations/nodes/`,
        { ...payload, input_node_uuid: inputNodeUuid }
      );
      await mutateGraph();
      return response;
    } finally {
      setIsCreating(false);
    }
  }, [mutateGraph]);

  const editOperation = useCallback(async (
    nodeUuid: string,
    payload: EditOperationNodePayload
  ) => {
    setIsEditing(true);
    try {
      // PUT to operations/nodes/{nodeUuid}/
      const response = await apiPut<CanvasNodeDataResponse>(
        `transform/v2/dbt_project/operations/nodes/${nodeUuid}/`,
        payload
      );
      await mutateGraph();
      return response;
    } finally {
      setIsEditing(false);
    }
  }, [mutateGraph]);

  const deleteOperationNode = useCallback(async (nodeUuid: string) => {
    setIsDeleting(true);
    try {
      await apiDelete(`transform/v2/dbt_project/nodes/${nodeUuid}/`);
      await mutateGraph();
    } finally {
      setIsDeleting(false);
    }
  }, [mutateGraph]);

  const deleteModelNode = useCallback(async (nodeUuid: string) => {
    setIsDeleting(true);
    try {
      await apiDelete(`transform/v2/dbt_project/model/${nodeUuid}/`);
      await mutateGraph();
    } finally {
      setIsDeleting(false);
    }
  }, [mutateGraph]);

  const terminateChain = useCallback(async (
    nodeUuid: string,
    payload: TerminateChainPayload
  ) => {
    setIsTerminating(true);
    try {
      await apiPost(
        `transform/v2/dbt_project/operations/nodes/${nodeUuid}/terminate/`,
        payload
      );
      await mutateGraph();
    } finally {
      setIsTerminating(false);
    }
  }, [mutateGraph]);

  return {
    addNodeToCanvas,
    createOperation,
    editOperation,
    deleteOperationNode,
    deleteModelNode,
    terminateChain,
    isCreating,
    isEditing,
    isDeleting,
    isTerminating,
  };
}
```

---

## Usage in Operation Forms

```typescript
function RenameColumnOpForm({ node, action, onSuccess }: OperationFormProps) {
  const { createOperation, editOperation, isCreating, isEditing } = useCanvasOperations();

  const handleSave = async (formData: FormData) => {
    const payload = buildPayload(formData);

    try {
      if (action === 'create') {
        await createOperation(node.id, payload);
      } else {
        await editOperation(node.id, payload);
      }
      onSuccess();
    } catch (error) {
      toast.error('Failed to save operation');
    }
  };

  // ...
}
```

---

## Usage in Canvas for Node Addition

```typescript
function Canvas() {
  const { addNodeToCanvas, isCreating } = useCanvasOperations();

  const handleAddSourceModel = async (dbtSourceModel: DbtModelResponse) => {
    // Check if already on canvas
    const existingNode = nodes.find(
      (node) => node.data?.dbtmodel?.uuid === dbtSourceModel.uuid
    );

    if (existingNode) {
      // Focus existing node
      setCenter(existingNode.position.x, existingNode.position.y);
      return;
    }

    // Add new node
    const canvasNode = await addNodeToCanvas(dbtSourceModel.uuid);

    // Position new node
    const position = getNextNodePosition(nodes);
    addNodes([{
      id: canvasNode.uuid,
      type: canvasNode.node_type,
      data: { ...canvasNode, isDummy: false },
      position,
    }]);
  };

  // ...
}
```

---

## Edge Cases

1. **Network error**: Catch and show toast, don't update graph
2. **Concurrent edits**: Mutex or optimistic UI with rollback
3. **Delete with dependencies**: Backend handles cascade, frontend refreshes
4. **Duplicate add**: Check existing before API call

---

## Implementation Checklist

- [ ] Create hook file at `hooks/api/useCanvasOperations.ts`
- [ ] Add proper TypeScript types for all payloads
- [ ] Add toast notifications for success/error
- [ ] Add optimistic updates for better UX
- [ ] Handle loading states in UI
- [ ] Test all CRUD operations
- [ ] Test error recovery
