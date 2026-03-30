# Transform Canvas Gap Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Achieve full feature parity between v2 transform canvas and v1 webapp, fixing all identified gaps across project tree, canvas interactions, operation config, and bottom panels.

**Architecture:** Each phase groups related fixes by area. Phases are ordered by dependency — foundational fixes (locking, permissions, store) come first, then canvas interactions, then panel/form fixes, then polish. Each task is self-contained and committable.

**Tech Stack:** Next.js 15, React 19, ReactFlow, Zustand, SWR, Tailwind CSS, Radix UI

---

## Master Issue List

Every gap found across both analysis passes, deduplicated and numbered for tracking.

| # | Area | Issue | Severity |
|---|------|-------|----------|
| 1 | Lock | `isLockedByOther` does not disable ReactFlow dragging/connecting | High |
| 2 | Lock | SPA navigation (Next.js router) does not release canvas lock | High |
| 3 | Lock | `canInteractWithCanvas` ignores `patRequired + isViewOnlyMode` combo | High |
| 4 | Lock | `onPaneClick` fires even when canvas is locked, clearing selection | Medium |
| 5 | Permissions | Node click always opens `'edit'` mode — no `can_edit`/`can_view` distinction | High |
| 6 | Permissions | Delete button on nodes ignores permissions | High |
| 7 | Permissions | `DbtSourceModelNode` click opens op panel without checking `can_create_dbt_model` | Medium |
| 8 | Canvas | `syncRemoteToCanvas` POST call missing on canvas mount | High |
| 9 | Canvas | `hasUnpublishedChanges` hardcoded to `false` — banner never appears | High |
| 10 | Canvas | `onConnect` handler missing — users can't draw edges | High |
| 11 | Canvas | Pane click doesn't clear preview action | Medium |
| 12 | Canvas | Column cache (`fetchedRef`) never invalidated on canvas refresh | Medium |
| 13 | Canvas | Node drag overlap detection missing | Low |
| 14 | Canvas | `zoomOnPinch` prop missing | Low |
| 15 | Canvas | `maxZoom=2` hardcoded (not in v1) — remove or increase | Low |
| 16 | Dummy Nodes | Dummy src model node has `dbtmodel: null`, `output_columns: []` | Medium |
| 17 | Dummy Nodes | Dummy operation node not created with `selected: true` | Low |
| 18 | Git/PAT | PAT check missing `transform_type === 'github'` guard | High |
| 19 | Git/PAT | `PublishModal` blocks publish when no git changes (`!hasChanges`) — v1 allows it | Medium |
| 20 | Store | `selectedLowerTab` from store disconnected from `LowerSectionTabs` local state | High |
| 21 | Store | `canInteractWithCanvas()` in store doesn't factor `patRequired` | Medium |
| 22 | Tree | Delete source node — no trash icon on leaf nodes | High |
| 23 | Tree | `delete-source-tree-node` action not handled in FlowEditor switch | High |
| 24 | Tree | Auto-sync sources on first canvas open missing | High |
| 25 | Tree | Search state lives in global `useExploreStore` (shared with explore page) | Medium |
| 26 | Tree | Syncing overlay missing descriptive text | Low |
| 27 | Tree | Search input missing `<label>` for accessibility | Low |
| 28 | Op Config | Join/Union forms don't add dummy nodes to canvas | High |
| 29 | Op Config | Generic SQL (`rawsql`) not treated as chain-terminal | Medium |
| 30 | Op Config | `is_last_in_chain` not respected after save | Medium |
| 31 | Op Config | Back button from `create-table-or-add-function` goes to op-list not op-form | Medium |
| 32 | Op Config | Dummy-to-real node promotion fragile (depends on SWR revalidation timing) | Medium |
| 33 | Op Config | InfoTooltip on form title missing | Low |
| 34 | Op Config | `CreateTableForm` doesn't pre-fill `rel_dir_to_models` from existing node | Low |
| 35 | Bottom | StatisticsPane not wired into LowerSectionTabs | High |
| 36 | Bottom | Sync-sources loading not reflected in logs pane | Medium |
| 37 | Bottom | Sync sources progress not polled into logs | High |
| 38 | Bottom | `checkForSyncSourcesTask` on mount missing | Medium |
| 39 | Bottom | No feature flag guard on Statistics tab | Medium |
| 40 | Tracking | Amplitude event tracking absent from canvas | Low |

---

## Phase 1: Locking, Permissions & Store Foundations

These fixes are foundational — many other features depend on correct lock/permission behavior.

### Task 1.1: Fix `isLockedByOther` not blocking ReactFlow interactions

**Issues:** #1, #3, #4, #21

**Files:**
- Modify: `components/transform/canvas/Canvas.tsx:164-192`
- Modify: `stores/transformStore.ts:233-237`

**Step 1: Update `canInteractWithCanvas()` in store**

In `stores/transformStore.ts`, update the computed function to also consider `isLockedByOther` and `patRequired`:

```typescript
canInteractWithCanvas: () => {
  const state = get();
  const finalLock = state.tempLockCanvas || state.lockUpperSection;
  const isLockedByOther = state.canvasLockStatus?.is_locked === true &&
    !state.canvasLockStatus?.locked_by_current_user;
  const patBlocking = state.patRequired && state.isViewOnlyMode;
  return !finalLock && !state.isViewOnlyMode && !isLockedByOther && !patBlocking;
},
```

**Step 2: Update Canvas.tsx to use store's `canInteractWithCanvas`**

Replace the local `canEdit` computation with the store's computed method. Gate `onPaneClick` conditionally:

```typescript
const canInteract = useTransformStore((s) => s.canInteractWithCanvas);

// In the JSX:
onNodesChange={onNodesChange}
onEdgesChange={canInteract() ? onEdgesChange : undefined}
onPaneClick={canInteract() ? handlePaneClick : undefined}
nodesDraggable={canInteract()}
nodesConnectable={canInteract()}
elementsSelectable={!isPreviewMode}
zoomOnDoubleClick={canInteract()}
```

Note: `elementsSelectable` stays `!isPreviewMode` so nodes are always clickable (to open config panel). `onNodesChange` stays always-on for selection events. `onPaneClick` is now gated so locked users don't accidentally clear selection.

**Step 3: Run build to verify**

Run: `npm run build`

**Step 4: Commit**

```
fix: gate canvas interactions on lock status, PAT, and permissions
```

---

### Task 1.2: Fix SPA navigation not releasing canvas lock

**Issue:** #2

**Files:**
- Modify: `hooks/api/useCanvasLock.ts:172-199`

**Step 1: Add Next.js router navigation listener**

Import `usePathname` from `next/navigation` and release lock when the path changes:

```typescript
import { usePathname } from 'next/navigation';

// Inside useCanvasLock:
const pathname = usePathname();
const prevPathnameRef = useRef(pathname);

useEffect(() => {
  if (prevPathnameRef.current !== pathname && hasLockRef.current) {
    // User navigated away via SPA routing — release lock
    stopRefreshTimer();
    apiDelete(LOCK_ENDPOINT).catch(() => {});
  }
  prevPathnameRef.current = pathname;
}, [pathname, stopRefreshTimer]);
```

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```
fix: release canvas lock on SPA navigation
```

---

### Task 1.3: Add permission checks to node click and delete

**Issues:** #5, #6, #7

**Files:**
- Modify: `components/transform/canvas/nodes/OperationNode.tsx:70-74`
- Modify: `components/transform/canvas/nodes/DbtSourceModelNode.tsx:62-78`

**Step 1: Update OperationNode click to check permissions**

```typescript
import { useUserPermissions } from '@/hooks/api/usePermissions';

// Inside OperationNode:
const { hasPermission } = useUserPermissions();

const handleNodeClick = useCallback(() => {
  const nodeProps = { id, type, data, selected };
  setSelectedNode(nodeProps);

  if (hasPermission('can_edit_dbt_operation')) {
    dispatchCanvasAction({ type: 'open-opconfig-panel', data: { mode: 'edit' } });
  } else if (hasPermission('can_view_dbt_operation')) {
    dispatchCanvasAction({ type: 'open-opconfig-panel', data: { mode: 'view' } });
  }
  // If neither permission, just select the node (for preview) but don't open panel
}, [id, type, data, selected, setSelectedNode, dispatchCanvasAction, hasPermission]);
```

Gate delete button:
```typescript
const canDelete = isLeafNode && hasPermission('can_delete_dbt_operation');
```

**Step 2: Update DbtSourceModelNode click to check permissions**

```typescript
const handleNodeClick = useCallback(() => {
  // Always set preview data
  if (schema && displayName) {
    useTransformStore.getState().setPreviewData({ schema, table: displayName });
  }

  setSelectedNode({ id, type, data, selected });

  // Only open operation panel if user has create permission
  if (hasPermission('can_create_dbt_model')) {
    dispatchCanvasAction({ type: 'open-opconfig-panel', data: { mode: 'edit' } });
  }
}, [id, type, data, selected, schema, displayName, setSelectedNode, dispatchCanvasAction, hasPermission]);
```

Gate delete button:
```typescript
const canDelete = isLeafNode && hasPermission('can_delete_dbt_model');
```

**Step 3: Run build**

Run: `npm run build`

**Step 4: Commit**

```
fix: add permission checks to node click and delete actions
```

---

### Task 1.4: Connect `selectedLowerTab` store to `LowerSectionTabs`

**Issue:** #20

**Files:**
- Modify: `components/transform/canvas/layout/LowerSectionTabs.tsx:23-54`

**Step 1: Replace local state with store state**

```typescript
import { useTransformStore } from '@/stores/transformStore';

// Replace useState with store:
const selectedTab = useTransformStore((s) => s.selectedLowerTab);
const setSelectedTab = useTransformStore((s) => s.setSelectedLowerTab);

// Remove the old useState line:
// const [selectedTab, setSelectedTab] = useState<LowerTab>('logs');
```

Note: The `LowerTab` type in this component uses `'data statistics'` while the store uses `'statistics'`. Align the types — update the store's `LowerSectionTab` type to include `'data statistics'` or normalize the tab key.

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```
fix: connect LowerSectionTabs to store's selectedLowerTab
```

---

## Phase 2: Canvas Core Interactions

### Task 2.1: Add `syncRemoteToCanvas` call on canvas mount

**Issue:** #8

**Files:**
- Modify: `hooks/api/useCanvasGraph.ts` (add pre-flight sync)
- Reference: v1 `Canvas.tsx:456-525`

**Step 1: Add sync call before graph fetch**

In `useCanvasGraph`, add a `syncRemoteToCanvas` call that runs once before the initial graph fetch:

```typescript
const SYNC_REMOTE_ENDPOINT = '/api/transform/v2/dbt_project/sync_remote_dbtproject_to_canvas/';

// In the hook, before the SWR fetch:
const hasSyncedRef = useRef(false);

useEffect(() => {
  if (hasSyncedRef.current || skipInitialFetch) return;
  hasSyncedRef.current = true;

  const syncRemote = async () => {
    try {
      await apiPost(SYNC_REMOTE_ENDPOINT, {});
      await mutate(); // Refetch graph after sync
    } catch (error) {
      console.error('Failed to sync remote to canvas:', error);
      // Non-blocking — continue with potentially stale data
    }
  };
  syncRemote();
}, [skipInitialFetch, mutate]);
```

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```
feat: add syncRemoteToCanvas call on canvas mount
```

---

### Task 2.2: Compute `hasUnpublishedChanges` dynamically

**Issue:** #9

**Files:**
- Modify: `components/transform/canvas/Canvas.tsx` (expose node data)
- Modify: `components/transform/canvas/layout/FlowEditor.tsx:417`

**Step 1: Compute unpublished status from graph data**

In `FlowEditor.tsx`, use the graph data from `useCanvasGraph` to compute `hasUnpublishedChanges`:

```typescript
const { nodes: apiNodes } = useCanvasGraph({ skipInitialFetch: isPreview });

const hasUnpublishedChanges = useMemo(() => {
  return apiNodes.some((node) => node.isPublished === false);
}, [apiNodes]);
```

Then pass it:
```tsx
<CanvasMessages hasUnpublishedChanges={hasUnpublishedChanges} />
```

Note: Check the `CanvasNodeDataResponse` type to verify `isPublished` exists. If it comes as a different field name from the API, adjust accordingly.

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```
feat: compute hasUnpublishedChanges from live canvas data
```

---

### Task 2.3: Add `onConnect` handler

**Issue:** #10

**Files:**
- Modify: `components/transform/canvas/Canvas.tsx`

**Step 1: Add connection handler**

```typescript
import { addEdge, type Connection } from 'reactflow';

const handleConnect = useCallback(
  (connection: Connection) => {
    setEdges((eds) => addEdge(connection, eds));
  },
  [setEdges]
);

// In JSX:
<ReactFlow
  onConnect={canInteract() ? handleConnect : undefined}
  // ...existing props
>
```

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```
feat: add onConnect handler for manual edge drawing
```

---

### Task 2.4: Clear preview on pane click

**Issue:** #11

**Files:**
- Modify: `components/transform/canvas/Canvas.tsx:166-168`

**Step 1: Update handlePaneClick**

```typescript
const clearPreviewAction = useTransformStore((s) => s.clearPreviewAction);
const setPreviewData = useTransformStore((s) => s.setPreviewData);

const handlePaneClick = useCallback(() => {
  setSelectedNode(null);
  clearPreviewAction();
  setPreviewData(null);
}, [setSelectedNode, clearPreviewAction, setPreviewData]);
```

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```
fix: clear preview data on canvas pane click
```

---

### Task 2.5: Invalidate column cache on canvas refresh

**Issue:** #12

**Files:**
- Modify: `components/transform/canvas/nodes/DbtSourceModelNode.tsx`

**Step 1: Listen to `refreshTrigger` from store and reset `fetchedRef`**

```typescript
const refreshTrigger = useTransformStore((s) => s.refreshTrigger);

// Reset fetch flag when canvas refreshes so columns are re-fetched
useEffect(() => {
  if (refreshTrigger > 0) {
    fetchedRef.current = false;
  }
}, [refreshTrigger]);
```

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```
fix: invalidate column cache on canvas refresh
```

---

### Task 2.6: Minor canvas props fixes

**Issues:** #14, #15

**Files:**
- Modify: `components/transform/canvas/Canvas.tsx`

**Step 1: Add `zoomOnPinch` and remove `maxZoom` cap**

```typescript
<ReactFlow
  zoomOnPinch
  maxZoom={4}  // or remove entirely to use ReactFlow default
  // ...rest
>
```

**Step 2: Commit**

```
fix: add zoomOnPinch and increase maxZoom limit
```

---

## Phase 3: Project Tree

### Task 3.1: Add delete source button to tree leaf nodes

**Issues:** #22, #23

**Files:**
- Modify: `components/explore/ProjectTree.tsx`
- Modify: `components/transform/canvas/layout/FlowEditor.tsx` (add `delete-source-tree-node` handler)

**Step 1: Add trash icon to leaf nodes in canvas mode**

In `ProjectTree.tsx`, add a delete button next to the `+` add button on leaf nodes when `mode === 'canvas'`:

```tsx
{mode === 'canvas' && (
  <>
    <button
      onClick={(e) => {
        e.stopPropagation();
        onDeleteFromCanvas?.(node.data.id);
      }}
      className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500"
      data-testid={`delete-source-${node.data.id}`}
      aria-label="Remove from canvas"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
    <button ... >  {/* existing + button */}
    </button>
  </>
)}
```

Add `onDeleteFromCanvas` to the props interface.

**Step 2: Handle `delete-source-tree-node` in FlowEditor**

Add to the switch block in FlowEditor's `handleAction`:

```typescript
case 'delete-source-tree-node': {
  const actionData = (canvasAction.data || {}) as Record<string, unknown>;
  const nodeId = actionData.nodeId as string | undefined;
  if (!nodeId) {
    clearCanvasAction();
    return;
  }

  setTempLockCanvas(true);
  try {
    await apiDelete(`/api/transform/v2/dbt_project/model/${nodeId}/`);
    toast.success('Source removed from canvas');
    await mutate(CANVAS_GRAPH_KEY);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to remove source';
    toast.error(message);
  } finally {
    setTempLockCanvas(false);
  }
  clearCanvasAction();
  break;
}
```

**Step 3: Wire the callback from FlowEditor to ProjectTree**

Add `onDeleteFromCanvas` handler in FlowEditor that dispatches the canvas action.

**Step 4: Run build**

Run: `npm run build`

**Step 5: Commit**

```
feat: add delete source button to project tree and handle action
```

---

### Task 3.2: Auto-sync sources on first canvas open

**Issue:** #24

**Files:**
- Modify: `components/transform/canvas/layout/FlowEditor.tsx`

**Step 1: Add auto-sync effect**

```typescript
const hasAutoSynced = useRef(false);
const { hasPermission } = useUserPermissions();

useEffect(() => {
  if (hasAutoSynced.current || isPreview) return;
  if (!hasPermission('can_sync_sources')) return;
  hasAutoSynced.current = true;

  handleSyncSources();
}, [isPreview, hasPermission, handleSyncSources]);
```

Note: Ensure `handleSyncSources` is defined before this effect runs (it's a `useCallback` so it's stable).

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```
feat: auto-sync sources on first canvas open
```

---

### Task 3.3: Fix search state scope — use local state in canvas mode

**Issue:** #25

**Files:**
- Modify: `components/explore/ProjectTree.tsx`

**Step 1: Use local state instead of global store when in canvas mode**

```typescript
const [localSearchTerm, setLocalSearchTerm] = useState('');
const globalSearchTerm = useExploreStore((s) => s.searchTerm);
const setGlobalSearchTerm = useExploreStore((s) => s.setSearchTerm);

// Choose based on mode
const searchTerm = mode === 'canvas' ? localSearchTerm : globalSearchTerm;
const setSearchTerm = mode === 'canvas' ? setLocalSearchTerm : setGlobalSearchTerm;
```

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```
fix: use local search state in project tree canvas mode
```

---

### Task 3.4: Minor tree polish

**Issues:** #26, #27

**Files:**
- Modify: `components/explore/ProjectTree.tsx`

**Step 1: Add descriptive text to syncing overlay**

```tsx
{loading && (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
    <Loader2 className="w-5 h-5 animate-spin text-primary" />
    <p className="text-sm text-muted-foreground mt-2">Fetching latest schemas and tables...</p>
  </div>
)}
```

**Step 2: Add label to search input**

```tsx
<label htmlFor="project-tree-search" className="sr-only">Search schemas and tables</label>
<Input
  id="project-tree-search"
  placeholder="Search schemas and tables..."
  // ...
/>
```

**Step 3: Commit**

```
fix: add syncing overlay text and search accessibility label
```

---

## Phase 4: Operation Config Panel

### Task 4.1: Add dummy node integration to Join and Union forms

**Issue:** #28

**Files:**
- Modify: `components/transform/canvas/forms/JoinOpForm.tsx`
- Modify: `components/transform/canvas/forms/UnionTablesOpForm.tsx`
- Reference: `components/transform/canvas/utils/dummynodes.ts`

**Step 1: Update JoinOpForm to add/remove dummy nodes on table2 selection**

```typescript
import { useReactFlow } from 'reactflow';
import { generateDummySrcModelNode, generateDummyEdge } from '../utils/dummynodes';

// Inside JoinOpForm:
const { addNodes, addEdges, deleteElements } = useReactFlow();
const dummyNodeIdsRef = useRef<string[]>([]);

// When table2 is selected:
const handleTable2Select = useCallback((table: DbtModelResponse) => {
  // Clean up previous dummy
  if (dummyNodeIdsRef.current.length > 0) {
    deleteElements({
      nodes: dummyNodeIdsRef.current.map(id => ({ id })),
      edges: [],
    });
    dummyNodeIdsRef.current = [];
  }

  // Add new dummy source node
  const dummyNode = generateDummySrcModelNode({
    schema: table.schema,
    name: table.display_name || table.name,
    type: table.type,
  });

  if (dummyNodeId) {
    const dummyEdge = generateDummyEdge(dummyNode.id, dummyNodeId);
    addNodes([dummyNode]);
    addEdges([dummyEdge]);
    dummyNodeIdsRef.current.push(dummyNode.id);
  }

  setValue('second_table', table);
}, [addNodes, addEdges, deleteElements, dummyNodeId, setValue]);

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (dummyNodeIdsRef.current.length > 0) {
      deleteElements({
        nodes: dummyNodeIdsRef.current.map(id => ({ id })),
        edges: [],
      });
    }
  };
}, [deleteElements]);
```

**Step 2: Apply similar pattern to UnionTablesOpForm**

Each row's table selection adds a dummy node; removing a row cleans up its dummy.

**Step 3: Run build**

Run: `npm run build`

**Step 4: Commit**

```
feat: add dummy node canvas integration to Join and Union forms
```

---

### Task 4.2: Fix Generic SQL chain-terminal and `is_last_in_chain` behavior

**Issues:** #29, #30

**Files:**
- Modify: `components/transform/canvas/panels/OperationConfigLayout.tsx`

**Step 1: Track `showAddFunction` based on operation type**

In `handleContinueOperationChain`, check the operation type:

```typescript
const handleContinueOperationChain = useCallback(async (createdNodeUuid: string) => {
  // ... existing cleanup and node lookup logic ...

  // Determine if we should show "Add Function" option
  const savedOpType = selectedOp?.slug;
  const isChainTerminal = savedOpType === 'rawsql';

  // Check is_last_in_chain from the found node
  const foundNode = nodes.find(n => n.id === createdNodeUuid);
  const isLastInChain = foundNode?.data?.is_last_in_chain;

  if (isLastInChain) {
    // Stay in edit mode for this node, don't go to create-table-or-add-function
    setPanelState('op-form');
  } else {
    setPanelState('create-table-or-add-function');
    setShowAddFunction(!isChainTerminal);
  }
}, [/* deps */]);
```

Add `showAddFunction` state:
```typescript
const [showAddFunction, setShowAddFunction] = useState(true);
```

Pass it to `CreateTableOrAddFunction`:
```tsx
<CreateTableOrAddFunction showAddFunction={showAddFunction} ... />
```

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```
fix: handle chain-terminal ops and is_last_in_chain after save
```

---

### Task 4.3: Fix back button from `create-table-or-add-function`

**Issue:** #31

**Files:**
- Modify: `components/transform/canvas/panels/OperationConfigLayout.tsx:232-241`

**Step 1: Navigate back to op-form instead of op-list**

```typescript
case 'create-table-or-add-function': {
  // Go back to the edit form for the current operation, not the op list
  if (selectedNode?.data?.operation_config?.type) {
    const opSlug = selectedNode.data.operation_config.type;
    const op = operations.find(o => o.slug === opSlug);
    if (op) {
      setSelectedOp(op);
      setPanelState('op-form');
      return;
    }
  }
  // Fallback to op-list if no operation is found
  setPanelState('op-list');
  setSelectedOp(null);
  break;
}
```

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```
fix: back button from create-table returns to op-form
```

---

### Task 4.4: Improve dummy-to-real node promotion

**Issue:** #32

**Files:**
- Modify: `components/transform/canvas/panels/OperationConfigLayout.tsx`

**Step 1: Await graph refetch before looking up the new node**

In `handleContinueOperationChain`, ensure the graph is refetched before attempting to find the real node:

```typescript
const handleContinueOperationChain = useCallback(async (createdNodeUuid: string) => {
  cleanupDummyNodes();

  // Ensure graph is refetched so the real node exists
  await mutate(CANVAS_GRAPH_KEY);

  // Small delay to allow React Flow to process the new nodes
  await new Promise(resolve => setTimeout(resolve, 100));

  // Now look up the node in the updated graph
  const { getNodes } = reactFlowInstance;
  const nodes = getNodes();
  const realNode = nodes.find(n => n.id === createdNodeUuid);

  if (realNode) {
    setSelectedNode({ id: realNode.id, type: realNode.type, data: realNode.data, selected: true });
  }
  // ... rest of logic
}, [/* deps */]);
```

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```
fix: await graph refetch before finding promoted real node
```

---

### Task 4.5: Minor op config fixes

**Issues:** #33, #34, #16, #17

**Files:**
- Modify: `components/transform/canvas/panels/OperationConfigLayout.tsx` (InfoTooltip)
- Modify: `components/transform/canvas/forms/CreateTableForm.tsx` (pre-fill `rel_dir_to_models`)
- Modify: `components/transform/canvas/utils/dummynodes.ts` (dbtmodel data, selected flag)

**Step 1: Add tooltip to panel header**

Add an info tooltip next to the operation name in the panel header using Radix `Tooltip`:

```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// In panel header when panelState === 'op-form':
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
    </TooltipTrigger>
    <TooltipContent>
      <p className="text-xs max-w-[200px]">{selectedOp?.infoToolTip}</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

**Step 2: Pre-fill `rel_dir_to_models` in CreateTableForm**

```typescript
// In edit mode initialization:
if (node?.data?.dbtmodel?.rel_dir_to_models) {
  setValue('rel_dir_to_models', node.data.dbtmodel.rel_dir_to_models);
}
```

**Step 3: Fix dummy node generation**

In `dummynodes.ts`:
- Pass full `DbtModelResponse` to `generateDummySrcModelNode` when available (for Join/Union)
- Set `selected: true` on dummy operation nodes

**Step 4: Run build**

Run: `npm run build`

**Step 5: Commit**

```
fix: add op tooltip, pre-fill rel_dir_to_models, fix dummy nodes
```

---

## Phase 5: Bottom Panels

### Task 5.1: Wire StatisticsPane into LowerSectionTabs

**Issue:** #35

**Files:**
- Modify: `components/transform/canvas/layout/LowerSectionTabs.tsx:127-135`

**Step 1: Import and render StatisticsPane**

```typescript
import { StatisticsPane } from '@/components/explore/StatisticsPane';

// Replace placeholder with real component:
{selectedTab === 'data statistics' &&
  (previewTable ? (
    <StatisticsPane
      schema={previewTable.schema}
      table={previewTable.table}
    />
  ) : (
    <div
      className="flex items-center justify-center text-muted-foreground"
      style={{ height: contentHeight }}
    >
      Select a node to view data statistics
    </div>
  ))}
```

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```
feat: wire StatisticsPane into LowerSectionTabs
```

---

### Task 5.2: Add sync-sources task polling to logs pane

**Issues:** #36, #37, #38

**Files:**
- Modify: `components/transform/canvas/layout/FlowEditor.tsx` (handleSyncSources)
- Modify: `hooks/api/useCanvasSources.ts` (return taskId)

**Step 1: Poll sync-sources task and write progress to logs**

Update `handleSyncSources` to poll the task progress just like workflow execution:

```typescript
const handleSyncSources = useCallback(async () => {
  setIsSyncing(true);
  setLockUpperSection(true);
  setSelectedLowerTab('logs');
  setDbtRunLogs([]); // Clear previous logs

  try {
    const { taskId, hashKey } = await syncSources();

    // Poll for task progress
    const pollSyncProgress = async () => {
      const POLL_INTERVAL = 2000;
      while (true) {
        const response = await apiGet(`/api/tasks/${taskId}?hashkey=${hashKey}`);
        if (response?.progress) {
          const now = new Date().toISOString();
          const logs = response.progress.map((log) => ({
            ...log,
            timestamp: log.timestamp || now,
          }));
          setDbtRunLogs(logs);

          const lastLog = response.progress[response.progress.length - 1];
          if (lastLog?.status === 'completed' || lastLog?.status === 'failed') {
            break;
          }
        }
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      }
    };

    await pollSyncProgress();
    await refreshSources();
    await mutate(CANVAS_GRAPH_KEY);
    toast.success('Sources synced successfully');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to sync sources';
    toast.error(message);
  } finally {
    setIsSyncing(false);
    setLockUpperSection(false);
  }
}, [syncSources, refreshSources, setSelectedLowerTab, setLockUpperSection, setDbtRunLogs, mutate]);
```

**Step 2: Add mount-time check for running sync-sources task**

In the existing `checkForRunningProcesses` effect, also check for sync-sources tasks:

```typescript
const checkForRunningProcesses = async () => {
  try {
    // Check for dbt workflow tasks
    const runningTaskId = await checkRunningTasks();
    if (runningTaskId) {
      setSelectedLowerTab('logs');
      await resumePolling(runningTaskId);
      return;
    }

    // Check for sync-sources task
    const syncHashKey = `syncsources-${orgSlug}`;
    try {
      const syncTask = await apiGet(`/api/tasks/last/?hashkey=${syncHashKey}`);
      if (syncTask?.task_id && syncTask?.status === 'running') {
        setSelectedLowerTab('logs');
        // Resume polling for sync task
        setLockUpperSection(true);
        setIsSyncing(true);
        // ... poll sync progress
      }
    } catch { /* no sync task running */ }
  } catch { /* API failed */ }
};
```

**Step 3: Run build**

Run: `npm run build`

**Step 4: Commit**

```
feat: poll sync-sources progress into logs pane
```

---

### Task 5.3: Add feature flag guard to Statistics tab

**Issue:** #39

**Files:**
- Modify: `components/transform/canvas/layout/LowerSectionTabs.tsx`

**Step 1: Conditionally render statistics tab**

Check if a feature flag utility exists in the codebase. If `useFeatureFlags` or similar exists:

```typescript
const isStatisticsEnabled = useFeatureFlag('DATA_STATISTICS');

const TABS = useMemo(() => {
  const tabs = [
    { key: 'preview', label: 'PREVIEW' },
    { key: 'logs', label: 'LOGS' },
  ];
  if (isStatisticsEnabled) {
    tabs.push({ key: 'data statistics', label: 'DATA STATISTICS' });
  }
  return tabs;
}, [isStatisticsEnabled]);
```

If no feature flag system exists in v2, skip this and document it as a future item.

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```
feat: gate statistics tab behind feature flag
```

---

## Phase 6: Git/PAT & Publish

### Task 6.1: Fix PAT check to guard on `transform_type === 'github'`

**Issue:** #18

**Files:**
- Modify: `hooks/api/useGitIntegration.ts:53-69`

**Step 1: Add transform_type check**

Update the `DbtWorkspaceResponse` interface and the `onSuccess` callback:

```typescript
interface DbtWorkspaceResponse {
  gitrepo_url: string;
  default_schema: string;
  target_type?: string;
  transform_type?: string;  // Add this field
  gitrepo_access_token_secret?: string | null;
}

// In onSuccess:
onSuccess: (data) => {
  if (data?.gitrepo_url) {
    setGitRepoUrl(data.gitrepo_url);
  }
  // Only check PAT for GitHub transform type
  if (data?.transform_type === 'github') {
    if ('gitrepo_access_token_secret' in (data || {})) {
      const hasToken = !!data?.gitrepo_access_token_secret;
      setPatRequiredLocal(!hasToken);
      setPatRequired(!hasToken);
    }
  } else {
    // Non-GitHub transform types don't need PAT
    setPatRequiredLocal(false);
    setPatRequired(false);
  }
},
```

Apply same logic to `checkPatStatus`.

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```
fix: only require PAT for GitHub transform type
```

---

### Task 6.2: Fix PublishModal blocking on no git changes

**Issue:** #19

**Files:**
- Modify: `components/transform/canvas/modals/PublishModal.tsx:225`

**Step 1: Remove `!hasChanges` from disabled condition**

```typescript
// Before:
disabled={!commitMessage.trim() || publishing || !hasChanges}

// After (match v1 behavior):
disabled={!commitMessage.trim() || publishing}
```

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```
fix: allow publish even when no git-tracked changes detected
```

---

## Phase 7: Polish & Low-Priority

### Task 7.1: Add node drag overlap detection

**Issue:** #13

**Files:**
- Modify: `components/transform/canvas/Canvas.tsx`

**Step 1: Add `onNodeDragStop` handler**

Implement overlap detection following v1's approach:

```typescript
const handleNodeDragStop = useCallback(
  (_event: React.MouseEvent, draggedNode: Node) => {
    const updatedNodes = nodes.map((node) => {
      if (node.id === draggedNode.id) return draggedNode;
      return node;
    });

    // Check for overlaps with other nodes
    for (const otherNode of updatedNodes) {
      if (otherNode.id === draggedNode.id) continue;

      const xOverlap = Math.abs(draggedNode.position.x - otherNode.position.x) < NODE_WIDTH;
      const yOverlap = Math.abs(draggedNode.position.y - otherNode.position.y) < NODE_HEIGHT;

      if (xOverlap && yOverlap) {
        // Push dragged node to avoid overlap
        const newX = otherNode.position.x + NODE_WIDTH + 20;
        setNodes((nds) =>
          nds.map((n) =>
            n.id === draggedNode.id ? { ...n, position: { ...n.position, x: newX } } : n
          )
        );
        break;
      }
    }
  },
  [nodes, setNodes]
);
```

Pass to ReactFlow:
```tsx
onNodeDragStop={canInteract() ? handleNodeDragStop : undefined}
```

**Step 2: Run build**

Run: `npm run build`

**Step 3: Commit**

```
feat: add node drag overlap detection
```

---

### Task 7.2: Add Amplitude event tracking

**Issue:** #40

**Files:**
- Modify: `components/transform/canvas/CanvasHeader.tsx` (run, publish clicks)
- Modify: `components/transform/canvas/layout/LowerSectionTabs.tsx` (tab switches)

**Step 1: Check if an amplitude/analytics utility exists in v2**

Search for existing analytics patterns. If none exist, create a thin wrapper:

```typescript
// lib/analytics.ts
export function trackEvent(event: string, properties?: Record<string, unknown>) {
  // TODO: Wire to Amplitude when SDK is added
  if (typeof window !== 'undefined' && (window as any).amplitude) {
    (window as any).amplitude.track(event, properties);
  }
}
```

**Step 2: Add tracking calls**

```typescript
// CanvasHeader - on run:
trackEvent('Run Button Clicked', { runType: type });

// CanvasHeader - on publish:
trackEvent('Publish Button Clicked');

// LowerSectionTabs - on tab switch:
trackEvent(`${tab}-tab Button Clicked`);
```

**Step 3: Commit**

```
feat: add amplitude event tracking to canvas actions
```

---

## Execution Order Summary

| Phase | Tasks | Status | Dependencies |
|-------|-------|--------|--------------|
| 1: Locking & Permissions | 1.1–1.4 | ✅ DONE | None |
| 2: Canvas Core | 2.1–2.6 | ✅ DONE | Phase 1 |
| 3: Project Tree | 3.1–3.4 | ✅ DONE | Phase 1 (permissions) |
| 4: Op Config Panel | 4.1–4.5 | ✅ DONE | Phase 2 (canvas interactions) |
| 5: Bottom Panels | 5.1–5.3 | ✅ DONE | Phase 1 (store fix) |
| 6: Git/PAT | 6.1–6.2 | ✅ DONE | None |
| 7: Polish | 7.1–7.2 | ✅ DONE | All above |

**Total: 7 phases, 21 tasks, 40 issues resolved — ALL COMPLETE**

Build verified after each phase. All phases implemented on 2026-03-18.
