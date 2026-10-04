# Feature checklist — charts · dashboards · reports

> **Refactor rule:** a PR may only merge when every box in the areas it touched is ticked and `npm run e2e` + `npm run e2e:inventory:verify` pass.

How to use this file: every line is one thing a user can do or see. After your refactor, check that it still works and tick the box `[x]`. Where a line is ✅ or 🐞, the named test verifies it for you. Where it is ⚠️ or ❌, check it by hand. Where it is 🧑, follow the steps in [MANUAL-CHECKS.md](MANUAL-CHECKS.md). The gap list at the end has a recommendation for each of those.

**Legend:** ✅ covered · 🐞 covered, but the test asserts today's buggy behaviour (see [PINNED-BUGS.md](PINNED-BUGS.md)) · ⚠️ partially covered · ❌ not covered · 🧑 manual check (see [MANUAL-CHECKS.md](MANUAL-CHECKS.md))

**Test references** are `path under e2e/ › test id or shortened title`. A test that loops over options (for example one test per chart type, operator or legend corner) is expanded here, so each option gets its own line.

Sources: [charts.md](charts.md), [dashboards.md](dashboards.md), [reports.md](reports.md), [MATRIX.md](MATRIX.md), [PINNED-BUGS.md](PINNED-BUGS.md), and every spec in `e2e/charts`, `e2e/dashboards`, `e2e/reports`, `e2e/cross` and `e2e/smoke`.

## Summary

| Area | ✅ | 🐞 | ⚠️ | ❌ | 🧑 | Total |
|---|---|---|---|---|---|---|
| Charts | 665 | 225 | 0 | 0 | 2 | 892 |
| Dashboards | 212 | 25 | 0 | 0 | 7 | 244 |
| Reports | 92 | 12 | 1 | 0 | 2 | 107 |
| Cross-area navigation | 8 | 0 | 0 | 0 | 0 | 8 |
| **All features** | **977** | **262** | **1** | **0** | **11** | **1251** |



Functions & logic: **87** entries. **53** have a Jest test, **32** are only covered indirectly through E2E (⚠️ E2E only, no Jest test), and **2** have no test at all.

---

## Charts

### Chart list (`/charts`)

- [ ] Page loads with the "Charts" heading, subtitle and CREATE CHART button — ✅ charts/list.spec.ts › C-L1 loads
- [ ] Rows are sorted newest-modified first by default — ✅ charts/list.spec.ts › C-L1 loads
- [ ] Counter shows "1–10 of N" and page info shows "1 of P" — ✅ charts/list.spec.ts › C-L1 loads
- [ ] Row shows title, data source (schema.table), creator email and a relative "… ago" time — ✅ charts/list.spec.ts › C-L1 seeded row
- [ ] Row shows the chart-type icon with a tooltip — 🐞 charts/gaps-list.spec.ts › GAP-C list row type icon + tooltip for every chart type (pinned inline: pivot_table falls back to the bar icon)
- [ ] Loading skeleton while the list loads — ✅ charts/gaps-list.spec.ts › GAP-C list loading skeleton while the list request is in flight
- [ ] Error state "Failed to load charts" with Retry — ✅ charts/gaps-list.spec.ts › GAP-C list error state "Failed to load charts" and Retry reloads
- [ ] Sort by Name (desc, then asc) — ✅ charts/list.spec.ts › C-L2 sort
- [ ] Sort by Data Source (desc, then asc) — ✅ charts/list.spec.ts › C-L2 sort
- [ ] Sort by Type (desc, then asc) — ✅ charts/list.spec.ts › C-L2 sort
- [ ] Sort by Last Modified (desc, then asc) — ✅ charts/list.spec.ts › C-L2 sort
- [ ] Clicking a new sort column starts descending — ✅ charts/list.spec.ts › C-L2 sort
- [ ] Changing the sort goes back to page 1 — ✅ charts/list.spec.ts › C-L2 sort resets to page 1
- [ ] Filter by name (case-insensitive substring) — ✅ charts/list.spec.ts › C-L3 name text
- [ ] Filter "Show only favorites" — ✅ charts/list.spec.ts › C-L3 favorites
- [ ] Filter by data source (multi-select with search; "No data sources found"; untick removes rows) — ✅ charts/list.spec.ts › C-L3 data source
- [ ] Filter by chart type (multi-select; only types on the current page are offered) — ✅ charts/list.spec.ts › C-L3 chart type
- [ ] Date modified filter: Today — ✅ charts/list.spec.ts › C-L3 date modified
- [ ] Date modified filter: Last 7 days — ✅ charts/list.spec.ts › C-L3 date modified
- [ ] Date modified filter: Last 30 days — ✅ charts/list.spec.ts › C-L3 date modified
- [ ] Date modified filter: Custom range (From / To) — ✅ charts/list.spec.ts › C-L3 date modified
- [ ] Date modified filter: All (resets) — ✅ charts/list.spec.ts › C-L3 date modified
- [ ] Teal "active" dot on a filtered column header — ✅ charts/gaps-list.spec.ts › GAP-C list teal active dot on a filtered column header
- [ ] "N filter(s) active" summary with correct count and plural — ✅ charts/list.spec.ts › C-L4
- [ ] Clear button inside each filter popover (name, type, date, source) — ✅ charts/list.spec.ts › C-L4
- [ ] "Clear all" resets every filter — ✅ charts/list.spec.ts › C-L4
- [ ] Filters and sort only act on the current page, while the counter shows the server total — 🐞 charts/list.spec.ts › [pinned] C-L5 (filters are client-side, one page at a time)
- [ ] Empty filtered list hides the table header, so only "Clear all" can undo the filter — 🐞 charts/list.spec.ts › [pinned] C-L14
- [ ] Empty state "No charts found" with a CREATE YOUR FIRST CHART button that goes to /charts/new — ✅ charts/list.spec.ts › [pinned] C-L14
- [ ] Empty state "No charts yet" for an org with no charts — ✅ charts/gaps-list.spec.ts › GAP-C list empty state "No charts yet" (list response mocked empty)
- [ ] Favorite star on (POST), persists after reload — ✅ charts/list.spec.ts › C-L6
- [ ] Favorite star off (DELETE), persists after reload — ✅ charts/list.spec.ts › C-L6
- [ ] Favorite failure rolls the star back and shows a toast — ✅ charts/gaps-list.spec.ts › GAP-C list favorite failure rolls the star back and shows a toast
- [ ] Title link opens the chart detail page — ✅ charts/list.spec.ts › C-L7
- [ ] Edit icon opens the edit page — ✅ charts/list.spec.ts › C-L7
- [ ] Duplicate creates "Copy of X" and shows a success toast — ✅ charts/list.spec.ts › C-L8
- [ ] Duplicate again creates "Copy of X (2)" — ✅ charts/list.spec.ts › C-L8
- [ ] Duplicating a copy creates "Copy of X (3)" — ✅ charts/list.spec.ts › C-L8
- [ ] Delete an unused chart: dialog says "not used in any dashboards", Cancel keeps it, DELETE CHART removes it with a toast — ✅ charts/list.spec.ts › C-L9 delete unused
- [ ] Delete dialog lists the dashboards that use the chart, with links — ✅ charts/list.spec.ts › C-L9 lists dashboards; cross/navigation.spec.ts › X-3
- [ ] Row menu "Select" enters selection mode; the item flips to "Deselect" — ✅ charts/list.spec.ts › C-L10 selection mode
- [ ] Row checkboxes and the "N of M charts selected" bar — ✅ charts/list.spec.ts › C-L10 selection mode
- [ ] Select All and Deselect All, each disabled when it has nothing to do — ✅ charts/list.spec.ts › C-L10 selection mode
- [ ] Exit selection mode — ✅ charts/list.spec.ts › C-L10 selection mode
- [ ] Bulk delete one chart (single-chart confirm text), Cancel keeps it — ✅ charts/list.spec.ts › C-L10 bulk delete
- [ ] Bulk delete several charts (confirm lists every title), then leaves selection mode — ✅ charts/list.spec.ts › C-L10 bulk delete
- [ ] Bulk delete falls back to one DELETE per chart when the bulk endpoint fails — ✅ charts/gaps-list.spec.ts › GAP-C list bulk delete falls back to one DELETE per chart when bulk fails
- [ ] Pagination Next / Prev — 🐞 charts/list.spec.ts › [pinned] C-L11 pagination (the first Next bounces back to page 1)
- [ ] Page size 10 / 20 / 50 / 100, each change going back to page 1 — ✅ charts/list.spec.ts › [pinned] C-L11 pagination
- [ ] Current page moves back to the last page when its only row is deleted — ✅ charts/list.spec.ts › C-L11 clamps (mocked list)
- [ ] Export submenu offers PNG + PDF for bar, line, pie, number and map, and CSV only for table and pivot — ✅ charts/list.spec.ts › C-L12 export submenu for <type> (×7)
- [ ] Export a bar chart from the list as PNG, and as PDF — ✅ charts/list.spec.ts › C-L12 export bar as PNG/PDF
- [ ] Export a line chart from the list as PNG, and as PDF — ✅ charts/list.spec.ts › C-L12 export line as PNG/PDF
- [ ] Export a pie chart from the list as PNG, and as PDF — ✅ charts/list.spec.ts › C-L12 export pie as PNG/PDF
- [ ] Export a number chart from the list as PNG, and as PDF — ✅ charts/list.spec.ts › C-L12 export number as PNG/PDF
- [ ] Export a map chart from the list as PNG, and as PDF — ✅ charts/list.spec.ts › C-L12 export map as PNG/PDF
- [ ] Export a pivot table from the list as CSV — ✅ charts/list.spec.ts › C-L12 export pivot_table as CSV
- [ ] Export a table chart from the list as CSV — 🐞 charts/list.spec.ts › [pinned] C-L12 table CSV (always fails: request lacks `dimensions`, backend returns 500)
- [ ] Share icon opens the Share modal for that chart — ✅ charts/list.spec.ts › C-L13 share icon
- [ ] A member with view-only access sees no Edit or Share icon — ✅ charts/list.spec.ts › C-L13 member
- [ ] Create button, Duplicate and Delete are hidden without the create or delete permission; the title link is disabled without view permission — ✅ charts/gaps-list.spec.ts › GAP-C list without create/delete permission hides Create, Duplicate and Delete; charts/gaps-list.spec.ts › GAP-C list without view permission: title link goes nowhere (permissions stripped from currentuserv2)

### Create a chart, step 1: pick dataset and type (`/charts/new`)

- [ ] Seven type cards in order with names (Bar, Pie, Line, Number, Map, Table, Pivot Table) — ✅ charts/create-pick.spec.ts › C-P1 7 type cards
- [ ] Hovering a card shows its description tooltip — ✅ charts/create-pick.spec.ts › C-P1 7 type cards
- [ ] Dataset picker has focus and opens its list on load — ✅ charts/create-pick.spec.ts › C-P1 dataset picker
- [ ] Dataset search filters the list; no match shows "No datasets found" — ✅ charts/create-pick.spec.ts › C-P1 dataset picker
- [ ] Picking a dataset fills the input and closes the list — ✅ charts/create-pick.spec.ts › C-P1 dataset picker
- [ ] Continue stays disabled until both a dataset and a type are picked — ✅ charts/create-pick.spec.ts › C-P1 Continue enabled only with dataset AND type
- [ ] Only one type card can be selected at a time — ✅ charts/create-pick.spec.ts › C-P1 Continue enabled only with dataset AND type
- [ ] Continue opens the builder with schema, table and type in the URL, for each of the 7 types — ✅ charts/create-pick.spec.ts › C-P1 Continue with <type> (×7)
- [ ] Enter and Space select the focused card; other keys do nothing — ✅ charts/create-pick.spec.ts › C-P2
- [ ] Back link and Cancel go to /charts — ✅ charts/create-pick.spec.ts › C-P3 Back link and Cancel
- [ ] When opened from a dashboard, Back and Cancel return to the dashboard — ✅ charts/create-pick.spec.ts › C-P3 from=dashboard Back and Cancel
- [ ] When opened from a dashboard, Continue replaces the history entry and keeps `from=dashboard` — ✅ charts/create-pick.spec.ts › C-P3 from=dashboard Continue
- [ ] Opened normally, browser Back from the builder returns to the picker — ✅ charts/create-pick.spec.ts › C-P3 without from
- [ ] "Access Denied" without the create-charts permission — ✅ charts/gaps-list.spec.ts › GAP-C new chart "Access Denied" without the create-charts permission
- [ ] Dataset errors "Failed to load datasets" and "Set up a warehouse…" — ✅ charts/gaps-list.spec.ts › GAP-C new chart dataset error "Failed to load datasets"; charts/gaps-list.spec.ts › GAP-C new chart dataset "Set up a warehouse"
- [ ] Onboarding walkthrough steps (pick type, then Continue) — ✅ charts/gaps-list.spec.ts › GAP-C new chart onboarding walkthrough: pick table → pick type → Continue

### Chart builder basics (create)

- [ ] Default title "Bar chart - <table> <timestamp>" (and the Line chart / Pie chart / Number card equivalents) — ✅ charts/builder-shared.spec.ts › C-B1 <bar|line|pie|number>
- [ ] Default title "Chart - <table> …" for table and pivot, and the map default title — ✅ charts/gaps-builder.spec.ts › GAP-C default title table / pivot_table / map (×3)
- [ ] Auto-prefill for bar, line and pie: X axis = first text column, metric = Total Count (COUNT(*)) — ✅ charts/builder-shared.spec.ts › C-B1 <bar|line|pie>
- [ ] Auto-prefill for number: COUNT(*) metric, no X axis — ✅ charts/builder-shared.spec.ts › C-B1 number
- [ ] Auto-prefill for map: statename column, default GeoJSON, COUNT metric — ✅ charts/builder-map.spec.ts › C-B1 map auto-prefill
- [ ] Auto-prefill for table: first text column (id) as dimension, Total Count — ✅ charts/builder-table.spec.ts › C-B1 table auto-prefill
- [ ] Auto-prefill for pivot: rows = first text column, columns = first date column, COUNT — ✅ charts/builder-pivot.spec.ts › C-B1 pivot auto-prefill
- [ ] Save disabled without a title — ✅ charts/builder-shared.spec.ts › C-B2 <bar|line|pie|number>
- [ ] Save disabled while a non-count metric has no column — ✅ charts/builder-shared.spec.ts › C-B2 <bar|line|pie|number>
- [ ] Table can be saved with only a dataset and a title — ✅ charts/builder-table.spec.ts › C-B1 table auto-prefill; [pinned] C-B3 table save with dataset + title only
- [ ] Pivot Save disabled without a metric; preview says "Configure your pivot table" — ✅ charts/builder-pivot.spec.ts › C-B2
- [ ] Number Save disabled without a metric — ✅ charts/builder-number.spec.ts › removing the metric disables Save
- [ ] Map Save needs a geographic column, a GeoJSON and a valid metric — ✅ charts/gaps-builder.spec.ts › GAP-C map save disabled without a valid metric / a GeoJSON / a geographic column (×3)
- [ ] Save a bar chart, then land on its detail page — ✅ charts/builder-shared.spec.ts › C-B3 bar
- [ ] Save a line chart, then land on its detail page — ✅ charts/builder-shared.spec.ts › C-B3 line
- [ ] Save a pie chart, then land on its detail page — ✅ charts/builder-shared.spec.ts › C-B3 pie
- [ ] Save a number chart, then land on its detail page — ✅ charts/builder-shared.spec.ts › C-B3 number
- [ ] Save a map chart, then land on its detail page — ✅ charts/builder-map.spec.ts › C-B3 map save
- [ ] Save a table chart, then land on its detail page — ✅ charts/builder-table.spec.ts › C-B3 table save with styling
- [ ] Save a pivot table, then land on its detail page — ✅ charts/builder-pivot.spec.ts › C-B3 pivot save
- [ ] Save shows "Saving..." while running, and an error toast on failure — ✅ charts/gaps-builder.spec.ts › GAP-C save shows "Saving..." then an error toast on failure
- [ ] Preview renders after the default config (screenshot) for bar, line, pie and number — ✅ charts/builder-shared.spec.ts › C-B4 <type> (×4)
- [ ] DATA tab › Chart Data: aggregated rows, 20 per page, Next page (bar, line, pie) — ✅ charts/builder-shared.spec.ts › C-B5 <bar|line|pie>
- [ ] DATA tab › Chart Data for a number chart — 🐞 charts/builder-shared.spec.ts › [pinned] C-B5 number (shows "Data preview isn't ready yet…")
- [ ] DATA tab › Raw Data: rows, Next, page size 50, Last page, "Showing x to y of N rows" — ✅ charts/builder-shared.spec.ts › C-B5 <bar|line|pie|number>
- [ ] Table and pivot open the DATA tab on Raw Data by default; pivot's Chart Data sub-tab shows the pivot — ✅ charts/gaps-builder.spec.ts › GAP-C table / pivot_table DATA tab opens on Raw Data; bar DATA tab opens on Chart Data; pivot DATA › Chart Data shows the pivot itself
- [ ] Back with no user edits still asks about unsaved changes — 🐞 charts/builder-shared.spec.ts › [pinned] C-B6 (auto-prefill counts as a change)
- [ ] Back › Stay on page keeps the builder and its values — ✅ charts/builder-shared.spec.ts › C-B6 Stay
- [ ] Back › Leave without saving goes to /charts/new — ✅ charts/builder-shared.spec.ts › C-B6 Leave
- [ ] Back › Save and leave creates the chart and opens its detail page — ✅ charts/builder-shared.spec.ts › C-B6 Save and leave
- [ ] Opened from a dashboard: Back reads "Back to Dashboard", and saving replaces history with `?from=dashboard` — ✅ charts/gaps-builder.spec.ts › GAP-C from dashboard: "Back to Dashboard" and save replaces history
- [ ] Browser "leave page?" prompt (beforeunload) when there are unsaved changes — 🐞 charts/gaps-builder.spec.ts › [pinned] GAP-C beforeunload "leave page?" prompt (fires even without user edits: auto-prefill counts as a change)
- [ ] Left tabs switch between Data Configuration and Chart Styling — ✅ (used by every styling test, e.g. charts/builder-bar.spec.ts)
- [ ] Chart-name hint popover next to the name field — ✅ charts/gaps-builder.spec.ts › GAP-C chart-name hint next to the name field (inline text, not a popover)
- [ ] "Congratulations, your Chart is live!" modal after saving during onboarding — 🧑 manual (see MANUAL-CHECKS.md)

### Builder data configuration (bar, line and pie share one panel)

- [ ] Change the data source inside the builder: resets data fields, keeps title, type and styling — ✅ charts/gaps-builder.spec.ts › GAP-C change data source resets data fields, keeps title, type and styling
- [ ] Pick the X axis column — ✅ charts/builder-shared.spec.ts › X axis: pick a column
- [ ] X axis list offers every column (16 on the test table) — ✅ charts/builder-shared.spec.ts › X axis: items list every column
- [ ] Time grain hidden when the X axis is not a date — ✅ charts/builder-shared.spec.ts › time grain › hidden for non-date X axis
- [ ] Time grain Year — ✅ charts/builder-shared.spec.ts › time grain › grain year
- [ ] Time grain Month — ✅ charts/builder-shared.spec.ts › time grain › grain month
- [ ] Time grain Day — ✅ charts/builder-shared.spec.ts › time grain › grain day
- [ ] Time grain None after another grain (sends null) — ✅ charts/builder-shared.spec.ts › time grain › grain None after Year
- [ ] Hour / Minute / Second disabled on a date-only column, with the tooltip "Not available for date columns" — ✅ charts/builder-shared.spec.ts › time grain › date column: hour/minute/second disabled
- [ ] Hour / Minute / Second on a timestamp column — ✅ charts/gaps-builder.spec.ts › GAP-C time grain hour/minute/second on a timestamp column
- [ ] Time grain clears itself when the X axis stops being a date — ✅ charts/builder-shared.spec.ts › time grain › grain auto-cleared
- [ ] Pick an extra dimension (stacked or multi-series) — ✅ charts/builder-shared.spec.ts › extra dimension › pick a column
- [ ] Extra dimension "None" clears it — ✅ charts/builder-shared.spec.ts › extra dimension › None clears it
- [ ] Extra dimension list excludes the X axis column — ✅ charts/builder-shared.spec.ts › extra dimension › list excludes the X axis column
- [ ] Extra dimension placeholder says "stacked bar" (bar) or "multi-line chart" (others) — ✅ charts/gaps-builder.spec.ts › GAP-C extra dimension placeholder per chart type
- [ ] Filter operator "equals" — ✅ charts/builder-shared.spec.ts › filters › operator equals
- [ ] Filter operator "not equals" — ✅ charts/builder-shared.spec.ts › filters › operator not_equals
- [ ] Filter operator ">" — ✅ charts/builder-shared.spec.ts › filters › operator greater_than
- [ ] Filter operator ">=" — ✅ charts/builder-shared.spec.ts › filters › operator greater_than_equal
- [ ] Filter operator "<" — ✅ charts/builder-shared.spec.ts › filters › operator less_than
- [ ] Filter operator "<=" — ✅ charts/builder-shared.spec.ts › filters › operator less_than_equal
- [ ] Filter operator "like" — ✅ charts/builder-shared.spec.ts › filters › operator like
- [ ] Filter operator "like (case-insensitive)" — ✅ charts/builder-shared.spec.ts › filters › operator like_case_insensitive
- [ ] Filter operator "in" (comma-separated text box) — ✅ charts/builder-shared.spec.ts › filters › operator in
- [ ] Filter operator "not in" (comma-separated text box) — ✅ charts/builder-shared.spec.ts › filters › operator not_in
- [ ] Filter operator "is null" (no value box) — ✅ charts/builder-shared.spec.ts › filters › operator is_null
- [ ] Filter operator "is not null" (no value box) — ✅ charts/builder-shared.spec.ts › filters › operator is_not_null
- [ ] Filter value as a single dropdown when column values load — ✅ charts/builder-shared.spec.ts › filters › value input: single combobox (column values stubbed; the staging endpoint returns 500)
- [ ] Filter value as a multi-select for "in" when column values load — ✅ charts/builder-shared.spec.ts › filters › value input: multi-select (stubbed)
- [ ] Filter value as a date picker for date columns — ✅ charts/builder-shared.spec.ts › filters › value input: date picker
- [ ] Filter value as a plain text box when no values load — ✅ charts/builder-shared.spec.ts › filters › operator <op> (text value input)
- [ ] Changing the filter column clears the value and records its data type — ✅ charts/builder-shared.spec.ts › filters › changing the column clears the value
- [ ] Remove a filter (✕) — ✅ charts/builder-shared.spec.ts › filters › remove filter
- [ ] Two filters are combined (AND) in one request — ✅ charts/builder-shared.spec.ts › filters › two filters are ANDed
- [ ] Filter value dropdown shows at most the first 100 values — ✅ charts/gaps-builder.spec.ts › GAP-C filter value dropdown shows at most the first 100 values
- [ ] Row limit 20 items — ✅ charts/builder-shared.spec.ts › pagination › 20 items
- [ ] Row limit 50 items — ✅ charts/builder-shared.spec.ts › pagination › 50 items
- [ ] Row limit 100 items — ✅ charts/builder-shared.spec.ts › pagination › 100 items
- [ ] Row limit 200 items — ✅ charts/builder-shared.spec.ts › pagination › 200 items
- [ ] Row limit "No pagination" — ✅ charts/builder-shared.spec.ts › pagination › No pagination after 20
- [ ] Sort direction disabled until a sort column is picked; options tagged COL and METRIC — ✅ charts/builder-shared.spec.ts › sort › direction disabled
- [ ] Sort by the dimension, ascending — ✅ charts/builder-shared.spec.ts › sort › by dimension ascending
- [ ] Sort by a metric, descending — ✅ charts/builder-shared.spec.ts › sort › by metric descending
- [ ] Sort "None" clears the sort — ✅ charts/builder-shared.spec.ts › sort › None clears the sort
- [ ] Sort clears itself when its metric's name disappears — ✅ charts/builder-shared.spec.ts › sort › auto-clears
- [ ] "Configure metrics first to enable sorting" message — ✅ charts/gaps-builder.spec.ts › GAP-C "Configure metrics first to enable sorting" message
- [ ] In-builder type switcher, with a description of the chosen type — ✅ charts/type-switch.spec.ts (e.g. bar → line checks "Display trends over time")

### Metrics (builder)

- [ ] + ADD ANOTHER METRIC adds an expanded "Total Count" COUNT(*) row — ✅ charts/builder-shared.spec.ts › Metrics › add another metric
- [ ] Remove a metric — ✅ charts/builder-shared.spec.ts › Metrics › remove a metric
- [ ] Removing the only bar metric — 🐞 charts/builder-shared.spec.ts › [pinned] removing the only bar metric (Save stays enabled)
- [ ] Simple metric: Count(column) — ✅ charts/builder-shared.spec.ts › simple › count(students)
- [ ] Simple metric: Sum — ✅ charts/builder-shared.spec.ts › simple › sum(students)
- [ ] Simple metric: Average — ✅ charts/builder-shared.spec.ts › simple › avg(male_score)
- [ ] Simple metric: Min — ✅ charts/builder-shared.spec.ts › simple › min(female_score)
- [ ] Simple metric: Max — ✅ charts/builder-shared.spec.ts › simple › max(score_gap)
- [ ] Simple metric: Count Distinct — ✅ charts/builder-shared.spec.ts › simple › count_distinct(districtname)
- [ ] Count offers "* (Count all rows)"; Sum, Avg, Min and Max disable non-numeric columns; Count Distinct allows every column — ✅ charts/builder-shared.spec.ts › simple: numeric-only columns
- [ ] Calculated metric: valid expression is checked by the server and then drives the chart — ✅ charts/builder-shared.spec.ts › calculated: valid expression
- [ ] Calculated metric: invalid expression shows the server error, and the previous definition stays — ✅ charts/builder-shared.spec.ts › calculated: invalid expression
- [ ] "Validating expression..." indicator while checking — ✅ charts/gaps-builder.spec.ts › GAP-C "Validating expression..." while the expression is checked
- [ ] Saved metric: pick one from the library; library icon shown — ✅ charts/builder-shared.spec.ts › saved: pick a library metric
- [ ] Saved metric: metrics already used in another row are hidden — ✅ charts/builder-shared.spec.ts › saved: metrics used in another row are hidden
- [ ] Saved metric empty messages "No saved metrics yet" and "No metrics match your search" — ✅ charts/gaps-builder.spec.ts › GAP-C saved metrics empty: "No saved metrics yet"; saved metrics search: "No metrics match your search"
- [ ] Switching a saved metric back to Simple detaches it from the library and resets to COUNT — ✅ charts/gaps-builder.spec.ts › GAP-C saved metric → Simple detaches from library and resets to COUNT
- [ ] Display name follows the definition until you type one; clearing it switches auto-naming back on — ✅ charts/builder-shared.spec.ts › display name
- [ ] Display name field hidden for number charts — ✅ charts/builder-number.spec.ts › data config
- [ ] Add a metric to the library: name required, toast, row flips to Saved — ✅ charts/builder-shared.spec.ts › add metric to library
- [ ] Pie shows only one metric (no add button) and labels read "Metric" and "Dimension" — ✅ charts/builder-pie.spec.ts › single metric
- [ ] Number metric is mirrored into the legacy aggregate fields — ✅ charts/builder-number.spec.ts › removing the metric (payload)

### Metric types × metric count, per chart type

Each case checks the data request, the preview, the saved payload, that the edit page shows the same metric rows, and the detail page.

- [ ] Bar with one simple metric — ✅ charts/metrics-matrix-a.spec.ts › MM-bar-1
- [ ] Bar with one calculated metric — 🐞 charts/metrics-matrix-a.spec.ts › [pinned] MM-bar-2 (detail page rounds fractional Y-axis labels to integers)
- [ ] Bar with one saved library metric — ✅ charts/metrics-matrix-a.spec.ts › MM-bar-3
- [ ] Bar with a 2nd metric (simple + calculated) — ✅ charts/metrics-matrix-a.spec.ts › MM-bar-4
- [ ] Bar with 3 mixed metrics (simple + calculated + saved) — ✅ charts/metrics-matrix-a.spec.ts › MM-bar-5
- [ ] Bar: remove the middle of 3 metrics, the other 2 stay in order — ✅ charts/metrics-matrix-a.spec.ts › MM-bar-6
- [ ] Line with one simple metric — ✅ charts/metrics-matrix-a.spec.ts › MM-line-1
- [ ] Line with one calculated metric — 🐞 charts/metrics-matrix-a.spec.ts › [pinned] MM-line-2 (detail Y axis rounded)
- [ ] Line with one saved library metric — 🐞 charts/metrics-matrix-a.spec.ts › [pinned] MM-line-3 (detail Y axis rounded)
- [ ] Line with 2 metrics — ✅ charts/metrics-matrix-a.spec.ts › MM-line-4
- [ ] Line with 3 mixed metrics — ✅ charts/metrics-matrix-a.spec.ts › MM-line-5
- [ ] Line: remove the middle metric — ✅ charts/metrics-matrix-a.spec.ts › MM-line-6
- [ ] Pie with a simple metric — ✅ charts/metrics-matrix-a.spec.ts › MM-pie-1
- [ ] Pie with a calculated metric — ✅ charts/metrics-matrix-a.spec.ts › MM-pie-2
- [ ] Pie with a saved metric — ✅ charts/metrics-matrix-a.spec.ts › MM-pie-3
- [ ] Pie keeps exactly one metric across Simple → Calculated → Saved — ✅ charts/metrics-matrix-a.spec.ts › MM-pie-4
- [ ] Pie with an extra dimension — ✅ charts/metrics-matrix-a.spec.ts › MM-pie-5
- [ ] Number with a simple metric — ✅ charts/metrics-matrix-a.spec.ts › MM-number-1
- [ ] Number with a calculated metric — 🐞 charts/metrics-matrix-a.spec.ts › [pinned] MM-number-2 (a ratio shows as "1" because decimals default to 0)
- [ ] Number with a saved metric — 🐞 charts/metrics-matrix-a.spec.ts › [pinned] MM-number-3 (rounded to an integer)
- [ ] Number keeps exactly one metric across tab switches — ✅ charts/metrics-matrix-a.spec.ts › MM-number-4
- [ ] Table with one simple metric — ✅ charts/metrics-matrix-b.spec.ts › MM-table-1
- [ ] Table with one calculated metric — ✅ charts/metrics-matrix-b.spec.ts › MM-table-2
- [ ] Table with one saved metric — ✅ charts/metrics-matrix-b.spec.ts › MM-table-3
- [ ] Table with 2 metrics — ✅ charts/metrics-matrix-b.spec.ts › MM-table-4
- [ ] Table with 3 mixed metrics — ✅ charts/metrics-matrix-b.spec.ts › MM-table-5
- [ ] Table: remove the middle metric — ✅ charts/metrics-matrix-b.spec.ts › MM-table-6
- [ ] Pivot with one simple metric — ✅ charts/metrics-matrix-b.spec.ts › MM-pivot-1
- [ ] Pivot with one calculated metric — 🐞 charts/metrics-matrix-b.spec.ts › [pinned] MM-pivot-2 (a ratio shows 0 decimals, so 0.49 becomes "0")
- [ ] Pivot with one saved metric — ✅ charts/metrics-matrix-b.spec.ts › MM-pivot-3
- [ ] Pivot with 2 metrics (one sub-column each) — ✅ charts/metrics-matrix-b.spec.ts › MM-pivot-4
- [ ] Pivot with 3 mixed metrics — ✅ charts/metrics-matrix-b.spec.ts › MM-pivot-5
- [ ] Pivot: remove the middle metric — ✅ charts/metrics-matrix-b.spec.ts › MM-pivot-6
- [ ] Map with a simple metric — ✅ charts/metrics-matrix-b.spec.ts › MM-map-1
- [ ] Map with a calculated metric — ✅ charts/metrics-matrix-b.spec.ts › MM-map-2
- [ ] Map with a saved metric — ✅ charts/metrics-matrix-b.spec.ts › MM-map-3
- [ ] Map allows one metric; the add button only appears after removing it — ✅ charts/metrics-matrix-b.spec.ts › MM-map-4

### Bar chart styling

- [ ] Orientation Horizontal — ✅ charts/builder-bar.spec.ts › orientation horizontal
- [ ] Orientation Vertical — ✅ charts/builder-bar.spec.ts › orientation vertical after horizontal
- [ ] Stacked bars (with an extra dimension) — ✅ charts/builder-bar.spec.ts › stacked bars
- [ ] Stacked switch only appears once there is an extra dimension — ✅ charts/builder-bar.spec.ts › stacked switch only appears
- [ ] Total labels on stacked bars — 🐞 charts/gaps-builder.spec.ts › [pinned] GAP-C total labels on stacked bars render blank (backend returns bar values as strings; stacked-bar-utils counts them as 0)
- [ ] Tooltip on hover off — ✅ charts/builder-bar.spec.ts › tooltip off (payload only; hover not checked)
- [ ] Legend off — ✅ charts/builder-bar.spec.ts › legend off
- [ ] Legend display "Show all" — 🐞 charts/builder-bar.spec.ts › [pinned] legend display all (drops the default legend position)
- [ ] Legend display "Paginated" — ✅ charts/builder-bar.spec.ts › legend display paginated
- [ ] Legend position Top — ✅ charts/builder-bar.spec.ts › legend position top
- [ ] Legend position Bottom — ✅ charts/builder-bar.spec.ts › legend position bottom
- [ ] Legend position Left — ✅ charts/builder-bar.spec.ts › legend position left
- [ ] Legend position Right — ✅ charts/builder-bar.spec.ts › legend position right after top
- [ ] Data labels on (default position Top) — ✅ charts/builder-bar.spec.ts › data labels on
- [ ] Data label position Middle — ✅ charts/builder-bar.spec.ts › data label position inside
- [ ] Data label position Bottom — ✅ charts/builder-bar.spec.ts › data label position insideBottom
- [ ] Data label position Top (switching back) — ✅ charts/builder-bar.spec.ts › data label position top after inside
- [ ] X-axis title — ✅ charts/builder-bar.spec.ts › x-axis title
- [ ] X label rotation 0° (horizontal) — ✅ charts/builder-bar.spec.ts › x label rotation horizontal
- [ ] X label rotation 45° (create default) — ✅ charts/builder-bar.spec.ts › x label rotation 45 after vertical
- [ ] X label rotation 90° (vertical) — ✅ charts/builder-bar.spec.ts › x label rotation vertical
- [ ] X number format and decimals (numeric X axis) — ✅ charts/builder-bar.spec.ts › x number format + decimals
- [ ] X date format dd/mm/yyyy — ✅ charts/builder-bar.spec.ts › x date format dd_mm_yyyy
- [ ] X date format yyyy-mm-dd — ✅ charts/builder-bar.spec.ts › x date format yyyy_mm_dd
- [ ] Y-axis title — ✅ charts/builder-bar.spec.ts › y-axis title
- [ ] Y label rotation 45° — ✅ charts/builder-bar.spec.ts › y label rotation 45
- [ ] Y label rotation 90° — ✅ charts/builder-bar.spec.ts › y label rotation vertical
- [ ] Y number format Adaptive Indian — ✅ charts/builder-bar.spec.ts › y number format adaptive_indian
- [ ] Y number format Adaptive International — ✅ charts/builder-bar.spec.ts › y number format adaptive_international
- [ ] Y number format Indian — ✅ charts/builder-bar.spec.ts › y number format indian
- [ ] Y number format International — ✅ charts/builder-bar.spec.ts › y number format international
- [ ] Y number format European — ✅ charts/builder-bar.spec.ts › y number format european
- [ ] Y number format Percentage — ✅ charts/builder-bar.spec.ts › y number format percentage
- [ ] Y decimal places — ✅ charts/builder-bar.spec.ts › y decimal places
- [ ] Styling panel defaults in create (vertical, tooltip on, legend on and paginated, labels off, X at 45°) — ✅ charts/builder-bar.spec.ts › styling panel defaults

### Line chart styling

- [ ] Line style Straight — ✅ charts/builder-line.spec.ts › line style straight
- [ ] Line style Smooth — ✅ charts/builder-line.spec.ts › line style smooth after straight
- [ ] Data points off — ✅ charts/builder-line.spec.ts › data points off
- [ ] Tooltip off — ✅ charts/builder-line.spec.ts › tooltip off
- [ ] Legend off — ✅ charts/builder-line.spec.ts › legend off
- [ ] Legend display "Show all" — 🐞 charts/builder-line.spec.ts › [pinned] legend display all (drops the legend position)
- [ ] Legend display "Paginated" — ✅ charts/builder-line.spec.ts › legend display paginated
- [ ] Legend position Top — ✅ charts/builder-line.spec.ts › legend position top
- [ ] Legend position Bottom — ✅ charts/builder-line.spec.ts › legend position bottom
- [ ] Legend position Left — ✅ charts/builder-line.spec.ts › legend position left
- [ ] Legend position Right — ✅ charts/builder-line.spec.ts › legend position right after top
- [ ] Data labels on (Above point) — ✅ charts/builder-line.spec.ts › data labels on
- [ ] Data label position Below — ✅ charts/builder-line.spec.ts › data label position bottom
- [ ] Data label position Left — ✅ charts/builder-line.spec.ts › data label position left
- [ ] Data label position Right — ✅ charts/builder-line.spec.ts › data label position right
- [ ] Data label position Above (switching back) — ✅ charts/builder-line.spec.ts › data label position top after bottom
- [ ] X-axis title — ✅ charts/builder-line.spec.ts › x-axis title
- [ ] X label rotation 0° / 45° / 90° — ✅ charts/builder-line.spec.ts › x label rotation 45, vertical, horizontal after 45
- [ ] X number format and decimals — ✅ charts/builder-line.spec.ts › x number format + decimals
- [ ] X date format mm/dd/yyyy — ✅ charts/builder-line.spec.ts › x date format mm_dd_yyyy
- [ ] X date format ISO date-time — ✅ charts/builder-line.spec.ts › x date format iso_datetime
- [ ] Y-axis title — ✅ charts/builder-line.spec.ts › y-axis title
- [ ] Y label rotation 45° and 90° — ✅ charts/builder-line.spec.ts › y label rotation 45, vertical
- [ ] Y number format, each of the 6 formats — ✅ charts/builder-line.spec.ts › y number format <fmt> (×6)
- [ ] Y decimal places — ✅ charts/builder-line.spec.ts › y decimal places
- [ ] Multi-line chart with an extra dimension — ✅ charts/builder-line.spec.ts › multi-line with extra dimension
- [ ] Styling panel defaults in create — ✅ charts/builder-line.spec.ts › styling panel defaults

### Pie chart styling

- [ ] Legend off — ✅ charts/builder-pie.spec.ts › legend off
- [ ] Legend display "Show all" (keeps its position, unlike bar and line) — ✅ charts/builder-pie.spec.ts › legend display all
- [ ] Legend display "Paginated" — ✅ charts/builder-pie.spec.ts › legend display paginated
- [ ] Legend position Top — ✅ charts/builder-pie.spec.ts › legend position top
- [ ] Legend position Bottom — ✅ charts/builder-pie.spec.ts › legend position bottom
- [ ] Legend position Left — ✅ charts/builder-pie.spec.ts › legend position left
- [ ] Legend position Right (default) — ✅ charts/builder-pie.spec.ts › legend position right after top
- [ ] Chart style Full pie — ✅ charts/builder-pie.spec.ts › chart style full pie
- [ ] Chart style Donut — ✅ charts/builder-pie.spec.ts › chart style donut after full pie
- [ ] Tooltip off — ✅ charts/builder-pie.spec.ts › tooltip off
- [ ] Slice limit Top 3 (the rest grouped as "Other") — ✅ charts/builder-pie.spec.ts › slice limit top 3
- [ ] Slice limit Top 5 — ✅ charts/builder-pie.spec.ts › slice limit top 5
- [ ] Slice limit Top 10 — ✅ charts/builder-pie.spec.ts › slice limit top 10
- [ ] Slice limit All — ✅ charts/builder-pie.spec.ts › slice limit all after top 3
- [ ] Data labels off; Label format and Label position then hide — ✅ charts/builder-pie.spec.ts › data labels off; label format / position hidden
- [ ] Label format Value — ✅ charts/builder-pie.spec.ts › label format value
- [ ] Label format Name + percentage — ✅ charts/builder-pie.spec.ts › label format name_percentage
- [ ] Label format Name + value — ✅ charts/builder-pie.spec.ts › label format name_value
- [ ] Label format Percentage (default) — ✅ charts/builder-pie.spec.ts › label format percentage after value
- [ ] Label position Inside — ✅ charts/builder-pie.spec.ts › label position inside
- [ ] Label position Outside — ✅ charts/builder-pie.spec.ts › label position outside after inside
- [ ] Number format, each of the 6 formats — ✅ charts/builder-pie.spec.ts › number format <fmt> (×6)
- [ ] Decimal places — ✅ charts/builder-pie.spec.ts › decimal places
- [ ] Date format dd/mm/yyyy on a date dimension — ✅ charts/builder-pie.spec.ts › date format dd_mm_yyyy
- [ ] Date format yyyy-mm-dd on a date dimension — ✅ charts/builder-pie.spec.ts › date format yyyy_mm_dd
- [ ] Date formatting section only appears for a date dimension and names the column — ✅ charts/builder-pie.spec.ts › date formatting section only for a date dimension
- [ ] Styling panel defaults in create — ✅ charts/builder-pie.spec.ts › styling panel defaults

### Number (big number / KPI card) styling

- [ ] Size Small — ✅ charts/builder-number.spec.ts › size small
- [ ] Size Medium (default) — ✅ charts/builder-number.spec.ts › size medium after small
- [ ] Size Large — ✅ charts/builder-number.spec.ts › size large
- [ ] Subtitle — ✅ charts/builder-number.spec.ts › subtitle
- [ ] Number format, each of the 6 formats — ✅ charts/builder-number.spec.ts › number format <fmt> (×6)
- [ ] Decimal places — ✅ charts/builder-number.spec.ts › decimal places
- [ ] Prefix — ✅ charts/builder-number.spec.ts › prefix
- [ ] Suffix — ✅ charts/builder-number.spec.ts › suffix
- [ ] Prefix, suffix and format together — ✅ charts/builder-number.spec.ts › prefix + suffix + format together
- [ ] Styling panel defaults in create — ✅ charts/builder-number.spec.ts › styling panel defaults
- [ ] Data panel shows one metric and filters, but no X axis, extra dimension, row limit, sort or display name — ✅ charts/builder-number.spec.ts › data config
- [ ] Removing the metric disables Save and brings back + ADD ANOTHER METRIC — ✅ charts/builder-number.spec.ts › removing the metric
- [ ] A filter changes the big number (and is saved) — ✅ charts/builder-number.spec.ts › filter applies to the big number

### Map: data configuration

- [ ] Country is India only and cannot be changed — ✅ charts/builder-map.spec.ts › C-B1 map auto-prefill
- [ ] SUM metric renders the preview and sends the overlay request — ✅ charts/builder-map.spec.ts › C-B4 map SUM(students)
- [ ] Changing the state column re-picks the GeoJSON and resets the drill-down — ✅ charts/builder-map.spec.ts › map state column change
- [ ] District drill-down level is saved as a geographic hierarchy — ✅ charts/builder-map.spec.ts › map district drill level
- [ ] Download States CSV (ind_states.csv, success toast) — ✅ charts/builder-map.spec.ts › Download States CSV
- [ ] Download Districts CSV (ind_districts.csv, success toast) — ✅ charts/builder-map.spec.ts › Download Districts CSV
- [ ] "Loading Geographic Levels..." state — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C map "Loading Geographic Levels..." while region types load
- [ ] Map configuration section only appears once there is a valid metric — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C map configuration section only appears with a valid metric
- [ ] Add a map filter — 🐞 charts/builder-map.spec.ts › [pinned] map filter value is a text box (the value dropdown never appears because the staging backend returns 500)
- [ ] Map filters reach the data preview but not the builder map itself — 🐞 charts/builder-map.spec.ts › [pinned] map filters reach chart-data-preview but not the builder overlay
- [ ] Remove a map filter (✕); it is dropped from the saved chart — ✅ charts/builder-map.spec.ts › map filter remove
- [ ] Clicking a region with no drill-down configured (create builder) — 🐞 charts/builder-map.spec.ts › [pinned] region click without drill config (info toast only)
- [ ] Drill down by clicking a state: toast, breadcrumb, "Level 1" badge, district data — ✅ charts/builder-map.spec.ts › map drill-down click
- [ ] Breadcrumb "Back" returns to the state level — ✅ charts/builder-map.spec.ts › map drill breadcrumb Back
- [ ] Breadcrumb "Home" returns to the state level; clicking the current level keeps the drill — ✅ charts/builder-map.spec.ts › map drill breadcrumb Home
- [ ] Map preview states: loading boundaries, configuration error, "Configure your map to see a preview", "Data needs attention" — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C map preview state: "Loading map boundaries..." / "Loading data..." / GeoJSON failure / GeoJSON without boundaries / overlay failure (×5)
- [ ] Colour scale widens when every region has the same value — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C map colour scale widens when every region has the same value (overlay mocked, legend screenshot)

### Map styling

- [ ] Colour scheme defaults to Blues — ✅ charts/builder-map.spec.ts › map color scheme default is Blues
- [ ] Colour scheme Reds — ✅ charts/builder-map.spec.ts › map color scheme Reds
- [ ] Colour scheme Greens — ✅ charts/builder-map.spec.ts › map color scheme Greens
- [ ] Colour scheme Purples — ✅ charts/builder-map.spec.ts › map color scheme Purples
- [ ] Colour scheme Oranges — ✅ charts/builder-map.spec.ts › map color scheme Oranges
- [ ] Colour scheme Greys — ✅ charts/builder-map.spec.ts › map color scheme Greys
- [ ] Tooltip on (default) shows the region and its value — ✅ charts/builder-map.spec.ts › map tooltip on
- [ ] Tooltip off: nothing on hover — ✅ charts/builder-map.spec.ts › map tooltip off
- [ ] Legend off — ✅ charts/builder-map.spec.ts › map legend off
- [ ] Legend position Top left — ✅ charts/builder-map.spec.ts › map legend position top-left
- [ ] Legend position Top right — ✅ charts/builder-map.spec.ts › map legend position top-right
- [ ] Legend position Bottom left (default) — ✅ charts/builder-map.spec.ts › map legend position bottom-left
- [ ] Legend position Bottom right — ✅ charts/builder-map.spec.ts › map legend position bottom-right
- [ ] Re-picking the value a dropdown already shows (legend corner, Blues) — 🐞 charts/builder-map.spec.ts › map legend position bottom-left (the test works around it: re-picking does nothing)
- [ ] Old legend values (left / right / top / bottom) are mapped to corners — 🐞 charts/gaps-map-table-pivot.spec.ts › GAP-C map legacy legend position "<value>" → "<corner>" in styling (×4; right and top [pinned]: styling maps them to corners but the preview still draws bottom-left)
- [ ] "Label for No Data" shows in the tooltip for regions without data — ✅ charts/builder-map.spec.ts › map no-data label
- [ ] Show region names — ✅ charts/builder-map.spec.ts › map show region names
- [ ] Number format in the tooltip — ✅ charts/builder-map.spec.ts › map number format applies to tooltip
- [ ] Decimal places in the tooltip — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C map decimal places apply to the tooltip value
- [ ] Zoom in — ✅ charts/builder-map.spec.ts › map zoom in; charts/detail.spec.ts › C-D4 map zoom
- [ ] Zoom out — ✅ charts/builder-map.spec.ts › map zoom out; charts/detail.spec.ts › C-D4 map zoom
- [ ] Legend hides in very small containers — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C map legend hides in very small containers (dashboard cell)

### Map: save, edit, detail

- [ ] Save a map with a drill level and colour scheme, and the detail page loads its data — ✅ charts/builder-map.spec.ts › C-B3 map save
- [ ] A drill level set in the builder is saved as "state", so the detail toast says "Drilling down to state in …" — 🐞 charts/builder-map.spec.ts › [pinned] C-D4 UI-built drill hierarchy
- [ ] Edit round trip keeps the hierarchy and saves one layer on update — 🐞 charts/builder-map.spec.ts › C-E2 map edit round trip (pinned in PINNED-BUGS)
- [ ] Edit: picking a district turns the simplified fields into 2 layers — ✅ charts/builder-map.spec.ts › C-E2 map edit: picking a district
- [ ] Edit preview: clicking a region with no drill-down configured — 🐞 charts/builder-map.spec.ts › [pinned] map edit preview: region click does nothing
- [ ] Edit preview: drilling with a hierarchy shows no toast — 🐞 charts/builder-map.spec.ts › [pinned] map edit preview: drill with hierarchy has no toast
- [ ] Edit-builder map preview ignores the chart's filters — 🐞 charts/gaps-map-table-pivot.spec.ts › [pinned] GAP-C edit-builder map preview ignores the chart filters (edit page sends no filters; detail sends them)

### Table chart

- [ ] Change the first dimension — ✅ charts/builder-table.spec.ts › table dimension change
- [ ] ADD DIMENSION(s) appends the first unused column — ✅ charts/builder-table.spec.ts › table ADD DIMENSION(s)
- [ ] ADD DIMENSION(s) disabled once every column is used — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C table ADD DIMENSION(s) disabled once every column is used
- [ ] Several dimensions (state + district) render as columns — ✅ charts/builder-table.spec.ts › table multi dimensions (×2)
- [ ] Remove a dimension; the last one cannot be removed — ✅ charts/builder-table.spec.ts › table remove dimension
- [ ] Reorder dimensions by dragging the handle — ✅ charts/builder-table.spec.ts › table reorder dimensions
- [ ] Drill-down switch: only the first dimension is queried, with the order hint "a → b" — ✅ charts/builder-table.spec.ts › table drill-down toggle
- [ ] Click a drill cell: adds an "equals" filter, shows the next dimension, breadcrumb "state: X" and "← Back" — ✅ charts/builder-table.spec.ts › [pinned] drill-down cell click
- [ ] The last drill level still looks clickable, but clicking it does nothing — 🐞 charts/builder-table.spec.ts › [pinned] drill-down cell click
- [ ] Table drill-down through 3 levels (state → district → climate event), then "← Back" one level at a time — 🐞 charts/metrics-matrix-b.spec.ts › [pinned] MM-table-7 (last level click does nothing)
- [ ] Turning drill-down off asks for confirmation — 🐞 charts/gaps-map-table-pivot.spec.ts › [pinned] GAP-C table turning drill-down off never asks for confirmation (no page passes `hasLevelScopedRules`)
- [ ] Freeze first column — ✅ charts/builder-table.spec.ts › table freeze first column
- [ ] Column alignment Auto (default: first column left, numbers right) — ✅ charts/builder-table.spec.ts › table column alignment default
- [ ] Column alignment Left — ✅ charts/builder-table.spec.ts › table column alignment left
- [ ] Column alignment Center — ✅ charts/builder-table.spec.ts › table column alignment center
- [ ] Column alignment Right — ✅ charts/builder-table.spec.ts › table column alignment right
- [ ] Reorder columns by dragging in Column formatting — ✅ charts/builder-table.spec.ts › table column order
- [ ] With drill-down on, Column formatting lists only the dimension currently shown — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C table with drill-down on, Column formatting lists only the shown dimension
- [ ] Number format per column (format + decimals, summary text, remove) — ✅ charts/builder-table.spec.ts › table number format per column
- [ ] Number formatting lists only numeric columns; "No date columns to format." — ✅ charts/builder-table.spec.ts › table number formatting lists only numeric columns
- [ ] "No numeric columns to format." message — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C table "No numeric columns to format." message
- [ ] Date format per column, and Reset — ✅ charts/builder-table.spec.ts › table date format per column
- [ ] Conditional formatting: empty message; ADD RULE defaults to the first column; delete a rule — ✅ charts/builder-table.spec.ts › conditional formatting: empty state
- [ ] Conditional formatting numeric ">" — ✅ charts/builder-table.spec.ts › conditional formatting numeric >
- [ ] Conditional formatting numeric "<" — ✅ charts/builder-table.spec.ts › conditional formatting numeric <
- [ ] Conditional formatting numeric ">=" — ✅ charts/builder-table.spec.ts › conditional formatting numeric >=
- [ ] Conditional formatting numeric "<=" — ✅ charts/builder-table.spec.ts › conditional formatting numeric <=
- [ ] Conditional formatting numeric "==" — ✅ charts/builder-table.spec.ts › conditional formatting numeric ==
- [ ] Conditional formatting numeric "!=" — ✅ charts/builder-table.spec.ts › conditional formatting numeric !=
- [ ] Conditional formatting text "==" (exact, case-sensitive) — ✅ charts/builder-table.spec.ts › conditional formatting text ==
- [ ] Conditional formatting text "!=" — ✅ charts/builder-table.spec.ts › conditional formatting text !=
- [ ] Conditional formatting colour swatch — ✅ charts/builder-table.spec.ts › conditional formatting colour swatch
- [ ] When several rules match, the last one wins — ✅ charts/builder-table.spec.ts › last matching rule wins
- [ ] Changing a rule's column to another type resets the rule — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C table changing a rule column to another type resets the rule
- [ ] Per-level rule scope for metric columns when drill-down is on — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C table per-level rule scope for metric columns when drill-down is on
- [ ] Theme Gray (default) → Blue → Gray — ✅ charts/builder-table.spec.ts › table theme
- [ ] Zebra rows on by default, can be turned off — ✅ charts/builder-table.spec.ts › table zebra rows
- [ ] Table search: match count, clear button, Escape clears — ✅ charts/builder-table.spec.ts › table search
- [ ] Search only looks at rows on the current page — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C table search only looks at rows on the current page
- [ ] URL values (http(s):// and www.) render as a "Link" that opens in a new tab — ✅ charts/builder-table.spec.ts › table URL cells (response rewritten)
- [ ] Table pagination Next / Prev / Last / First with "Showing x to y of N rows" — ✅ charts/builder-table.spec.ts › table pagination
- [ ] Table page size 50 resets to page 1 — ✅ charts/builder-table.spec.ts › table page size 50
- [ ] Table page sizes 10 / 20 / 100 / 200 — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C table page size <N> → limit=<N> (×4)
- [ ] Row limit setting (20 items) is sent to the backend — ✅ charts/builder-table.spec.ts › table row-limit pagination config
- [ ] Table with a dimension but no metric shows raw rows (156) instead of grouped ones — 🐞 charts/builder-table.spec.ts › [pinned] C-B3 table save with dataset + title only
- [ ] Styling is saved and shows on the detail page (freeze, alignment, format, rules, theme, zebra) — ✅ charts/builder-table.spec.ts › C-B3 table save with styling
- [ ] Edit round trip (drill switch, theme) saves the update — ✅ charts/builder-table.spec.ts › C-E2 table edit round trip
- [ ] Table states: "Loading table data...", "No data available", "No columns configured" — 🐞 charts/gaps-map-table-pivot.spec.ts › GAP-C table state "Loading table data..." / "No data available"; [pinned] table state "No columns configured" (only reachable with a mocked rows-without-columns response)

### Pivot table

- [ ] Change a row dimension — ✅ charts/builder-pivot.spec.ts › pivot row dimension change
- [ ] Add a row dimension (first unused column; columns already used are hidden) — ✅ charts/builder-pivot.spec.ts › pivot add row dimension
- [ ] Remove a row dimension; the last one cannot be removed — ✅ charts/builder-pivot.spec.ts › pivot remove row dimension
- [ ] Column dimensions: change, add, remove down to zero — ✅ charts/builder-pivot.spec.ts › pivot column dimensions
- [ ] Reorder row or column dimensions by drag — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C pivot reorder row dimensions by drag; pivot reorder column dimensions by drag
- [ ] Nested column headers render (state × climate event) — ✅ charts/builder-pivot.spec.ts › pivot render
- [ ] Row subtotals need 2 or more row dimensions (switch disabled otherwise) — ✅ charts/builder-pivot.spec.ts › pivot row subtotals need 2+
- [ ] Row subtotals on, with a custom label — ✅ charts/builder-pivot.spec.ts › pivot row subtotals on + custom label
- [ ] Row subtotals switch off automatically below 2 row dimensions — ✅ charts/builder-pivot.spec.ts › pivot row subtotals auto-off
- [ ] Column subtotals need 2 or more column dimensions — ✅ charts/builder-pivot.spec.ts › pivot row subtotals need 2+ (column switch disabled too)
- [ ] Column subtotals on, with a custom label — ✅ charts/builder-pivot.spec.ts › pivot column subtotals on + custom label
- [ ] Column subtotals switch off automatically below 2 column dimensions — ✅ charts/builder-pivot.spec.ts › pivot column subtotals auto-off
- [ ] Row grand total needs a column dimension — ✅ charts/builder-pivot.spec.ts › pivot row grand total needs a column dimension
- [ ] Row grand total (right-hand column), with a custom label — ✅ charts/builder-pivot.spec.ts › pivot row grand total
- [ ] Column grand total (bottom row), with a custom label — ✅ charts/builder-pivot.spec.ts › pivot column grand total
- [ ] Number format per metric (format, decimals, remove) — ✅ charts/builder-pivot.spec.ts › pivot per-metric number format
- [ ] Date format on a date dimension (display only, no new request) — ✅ charts/builder-pivot.spec.ts › pivot date format
- [ ] Conditional formatting (numeric rule on the metric) — ✅ charts/builder-pivot.spec.ts › pivot conditional formatting
- [ ] Freeze first column — ✅ charts/builder-pivot.spec.ts › pivot freeze first column
- [ ] Theme Gray → Blue — ✅ charts/builder-pivot.spec.ts › pivot theme
- [ ] Zebra rows off by default, can be turned on — ✅ charts/builder-pivot.spec.ts › pivot zebra rows
- [ ] Search highlights matches — ✅ charts/builder-pivot.spec.ts › pivot search
- [ ] "N/A" shown for empty cells — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C pivot "N/A" shown for empty cells
- [ ] Sticky total column when there is one metric — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C pivot sticky total column only with one metric
- [ ] Filters on a pivot table — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C pivot filters narrow the pivot (payload + render)
- [ ] Save (subtotals, grand total, format, theme, zebra, freeze) and the detail page renders it — ✅ charts/builder-pivot.spec.ts › C-B3 pivot save
- [ ] Edit round trip (add a row dimension, grand total) saves the update — ✅ charts/builder-pivot.spec.ts › C-E2 pivot edit round trip

### Switching chart type (create builder)

- [ ] Bar → Line keeps every metric, dimension, filter, sort and row limit; label position becomes "Above Point" — ✅ charts/type-switch.spec.ts › bar → line
- [ ] Bar → Pie keeps only the first metric; label position "Inside" stays — ✅ charts/type-switch.spec.ts › bar → pie
- [ ] Bar → Number keeps the first metric and drops the X axis — 🐞 charts/type-switch.spec.ts › [pinned] bar → number (still sends the old `aggregate_func: count`)
- [ ] Pie → Bar keeps the metric and brings back + ADD ANOTHER METRIC — ✅ charts/type-switch.spec.ts › pie → bar
- [ ] Bar → Table keeps the metrics — 🐞 charts/type-switch.spec.ts › [pinned] bar → table (the table dimension comes from auto-prefill `id`, not the X axis)
- [ ] Bar → Map keeps the first metric and shows the map configuration — ✅ charts/type-switch.spec.ts › bar → map
- [ ] Bar → Pivot keeps the metrics — 🐞 charts/type-switch.spec.ts › [pinned] bar → pivot table (row and column dimensions reset, so Save is disabled)
- [ ] Bar with a date X axis and Month grain → Pie clears the time grain — ✅ charts/type-switch.spec.ts › bar (date X, month grain) → pie
- [ ] Bar → Line, then save — 🐞 charts/type-switch.spec.ts › [pinned] bar → line then save (bar-only styling is saved on the line chart)
- [ ] Chain bar → line → pie → number → table → map; the title survives every switch — ✅ charts/type-switch.spec.ts › chain
- [ ] Switching type in the edit builder (map ↔ others, table ↔ others) — 🐞 charts/gaps-builder.spec.ts › GAP-C edit bar → map / edit map → bar / edit table → bar; [pinned] edit bar → table (groups by `id`, not `statename`); full matrix in "Chart type switching — every source → target" below

### Chart type switching — every source → target (create & edit)

Each source chart is fully configured (2 metrics, extra dimension, legend bottom, data labels, drill/subtotals where they apply) before the switch. The summary in brackets comes from [TYPE-SWITCH-BEHAVIOR.md](TYPE-SWITCH-BEHAVIOR.md). In the edit builder, styling is always reset to the new type's defaults.

- [ ] Create builder: bar → line — ✅ charts/type-switch-matrix.spec.ts › TS-create bar → line (keeps all; label inside→top)
- [ ] Create builder: bar → pie — ✅ charts/type-switch-matrix.spec.ts › TS-create bar → pie (X+extra, 1st metric)
- [ ] Create builder: bar → number — 🐞 charts/type-switch-matrix.spec.ts › TS-create bar → number [pinned] (1st metric, drops X/extra; bug: legacy aggregate_func count sent with the kept metric)
- [ ] Create builder: bar → table — 🐞 charts/type-switch-matrix.spec.ts › TS-create bar → table [pinned] (dims=id; bug: table dimension comes from auto-prefill (id), not the source dimension)
- [ ] Create builder: bar → map — 🐞 charts/type-switch-matrix.spec.ts › TS-create bar → map [pinned] (state=statename; save 422; bug: save rejected 422: source legendPosition carried into map customizations)
- [ ] Create builder: bar → pivot_table — 🐞 charts/type-switch-matrix.spec.ts › TS-create bar → pivot_table [pinned] (rows/cols empty, disabled; bug: row/column dimensions reset → Save disabled)
- [ ] Create builder: line → bar — ✅ charts/type-switch-matrix.spec.ts › TS-create line → bar (keeps all; label bottom→top)
- [ ] Create builder: line → pie — ✅ charts/type-switch-matrix.spec.ts › TS-create line → pie (X+extra, 1st metric; label→outside)
- [ ] Create builder: line → number — 🐞 charts/type-switch-matrix.spec.ts › TS-create line → number [pinned] (1st metric, drops X/extra; bug: legacy aggregate_func count sent with the kept metric)
- [ ] Create builder: line → table — 🐞 charts/type-switch-matrix.spec.ts › TS-create line → table [pinned] (dims=id; bug: table dimension comes from auto-prefill (id), not the source dimension)
- [ ] Create builder: line → map — 🐞 charts/type-switch-matrix.spec.ts › TS-create line → map [pinned] (save 422; bug: save rejected 422: source legendPosition carried into map customizations)
- [ ] Create builder: line → pivot_table — 🐞 charts/type-switch-matrix.spec.ts › TS-create line → pivot_table [pinned] (disabled; bug: row/column dimensions reset → Save disabled)
- [ ] Create builder: pie → bar — ✅ charts/type-switch-matrix.spec.ts › TS-create pie → bar (keeps X+extra+metric)
- [ ] Create builder: pie → line — ✅ charts/type-switch-matrix.spec.ts › TS-create pie → line (keeps X+extra+metric; label→top)
- [ ] Create builder: pie → number — 🐞 charts/type-switch-matrix.spec.ts › TS-create pie → number [pinned] (metric; bug: legacy aggregate_func count sent with the kept metric)
- [ ] Create builder: pie → table — 🐞 charts/type-switch-matrix.spec.ts › TS-create pie → table [pinned] (dims=id; bug: table dimension comes from auto-prefill (id), not the source dimension)
- [ ] Create builder: pie → map — 🐞 charts/type-switch-matrix.spec.ts › TS-create pie → map [pinned] (save 422; bug: save rejected 422: source legendPosition carried into map customizations)
- [ ] Create builder: pie → pivot_table — 🐞 charts/type-switch-matrix.spec.ts › TS-create pie → pivot_table [pinned] (disabled; bug: row/column dimensions reset → Save disabled)
- [ ] Create builder: number → bar — 🐞 charts/type-switch-matrix.spec.ts › TS-create number → bar [pinned] (X empty, disabled; bug: X axis left empty → Save disabled)
- [ ] Create builder: number → line — 🐞 charts/type-switch-matrix.spec.ts › TS-create number → line [pinned] (X empty, disabled; bug: X axis left empty → Save disabled)
- [ ] Create builder: number → pie — 🐞 charts/type-switch-matrix.spec.ts › TS-create number → pie [pinned] (X empty, disabled; bug: X axis left empty → Save disabled)
- [ ] Create builder: number → table — 🐞 charts/type-switch-matrix.spec.ts › TS-create number → table [pinned] (dims=id, keeps number styling; bug: table dimension comes from auto-prefill (id), not the source dimension)
- [ ] Create builder: number → map — ✅ charts/type-switch-matrix.spec.ts › TS-create number → map (state=statename, OK)
- [ ] Create builder: number → pivot_table — 🐞 charts/type-switch-matrix.spec.ts › TS-create number → pivot_table [pinned] (disabled; bug: row/column dimensions reset → Save disabled)
- [ ] Create builder: table → bar — ✅ charts/type-switch-matrix.spec.ts › TS-create table → bar (X=statename, extra none, both metrics, no styling)
- [ ] Create builder: table → line — ✅ charts/type-switch-matrix.spec.ts › TS-create table → line (X=statename, extra none, both metrics, no styling)
- [ ] Create builder: table → pie — ✅ charts/type-switch-matrix.spec.ts › TS-create table → pie (X=statename, 1st metric)
- [ ] Create builder: table → number — 🐞 charts/type-switch-matrix.spec.ts › TS-create table → number [pinned] (1st metric; bug: legacy aggregate_func count sent with the kept metric)
- [ ] Create builder: table → map — ✅ charts/type-switch-matrix.spec.ts › TS-create table → map (state=statename, OK)
- [ ] Create builder: table → pivot_table — 🐞 charts/type-switch-matrix.spec.ts › TS-create table → pivot_table [pinned] (disabled; bug: row/column dimensions reset → Save disabled)
- [ ] Create builder: map → bar — 🐞 charts/type-switch-matrix.spec.ts › TS-create map → bar [pinned] (X empty, disabled; bug: X axis left empty → Save disabled)
- [ ] Create builder: map → line — 🐞 charts/type-switch-matrix.spec.ts › TS-create map → line [pinned] (X empty, disabled; bug: X axis left empty → Save disabled)
- [ ] Create builder: map → pie — 🐞 charts/type-switch-matrix.spec.ts › TS-create map → pie [pinned] (X empty, disabled; bug: X axis left empty → Save disabled)
- [ ] Create builder: map → number — 🐞 charts/type-switch-matrix.spec.ts › TS-create map → number [pinned] (saves map fields and styling; bug: saves map-only fields and map customizations on the number chart)
- [ ] Create builder: map → table — 🐞 charts/type-switch-matrix.spec.ts › TS-create map → table [pinned] (dims empty, saves map fields; bug: no table dimension; saves the map fields and map customizations)
- [ ] Create builder: map → pivot_table — 🐞 charts/type-switch-matrix.spec.ts › TS-create map → pivot_table [pinned] (disabled; bug: no pivot dimensions → Save disabled)
- [ ] Create builder: pivot_table → bar — 🐞 charts/type-switch-matrix.spec.ts › TS-create pivot_table → bar [pinned] (X empty, disabled; bug: X axis left empty → Save disabled)
- [ ] Create builder: pivot_table → line — 🐞 charts/type-switch-matrix.spec.ts › TS-create pivot_table → line [pinned] (X empty, disabled; bug: X axis left empty → Save disabled)
- [ ] Create builder: pivot_table → pie — 🐞 charts/type-switch-matrix.spec.ts › TS-create pivot_table → pie [pinned] (X empty, disabled; bug: X axis left empty → Save disabled)
- [ ] Create builder: pivot_table → number — 🐞 charts/type-switch-matrix.spec.ts › TS-create pivot_table → number [pinned] (1st metric; bug: legacy aggregate_func count sent with the kept metric)
- [ ] Create builder: pivot_table → table — 🐞 charts/type-switch-matrix.spec.ts › TS-create pivot_table → table [pinned] (dims=id, both metrics; bug: table dimension comes from auto-prefill (id), not the source dimension)
- [ ] Create builder: pivot_table → map — ✅ charts/type-switch-matrix.spec.ts › TS-create pivot_table → map (state=statename, OK)
- [ ] Edit builder: bar → line — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit bar → line [pinned] (keeps all; PUT 422; bug: update rejected 422: previous dataLabelPosition kept)
- [ ] Edit builder: bar → pie — ✅ charts/type-switch-matrix-edit.spec.ts › TS-edit bar → pie (X+extra, 1st metric)
- [ ] Edit builder: bar → number — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit bar → number [pinned] (1st metric, number defaults; bug: legacy aggregate_func count sent with the kept metric)
- [ ] Edit builder: bar → table — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit bar → table [pinned] (dims=id; table_columns=[statename,students,male_score]; bug: table dimension comes from auto-prefill (id), not the source dimension)
- [ ] Edit builder: bar → map — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit bar → map [pinned] (state=statename, 2 metric rows; bug: map keeps both metric rows)
- [ ] Edit builder: bar → pivot_table — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit bar → pivot_table [pinned] (disabled; bug: row/column dimensions reset → Save disabled)
- [ ] Edit builder: line → bar — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit line → bar [pinned] (keeps all; PUT 422; bug: update rejected 422: previous dataLabelPosition kept)
- [ ] Edit builder: line → pie — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit line → pie [pinned] (PUT 422; bug: update rejected 422: previous dataLabelPosition kept)
- [ ] Edit builder: line → number — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit line → number [pinned] (1st metric; bug: legacy aggregate_func count sent with the kept metric)
- [ ] Edit builder: line → table — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit line → table [pinned] (dims=id; bug: table dimension comes from auto-prefill (id), not the source dimension)
- [ ] Edit builder: line → map — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit line → map [pinned] (2 metric rows; bug: map keeps both metric rows)
- [ ] Edit builder: line → pivot_table — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit line → pivot_table [pinned] (disabled; bug: row/column dimensions reset → Save disabled)
- [ ] Edit builder: pie → bar — ✅ charts/type-switch-matrix-edit.spec.ts › TS-edit pie → bar (X+extra+metric, OK)
- [ ] Edit builder: pie → line — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit pie → line [pinned] (PUT 422; bug: update rejected 422: previous dataLabelPosition kept)
- [ ] Edit builder: pie → number — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit pie → number [pinned] (metric; bug: legacy aggregate_func count sent with the kept metric)
- [ ] Edit builder: pie → table — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit pie → table [pinned] (dims=id; bug: table dimension comes from auto-prefill (id), not the source dimension)
- [ ] Edit builder: pie → map — ✅ charts/type-switch-matrix-edit.spec.ts › TS-edit pie → map (state=statename, OK)
- [ ] Edit builder: pie → pivot_table — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit pie → pivot_table [pinned] (disabled; bug: row/column dimensions reset → Save disabled)
- [ ] Edit builder: number → bar — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit number → bar [pinned] (X empty, disabled; bug: X axis left empty → Save disabled)
- [ ] Edit builder: number → line — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit number → line [pinned] (X empty, disabled; bug: X axis left empty → Save disabled)
- [ ] Edit builder: number → pie — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit number → pie [pinned] (X empty, disabled; bug: X axis left empty → Save disabled)
- [ ] Edit builder: number → table — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit number → table [pinned] (dims=id; table_columns=[students]; subtitle kept; bug: table dimension comes from auto-prefill (id), not the source dimension)
- [ ] Edit builder: number → map — ✅ charts/type-switch-matrix-edit.spec.ts › TS-edit number → map (OK, subtitle kept)
- [ ] Edit builder: number → pivot_table — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit number → pivot_table [pinned] (disabled; bug: row/column dimensions reset → Save disabled)
- [ ] Edit builder: table → bar — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit table → bar [pinned] (X=id, aggregate column=country; bug: dimension/aggregate column taken from table_columns (id, country))
- [ ] Edit builder: table → line — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit table → line [pinned] (X=id, aggregate column=country; bug: dimension/aggregate column taken from table_columns (id, country))
- [ ] Edit builder: table → pie — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit table → pie [pinned] (X=id, aggregate column=country; bug: dimension/aggregate column taken from table_columns (id, country))
- [ ] Edit builder: table → number — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit table → number [pinned] (aggregate column=country; bug: dimension/aggregate column taken from table_columns (id, country))
- [ ] Edit builder: table → map — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit table → map [pinned] (state=id, value=country; bug: state column id / value column country taken from table_columns)
- [ ] Edit builder: table → pivot_table — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit table → pivot_table [pinned] (disabled; bug: row/column dimensions reset → Save disabled)
- [ ] Edit builder: map → bar — ✅ charts/type-switch-matrix-edit.spec.ts › TS-edit map → bar (X=statename, SUM students, OK)
- [ ] Edit builder: map → line — ✅ charts/type-switch-matrix-edit.spec.ts › TS-edit map → line (X=statename, SUM students, OK)
- [ ] Edit builder: map → pie — ✅ charts/type-switch-matrix-edit.spec.ts › TS-edit map → pie (X=statename, SUM students, OK)
- [ ] Edit builder: map → number — ✅ charts/type-switch-matrix-edit.spec.ts › TS-edit map → number (OK)
- [ ] Edit builder: map → table — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit map → table [pinned] (dims empty; bug: no table dimension; state column only lands in table_columns/x_axis_column)
- [ ] Edit builder: map → pivot_table — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit map → pivot_table [pinned] (disabled; bug: row/column dimensions reset → Save disabled)
- [ ] Edit builder: pivot_table → bar — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit pivot_table → bar [pinned] (X empty, disabled; bug: X axis left empty → Save disabled)
- [ ] Edit builder: pivot_table → line — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit pivot_table → line [pinned] (X empty, disabled; bug: X axis left empty → Save disabled)
- [ ] Edit builder: pivot_table → pie — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit pivot_table → pie [pinned] (X empty, disabled; bug: X axis left empty → Save disabled)
- [ ] Edit builder: pivot_table → number — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit pivot_table → number [pinned] (1st metric; bug: legacy aggregate_func count sent with the kept metric)
- [ ] Edit builder: pivot_table → table — 🐞 charts/type-switch-matrix-edit.spec.ts › TS-edit pivot_table → table [pinned] (dims=id; bug: table dimension comes from auto-prefill (id), not the source dimension)
- [ ] Edit builder: pivot_table → map — ✅ charts/type-switch-matrix-edit.spec.ts › TS-edit pivot_table → map (state=statename, OK)

### Builder permutations (prefill switch, round trip, chains, dataset change, fill order, metric tab cycling)

Behavior summary: [BUILDER-PERMUTATIONS.md](BUILDER-PERMUTATIONS.md). Each test's full step-by-step record is one journal baseline.

#### Chains of switches
- [ ] PERM-chains-create table → bar → pie → table — ✅ perm-chains.spec.ts
- [ ] PERM-chains-create pivot → line → number → pivot — 🐞 perm-chains.spec.ts (ends with Save disabled)
- [ ] PERM-chains-create map → bar → table → map — ✅ perm-chains.spec.ts
- [ ] PERM-chains-create number → pie → line → number — ✅ perm-chains.spec.ts
- [ ] PERM-chains-create bar → map → pivot → bar — 🐞 perm-chains.spec.ts (ends with Save disabled)
- [ ] PERM-chains-create line → table → map → line — 🐞 perm-chains.spec.ts (ends with Save disabled)
- [ ] PERM-chains-create pie → number → pivot → pie — 🐞 perm-chains.spec.ts (ends with Save disabled)
- [ ] PERM-chains-create bar → line → pie → number → table → map → pivot → bar — 🐞 perm-chains.spec.ts (ends with Save disabled)
- [ ] PERM-chains-edit table → bar → pie → table — ✅ perm-chains.spec.ts
- [ ] PERM-chains-edit pivot → line → number → pivot — 🐞 perm-chains.spec.ts (ends with Save disabled)
- [ ] PERM-chains-edit map → bar → table → map — ✅ perm-chains.spec.ts
- [ ] PERM-chains-edit number → pie → line → number — ✅ perm-chains.spec.ts
- [ ] PERM-chains-edit bar → map → pivot → bar — 🐞 perm-chains.spec.ts (ends with Save disabled)
- [ ] PERM-chains-edit line → table → map → line — ✅ perm-chains.spec.ts
- [ ] PERM-chains-edit pie → number → pivot → pie — 🐞 perm-chains.spec.ts (ends with Save disabled)
- [ ] PERM-chains-edit bar → line → pie → number → table → map → pivot → bar — 🐞 perm-chains.spec.ts (ends with Save disabled)

#### Dataset change after configuring
- [ ] PERM-dataset-create bar education → maternal — ✅ perm-dataset-change.spec.ts
- [ ] PERM-dataset-create line education → maternal — ✅ perm-dataset-change.spec.ts
- [ ] PERM-dataset-create pie education → maternal — ✅ perm-dataset-change.spec.ts
- [ ] PERM-dataset-create number education → maternal — ✅ perm-dataset-change.spec.ts
- [ ] PERM-dataset-create table education → maternal — 🐞 perm-dataset-change.spec.ts (table dimensions blanked + metrics emptied with no re-prefill; table_columns of the old dataset are kept and saved)
- [ ] PERM-dataset-create map education → maternal — 🐞 perm-dataset-change.spec.ts (map handleDatasetChange clears the state column and auto-prefill does not refill it → Save disabled)
- [ ] PERM-dataset-create pivot education → maternal — ✅ perm-dataset-change.spec.ts
- [ ] PERM-dataset-edit bar education → maternal — ✅ perm-dataset-change.spec.ts
- [ ] PERM-dataset-edit line education → maternal — ✅ perm-dataset-change.spec.ts
- [ ] PERM-dataset-edit pie education → maternal — ✅ perm-dataset-change.spec.ts
- [ ] PERM-dataset-edit number education → maternal — ✅ perm-dataset-change.spec.ts
- [ ] PERM-dataset-edit table education → maternal — 🐞 perm-dataset-change.spec.ts (table dimensions blanked + metrics emptied with no re-prefill; table_columns of the old dataset are kept and saved)
- [ ] PERM-dataset-edit map education → maternal — 🐞 perm-dataset-change.spec.ts (map handleDatasetChange clears the state column and auto-prefill does not refill it → Save disabled)
- [ ] PERM-dataset-edit pivot education → maternal — ✅ perm-dataset-change.spec.ts

#### Fill order
- [ ] PERM-fill-create bar (a) metrics→dims vs (b) dims→metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-create bar (c) dims → switch to line → metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-create bar (d) remove all metrics → switch to line — 🐞 perm-fill-order.spec.ts
- [ ] PERM-fill-create bar (e) dimension dependencies / date dimension and back — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-create line (a) metrics→dims vs (b) dims→metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-create line (c) dims → switch to bar → metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-create line (d) remove all metrics → switch to bar — 🐞 perm-fill-order.spec.ts
- [ ] PERM-fill-create line (e) dimension dependencies / date dimension and back — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-create pie (a) metrics→dims vs (b) dims→metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-create pie (c) dims → switch to bar → metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-create pie (d) remove all metrics → switch to bar — 🐞 perm-fill-order.spec.ts
- [ ] PERM-fill-create pie (e) dimension dependencies / date dimension and back — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-create table (a) metrics→dims vs (b) dims→metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-create table (c) dims → switch to bar → metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-create table (d) remove all metrics → switch to bar — 🐞 perm-fill-order.spec.ts
- [ ] PERM-fill-create table (e) dimension dependencies / date dimension and back — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-create pivot (a) metrics→dims vs (b) dims→metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-create pivot (c) dims → switch to table → metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-create pivot (d) remove all metrics → switch to table — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-create pivot (e) dimension dependencies / date dimension and back — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-create map (a) metrics→dims vs (b) dims→metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-create map (c) dims → switch to bar → metrics — 🐞 perm-fill-order.spec.ts
- [ ] PERM-fill-create map (d) remove all metrics → switch to bar — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-create map (e) dimension dependencies / date dimension and back — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-edit bar (a) metrics→dims vs (b) dims→metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-edit bar (c) dims → switch to line → metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-edit bar (d) remove all metrics → switch to line — 🐞 perm-fill-order.spec.ts
- [ ] PERM-fill-edit bar (e) dimension dependencies / date dimension and back — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-edit line (a) metrics→dims vs (b) dims→metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-edit line (c) dims → switch to bar → metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-edit line (d) remove all metrics → switch to bar — 🐞 perm-fill-order.spec.ts
- [ ] PERM-fill-edit line (e) dimension dependencies / date dimension and back — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-edit pie (a) metrics→dims vs (b) dims→metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-edit pie (c) dims → switch to bar → metrics — 🐞 perm-fill-order.spec.ts
- [ ] PERM-fill-edit pie (d) remove all metrics → switch to bar — 🐞 perm-fill-order.spec.ts
- [ ] PERM-fill-edit pie (e) dimension dependencies / date dimension and back — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-edit table (a) metrics→dims vs (b) dims→metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-edit table (c) dims → switch to bar → metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-edit table (d) remove all metrics → switch to bar — 🐞 perm-fill-order.spec.ts
- [ ] PERM-fill-edit table (e) dimension dependencies / date dimension and back — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-edit pivot (a) metrics→dims vs (b) dims→metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-edit pivot (c) dims → switch to table → metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-edit pivot (d) remove all metrics → switch to table — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-edit pivot (e) dimension dependencies / date dimension and back — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-edit map (a) metrics→dims vs (b) dims→metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-edit map (c) dims → switch to bar → metrics — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-edit map (d) remove all metrics → switch to bar — ✅ perm-fill-order.spec.ts
- [ ] PERM-fill-edit map (e) dimension dependencies / date dimension and back — ✅ perm-fill-order.spec.ts

#### Metric tab cycling (Simple → Calculated → Saved → Simple)
- [ ] PERM-metric-tabs-create bar row 0 simple → calculated → saved → simple — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-create bar row 1 cycle, row 0 untouched — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-create line row 0 simple → calculated → saved → simple — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-create line row 1 cycle, row 0 untouched — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-create pie row 0 simple → calculated → saved → simple — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-create number row 0 simple → calculated → saved → simple — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-create table row 0 simple → calculated → saved → simple — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-create table row 1 cycle, row 0 untouched — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-create map row 0 simple → calculated → saved → simple — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-create pivot row 0 simple → calculated → saved → simple — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-create pivot row 1 cycle, row 0 untouched — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-edit bar row 0 simple → calculated → saved → simple — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-edit bar row 1 cycle, row 0 untouched — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-edit line row 0 simple → calculated → saved → simple — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-edit line row 1 cycle, row 0 untouched — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-edit pie row 0 simple → calculated → saved → simple — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-edit number row 0 simple → calculated → saved → simple — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-edit table row 0 simple → calculated → saved → simple — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-edit table row 1 cycle, row 0 untouched — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-edit map row 0 simple → calculated → saved → simple — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-edit pivot row 0 simple → calculated → saved → simple — ✅ perm-metric-tabs.spec.ts
- [ ] PERM-metric-tabs-edit pivot row 1 cycle, row 0 untouched — ✅ perm-metric-tabs.spec.ts

#### Prefill-only switch (every type → every type)
- [ ] PERM-prefill-create bar → line — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create bar → pie — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create bar → number — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create bar → table — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create bar → map — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create bar → pivot — 🐞 perm-prefill-switch.spec.ts (handleChartTypeChange resets pivot row/column dimensions to [] → Save disabled)
- [ ] PERM-prefill-create line → bar — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create line → pie — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create line → number — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create line → table — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create line → map — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create line → pivot — 🐞 perm-prefill-switch.spec.ts (handleChartTypeChange resets pivot row/column dimensions to [] → Save disabled)
- [ ] PERM-prefill-create pie → bar — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create pie → line — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create pie → number — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create pie → table — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create pie → map — 🐞 perm-prefill-switch.spec.ts (pie legendPosition 'right' carried into map customizations → save 422 (map needs a corner))
- [ ] PERM-prefill-create pie → pivot — 🐞 perm-prefill-switch.spec.ts (handleChartTypeChange resets pivot row/column dimensions to [] → Save disabled)
- [ ] PERM-prefill-create number → bar — 🐞 perm-prefill-switch.spec.ts (source has no dimension_column; the switch copies the empty one over auto-prefill → Save disabled)
- [ ] PERM-prefill-create number → line — 🐞 perm-prefill-switch.spec.ts (source has no dimension_column; the switch copies the empty one over auto-prefill → Save disabled)
- [ ] PERM-prefill-create number → pie — 🐞 perm-prefill-switch.spec.ts (source has no dimension_column; the switch copies the empty one over auto-prefill → Save disabled)
- [ ] PERM-prefill-create number → table — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create number → map — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create number → pivot — 🐞 perm-prefill-switch.spec.ts (handleChartTypeChange resets pivot row/column dimensions to [] → Save disabled)
- [ ] PERM-prefill-create table → bar — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create table → line — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create table → pie — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create table → number — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create table → map — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create table → pivot — 🐞 perm-prefill-switch.spec.ts (handleChartTypeChange resets pivot row/column dimensions to [] → Save disabled)
- [ ] PERM-prefill-create map → bar — 🐞 perm-prefill-switch.spec.ts (MapDataConfigurationV3 switches with {chart_type} only (no keep/trim, no prefill) → no dimension, Save disabled)
- [ ] PERM-prefill-create map → line — 🐞 perm-prefill-switch.spec.ts (MapDataConfigurationV3 switches with {chart_type} only (no keep/trim, no prefill) → no dimension, Save disabled)
- [ ] PERM-prefill-create map → pie — 🐞 perm-prefill-switch.spec.ts (MapDataConfigurationV3 switches with {chart_type} only (no keep/trim, no prefill) → no dimension, Save disabled)
- [ ] PERM-prefill-create map → number — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create map → table — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create map → pivot — 🐞 perm-prefill-switch.spec.ts (handleChartTypeChange resets pivot row/column dimensions to [] → Save disabled)
- [ ] PERM-prefill-create pivot → bar — 🐞 perm-prefill-switch.spec.ts (source has no dimension_column; the switch copies the empty one over auto-prefill → Save disabled)
- [ ] PERM-prefill-create pivot → line — 🐞 perm-prefill-switch.spec.ts (source has no dimension_column; the switch copies the empty one over auto-prefill → Save disabled)
- [ ] PERM-prefill-create pivot → pie — 🐞 perm-prefill-switch.spec.ts (source has no dimension_column; the switch copies the empty one over auto-prefill → Save disabled)
- [ ] PERM-prefill-create pivot → number — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create pivot → table — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-create pivot → map — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit bar → line — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit bar → pie — 🐞 perm-prefill-switch.spec.ts (edit handleFormChange re-applies the old dataLabelPosition over the sanitized one → save 422)
- [ ] PERM-prefill-edit bar → number — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit bar → table — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit bar → map — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit bar → pivot — 🐞 perm-prefill-switch.spec.ts (handleChartTypeChange resets pivot row/column dimensions to [] → Save disabled)
- [ ] PERM-prefill-edit line → bar — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit line → pie — 🐞 perm-prefill-switch.spec.ts (edit handleFormChange re-applies the old dataLabelPosition over the sanitized one → save 422)
- [ ] PERM-prefill-edit line → number — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit line → table — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit line → map — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit line → pivot — 🐞 perm-prefill-switch.spec.ts (handleChartTypeChange resets pivot row/column dimensions to [] → Save disabled)
- [ ] PERM-prefill-edit pie → bar — 🐞 perm-prefill-switch.spec.ts (edit handleFormChange re-applies the old dataLabelPosition over the sanitized one → save 422)
- [ ] PERM-prefill-edit pie → line — 🐞 perm-prefill-switch.spec.ts (edit handleFormChange re-applies the old dataLabelPosition over the sanitized one → save 422)
- [ ] PERM-prefill-edit pie → number — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit pie → table — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit pie → map — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit pie → pivot — 🐞 perm-prefill-switch.spec.ts (handleChartTypeChange resets pivot row/column dimensions to [] → Save disabled)
- [ ] PERM-prefill-edit number → bar — 🐞 perm-prefill-switch.spec.ts (source has no dimension_column; the switch copies the empty one over auto-prefill → Save disabled)
- [ ] PERM-prefill-edit number → line — 🐞 perm-prefill-switch.spec.ts (source has no dimension_column; the switch copies the empty one over auto-prefill → Save disabled)
- [ ] PERM-prefill-edit number → pie — 🐞 perm-prefill-switch.spec.ts (source has no dimension_column; the switch copies the empty one over auto-prefill → Save disabled)
- [ ] PERM-prefill-edit number → table — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit number → map — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit number → pivot — 🐞 perm-prefill-switch.spec.ts (handleChartTypeChange resets pivot row/column dimensions to [] → Save disabled)
- [ ] PERM-prefill-edit table → bar — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit table → line — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit table → pie — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit table → number — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit table → map — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit table → pivot — 🐞 perm-prefill-switch.spec.ts (handleChartTypeChange resets pivot row/column dimensions to [] → Save disabled)
- [ ] PERM-prefill-edit map → bar — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit map → line — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit map → pie — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit map → number — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit map → table — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit map → pivot — 🐞 perm-prefill-switch.spec.ts (handleChartTypeChange resets pivot row/column dimensions to [] → Save disabled)
- [ ] PERM-prefill-edit pivot → bar — 🐞 perm-prefill-switch.spec.ts (source has no dimension_column; the switch copies the empty one over auto-prefill → Save disabled)
- [ ] PERM-prefill-edit pivot → line — 🐞 perm-prefill-switch.spec.ts (source has no dimension_column; the switch copies the empty one over auto-prefill → Save disabled)
- [ ] PERM-prefill-edit pivot → pie — 🐞 perm-prefill-switch.spec.ts (source has no dimension_column; the switch copies the empty one over auto-prefill → Save disabled)
- [ ] PERM-prefill-edit pivot → number — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit pivot → table — ✅ perm-prefill-switch.spec.ts
- [ ] PERM-prefill-edit pivot → map — ✅ perm-prefill-switch.spec.ts

#### Round trip A → B → A
- [ ] PERM-roundtrip-create bar control (no switch) saves FULL_SOURCE — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create bar → line → bar — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create bar → pie → bar — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create bar → number → bar — 🐞 perm-roundtrip.spec.ts (X axis cleared on the way; auto-prefill runs once per type so it is not refilled → Save disabled)
- [ ] PERM-roundtrip-create bar → table → bar — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create bar → map → bar — 🐞 perm-roundtrip.spec.ts (X axis cleared on the way; auto-prefill runs once per type so it is not refilled → Save disabled)
- [ ] PERM-roundtrip-create bar → pivot → bar — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create line control (no switch) saves FULL_SOURCE — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create line → bar → line — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create line → pie → line — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create line → number → line — 🐞 perm-roundtrip.spec.ts (X axis cleared on the way; auto-prefill runs once per type so it is not refilled → Save disabled)
- [ ] PERM-roundtrip-create line → table → line — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create line → map → line — 🐞 perm-roundtrip.spec.ts (X axis cleared on the way; auto-prefill runs once per type so it is not refilled → Save disabled)
- [ ] PERM-roundtrip-create line → pivot → line — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create pie control (no switch) saves FULL_SOURCE — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create pie → bar → pie — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create pie → line → pie — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create pie → number → pie — 🐞 perm-roundtrip.spec.ts (X axis cleared on the way; auto-prefill runs once per type so it is not refilled → Save disabled)
- [ ] PERM-roundtrip-create pie → table → pie — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create pie → map → pie — 🐞 perm-roundtrip.spec.ts (X axis cleared on the way; auto-prefill runs once per type so it is not refilled → Save disabled)
- [ ] PERM-roundtrip-create pie → pivot → pie — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create number control (no switch) saves FULL_SOURCE — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create number → bar → number — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create number → line → number — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create number → pie → number — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create number → table → number — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create number → map → number — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create number → pivot → number — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create table control (no switch) saves FULL_SOURCE — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create table → bar → table — 🐞 perm-roundtrip.spec.ts (table dimensions come back as auto-prefill (id), not statename/districtname)
- [ ] PERM-roundtrip-create table → line → table — 🐞 perm-roundtrip.spec.ts (table dimensions come back as auto-prefill (id), not statename/districtname)
- [ ] PERM-roundtrip-create table → pie → table — 🐞 perm-roundtrip.spec.ts (table dimensions come back as auto-prefill (id), not statename/districtname)
- [ ] PERM-roundtrip-create table → number → table — 🐞 perm-roundtrip.spec.ts (table dimensions come back as auto-prefill (id), not statename/districtname)
- [ ] PERM-roundtrip-create table → map → table — 🐞 perm-roundtrip.spec.ts (table dimensions come back as auto-prefill (id), not statename/districtname)
- [ ] PERM-roundtrip-create table → pivot → table — 🐞 perm-roundtrip.spec.ts (table dimensions come back as auto-prefill (id), not statename/districtname)
- [ ] PERM-roundtrip-create map control (no switch) saves FULL_SOURCE — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create map → bar → map — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create map → line → map — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create map → pie → map — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create map → number → map — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create map → table → map — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create map → pivot → map — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create pivot_table control (no switch) saves FULL_SOURCE — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-create pivot → bar → pivot — 🐞 perm-roundtrip.spec.ts (pivot row/column dimensions reset to [] on the way back → Save disabled)
- [ ] PERM-roundtrip-create pivot → line → pivot — 🐞 perm-roundtrip.spec.ts (pivot row/column dimensions reset to [] on the way back → Save disabled)
- [ ] PERM-roundtrip-create pivot → pie → pivot — 🐞 perm-roundtrip.spec.ts (pivot row/column dimensions reset to [] on the way back → Save disabled)
- [ ] PERM-roundtrip-create pivot → number → pivot — 🐞 perm-roundtrip.spec.ts (pivot row/column dimensions reset to [] on the way back → Save disabled)
- [ ] PERM-roundtrip-create pivot → table → pivot — 🐞 perm-roundtrip.spec.ts (pivot row/column dimensions reset to [] on the way back → Save disabled)
- [ ] PERM-roundtrip-create pivot → map → pivot — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-edit bar control (no switch) saves FULL_SOURCE — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-edit bar → line → bar — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit bar → pie → bar — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit bar → number → bar — 🐞 perm-roundtrip.spec.ts (X axis cleared on the way; auto-prefill runs once per type so it is not refilled → Save disabled; edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit bar → table → bar — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit bar → map → bar — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit bar → pivot → bar — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit line control (no switch) saves FULL_SOURCE — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-edit line → bar → line — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit line → pie → line — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit line → number → line — 🐞 perm-roundtrip.spec.ts (X axis cleared on the way; auto-prefill runs once per type so it is not refilled → Save disabled; edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit line → table → line — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit line → map → line — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit line → pivot → line — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit pie control (no switch) saves FULL_SOURCE — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-edit pie → bar → pie — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit pie → line → pie — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit pie → number → pie — 🐞 perm-roundtrip.spec.ts (X axis cleared on the way; auto-prefill runs once per type so it is not refilled → Save disabled; edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit pie → table → pie — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit pie → map → pie — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit pie → pivot → pie — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit number control (no switch) saves FULL_SOURCE — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-edit number → bar → number — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit number → line → number — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit number → pie → number — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit number → table → number — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit number → map → number — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit number → pivot → number — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit table control (no switch) saves FULL_SOURCE — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-edit table → bar → table — 🐞 perm-roundtrip.spec.ts (table dimensions come back as auto-prefill (id), not statename/districtname; edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit table → line → table — 🐞 perm-roundtrip.spec.ts (table dimensions come back as auto-prefill (id), not statename/districtname; edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit table → pie → table — 🐞 perm-roundtrip.spec.ts (table dimensions come back as auto-prefill (id), not statename/districtname; edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit table → number → table — 🐞 perm-roundtrip.spec.ts (table dimensions come back as auto-prefill (id), not statename/districtname; edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit table → map → table — 🐞 perm-roundtrip.spec.ts (table dimensions come back as auto-prefill (id), not statename/districtname; edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit table → pivot → table — 🐞 perm-roundtrip.spec.ts (table dimensions come back as auto-prefill (id), not statename/districtname; edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit map control (no switch) saves FULL_SOURCE — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-edit map → bar → map — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit map → line → map — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit map → pie → map — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit map → number → map — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit map → table → map — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit map → pivot → map — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit pivot_table control (no switch) saves FULL_SOURCE — ✅ perm-roundtrip.spec.ts
- [ ] PERM-roundtrip-edit pivot → bar → pivot — 🐞 perm-roundtrip.spec.ts (pivot row/column dimensions reset to [] on the way back → Save disabled; edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit pivot → line → pivot — 🐞 perm-roundtrip.spec.ts (pivot row/column dimensions reset to [] on the way back → Save disabled; edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit pivot → pie → pivot — 🐞 perm-roundtrip.spec.ts (pivot row/column dimensions reset to [] on the way back → Save disabled; edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit pivot → number → pivot — 🐞 perm-roundtrip.spec.ts (pivot row/column dimensions reset to [] on the way back → Save disabled; edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit pivot → table → pivot — 🐞 perm-roundtrip.spec.ts (pivot row/column dimensions reset to [] on the way back → Save disabled; edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))
- [ ] PERM-roundtrip-edit pivot → map → pivot — 🐞 perm-roundtrip.spec.ts (edit handleFormChange replaces customizations with the type defaults (orientation, lineStyle, chartStyle, colorScheme, … lost))

### Edit a chart (`/charts/[id]/edit`)

- [ ] Edit loads a bar chart's dataset, X axis and metric — ✅ charts/edit.spec.ts › C-E1 bar
- [ ] Edit loads a line chart's date X axis and Month grain — ✅ charts/edit.spec.ts › C-E1 line
- [ ] Edit loads a pie chart's dimension and single metric — ✅ charts/edit.spec.ts › C-E1 pie
- [ ] Edit loads a number chart's metric and subtitle — ✅ charts/edit.spec.ts › C-E1 number
- [ ] Edit loads a map chart's state column and district drill-down — ✅ charts/edit.spec.ts › C-E1 map
- [ ] Edit loads a table chart's dimensions and drill-down switch — ✅ charts/edit.spec.ts › C-E1 table
- [ ] Edit loads a pivot's row and column dimensions and totals — ✅ charts/edit.spec.ts › C-E1 pivot
- [ ] Missing chart shows "Chart not found" / "Chart needs attention" — ✅ charts/edit.spec.ts › C-E1 missing chart
- [ ] A member without edit access sees "Access Denied" and "Back to Charts" — ✅ charts/edit.spec.ts › C-E1 member
- [ ] Loading skeleton — ✅ charts/gaps-edit-detail.spec.ts › GAP-C edit loading skeleton while the chart loads
- [ ] Save › Update existing chart saves the update, lands on detail, "Chart updated successfully!" — ✅ charts/edit.spec.ts › C-E2
- [ ] Save › Save as new chart: name pre-filled, blank disabled, BACK and back arrow, name trimmed, new chart created — ✅ charts/edit.spec.ts › C-E3
- [ ] Save failure toasts (update and create) — 🐞 charts/gaps-edit-detail.spec.ts › [pinned] GAP-C edit update failure / save-as-new failure shows the backend error toast (×2; the fallback texts can never appear because lib/api.ts passes the backend detail through)
- [ ] No changes: Cancel and Back go straight to the detail page — ✅ charts/edit.spec.ts › C-E4 no changes
- [ ] Cancel with changes › Stay keeps editing; Leave discards without saving — ✅ charts/edit.spec.ts › C-E4 Cancel with changes
- [ ] Cancel with changes › Save and leave › Update, then return to /charts — ✅ charts/edit.spec.ts › C-E4 Save and leave
- [ ] Back with changes: "Unsaved Changes" confirm with Cancel and LEAVE WITHOUT SAVING — ✅ charts/edit.spec.ts › C-E4 Back with changes
- [ ] Undoing your change clears the "unsaved" state — ✅ charts/edit.spec.ts › C-E4 reverting
- [ ] Incomplete config: warning overlay, Save disabled, last good chart kept, click to dismiss, fixing the config clears it — ✅ charts/edit.spec.ts › C-E5
- [ ] Incomplete-config overlay is not shown for map and table charts — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C edit incomplete-config overlay is not shown for a map chart / for a table chart (×2)
- [ ] Opened from a dashboard: "Back to Dashboard", and Back and Cancel return there — ✅ charts/edit.spec.ts › C-E6 ?from=dashboard
- [ ] Opened from a report: "Back to Report", and Back and Cancel return there — ✅ charts/edit.spec.ts › C-E6 ?from=report
- [ ] Opened from a dashboard: update replaces history, detail keeps `from`, browser Back returns to the dashboard — ✅ charts/edit.spec.ts › C-E6 update replaces history
- [ ] Opened from a report: Leave without saving returns to the report — ✅ charts/edit.spec.ts › C-E6 ?from=report with changes
- [ ] Bar: the create and edit builders use different defaults — 🐞 charts/edit.spec.ts › [pinned] C-E7 bar create / edit (count vs sum, legend defaults, preview page size 20 vs 25)
- [ ] Pie: the create and edit builders use different defaults — 🐞 charts/edit.spec.ts › [pinned] C-E7 pie create / edit
- [ ] Data preview page size resets to 25 when the row limit changes — 🐞 charts/gaps-map-table-pivot.spec.ts › [pinned] GAP-C edit data preview page size resets to 25 when the row limit changes (25 is not a Rows-per-page option, so the dropdown shows blank)

### Chart detail page (`/charts/[id]`)

- [ ] Bar chart renders (data request + screenshot) — ✅ charts/detail.spec.ts › C-D1 bar
- [ ] Line chart renders — ✅ charts/detail.spec.ts › C-D1 line
- [ ] Pie chart renders — ✅ charts/detail.spec.ts › C-D1 pie
- [ ] Number chart renders — ✅ charts/detail.spec.ts › C-D1 number
- [ ] Map chart renders — ✅ charts/detail.spec.ts › C-D1 map
- [ ] Table chart renders — ✅ charts/detail.spec.ts › C-D1 table
- [ ] Pivot table renders — ✅ charts/detail.spec.ts › C-D1 pivot_table
- [ ] Seed charts render (bar, line, pie, map, table with "Page 1 of N", pivot with grand total) — ✅ charts/detail.spec.ts › C-D1 seeded <type> (×6)
- [ ] Title and "Created by" line — ✅ charts/detail.spec.ts › C-D1 <type>
- [ ] Missing chart shows "Chart isn't ready yet…" — ✅ charts/detail.spec.ts › C-D1 missing chart
- [ ] "Access Denied" without the view-charts permission — ✅ charts/gaps-edit-detail.spec.ts › GAP-C detail Access Denied without the view-charts permission
- [ ] Edit Chart link — ✅ charts/detail.spec.ts › C-D2 Edit Chart link
- [ ] Share button opens and closes the Share modal — ✅ charts/detail.spec.ts › C-D2 Share button
- [ ] `?openShare=true` opens Share on load; closing removes the parameter — ✅ charts/detail.spec.ts › C-D2 ?openShare=true
- [ ] A view-only member sees no Edit or Share, sees the Request Edit pill, and can still export — ✅ charts/detail.spec.ts › C-D2 member
- [ ] Request Edit on a chart sends the request (dialog, "sent" state) — ✅ charts/gaps-edit-detail.spec.ts › GAP-C detail Request Edit sends the request and shows the sent state
- [ ] Export menu for bar lists PNG, PDF and CSV — ✅ charts/detail.spec.ts › C-D3 bar export menu
- [ ] Export menu for line lists PNG, PDF and CSV — ✅ charts/detail.spec.ts › C-D3 line export menu
- [ ] Export menu for pie lists PNG, PDF and CSV — ✅ charts/detail.spec.ts › C-D3 pie export menu
- [ ] Export menu for number lists PNG, PDF and CSV — ✅ charts/detail.spec.ts › C-D3 number export menu
- [ ] Export menu for map lists PNG, PDF and CSV — ✅ charts/detail.spec.ts › C-D3 map export menu
- [ ] Export bar / line / pie / number / map as PNG — ✅ charts/detail.spec.ts › C-D3 <type> export PNG (×5)
- [ ] Export bar / line / pie / number / map as PDF — ✅ charts/detail.spec.ts › C-D3 <type> export PDF (×5)
- [ ] Exported PDF carries the org logo — ✅ charts/gaps-edit-detail.spec.ts › GAP-C detail exported PDF carries the org logo
- [ ] Export bar / line / pie / number / map data as CSV — 🐞 charts/detail.spec.ts › [pinned] C-D3 <type> export CSV (×5; the filename has the timestamp twice)
- [ ] Export menu for table and pivot lists PNG and CSV only (no PDF) — ✅ charts/detail.spec.ts › C-D3 table / pivot_table export menu
- [ ] Export table and pivot as PNG — ✅ charts/detail.spec.ts › C-D3 table / pivot_table export PNG
- [ ] Export a table as CSV — 🐞 charts/detail.spec.ts › [pinned] C-D3 table export CSV (timestamp twice)
- [ ] Export a pivot as CSV — 🐞 charts/detail.spec.ts › [pinned] C-D3 pivot export CSV (built in the browser; always says "Grand Total", ignoring a custom label)
- [ ] Export failure shows "Export Failed" — ✅ charts/gaps-edit-detail.spec.ts › GAP-C detail export failure shows "Export Failed"
- [ ] Table drill-down: click a cell, filtered data, "← Back"; export reads "Export current view" and the filename includes the drill value — ✅ charts/detail.spec.ts › C-D4 table drill-down; charts/builder-table.spec.ts › C-D4 table drill-down on detail
- [ ] Map drill-down with a hierarchy: toast, breadcrumb, district data, then "No further drill-down levels configured", Home — ✅ charts/builder-map.spec.ts › C-D4 hierarchy drill; charts/detail.spec.ts › C-D4 map drill-down
- [ ] Map with no drill config: "No further drill-down levels configured" plus hint — ✅ charts/builder-map.spec.ts › C-D4 no drill config
- [ ] Map with an old-style district column: "Drilling down to districts in …", Back — ✅ charts/builder-map.spec.ts › C-D4 legacy district_column
- [ ] Map with old-style layers: an unconfigured region says "not configured for drill-down" — ✅ charts/builder-map.spec.ts › C-D4 legacy layers
- [ ] Map "X excluded by filter" toast — 🐞 charts/builder-map.spec.ts › [pinned] C-D4 legacy layers + not_equals (never shows: the detail page checks '!=' but the builder saves 'not_equals')
- [ ] Map "Region X not found in database" toast — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C detail map "Region X not found in database" toast
- [ ] Filtered map with no data: one toast per filter, then a hint — 🐞 charts/gaps-map-table-pivot.spec.ts › [pinned] GAP-C detail filtered map with no data: one toast per filter, then a hint (an excluded region reads "filtered": the builder saves `not_equals`, the toast only knows `!=`)
- [ ] "Edit Chart" action inside map toasts (editors only) — ✅ charts/gaps-map-table-pivot.spec.ts › GAP-C detail map toast "Edit Chart" action opens the edit page; map toasts have no "Edit Chart" action without edit permission; "not configured" toast: Edit Chart for editors only (×3)
- [ ] Map zoom in / out — ✅ charts/detail.spec.ts › C-D4 map zoom
- [ ] Plain Back goes to /charts — ✅ charts/detail.spec.ts › C-D5 plain Back
- [ ] Opened from a dashboard: "Back to Dashboard" goes back; the Edit link keeps `from` — ✅ charts/detail.spec.ts › C-D5 ?from=dashboard
- [ ] Opened from a report: "Back to Report" goes back; the Edit link keeps `from` — ✅ charts/detail.spec.ts › C-D5 ?from=report
- [ ] An unknown `from` value falls back to plain Back — ✅ charts/detail.spec.ts › C-D5 unknown ?from
- [ ] "Congratulations, your Chart is live!" modal with "Add to Dashboard" (onboarding) — 🧑 manual (see MANUAL-CHECKS.md)

### Chart sharing

- [ ] Share modal opens for a chart from the list and from the detail page — ✅ charts/list.spec.ts › C-L13; charts/detail.spec.ts › C-D2
- [ ] Chart general access (Default / Private / Public) and people grants — 🐞 charts/gaps-edit-detail.spec.ts › [pinned] GAP-C chart general access Default → Private → Default (no Public option: backend sends `supports_public=false`); ✅ charts/gaps-edit-detail.spec.ts › GAP-C chart people grant: member gets view access, then revoke

---

## Dashboards

### Dashboard list (`/dashboards`)

- [ ] Page loads; the org-default dashboard is pinned first with an "Org Default" badge; counter and page info shown — ✅ dashboards/list.spec.ts › D-L1
- [ ] "My Landing" badge on your landing dashboard — ✅ dashboards/list.spec.ts › D-L5 set / remove my landing
- [ ] Default sort is last modified, newest first — ✅ dashboards/list.spec.ts › D-L2
- [ ] Sort by Last Modified toggles — ✅ dashboards/list.spec.ts › D-L2
- [ ] Sort by Name (desc, then asc) — ✅ dashboards/list.spec.ts › D-L2
- [ ] Sort by Owner — ✅ dashboards/list-gaps.spec.ts › GAP-D sort by Owner orders by owner email, desc then asc
- [ ] Filter by name — ✅ dashboards/list.spec.ts › D-L3
- [ ] Filter "Show only favorites" — ✅ dashboards/list.spec.ts › D-L3
- [ ] Filter "Show only locked" (with the "By You" badge) — ✅ dashboards/list.spec.ts › D-L3
- [ ] Filter "Show only shared" — 🐞 dashboards/list.spec.ts › D-L3 [pinned] (always empty: the list API does not return `is_public`)
- [ ] Filter by owner (search, "No owners found", pick an owner) — ✅ dashboards/list.spec.ts › D-L3
- [ ] Date modified filter: Today — ✅ dashboards/list.spec.ts › D-L3
- [ ] Date modified filter: Custom range — ✅ dashboards/list.spec.ts › D-L3
- [ ] Date modified filter: Last 7 days and Last 30 days — ✅ dashboards/list-gaps.spec.ts › GAP-D date modified filter: Last 7 days and Last 30 days
- [ ] Clear button in the date popover resets only that column — ✅ dashboards/list.spec.ts › D-L3
- [ ] Clear buttons in the name and owner popovers — ✅ dashboards/list-gaps.spec.ts › GAP-D Clear buttons in the name and owner popovers
- [ ] "N filter(s) active" summary and Clear all — ✅ dashboards/list.spec.ts › D-L3
- [ ] Empty filtered list hides the header; the counter keeps the unfiltered total — 🐞 dashboards/list.spec.ts › D-L3 (pinned inline)
- [ ] Empty state "No dashboards found" with a create button — ✅ dashboards/list.spec.ts › D-L3 [pinned] shared
- [ ] Empty state "No dashboards yet" for an org with no dashboards — ✅ dashboards/list-gaps.spec.ts › GAP-D empty state "No dashboards yet" (list response mocked empty)
- [ ] Favorite toggle on and off, persists across reload — ✅ dashboards/list.spec.ts › D-L4
- [ ] Favorite failure toast — ✅ dashboards/list-gaps.spec.ts › GAP-D favorite failure shows an error toast and keeps the dashboard unfavorited
- [ ] Title link opens the dashboard — ✅ dashboards/list-gaps.spec.ts › GAP-D title link opens the dashboard view
- [ ] Edit icon opens the builder — ✅ dashboards/list-gaps.spec.ts › GAP-D edit icon opens the builder
- [ ] Share icon opens the Share modal from the list — ✅ dashboards/list-gaps.spec.ts › GAP-D share icon opens the Share modal from the list
- [ ] Create Dashboard button goes to /dashboards/create — ✅ dashboards/list-gaps.spec.ts › GAP-D Create Dashboard button goes to /dashboards/create and on to the builder
- [ ] Row menu: Set as my landing page, and Remove it — ✅ dashboards/list.spec.ts › D-L5 set / remove my landing
- [ ] Row menu: Set as org default — 🧑 manual (see MANUAL-CHECKS.md)
- [ ] Row menu: org-default item is disabled on the current org default ("Current org default") — ✅ dashboards/list.spec.ts › D-L5 org default item is disabled
- [ ] Row menu: Duplicate creates "Copy of X" — 🐞 dashboards/list.spec.ts › D-L5 [pinned] duplicate (the toast says `Chart "X" duplicated`)
- [ ] Row menu: Delete with confirm (Cancel keeps it, Delete removes it with a toast) — ✅ dashboards/list.spec.ts › D-L5 delete
- [ ] After Cancel in the delete dialog, the row menu stays open and blocks clicks — 🐞 dashboards/list.spec.ts › D-L5 delete (pinned inline)
- [ ] Pagination Next / Prev; pinned rows repeat on every page — ✅ dashboards/list.spec.ts › D-L6
- [ ] Changing page size goes back to page 1 — ✅ dashboards/list.spec.ts › D-L6 (size 20 only)
- [ ] Lock badge "By You" for the editor and "Locked" for another user — ✅ dashboards/list.spec.ts › D-L7
- [ ] Loading skeleton, and "Failed to load dashboards" with Retry — ✅ dashboards/list-gaps.spec.ts › GAP-D loading skeleton, then "Failed to load dashboards" with Retry
- [ ] Create, Duplicate and Delete hidden without the matching permission — ✅ dashboards/list-gaps.spec.ts › GAP-D Create, Duplicate and Delete are hidden without the matching permission

### Create a dashboard (`/dashboards/create`)

- [ ] Opening /dashboards/create creates "Untitled Dashboard", shows a toast, and lands on /edit?new=true with the title field focused — ✅ dashboards/builder.spec.ts › D-B1
- [ ] Renaming right after creation saves — ✅ dashboards/builder.spec.ts › D-B1
- [ ] "Access Denied" without the create-dashboards permission — ✅ dashboards/gaps-builder.spec.ts › GAP-D create: "Access Denied" without the create-dashboards permission
- [ ] A create failure shows a toast and returns to /dashboards — ✅ dashboards/gaps-builder.spec.ts › GAP-D create: a create failure shows a toast and returns to /dashboards

### Builder header, save and undo

- [ ] Rename by clicking the title, then Enter — ✅ dashboards/builder.spec.ts › D-B2 title
- [ ] Rename, then click away (blur) — ✅ dashboards/builder.spec.ts › D-B2 title
- [ ] An empty title becomes "Untitled Dashboard" — ✅ dashboards/builder.spec.ts › D-B2 title
- [ ] Description: "+ Add description", 100-character limit with an "n/100" counter — ✅ dashboards/builder.spec.ts › D-B2 description
- [ ] Description: Cmd/Ctrl+Enter saves — ✅ dashboards/builder.spec.ts › D-B2 description
- [ ] Description: Esc throws the edit away — ✅ dashboards/builder.spec.ts › D-B2 description
- [ ] Description: clicking outside throws the edit away — ✅ dashboards/gaps-builder.spec.ts › GAP-D description: clicking outside throws the edit away
- [ ] Save button saves everything; status "Saving..." → "Saved", which clears after 3 seconds — ✅ dashboards/builder.spec.ts › D-B3
- [ ] Save error message — ✅ dashboards/gaps-builder.spec.ts › GAP-D save error: the failure message shows next to Save, then clears
- [ ] Opening the builder saves the dashboard straight away, with no change — 🐞 dashboards/builder.spec.ts › D-B4 [pinned] autosave on mount
- [ ] Autosave about 5 seconds after a change — ✅ dashboards/builder.spec.ts › D-B4 autosave fires ~5s
- [ ] Autosave is held back for 1 second after Undo / Redo — ✅ dashboards/gaps-builder.spec.ts › GAP-D autosave is held back ~1s after Undo / Redo, then saves the new state
- [ ] Undo and Redo buttons (disabled when there is nothing to undo or redo) — ✅ dashboards/builder.spec.ts › D-B12
- [ ] Keyboard Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z and Ctrl+Y redo — ✅ dashboards/builder.spec.ts › D-B12
- [ ] Undo shortcut is ignored while typing in an input — ✅ dashboards/builder.spec.ts › D-B12
- [ ] Undo history keeps 20 steps — ✅ dashboards/gaps-builder.spec.ts › GAP-D undo history keeps 20 steps
- [ ] View button saves, releases the lock and opens the view page — ✅ dashboards/builder.spec.ts › D-B13
- [ ] View button shows "Saving and opening view..." while it runs — ✅ dashboards/gaps-builder.spec.ts › GAP-D View shows "Saving and opening view..." while it saves
- [ ] Back saves, releases the lock and goes to /dashboards — ✅ dashboards/builder.spec.ts › D-B14 lock: DELETE on Back
- [ ] Mobile and tablet header (Chart / KPI / Text buttons, mobile title and description) — ✅ dashboards/gaps-builder.spec.ts › GAP-D mobile header (390px); dashboards/gaps-builder.spec.ts › GAP-D tablet uses the compact header too (820px)
- [ ] Save status text only shows at 1280px and wider — ✅ dashboards/gaps-builder.spec.ts › GAP-D save status text only shows at 1280px and wider

### Adding and removing widgets

- [ ] Add Chart modal: search, "No charts found matching your search.", Esc closes — ✅ dashboards/builder.spec.ts › D-B5
- [ ] Insert a chart: the cell renders with its title and chart (screenshot) — ✅ dashboards/builder.spec.ts › D-B5
- [ ] A chart already on the tab is marked "Already added" and can't be picked — ✅ dashboards/builder.spec.ts › D-B5
- [ ] The same chart can be added to a different tab — ✅ dashboards/gaps-widgets.spec.ts › GAP-D the same chart can be added to a different tab
- [ ] "CREATE NEW CHART" link in the modal — ✅ dashboards/gaps-widgets.spec.ts › GAP-D "CREATE NEW CHART" in the Add Chart modal opens /charts/new?from=dashboard
- [ ] An org with no charts goes to /charts/new?from=dashboard instead of opening the modal — 🐞 dashboards/gaps-widgets.spec.ts › GAP-D [pinned] an org with no charts gets the modal's empty state, not /charts/new (redirect only fires for a plain empty array, but /api/charts/ is paginated)
- [ ] Add KPI modal: search, no match message, insert renders the KPI card, "Already added" — ✅ dashboards/builder.spec.ts › D-B6
- [ ] "CREATE NEW KPI" link and the empty "GO TO KPIs" state — ✅ dashboards/gaps-widgets.spec.ts › GAP-D "CREATE NEW KPI" link, and the empty "GO TO KPIs" state
- [ ] A KPI with no metric crashes the KPI modal — 🐞 dashboards/gaps-widgets.spec.ts › GAP-D [pinned] a KPI with no metric crashes the builder as soon as it opens (whole edit page hits the root error screen)
- [ ] Add Text adds an empty text widget — ✅ dashboards/builder.spec.ts › D-B3, D-B12; dashboards/builder-text.spec.ts
- [ ] Chart cell toolbar: View Chart and Edit Chart open the chart with `from=dashboard` — ✅ dashboards/builder.spec.ts › D-B9 chart View / Edit
- [ ] KPI cell toolbar: View KPI and Edit KPI open the KPI page — ✅ dashboards/builder.spec.ts › D-B9 KPI View / Edit
- [ ] Text cell toolbar only has Remove — ✅ dashboards/builder.spec.ts › D-B9 Remove chart, KPI and text
- [ ] Remove a chart, KPI or text widget (no confirm); widgets below move up — ✅ dashboards/builder.spec.ts › D-B9 Remove chart, KPI and text
- [ ] Edit Chart / Edit KPI hidden when you can't edit that chart or KPI — ✅ dashboards/gaps-widgets.spec.ts › GAP-D Edit Chart / Edit KPI are hidden without edit access to that chart or KPI

### Dragging and resizing widgets

- [ ] Drag a widget by its top strip; its neighbour moves up — ✅ dashboards/builder.spec.ts › D-B10 drag by the top strip
- [ ] Dragging from the chart itself does not move the widget — ✅ dashboards/builder.spec.ts › D-B10 dragging from the chart content
- [ ] Resize from the bottom-right corner grows the widget and pushes the neighbour down — ✅ dashboards/builder.spec.ts › D-B10 resize grows
- [ ] Resizing below the chart minimum stops at the minimum — ✅ dashboards/builder.spec.ts › D-B10 resize clamps
- [ ] Minimum sizes for KPI and text widgets — ✅ dashboards/gaps-widgets.spec.ts › GAP-D KPI and text widgets clamp at their own minimum size
- [ ] Resize from the other edges and corners (n, s, e, w, ne, nw, sw) — ✅ dashboards/gaps-widgets.spec.ts › GAP-D resize from the <handle> handle (×7: e, w, s, n, ne, nw, sw)
- [ ] The canvas scrolls when you drag near its edge — ✅ dashboards/gaps-widgets.spec.ts › GAP-D the canvas scrolls while a widget is dragged near its bottom edge

### Chart title on a dashboard

- [ ] Click the title, type a custom one, Enter; hint "Custom title • Original: …" — ✅ dashboards/builder.spec.ts › D-B11 edit with Enter
- [ ] Esc cancels a title edit — ✅ dashboards/builder.spec.ts › D-B11 edit with Enter, Esc cancels
- [ ] Typing the original title removes the custom title — ✅ dashboards/builder.spec.ts › D-B11
- [ ] Hide title — ✅ dashboards/builder.spec.ts › D-B11 [pinned] hide then show
- [ ] Show title after hiding it — 🐞 dashboards/builder.spec.ts › D-B11 [pinned] hide then show (saves the original title as a custom one)
- [ ] Cancel (X) button while editing a title — 🐞 dashboards/builder.spec.ts › D-B11 [pinned] clicking the Cancel (X) button (still saves the typed text)
- [ ] Clearing the title input hides the title — ✅ dashboards/gaps-widgets.spec.ts › GAP-D clearing the chart title input hides the title

### Charts inside the builder

- [ ] Table cell drill-down and "← Back" — ✅ dashboards/builder.spec.ts › D-B15 table drill-down
- [ ] Pivot and map cells render — ✅ dashboards/builder.spec.ts › D-B15 pivot and map cells render
- [ ] Map cell: region click drill-down and Home breadcrumb — ✅ dashboards/gaps-widgets.spec.ts › GAP-D map cell: region click drills down; Home returns to the top level
- [ ] "Chart Error" card in the builder — ✅ dashboards/gaps-widgets.spec.ts › GAP-D "Chart Error" card in the builder when chart data fails
- [ ] "Failed to load KPI" — ✅ dashboards/gaps-widgets.spec.ts › GAP-D "Failed to load KPI" in the builder when KPI data fails

### Text and image widget

- [ ] Heading 1, 2 and 3 — ✅ dashboards/builder-text.spec.ts › D-B7 heading levels
- [ ] Normal text (paragraph) — ✅ dashboards/builder-text.spec.ts › D-B7 heading levels
- [ ] Font size on selected text — ✅ dashboards/builder-text.spec.ts › D-B7 heading levels (24)
- [ ] Bold, italic and underline, and toggling bold off — ✅ dashboards/builder-text.spec.ts › D-B7 bold, italic, underline
- [ ] Align center and right — ✅ dashboards/builder-text.spec.ts › D-B7 alignment
- [ ] Align left (after another alignment) — ✅ dashboards/gaps-text.spec.ts › GAP-D text align left after another alignment
- [ ] Text colour from a preset — ✅ dashboards/builder-text.spec.ts › D-B7 text colour
- [ ] Custom hex colour, with Cancel and OK — ✅ dashboards/builder-text.spec.ts › D-B7 custom hex
- [ ] Widget background colour — ✅ dashboards/builder-text.spec.ts › D-B7 background colour
- [ ] Esc throws the text edit away — ✅ dashboards/builder-text.spec.ts › D-B7 Esc discards
- [ ] Cmd/Ctrl+Enter keeps the text edit — ✅ dashboards/builder-text.spec.ts › D-B7 Cmd/Ctrl+Enter commits
- [ ] Clicking outside keeps the text edit — ✅ dashboards/gaps-text.spec.ts › GAP-D clicking outside the text widget keeps the edit
- [ ] An empty text widget shows nothing in view mode — ✅ dashboards/gaps-text.spec.ts › GAP-D an empty text widget shows nothing in view mode
- [ ] Image upload: a non-image file is rejected — ✅ dashboards/builder-text.spec.ts › D-B8 upload
- [ ] Image upload: a file over 5MB is rejected — ✅ dashboards/builder-text.spec.ts › D-B8 upload
- [ ] Image upload: a valid PNG uploads and shows (fill by default) — ✅ dashboards/builder-text.spec.ts › D-B8 upload (storage mocked)
- [ ] "Uploading…" label, and the upload-failure toast — ✅ dashboards/gaps-text.spec.ts › GAP-D image upload: "Uploading…" while it runs, then the failure toast
- [ ] Add an image by link (Confirm disabled while empty; Enter confirms) — ✅ dashboards/builder-text.spec.ts › D-B8 link
- [ ] Image fit Fit, Stretch and Fill — ✅ dashboards/builder-text.spec.ts › D-B8 fit modes
- [ ] Caption text and center alignment — ✅ dashboards/builder-text.spec.ts › D-B8 caption
- [ ] Caption left and right alignment — ✅ dashboards/gaps-text.spec.ts › GAP-D image caption left and right alignment
- [ ] Esc in the caption field — 🐞 dashboards/builder-text.spec.ts › [pinned] Esc in the caption input (keeps the caption instead of cancelling)
- [ ] Replace image: Back keeps the current image; a link replaces it — ✅ dashboards/builder-text.spec.ts › D-B8 replace
- [ ] Remove image clears the image and caption; background colour is offered again — ✅ dashboards/builder-text.spec.ts › D-B8 replace … remove

### Tabs

- [ ] A single tab has no remove button — ✅ dashboards/tabs.spec.ts › D-T1
- [ ] Add a tab: named "Untitled Tab N" and becomes active — ✅ dashboards/tabs.spec.ts › D-T1
- [ ] Each tab has its own canvas — ✅ dashboards/tabs.spec.ts › D-T1
- [ ] Switch tab by clicking — ✅ dashboards/tabs.spec.ts › D-T1
- [ ] Switch tab with Enter — ✅ dashboards/tabs.spec.ts › D-T1
- [ ] Switch tab with Space — ✅ dashboards/gaps-tabs.spec.ts › GAP-D switch tab with Space
- [ ] Rename a tab, then Enter — ✅ dashboards/tabs.spec.ts › D-T1
- [ ] Esc cancels a tab rename — ✅ dashboards/tabs.spec.ts › D-T1
- [ ] Rename a tab, then click away (blur) — ✅ dashboards/tabs.spec.ts › D-T1
- [ ] Tab name limited to 50 characters — ✅ dashboards/tabs.spec.ts › D-T1
- [ ] An empty tab name goes back to the old name — ✅ dashboards/gaps-tabs.spec.ts › GAP-D an empty tab name goes back to the old name
- [ ] Clicking an inactive tab's title selects it instead of renaming — ✅ dashboards/tabs.spec.ts › D-T1
- [ ] Remove a tab: dialog Cancel keeps it; Delete removes it and the previous tab becomes active — ✅ dashboards/tabs.spec.ts › D-T1
- [ ] Undo after deleting a tab — 🐞 dashboards/tabs.spec.ts › D-T4 [pinned] (Undo brings the tab back, although the dialog says "cannot be undone")
- [ ] Reorder tabs with Alt+Right and Alt+Left (no-op at the ends) — ✅ dashboards/tabs.spec.ts › D-T2
- [ ] Reorder tabs by dragging, with a drop indicator — ✅ dashboards/tabs.spec.ts › D-T2
- [ ] Tab bar scrolls while dragging near its edge — ✅ dashboards/gaps-tabs.spec.ts › GAP-D tab bar scrolls while a tab is dragged near its edge
- [ ] Move a widget to another tab: drag it onto the tab, wait 500ms, drop on the canvas ("Move chart to this tab" overlay) — ✅ dashboards/tabs.spec.ts › D-T3 hover a tab 500ms
- [ ] Esc cancels a cross-tab move — ✅ dashboards/tabs.spec.ts › D-T3 Esc
- [ ] Releasing over the tab before 500ms cancels the move — ✅ dashboards/tabs.spec.ts › D-T3 releasing before 500ms
- [ ] Switching browser window or dropping outside the canvas cancels the move — ✅ dashboards/gaps-tabs.spec.ts › GAP-D switching browser window cancels a cross-tab widget move; dashboards/gaps-tabs.spec.ts › GAP-D dropping outside the canvas cancels a cross-tab widget move
- [ ] View mode shows the tab bar only with 2 or more tabs; tabs switch; no add or remove — ✅ dashboards/tabs.spec.ts › D-T5
- [ ] Old dashboards without tabs open as "Untitled Tab 1" — ✅ dashboards/gaps-tabs.spec.ts › GAP-D an old dashboard without tabs opens as "Untitled Tab 1" (dashboard GET rewritten to the old shape)
- [ ] Undo can jump back to another tab — ✅ dashboards/gaps-tabs.spec.ts › GAP-D undo can jump back to another tab

### Filters: create, edit, delete, reorder (builder)

- [ ] Empty filter panel says "No filters added yet" — ✅ dashboards/filters.spec.ts › D-F1 single-select
- [ ] Create-filter modal: Create disabled with "Fill in all required fields to continue"; Preview disabled until a column is picked — ✅ dashboards/filters.spec.ts › D-F1 (every create test)
- [ ] Dropdown filter (single choice): dataset → column → type detected, name filled from the column, Preview lists values — ✅ dashboards/filters.spec.ts › D-F1 single-select
- [ ] Dropdown filter (multiple choice) — ✅ dashboards/filters.spec.ts › D-F1 multi-select
- [ ] Range filter shown as a slider — 🐞 dashboards/filters.spec.ts › [pinned] D-F2 slider (always saves a default of 0–100)
- [ ] Range filter shown as Min / Max boxes — 🐞 dashboards/filters.spec.ts › [pinned] D-F2 input (always saves a default of 0–100)
- [ ] Date range filter (Preview shows "Unique Days") — 🐞 dashboards/filters.spec.ts › [pinned] D-F3 create datetime (saves range-filter-shaped settings)
- [ ] Setting a default value for a dropdown filter — 🧑 manual (see MANUAL-CHECKS.md) — no UI for it exists (product gap)
- [ ] Edit a filter: dataset locked, rename, switch to multiple choice, saved — ✅ dashboards/filters.spec.ts › D-F4 edit filter
- [ ] "Loading filter configuration..." while the edit modal loads — ✅ dashboards/gaps-filters.spec.ts › GAP-D filter edit modal shows "Loading filter configuration..." until the filter loads
- [ ] Delete a filter: no confirm, removed at once — ✅ dashboards/filters.spec.ts › D-F4 delete filter
- [ ] Reorder filters by dragging (saves the new order) — ✅ dashboards/filters.spec.ts › D-F4 reorder filters
- [ ] Reorder filters with the keyboard — 🐞 dashboards/gaps-filters.spec.ts › [pinned] GAP-D filter keyboard reorder is advertised but does nothing (key listeners sit on an unfocusable handle)
- [ ] Create or update failure is silent (console only) — ✅ dashboards/gaps-filters.spec.ts › GAP-D filter create failure is silent; dashboards/gaps-filters.spec.ts › GAP-D filter update failure is silent

### Filters: using them

- [ ] Charts are not filtered until you click Apply — ✅ dashboards/view.spec.ts › D-V2
- [ ] Apply a multi-choice filter: every chart and the KPI reload with the filter — ✅ dashboards/filters.spec.ts › D-F5 apply value filter
- [ ] Apply a single-choice filter (sends one value) — ✅ dashboards/filters.spec.ts › D-F5 apply single-select
- [ ] Date filter: each picker blocks dates past the other; summary "Filtering from X onwards" and "Filtering from X to Y"; Apply — ✅ dashboards/filters.spec.ts › D-F3 datetime filter
- [ ] Date filter summary "Filtering up to Y" (end date only) — ✅ dashboards/gaps-filters.spec.ts › GAP-D date filter with only an end date: "Filtering up to …", applied
- [ ] Range filter default 0–100 is applied without touching it, returning no rows — 🐞 dashboards/filters.spec.ts › [pinned] D-F2 numerical filter applies forced 0–100
- [ ] Range filter Min / Max boxes: typed values are clamped to the data range, then applied — ✅ dashboards/filters.spec.ts › D-F2 numerical input
- [ ] Range filter slider: dragging the handles — ✅ dashboards/gaps-filters.spec.ts › GAP-D range slider: dragging both handles to the ends, then Apply
- [ ] Clear one filter (only changes the value locally until Apply) — ✅ dashboards/filters.spec.ts › D-F6
- [ ] Clear all reloads charts unfiltered; disabled when nothing is set; blue "applied" dot — ✅ dashboards/filters.spec.ts › D-F6
- [ ] A filter only affects charts on the same table — ✅ dashboards/filters.spec.ts › D-F7
- [ ] Apply in the builder reloads charts but not KPIs — 🐞 dashboards/filters.spec.ts › [pinned] D-F8
- [ ] Apply shows a short spinner — ✅ dashboards/gaps-filters.spec.ts › GAP-D Apply shows a short spinner (button disabled) before charts reload
- [ ] Collapse and expand the filter panel on a dashboard view page — ✅ dashboards/gaps-filters.spec.ts › GAP-D view filter panel: collapse / expand and hide / show the filter list
- [ ] Horizontal filter bar below 1200px, and "Show Filters (n)" in the builder — ✅ dashboards/gaps-filters.spec.ts › GAP-D builder below 1200px: horizontal filter bar, hide → "Show Filters (n)" → back
- [ ] Mobile filter accordion "Filters • N applied" — 🐞 dashboards/gaps-filters.spec.ts › [pinned] GAP-D mobile filter accordion "Filters • N applied" counts every filter (unset filters counted too)
- [ ] Filter dropdown states "Loading options...", "Options need attention", "No options available" — ✅ dashboards/gaps-filters.spec.ts › GAP-D dropdown filter shows "Loading options..." / "Options need attention" / "No options available" (×3)
- [ ] Broken-filter messages ("Invalid filter configuration", "Filter needs attention") — ✅ dashboards/gaps-filters.spec.ts › GAP-D broken filters: "Invalid filter configuration", "Filter not found", panel drops invalid rows ("Filter needs attention" is unreachable and asserted absent)
- [ ] Dropdown filter shows at most 100 options — ✅ dashboards/gaps-filters.spec.ts › GAP-D dropdown filter asks for at most 100 options and lists them all (cap is only `limit=100` in the request)

### Dashboard view mode (`/dashboards/[id]`)

- [ ] Seed dashboard 412 shows header, "Updated by", "Modified … ago", tabs, filters, KPIs and charts (screenshot) — ✅ dashboards/view.spec.ts › D-V1 seed 412
- [ ] Seed dashboard 411 shows five tabs, filters and KPIs; the second tab switches — ✅ dashboards/view.spec.ts › D-V1 seed 411
- [ ] A test dashboard renders its KPI and charts from its saved layout — ✅ dashboards/view.spec.ts › D-V1 e2e dashboard
- [ ] "Published" and "Locked by …" badges and the description in the header — ✅ dashboards/gaps-view.spec.ts › GAP-D view header shows the "Published" badge and the description; dashboards/gaps-view.spec.ts › GAP-D view header shows "Locked by you"
- [ ] Back button (hidden in fullscreen) — ✅ dashboards/view.spec.ts › D-V5 (hidden in fullscreen); dashboards/gaps-view.spec.ts › GAP-D Back button returns to the dashboard list
- [ ] Chart toolbar: Download as PNG (with toast) — ✅ dashboards/view.spec.ts › D-V3 download PNG and CSV
- [ ] Chart toolbar: Export Data as CSV — ✅ dashboards/view.spec.ts › D-V3 download PNG and CSV
- [ ] Chart toolbar: CSV export includes the applied filters — ✅ dashboards/view.spec.ts › D-V3 CSV export carries applied dashboard_filters
- [ ] Chart toolbar: CSV option hidden for number charts — ✅ dashboards/gaps-view.spec.ts › GAP-D number chart toolbar offers PNG but no CSV export
- [ ] Chart toolbar: View Chart opens it with `from=dashboard` — ✅ dashboards/view.spec.ts › D-V3 View Chart
- [ ] Chart toolbar: fullscreen shows the chart title — ✅ dashboards/view.spec.ts › D-V3 fullscreen
- [ ] "Chart Error" card with Retry — ✅ dashboards/gaps-view.spec.ts › GAP-D "Chart Error" card: Retry refetches and renders the chart
- [ ] KPI card: download PNG and CSV, fullscreen, View KPI — ✅ dashboards/view.spec.ts › D-V4
- [ ] Whole-dashboard fullscreen — ✅ dashboards/view.spec.ts › D-V5
- [ ] Landing dropdown: Set as my landing page, and Remove it — ✅ dashboards/view.spec.ts › D-V6
- [ ] Landing dropdown: org default section — 🧑 manual (see MANUAL-CHECKS.md)
- [ ] Edit Dashboard opens the builder — ✅ dashboards/view.spec.ts › D-V7
- [ ] Share button opens the Share modal — ✅ dashboards/view.spec.ts › D-V7
- [ ] Edit Dashboard hidden while another user has the dashboard locked — ✅ dashboards/gaps-view.spec.ts › GAP-D Edit Dashboard is hidden and "Locked by <user>" shown while another user edits
- [ ] Mobile and tablet actions menu (Share Dashboard, Edit Dashboard) — ✅ dashboards/gaps-view.spec.ts › GAP-D tablet (<1200px) actions menu; dashboards/gaps-view.spec.ts › GAP-D mobile actions menu (Share Dashboard, Edit Dashboard)
- [ ] Embed code is only offered for public dashboards — ✅ dashboards/view.spec.ts › D-V8 only offered for public
- [ ] Embed code button on a public dashboard — 🐞 dashboards/view.spec.ts › [pinned] D-V8 embed code trigger is missing (the API never returns `public_share_token`)
- [ ] Embed code options: show title, org and padding switches, theme, width and height, all changing the snippet — ✅ dashboards/view.spec.ts › D-V8 embed code: options (token injected)
- [ ] Embed code: empty width or height falls back to 800 × 600 — ✅ dashboards/view.spec.ts › D-V8 embed code: options
- [ ] Copy Embed Code puts it on the clipboard and shows "Copied!" — ✅ dashboards/view.spec.ts › D-V8 embed code: options
- [ ] Empty dashboard shows "No Dashboard Components" — ✅ dashboards/view.spec.ts › D-V9
- [ ] Old "heading" and "filter" widget types still render ("Filter not found") — ✅ dashboards/gaps-view.spec.ts › GAP-D old "heading" and "filter" widget types still render in view mode
- [ ] "Congratulations, you're officially live!" after copying the link during onboarding — 🧑 manual (see MANUAL-CHECKS.md)
- [ ] Native "Dashboard Not Found" page, and falling back to the Superset view on 404 — 🐞 dashboards/gaps-view.spec.ts › GAP-D native "Dashboard Not Found" when the open dashboard is deleted meanwhile; [pinned] unknown dashboard id falls back to the Superset view error (even with no Superset)
- [ ] Superset dashboard view (Share, Refresh, Open in Superset) — 🧑 manual (see MANUAL-CHECKS.md)
- [ ] Usage dashboard `/dashboards/usage` — 🧑 manual (see MANUAL-CHECKS.md); only the no-Superset message is automated: dashboards/gaps-view.spec.ts › GAP-D usage dashboard without Superset says the org is not subscribed

### Edit lock

- [ ] Opening the builder takes the edit lock — ✅ dashboards/builder.spec.ts › D-B14 lock: POST on open
- [ ] Back and View release the lock — ✅ dashboards/builder.spec.ts › D-B14, D-B13
- [ ] Another user sees "Dashboard is Currently Locked", who is editing, a live countdown, and Go Back — ✅ dashboards/builder.spec.ts › D-B14 another user (analyst)
- [ ] "Refresh Now" on the locked screen — ✅ dashboards/gaps-lock-share.spec.ts › GAP-D locked screen: "Refresh Now" rechecks; opens the builder once the other user leaves
- [ ] The same user in a second browser is not blocked by their own lock — 🐞 dashboards/builder.spec.ts › D-B14 [pinned] same user
- [ ] The lock is refreshed every 60 seconds — ✅ dashboards/gaps-lock-share.spec.ts › GAP-D the builder refreshes its edit lock every 60 seconds (fake clock)
- [ ] A "locked" error while editing shows an alert and returns to /dashboards — ✅ dashboards/gaps-lock-share.spec.ts › GAP-D a "locked" (423) answer to the lock request alerts and returns to /dashboards
- [ ] The lock is released when the tab is hidden — 🐞 dashboards/gaps-lock-share.spec.ts › [pinned] GAP-D hiding the tab releases the lock (plus a stray unlock to the Next server; nothing re-takes the lock when the tab is visible again)
- [ ] The lock is released when the browser tab or page is closed — 🧑 manual (see MANUAL-CHECKS.md) (page-close beacon posts to a relative URL, pinned bug)

### Sharing a dashboard

- [ ] General access Default → Private → Public, each with its description; security notice; COPY PUBLIC LINK copies a /share/dashboard link; back to Default — ✅ dashboards/share.spec.ts › D-S1 general access
- [ ] `?openShare=true` opens Share on load; closing removes the parameter — ✅ dashboards/share.spec.ts › D-S1 ?openShare=true
- [ ] Give a member view access; the member sees it view-only; remove access (with the "affects charts inside" confirm); the member then has no access — ✅ dashboards/share.spec.ts › D-S6
- [ ] Change a person's access between View and Edit — ✅ dashboards/gaps-lock-share.spec.ts › GAP-D change a member between View and Edit (cascade confirm, PATCH, effect on the member)
- [ ] Approve or deny access requests — ✅ dashboards/gaps-lock-share.spec.ts › GAP-D member requests access from the no-access screen; the owner approves; dashboards/gaps-lock-share.spec.ts › GAP-D member sends Request Edit from a view-only dashboard; the owner denies
- [ ] Transfer ownership and admin takeover — ✅ dashboards/gaps-lock-share.spec.ts › GAP-D transfer ownership to an editor, then admin takeover back
- [ ] Role picker for invited email addresses (admins only) — ✅ dashboards/gaps-lock-share.spec.ts › GAP-D invite by email: admins get a role picker (Member preselected); dashboards/gaps-lock-share.spec.ts › GAP-D invite by email as a non-admin: no role picker
- [ ] Public option disabled when public sharing is off for the org — ✅ dashboards/gaps-lock-share.spec.ts › GAP-D Public option disabled when the org turned public sharing off; dashboards/gaps-lock-share.spec.ts › GAP-D already-public dashboard with public sharing off
- [ ] Public access stats (count, last accessed) — ✅ dashboards/gaps-lock-share.spec.ts › GAP-D public access stats: count and last accessed after a public visit

### Permissions and roles

- [ ] A member on a view-only dashboard sees the Request Edit pill and no Edit or Share — ✅ dashboards/view.spec.ts › D-P1
- [ ] A member can't open the builder of a view-only dashboard ("You have view-only access…") — ✅ dashboards/view.spec.ts › D-P2
- [ ] An analyst on a private dashboard sees the no-access screen — ✅ dashboards/view.spec.ts › D-P3
- [ ] Request access from the no-access screen, and Request Edit from a dashboard — ✅ dashboards/gaps-lock-share.spec.ts › GAP-D member requests access from the no-access screen; the owner approves; dashboards/gaps-lock-share.spec.ts › GAP-D member sends Request Edit from a view-only dashboard; the owner denies
- [ ] "Access Denied" without the view-dashboards permission — ✅ dashboards/gaps-lock-share.spec.ts › GAP-D "Access Denied" without the view-dashboards permission (no dashboard request)

### Public dashboard link and embed (`/share/dashboard/[token]`)

- [ ] Loads logged out: header, title, "Public View", Read Only badge, "Modified …"; no Back, Landing, Share or Edit — ✅ dashboards/share-dashboard.public.spec.ts › D-S2 public link loads
- [ ] KPI and charts render (screenshot); no View Chart button — ✅ dashboards/share-dashboard.public.spec.ts › D-S2 public link loads
- [ ] Filters start collapsed; expanding and applying reloads through the public endpoints — ✅ dashboards/share-dashboard.public.spec.ts › D-S2 public filters
- [ ] Public CSV download — 🐞 dashboards/share-dashboard.public.spec.ts › [pinned] D-S2 public CSV (filename is `chart_<id>` instead of the title)
- [ ] Public PNG download and chart fullscreen — ✅ dashboards/gaps-public.public.spec.ts › GAP-D public chart PNG download and chart fullscreen
- [ ] Embed mode, dark theme, with title and org — ✅ dashboards/share-dashboard.public.spec.ts › D-S3 embed mode (dark)
- [ ] Embed mode without title and org hides the embed header — ✅ dashboards/share-dashboard.public.spec.ts › D-S3 without title/org
- [ ] Embed mode with only the org (light theme) — ✅ dashboards/share-dashboard.public.spec.ts › D-S3 only org
- [ ] Embed padding on / off — ✅ dashboards/gaps-public.public.spec.ts › GAP-D embed padding on adds a 16px inset, off removes it
- [ ] Embed mode hides tabs; "Powered by Dalgo" footer — ✅ dashboards/gaps-public.public.spec.ts › GAP-D embed mode hides the tab bar and shows the "Powered by Dalgo" footer
- [ ] Invalid link shows "Dashboard Not Found" with "Sign in to Dalgo" and "Learn about Dalgo" — ✅ dashboards/share-dashboard.public.spec.ts › D-S4
- [ ] Old public link `/public/dashboard/<token>` — 🐞 dashboards/share-dashboard.public.spec.ts › [pinned] D-S5 (keeps loading forever)
- [ ] Error box when the public page crashes — 🐞 dashboards/gaps-public.public.spec.ts › [pinned] GAP-D public page crash shows the global "Something went wrong!" page (the page's own error box is never used)

---

## Reports

### Reports list (`/reports`)

- [ ] Seed reports load with title and dashboard; clicking a row opens the viewer — ✅ reports/list.spec.ts › R-L1
- [ ] Title filter searches on the server — ✅ reports/list.spec.ts › R-L2
- [ ] Dashboard and creator filters, all three sent together — ✅ reports/list.spec.ts › R-L2
- [ ] Filters wait 400ms after typing before searching — ✅ reports/gaps-list.spec.ts › GAP-R list filter waits 400ms after typing: one request with the final value
- [ ] "N filter(s) active" count — ✅ reports/list.spec.ts › R-L2
- [ ] No-match row "No reports match the current filters" and "0–0 of 0" — ✅ reports/list.spec.ts › R-L2
- [ ] Clear button in a filter popover; Clear all — ✅ reports/list.spec.ts › R-L2
- [ ] Empty state "No reports yet" with a create button — ✅ reports/gaps-list.spec.ts › GAP-R list empty state "No reports yet" with a create button (empty list mocked)
- [ ] A failed list load shows "No reports yet" instead of an error — 🐞 reports/gaps-list.spec.ts › [pinned] GAP-R list failed load shows "No reports yet" (a failed load looks like an empty org)
- [ ] Loading skeleton — ✅ reports/gaps-list.spec.ts › GAP-R list loading skeleton while the list loads
- [ ] Sort by Title (desc, then asc) — ✅ reports/list.spec.ts › R-L3
- [ ] Sort by Created on (new column starts desc, then asc) — ✅ reports/list.spec.ts › R-L3
- [ ] Sort by Dashboard and by Created by — 🐞 reports/list.spec.ts › R-L3 (rows with the same value fall back to server order)
- [ ] Pagination Next, and Prev / Next disabled at the ends — ✅ reports/list.spec.ts › R-L3
- [ ] Changing page size goes back to page 1 — ✅ reports/list.spec.ts › R-L3
- [ ] Deleting the only row on the last page — 🐞 reports/list.spec.ts › [pinned] R-L3 (shows "2 of 1" and an empty page)
- [ ] Row menu › View Report — ✅ reports/list.spec.ts › R-L4
- [ ] Row menu › Email PDF opens the dialog with the subject filled in; Cancel closes it — ✅ reports/list.spec.ts › R-L4
- [ ] Row menu › Delete with confirm (Cancel keeps it, Delete removes it with a toast) — ✅ reports/list.spec.ts › R-L4
- [ ] Row share icon opens the Share modal without opening the report — ✅ reports/share.spec.ts › R-S1 list row share icon
- [ ] Missing dashboard shows "—"; creator avatar and email — ⚠️ reports/gaps-list.spec.ts › GAP-R list row: missing dashboard shows "—"; creator email shown (the avatar has no testid, so it is not asserted)
- [ ] Create hidden without permission; Delete hidden without delete permission or edit access — ✅ reports/gaps-list.spec.ts › GAP-R list Create hidden without create permission; Delete hidden without delete permission; reports/gaps-list.spec.ts › GAP-R list view-only member; reports/gaps-list.spec.ts › GAP-R list analyst with an Edit grant
- [ ] Reports menu item appears only when the feature flag is on — ✅ reports/gaps-list.spec.ts › GAP-R Reports nav item is shown for this org (REPORTS flag on) and hidden when the flag is off (off case mocked)

### Create a report

- [ ] Dashboard with a date column: the column is picked for you — ✅ reports/create.spec.ts › R-C1
- [ ] End date is required when there is a date column — ✅ reports/create.spec.ts › R-C1
- [ ] Pick start and end dates; name trimmed; report created; toast; dialog closes; the list shows it — ✅ reports/create.spec.ts › R-C1
- [ ] Dashboard without a date column: hint shown, date column disabled, dates skipped — ✅ reports/create.spec.ts › R-C2
- [ ] Validation: "Please select a dashboard", "Please enter a report name" (also for spaces only) — ✅ reports/create.spec.ts › [pinned] R-C3 validation
- [ ] Cancel, then reopen — 🐞 reports/create.spec.ts › [pinned] R-C3 (the old name and date column are still filled in)
- [ ] Generating while date columns are still loading — 🐞 reports/create.spec.ts › [pinned] R-C3 (creates a report with no date range)
- [ ] Dashboard with several date columns: none picked for you, you choose one — ✅ reports/gaps-create-viewer.spec.ts › GAP-R create several date columns: none auto-picked, the chosen one is sent
- [ ] Start date can't be after the end date or today — 🐞 reports/gaps-create-viewer.spec.ts › GAP-R create start date cannot be after the end date or today; [pinned] create typed start date bypasses the max-date limit
- [ ] Changing the dashboard clears the date column — ✅ reports/gaps-create-viewer.spec.ts › GAP-R create changing the dashboard clears the date column
- [ ] Create failure toast — ✅ reports/gaps-create-viewer.spec.ts › GAP-R create failure toast keeps the dialog open

### Report viewer (`/reports/[id]`)

- [ ] Header: title, period, "Created by", link to the source dashboard — ✅ reports/viewer.spec.ts › R-V1 header metadata
- [ ] Editor buttons Download PDF, Share and Email PDF; no Request Edit pill — ✅ reports/viewer.spec.ts › R-V1
- [ ] Frozen chart renders (screenshot) with View and comment buttons, but no download or fullscreen — ✅ reports/viewer.spec.ts › R-V1
- [ ] Back goes to /reports — ✅ reports/viewer.spec.ts › R-V1
- [ ] Seed report 150: header, summary, dashboard tabs below the summary — ✅ reports/viewer.spec.ts › R-V1 seed report 150
- [ ] Frozen table and map charts in a report — ✅ reports/gaps-create-viewer.spec.ts › GAP-R viewer frozen table and map charts render
- [ ] KPI in a report (download and fullscreen hidden) — ✅ reports/gaps-create-viewer.spec.ts › GAP-R viewer KPI in a report has no download or fullscreen (the live dashboard does)
- [ ] Loading skeleton — ✅ reports/gaps-create-viewer.spec.ts › GAP-R viewer loading skeleton while the report loads
- [ ] Edit summary › Save: saved, toast, "Last updated by", kept after reload — ✅ reports/viewer.spec.ts › R-V2
- [ ] Edit summary › Cancel restores the saved text — ✅ reports/viewer.spec.ts › R-V2
- [ ] Saving an unchanged summary does nothing — ✅ reports/viewer.spec.ts › R-V2
- [ ] Summary save failure keeps you in edit mode with a toast — ✅ reports/gaps-create-viewer.spec.ts › GAP-R viewer summary save failure keeps edit mode with a toast
- [ ] Filter panel starts collapsed — ✅ reports/viewer.spec.ts › R-V3
- [ ] Report date filter is locked: disabled pickers, no clear button, not counted as "applied" — ✅ reports/viewer.spec.ts › R-V3
- [ ] Applying a filter reloads the frozen charts — ✅ reports/viewer.spec.ts › R-V3
- [ ] Clear all goes back to the report's defaults and keeps the locked dates — ✅ reports/viewer.spec.ts › R-V3
- [ ] Download PDF with default filters: filename, "Generating…" toast, success toast — ✅ reports/viewer.spec.ts › R-V4 (backend mocked)
- [ ] Download PDF includes the filters you applied — ✅ reports/viewer.spec.ts › R-V4
- [ ] Downloaded report PDF file itself (content, layout, org logo, applied filters) — 🧑 manual (see MANUAL-CHECKS.md)
- [ ] PDF filename strips special characters — ✅ reports/gaps-create-viewer.spec.ts › GAP-R viewer PDF filename strips special characters (export intercepted); Jest usePdfDownload.test.ts
- [ ] Email PDF: "Please enter at least one email address" — ✅ reports/viewer.spec.ts › R-V5
- [ ] Email PDF: "Maximum 20 recipients allowed" — ✅ reports/viewer.spec.ts › R-V5
- [ ] Email PDF: "Invalid emails: …" — ✅ reports/viewer.spec.ts › R-V5
- [ ] Email PDF: send (subject trimmed), "Report sent to N recipients", closes; reopening resets the form — ✅ reports/viewer.spec.ts › R-V5 (email mocked)
- [ ] Email PDF real delivery (inbox + attachment) — 🧑 manual (see MANUAL-CHECKS.md)
- [ ] Email send failure toast — ✅ reports/gaps-create-viewer.spec.ts › GAP-R viewer Email PDF send failure toast keeps the dialog open
- [ ] View Chart opens it with `from=report`; "Back to Report" returns — ✅ reports/viewer.spec.ts › R-V6
- [ ] Invalid report id ("Invalid report ID." for text or 0) with Go Back — ✅ reports/viewer.spec.ts › R-V7
- [ ] Missing report shows "Failed to load report." — ✅ reports/viewer.spec.ts › R-V7

### Comments and mentions

- [ ] Summary comment button opens its thread; existing comment with author — ✅ reports/comments.spec.ts › R-M1 summary thread
- [ ] Add a comment with Enter (button disabled while empty) — ✅ reports/comments.spec.ts › R-M1
- [ ] Edit your own comment ("· edited" label; Save disabled while empty) — ✅ reports/comments.spec.ts › R-M1
- [ ] Cancel editing keeps the text — ✅ reports/comments.spec.ts › R-M1
- [ ] Delete a comment with confirm (Cancel keeps it) — ✅ reports/comments.spec.ts › R-M1
- [ ] Opening a seed report's summary thread (Send disabled) — ✅ reports/comments.spec.ts › R-M1 seed report 150
- [ ] Chart and KPI comment threads, kept separate — ✅ reports/comments.spec.ts › [pinned] R-M2
- [ ] KPI comment button shows that there are comments — ✅ reports/comments.spec.ts › [pinned] R-M2
- [ ] Chart comment button shows that there are comments — 🐞 reports/comments.spec.ts › [pinned] R-M2 (never shows: it looks up `chart_id` instead of `target_id`)
- [ ] Unread, read and mentioned indicators each look different — ✅ reports/gaps-comments.spec.ts › GAP-R comment indicators: unread dot → opening marks read (outline); mentioned badge (mentioned state mocked)
- [ ] Opening a thread marks it read — ✅ reports/gaps-comments.spec.ts › GAP-R comment indicators: unread dot → opening marks read (see also 🐞 [pinned] GAP-R own KPI comment leaves the icon unread: post-submit mark-read sends `chart_id`)
- [ ] New-comment dot on unseen comments — 🐞 reports/gaps-comments.spec.ts › [pinned] GAP-R new-comment dot on unseen comments; deep-link open does not mark read
- [ ] @mention list shows at most 5 people — ✅ reports/comments.spec.ts › [pinned] R-M3
- [ ] @mention filters by name (case-insensitive) — ✅ reports/comments.spec.ts › [pinned] R-M3
- [ ] @mention arrow keys wrap around; Enter inserts — ✅ reports/comments.spec.ts › [pinned] R-M3
- [ ] @mention click inserts without closing the thread — ✅ reports/comments.spec.ts › [pinned] R-M3
- [ ] @mention with no match hides the list; deleting back reopens it — ✅ reports/comments.spec.ts › [pinned] R-M3
- [ ] Mentioned emails are sent with the comment — ✅ reports/comments.spec.ts › [pinned] R-M3 (sending mocked)
- [ ] Esc while the @mention list is open — 🐞 reports/comments.spec.ts › [pinned] R-M3 (closes the whole comment thread)
- [ ] Mentions show as highlighted emails in posted comments — ✅ reports/gaps-comments.spec.ts › GAP-R mentions show as highlighted emails in posted comments
- [ ] @mentions inside the comment edit box — ✅ reports/gaps-comments.spec.ts › GAP-R @mentions inside the comment edit box (PUT carries mentioned_emails)
- [ ] Link with `?commentTarget=summary` opens the summary thread — ✅ reports/comments.spec.ts › R-M4
- [ ] Link with `?commentTarget=chart&chartId=` opens that chart's thread — ✅ reports/comments.spec.ts › R-M4
- [ ] Deep link to a KPI thread — 🐞 reports/gaps-comments.spec.ts › [pinned] GAP-R KPI deep link: ?commentTarget=kpi does not open; chart-style link does (email links use `commentTarget=kpi`)
- [ ] Editor can delete (not edit) a viewer's comment, which becomes "This message was deleted" — ✅ reports/share.spec.ts › comment moderation
- [ ] "Deleted" placeholders disappear when every comment in a thread is deleted — ✅ reports/gaps-comments.spec.ts › GAP-R "deleted" placeholders disappear when every comment in a thread is deleted
- [ ] Comment post failure toast — ✅ reports/gaps-comments.spec.ts › GAP-R comment post failure toast keeps the draft

### Sharing a report and permissions

- [ ] Share modal: title, owner row, SHARE disabled with no one added, "Default" — ✅ reports/share.spec.ts › [pinned] R-S1 share modal
- [ ] General access Private (with toast) — ✅ reports/share.spec.ts › [pinned] R-S1
- [ ] General access Public, with copy public link — ✅ reports/share.spec.ts › [pinned] R-S1
- [ ] Public security notice wording — 🐞 reports/share.spec.ts › [pinned] R-S1 (uses the report title in lower case instead of the word "report")
- [ ] Back to Default ("visible to everyone in your org") — ✅ reports/share.spec.ts › [pinned] R-S1
- [ ] Add people to a report through the Share modal — ✅ reports/gaps-share.spec.ts › GAP-R add people to a report through the Share modal (grant intercepted)
- [ ] Public option limited by the source dashboard's sharing — 🐞 reports/gaps-share.spec.ts › [pinned] GAP-R report Public option is not limited by the source dashboard sharing; ✅ reports/gaps-share.spec.ts › GAP-R report Public option disabled when the org turns public sharing off (mocked)
- [ ] A view-only member can download the PDF, but has no Share, Email PDF, summary edit or summary comments; chart comments still work — ✅ reports/share.spec.ts › view-only member
- [ ] Request Edit pill: dialog locked to "Edit", note, Send, then "Request Edit sent" — ✅ reports/share.spec.ts › view-only member (request mocked)

### Public report link and print view (`/share/report/[token]`)

- [ ] Public link shows header, period, "Public View", Read Only, summary with its line breaks, dashboard tabs — ✅ reports/share-report.public.spec.ts › R-S1 public link renders
- [ ] No comments, share, download, edit or View Chart buttons on the public page — ✅ reports/share-report.public.spec.ts › R-S1 public link renders
- [ ] Frozen chart renders (screenshot); no summary block when there is no summary — ✅ reports/share-report.public.spec.ts › R-S1 public frozen chart
- [ ] Filters on the public report page — ✅ reports/gaps-public.public.spec.ts › GAP-R public report filters: apply a value filter → frozen chart refetched with it
- [ ] Print view `?print=true`: ready flag, title, period, created by, dashboard name, Executive Summary, no "Public View" — ✅ reports/share-report.public.spec.ts › R-S2
- [ ] Print view with `?dashboard_filters=` (and bad JSON ignored) — ✅ reports/gaps-public.public.spec.ts › GAP-R print view with ?dashboard_filters= bakes the filter into chart data; reports/gaps-public.public.spec.ts › GAP-R print view ignores a bad ?dashboard_filters= (invalid JSON)
- [ ] Invalid link shows "Report Not Found", "Learn about Dalgo", and "Sign in to Dalgo" goes to login — ✅ reports/share-report.public.spec.ts › R-S3
- [ ] "Loading report..." state — ✅ reports/gaps-public.public.spec.ts › GAP-R public "Loading report..." state while the report loads

---

## Moving between charts, dashboards and reports

- [ ] Dashboard → View Chart → "Back to Dashboard" returns to the dashboard — ✅ cross/navigation.spec.ts › X-1
- [ ] Dashboard → View Chart → Edit (keeps "from dashboard") → save → back to the dashboard — ✅ cross/navigation.spec.ts › X-1
- [ ] The dashboard shows the renamed chart right away and after a reload — ✅ cross/navigation.spec.ts › X-4
- [ ] Report → View KPI → "Back to Report" — ✅ cross/navigation.spec.ts › X-2
- [ ] Report → View Chart → "Back to Report" — ✅ reports/viewer.spec.ts › R-V6
- [ ] Dashboard → View KPI opens the KPI page with "from dashboard" — ✅ dashboards/view.spec.ts › D-V4; dashboards/builder.spec.ts › D-B9 KPI View / Edit
- [ ] Deleting a chart that a dashboard uses: the dialog lists the dashboard, and the dashboard cell then shows "Chart Error" — ✅ cross/navigation.spec.ts › X-3
- [ ] Test harness check: logged-in session, test chart created, detail page renders — ✅ smoke/harness.spec.ts

---

## Dead code, intentionally not tested

These exist in the code but users can't reach them, so there is nothing to tick. If a refactor deletes them, no test should fail.

- Chart components never used by the app: `ChartBuilder.tsx`, `ChartFiltersConfiguration.tsx`, `ChartSortConfiguration.tsx`, `ChartPaginationConfiguration.tsx`, `TableConfiguration.tsx`, `SimpleTableConfiguration.tsx`, `ChartExport.tsx`, `MiniChart.tsx`, `WorkInProgress.tsx`, `map/LayerConfiguration.tsx`, `map/MultiSelectLayerCard.tsx`, `types/map/MapChartCustomizations.tsx`, `types/table/ColumnAlignmentSection.tsx`, `ColumnOrderSection.tsx`.
- The builder's "Y Axis" block (`ChartDataConfigurationV3`): its show condition can never be true.
- Map "Enable Selection" switch: `MapPreview` never reads it, so it does nothing.
- Table header click-to-sort: no page passes `onSort`.
- Table dimension warnings about conditional formatting on reorder or remove: the pages never pass the props they need.
- Chart hooks never called by a page: `GET /api/charts/geojsons/?…`, `/hierarchy/`, `/available-layers/`, `POST /api/charts/export/`, `/map-data/`.
- Dashboard list card and list layouts (`dashboard-share-card-*`, `dashboard-share-mobile-*`): the view mode is hard-coded to table.
- Dashboard features that are commented out: refresh button, delete on the view page, list search, type and published filters, screen-size and filter-layout settings.
- Dashboard files nobody imports: `DashboardMiniPreview.tsx`, `GridGuides.tsx`, `SpaceMakingIndicators.tsx`. Dead exports: `updateDashboardSharing`, `getDashboardSharingStatus`, `getFilterOptions`, the module-level `lockDashboard` / `unlockDashboard`, the builder's `removeFilter`, `handleReset` in the numerical filter, `handleSelectionChange` in the value filter, `generateResponsiveLayouts`, `findAvailablePosition`, the list's local `debounce`, and the space-making helpers in `dashboard-animation-utils.ts` (space-making is disabled).
- Removing an org-default landing page: the hook exists, but there is no UI for it.
- Reports: `ReportShareMenu` (`report-share-menu.tsx`, with the "share via link" and "share via email" items), `updateReportSharing`, `getReportSharingStatus`, the Share modal's legacy email section (reports never pass `onShareViaEmail`), the create dialog's default trigger (`create-snapshot-trigger`), the create dialog's preselected-dashboard mode (nothing passes `dashboardId`), and the report `description` and email `message` fields (never sent).

---

## Functions & logic (code-level)

Pure or logic-heavy functions from the inventories (charts.md §16, dashboards.md §11, reports.md §10). **Jest** names the existing unit test file. **E2E** names the tests that cover the behaviour indirectly. **⚠️ E2E only** means there is no Jest test, so the function is only checked through the UI. Pin it with a characterization test before changing it.

### Charts

- [ ] `getDefaultCustomizations`, create copy — now `getDefaultCustomizations(type, 'create')` in `components/charts/chart-types/default-customizations.ts` — covered by: E2E charts/builder-*.spec.ts › "styling panel defaults in create", charts/edit.spec.ts › [pinned] C-E7 create / Jest `components/charts/chart-types/__tests__/default-customizations.test.ts`
- [ ] `getDefaultCustomizations`, edit copy — now `getDefaultCustomizations(type, 'edit')` in `components/charts/chart-types/default-customizations.ts` — covered by: E2E charts/edit.spec.ts › [pinned] C-E7 edit / Jest `components/charts/chart-types/__tests__/default-customizations.test.ts`
- [ ] `isFormValid`, create copy — now `canSaveChart` in `components/charts/logic/validation.ts` — covered by: E2E charts/builder-shared.spec.ts › C-B2, [pinned] removing the only bar metric; charts/builder-pivot.spec.ts › C-B2; charts/builder-number.spec.ts › removing the metric / Jest `components/charts/logic/__tests__/validation.test.ts`
- [ ] `isFormValid`, edit copy — now `canSaveChart` in `components/charts/logic/validation.ts` — covered by: E2E charts/edit.spec.ts › C-E5 / Jest `components/charts/logic/__tests__/validation.test.ts`
- [ ] `isChartDataReady`, create and edit copies (table differs) — now `isChartReady(config, builder)` in `components/charts/logic/validation.ts` — covered by: E2E charts/builder-table.spec.ts › [pinned] C-B3 dataset + title only / Jest `components/charts/logic/__tests__/validation.test.ts`
- [ ] `generateDefaultChartName` — now `components/charts/logic/default-name.ts` — covered by: E2E charts/builder-shared.spec.ts › C-B1 (bar, line, pie, number only) / Jest `components/charts/logic/__tests__/default-name.test.ts` (table/pivot/map titles still only checked via E2E)
- [ ] Chart-data payload memo, create — now `buildChartDataPayload` in `components/charts/logic/payload.ts` — covered by: E2E every `expectChartDataPayload` snapshot in charts/builder-*.spec.ts / Jest `components/charts/logic/__tests__/payload.test.ts`
- [ ] Chart-data payload builder, edit — now `buildChartDataPayload` in `components/charts/logic/payload.ts` — covered by: E2E charts/edit.spec.ts › C-E7 edit, the C-E2 update snapshots / Jest `components/charts/logic/__tests__/payload.test.ts`
- [ ] `convertLayersToSimplified` — now `toSimplifiedMapFields` in `components/charts/logic/map-layers.ts` — covered by: E2E charts/builder-map.spec.ts › C-E2 map edit round trip, C-E2 picking a district / Jest `components/charts/logic/__tests__/map-layers.test.ts`
- [ ] `convertSimplifiedToLayers` — now `toMapLayers` in `components/charts/logic/map-layers.ts` — covered by: E2E charts/builder-map.spec.ts › C-E2 (both) / Jest `components/charts/logic/__tests__/map-layers.test.ts`
- [ ] `buildChartData` — now `buildCreateChartPayload` / `buildEditChartPayload` in `components/charts/logic/payload.ts` — covered by: E2E charts/edit.spec.ts › C-E1 per type / Jest `components/charts/logic/__tests__/payload.test.ts`
- [ ] Edit-page chart-type switch in `handleFormChange` (`edit/page.tsx`) — covered by: ⚠️ E2E only — type-switch-matrix-edit.spec.ts (all 42 transitions) · Jest ❌ none
- [ ] `handleChartTypeChange` keep/trim rules (`ChartDataConfigurationV3.tsx`) — covered by: E2E charts/type-switch.spec.ts (all) / Jest `components/charts/__tests__/ChartDataConfigurationV3.test.tsx`
- [ ] `handleDatasetChange` (`ChartDataConfigurationV3.tsx`) — covered by: Jest `ChartDataConfigurationV3.test.tsx` / E2E ❌ none
- [ ] `generateAutoPrefilledConfig` (`lib/chartAutoPrefill.ts`) — covered by: E2E C-B1 in builder-shared, builder-map, builder-table and builder-pivot / Jest `lib/__tests__/chartAutoPrefill.test.ts`
- [ ] `mergeTableColumnFormatting`, `getApiCustomizations`, `resolveTableColumnOrder` (`lib/chart-payload-utils.ts`) — covered by: E2E table styling and map, pie and number save snapshots / Jest `__tests__/lib/chart-payload-utils.test.ts`
- [ ] `formatAxisValue`, `createTooltipFormatter`, `applyNumberChartFormatting`, `applyPieChartFormatting`, `applyLineBarChartFormatting`, `applyPieDateFormatting`, `applyLineBarDateFormatting`, `sanitizeCustomizationsForChartType` (`lib/chart-formatting-utils.ts`) — covered by: E2E number/date format styling screenshots, MM-bar-2 / MM-line-2 (null decimals bug), type-switch label position / Jest partial `chart-formatting-utils` tests
- [ ] `getLegendConfig`, `getPieSeriesPosition`, `applyLegendPosition`, `extractLegendPosition`, `isLegendPaginated` (`lib/chart-legend-utils.ts`) — covered by: E2E legend position and display screenshots (bar, line, pie) / Jest ❌ none (⚠️ E2E only)
- [ ] `createStackedTotalFormatter`, `applyStackedBarLabels` (`lib/stacked-bar-utils.ts`) — covered by: Jest (existing stacked-bar test) / E2E ⚠️ stacked-bars screenshot without labels only
- [ ] `resolveDrillDownGeoJSON` (`lib/map-drilldown-utils.ts`) — covered by: E2E map drill tests / Jest `lib/__tests__/map-drilldown-utils.test.ts`
- [ ] `transformMapDataOverlayPayload` + simple/calculated helpers (`hooks/api/useChart.ts`) — covered by: E2E map overlay snapshots (builder-map, MM-map-1..3) / Jest ❌ none (⚠️ E2E only)
- [ ] `applyPivotDateFormat`, `resolvePivotTotals`, `computePivotDateFormats` (`pivot-table/utils.ts`) — covered by: E2E charts/builder-pivot.spec.ts totals and date format / Jest `components/charts/pivot-table/__tests__/date-formats.test.ts`
- [ ] `buildPivotDataFields`, `buildPivotExtraConfig`, `getPivotRenderProps` (`pivot-table/utils.ts`) — covered by: E2E pivot chart-data and save snapshots, C-E1 pivot / Jest ❌ none (⚠️ E2E only)
- [ ] `exportPivotAsCsv` (`pivot-table/utils.ts`) — covered by: E2E charts/detail.spec.ts › [pinned] pivot export CSV, list C-L12 pivot CSV / Jest partial (imported by date-formats.test.ts; CSV output untested)
- [ ] `calculateRowSpans` (`pivot-table/utils.ts`) — covered by: E2E pivot screenshots (merged row cells) / Jest ❌ none (⚠️ E2E only)
- [ ] `pruneStaleFormatting` (`pivot-table/utils.ts`) — covered by: E2E ❌ none / Jest partial (referenced in date-formats.test.ts)
- [ ] `cellsToGrid` (`pivot-table/cellsToGrid.ts`) — covered by: E2E pivot render / Jest `pivot-table/__tests__/cellsToGrid.test.ts`
- [ ] `computeHeaderSpans`, inline `formatCell` / `getConditionalColor` (`PivotTableChart.tsx`) — covered by: E2E pivot render, MM-pivot-2 (0-decimal bug), pivot conditional formatting / Jest ❌ none (⚠️ E2E only; must be extracted first)
- [ ] `getMetricAnalyticsProps`, `isDrillDownEnabled`, `getUsedSavedMetricIds`, `getNewlyUsedSavedMetricIds` (`components/charts/utils.ts`) — covered by: E2E saved metrics hidden in other rows, table drill toggle / Jest ❌ none (⚠️ E2E only; analytics props not checked)
- [ ] `getAvailableColumns` (`MetricsSelector.tsx`) — covered by: E2E charts/builder-shared.spec.ts › simple: numeric-only columns / Jest via component tests
- [ ] `summaryOf`, `autoLabel` (`MetricAccordionItem.tsx`, not exported) — covered by: E2E metric trigger and display-name assertions / Jest ❌ none (⚠️ E2E only)
- [ ] `isValidUrl`, `normalizeUrl`, inline `formatCellValue` / `getConditionalColor` / `getAlignmentClass` (`TableChart.tsx`) — covered by: E2E table URL cells, conditional formatting, alignment / Jest `TableChart.test.tsx`
- [ ] `useTableSearch` (`components/charts/hooks/useTableSearch.ts`) — covered by: E2E table search, pivot search / Jest only through the pivot search test
- [ ] `deepEqual` (`lib/form-utils.ts`; drives the "unsaved changes" check) — covered by: E2E charts/edit.spec.ts › C-E4 reverting, [pinned] C-B6 / Jest ❌ none (⚠️ E2E only)
- [ ] `generateDuplicateTitle` (`lib/form-utils.ts`) plus its inline copy in `app/charts/page.tsx` — covered by: E2E charts/list.spec.ts › C-L8 / Jest ❌ none (⚠️ E2E only)
- [ ] `formatNumber`, `formatDate`, `NumberFormats` (`lib/formatters.ts`) — covered by: E2E number format styling / Jest (existing formatters test)
- [ ] `parseWidgetNavigationSource`, `getChartViewUrl`, `getChartEditUrl`, `getWidgetBackLabel` (`lib/widget-navigation.ts`) — covered by: E2E C-D5, C-E6, X-1, X-2, R-V6 / Jest `lib/__tests__/widget-navigation.test.ts`
- [ ] `statesToCsv`, `districtsToCsv` (`lib/csvUtils.ts`) — covered by: E2E map Download States / Districts CSV (filename only) / Jest ❌ none (⚠️ E2E only; contents unchecked)
- [ ] `ChartExporter.*`, `generateFilename` (`lib/chart-export.ts`) — covered by: E2E C-D3, C-L12 filename patterns / Jest `__tests__/lib/chart-export.test.ts`
- [ ] Table drill-down click and drill-up handlers, three copies (configure, edit, detail) — covered by: E2E builder-table drill tests, MM-table-7, detail C-D4 table / Jest ❌ none (⚠️ E2E only; the edit copy only through C-E2 table)
- [ ] Map region-click resolver (`ChartDetailClient.tsx`) — covered by: E2E charts/builder-map.spec.ts › C-D4 detail drill tests / Jest ❌ none (⚠️ E2E only)
- [ ] `getRegionTypeHierarchy`, `updateLevel` (`map/DynamicLevelConfig.tsx`) — covered by: E2E map district drill level, [pinned] UI-built hierarchy / Jest via component test
- [ ] `lightenColor`, single-value range, `escapeHtml` (`MapPreview.tsx`) — covered by: E2E map colour-scheme screenshots (partial) / Jest ❌ none (⚠️ E2E only; single-value range not covered)

### Dashboards

- [ ] `resolveDashboardFilters` (`lib/dashboard-filter-utils.ts`) — covered by: E2E dashboard_filters snapshots in D-F5, D-F3, D-F2 and public D-S2 / Jest ❌ none (⚠️ E2E only)
- [ ] `formatAsChartFilters`, `createFilterConfigLookup` (`lib/dashboard-filter-utils.ts`) — covered by: E2E D-F5, D-F7, R-V3 / Jest ❌ none (⚠️ E2E only)
- [ ] `getDefaultFilterValues` (`lib/dashboard-filter-utils.ts`) — covered by: E2E [pinned] D-F2 applies forced 0–100, R-V3 Clear all resets to defaults / Jest ❌ none (⚠️ E2E only)
- [ ] `isFilterValueSet` (private, `lib/dashboard-filter-utils.ts`) — covered by: E2E D-F6 applied dot, R-V3 locked filter / Jest ❌ none (⚠️ E2E only)
- [ ] `summarizeAppliedFilters` (`lib/dashboard-filter-utils.ts`) — covered by: Jest `lib/__tests__/dashboard-filter-analytics.test.ts` / E2E ❌ none (analytics)
- [ ] `convertFilterToConfig`, builder copy (validates and fills defaults) — covered by: E2E D-F4, D-F8 / Jest ❌ none (⚠️ E2E only)
- [ ] `convertFilterToConfig`, view copy (`dashboard-native-view.tsx`) — covered by: E2E D-F5, D-V2, R-V3 / Jest ❌ none (⚠️ E2E only)
- [ ] `convertFilterToConfig`, filter-modal copy (`filter-config-modal.tsx`) — covered by: E2E D-F4 edit filter / Jest ❌ none (⚠️ E2E only)
- [ ] Filter-type auto-detect, auto-name, save-settings builder (`filter-config-modal.tsx`) — covered by: E2E D-F1, [pinned] D-F2, [pinned] D-F3 create snapshots / Jest ❌ none (⚠️ E2E only)
- [ ] `compactVertical`, `bottomY` (`lib/dashboard-animation-utils.ts`) — covered by: E2E D-B9 remove (widgets move up), D-B5 insert / Jest `lib/__tests__/dashboard-animation-utils.test.ts`
- [ ] `generateTabId`, `createNewTab`, `getDefaultTabsConfig`, `getNextTabNumber`, `initializeTabsData`, `getActiveTabData` (tab-utils) — covered by: E2E D-T1 / Jest `components/dashboard/tabs/__tests__/tab-utils` test
- [ ] `pointerToGridPosition`, `placeItemInLayout`, `moveWidgetBetweenTabs` (cross-tab drag) — covered by: E2E D-T3 / Jest `tabs/__tests__/cross-tab-drag.test.ts`
- [ ] `getActiveEditorTab`, `updateActiveEditorTab`, `ensureTextContentConstraints`, item-constraint logic, first-tab setup, save payload build (`dashboard-builder-v2.tsx`, inline) — covered by: E2E every `expectBuilderPayload` snapshot / Jest ❌ none (⚠️ E2E only; must be extracted first)
- [ ] `getCurrentScreenSize`, `generateResponsiveLayoutsForPreview` (`dashboard-native-view.tsx`) — covered by: E2E view-mode renders at desktop width only / Jest ❌ none (⚠️ E2E only, one screen size)
- [ ] List filter and sort logic, `getActiveFilterCount`, `hasActiveFilter`, pinned/regular split, pagination maths (`dashboard-list-v2.tsx`, inline) — covered by: E2E D-L1, D-L2, D-L3, D-L6 / Jest ❌ none (⚠️ E2E only)
- [ ] `generateEmbedCode` (`embed-code-dropdown.tsx`) — covered by: E2E dashboards/view.spec.ts › D-V8 embed code: options (snippet snapshots) / Jest ❌ none (⚠️ E2E only)
- [ ] Numerical clamp `handleInputChange`, date `handleDateChange` (filter widgets) — covered by: E2E D-F2 numerical input, D-F3 datetime / Jest partial `dashboard-filter-widgets.test.tsx`
- [ ] `legacyConfigToRichText`, `sanitizeRichTextDocument`, `richTextDocumentsEqual` (`rich-text-config.ts`) — covered by: E2E D-B7 saves / Jest `components/dashboard/__tests__/rich-text-config.test.ts`
- [ ] `resolveChartTitle`, `isTitleOverridden`, `getTitleEditorValue`, `createTitleUpdateConfig` (`lib/chart-title-utils.ts`) — covered by: E2E D-B11 (incl. pinned hide/show) / Jest `__tests__/lib/chart-title-utils.test.ts`
- [ ] `getMinGridDimensions`, `getDefaultGridDimensions`, `calculateTextDimensions`, `getChartTypeFromConfig` (`lib/chart-size-constraints.ts`) — covered by: E2E D-B10 resize clamps (chart only) / Jest `__tests__/lib/chart-size-constraints.test.ts`
- [ ] `useUndoRedo` (duplicate check, 20-step limit, `setStateWithoutHistory`) (`hooks/useUndoRedo.ts`) — covered by: E2E D-B12, [pinned] D-T4 / Jest ❌ none (⚠️ E2E only; 20-step limit untested)
- [ ] `toggleFavorite` (`lib/favorite-utils.ts`) — covered by: E2E D-L4 / Jest ❌ none (⚠️ E2E only)
- [ ] `useDashboards` response handling (plain array vs paginated) (`hooks/api/useDashboards.ts`) — covered by: E2E D-L1 (paginated only) / Jest only the share test (`useDashboards.share.test.ts`)

### Reports

- [ ] `formatDateShort` (`components/reports/utils.ts`) — covered by: E2E report period labels (R-V1, public R-S1) / Jest `components/reports/__tests__/utils.test.ts`
- [ ] `formatCreatedOn` (`utils.ts`) — covered by: Jest `utils.test.ts` / E2E ❌ none (list created-on cell not asserted)
- [ ] `formatCommentTime` (`utils.ts`) — covered by: Jest `comment-utils.test.ts` / E2E ❌ none
- [ ] `getAvatarColor`, `getInitials` (`utils.ts`) — covered by: Jest `utils.test.ts` / E2E ❌ none
- [ ] `parseCommentMentions`, `extractMentionedEmails` (`utils.ts`) — covered by: E2E R-M3 mention payload / Jest `comment-utils.test.ts`
- [ ] `EMAIL_REGEX`, `MAX_RECIPIENTS` (`utils.ts`) — covered by: E2E R-V5 / Jest partial
- [ ] `groupLayoutByRows` + height floors (`components/reports/print-layout.tsx`, not exported) — covered by: E2E R-S2 print mode (render only) / Jest ❌ none (⚠️ E2E only; row grouping and heights not checked)
- [ ] Recipient parsing and validation (inline, `share-via-email-dialog.tsx`) — covered by: E2E R-V5 / Jest via component only
- [ ] List sort comparator, `handleSort` toggle, pagination maths, filter parameter builder (inline, `app/reports/page.tsx`) — covered by: E2E R-L2, R-L3 (incl. pinned last-page bug) / Jest via `reports-page.test.tsx` (the parameter builder has none)
- [ ] Date-column auto-select rule (`create-snapshot-dialog.tsx`) — covered by: E2E R-C1 (single column only) / Jest via `create-snapshot-dialog.test.tsx`
- [ ] `startMaxDate` rule (`create-snapshot-dialog.tsx`) — covered by: ❌ none
- [ ] Snapshot payload builder (splits `schema.table.column`) (`create-snapshot-dialog.tsx`) — covered by: E2E R-C1, R-C2, [pinned] R-C3 race snapshots / Jest via dialog test
- [ ] "Edited" threshold check, >1000ms (`comment-popover.tsx`) — covered by: E2E R-M1 "· edited" / Jest ❌ none (⚠️ E2E only)
- [ ] `visibleComments` filter (hide placeholders when all are deleted) (`comment-popover.tsx`) — covered by: E2E moderation placeholder (partial) / Jest partial
- [ ] Mention filter (5 results, case-insensitive; two copies) (`comment-popover.tsx`) — covered by: E2E [pinned] R-M3 / Jest ❌ none (⚠️ E2E only)
- [ ] `AT_MENTION_PATTERN`, mention insertion (`hooks/useMentionInput.ts`) — covered by: E2E [pinned] R-M3 / Jest via `comment-popover.test.tsx`
- [ ] PDF filename sanitizer (`hooks/usePdfDownload.ts`) — covered by: E2E R-V4 (plain title only) / Jest `hooks/__tests__/usePdfDownload.test.ts`
- [ ] Comment-state lookups: viewer, chart (`chart-element-view.tsx`, buggy `chart_id`) and KPI (`kpi-chart-element.tsx`) — covered by: E2E [pinned] R-M2 / Jest `comment-states-lookup.test.ts` (copies the logic instead of importing it, so it misses the chart bug)
- [ ] `getKpiViewUrl` and the other widget-navigation helpers (`lib/widget-navigation.ts`) — covered by: E2E X-2, D-V4 / Jest `lib/__tests__/widget-navigation.test.ts`
- [ ] `dashboard_filters` query parsing for print mode (`app/share/report/[token]/page.tsx`) — covered by: ❌ none
- [ ] Public dashboard embed-option parsing (`app/share/dashboard/[token]/page.tsx`) — covered by: E2E D-S3 (×3) / Jest ❌ none (⚠️ E2E only)

---

## Not covered — gap list

Every ❌ and ⚠️ line still open above, with the reason. Items moved to 🧑 manual checks are listed in [MANUAL-CHECKS.md](MANUAL-CHECKS.md), not here.

### Charts

- None. Every line is ✅, 🐞 or 🧑.

### Dashboards

- None. Every line is ✅, 🐞 or 🧑.

### Reports

- ⚠️ **Reports list (`/reports`)** · Missing dashboard shows "—"; creator avatar and email — reports/gaps-list.spec.ts › GAP-R list row: missing dashboard shows "—"; creator email shown (the avatar has no testid, so it is not asserted) → add an avatar testid (or a visual check), then assert it

### Functions & logic (code-level)

- **Charts** · Edit-page chart-type switch in `handleFormChange` (`edit/page.tsx`) → E2E only (type-switch-matrix-edit) → add Jest characterization test
- **Charts** · `getLegendConfig`, `getPieSeriesPosition`, `applyLegendPosition`, `extractLegendPosition`, `isLegendPaginated` (`lib/chart-legend-utils.ts`) → E2E only → add Jest characterization test before changing it
- **Charts** · `transformMapDataOverlayPayload` + simple/calculated helpers (`hooks/api/useChart.ts`) → E2E only → add Jest characterization test before changing it
- **Charts** · `buildPivotDataFields`, `buildPivotExtraConfig`, `getPivotRenderProps` (`pivot-table/utils.ts`) → E2E only → add Jest characterization test before changing it
- **Charts** · `calculateRowSpans` (`pivot-table/utils.ts`) → E2E only → add Jest characterization test before changing it
- **Charts** · `computeHeaderSpans`, inline `formatCell` / `getConditionalColor` (`PivotTableChart.tsx`) → E2E only → add Jest characterization test before changing it
- **Charts** · `getMetricAnalyticsProps`, `isDrillDownEnabled`, `getUsedSavedMetricIds`, `getNewlyUsedSavedMetricIds` (`components/charts/utils.ts`) → E2E only → add Jest characterization test before changing it
- **Charts** · `summaryOf`, `autoLabel` (`MetricAccordionItem.tsx`, not exported) → E2E only → add Jest characterization test before changing it
- **Charts** · `deepEqual` (`lib/form-utils.ts`; drives the "unsaved changes" check) → E2E only → add Jest characterization test before changing it
- **Charts** · `generateDuplicateTitle` (`lib/form-utils.ts`) plus its inline copy in `app/charts/page.tsx` → E2E only → add Jest characterization test before changing it
- **Charts** · `statesToCsv`, `districtsToCsv` (`lib/csvUtils.ts`) → E2E only → add Jest characterization test before changing it
- **Charts** · Table drill-down click and drill-up handlers, three copies (configure, edit, detail) → E2E only → add Jest characterization test before changing it
- **Charts** · Map region-click resolver (`ChartDetailClient.tsx`) → E2E only → add Jest characterization test before changing it
- **Charts** · `lightenColor`, single-value range, `escapeHtml` (`MapPreview.tsx`) → E2E only → add Jest characterization test before changing it
- **Dashboards** · `resolveDashboardFilters` (`lib/dashboard-filter-utils.ts`) → E2E only → add Jest characterization test before changing it
- **Dashboards** · `formatAsChartFilters`, `createFilterConfigLookup` (`lib/dashboard-filter-utils.ts`) → E2E only → add Jest characterization test before changing it
- **Dashboards** · `getDefaultFilterValues` (`lib/dashboard-filter-utils.ts`) → E2E only → add Jest characterization test before changing it
- **Dashboards** · `isFilterValueSet` (private, `lib/dashboard-filter-utils.ts`) → E2E only → add Jest characterization test before changing it
- **Dashboards** · `convertFilterToConfig`, builder copy (validates and fills defaults) → E2E only → add Jest characterization test before changing it
- **Dashboards** · `convertFilterToConfig`, view copy (`dashboard-native-view.tsx`) → E2E only → add Jest characterization test before changing it
- **Dashboards** · `convertFilterToConfig`, filter-modal copy (`filter-config-modal.tsx`) → E2E only → add Jest characterization test before changing it
- **Dashboards** · Filter-type auto-detect, auto-name, save-settings builder (`filter-config-modal.tsx`) → E2E only → add Jest characterization test before changing it
- **Dashboards** · `getActiveEditorTab`, `updateActiveEditorTab`, `ensureTextContentConstraints`, item-constraint logic, first-tab setup, save payload build (`dashboard-builder-v2.tsx`, inline) → E2E only → add Jest characterization test before changing it
- **Dashboards** · `getCurrentScreenSize`, `generateResponsiveLayoutsForPreview` (`dashboard-native-view.tsx`) → E2E only → add Jest characterization test before changing it
- **Dashboards** · List filter and sort logic, `getActiveFilterCount`, `hasActiveFilter`, pinned/regular split, pagination maths (`dashboard-list-v2.tsx`, inline) → E2E only → add Jest characterization test before changing it
- **Dashboards** · `generateEmbedCode` (`embed-code-dropdown.tsx`) → E2E only → add Jest characterization test before changing it
- **Dashboards** · `useUndoRedo` (duplicate check, 20-step limit, `setStateWithoutHistory`) (`hooks/useUndoRedo.ts`) → E2E only → add Jest characterization test before changing it
- **Dashboards** · `toggleFavorite` (`lib/favorite-utils.ts`) → E2E only → add Jest characterization test before changing it
- **Reports** · `groupLayoutByRows` + height floors (`components/reports/print-layout.tsx`, not exported) → E2E only → add Jest characterization test before changing it
- **Reports** · `startMaxDate` rule (`create-snapshot-dialog.tsx`) → no test at all → add Jest characterization test
- **Reports** · "Edited" threshold check, >1000ms (`comment-popover.tsx`) → E2E only → add Jest characterization test before changing it
- **Reports** · Mention filter (5 results, case-insensitive; two copies) (`comment-popover.tsx`) → E2E only → add Jest characterization test before changing it
- **Reports** · `dashboard_filters` query parsing for print mode (`app/share/report/[token]/page.tsx`) → no test at all → add Jest characterization test
- **Reports** · Public dashboard embed-option parsing (`app/share/dashboard/[token]/page.tsx`) → E2E only → add Jest characterization test before changing it
