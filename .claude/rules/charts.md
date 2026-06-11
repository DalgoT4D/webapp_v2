---
description: Charts feature domain map — where chart code lives, how data flows, backend counterpart, and chart implementation rules.
paths:
  - "components/charts/**"
  - "app/charts/**"
  - "types/charts.ts"
  - "constants/chart-types.ts"
  - "lib/chart*"
  - "lib/stacked-bar-utils*"
---

# Charts — Domain Map

Charts are the core visualization unit. **They are consumed by dashboards and reports** — a chart built here is embedded into a dashboard grid (`rules/dashboards.md`) and snapshotted into reports (`rules/reports.md`). All rendering uses **ECharts**.

## Where things live

| Concern | Location |
|---|---|
| Builder UI (entry) | `components/charts/ChartBuilder.tsx` |
| Chart-type picker | `components/charts/ChartTypeSelector.tsx` |
| Data config | `components/charts/ChartDataConfigurationV3.tsx`, `MetricsSelector.tsx`, `DatasetSelector.tsx`, `TableDimensionsSelector.tsx` |
| Customization / filters / sort / pagination | `ChartCustomizations.tsx`, `ChartFiltersConfiguration.tsx`, `ChartSortConfiguration.tsx`, `ChartPaginationConfiguration.tsx` |
| Preview | `ChartPreview.tsx`, `StaticChartPreview.tsx`, `MiniChart.tsx`, `DataPreview.tsx` |
| Export (PNG/PDF) | `ChartExport.tsx`, `ChartExportDropdown.tsx`, `ChartExportDropdownForList.tsx` |
| Per-type renderers | `components/charts/types/{bar,line,pie,number,table,map,shared}/` |
| Map charts (geojson/regions) | `components/charts/map/` + `/api/charts/geojsons`, `/api/charts/regions`, `/api/charts/map-data` |
| Pages | `app/charts/page.tsx` (list), `app/charts/[id]/edit/`, `app/charts/new/` |
| Hooks | `hooks/api/useCharts.ts` (list), `hooks/api/useChart.ts` (single + mutations) |
| Types | `types/charts.ts` (`ChartTypes` enum) |
| Constants | `constants/chart-types.ts` |
| Transform/payload helpers | `lib/chart-payload-utils.ts` (`mergeTableColumnFormatting`), `lib/chartAutoPrefill.ts` (`generateAutoPrefilledConfig`), `lib/stacked-bar-utils.ts` (`applyStackedBarLabels`) |
| **Backend** | `DDP_backend/ddpui/core/charts/` (e.g. `pivot_service.py`) + `ddpui/api/charts_api.py` (`generate_chart_data_and_config`) |

## Data flow

```
DatasetSelector → pick warehouse table (/api/warehouse/schemas, /api/charts/chart-data-preview)
  → ChartDataConfigurationV3 (dimensions/metrics) builds a chart config payload
  → generateAutoPrefilledConfig / mergeTableColumnFormatting shape it
  → /api/charts/chart-data/ (backend charts_api.generate_chart_data_and_config + pivot_service)
  → ChartPreview renders via the per-type renderer in components/charts/types/<type>/
  → save → /api/charts/  (POST create / PUT /api/charts/{id}/)
```

Key endpoints (`useChart.ts`): `/api/charts/`, `/api/charts/{id}/`, `/api/charts/{id}/data/`, `/api/charts/chart-data/`, `/api/charts/chart-data-preview/`, `/api/charts/export/`, `/api/charts/{id}/dashboards/` (which dashboards embed this chart).

## ⚠️ Gotcha — V2 registry migration in progress

Charts is mid-refactor to a **registry-based chart-type architecture** (per-type renderers under `components/charts/types/`). Some old code paths still exist. Before editing a chart type, confirm whether it goes through the registry or a legacy path, and follow the registry pattern for new work. (See the user's project memory "Charts V2 Migration Status" for the current task status.)

## Implementation rules

- **All charts use ECharts** — follow the established renderer patterns in `components/charts/types/`.
- Transform API data into the chart-compatible shape via the `lib/chart*` helpers — don't reshape inline in components.
- Export (PNG/PDF) uses the existing `ChartExport*` utilities — don't roll your own.
- A new chart type means a new renderer under `components/charts/types/<type>/` registered in the registry, plus a `ChartTypes` entry and a `constants/chart-types.ts` entry.
