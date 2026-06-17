---
description: Explore feature domain map — warehouse table browsing, row preview, and column statistics.
paths:
  - "components/explore/**"
  - "app/explore/**"
  - "hooks/api/useWarehouse.ts"
  - "types/explore.ts"
  - "stores/exploreStore.ts"
  - "constants/explore.ts"
---

# Explore — Domain Map

Browse warehouse schemas/tables, preview rows, and view per-column statistics. Reads the warehouse set up in Ingest (`rules/ingest.md`).

## Where things live

| Concern | Location |
|---|---|
| Entry | `app/explore/page.tsx` → `components/explore/Explore.tsx` |
| Tree navigator | `components/explore/ProjectTree.tsx` |
| Row preview | `components/explore/PreviewPane.tsx` |
| Column statistics | `components/explore/StatisticsPane.tsx` |
| Hook | `hooks/api/useWarehouse.ts` (`useWarehouseTables`, `useTableColumns`, `useTableData`, `useTableCount`, `useTableColumnTypes`, `useTaskStatus`, `requestTableMetrics`, `downloadTableCSV`) |
| State | `stores/exploreStore.ts` (selectedTable, activeTab, sidebarWidth) |
| Types / constants | `types/explore.ts`, `constants/explore.ts` (`ExploreTab`, `PAGE_SIZE_OPTIONS`) |
| Backend | `DDP_backend/ddpui/api/warehouse_api.py` |

## Data flow

```
Pick table (ProjectTree) → useWarehouseTables GET /api/warehouse/sync_tables → exploreStore.selectedTable
Preview tab:
  GET /api/warehouse/table_columns/{schema}/{table}
  GET /api/warehouse/table_data/{schema}/{table}?page&limit&order_by&order
  GET /api/warehouse/table_count/{schema}/{table}
  CSV: /api/warehouse/download/{schema}/{table}
Statistics tab (feature-flagged DATA_STATISTICS):
  GET  /api/warehouse/v1/table_data/{schema}/{table}  (column types)
  POST /api/warehouse/insights/metrics/ → task_id
  poll GET /api/tasks/{taskId}?hashkey=data-insights → render stats
```

## ⚠️ Gotchas

- **Requires an active OrgWarehouse** — backend 404s if none is set up. Components assume `schema.table` format with no discovery fallback.
- **Statistics is async + feature-flagged** — gated by `DATA_STATISTICS`; metrics run as a Celery task you poll for; no built-in timeout if the task hangs.
- **Large tables can lag** — preview defaults to small pages with no virtual scrolling; CSV download streams ~30k rows/page server-side.
