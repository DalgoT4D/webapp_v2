---
description: Dashboard builder domain map — grid layout, cells, filters, tabs, and how charts/KPIs are embedded.
paths:
  - "components/dashboard/**"
  - "components/dashboards/**"
  - "app/dashboards/**"
  - "types/dashboard.ts"
  - "types/dashboard-filters.ts"
---

# Dashboards — Domain Map

Dashboards arrange **charts** (`rules/charts.md`) and **KPIs** into a drag-and-drop grid with filters. Two component dirs: `components/dashboard/` (the builder + view internals) and `components/dashboards/` (list/management).

## Where things live

| Concern | Location |
|---|---|
| Builder | `components/dashboard/dashboard-builder.tsx` (shell) + `builder/` (header, canvas, modals, save, tabs, grid commits, cleanup, shortcuts) + `hooks/` (`useDashboardLock`, `useDashboardAutosave`, `useBuilderFilters`, `useCrossTabDrag`, `useCanvasAutoscroll`) |
| View | `components/dashboard/dashboard-native-view.tsx` (shell) + `view/` (header, grid, states, share flow, tabs, actions); Superset: `superset-dashboard-view.tsx`, `superset-embed.tsx` |
| Widgets | `components/dashboard/widgets/` — `view-widgets.tsx` / `builder-widgets.tsx` (one row per widget type), `create-widget.ts`, `add-widget-handlers.ts`; `chart/` (builder + view chart elements, data/instance/lifecycle hooks, breadcrumbs, `logic/`), `kpi/`, `text/` |
| Grid cell | `components/dashboard/DashboardCell.tsx` |
| Editor rules | `components/dashboard/logic/editor-state.ts`, `logic/builder-filters.ts`; grid sizes `grid/grid-constants.ts` |
| Filters | `unified-filters-panel.tsx` + `filters/` (`useFiltersPanel`, vertical/horizontal panels, `filter-config.ts`), `filter-config-modal.tsx`, `filter-element.tsx`, `dashboard-filter-widgets.tsx`, `datetime-filter-widget.tsx`, `responsive-filters-section.tsx` |
| Tabs | `components/dashboard/tabs/` (`TabBar`, `tab-utils`, `cross-tab-drag`) |
| List | `components/dashboard/dashboard-list.tsx` + `list/` + shared kit `components/list-page/`; usage dashboard `components/dashboards/` |
| Pages | `app/dashboards/` |
| Hooks (API) | `hooks/api/useDashboards.ts`, `hooks/api/useChart.ts` (`useCharts` for the picker), `hooks/api/useKPIs.ts` |
| Types | `types/dashboard.ts`, `types/dashboard-filters.ts` |

## How it fits together

```
dashboard-builder (react-grid-layout)
  ├─ DashboardCell  → renders one element
  │    ├─ widgets/chart/chart-element-builder  → embeds a saved chart (picked via chart-selector-modal, fetched with useCharts)
  │    ├─ widgets/kpi/kpi-chart-element         → embeds a KPI
  │    └─ widgets/text/text-element-unified
  ├─ unified-filters-panel → dashboard-level filters (DashboardFilterType) that cascade to embedded charts
  └─ tabs/ → multiple tabs per dashboard (DashboardTabsData)
```

## ⚠️ Gotchas

- **Charts are referenced, not duplicated** — a dashboard stores chart IDs and embeds live charts. Editing a chart in the charts feature changes every dashboard embedding it. `/api/charts/{id}/dashboards/` lists those dashboards.
- **Drag performance** is sensitive — memoize cells, stabilize callbacks with refs, and RAF-throttle layout animation (this pattern is validated for the dashboard builder; see the user's project memory "RGL dashboard drag perf pattern").
- **Layout model** is sequential row-flow with snap-based alignment — no element swapping, no fixed rows (see project memory "Dashboard layout model").
