# Pinned bugs — current behavior asserted by the suite

These are behaviors of the app **as of the pre-refactor baseline** that look wrong. Tests named `[pinned] …` assert them as-is so the refactor doesn't change them silently.

**Workflow:** fix these *after* the refactor, one by one. Fixing one = update its `[pinned]` test to the correct behavior (and its baseline) in the same PR.

Severity: 🔴 user-visible broken feature · 🟠 wrong data/behavior · 🟡 cosmetic/UX quirk

## Charts

| Sev | Behavior | Where / test |
|---|---|---|
| 🔴 | **List-page CSV export of table charts always fails** — request omits `dimensions`, backend 500 "At least one dimension is required", error toast | `ChartExportDropdownForList.handleTableCSVExport` · charts/list.spec.ts C-L12 |
| 🔴 | **First "Next" on chart list pagination bounces back to page 1** (clamp effect sees `totalPages=1` while page 2 loads) | `app/charts/page.tsx` clamp effect · charts/list.spec.ts C-L11 |
| 🟠 | List filters/sort apply to current page only; counter shows server total | charts/list.spec.ts C-L5 |
| 🟠 | Empty filtered list unmounts the table header (sort + filter triggers vanish; only "Clear all" recovers) | charts/list.spec.ts |
| 🟠 | Back asks "unsaved changes?" with no user edits (auto-prefill counts as a change) | configure page · builder-shared C-B6 |
| 🟠 | Removing the only bar metric leaves Save enabled (`isFormValid` falls back to legacy `aggregate_function`) | builder-shared |
| 🟠 | Legend display "all" drops `legendPosition` on bar & line (two stale `updateCustomization` calls) | builder-bar / builder-line |
| 🟠 | bar→number keeps `aggregate_func:'count'` next to `metrics:[SUM]` | type-switch |
| 🟠 | bar→table takes table dimension from auto-prefill (`id`), not the kept X axis | type-switch |
| 🟠 | bar→pivot resets row/col dimensions → Save disabled | type-switch |
| 🔴 | **Create: bar/line/pie → map then Save fails (422)** — legend "bottom" carried into map styling (needs a corner); `sanitizeCustomizationsForChartType` only fixes data label position | type-switch-matrix TS-create bar/line/pie → map |
| 🔴 | **Edit: bar↔line, line→pie, pie→line then Save fails (422)** — edit-page switch restores the old data label position over the sanitized one | type-switch-matrix-edit |
| 🔴 | **Any → pivot (create & edit): rows/cols reset to empty → Save disabled** | type-switch-matrix TS-* → pivot |
| 🟠 | Create: switching FROM map skips `handleChartTypeChange` → map→bar/line/pie leaves X empty (Save disabled), map→table no dimension, map→number/table save map-only fields | type-switch-matrix TS-create map → * |
| 🟠 | Number/pivot → bar/line/pie (both builders): X empty, Save disabled (unset dimension overwrites the prefilled one) | type-switch-matrix |
| 🟠 | Any → table takes dimension from auto-prefill (`id`), not the source dimension (both builders) | type-switch-matrix |
| 🟠 | Edit: every switch resets styling to target defaults (keeps only tooltip/legend/labels on-off, titles, raw label position); legend "bottom" → "top" | type-switch-matrix-edit |
| 🟠 | Edit: bar/line → map keeps 2 metric rows though map takes 1 | type-switch-matrix-edit |
| 🟠 | Edit: table → others maps dimension/aggregate (or state/value) from the table's column list → `id` / `country` | type-switch-matrix-edit |
| 🟡 | → number: request still sends `aggregate_func:"count"` next to the kept SUM metric | type-switch-matrix |
| 🟡 | Full per-transition behavior tables | see `TYPE-SWITCH-BEHAVIOR.md` |
| 🔴 | **Remove all metrics then switch type: Save stays enabled but backend 422s** (bar/line/pie/table) | perm-fill-order (d) |
| 🟠 | Round trip A→B→A is lossy: via pie drops metric #2; table returns grouped by `id`; bar/line/pie via number/map lose X (Save disabled); pivot returns empty | perm-roundtrip · see BUILDER-PERMUTATIONS.md |
| 🟠 | Edit round trips reset all styling to defaults (orientation, lineStyle, colorScheme, numberSize, pivot theme, table freeze/zebra; pie legend right→top) | perm-roundtrip (edit) |
| 🟠 | Dataset change on a **table** blanks dims + metrics with no re-prefill, and still saves the old dataset's `table_columns` | perm-dataset-change |
| 🟠 | Dataset change on a **map** clears state column + metric, not refilled → Save disabled | perm-dataset-change |
| 🟠 | Create pie → map: `legendPosition:'right'` carried into map → save 422 | perm-prefill-switch |
| 🟡 | Edit line → map uses `date` as the geographic column; passing through table adds `x_axis_column` + `table_columns` to saved payload | perm-roundtrip (edit) |
| 🟠 | bar→line then save persists bar-only customizations (`orientation`…) | type-switch |
| 🟠 | Create vs edit builders differ: default agg `count` vs `sum`, legend defaults, preview page size 20 vs 25 | edit.spec.ts C-E7 |
| 🟠 | Map filters don't reach builder map preview (overlay request sends no filters) | builder-map |
| 🟠 | Map drill hierarchy built in UI mislabelled (district saved as `region_type:'state'`) → toast "Drilling down to state in Rajasthan" | builder-map / detail |
| 🟠 | Detail "excluded by filter" toast unreachable — checks `'!='`, builder writes `not_equals` | builder-map |
| 🟠 | Edit round-trip of UI-created drill map saves a single layer; re-picking district converts to 2 | builder-map |
| 🟠 | Table with dimension but no metric shows raw rows (156) instead of grouped (6) | builder-table |
| 🟠 | Table last drill level renders clickable but click does nothing | builder-table |
| 🟠 | **Bar/line detail page rounds fractional Y-axis labels to integers** — saved `yAxisDecimalPlaces: null` passes a `!== undefined` check → `toFixed(null)` (builder shows 0.1…0.6, detail shows 1,1,0,0) | `components/charts/chart-types/echarts/formatting.ts` ~318 `applyLineBarChartFormatting` · metrics-matrix-a MM-bar-2 / MM-line-2 / MM-line-3 |
| 🟠 | Pivot shows calculated ratios with 0 decimals by default (0.49 → "0"); table shows full precision for same metric | `PivotTableChart.tsx` `formatCell` · metrics-matrix-b MM-pivot-2 |
| 🟡 | Number chart defaults `decimalPlaces: 0` → ratio 0.503 renders "1" | `configure/page.tsx:114` · metrics-matrix-a MM-number-2/3 |
| 🟡 | Table/pivot data requests always send `aggregate_func: "count"` regardless of metrics; table save `table_columns` is a stale raw-column list; map overlay sends metric alias as `"value"`, saved `value_column` null for calculated/saved | metrics-matrix-b baselines |
| 🟠 | **Edit page: drilling into a table whose saved sort is on the top dimension fails** — backend 500 "must appear in the GROUP BY clause" → "Table configuration needs a small adjustment" (detail page drills the same chart fine) | charts/interactions-gaps.spec.ts [pinned] IG-charts edit table drill-down with a saved sort |
| 🟡 | Detail CSV filename has timestamp twice (`title-TS-TS.csv`) | detail.spec.ts |
| 🟡 | Pivot CSV always writes "Grand Total", ignores custom label | detail.spec.ts |
| 🟡 | Number chart "Chart Data" sub-tab says "Data preview isn't ready yet…" | builder-shared C-B5 |
| 🟡 | Map region click in create builder without drill level → info toast; edit builder → nothing | builder-map |
| 🟡 | Radix select can't re-pick an already-default value (legend corner, Blues) | builder-map |
| 🟠 | **Stacked bar total labels render blank** — backend returns bar values as strings, `stacked-bar-utils` counts non-numbers as 0 | `components/charts/chart-types/echarts/stacked-bar.ts` · gaps-builder |
| 🟠 | **Charts can't be made Public** — backend sends `supports_public=false` (no Public option in share modal) | gaps-edit-detail |
| 🟠 | Browser "leave page?" (beforeunload) fires with no user edits (auto-prefill = dirty) | gaps-builder |
| 🟠 | Edit bar → table resets dimension to first text column (`id`) instead of keeping X axis | edit page `handleFormChange` · gaps-builder |
| 🟠 | Old saved map legend positions "right"/"top" map to corners in the dropdown but preview still draws bottom-left | MapPreview · gaps-map-table-pivot |
| 🟠 | Turning table drill-down off never asks for confirmation — dialog needs `hasLevelScopedRules` prop no page passes | TableDimensionsSelector · gaps-map-table-pivot |
| 🟠 | Edit-builder map preview ignores chart filters (detail page sends them) | edit page · gaps-map-table-pivot |
| 🟡 | Save-failure toasts always show raw backend detail — friendly fallback text unreachable (`lib/api.ts` passes detail through) | gaps-edit-detail |
| 🟡 | Edit data preview resets to 25 rows on row-limit change, but 25 isn't a dropdown option → shows blank | edit page · gaps-map-table-pivot |
| 🟡 | Detail filtered-map toast says "filtered" for excluded regions (`not_equals` vs `!=`/`not equals`) | ChartDetailClient · gaps-map-table-pivot |
| 🟡 | Pivot chart type shows the bar icon in the chart list (no pivot entry in `chartIcons`) | app/charts/page.tsx · gaps-list |

## Dashboards

| Sev | Behavior | Where / test |
|---|---|---|
| 🔴 | **Embed code dropdown never renders** — `GET /api/dashboards/<id>/` doesn't return `public_share_token` | view.spec.ts D-V8 |
| 🔴 | **Numerical filter default 0–100 applied** — data range ~470k–1.1M → Apply without touching returns 0 rows | filters.spec.ts D-F2 |
| 🔴 | **"Show only shared" list filter always empty** — list API lacks `is_public` | list.spec.ts D-L3 |
| 🟠 | Datetime filters save numerical-shaped settings (`ui_mode`, `default_min/max`, `step`) | filters.spec.ts D-F3 |
| 🟠 | Builder KPIs ignore dashboard filters | filters.spec.ts D-F8 |
| 🟠 | Builder PUTs dashboard immediately on open (autosave on mount) | builder.spec.ts D-B4 |
| 🟠 | Legacy `/public/dashboard/<token>` loads forever | share-dashboard.public D-S5 |
| 🟠 | Public CSV filename `chart_<id>-<ts>.csv` instead of title (reads private metadata) | share-dashboard.public D-S2 |
| 🟠 | Chart title: hide→show saves original as override; Cancel (X) still saves (blur first) | builder.spec.ts D-B11 |
| 🟠 | Browser unload unlock beacon posts to relative URL on Next server → locks leak until expiry | (harness works around) |
| 🟡 | Tab delete dialog says "cannot be undone" but Undo restores | tabs.spec.ts D-T4 |
| 🟡 | Esc in image caption commits instead of cancelling | builder-text D-B8 |
| 🟡 | Duplicate dashboard toast says `Chart "X" duplicated` | list.spec.ts D-L5 |
| 🟡 | After Cancel in delete dialog, row menu stays open and blocks clicks | list.spec.ts |
| 🟡 | Empty filtered dashboard list hides header; counter shows unfiltered total | list.spec.ts |
| 🟡 | Same user in two tabs isn't blocked by own lock | builder.spec.ts D-B14 |
| 🔴 | **KPI with no metric crashes the whole dashboard edit page** ("Something went wrong!") — KPI list fetched on builder mount, `kpi.metric.name` unguarded | kpi-selector-modal · gaps-widgets |
| 🔴 | **Public dashboard crash takes down the page** — its own error boundary is defined but unused; global error screen shows | PublicDashboardView · gaps-public |
| 🟠 | "No charts → go create one" redirect can never fire — builder expects plain array, API returns paginated object | builder · gaps-widgets |
| 🟠 | Filter keyboard reorder announced ("press space") but does nothing — key listeners on non-focusable handle | filter-element · gaps-filters |
| 🟠 | Filter create/update failure is silent — modal closes, typed values lost, no toast | builder · gaps-filters |
| 🟠 | Unknown dashboard id falls back to Superset "Error Loading Dashboard" even with no Superset | app/dashboards/[id]/page.tsx · gaps-view |
| 🟠 | Hiding the tab releases the lock, sends a stray unlock to the Next server, and never re-acquires on return | builder / edit page · gaps-lock-share |
| 🟡 | Mobile filter accordion "N applied" counts unset filters | responsive-filters-section · gaps-filters |
| 🟡 | "Filter needs attention" unreachable — try/catch wraps JSX creation, not render | dashboard-filter-widgets · gaps-filters |
| 🟡 | Autosave after Undo/Redo fires when the 1s hold lifts (not at the 5s debounce) | builder · gaps-builder |

## Reports

| Sev | Behavior | Where / test |
|---|---|---|
| 🔴 | **Create race** — Generate while "Discovering date columns…" creates report with no `date_column`/`period_end` | create.spec.ts R-C3 |
| 🔴 | **Chart comment icon never shows state** — looks up `chart_id`, state has `target_id` (KPI works) | comments.spec.ts R-M2 |
| 🟠 | Cancel doesn't reset create form (old name/date column shown, picker input empty) | create.spec.ts R-C3 |
| 🟠 | Deleting only row on last page → "2 of 1", "11–10 of 10", no-match row | list.spec.ts R-L3 |
| 🟠 | Reports list: the 400 ms filter debounce also fires on mount and resets to page 1 → an early "Next" bounces back (same pattern as the chart list pagination bug) | reports/interactions-gaps.spec.ts (test retries the click) |
| 🟡 | Esc in @mention dropdown closes whole comment popover | comments.spec.ts R-M3 |
| 🟡 | Public security notice uses lowercased title instead of "report" | share.spec.ts R-S1 |
| 🟡 | Sort ties fall back to server order | list.spec.ts |
| 🔴 | **Failed report list load looks like "No reports yet"** (`isError` never read) | app/reports/page.tsx · gaps-list |
| 🔴 | **KPI comment deep links from emails don't open** — viewer ignores `commentTarget=kpi` | viewer · gaps-comments |
| 🟠 | Typed start date bypasses the max-date limit (only the calendar enforces it) | create-snapshot-dialog · gaps-create-viewer |
| 🟠 | Own KPI comment stays unread — post-submit mark-read sends `chart_id` | comment-popover · gaps-comments |
| 🟠 | Deep-link auto-open never marks the thread read | viewer · gaps-comments |
| 🟠 | Report Public option not limited by the source dashboard's sharing (backend applies it to charts/KPIs only) | gaps-share |

## Staging backend (not frontend — report to backend team)

| Sev | Behavior |
|---|---|
| 🔴 | `GET /api/warehouse/column-values/…` → 500 `'PostgresClient' object has no attribute 'engine'` — filter value dropdowns fall back to text boxes (tests stub it) |
| 🟠 | `POST /api/charts/chart-data-preview/` for map filter values → 500 "At least one metric is required" |

## Unreachable UI (dead-code candidates for the refactor)

31 interactive elements can't be reached in the app today (dead branches, props never passed, hard-coded values) — full list with file:line in [INTERACTIONS.md](INTERACTIONS.md) → "Untouched". Highlights: chart Y-axis selector (`ChartDataConfiguration.tsx:636`), table header sort (`onSort` never passed), table dimension-remove / drill-off confirmations (props never passed), dashboard list card + list view modes (`viewMode` hard-coded), dashboard filter date-picker footer buttons, share-modal legacy email section (`onShareViaEmail` never passed), map country select (hard-coded disabled), mobile "Edit Dashboard" (renders only at ≥1200px inside a header hidden at ≥1024px).

## Crash risks on malformed backend data (audit 2026-10-06 — not yet covered by tests)

Not pinned (no `[pinned]` test asserts them yet). A read-only audit of the refactored code found render-time throws when a backend response is missing a key, has `null`, or has an unexpected type. Today **every one of these replaces the whole app** with `app/global-error.tsx` ("Something went wrong!") — there is no route-level `error.tsx`, `components/error-boundary.tsx` is unused, and `PublicDashboardView.tsx` defines a boundary but never wraps anything with it. All existed before the refactor. Full evidence (file:line + expression): `.superpowers/sdd/crash-audit.md` (local).

**Goal:** an error message is acceptable; a white screen is not.

### Whole-page crashes (thrown above any widget — need a guard)

| Sev | Trigger | Where | Likelihood |
|---|---|---|---|
| 🔴 | Dashboard `target_screen_size` is `"a4"` or any unknown value → `SCREEN_SIZES[x]` undefined → `.cols` throws | `dashboard-native-view.tsx` (`effectiveScreenConfig.cols`), `builder/useBuilderCanvasSize.ts`, `logic/editor-state.ts` | **High** — A4 was offered in the UI 2025-08-14 → 08-28; backend still accepts it |
| 🔴 | Dashboard filter without `id` / `null` entry in `filters[]` → `filter.id.toString()` | `filters/filter-config.ts`, callers in the view + `widgets/view-widgets.tsx` | Medium (also listed under Dashboards) |
| 🔴 | KPI with `metric: null` → `kpi.metric.name` | `widgets/kpi/kpi-selector-modal.tsx` | Medium (also listed under Dashboards) |
| 🔴 | `layout_config` not an array / `null` tab | `view/DashboardViewGrid.tsx`, `view/useViewTabs.ts`, `tabs/tab-utils.ts` (builder normalizes with `Array.isArray`, the view doesn't) | Low–medium |
| 🔴 | Report snapshot without `report_metadata` / `dashboard_data` | `app/reports/[snapshotId]/page.tsx`, `PublicReportView.tsx`, `print-layout.tsx` | Low |
| 🟠 | Unparseable date string → date-fns `RangeError` | `components/reports/utils.ts`, `view/ViewHeaderFull.tsx`, `view/ViewHeaderCompact.tsx`, `charts/list/ChartListRow.tsx`, `dashboard/list/DashboardListRow.tsx`, `superset-dashboard-view.tsx` (outside its own boundary) | Low (a `null` `period_end` renders "Jan 1st, 1970" — see R-C3) |

### Widget-level throws (one widget is broken, but today it takes the page)

| Sev | Trigger | Where |
|---|---|---|
| 🔴 | Pivot response without `cells` / `metric_headers` (only `data` is checked) | `widgets/chart/ChartViewBody.tsx`, `widgets/chart/BuilderChartBody.tsx`, `charts/detail/ChartDetailBody.tsx` → `pivot-table/cellsToGrid.ts` (`ChartPreview.tsx` guards it correctly) |
| 🟠 | `null` entry in `series` / `xAxis` / `yAxis` — option built in an effect before the `try` | `widgets/chart/useViewChartLifecycle.ts` |
| 🟠 | Series with missing/unknown `type`; no `try` around builder `setOption` | `widgets/chart/useBuilderChartInstance.ts` |
| 🟠 | Text / chart widget with `config: null` | `widgets/text/text-element-unified.tsx`, `lib/chart-title-utils.ts` |
| 🟠 | KPI: `periods` not an array; numeric-string `current_value` + `decimalPlaces`; malformed `echarts_config` (no `try` around `setOption`) | `widgets/kpi/kpi-chart-element.tsx`, `lib/formatters.ts`, `kpis/kpi-card.tsx` |
| 🟡 | Datetime filter default stored as a full ISO datetime | `datetime-filter-widget.tsx` |
| 🟡 | Table `sort` not an array; `decimalPlaces` negative or > 100; column with `null` `data_type` in the metric picker; non-iterable `filters` on chart detail | `table/TableChart.tsx`, `table/table-cells.ts`, `logic/metric-columns.ts`, `logic/saved-chart-payload.ts` |

### Plan (separate PR after the refactor)

1. Route-level `error.tsx` for `app/charts`, `app/dashboards`, `app/reports`, `app/share`, `app/public` (retry + Sentry, no stack on public pages); delete the unused boundary in `PublicDashboardView.tsx`.
2. A per-widget error boundary (`react-error-boundary` is already a dependency) around each dashboard view cell, builder cell and print-layout item → a bad chart/KPI shows an error card, the rest of the dashboard keeps working.
3. Guards where the throw is above any widget: unknown screen size → desktop; skip filters without `id`; normalize layout/tabs in the view like the builder; one safe date helper (`—`); one shared pivot-shape check; move chart option building inside the existing `try`.
4. One Playwright test per row: `page.route()` the endpoint, change one field, assert an error message instead of a white screen.
