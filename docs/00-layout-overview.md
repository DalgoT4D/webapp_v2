# Transform Canvas Layout - Overview

## Summary

The Transform Canvas is organized in a resizable two-panel layout with an upper section (project tree + canvas) and a lower section (preview/logs/statistics tabs).

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FlowEditor                                │
├──────────────┬──────────────────────────────────────────────────────┤
│              │                                                      │
│  ProjectTree │                    Canvas                            │
│  (resizable) │                                                      │
│    280-550px │              (ReactFlowProvider)                     │
│              │                                                      │
│  ┌─────────┐ │                                                      │
│  │ Search  │ │                                                      │
│  └─────────┘ │                                                      │
│  ┌─────────┐ │                                                      │
│  │ Data    │ │                                                      │
│  │ └ schema│ │                                                      │
│  │   └table│ │                                                      │
│  └─────────┘ │                                                      │
│              │                                                      │
├──────────────┴──────────────────────────────────────────────────────┤
│ [Preview] [Logs] [Data statistics]                          [⛶]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                      Lower Section Content                          │
│              (PreviewPane | LogsPane | StatisticsPane)              │
│                                                                     │
│                        (resizable height)                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy

```
FlowEditor
├── UpperSection
│   ├── ResizableBox (horizontal)
│   │   └── ProjectTree
│   └── ReactFlowProvider
│       └── Canvas
│           ├── Toolbar
│           ├── ReactFlow (nodes/edges)
│           ├── OperationPanel
│           ├── PatRequiredModal
│           └── PublishModal
└── ResizableBox (vertical)
    └── LowerSection
        ├── Tabs (Preview | Logs | Statistics)
        └── TabContent
            ├── PreviewPane
            ├── LogsPane
            └── StatisticsPane
```

---

## Layout Components

| Component | Purpose | v1 Source | Complexity |
|-----------|---------|-----------|------------|
| FlowEditor | Main layout container | `FlowEditor.tsx` (429 lines) | High |
| ProjectTree | Source/model tree browser | `ProjectTree.tsx` (405 lines) | Medium |
| PreviewPane | Table data preview | `PreviewPane.tsx` (305 lines) | Medium |
| LogsPane | DBT run logs display | `LogsPane.tsx` (121 lines) | Low |
| StatisticsPane | Data statistics/insights | `StatisticsPane.tsx` (588 lines) | High |

---

## Resizable Layout

### Horizontal Resize (ProjectTree)
- **Min width**: 280px
- **Max width**: 550px
- **Default width**: 260px
- **Resize handle**: Right edge (`resizeHandles={['e']}`)

### Vertical Resize (LowerSection)
- **Min height**: 100px
- **Max height**: Full dialog height
- **Default height**: 300px
- **Resize handle**: Top edge (`resizeHandles={['n']}`)
- **Fullscreen toggle**: Expand to full height

---

## State Management

### FlowEditor State
```typescript
interface FlowEditorState {
  // Data
  sourcesModels: DbtModelResponse[];

  // UI State
  refreshEditor: boolean;
  lowerSectionHeight: number;
  lockUpperSection: boolean;
  selectedTab: 'preview' | 'logs' | 'statistics';
  isSyncingSources: boolean;

  // Locking
  finalLockCanvas: boolean;
  tempLockCanvas: boolean;
}
```

### Cross-Component Communication
- **CanvasAction Context**: Commands from ProjectTree/Canvas to FlowEditor
- **PreviewAction Context**: Commands from Canvas to PreviewPane/StatisticsPane
- **DbtRunLogs Context**: Logs from FlowEditor to LogsPane

---

## API Dependencies

| Component | Endpoints |
|-----------|-----------|
| FlowEditor | `transform/v2/dbt_project/sources_models/`, `prefect/tasks/transform/`, `dbt/run_dbt_via_celery/`, `transform/dbt_project/sync_sources/`, `tasks/{taskId}` |
| PreviewPane | `warehouse/table_columns/{schema}/{table}`, `warehouse/table_data/{schema}/{table}`, `warehouse/table_count/{schema}/{table}`, `warehouse/download/{schema}/{table}` |
| LogsPane | None (receives data via context) |
| StatisticsPane | `warehouse/v1/table_data/{schema}/{table}`, `warehouse/table_count/{schema}/{table}`, `warehouse/insights/metrics/` |

---

## Polling Mechanisms

### Task Progress Polling
- **Interval**: 2-5 seconds
- **Endpoints**: `tasks/{taskId}?hashkey={hashKey}`
- **Used for**: DBT run progress, sync sources progress
- **Termination**: On status `completed` or `failed`

### Lock Refresh (in Canvas)
- **Interval**: 30 seconds
- **Endpoint**: `transform/v2/dbt_project/lock/refresh/`
- **Condition**: Only when canvas is locked by current user

---

## Key Features by Component

### FlowEditor
1. Orchestrates all child components
2. Manages resizable layout
3. Handles run workflow and sync sources
4. Polls for running tasks on mount
5. Auto-syncs sources on first open

### ProjectTree
1. Tree view with react-arborist
2. Search across schemas and tables
3. Sync sources button
4. Add to canvas on leaf node click
5. Delete source capability

### PreviewPane
1. Table data with pagination
2. Sortable columns
3. CSV download
4. Server-side pagination

### LogsPane
1. Timestamp + message table
2. Loading spinner during runs
3. Empty state when no logs

### StatisticsPane
1. Column-level statistics
2. Data distribution charts
3. Numeric, String, DateTime, Boolean insights
4. Per-column polling for metrics

---

## Implementation Order

1. **FlowEditor** (main layout structure)
2. **ProjectTree** (left panel)
3. **LogsPane** (simplest tab)
4. **PreviewPane** (table with pagination)
5. **StatisticsPane** (complex with charts)

---

## Spec Files

- [FlowEditor.md](./FlowEditor.md)
- [ProjectTree.md](./ProjectTree.md)
- [LowerSectionTabs.md](./LowerSectionTabs.md)
