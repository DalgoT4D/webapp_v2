---
description: KPIs feature domain map — KPI cards, targets/RAG status, annotations, and dashboard embedding.
paths:
  - "components/kpis/**"
  - "app/kpis/**"
  - "hooks/api/useKPIs.ts"
  - "types/kpis.ts"
---

# KPIs — Domain Map

KPIs are target-tracked metrics with RAG (red/amber/green) status. **They are embedded into dashboards** (`rules/dashboards.md`) via `components/dashboard/kpi-chart-element.tsx` and built on **metrics** (`rules/metrics.md`).

## Where things live

| Concern | Location |
|---|---|
| Page (entry) | `app/kpis/page.tsx` → `components/kpis/kpi-page.tsx` |
| Card / form / detail / delete | `components/kpis/{kpi-card,kpi-form,kpi-detail-drawer,kpi-delete-dialog}.tsx` |
| Hook | `hooks/api/useKPIs.ts` (`useKPIs`, `useKPIData`, `useAnnotations` + create/update/delete fns) |
| Types & constants | `types/kpis.ts` (`RAG_COLORS`, `DIRECTION_OPTIONS`, `TIME_GRAIN_OPTIONS`, `METRIC_TYPE_TAG_OPTIONS`) |
| Dashboard embedding | `components/dashboard/kpi-chart-element.tsx`, `kpi-selector-modal.tsx` |
| Backend | `DDP_backend/ddpui/api/kpi_api.py`, `core/kpi/kpi_service.py`, `schemas/kpi_schema.py` |

## Data flow

```
kpi-page (useKPIs) → GET /api/kpis/ (filters: search, program_tag, metric_type)
  → KPICard (useKPIData) → GET /api/kpis/{id}/data/ (time_grain, date_from/to, dashboard_filters)
     → renders current_value, target_value, rag_status, periods
Mutations: POST /api/kpis/ · PUT /api/kpis/{id}/ · DELETE /api/kpis/{id}/
Annotations: GET/POST /api/kpis/{id}/notes/ · PUT/DELETE /api/kpis/{id}/notes/{entryId}/
Embedded in dashboard: useKPIData(kpiId, snapshotId?) →
  live: /api/kpis/{id}/data/  |  in a report snapshot: /api/reports/{snapshotId}/kpis/{id}/data/
```

## ⚠️ Gotchas

- **Dual data endpoints for snapshots** — live KPIs hit `/api/kpis/{id}/data/`; KPIs inside a report snapshot hit `/api/reports/{snapshotId}/kpis/{id}/data/`. Pick the path by whether a `snapshotId` is present.
- **RAG status is computed server-side** at fetch time from thresholds + target + direction + current value — it is not stored.
- **Program tags are dynamic** — fetched via `/api/kpis/program-tags/` and added inline during KPI creation.
- **Annotations are period-keyed** — notes attach to a specific period and can snapshot the value/PoP-change at save time (used by reports).
