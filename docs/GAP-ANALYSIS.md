# Gap Analysis: Transform Canvas Migration

**Status: RESOLVED**

This document identifies features and components that were discovered during the v1 audit. Most items have been addressed in updated specs.

## Resolution Summary

| Gap | Resolution |
|-----|------------|
| Context Providers | ✅ Added to `02-canvas-store.md` (dbtRunLogs, previewAction slices) |
| Dummy Nodes Utility | ✅ Created `utils/dummynodes.md` spec |
| Lock Lifecycle | ✅ Added to `canvas/Canvas.md` (30s refresh, emergency cleanup) |
| PAT Flow | ✅ Added to `canvas/Canvas.md` |
| Run Options | ✅ Added to `canvas/Canvas.md` (run/run-to/run-from) |
| Node Collision | ✅ Added to `canvas/Canvas.md` |
| Sync Remote | ✅ Already in `hooks/useCanvasGraph.md` |
| Column Caching | ✅ Already in `nodes/DbtSourceModelNode.md` |
| Published Colors | ✅ Already in `nodes/DbtSourceModelNode.md` |
| Permission Checks | ✅ Documented throughout specs |

---

## Original Analysis (For Reference)

---

## Critical Items Requiring Additional Specs

### 1. Context Providers (NEW SPEC NEEDED)

**FlowEditorCanvasContext** - Not fully captured in canvas store spec
- `CanvasNodeContext` + `useCanvasNode()`: Currently selected node
- `CanvasActionContext` + `useCanvasAction()`: Canvas actions dispatcher
- **Canvas Action Types**:
  ```typescript
  'add-srcmodel-node' | 'delete-node' | 'delete-source-tree-node' |
  'refresh-canvas' | 'open-opconfig-panel' | 'close-reset-opconfig-panel' |
  'sync-sources' | 'run-workflow' | 'update-canvas-node'
  ```

**FlowEditorPreviewContext** - Not captured
- `PreviewActionContext` + `usePreviewAction()`: Preview state management
- **Preview Action Types**: `'preview' | 'clear-preview'`

**DbtRunLogsContext** - Not captured
- `useDbtRunLogs()`: Get current logs
- `useDbtRunLogsUpdate()`: Update logs

**Recommendation**: Add these to the `02-canvas-store.md` spec as Zustand slices.

---

### 2. Utility Functions (NEW SPEC NEEDED)

**dummynodes.ts** (72 lines) - Not captured
- `generateDummySrcModelNode()`: Create temporary source/model node for UI
- `generateDummyOperationNode()`: Create temporary operation node for UI
- Used during create flow before backend persistence

**Recommendation**: Create `utils/dummynodes.md` spec.

---

### 3. Canvas Features Requiring More Detail

#### A. Lock Management (Partially captured)
Missing from current Canvas.md spec:
- [ ] 30-second interval for lock refresh
- [ ] Emergency cleanup handlers (beforeunload, popstate, click-away)
- [ ] Lock release on component unmount
- [ ] Lock acquisition retry logic

#### B. Node Collision Detection (Not captured)
- Prevents node overlap during drag operations
- Algorithm details needed

#### C. Dagre Layout Engine Parameters (Partially captured)
Missing specific parameters:
- Direction: `LR` (left-to-right)
- Node separation: `200px`
- Rank separation: `350px`

#### D. Sync Remote to Canvas (Not captured)
- Initial sync step: POST to `transform/v2/dbt_project/sync_remote_dbtproject_to_canvas/`
- Happens BEFORE fetching graph data
- Not mentioned in useCanvasGraph hook spec

---

### 4. Node Component Features

#### DbtSourceModelNode Missing Details:
- [ ] Column data caching mechanism (ref-based)
- [ ] Lazy-load columns on selection
- [ ] Different colors for published vs unpublished:
  - Published: `#00897B`
  - Unpublished: `#50A85C`
- [ ] Click triggers preview pane update via PreviewAction context

#### OperationNode Missing Details:
- [ ] Delete button visibility logic (leaf-node only)
- [ ] Dotted border when selected
- [ ] Icon display based on operation type

---

### 5. Canvas Toolbar Features

Missing run options in toolbar spec:
- [ ] Run workflow (full)
- [ ] Run to node (selected node and upstream)
- [ ] Run from node (selected node and downstream)

---

### 6. PreviewPane Missing Features

Not fully captured in LowerSectionTabs.md:
- [ ] Download CSV functionality
- [ ] Sort column tracking
- [ ] Backend pagination (server-side)
- [ ] React-Table integration details

---

### 7. StatisticsPane Complexity

Missing from LowerSectionTabs.md:
- [ ] Feature flag: `FeatureFlagKeys.DATA_STATISTICS`
- [ ] Column-level polling mechanism
- [ ] Type-specific insight components:
  - `NumberInsights` - for numeric columns
  - `StringInsights` - for string columns
  - `DateTimeInsights` - for datetime columns
  - `RangeChart` - reusable bar chart
- [ ] Debounce hook for height changes

---

### 8. Permission Checks

Full permission list (verify all are in specs):
- `can_run_pipeline` - Run buttons
- `can_delete_dbt_operation` - Delete operation nodes
- `can_delete_dbt_model` - Delete source/model nodes
- `can_edit_dbt_operation` - Edit operation config
- `can_view_dbt_operation` - View operation (read-only)
- `can_create_dbt_model` - Create new models
- `can_sync_sources` - Sync sources button

---

### 9. PAT (Personal Access Token) Flow

Missing flow details:
1. On canvas load, check if PAT is connected
2. If not connected → show PatRequiredModal
3. User can:
   - Enter PAT → connect and acquire lock
   - Proceed without → view-only mode (no lock)
4. View-only mode restrictions:
   - Cannot edit operations
   - Cannot delete nodes
   - Cannot publish
   - Can only view/preview

---

### 10. API Endpoints Not in Hook Specs

Missing endpoints:
- `GET dbt/dbt_workspace` - Get workspace info
- `POST transform/v2/dbt_project/sync_remote_dbtproject_to_canvas/` - Initial sync
- `GET warehouse/download/{schema}/{table}` - CSV download

---

## Action Items

1. **Update `02-canvas-store.md`** - Add context provider equivalents as Zustand slices
2. **Create `utils/dummynodes.md`** - Utility functions spec
3. **Update `canvas/Canvas.md`** - Add lock lifecycle, collision detection, Dagre params
4. **Update `nodes/DbtSourceModelNode.md`** - Add caching, colors, preview trigger
5. **Update `nodes/OperationNode.md`** - Add delete visibility, selection styling
6. **Update `hooks/useCanvasGraph.md`** - Add sync_remote endpoint
7. **Update `layout/LowerSectionTabs.md`** - Add CSV download, feature flag, insight components
8. **Verify all permissions** are documented in relevant component specs
9. **Document PAT flow** in Canvas.md or PatRequiredModal.md
