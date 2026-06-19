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
| Builder (entry, grid) | `components/dashboard/dashboard-builder-v2.tsx` (uses `react-grid-layout`) |
| Grid cell wrapper | `components/dashboard/DashboardCell.tsx` |
| Chart embedding | `components/dashboard/chart-element-v2.tsx`, `chart-element-view.tsx`, `chart-selector-modal.tsx` |
| KPI embedding | `components/dashboard/kpi-chart-element.tsx`, `kpi-selector-modal.tsx` |
| Text elements | `components/dashboard/text-element-unified.tsx`, `chart-title-editor.tsx` |
| Filters | `components/dashboard/dashboard-filter-widgets.tsx`, `unified-filters-panel.tsx`, `filter-config-modal.tsx`, `filter-element.tsx`, `datetime-filter-widget.tsx`, `responsive-filters-section.tsx` |
| Tabs | `components/dashboard/tabs/` |
| Views | `individual-dashboard-view.tsx`, `dashboard-native-view.tsx`, `superset-embed.tsx` |
| Layout drag UX | `GridGuides.tsx`, `SnapIndicators.tsx`, `SpaceMakingIndicators.tsx`, `lib/dashboard-animation-utils.ts` (`compactVertical`, `bottomY`) |
| List/management | `components/dashboard/dashboard-list-v2.tsx`, `components/dashboards/` |
| Pages | `app/dashboards/` |
| Hooks | `hooks/api/useDashboards.ts` (exports `DashboardFilter`), `hooks/api/useChart.ts` (`useCharts` for the embed picker), `hooks/api/useKPIs.ts` |
| Types | `types/dashboard.ts` (`DashboardTab`, `DashboardTabsData`, `DashboardComponentType`), `types/dashboard-filters.ts` (`DashboardFilterType`) |

## How it fits together

```
dashboard-builder-v2 (react-grid-layout)
  ├─ DashboardCell  → renders one element
  │    ├─ chart-element-v2   → embeds a saved chart (picked via chart-selector-modal, fetched with useCharts)
  │    ├─ kpi-chart-element  → embeds a KPI
  │    └─ text-element-unified
  ├─ unified-filters-panel → dashboard-level filters (DashboardFilterType) that cascade to embedded charts
  └─ tabs/ → multiple tabs per dashboard (DashboardTabsData)
```

## ⚠️ Gotchas

- **Charts are referenced, not duplicated** — a dashboard stores chart IDs and embeds live charts. Editing a chart in the charts feature changes every dashboard embedding it. `/api/charts/{id}/dashboards/` lists those dashboards.
- **`-v2` files are current** — prefer `dashboard-builder-v2.tsx` / `dashboard-list-v2.tsx` / `chart-element-v2.tsx` over any non-v2 remnants.
- **Drag performance** is sensitive — memoize cells, stabilize callbacks with refs, and RAF-throttle layout animation (this pattern is validated for `dashboard-builder-v2`; see the user's project memory "RGL dashboard drag perf pattern").
- **Layout model** is sequential row-flow with snap-based alignment — no element swapping, no fixed rows (see project memory "Dashboard layout model").
