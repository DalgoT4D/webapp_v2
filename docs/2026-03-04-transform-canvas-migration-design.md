# Transform Canvas (UI4T) Migration Design

**Date**: 2026-03-04
**Status**: Ready for Approval
**Approach**: Bottom-Up Component Migration

---

## 1. Overview

Migrate the UI Transform (UI4T) visual workflow canvas from webapp v1 to webapp_v2. This feature allows users to:

- View and edit data transformation workflows on a visual canvas
- Add source tables and models to the canvas via project tree
- Create operation nodes (18 types) to transform data
- Chain operations and terminate with "Create Table"
- Run workflows (full, to node, from node)
- Publish changes to GitHub
- Preview data, view logs, and see statistics

### Key Requirements

1. **UI must match v1** - Canvas, nodes, operation forms should look visually similar
2. **All 33 API endpoints** must be covered
3. **All states and functionality** must be preserved
4. **Reuse explore components** - ProjectTree, PreviewPane, StatisticsPane
5. **Use Zustand** for state management (v2 pattern)
6. **Phase-wise implementation** - Each phase independently testable

---

## 2. Architecture

### 2.1 File Structure

```
webapp_v2/
├── app/transform/
│   ├── page.tsx                      # Entry (exists)
│   └── canvas/
│       └── page.tsx                  # Full canvas editor (NEW)
│
├── components/
│   ├── explore/                      # Shared (UPDATE)
│   │   ├── ProjectTree.tsx           # Add mode='canvas' & onAddToCanvas
│   │   ├── PreviewPane.tsx           # Reuse as-is
│   │   ├── StatisticsPane.tsx        # Reuse as-is
│   │   └── LogsPane.tsx              # NEW - for transform logs
│   │
│   └── transform/
│       ├── Transform.tsx             # Main wrapper (exists)
│       ├── UITransformTab.tsx        # Update with canvas link
│       ├── FlowEditor.tsx            # Main layout orchestrator (NEW)
│       │
│       └── canvas/                   # All canvas components (NEW)
│           ├── Canvas.tsx            # React Flow wrapper
│           ├── CanvasPreview.tsx     # Read-only preview mode
│           ├── CanvasMessages.tsx    # Lock/unpublished banners
│           ├── CanvasToolbar.tsx     # Run, Sync, Publish buttons
│           │
│           ├── nodes/
│           │   ├── DbtSourceModelNode.tsx
│           │   ├── OperationNode.tsx
│           │   └── index.ts
│           │
│           ├── panels/
│           │   ├── OperationConfigLayout.tsx
│           │   ├── OperationSelector.tsx
│           │   └── CreateTableOrAddFunction.tsx
│           │
│           ├── modals/
│           │   ├── PatRequiredModal.tsx
│           │   ├── PublishModal.tsx
│           │   └── RunWorkflowModal.tsx
│           │
│           └── forms/
│               ├── AggregationOpForm.tsx
│               ├── ArithmeticOpForm.tsx
│               ├── CaseWhenOpForm.tsx
│               ├── CastColumnOpForm.tsx
│               ├── CoalesceOpForm.tsx
│               ├── CreateTableForm.tsx
│               ├── DropColumnOpForm.tsx
│               ├── FlattenJsonOpForm.tsx
│               ├── GenericColumnOpForm.tsx
│               ├── GenericSqlOpForm.tsx
│               ├── GroupByOpForm.tsx
│               ├── JoinOpForm.tsx
│               ├── PivotOpForm.tsx
│               ├── RenameColumnOpForm.tsx
│               ├── ReplaceValueOpForm.tsx
│               ├── UnionTablesOpForm.tsx
│               ├── UnpivotOpForm.tsx
│               ├── WhereFilterOpForm.tsx
│               └── index.ts
│
├── hooks/api/
│   ├── useCanvasGraph.ts             # NEW
│   ├── useCanvasOperations.ts        # NEW
│   ├── useCanvasLock.ts              # NEW
│   ├── useCanvasSources.ts           # NEW
│   ├── useGitIntegration.ts          # NEW
│   ├── useWorkflowExecution.ts       # NEW
│   └── useColumnData.ts              # NEW
│
├── stores/
│   └── canvasStore.ts                # NEW
│
├── types/
│   └── transform-canvas.ts           # NEW
│
├── constants/
│   └── transform-operations.ts       # NEW
│
└── assets/icons/ui4t/                # Copy from v1
    ├── rename.svg
    ├── flatten.svg
    ├── cast.svg
    └── ... (17 icons)
```

### 2.2 Layout Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ CanvasToolbar: [← Back] [Sync Sources] [Run ▼] [Publish]           │
├─────────────────────────────────────────────────────────────────────┤
│ CanvasMessages: "Canvas locked by user@email.com" (if applicable)  │
├───────────────┬─────────────────────────────────┬───────────────────┤
│               │                                 │                   │
│  ProjectTree  │         Canvas                  │  OperationConfig  │
│  (280-550px)  │    (React Flow)                 │  Panel (300px)    │
│               │                                 │                   │
│   Sources     │   [Source] ──► [Operation]      │   - Op Selector   │
│   └─ table1 + │              └──► [Model]       │   - Op Form       │
│   └─ table2 + │                                 │   - Create Table  │
│               │                                 │                   │
│   Models      │                                 │                   │
│   └─ model1 + │                                 │                   │
│               │                                 │                   │
├───────────────┴─────────────────────────────────┴───────────────────┤
│  Tabs: [Preview] [Logs] [Statistics]              [⛶ Fullscreen]   │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  PreviewPane / LogsPane / StatisticsPane (resizable height)    ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Phase-wise Implementation Plan

### Phase 1: Foundation (Types, Constants, Store)
**Goal**: Set up the foundational layer that other phases depend on

| Task | Files | Description |
|------|-------|-------------|
| 1.1 | `types/transform-canvas.ts` | All TypeScript types (~18 core + form-specific) |
| 1.2 | `constants/transform-operations.ts` | Operation definitions, icon mapping |
| 1.3 | `stores/canvasStore.ts` | Zustand store for canvas state |
| 1.4 | Copy icons | Copy 17 operation icons from v1 |

**Core Types** (in `types/transform-canvas.ts`):
- `CanvasNodeTypeEnum` - source, model, operation
- `DbtModelResponse` - Model data from API
- `CanvasNodeDataResponse` - Canvas node from API
- `CanvasEdgeDataResponse` - Edge connection
- `CanvasNodeRender` - Node for React Flow rendering
- `CreateOperationNodePayload` - Create operation request
- `EditOperationNodePayload` - Edit operation request
- `TerminateChainAndCreateModelPayload` - Create table request
- `PreviewTableData` - Table data for preview
- Plus form-specific types defined locally in each form component

**Deliverable**: Foundation ready, no UI yet

---

### Phase 2: API Hooks
**Goal**: All API integrations ready

| Task | Files | Description |
|------|-------|-------------|
| 2.1 | `hooks/api/useCanvasGraph.ts` | Graph CRUD (5 functions) |
| 2.2 | `hooks/api/useCanvasOperations.ts` | Operation CRUD (5 functions) |
| 2.3 | `hooks/api/useCanvasLock.ts` | Lock management with 30s refresh |
| 2.4 | `hooks/api/useCanvasSources.ts` | Sources/models for tree |
| 2.5 | `hooks/api/useGitIntegration.ts` | Git status, publish, PAT |
| 2.6 | `hooks/api/useWorkflowExecution.ts` | Run workflow, poll status |
| 2.7 | `hooks/api/useColumnData.ts` | Column info for forms |

**Deliverable**: All 33 API endpoints accessible via hooks

---

### Phase 3: Node Components
**Goal**: Canvas nodes render correctly

| Task | Files | Description |
|------|-------|-------------|
| 3.1 | `canvas/nodes/DbtSourceModelNode.tsx` | Source/Model node with columns table |
| 3.2 | `canvas/nodes/OperationNode.tsx` | Operation node with icon, config display |
| 3.3 | `canvas/nodes/index.ts` | Node type registry for React Flow |

**UI Details - DbtSourceModelNode**:
- Header: Green (#00897B), lighter green (#50A85C) for unpublished
- Width: 250px
- Shows: Name, schema, columns table (NAME | TYPE)
- Delete button (trash icon) - only if leaf node
- Handles: Left (target), Right (source)

**UI Details - OperationNode**:
- Header: Blue/Purple with operation icon
- Shows: Operation type, config summary
- Edit button (pencil), Delete button (trash)
- Handles: Left (target), Right (source)

**Deliverable**: Nodes can be rendered on canvas

---

### Phase 4: Canvas Core
**Goal**: Basic canvas with nodes and edges

| Task | Files | Description |
|------|-------|-------------|
| 4.1 | `canvas/Canvas.tsx` | React Flow canvas wrapper |
| 4.2 | `canvas/CanvasMessages.tsx` | Lock/unpublished status banners |
| 4.3 | `canvas/CanvasPreview.tsx` | Read-only preview mode |
| 4.4 | Dagre layout | Auto-layout nodes using @dagrejs/dagre |

**Canvas Features**:
- React Flow with custom node types
- Pan, zoom, fit-to-screen controls
- Grid background
- Arrow markers on edges
- Default viewport: 0.8x zoom
- Click node → select, show preview

**Deliverable**: Canvas renders graph from API, nodes/edges display

---

### Phase 5: Shared Component Updates
**Goal**: ProjectTree works in canvas mode

| Task | Files | Description |
|------|-------|-------------|
| 5.1 | Update `explore/ProjectTree.tsx` | Add mode='canvas' prop |
| 5.2 | Add "+" button | Plus icon on each table row |
| 5.3 | `explore/LogsPane.tsx` | Create logs component for transform |
| 5.4 | Verify `InfoTooltip` component | Used for operation tooltips in panel |

**ProjectTree Changes**:
- New prop: `mode: 'explore' | 'canvas'`
- New prop: `onAddToCanvas?: (model: DbtModelResponse) => void`
- When mode='canvas', show "+" button before each table
- Clicking "+" calls onAddToCanvas

**Statistics Tab Note**:
- Statistics tab is behind feature flag `DATA_STATISTICS`
- Only show tab when `isFeatureFlagEnabled(FeatureFlagKeys.DATA_STATISTICS)` returns true

**Deliverable**: ProjectTree can add tables to canvas

---

### Phase 6: Operation Forms (All 18)
**Goal**: All operation forms working

| Task | Files | Description |
|------|-------|-------------|
| 6.1-6.18 | `canvas/forms/*.tsx` | All 18 operation forms |
| 6.19 | `canvas/forms/index.ts` | Form registry mapping |

**Forms List**:
1. AggregationOpForm - Aggregate functions (SUM, COUNT, AVG, etc.)
2. ArithmeticOpForm - Math operations (+, -, *, /)
3. CaseWhenOpForm - Conditional logic (IF/THEN/ELSE)
4. CastColumnOpForm - Data type conversion
5. CoalesceOpForm - NULL handling
6. CreateTableForm - Terminate chain, create output
7. DropColumnOpForm - Column removal
8. FlattenJsonOpForm - JSON flattening
9. GenericColumnOpForm - Custom column expressions
10. GenericSqlOpForm - Raw SQL operations
11. GroupByOpForm - GROUP BY aggregations
12. JoinOpForm - Table joins (LEFT, RIGHT, INNER, OUTER)
13. PivotOpForm - Pivot table operations
14. RenameColumnOpForm - Column renaming
15. ReplaceValueOpForm - Find & replace
16. UnionTablesOpForm - UNION/UNION ALL
17. UnpivotOpForm - Unpivot operations
18. WhereFilterOpForm - WHERE filter conditions

**Common Form Pattern**:
```typescript
interface OperationFormProps {
  node: CanvasNode | null;
  operation: OperationDefinition;
  action: 'create' | 'edit' | 'view';
  onSave: (nodeId: string) => void;
  onCancel: () => void;
  setLoading: (loading: boolean) => void;
}
```

**Deliverable**: All operation types can be created/edited

---

### Phase 7: Operation Panel
**Goal**: Right panel for creating/editing operations

| Task | Files | Description |
|------|-------|-------------|
| 7.1 | `canvas/panels/OperationConfigLayout.tsx` | Panel wrapper with header |
| 7.2 | `canvas/panels/OperationSelector.tsx` | Operation type list with InfoTooltip |
| 7.3 | `canvas/panels/CreateTableOrAddFunction.tsx` | Decision buttons |
| 7.4 | Discard dialog | Confirmation when canceling |
| 7.5 | Dummy node creation | Preview node while creating |

**Panel States**:
1. `op-list` - Show operation selector list
2. `op-form` - Show specific operation form
3. `create-table-or-add-function` - Show decision buttons

**Operation List UI**:
- Each operation row shows: label + InfoTooltip with `infoToolTip` description
- InfoTooltip appears on hover, provides context about each operation
- Operations that can't be chained in middle show tooltip: "Please create a table to use this function"

**Operations that can't chain in middle** (must create table first):
- UNION
- CAST
- FLATTEN_JSON
- UNPIVOT

**Deliverable**: Full operation creation/editing workflow

---

### Phase 8: Canvas Toolbar & Modals
**Goal**: Run, Sync, Publish functionality

| Task | Files | Description |
|------|-------|-------------|
| 8.1 | `canvas/CanvasToolbar.tsx` | Toolbar with actions |
| 8.2 | `canvas/modals/RunWorkflowModal.tsx` | Run options (full/to/from) |
| 8.3 | `canvas/modals/PublishModal.tsx` | Git commit dialog |
| 8.4 | `canvas/modals/PatRequiredModal.tsx` | GitHub PAT entry |

**Toolbar Actions**:
- Back button (close canvas)
- Sync Sources (refresh from warehouse)
- Run dropdown (Full, To selected, From selected)
- Publish (commit to Git)

**Run Types**:
- `full` - Run entire workflow
- `to` - Run up to selected node
- `from` - Run from selected node onwards

**Deliverable**: Complete workflow execution and publishing

---

### Phase 9: Canvas Locking
**Goal**: Multi-user lock management

| Task | Files | Description |
|------|-------|-------------|
| 9.1 | Lock acquisition on mount | POST lock/ |
| 9.2 | Lock refresh (30s interval) | PUT lock/refresh/ |
| 9.3 | Lock release on unmount | DELETE lock/ |
| 9.4 | Browser navigation hooks | beforeunload, popstate |
| 9.5 | View-only mode | When locked by another user |

**Lock Behavior**:
- On canvas mount: Try to acquire lock
- If failed: Show "Locked by user@email.com", enter view-only mode
- If success: Start 30s refresh interval
- On unmount/navigation: Release lock

**Deliverable**: Safe concurrent editing with locking

---

### Phase 10: FlowEditor Integration
**Goal**: Complete canvas page

| Task | Files | Description |
|------|-------|-------------|
| 10.1 | `transform/FlowEditor.tsx` | Main layout orchestrator |
| 10.2 | `app/transform/canvas/page.tsx` | Canvas route |
| 10.3 | Update `UITransformTab.tsx` | Link to canvas |
| 10.4 | Resizable panels | Sidebar and bottom panel |
| 10.5 | Auto-sync on open | Sync sources when canvas opens |
| 10.6 | Fullscreen toggle | Lower section expand to full height |

**Lower Section Features**:
- Tab bar with Preview, Logs, Statistics tabs
- Fullscreen toggle button (⛶) - expands lower section to full dialog height
- Resizable height with drag handle

**Deliverable**: Complete, working canvas feature

---

### Phase 11: Testing & Polish
**Goal**: Tests and edge cases

| Task | Files | Description |
|------|-------|-------------|
| 11.1 | Mock data factories | `__tests__/canvas-mock-data.ts` |
| 11.2 | Component tests | All major components |
| 11.3 | Hook tests | API hooks |
| 11.4 | Error handling | Toast notifications |
| 11.5 | Loading states | Skeletons, spinners |

**Deliverable**: Production-ready feature

---

## 4. Complete API Endpoint List (33 Endpoints)

### Transform Setup & Configuration
| # | Endpoint | Method | Hook |
|---|----------|--------|------|
| 1 | `dbt/dbt_transform/` | GET | `useTransformType()` ✓ exists |
| 2 | `dbt/dbt_workspace` | GET | `useDbtWorkspace()` ✓ exists |
| 3 | `transform/dbt_project/` | POST | `setupTransformWorkspace()` ✓ exists |
| 4 | `transform/dbt_project/dbtrepo` | DELETE | `deleteDbtRepo()` |
| 5 | `dbt/v1/schema/` | PUT | `updateDbtSchema()` |

### Project Tree & Sources
| # | Endpoint | Method | Hook |
|---|----------|--------|------|
| 6 | `transform/v2/dbt_project/sources_models/` | GET | `useSourcesModels()` |
| 7 | `transform/dbt_project/sync_sources/` | POST | `syncSources()` |

### Canvas Graph Management
| # | Endpoint | Method | Hook |
|---|----------|--------|------|
| 8 | `transform/v2/dbt_project/graph/` | GET | `useCanvasGraph()` |
| 9 | `transform/v2/dbt_project/sync_remote_dbtproject_to_canvas/` | POST | `syncRemoteToCanvas()` |
| 10 | `transform/v2/dbt_project/models/{uuid}/nodes/` | POST | `addSourceToCanvas()` |
| 11 | `transform/v2/dbt_project/nodes/{nodeId}/` | DELETE | `deleteOperationNode()` |
| 12 | `transform/v2/dbt_project/model/{nodeId}/` | DELETE | `deleteSourceModelNode()` |

### Operation CRUD
| # | Endpoint | Method | Hook |
|---|----------|--------|------|
| 13 | `transform/v2/dbt_project/operations/nodes/` | POST | `createOperationNode()` |
| 14 | `transform/v2/dbt_project/operations/nodes/{nodeId}/` | PUT | `updateOperationNode()` |
| 15 | `transform/v2/dbt_project/nodes/{nodeId}/` | GET | `getOperationNode()` |

### Create Table (Terminate Chain)
| # | Endpoint | Method | Hook |
|---|----------|--------|------|
| 16 | `transform/v2/dbt_project/models_directories/` | GET | `useModelDirectories()` |
| 17 | `transform/v2/dbt_project/operations/nodes/{nodeId}/terminate/` | POST | `terminateChain()` |

### Canvas Locking
| # | Endpoint | Method | Hook |
|---|----------|--------|------|
| 18 | `transform/dbt_project/canvas/lock/` | POST | `acquireCanvasLock()` |
| 19 | `transform/dbt_project/canvas/lock/refresh/` | PUT | `refreshCanvasLock()` |
| 20 | `transform/dbt_project/canvas/lock/` | DELETE | `releaseCanvasLock()` |

### Git & Publishing
| # | Endpoint | Method | Hook |
|---|----------|--------|------|
| 21 | `dbt/git_status/` | GET | `useGitStatus()` |
| 22 | `dbt/publish_changes/` | POST | `publishChanges()` |
| 23 | `dbt/connect_git_remote/` | PUT | `connectGitRemote()` |

### Workflow Execution
| # | Endpoint | Method | Hook |
|---|----------|--------|------|
| 24 | `dbt/run_dbt_via_celery/` | POST | `runDbtWorkflow()` |
| 25 | `prefect/tasks/transform/` | GET | `usePrefectTasks()` ✓ exists |
| 26 | `tasks/{taskId}?hashkey={hashKey}` | GET | `useTaskPolling()` |

### Column & Table Data
| # | Endpoint | Method | Hook |
|---|----------|--------|------|
| 27 | `warehouse/table_columns/{schema}/{table}` | GET | `useTableColumns()` |
| 28 | `warehouse/table_data/{schema}/{table}` | GET | ✓ explore |
| 29 | `warehouse/table_count/{schema}/{table}` | GET | ✓ explore |
| 30 | `warehouse/download/{schema}/{table}` | GET | ✓ explore |

### Operation-Specific Data
| # | Endpoint | Method | Hook |
|---|----------|--------|------|
| 31 | `transform/dbt_project/data_type/` | GET | `useDataTypes()` |
| 32 | `warehouse/dbt_project/json_columnspec/` | GET | `getJsonColumnKeys()` |

### Data Statistics
| # | Endpoint | Method | Hook |
|---|----------|--------|------|
| 33 | `warehouse/insights/metrics/` | POST | ✓ explore |

---

## 5. Permissions

| Permission | Used In | Action |
|------------|---------|--------|
| `can_create_dbt_model` | ProjectTree, DbtSourceModelNode | Add table to canvas, select node |
| `can_delete_dbt_model` | DbtSourceModelNode | Delete source/model node |
| `can_view_dbt_operation` | OperationConfigLayout | View operation config |
| `can_edit_dbt_operation` | OperationNode | Edit operation |
| `can_delete_dbt_operation` | OperationNode | Delete operation node |
| `can_sync_sources` | ProjectTree, FlowEditor | Sync sources button |
| `can_run_pipeline` | CanvasToolbar | Run workflow button (full/to/from) |

---

## 6. State Management (canvasStore)

```typescript
interface CanvasState {
  // Graph Data
  nodes: CanvasNode[];
  edges: Edge[];

  // Selection
  selectedNode: CanvasNode | null;

  // Lock Status
  lockStatus: {
    isLocked: boolean;
    lockedBy: string | null;
    isOwnLock: boolean;
    loading: boolean;
  };

  // UI State
  isViewOnlyMode: boolean;
  isOperationPanelOpen: boolean;
  operationPanelAction: 'create' | 'edit' | 'view' | null;

  // Publish State
  hasUnpublishedChanges: boolean;
  isPublishModalOpen: boolean;
  isPatModalOpen: boolean;

  // Workflow Execution
  isRunning: boolean;
  runType: 'full' | 'to' | 'from' | null;
  dbtRunLogs: Array<{ timestamp: string; message: string }>;

  // Preview Action
  previewAction: {
    type: 'preview' | 'clear-preview';
    data: { schema: string; table: string } | null;
  };

  // Lower Section
  activeBottomTab: 'preview' | 'logs' | 'statistics';

  // Actions
  setNodes: (nodes: CanvasNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: CanvasNode) => void;
  removeNode: (nodeId: string) => void;
  updateNode: (nodeId: string, data: Partial<CanvasNode>) => void;
  setSelectedNode: (node: CanvasNode | null) => void;
  setLockStatus: (status: Partial<LockStatus>) => void;
  openOperationPanel: (action: 'create' | 'edit' | 'view') => void;
  closeOperationPanel: () => void;
  setPreviewAction: (action: PreviewAction) => void;
  setRunning: (isRunning: boolean, runType?: 'full' | 'to' | 'from') => void;
  addRunLog: (log: { timestamp: string; message: string }) => void;
  clearRunLogs: () => void;
  reset: () => void;
}
```

---

## 7. UI Specifications

### 7.1 Colors

| Element | Color | Hex |
|---------|-------|-----|
| Source/Model Node Header | Teal | #00897B |
| Unpublished Model Node | Light Green | #50A85C |
| Operation Node Header | Blue | #1976D2 |
| Selected Node Border | Black dotted | #000000 |
| Canvas Background | Light Gray | #F5F5F5 |
| Message Banner | Light Teal | #E0F2F1 |
| Message Border | Teal | #00897B |

### 7.2 Dimensions

| Element | Value |
|---------|-------|
| Node Width | 250px |
| ProjectTree Min Width | 280px |
| ProjectTree Max Width | 550px |
| Operation Panel Width | 300px (v1 uses 500px) |
| Lower Section Min Height | 100px |
| Lower Section Default Height | 300px |
| Lower Section Fullscreen | Dialog height - 50px (tab bar) |
| Lock Refresh Interval | 30 seconds |
| Task Poll Interval | 5 seconds |

**Lower Section Behavior**:
- Resizable via drag handle at top
- Fullscreen toggle (⛶ icon) expands to full dialog height
- Clicking fullscreen again returns to default 300px height

### 7.3 Icons (17 operation icons)

Copy from v1: `/webapp/src/assets/icons/UI4T/`
- rename.svg, flatten.svg, cast.svg, coalesce.svg
- arithmetic.svg, concat.svg, drop.svg, replace.svg
- join.svg, filter.svg, groupby.svg, aggregate.svg
- case.svg, union.svg, pivot.svg, unpivot.svg, generic.svg

---

## 8. Error Handling

| Scenario | Handling |
|----------|----------|
| API call fails | Toast error notification |
| Lock acquisition fails | Show "Locked by X", enter view-only |
| Lock refresh fails | Try re-acquire |
| Workflow run fails | Show error in logs tab |
| Publish fails | Toast error, keep modal open |
| PAT invalid | Toast error, keep modal open |

---

## 9. Edge Cases

1. **Browser close during edit**: `beforeunload` event releases lock
2. **Back button during edit**: Show discard dialog
3. **Concurrent editing**: Lock prevents, shows message
4. **Network disconnect**: Lock refresh fails, re-acquire on reconnect
5. **Long-running workflow**: Poll continues, UI stays locked
6. **No PAT configured**: Show PatRequiredModal before any Git operations
7. **Empty canvas**: Show "Add tables from sidebar" message
8. **Dummy nodes cleanup**: Delete on panel close or node change

---

## 10. Testing Strategy

### Test Files Structure
```
components/transform/canvas/__tests__/
├── canvas-mock-data.ts
├── Canvas.test.tsx
├── nodes/
│   ├── DbtSourceModelNode.test.tsx
│   └── OperationNode.test.tsx
├── panels/
│   └── OperationConfigLayout.test.tsx
└── forms/
    ├── JoinOpForm.test.tsx
    └── ... (key forms)
```

### Test Coverage Requirements
- All hooks: 80%+
- Node components: 70%+
- Form components: 60%+ (complex forms prioritized)
- Panel components: 70%+

---

## 11. Dependencies

### Already Installed in webapp_v2
- `reactflow` v11.11.4 - Canvas library
- `@dagrejs/dagre` - Auto-layout (need to verify)
- `react-resizable` - Resizable panels
- `react-arborist` - Tree component
- `react-hook-form` - Form handling
- `zustand` - State management
- `swr` - Data fetching

### May Need to Install
- `@dagrejs/dagre` - If not present, for auto-layout

---

## 12. Summary

| Category | Count |
|----------|-------|
| Phases | 11 |
| API Endpoints | 33 |
| New Components | 38 |
| New Hooks | 7 files (24 functions) |
| Types | ~18 core types + form-specific |
| Operation Forms | 18 |
| Permissions | 7 |

**Estimated Implementation Order**:
1. Phase 1-2: Foundation & Hooks (can run in parallel with design review)
2. Phase 3-5: Nodes, Canvas, ProjectTree updates
3. Phase 6-7: Operation forms and panel
4. Phase 8-9: Toolbar, modals, locking
5. Phase 10-11: Integration and testing

---

## Approval

Please review this design and confirm:
1. Architecture looks correct
2. API list is complete
3. Phase breakdown is acceptable
4. UI specifications match expectations

Once approved, I will create the implementation plan using the writing-plans skill.
