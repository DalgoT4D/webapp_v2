---
description: Charts feature domain map — where chart code lives, how data flows, backend counterpart, and chart implementation rules.
paths:
  - "components/charts/**"
  - "app/charts/**"
  - "types/charts.ts"
  - "lib/chart*"
---

# Charts — Domain Map

Charts are the core visualization unit. **They are consumed by dashboards and reports** — a chart built here is embedded into a dashboard grid (`rules/dashboards.md`) and snapshotted into reports (`rules/reports.md`). All rendering uses **ECharts**.

## Where things live

| Concern | Location |
|---|---|
| Pages | `app/charts/page.tsx` (list), `app/charts/new/` (pick type + `configure/`), `app/charts/[id]/` (detail, `edit/`) |
| Builder (shared by create + edit) | `components/charts/builder/` (`ChartBuilderLayout`, `data-config/*` sections, `metrics/*` tabs), `ChartDataConfiguration.tsx` (composes the sections), `hooks/` (`useChartBuilderState`, preview data, drill-down, unsaved-changes guard, save) |
| Business rules (pure, Jest-tested) | `components/charts/logic/` — `validation.ts`, `payload.ts`, `type-switch.ts`, `default-name.ts`, `map-layers.ts`, `map-overlay.ts`, `map-drilldown.ts`, `table-drilldown.ts`, `metric-labels.ts`, `metric-columns.ts`, `dataset-change.ts`, `auto-prefill.ts`, `saved-chart*.ts`, `time-grain.ts`, `sort-options.ts`, `preview-requests.ts` |
| Chart types | `components/charts/chart-types/registry.ts` (data only: icons, colours, labels) + `default-customizations.ts`; per-type code in `chart-types/echarts/` (bar/line/pie/number styling, formatting, legend, stacked bar), `table/`, `pivot-table/`, `map/` |
| Shared styling controls | `components/charts/styling/` (number/date format, conditional formatting, appearance, table themes, search bar) |
| List / detail | `components/charts/list/`, `components/charts/detail/` |
| Preview / export | `ChartPreview.tsx`, `StaticChartPreview.tsx`, `DataPreview.tsx`, `ChartExportDropdown*.tsx`, `lib/chart-export.ts` |
| Hooks (API) | `hooks/api/useCharts.ts`, `hooks/api/useChart.ts` |
| Types | `types/charts.ts` (`ChartTypes`, `ChartType`) |
| **Backend** | `DDP_backend/ddpui/core/charts/` + `ddpui/api/charts_api.py` |

## Data flow

```
DatasetSelector → pick warehouse table (/api/warehouse/schemas, /api/charts/chart-data-preview)
  → ChartDataConfiguration (dimensions/metrics) builds a chart config payload
  → generateAutoPrefilledConfig / mergeTableColumnFormatting shape it
  → /api/charts/chart-data/ (backend charts_api.generate_chart_data_and_config + pivot_service)
  → ChartPreview renders via the per-type renderer in components/charts/chart-types/<type>/
  → save → /api/charts/  (POST create / PUT /api/charts/{id}/)
```

Key endpoints (`useChart.ts`): `/api/charts/`, `/api/charts/{id}/`, `/api/charts/{id}/data/`, `/api/charts/chart-data/`, `/api/charts/chart-data-preview/`, `/api/charts/export/`, `/api/charts/{id}/dashboards/` (which dashboards embed this chart).

## Code that changes together lives together

A fix for one chart type goes in its `chart-types/<type>/` folder; a rule across all types goes in one `logic/` file. Differences between the create and edit builders are explicit (`builder: 'create' | 'edit'`, `// BUILDER-DRIFT:`), pinned bugs are marked `// PINNED-BUGS:` — grep before changing behavior.

## Implementation rules

- **All charts use ECharts** — follow the established renderer patterns in `components/charts/chart-types/`.
- Transform API data into the chart-compatible shape via the `lib/chart*` helpers — don't reshape inline in components.
- Export (PNG/PDF) uses the existing `ChartExportDropdown*` utilities — don't roll your own.
- A new chart type means a new renderer under `components/charts/chart-types/<type>/` registered in `components/charts/chart-types/registry.ts`, plus a `ChartTypes` entry.
