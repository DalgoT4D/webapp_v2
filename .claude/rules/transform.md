---
description: Transform feature domain map — dbt-based transformation, the visual DAG canvas, canvas locking, and git integration.
paths:
  - "components/transform/**"
  - "app/transform/**"
  - "hooks/api/useTransform.ts"
  - "hooks/api/useCanvas*.ts"
  - "hooks/api/useDbtWorkspace.ts"
  - "hooks/api/useGitIntegration.ts"
  - "types/transform.ts"
  - "stores/transformStore.ts"
---

# Transform — Domain Map

dbt-based transformation. The centerpiece is a **visual DAG canvas** (React Flow) where users build dbt models by chaining operation nodes. Large feature (~50+ components). Backed by managed or external git.

## Where things live

| Concern | Location |
|---|---|
| Tab container (entry) | `app/transform/page.tsx` → `components/transform/Transform.tsx` (UI vs GitHub vs dbt Cloud) |
| Canvas page | `app/transform/canvas/page.tsx` → `components/transform/ui-transform/canvas/layout/FlowEditor.tsx` |
| Canvas core / nodes | `ui-transform/canvas/Canvas.tsx`, `canvas/nodes/{OperationNode,DbtSourceModelNode}.tsx` |
| Operation forms (14+) | `ui-transform/canvas/forms/{single-source,multi-source,shared}/` |
| Lower panels (preview/logs/stats) | `ui-transform/canvas/layout/LowerSectionTabs.tsx`, `panels/OperationConfigLayout.tsx` |
| Modals | `ui-transform/canvas/modals/{PublishModal,PatRequiredModal,DiscardChangesDialog}.tsx` |
| Graph + nodes data | `hooks/api/useCanvasGraph.ts` |
| Add/edit/delete nodes | `hooks/api/useCanvasOperations.ts` |
| Canvas lock | `hooks/api/useCanvasLock.ts` (acquire/refresh/release) |
| Sources/models tree | `hooks/api/useCanvasSources.ts` |
| Git + dbt workspace | `hooks/api/useGitIntegration.ts`, `useDbtWorkspace.ts` |
| State | `stores/transformStore.ts` (selected node, action bus, lock status, modals, logs) |
| Types | `types/transform.ts` (`CanvasNodeDataResponse`, `DbtProjectGraphResponse`, `CanvasLockStatus`) |
| Backend | `DDP_backend/ddpui/api/transform_api.py`, `ddpdbt/dbt_service.py` |

## Data flow

```
Enter canvas: useCanvasGraph GET /api/transform/v2/dbt_project/graph/
  + useCanvasSources GET /api/transform/v2/dbt_project/sources_models/
  + useCanvasLock POST /api/transform/dbt_project/canvas/lock/
Add source node: POST /api/transform/v2/dbt_project/models/{uuid}/nodes/ → mutate graph
Add operation: POST /api/transform/v2/dbt_project/operations/nodes/ {op_type, config, input_node_uuid}
Edit operation: PUT  /api/transform/v2/dbt_project/operations/nodes/{uuid}/ → mutate graph
Terminate chain → model: POST /api/transform/v2/dbt_project/operations/nodes/{uuid}/terminate/
Lock upkeep: PUT .../canvas/lock/refresh/ every 30s; DELETE on unmount / nav / tab-hide
```

## ⚠️ Gotchas

- **Pessimistic canvas lock, multi-user aware** — 30s refresh; lock releases on unmount, tab-visibility change, and SPA navigation. **React 18 Strict Mode (dev)** double-mounts, which can release another user's lock without careful cleanup guards. On lock loss the UI drops to view-only.
- **Git sync only for `transform_type === 'github'`** — dbt Cloud / local-UI types skip remote git sync entirely; `useGitIntegration` only requires a PAT for github.
- **`createOperation` does NOT refresh the graph** — the caller positions the new node at the source's location first, then refreshes, to avoid janky relayout.
- **Polling pauses on hidden tab** — `useRunningTasksMonitor` stops when the tab is hidden and resumes on focus; long tasks can appear stalled if you switch away.
