---
description: Metrics feature domain map — reusable saved metrics (simple + calculated) consumed by charts and KPIs.
paths:
  - "components/metrics/**"
  - "app/metrics/**"
  - "hooks/api/useMetrics.ts"
  - "types/metrics.ts"
  - "components/charts/MetricsSelector.tsx"
---

# Metrics — Domain Map

Metrics are reusable saved measures (simple aggregation or calculated expression) defined once and **consumed by charts** (`components/charts/MetricsSelector.tsx`) and **KPIs** (`rules/kpis.md`).

## Where things live

| Concern | Location |
|---|---|
| Page (entry) | `app/metrics/page.tsx` → `components/metrics/metrics-library.tsx` |
| Create/edit form | `components/metrics/metric-form-dialog.tsx` |
| "Used by" links | `components/metrics/consumer-links.tsx` |
| Chart integration | `components/charts/MetricsSelector.tsx` |
| Hook | `hooks/api/useMetrics.ts` |
| Types | `types/metrics.ts` |
| Backend | `DDP_backend/ddpui/api/metric_api.py`, `core/metric/metric_service.py`, `models/metric.py` |

## Data flow

```
metric-form-dialog → POST /api/metrics/validate/ (expression syntax + live warehouse test query)
  → on valid: POST /api/metrics/  (MetricService.create_metric)
Edit: PUT /api/metrics/{id}/
Used-by / delete guard: GET /api/metrics/{id}/consumers/ (charts + KPIs referencing it)
Delete: DELETE /api/metrics/{id}/  (blocked if any consumer exists)
```

## ⚠️ Gotchas

- **Consumption tracked across two systems** — KPIs reference by FK (`KPI.metric_id`); charts reference via `extra_config.metrics[].saved_metric_id`. The delete guard checks both; don't assume one source of truth.
- **Validation timing differs by mode** — simple mode validates on field change; calculated mode validates only on save (payload check + live warehouse query).
- **Switching modes clears the other mode's fields** — simple↔calculated nullifies inactive fields (`column`/`aggregation` vs `column_expression`).
- **Consumers lazy-load in the list** — "Used by" fetches per visible row (avoids N+1) so it may briefly show a skeleton.
