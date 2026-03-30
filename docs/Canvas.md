# Canvas Component Specification

## Overview

Main canvas component using React Flow for visualizing and editing DBT transformation workflows.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/Canvas.tsx` (~950 lines)

**v2 Target:** `webapp_v2/src/components/transform/Canvas.tsx`

**Complexity:** Very High - This is the core component orchestrating the entire canvas experience.

---

## Props Interface

```typescript
interface CanvasProps {
  /** Trigger to redraw graph */
  refreshTrigger?: number;
  /** Whether canvas is locked */
  isLocked?: boolean;
  /** Preview mode (read-only, no lock acquisition) */
  isPreviewMode?: boolean;
}
```

---

## Dependencies

### React Flow (v12 - @xyflow/react)
```typescript
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  useReactFlow,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Edge,
  type NodeTypes,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
```

### Dagre Layout
```typescript
import Dagre from '@dagrejs/dagre';
```

---

## State (from Zustand Store)

The Canvas uses the transform store for most state. Local state is minimal:

| Local State | Type | Purpose |
|-------------|------|---------|
| nodes | Node[] | React Flow controlled nodes |
| edges | Edge[] | React Flow controlled edges |

---

## Sub-Components

1. **CanvasHeader** - Toolbar with Run/Publish buttons
2. **CanvasMessages** - Status messages overlay
3. **OperationConfigLayout** - Right panel for operations

---

## Layout Algorithm (Dagre)

```typescript
const getLayoutedElements = ({
  nodes,
  edges,
  options,
}: {
  nodes: CanvasNodeRender[];
  edges: Edge[];
  options: { direction: 'LR' | 'TB' };
}) => {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

  g.setGraph({
    rankdir: options.direction,  // 'LR' = left-to-right
    nodesep: 200,                // Space between nodes in same rank
    edgesep: 100,                // Space between edges
    width: 250,                  // Node width for calculation
    height: 120,                 // Node height for calculation
    marginx: 100,                // Horizontal margin
    marginy: 100,                // Vertical margin
    ranksep: 350,                // Space between ranks
  });

  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  nodes.forEach((node) => g.setNode(node.id, {}));

  Dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const { x, y } = g.node(node.id);
      return { ...node, position: { x, y } };
    }),
    edges,
  };
};
```

---

## Node Types Registration

```typescript
const nodeTypes: NodeTypes = {
  source: DbtSourceModelNode,
  model: DbtSourceModelNode,
  operation: OperationNode,
};
```

---

## Edge Styling

```typescript
const EdgeStyle = {
  markerEnd: {
    type: MarkerType.Arrow,
    width: 20,
    height: 20,
  },
};

const defaultViewport = { x: 0, y: 0, zoom: 0.8 };
```

---

## Canvas Action Handlers

The Canvas listens for actions from the store and handles them:

```typescript
useEffect(() => {
  if (!canvasAction.type) return;

  switch (canvasAction.type) {
    case 'add-srcmodel-node':
      handleAddSourceModel(canvasAction.data);
      break;
    case 'delete-node':
      handleDeleteNode(canvasAction.data);
      break;
    case 'delete-source-tree-node':
      handleDeleteSourceTreeNode(canvasAction.data);
      break;
    case 'refresh-canvas':
      refreshGraph();
      break;
    case 'open-opconfig-panel':
      openOperationPanel();
      break;
    case 'close-reset-opconfig-panel':
      closeOperationPanel();
      break;
    case 'run-workflow':
      // Handled by FlowEditor
      break;
    case 'sync-sources':
      // Handled by FlowEditor
      break;
  }

  clearCanvasAction();
}, [canvasAction]);
```

---

## Implementation Structure

```typescript
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  useReactFlow,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Dagre from '@dagrejs/dagre';

import { useTransformStore } from '@/stores/transformStore';
import { useCanvasGraph } from '@/hooks/api/useCanvasGraph';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { useCanvasLock } from '@/hooks/api/useCanvasLock';

import DbtSourceModelNode from './nodes/DbtSourceModelNode';
import OperationNode from './nodes/OperationNode';
import CanvasHeader from './CanvasHeader';
import CanvasMessages from './CanvasMessages';
import OperationConfigLayout from './panels/OperationConfigLayout';

const nodeTypes = {
  source: DbtSourceModelNode,
  model: DbtSourceModelNode,
  operation: OperationNode,
};

export default function Canvas({ isPreviewMode = false }: CanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { setCenter, getZoom, addNodes } = useReactFlow();
  const hasInitializedRef = useRef(false);

  // Store state
  const canvasAction = useTransformStore((s) => s.canvasAction);
  const clearCanvasAction = useTransformStore((s) => s.clearCanvasAction);
  const operationPanelOpen = useTransformStore((s) => s.operationPanelOpen);
  const selectedNode = useTransformStore((s) => s.selectedNode);

  // API hooks
  const { nodes: rawNodes, edges: rawEdges, isLoading, syncAndRefresh } = useCanvasGraph({
    autoSync: !isPreviewMode,
  });
  const { addNodeToCanvas, deleteOperationNode, deleteModelNode } = useCanvasOperations();
  const { hasLock, isLockedByOther, lockStatus } = useCanvasLock({
    autoAcquire: !isPreviewMode,
  });

  // Transform raw data to React Flow format with layout
  useEffect(() => {
    if (!rawNodes.length) return;

    const flowNodes = rawNodes.map((node) => ({
      id: node.uuid,
      type: node.node_type,
      data: { ...node, isDummy: false },
      position: { x: 0, y: 0 },
    }));

    const flowEdges = rawEdges.map((edge) => ({
      ...edge,
      ...EdgeStyle,
    }));

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements({
      nodes: flowNodes,
      edges: flowEdges,
      options: { direction: 'LR' },
    });

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [rawNodes, rawEdges]);

  // Handle canvas actions
  useEffect(() => {
    if (!canvasAction.type) return;

    const handleAction = async () => {
      switch (canvasAction.type) {
        case 'add-srcmodel-node':
          await handleAddSourceModel(canvasAction.data);
          break;
        case 'delete-node':
          await handleDeleteNode(canvasAction.data);
          break;
        case 'refresh-canvas':
          await syncAndRefresh();
          break;
        // ... other actions
      }
      clearCanvasAction();
    };

    handleAction();
  }, [canvasAction]);

  // ... rest of implementation

  return (
    <div className="h-full w-full relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 h-12 z-10 bg-white border-b">
        <CanvasHeader
          canInteract={hasLock && !isPreviewMode}
          isLocked={isLockedByOther}
        />
      </div>

      {/* Messages overlay */}
      <CanvasMessages />

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        defaultViewport={defaultViewport}
        fitView
        className="pt-12"
      >
        <Controls />
        <Background />
      </ReactFlow>

      {/* Operation Panel */}
      {operationPanelOpen && (
        <OperationConfigLayout />
      )}
    </div>
  );
}
```

---

## Key Functions

### handleAddSourceModel
```typescript
const handleAddSourceModel = async (dbtSourceModel: DbtModelResponse) => {
  // Check if already on canvas
  const existingNode = nodes.find(
    (n) => n.data?.dbtmodel?.uuid === dbtSourceModel.uuid
  );

  if (existingNode) {
    // Focus existing node
    setCenter(existingNode.position.x, existingNode.position.y, {
      zoom: getZoom(),
      duration: 500,
    });
    return;
  }

  // Add via API
  const canvasNode = await addNodeToCanvas(dbtSourceModel.uuid);

  // Add to React Flow
  const position = getNextNodePosition(nodes);
  addNodes([{
    id: canvasNode.uuid,
    type: canvasNode.node_type,
    data: { ...canvasNode, isDummy: false },
    position,
  }]);
};
```

### handleDeleteNode
```typescript
const handleDeleteNode = async ({
  nodeId,
  nodeType,
  shouldRefreshGraph,
  isDummy,
}: DeleteNodeData) => {
  if (!isDummy) {
    if (nodeType === 'operation') {
      await deleteOperationNode(nodeId);
    } else {
      await deleteModelNode(nodeId);
    }
  }

  // Remove from React Flow
  onNodesChange([{ type: 'remove', id: nodeId }]);

  if (shouldRefreshGraph) {
    await syncAndRefresh();
  }
};
```

---

## Canvas Messages

Messages displayed as overlays:

1. **Lock status** - "Locked. In use by {email}"
2. **Unpublished changes** - When any node has `isPublished === false`
3. **PAT required** - "Update key to make changes. Add key here"

---

## Edge Cases

1. **Empty canvas**: Show empty state or instructions
2. **Preview mode**: No lock acquisition, read-only
3. **Lock lost**: Switch to view-only mode
4. **Network error**: Show error toast, allow retry
5. **Concurrent edits**: Refresh after operations

---

## Lock Management Lifecycle (Critical)

The canvas uses a lock mechanism to prevent concurrent edits. This is critical for data integrity.

### Lock Lifecycle

```typescript
// Lock timer ref - must be cleaned up properly
const lockRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

// Lock refresh interval
const LOCK_REFRESH_INTERVAL = 30000; // 30 seconds

// 1. Acquire lock on mount (if not preview mode)
useEffect(() => {
  if (isPreviewMode) return;

  const acquireLock = async () => {
    try {
      const status = await apiPost('transform/v2/dbt_project/lock/');
      setCanvasLockStatus(status);

      // Start refresh timer
      lockRefreshTimerRef.current = setInterval(refreshLock, LOCK_REFRESH_INTERVAL);
    } catch (error) {
      // Lock acquisition failed - switch to view-only
      setViewOnlyMode(true);
    }
  };

  acquireLock();

  // Cleanup on unmount
  return () => {
    releaseLock();
  };
}, []);

// 2. Refresh lock every 30 seconds
const refreshLock = async () => {
  try {
    await apiPut('transform/v2/dbt_project/lock/refresh/');
  } catch (error) {
    console.error('Failed to refresh lock');
  }
};

// 3. Release lock
const releaseLock = async () => {
  if (lockRefreshTimerRef.current) {
    clearInterval(lockRefreshTimerRef.current);
    lockRefreshTimerRef.current = null;
  }
  try {
    await apiDelete('transform/v2/dbt_project/lock/');
  } catch (error) {
    console.error('Failed to release lock');
  }
};
```

### Emergency Cleanup Handlers

```typescript
// Handle browser close/navigation
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    // Attempt to release lock
    navigator.sendBeacon(
      `${API_BASE_URL}/transform/v2/dbt_project/lock/release/`,
      JSON.stringify({})
    );
  };

  const handlePopState = () => {
    releaseLock();
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('popstate', handlePopState);

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('popstate', handlePopState);
  };
}, []);
```

---

## PAT (Personal Access Token) Flow

When GitHub PAT is not configured:

```typescript
// Check PAT status on mount
useEffect(() => {
  const checkPatStatus = async () => {
    try {
      const workspace = await apiGet('dbt/dbt_workspace');
      setGitRepoUrl(workspace.gitrepo_url || '');

      if (!workspace.gitrepo_access_token_secret) {
        setPatRequired(true);
        openPatModal();
      }
    } catch (error) {
      console.error('Failed to check PAT status');
    }
  };

  checkPatStatus();
}, []);

// PAT modal handlers
const handlePatSuccess = () => {
  setPatRequired(false);
  closePatModal();
  // Now acquire lock
  acquireLock();
};

const handleViewOnly = () => {
  setPatRequired(true);
  setViewOnlyMode(true);
  closePatModal();
  // Do not acquire lock - view only
};
```

---

## Run Options Menu

The toolbar "Run" button has multiple options:

```typescript
const runOptions = [
  { label: 'Run workflow', value: 'run', action: () => handleRun('full') },
  { label: 'Run to node', value: 'run-to', action: () => handleRun('to-node'), disabled: !selectedNode },
  { label: 'Run from node', value: 'run-from', action: () => handleRun('from-node'), disabled: !selectedNode },
];

const handleRun = (mode: 'full' | 'to-node' | 'from-node') => {
  const runParams: RunWorkflowParams = {};

  if (mode === 'to-node' && selectedNode) {
    runParams.dbt_node = selectedNode.data.dbtmodel?.name;
    runParams.run_type = 'run';
  } else if (mode === 'from-node' && selectedNode) {
    runParams.dbt_node = selectedNode.data.dbtmodel?.name;
    runParams.run_type = 'from';
  }

  dispatchCanvasAction({ type: 'run-workflow', data: runParams });
};
```

---

## Node Collision Detection

Prevent nodes from overlapping when dragged:

```typescript
const onNodeDragStop = useCallback(
  (event: React.MouseEvent, node: Node) => {
    // Check for collision with other nodes
    const collidingNode = nodes.find((n) => {
      if (n.id === node.id) return false;

      const nodeWidth = 250;
      const nodeHeight = 120;

      return (
        Math.abs(n.position.x - node.position.x) < nodeWidth &&
        Math.abs(n.position.y - node.position.y) < nodeHeight
      );
    });

    if (collidingNode) {
      // Snap to avoid collision
      const newPosition = {
        x: collidingNode.position.x + 300,
        y: node.position.y,
      };

      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id ? { ...n, position: newPosition } : n
        )
      );
    }
  },
  [nodes]
);
```

---

## Unpublished Changes Detection

Track and display unpublished changes:

```typescript
const hasUnpublishedChanges = useMemo(() => {
  return nodes.some((node) => node.data?.isPublished === false);
}, [nodes]);

// Display in CanvasMessages component
{hasUnpublishedChanges && (
  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 text-sm">
    You have unpublished changes
  </div>
)}
```

---

## Initial Sync Flow

On mount, the canvas must sync remote DBT project before fetching graph:

```typescript
// Step 1: Sync remote to canvas
const syncRemoteToCanvas = async () => {
  await apiPost('transform/v2/dbt_project/sync_remote_dbtproject_to_canvas/');
};

// Step 2: Fetch graph data
const fetchGraph = async () => {
  const response = await apiGet('transform/v2/dbt_project/graph/');
  return response;
};

// Combined init flow
useEffect(() => {
  if (hasInitializedRef.current) return;
  hasInitializedRef.current = true;

  const initCanvas = async () => {
    setIsLoading(true);
    try {
      await syncRemoteToCanvas();
      const { nodes, edges } = await fetchGraph();
      // ... layout and set state
    } catch (error) {
      toast.error('Failed to initialize canvas');
    } finally {
      setIsLoading(false);
    }
  };

  initCanvas();
}, []);
```

---

## Implementation Checklist

- [ ] Create Canvas component with React Flow 12
- [ ] Implement Dagre layout algorithm
- [ ] Register custom node types
- [ ] Set up edge styling
- [ ] Handle canvas actions from store
- [ ] Integrate lock management with 30-second refresh
- [ ] Add emergency cleanup handlers (beforeunload, popstate)
- [ ] Implement PAT flow (check, modal, view-only)
- [ ] Add run options menu (run/run-to/run-from)
- [ ] Implement node collision detection
- [ ] Track unpublished changes
- [ ] Implement initial sync flow (sync_remote + fetch_graph)
- [ ] Add node/edge change handlers
- [ ] Create CanvasHeader sub-component
- [ ] Integrate CanvasMessages
- [ ] Integrate OperationConfigLayout panel
- [ ] Add loading/error states
- [ ] Test preview mode
- [ ] Test lock acquisition/release
