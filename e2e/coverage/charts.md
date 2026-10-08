# Charts — E2E coverage inventory

I've inventoried the charts area. All paths below are relative to `/Users/himanshut4d/Documents/Tech4dev/Dalgo/webapp_v2/`, and "L" means line number. I read everything and ran nothing, so behaviour notes come from the code, not from using the app.

## 0. Findings that affect how you write the tests

1. **Some chart components are never used by the app.** These are only imported by tests or by other unused files:
   - `components/charts/ChartBuilder.tsx` (deleted in R0)
   - `ChartFiltersConfiguration.tsx`, `ChartSortConfiguration.tsx`, `ChartPaginationConfiguration.tsx`
   - `TableConfiguration.tsx`, `SimpleTableConfiguration.tsx` (imported by `ChartDataConfiguration` but never rendered)
   - `ChartExport.tsx`, `MiniChart.tsx`, `WorkInProgress.tsx`
   - `map/LayerConfiguration.tsx`, `map/MultiSelectLayerCard.tsx`
   - `types/map/MapChartCustomizations.tsx` (deleted in R0; the pages render `map/MapCustomizations.tsx` for maps instead)
   - `types/table/ColumnAlignmentSection.tsx` (deleted in R0), `ColumnOrderSection.tsx` (replaced by `ColumnSettingsSection`)
   - `StaticChartPreview.tsx` is only used by `components/dashboard/widgets/chart/chart-selector-modal.tsx`.
2. **The builder is written out twice.** `app/charts/new/configure/page.tsx` (create) and `app/charts/[id]/edit/page.tsx` (edit) each have their own copy of `getDefaultCustomizations`, `isChartDataReady`, `isFormValid`, the payload builder and the table drill-down handlers, and the copies differ (details in §5). Test create and edit as separate flows.
3. **There is no standalone public or shared chart page.** Public routes are `app/share/dashboard/[token]`, `app/share/report/[token]` and `app/public/dashboard/[token]`. Charts only appear there inside dashboards. The one public-mode path in charts code is `ChartExportDropdown`'s `isPublicMode` CSV branch.
4. **The list page filters and sorts on the client, one page at a time.** `useCharts` sends only `page` and `page_size`. The backend accepts `search` and `chart_type`, but the UI never sends them. So name/type/source/date filters and column sort only act on the 10–100 rows of the current page, while the "x–y of N" counter shows the server total.
5. **Most comboboxes have no stable selector.** `components/ui/combobox.tsx:313` builds ids and test ids from `id || combobox-${useId()}`. Only comboboxes that get an explicit `id` are reliable: `metric-saved-${i}` and `pivot-${row|col}-dimension-${i}`, which produce `-input`, `-listbox`, `-item-${value}` and `-chevron` test ids. Every other combobox (dataset, X axis, extra dimension, filter column and value, sort, table dimensions, map columns) needs a role, placeholder or label selector.
6. There's already a Playwright setup: `playwright.config.ts` and `e2e/` (only `login.spec.ts` plus `e2e/helpers`).

---

## 1. Routes

| Route | File | Notes |
|---|---|---|
| `/charts` | `app/charts/page.tsx` | List page |
| `/charts/new` | `app/charts/new/page.tsx` | Step 1: pick dataset and type. `?from=dashboard` changes Back and Cancel behaviour |
| `/charts/new/configure?schema=&table=&type=[&from=dashboard]` | `app/charts/new/configure/page.tsx` | Create builder |
| `/charts/[id]` | `app/charts/[id]/page.tsx` → `ChartDetailClient.tsx` | View page. `?from=dashboard\|report` changes Back label and history handling. `?openShare=true` opens the share modal (`hooks/useOpenShareDeepLink.ts:23`) |
| `/charts/[id]/edit[?from=dashboard\|report]` | `app/charts/[id]/edit/page.tsx` | Edit builder |

---

## 2. Chart list page (`app/charts/page.tsx`)

| Feature | Where | Existing test ids / ids | API | Notes |
|---|---|---|---|---|
| Load list | L134–141 | `#charts-list-container` | `GET /api/charts/?page=&page_size=` | `useCharts` in `hooks/api/useCharts.ts:38` |
| Loading skeleton | L1213–1288 | none | – | Table of 8 skeleton rows |
| Error state | L1091–1101 | none | – | Text "Failed to load charts" and a Retry button that calls `window.location.reload()` |
| Empty state | L1432–1453 | `#charts-empty-state`, `#charts-empty-text`, `charts-empty-create-btn` | – | Shows "No charts found" when filters are active, otherwise "No charts yet". The create button needs `CAN_CREATE_CHARTS` |
| Header and Create button | L1106–1128 | `charts-create-btn`, `#charts-create-button`, `#charts-page-title` | – | Needs `CAN_CREATE_CHARTS`. Title is wrapped in `DocsLink` |
| Sort: Name, Data Source, Type, Last Modified | L160, L1298–1401 | none | – | Clicking the same column toggles asc/desc. Clicking a new column sorts desc. Default is `updated_at` desc. Sort resets to page 1 (L1065) |
| Filter: Name text and "Show only favorites" | L622–662 | checkbox `#favorites` | – | Client-side, case-insensitive |
| Filter: Data Source multi-select with search | L672–729 | none | – | Values are `schema.table`. Empty text: "No data sources found" |
| Filter: Chart Type multi-select | L732–774 | none | – | Options come only from types present on the current page |
| Filter: Date modified | L777–859 | radio ids `all`/`today`/`week`/`month`/`custom` | – | Custom range shows From/To date inputs |
| Filter active dot, "N filter(s) active", Clear all | L606–619, L1192–1207 | none | – | Every popover also has its own Clear button |
| Favorite star (optimistic) | L268–301, L883–898 | none | `POST` / `DELETE /api/charts/{id}/favorite/` | Flips immediately, rolls back and shows a toast on error. Button is disabled while its request is in flight |
| Title link | L902–907 | none | – | Goes to `/charts/{id}`, or `#` without `CAN_VIEW_CHARTS`. Tooltip shows the full title |
| Created by | L949–968 | `chart-created-by-{id}` | – | Falls back to "Unknown" |
| Last modified | L971–975 | none | – | `formatDistanceToNow` |
| Type icon and tooltip | L928–946 | none | – | Colours from `components/charts/chart-types/registry.ts` (R1a; the duplicate `ChartType` export was deleted) |
| Edit icon | L980–986 | none | – | Only when `access_level==='edit'`. Goes to `/charts/{id}/edit` |
| Share icon and ShareModal | L987–996, L1543–1551 | inside the modal: `share-modal`, `share-submit-btn`, `share-close-btn`, `copy-link-btn`, `general-access-select`, … | `/api/access/chart/{id}/grants`, `/candidates`, `/general-access` (PATCH), `/transfer-ownership`, `/request-access` | Only when `access_level==='edit'`. Modal is `components/share/ShareModal.tsx` with `rtype="chart"` |
| Row menu (⋮) → Select/Deselect | L997–1012 | none | – | Enters selection mode with this row selected |
| Row menu → Duplicate | L402–470, L1013–1029 | none | `POST /api/charts/` | Needs `CAN_CREATE_CHARTS`. Title becomes "Copy of X", then "Copy of X (2)", … (`generateDuplicateTitle` L366). Titles are only checked against the current page. Copies `extra_config` as is. Shows a spinner while running |
| Row menu → Export (submenu) | `ChartExportDropdownForList.tsx` | none | see §10 | Needs `CAN_VIEW_CHARTS` |
| Row menu → Delete and confirm dialog | L343–364, L1037–1055; `ChartDeleteDialog.tsx` | none | `GET /api/charts/{id}/dashboards/` (loads when the dialog opens), `DELETE /api/charts/{id}/` | Needs `CAN_DELETE_CHARTS`. Dialog lists the dashboards using the chart (links to `/dashboards/{id}`) or says "✓ This chart is not used in any dashboards". Buttons: CANCEL and "DELETE CHART" / "DELETING…" |
| Selection mode bar | L1131–1189 | row checkboxes `chart-select-checkbox-{id}`, `#charts-selection-bar`, `#charts-exit-selection-button` | – | "N of M charts selected". Select All is disabled when everything is selected, Deselect All when nothing is |
| Bulk delete | L515–575 | none | `POST /api/charts/bulk-delete/ {chart_ids}`; falls back to `DELETE /api/charts/{id}/` for each id | Needs `CAN_DELETE_CHARTS`. Confirmation text differs for 1 chart vs several (several lists the titles). Exits selection mode on success |
| Pagination footer | L1458–1539 | `#charts-page-size-trigger`, `#charts-page-size-{10,20,50,100}`, `#charts-prev-page-button`, `#charts-next-page-button`, `#charts-page-info`, `#charts-pagination-info` | Re-fetches with the new page | Changing page size resets to page 1. If the current page no longer exists after deletes, it clamps to the last page (L1080) |

---

## 3. Create flow, step 1 (`app/charts/new/page.tsx`)

| Feature | Where | Test ids | API | Notes |
|---|---|---|---|---|
| Permission gate | L97–113 | none | – | Without `CAN_CREATE_CHARTS`: "Access Denied" / "You don't have permission to create charts." and "Back to Charts" |
| Back | L173–190 | `chart-new-back-button` | – | With `from=dashboard` it calls `router.back()`, otherwise links to `/charts` |
| Dataset picker | L208–215; `components/charts/DatasetSelector.tsx` | wrapper `chart-dataset-selector` only (inner combobox id is auto-generated) | `GET /api/warehouse/sync_tables?fresh=1` (after the warehouse hook resolves) | Opens with focus. Errors: "Failed to load datasets. Please try refreshing." and "Set up a warehouse before selecting a dataset." Empty messages: "No datasets found" / "No datasets available" |
| Chart type cards (7) | L27–84, L228–285 | grid `chart-type-grid`, cards have `role="radio"` with no test id | – | Bar, Pie, Line, Number, Map, Table, Pivot Table. Enter and Space select. Tooltip shows a description |
| Continue | L117–138, L296–304 | `chart-type-continue-button` | – | Disabled until schema, table and type are all set. Uses `router.replace` when coming from a dashboard |
| Cancel | L159–165, L293 | none | – | Goes back if from a dashboard, otherwise to `/charts` |
| Onboarding walkthrough | L143–157 | – | – | `useInsightWalkthroughStore` stages `chart_pick_type` → `chart_continue` |

---

## 4. Create builder (`app/charts/new/configure/page.tsx`)

| Feature | Where | Test ids | API | Notes |
|---|---|---|---|---|
| Initial state | L182–191 | – | – | Title defaults to "Bar chart - {table} {timestamp}" etc. Table and pivot get the generic "Chart - …" (L137–155). Defaults: `aggregate_function:'count'`, per-type customizations from `getDefaultCustomizations` (L70) |
| Auto-prefill | L669–689, plus again inside `ChartDataConfiguration` L298 | – | `GET /api/warehouse/table_columns/{schema}/{table}` | `generateAutoPrefilledConfig` (`lib/chartAutoPrefill.ts:33`) |
| Back | L1188–1205 | `chart-create-back-button` | – | Label is "Back to Dashboard" when from a dashboard. With unsaved changes, opens the unsaved dialog; otherwise goes to `/charts/new` |
| Chart name input | L1208–1221 | `#chart-name` (no test id) | – | Includes the `DashboardNameHint` popover |
| Save Chart | L1009–1149, L1225–1233 | `chart-edit-save-button` (same test id as the edit page) | `POST /api/charts/` | Disabled while `!isFormValid()` or while saving ("Saving..."). Success toast "Chart created", then goes to `/charts/{id}`, or replaces history with `?from=dashboard`. Error goes through `toastError.api(error,'save chart')` |
| Left tabs: Data Configuration / Chart Styling | L1243–1317 | `chart-config-tabs`, `chart-data-config-tab`, `chart-styling-tab` | – | Map uses `MapDataConfiguration` and `MapCustomizations`; everything else uses `ChartDataConfiguration` and `ChartCustomizations` |
| Right tabs: CHART / DATA | L1322–1334 | none | – | – |
| CHART tab preview | L1336–1455 | see §9 | see §9 | Map: `MapPreview`. Table: `TableChart` with breadcrumb. Others: `ChartPreview` |
| DATA tab: Chart Data / Raw Data | L1459–1530 | none | `POST /api/charts/chart-data-preview/?page=&limit=`, `POST …/total-rows/`, `GET /api/warehouse/table_data/{s}/{t}?page=&limit=`, `GET /api/warehouse/table_count/{s}/{t}` | Table and pivot open on Raw Data by default. Pivot's Chart Data sub-tab shows the pivot itself |
| Unsaved-changes guard | L267–290, L1151–1179, L1539 | none | – | `beforeunload` prompt plus `UnsavedChangesExitDialog`: SAVE AND LEAVE, LEAVE WITHOUT SAVING, STAY ON PAGE. The dialog is only opened by Back; there is no Cancel button on this page |
| Walkthrough | L195–199, L1102–1123 | – | – | After save, sets a pending celebration that the detail page shows |

---

## 5. Edit builder (`app/charts/[id]/edit/page.tsx`)

| Feature | Where | Test ids | API | Notes |
|---|---|---|---|---|
| Load chart | L156, L263–357 | – | `GET /api/charts/{id}/` | Turns saved `layers` back into simplified map fields (L229) and table `dimensions`/`dimension_columns` into form state. Pivot goes through `buildPivotExtraConfig` |
| Access denied | L1556–1572 | none | – | When `chart.access_level !== 'edit'`: "You don't have edit access to this chart." |
| Loading | L1574–1588 | none | – | Skeleton |
| Error / not found | L1590–1606 | none | – | Alert shows "Chart needs attention" (error) or "Chart not found" |
| Back | L1615–1652 | `chart-edit-back-button` | – | Label is "Back", "Back to Dashboard" or "Back to Report". With unsaved changes it opens a `ConfirmationDialog` ("Leave Without Saving" / "Cancel"), not the three-option dialog |
| Title input | L1655–1660 | none (no id either) | – | – |
| Cancel | L1519–1527, L1664–1672 | `chart-edit-cancel-button` | – | With unsaved changes opens `UnsavedChangesExitDialog`; otherwise goes back or to `/charts/{id}` |
| Save → SaveOptionsDialog | L1510–1517, L2004; `components/charts/SaveOptionsDialog.tsx` | `chart-edit-save-button` (the dialog has none) | – | Step "choose": UPDATE EXISTING CHART / SAVE AS NEW CHART. Step "name": `#new-title` pre-filled with the current title, BACK, "CREATE NEW CHART" (disabled when the name is blank) |
| Update existing | L1411–1463 | – | `PUT /api/charts/{id}/` | Toast "Chart updated". Goes to the detail page (history replace when opened from a dashboard or report), or back to the origin if this was save-and-leave |
| Save as new | L1466–1507 | – | `POST /api/charts/` | Toast `Chart "X" created`, then goes to the new chart's page |
| Save and leave | L1530–1539 | – | – | Opens the save options dialog, then navigates to the origin |
| Config-incomplete overlay | L691–719, L1770–1794 | none | – | Destructive alert "Please check the dataset or metric column to complete the chart configuration ✕ Click to dismiss". Not shown for map or table. Comes back when key fields change |
| Last-good preview | L670–674, L1906 | – | – | While a new config is invalid, the preview keeps showing the last valid chart. Error display is suppressed (`error={null}`) |
| Chart-type switch mapping | L953–1088 | – | – | map↔bar/line/pie/number and table↔others carry columns across. Keeps `showTooltip`, `showLegend`, `showDataLabels`, axis titles, subtitle and `dataLabelPosition` |
| Data-preview reset | L721–725 | – | – | Page size goes back to 25 whenever `pagination` changes |

Ways create and edit differ, each worth a paired test:

| Behaviour | Create | Edit |
|---|---|---|
| Default customizations | Bar/line have no `legendDisplay`/`legendPosition`; pie legend is `right` | `legendDisplay:'paginated'`, `legendPosition:'top'`; map adds `showLabels:false` |
| Default aggregate | `count` | `sum` |
| Data preview page size | 20 | 25 |
| Left tabs | Have test ids, and are controlled so the walkthrough can switch them | No test ids, uncontrolled |
| Table data-ready check | Needs a dimension or valid metrics | Always true |
| Table total rows | Calls `useChartDataPreviewTotalRows` separately for the table | Reuses the chart-data total |
| Map preview filters | Payload is built with `chart_filters` | Always sends `chart_filters: []` |
| Map region click without drill config | Info toast "Configure drill-down levels to enable region drilling"; success toast "✨ Drilling down to X districts!" | Does nothing |
| Save flow | Saves immediately | Save options dialog |

---

## 6. Shared data configuration (`components/charts/ChartDataConfiguration.tsx`)

| Control | Where | Shown for | Test ids | API | Notes |
|---|---|---|---|---|---|
| Chart type switcher (7 icon buttons) | L522; `ChartTypeSelector.tsx` | all | none (buttons have `title=` the type name) | – | Switch logic at L376–517: keeps or trims metrics (number, pie and map keep only the first), resets pivot `extra_config`, clears `dataLabelPosition` values that don't fit the new type (`sanitizeCustomizationsForChartType`). Description text shown below |
| Data Source (change dataset) | L529–538 | all | none | `GET /api/warehouse/sync_tables?fresh=1` | Changing dataset resets every data field and keeps title, type and customizations (L253–292) |
| X Axis / Dimension column | L541–566 | bar, line, pie | none | columns | Label is "Dimension" for pie. Items show a column-type icon |
| Table dimensions | L569–596; `TableDimensionsSelector.tsx` | table | none | – | See §8.6 |
| Pivot row and column dimensions | L599–607 | pivot | see §8.7 | – | – |
| Time Grain | L610–624; `TimeGrainSelector.tsx` | bar and line with a date/timestamp X axis | none | – | None/Year/Month/Day/Hour/Minute/Second. Hour/min/sec are disabled for date-only columns (tooltip "Not available for date columns"). Cleared automatically if the X axis stops being a date or the type changes (L357) |
| Y Axis | L627–667 | none in practice | – | – | The render condition can never be true |
| Metrics | L670–719 | all except map (map has its own) | see §7 | – | Pie and number allow one metric; number also mirrors it into `aggregate_column`/`aggregate_function` |
| Extra Dimension | L722–753 | bar, line, pie | none | – | "None" plus columns other than the X axis. Placeholder says "stacked bar" for bar, "multi-line chart" for everything else (pie included) |
| Data Filters | L756–879 | all except map (map has its own) | `remove-filter-{i}` only | `GET /api/warehouse/column-values/{s}/{t}/{col}` (cached 5 minutes) | Operators: equals, not_equals, >, >=, <, <=, like, like_case_insensitive, in, not_in, is_null, is_not_null. Value input changes with the case: null operators show nothing; in/not_in show a multi-combobox (first 100 values) or a comma-separated text box; date columns show a DatePicker (`yyyy-MM-dd`); columns with values show a combobox; otherwise a debounced text input. Changing the column clears the value and records `data_type`. "+ Add Filter" has no test id |
| Pivot totals toggles | L882–890 | pivot | see §8.7 | – | – |
| Pagination (row limit) | L893–930 | bar, line, pie, table | none | – | No pagination / 20 / 50 / 100 / 200 items |
| Sort | L933–1079 | bar, line, pie, table | none | – | One level only. Column combobox lists the dimension (COL badge) and metric aliases (METRIC badge); direction select is Asc/Desc (disabled until a column is picked). Shows "Configure metrics first to enable sorting" when nothing is sortable. Clears automatically when its column disappears (L332) |

---

## 7. Metrics (`MetricsSelector.tsx`, `MetricAccordionItem.tsx`)

| Feature | Where | Test ids | API | Notes |
|---|---|---|---|---|
| Saved-metric library list | MetricsSelector L105 | – | `GET /api/metrics/?schema_name=&table_name=&page_size=50` | – |
| + ADD ANOTHER METRIC | MS L154, L265–275 | `add-metric-button` | – | Adds COUNT(*) named "Total Count" and expands it. Hidden once the max is reached (pie, number, map: 1) |
| Accordion header | MAI L262–303 | `metric-trigger-{i}`, `metric-library-icon-{i}` | – | Shows the alias and a summary, e.g. `SUM(col)` or the first 40 characters of the expression. The new-chart flow expands prefilled non-library metrics automatically |
| Remove metric | MAI L292 | `remove-metric-{i}` | – | – |
| Tabs: Simple / Calculated / Saved | MAI L306–317 | none | – | Moving to Simple detaches from the library and resets to COUNT if it was an expression. Moving to Calculated detaches from the library |
| Simple: Function select | MAI L352–371 | `metric-agg-{i}` | – | Count, Sum, Average, Min, Max, Count Distinct. Label is "Metric" on pie |
| Simple: Column combobox | MAI L372–396 | none | – | Count adds "* (Count all rows)". Non-count functions disable non-numeric columns (`getAvailableColumns`). Label is "Dimension" on pie |
| Calculated: Expression | MAI L399–423 | `metric-expr-{i}` | `POST /api/metrics/validate/` | Validates 500 ms after typing stops, and on blur. Shows "Validating expression...". Errors from the server or "Invalid expression" / "Validation failed". Stale responses are ignored |
| Saved: pick from library | MAI L319–348 | `metric-saved-{i}-input`, `-item-{id}` | – | Metrics already used in other rows are hidden. Empty messages: "No saved metrics yet" / "No metrics match your search" |
| Display Name In Charts | MAI L239–259 | `metric-alias-{i}` | – | Hidden for number charts. Follows the definition until the user types their own name (debounced 500 ms). Clearing it goes back to auto-naming |
| Add metric to library | MAI L431–473 | none | `POST /api/metrics/` | Simple and Calculated tabs only. "Metric Name *" field and "ADD METRIC TO LIBRARY" button (disabled when blank or saving). Success toast `Saved metric "X"`; the row flips to the Saved tab |

---

## 8. Per chart type

### 8.1 Bar (`chart-types/echarts/BarChartCustomizations.tsx`)

- **Data:** X axis, time grain, metrics (several), extra dimension (stacked or grouped), filters, pagination, sort.
- **Save needs:** a dimension and valid metrics.

| Styling option | Line | Element id | Condition |
|---|---|---|---|
| Orientation: Vertical / Horizontal | 42–57 | radios `#vertical`, `#horizontal` | – |
| Stacked Bars | 59–69 | `#stacked` | Only with an extra dimension. Stacked totals come from `components/charts/chart-types/echarts/stacked-bar.ts` |
| Show Tooltip on Hover | 71–79 | `#showTooltip` | – |
| Show Legend | 81–89 | `#showLegend` | – |
| Legend Display: Paginated / Show All | 94–115 | `#bar-paginated`, `#bar-all` | Legend on. Two back-to-back updates here means the default `legendPosition` may be lost |
| Legend Position: top/bottom/left/right | 117–134 | `#barLegendPosition` | Legend on. Dropdown shows `right` when unset |
| Show Data Labels | 143–151 | `#showDataLabels` | – |
| Data Label Position: Top / Middle(`inside`) / Bottom(`insideBottom`) | 153–171 | `#dataLabelPosition` | Labels on |
| X-Axis Title | 179–187 | `#xAxisTitle` | Debounced |
| X Label Rotation: 0° / 45 / 90° | 190–205 | `#xAxisLabelRotation` | Create defaults to 45 |
| X Number Format and Decimals | 208–217 | test ids `xAxisNumberFormat`, `xAxisDecimalPlaces` | Numeric X axis |
| X Date Format | 220–227 | `#xAxisDateFormat` | Date X axis |
| Y-Axis Title and Rotation | 234–261 | `#yAxisTitle`, `#yAxisLabelRotation` | – |
| Y Number Format and Decimals | 263–272 | test ids `yAxisNumberFormat`, `yAxisDecimalPlaces` | Always. Applies to axis, labels and tooltip |

### 8.2 Line (`chart-types/echarts/LineChartCustomizations.tsx`)

- **Data:** same as bar (the extra dimension makes it multi-line).

| Option | Line | Element id | Notes |
|---|---|---|---|
| Line Style: Smooth / Straight | 40–55 | `#smooth`, `#straight` | – |
| Show Tooltip, Show Data Points, Show Legend | 57–85 | `#showTooltip`, `#showDataPoints`, `#showLegend` | – |
| Legend Display and Position | 87–132 | `#line-paginated`, `#line-all`, `#lineLegendPosition` | – |
| Data Labels and Position: Above/Below/Left/Right | 139–168 | `#showDataLabels`, `#dataLabelPosition` | – |
| X/Y axis title, rotation, number and date format | 172–270 | same as bar | – |

### 8.3 Pie (`chart-types/echarts/PieChartCustomizations.tsx`)

- **Data:** dimension, one metric, extra dimension, filters, pagination, sort.

| Option | Line | Element id | Notes |
|---|---|---|---|
| Show Legend, Legend Display, Position | 38–93 | `#showLegend`, `#paginated`, `#all`, `#legendPosition` | – |
| Chart Style: Donut / Full Pie | 101–116 | `#donut`, `#pie` | – |
| Show Tooltip | 118–126 | `#showTooltip` | – |
| Slice Limit: All / Top 3 / 5 / 10 | 134–155 | `#maxSlices` | The rest are grouped as "Other" |
| Show Data Labels | 162–170 | `#showDataLabels` | On by default |
| Label Format: percentage / value / name_percentage / name_value | 175–191 | `#labelFormat` | Labels on |
| Label Position: Outside / Inside | 194–208 | `#dataLabelPosition` | – |
| Number Format and Decimals | 217–224 | test ids `pieNumberFormat`, `pieDecimalPlaces` | – |
| Date Formatting | 228–244 | `#pieDateFormat` | When the dimension or extra dimension is a date; shows the column name |

### 8.4 Number / KPI (`chart-types/echarts/NumberChartCustomizations.tsx`)

- **Data:** one metric only. No filters are hidden, but pagination and sort are hidden. The display name field is hidden.
- **Save needs:** a valid metric.

| Option | Line | Element id |
|---|---|---|
| Number Size: small / medium / large | 27–46 | `#small`, `#medium`, `#large` |
| Subtitle | 48–60 | `#subtitle` |
| Number Format and Decimals | 67–74 | test ids `numberNumberFormat`, `numberDecimalPlaces` |
| Prefix / Suffix | 81–103 | `#numberPrefix`, `#numberSuffix` |

Number, pie and map formatting keys (`numberFormat`, `decimalPlaces`, `dateFormat`) are removed from the API payload by `getApiCustomizations` (`lib/chart-payload-utils.ts:35`) and applied in the browser (`applyNumberChartFormatting`).

### 8.5 Map (`map/MapDataConfiguration.tsx`, `map/DynamicLevelConfig.tsx`, `map/MapCustomizations.tsx`, `map/MapPreview.tsx`)

| Feature | Where | Test ids | API | Notes |
|---|---|---|---|---|
| Type switcher and dataset | MDC L273–289 | none | – | Changing dataset resets map fields, sets aggregate to `sum` and country to IND |
| Metric (one) | MDC L292–310 | as §7 | – | Mirrors into `value_column`/`aggregate_column`/`aggregate_function` |
| Filters | MDC L313–406 | none (not even remove ✕) | `POST /api/charts/chart-data-preview/?page=0&limit=500` (raw rows, used for distinct values) | No date picker here |
| Map Configuration section | MDC L409–430 | none | – | Only appears once there is a valid metric |
| Country (IND only, disabled) | DLC L335–346 | none | – | – |
| State column | DLC L349–398 | none | `GET /api/charts/regions/?country_code=IND` (twice), `GET /api/charts/regions/{countryId}/geojsons/` | Changing it resets the GeoJSON, district and hierarchy. The default GeoJSON (`is_default`) is picked automatically (L239) |
| Download States / Districts CSV | DLC L355–383, L410–437 | none | `GET {API_BASE_URL}/api/charts/regions/export-names/?country_code=&region_type=` (`lib/csvUtils.ts:63`) | Shows "Downloading..." while running, then a success or error toast |
| District column (optional drill-down) | DLC L401–462 | none | – | Shown when the region hierarchy has more than one level. Options: "No drill-down" plus columns. Writes `geographic_hierarchy` and legacy `district_column` |
| Loading state | DLC L319–330 | none | – | "Loading Geographic Levels..." |
| Styling: Color Scheme (Blues/Reds/Greens/Purples/Oranges/Greys) | MapCustomizations L40–65 | none | – | – |
| Show Tooltip / Show Legend / Enable Selection | L67–106 | none | – | "Enable Selection" (`select`) is never read by `MapPreview`, so it does nothing |
| Number Format and Decimals | L114–120 | test ids `mapNumberFormat`, `mapDecimalPlaces` | – | Used in the tooltip |
| Label for No Data | L122–136 | none | – | Default "No Data" |
| Legend Position (4 corners) | L146–175 | none | – | Old values left/right/top/bottom are mapped to corners |
| Show Region Names | L177–186 | none | – | – |
| Preview: GeoJSON and data overlay | `MapPreview.tsx` | none | `GET /api/charts/geojsons/{id}/`, `POST /api/charts/map-data-overlay/` | When every region has the same value, the scale is widened around it (L175). Legend hides in very small containers |
| Zoom + / − | MP L925–938 | none (`title="Zoom In/Out"`) | – | Zoom range 0.5–10× |
| Drill-down breadcrumb: Home, per level, Back, "Level N" badge | MP L857–905 | none | `GET /api/charts/regions/{id}/geojsons/`, `GET /api/charts/regions/{id}/children/` | Resolved by `resolveDrillDownGeoJSON` (`lib/map-drilldown-utils.ts:23`) |
| Map states | MP L808–851, L942–961 | none | – | "Loading map boundaries...", error alert "Map configuration needs a small adjustment…", empty "Configure your map to see a preview", overlays "Loading data..." and "Data needs attention: …" |

Map save requires a geographic column, a GeoJSON id and a valid metric. The edit page turns simplified district/ward/subward fields into `layers` (L1288).

### 8.6 Table (`components/charts/chart-types/table/*`)

| Feature | Where | Test ids | Notes |
|---|---|---|---|
| Dimensions list with drag-and-drop reorder | TDS L316–333 | none (drag handles have aria-label "Drag to reorder") | Needs more than one dimension to drag. There is always at least one empty slot |
| Dimension combobox | TDS L108–125 | none | Placeholder "Select dimension" |
| Remove dimension | TDS L164–174 | none (`title="Remove dimension"`) | Disabled when only one is left |
| ADD DIMENSION(s) | TDS L343–353 | none | Adds the first unused column. Disabled when every column is used |
| Drill Down switch | TDS L300–312 | `#drill-down-toggle` | Applies to all dimensions. Shows the order hint "Drill-down will follow the order: a → b" |
| Warnings about conditional formatting when reordering or removing dimensions | TDS L356–408 | none | The pages never pass the props these need (`hasLevelScopedRules`, `scopedRuleCountByLevel`), so they can't appear in the app |
| Metrics / filters / pagination / sort | shared §6/§7 | – | A table can be saved with only dataset and title |
| Freeze first column | TCC L192–208 | `freeze-column-switch` | – |
| Column formatting (reorder and alignment Auto/Left/Center/Right) | TCC L211–221; `ColumnSettingsSection.tsx` | `alignment-{col}` | Saved as `customizations.columnOrder`. With drill-down, only the currently shown dimension is listed |
| Number formatting per numeric column | TCC L224–296 | `column-row-{col}`, `remove-format-{col}`, `table-{col}NumberFormat`, `table-{col}DecimalPlaces` | "No numeric columns to format." when there are none. Formats for columns that no longer exist are removed (ChartCustomizations L191) |
| Date formatting per date column | TCC L299–376 | `table-date-column-toggle-{col}`, `table-date-column-reset-{col}` | "No date columns to format." |
| Conditional formatting | `ConditionalFormattingSection.tsx` | `add-formatting-rule-btn`, `formatting-rule-{i}`, `delete-rule-{i}`, `rule-column-{i}`, `rule-level-{i}`, `rule-operator-{i}`, `rule-value-{i}`, `rule-color-{i}`, `color-swatch-{0..6}`, `rule-scope-hint-{i}`, `conditional-formatting-info` | Numeric operators `> < >= <= == !=`; text operators `== !=` (exact match, case-sensitive). Changing column type resets the rule. Level scope appears for metric columns when drill-down is on. The last matching rule wins |
| Appearance: theme Gray/Blue, Zebra rows | `AppearanceSection.tsx` | `theme-selector`, `theme-option-{gray\|blue}`, `zebra-rows-switch` | Zebra is on by default for tables |
| Render: search | `TableSearchBar.tsx` | `table-search-bar`, `table-search-input`, `table-search-count`, `table-search-clear-btn` | Escape clears. Only searches the rows on the current page. Match colour `#fde68a` |
| Render: URL cells shown as "Link" | TableChart L491–526 | none | `http(s)://` or `www.` (the latter gets `https://`) |
| Render: drill-down cells | TableChart L488–568 | none | The dimension cell is blue and clickable. Clicking adds an `equals` filter and resets to page 1. A "← Back" breadcrumb appears above the table in create (L1360), edit (L1817) and detail (L951) |
| Render: server pagination | TableChart L581–716 | none (buttons have sr-only "First page" / "Previous page" / "Next page" / "Last page") | Page sizes 10/20/50/100/200. Text "Showing x to y of N rows", "Page p of n" |
| Render: states | TableChart L366–416 | none | "Loading table data...", "Table configuration needs a small adjustment…", "No data available / Configure your table to display data", "No columns configured" |
| Header click-to-sort | TableChart L357 | – | No page passes `onSort`, so this never works in the app |
| API | – | – | `POST /api/charts/chart-data-preview/?page=(0-based)&limit=`, `POST /api/charts/chart-data-preview/total-rows/` |

### 8.7 Pivot table (`pivot-table/*`)

| Feature | Where | Test ids | Notes |
|---|---|---|---|
| Row Dimensions (at least 1) | PDC L89–113; `PivotDimensionList.tsx` | `add-row-dimension-btn`, `remove-row-dim-{i}`, `pivot-row-dimension-{i}-input` | Drag to reorder. A column can't be used twice. Info tooltip |
| Column Dimensions (0 or more) | PDC L116–140 | `add-col-dimension-btn`, `remove-col-dim-{i}`, `pivot-col-dimension-{i}-input` | – |
| Show Row Subtotals and label | PDC L147–203 | `pivot-show-row-subtotals`, `pivot-row-subtotal-display-name` | Needs 2+ row dimensions; turned off automatically when fewer |
| Show Column Subtotals and label | PDC L205–260 | `pivot-show-column-subtotals`, `pivot-column-subtotal-display-name` | Needs 2+ column dimensions |
| Grand Total — Rows (right-hand column) and label | PDC L263–319 | `pivot-show-row-grand-total`, `pivot-row-grand-total-display-name` | Needs 1+ column dimension |
| Grand Total — Columns (bottom row) and label | PDC L322–378 | `pivot-show-column-grand-total`, `pivot-column-grand-total-display-name` | – |
| Metrics (several) and filters | shared | – | No pagination or sort for pivots |
| Styling: per-metric number formatting | PTC L142–220 | `pivot-column-row-{m}`, `pivot-remove-format-{m}`, `pivot-{m}NumberFormat`, `pivot-{m}DecimalPlaces` | Keyboard accessible (Enter/Space) |
| Styling: date formatting per date dimension | PTC L223–243 | `pivot-date-formatting`, `pivot-date-format-{col}` | Display only |
| Styling: conditional formatting, theme, zebra | PTC L246–260 | as §8.6 | Zebra is off by default for pivots. Only numeric rules |
| Freeze first column | PTC L263–279 | `pivot-freeze-column-switch` | – |
| Render | `PivotTableChart.tsx` | `pivot-table-chart`, `pivot-table`, `pivot-row-{i}`, `pivot-grand-total-row`, `pivot-table-empty` | Nested column headers, merged row cells, sticky total column when there is one metric, search, "N/A" for nulls. Builder shows "Configure your pivot table" when there is no data |
| API | – | – | `POST /api/charts/chart-data/` with row/column dimensions and totals at the top level of the payload (`buildPivotDataFields`) |
| Save needs | – | – | 1+ row dimension and 1+ valid metric |

---

## 9. Preview (non-map, non-table): `ChartPreview.tsx`

- **Data:** `POST /api/charts/chart-data/` (`useChartData`, 2 s dedupe), which returns `echarts_config`.
- **States:**
  - L336: "Loading chart..."
  - L349: an error renders empty space (the page shows the error instead)
  - L355–371: "Configure your chart to see a preview / Select data source and columns to get started"
- **Browser-side transforms applied, in order:**
  1. `applyLegendPosition`
  2. `createTooltipFormatter`
  3. `applyNumberChartFormatting`
  4. `applyPieChartFormatting` / `applyPieDateFormatting`
  5. `applyLineBarChartFormatting` / `applyLineBarDateFormatting`
  6. `applyStackedBarLabels`
- **DataPreview (DATA tab):** `DataPreview.tsx`.
  - States: "Loading data...", "Data preview isn't ready yet…", "No data to preview / Select a table to see data".
  - Pagination: first/prev/next/last, and "Rows per page" 10–200.
  - No test ids.

---

## 10. Detail / view page (`app/charts/[id]/ChartDetailClient.tsx`)

| Feature | Where | Test ids | API | Notes |
|---|---|---|---|---|
| Permission gate | L771–787 | none | request isn't sent without permission | Without `CAN_VIEW_CHARTS`: "Access Denied / You don't have permission to view charts." |
| Loading / error | L789–808 | none | `GET /api/charts/{id}/` | Error text "Chart isn't ready yet. Please check your settings or try again later." No retry on 404 |
| Back | L815–832 | `chart-detail-back-dashboard` (from dashboard/report), otherwise `chart-detail-back-link` and `chart-detail-back-button` | – | – |
| Title, "Created by" | L833–838 | `chart-detail-created-by` | – | – |
| Edit Chart | L841–852 | `chart-detail-edit-link` | – | Only when `access_level==='edit'`. Keeps `?from`; replaces history when opened from a dashboard or report |
| Share | L853–862, L1069–1077 | `chart-detail-share-button`, `share-modal` | see §2 | `?openShare=true` opens it automatically |
| Request edit pill | L895–899 | `request-edit-pill` | `/api/access/chart/{id}/request-access` | Shown to view-only users |
| Export dropdown | L863–894; `ChartExportDropdown.tsx` | none | see §11 | Button label becomes "Export current view" when a table drill-down is active, and the drill values are added to the filename |
| Preview by type | L909–1044 | pivot empty "No data available", error "Failed to load pivot table data" | `POST /api/charts/chart-data/`; table: `…/chart-data-preview/` and `…/total-rows/`; map: `…/map-data-overlay/`, `…/geojsons/{id}/`, `…/regions/?country_code=IND&region_type=state`, `…/regions/{id}/geojsons/` | Map overlay does send the saved chart filters here (L428) |
| Map drill-down | L530–754 | none | – | Three configs are supported: dynamic `geographic_hierarchy`, legacy district/ward/subward columns, and legacy `layers`. Toasts: "🗺️ Drilling down to …", "Region "X" not found in database", "No further drill-down levels configured", "X excluded by filter", "X not configured for drill-down" (with an Edit Chart action for editors) |
| Filtered-map-empty toasts | L453–496 | – | – | One toast per filter spaced 500 ms apart, then a hint "💡 Configure drill-down layers…" |
| Table drill-down | L250–342 | none | – | Same logic as the builder |
| Celebration modal | L1054–1067 | `chart-live-modal` (via `testId` prop) | – | Walkthrough only: "Congratulations, your Chart is live!" with an "Add to Dashboard" button |

---

## 11. Export and download matrix

| Entry point | Chart type | Formats | Implementation | API |
|---|---|---|---|---|
| Detail (`ChartExportDropdown`) | bar/line/pie/number | PNG, PDF (with org logo), and "Export Data as CSV" | `ChartExporter.exportEChartsWithBranding`, CSV via `apiPostBinary` and file-saver | `GET /api/org/logo/`, `POST /api/charts/download-csv/` (public mode: `POST /api/v1/public/dashboards/{token}/charts/{id}/download-csv/`) |
| Detail | map | PNG, PDF, CSV | same | same |
| Detail | table | PNG (`exportTableWithBranding` on the DOM), CSV (server stream) | – | `/api/charts/download-csv/` |
| Detail | pivot | PNG (DOM), CSV built in the browser (`exportPivotAsCSV` → `exportPivotAsCsv`) | – | none for CSV |
| List (`ChartExportDropdownForList`, submenu) | bar/line/pie/number | PNG, PDF (renders off-screen at 1200×800, no logo) | `handleRegularChartExport` L92 | `GET /api/charts/{id}/data/` |
| List | map | PNG, PDF | `lib/map-export-handler.ts` | `GET /api/charts/{id}/`, `GET /api/charts/geojsons/{id}/`, `POST /api/charts/map-data-overlay/` |
| List | table | CSV only | `handleTableCSVExport` L197 (up to 10,000 rows) | `GET /api/charts/{id}/`, `POST /api/charts/chart-data-preview/` |
| List | pivot | CSV only | `handlePivotCSVExport` L171 | `GET /api/charts/{id}/`, `POST /api/charts/chart-data/` |

**Toasts:**
- Detail: "Preparing CSV download...", "CSV downloaded successfully", "Chart exported as PNG/PDF", "Table exported as PNG", "Export Failed".
- List: `toastSuccess.exported` / `toastError.export`.

**Edge cases:**
- The pivot CSV always writes "Subtotal" and "Grand Total", ignoring custom labels (`chart-types/pivot-table/utils.ts:306,329`).
- The list page has no PNG option for table or pivot charts.

---

## 12. Permissions (`lib/rbac.tsx:124–128`)

| Check | UI effect |
|---|---|
| `CAN_CREATE_CHARTS` | Create buttons on the list and empty state, Duplicate menu item, and access to `/charts/new` |
| `CAN_VIEW_CHARTS` | Title link on the list (otherwise `#`), Export submenu on the list, access to the detail page |
| `CAN_DELETE_CHARTS` | Delete menu item and bulk delete button |
| `CAN_EDIT_CHARTS` / `'can_edit_charts'` | Only changes toast wording and the "Edit Chart" toast actions on the detail page |
| `CAN_SHARE_CHARTS` | Not used anywhere in the charts area |
| `chart.access_level === 'edit'` (per chart) | Edit and Share icons on the list, Edit and Share on the detail page, and access to the edit page |
| `RequestEditPill` | Shown for `access_level === 'view'` |

---

## 13. Validation, empty and error messages (for assertions)

- **Save button disabled rules (`isFormValid`):**
  - Title, type, schema and table are always required.
  - Number: a valid metric.
  - Map: geographic column, GeoJSON and a valid metric.
  - Table: nothing more.
  - Pivot: a row dimension and valid metrics.
  - Bar/line/pie: a dimension and valid metrics, where a valid metric is an expression, `count`, or a function with a column.
- **Messages:**
  - Metric expression: "Invalid expression", "Validation failed", or the server's message.
  - Sort: "Configure metrics first to enable sorting".
  - Table dimensions: "No dimensions configured…" (can't actually be reached).
  - Conditional formatting: "No columns available for formatting.", "No rules defined…", scope hints.
  - Save failures: `toastError.api` (create), `toastError.update` / `toastError.create` (edit).

---

## 14. API endpoint catalogue used by the charts UI

| Group | Endpoints |
|---|---|
| CRUD | `GET/POST /api/charts/`, `GET/PUT/DELETE /api/charts/{id}/`, `POST /api/charts/bulk-delete/`, `POST/DELETE /api/charts/{id}/favorite/`, `GET /api/charts/{id}/dashboards/`, `GET /api/charts/{id}/data/` |
| Data | `POST /api/charts/chart-data/`, `POST /api/charts/chart-data-preview/?page=&limit=[&dashboard_filters=]`, `POST /api/charts/chart-data-preview/total-rows/`, `POST /api/charts/download-csv/` |
| Map | `POST /api/charts/map-data-overlay/`, `GET /api/charts/geojsons/{id}/`, `GET /api/charts/regions/?country_code=[&region_type=]`, `GET /api/charts/regions/{id}/children/`, `GET /api/charts/regions/{id}/geojsons/`, `GET /api/charts/regions/export-names/` |
| Warehouse | `GET /api/warehouse/sync_tables?fresh=1`, `GET /api/warehouse/table_columns/{s}/{t}`, `GET /api/warehouse/column-values/{s}/{t}/{c}`, `GET /api/warehouse/table_data/{s}/{t}?page=&limit=`, `GET /api/warehouse/table_count/{s}/{t}` |
| Metrics | `GET /api/metrics/?…`, `POST /api/metrics/`, `POST /api/metrics/validate/` |
| Other | `GET /api/org/logo/`, `/api/access/chart/{id}/…` |
| Report snapshot variants (dashboards/reports only) | `/api/reports/{snap}/charts/{id}/table-data/`, `…/total-rows/`, `…/map-data/` |
| Defined in hooks but not called by any page | `GET /api/charts/geojsons/?…`, `/hierarchy/`, `/available-layers/`, `POST /api/charts/export/`, `/map-data/` |

For Playwright `route()` mocks: chart-data and map-overlay requests are POSTs whose SWR cache key includes the body. The map overlay URL key embeds the JSON payload (`hooks/api/useChart.ts:496`).

---

## 15. Chart types registry location

There's no single registry despite what `.claude/rules/charts.md` says. Type lists are defined separately in each of these places:

- `types/charts.ts:1` — `ChartTypes` enum (bar, line, pie, table, number, map, pivot_table)
- `components/charts/chart-types/registry.ts` (R1a; the duplicate `ChartType` export was deleted) — colours per type
- `app/charts/new/page.tsx:27` — cards with names and descriptions ("Number")
- `components/charts/ChartTypeSelector.tsx:15` — a second list ("Big Number", different order)
- `app/charts/page.tsx:83` — `chartIcons` (has no pivot entry, so it falls back to BarChart2)
- `ChartCustomizations.tsx:280` — switch statement choosing each type's styling panel
- `components/charts/chart-types/echarts/formatting.ts:526` — `DATA_LABEL_POSITIONS`
- `lib/chart-size-constraints.ts:45` — `CHART_SIZE_CONSTRAINTS` (dashboard sizing)

---

## 16. Pure functions to pin with Jest characterization tests

| Function | Location | Existing test? |
|---|---|---|
| `generateAutoPrefilledConfig` | `lib/chartAutoPrefill.ts:33` | yes (`lib/__tests__/chartAutoPrefill.test.ts`) |
| `mergeTableColumnFormatting`, `getApiCustomizations`, `resolveTableColumnOrder` | `lib/chart-payload-utils.ts:11,35,77` | yes (`__tests__/lib/chart-payload-utils.test.ts`) |
| `formatAxisValue`, `createTooltipFormatter`, `createPieDimensionFormatter`, `applyNumberChartFormatting`, `applyPieChartFormatting`, `applyLineBarChartFormatting`, `createPieDateFormatter`, `applyPieDateFormatting`, `applyLineBarDateFormatting`, `sanitizeCustomizationsForChartType` | `components/charts/chart-types/echarts/formatting.ts:43–543` | yes (partial) |
| `getLegendConfig`, `getPieSeriesPosition`, `applyLegendPosition`, `extractLegendPosition`, `isLegendPaginated` | `components/charts/chart-types/echarts/legend.ts:31–222` | **no** |
| `createStackedTotalFormatter`, `applyStackedBarLabels` | `components/charts/chart-types/echarts/stacked-bar.ts:21,53` | yes |
| `resolveDrillDownGeoJSON` | `lib/map-drilldown-utils.ts:23` | yes |
| `transformMapDataOverlayPayload` (and the private `buildSimple…` / `buildCalculated…` helpers) | `hooks/api/useChart.ts:413–466` | **no** |
| `applyPivotDateFormat`, `resolvePivotTotals`, `buildPivotDataFields`, `buildPivotExtraConfig`, `getPivotRenderProps`, `computePivotDateFormats`, `pruneStaleFormatting`, `calculateRowSpans`, `exportPivotAsCsv` | `components/charts/chart-types/pivot-table/utils.ts` | partial (`date-formats.test.ts`); CSV, row spans and prune untested |
| `cellsToGrid` | `chart-types/pivot-table/cellsToGrid.ts:92` | yes |
| `computeHeaderSpans`, and the inline `formatCell` / `getConditionalColor` | `PivotTableChart.tsx:55,156,180` | no (would need extracting first) |
| `getMetricAnalyticsProps`, `isDrillDownEnabled`, `getUsedSavedMetricIds`, `getNewlyUsedSavedMetricIds` | `components/charts/utils.ts:47–96` | **no** |
| `getAvailableColumns` (exported) | `MetricsSelector.tsx:52` | via component tests |
| `summaryOf`, `autoLabel` (not exported) | `MetricAccordionItem.tsx:56,65` | no |
| `isValidUrl`, `normalizeUrl`, and the inline `formatCellValue` / `getConditionalColor` / `getAlignmentClass` | `TableChart.tsx:36,47,172,238,300` | via `TableChart.test.tsx` |
| `useTableSearch` | `components/charts/hooks/useTableSearch.ts:26` | only via the pivot search test |
| `deepEqual` (drives unsaved-changes detection), `generateDuplicateTitle` | `lib/form-utils.ts:5,40` | **no** |
| Inline copy of `generateDuplicateTitle` (duplicate of the one above) | `app/charts/page.tsx:366` | no |
| `formatNumber`, `formatDate`, `NumberFormats` | `lib/formatters.ts` | yes |
| `parseWidgetNavigationSource`, `getChartViewUrl`, `getChartEditUrl`, `getWidgetBackLabel` | `lib/widget-navigation.ts` | yes |
| `statesToCsv`, `districtsToCsv` | `lib/csvUtils.ts:22,36` | no |
| `ChartExporter.*`, `generateFilename` | `lib/chart-export.ts` | yes (`__tests__/lib/chart-export.test.ts`) |
| `getDefaultCustomizations` (two differing copies), `generateDefaultChartName`, `isChartDataReady`, `isFormValid`, the `chartDataPayload` memo | `configure/page.tsx:70,137,293,922,396`; `edit/page.tsx:77,450,1197,539` | **no.** Extract these before the refactor; they're the main candidates |
| `convertLayersToSimplified`, `convertSimplifiedToLayers`, `buildChartData`, chart-type switch in `handleFormChange` | `edit/page.tsx:229,1288,1329,953` | **no** |
| `handleChartTypeChange`, `handleDatasetChange` | `ChartDataConfiguration.tsx:376,253` | via component test |
| Table drill-down click and drill-up reducer (three copies) | configure L780/L837, edit L1101/L1159, detail L250/L310 | **no** |
| Map region-click resolver | `ChartDetailClient.tsx:530` | no |
| `getRegionTypeHierarchy`, `updateLevel` | `map/DynamicLevelConfig.tsx:108,177` | via component test |
| Colour and value-range logic (`lightenColor`, single-value range, `escapeHtml`) | `MapPreview.tsx:57,175,210` | no |

---

## 17. Interactive elements without a `data-testid`

- **List page (`app/charts/page.tsx`):**
  - Favorite star (L883), title link (L902), Edit icon (L982), Share icon (L988), ⋮ trigger (L999)
  - Menu items Select/Deselect (L1004), Duplicate (L1016), Delete (L1046)
  - Sort buttons ×4 (L1298/1329/1360/1392) and filter popover triggers ×4 (L1315/1346/1377/1409)
  - Inside the popovers: name search input, Clear buttons, data-source search, source and type checkbox rows, custom date inputs
  - Select All and Deselect All (L1152/1160), bulk Delete (L1173), "Clear all" (L1197), Retry (L1096)
  - The ids `#charts-exit-selection-button`, `#charts-prev-page-button` etc. exist, but they are ids, not test ids
- **Delete dialog (`ChartDeleteDialog.tsx`):** CANCEL, DELETE CHART, dashboard links.
- **Bulk-delete confirmation (`useConfirmationDialog`):** its buttons.
- **ChartExportDropdownForList:** submenu trigger and items.
- **`/charts/new`:** each chart-type card and the Cancel button.
- **Configure:** chart name input (`#chart-name` only), CHART/DATA tabs, Chart Data/Raw Data tabs, table drill "← Back", unsaved dialog's 3 buttons (`UnsavedChangesExitDialog.tsx`).
- **Edit:** title input, both tab lists, error overlay, SaveOptionsDialog buttons (UPDATE EXISTING, SAVE AS NEW, back arrow, BACK, CREATE NEW CHART; the input only has `#new-title`), ConfirmationDialog buttons.
- **Detail:** Export trigger and PNG/PDF/CSV items (`ChartExportDropdown.tsx:200–266`), table drill "← Back".
- **ChartTypeSelector:** all 7 buttons (`title` attribute only).
- **ChartDataConfiguration:**
  - Dataset, X axis, extra dimension, filter column, filter value and sort comboboxes (all get auto-generated ids)
  - Operator select (L808), date picker, "+ Add Filter" (L861), pagination select (L918), sort direction select (L1060)
  - TimeGrainSelector select
- **MetricAccordionItem:** Simple/Calculated/Saved tabs (L308–316), Column combobox, "Add metric to library" toggle (L433), Metric Name input (L447), ADD METRIC TO LIBRARY (L455).
- **TableDimensionsSelector:** drag handles, dimension comboboxes, remove X, ADD DIMENSION(s), drill switch (`#drill-down-toggle`), "Remove anyway" / "Cancel", drill-off confirmation.
- **PivotDimensionList and PivotDataConfiguration:** drag handles, info tooltip buttons.
- **MapDataConfiguration:** all filter controls including remove ✕ and Add Filter.
- **DynamicLevelConfig:** Country select, State column combobox, District combobox, Download States/Districts buttons.
- **Styling panels:** every radio, switch, select and input in Bar, Line, Pie and Number customizations (they have element ids only). MapCustomizations controls have neither ids nor test ids. Only `NumberFormatSection` provides test ids. `DateFormatSection` triggers have ids only.
- **TableChart and DataPreview:** first/prev/next/last page buttons (sr-only text), page-size selects, "Link" anchors, drill-down cells.
- **MapPreview:** zoom +/− (`title` only), breadcrumb Home / level / Back.
- **ColumnSettingsSection:** drag handles (aria-label only).
- **PivotTableCustomizations:** date format select triggers.