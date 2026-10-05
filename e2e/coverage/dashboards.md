# Dashboards — E2E coverage inventory

# Dashboards feature inventory (coverage matrix for the Playwright suite)

This was a read-only review. All paths are relative to ``.

## File legend (the short names used in the tables)

| Short name | Absolute path |
|---|---|
| list | `components/dashboard/dashboard-list.tsx` |
| builder | `components/dashboard/dashboard-builder.tsx` |
| cell | `components/dashboard/DashboardCell.tsx` |
| view | `components/dashboard/dashboard-native-view.tsx` |
| actions | `components/dashboard/responsive-dashboard-actions.tsx` |
| panel | `components/dashboard/unified-filters-panel.tsx` |
| fel | `components/dashboard/filter-element.tsx` |
| widgets | `components/dashboard/dashboard-filter-widgets.tsx` |
| dtw | `components/dashboard/datetime-filter-widget.tsx` |
| fcm | `components/dashboard/filter-config-modal.tsx` |
| rfs | `components/dashboard/responsive-filters-section.tsx` |
| tabbar | `components/dashboard/tabs/TabBar.tsx` |
| deltab | `components/dashboard/tabs/DeleteTabDialog.tsx` |
| tabutils | `components/dashboard/tabs/tab-utils.ts` |
| xtab | `components/dashboard/tabs/cross-tab-drag.ts` |
| cev2 | `components/dashboard/widgets/chart/chart-element-builder.tsx` (builder chart) |
| cev | `components/dashboard/widgets/chart/chart-element-view.tsx` (view chart) |
| cte | `components/dashboard/widgets/chart/chart-title-editor.tsx` |
| csm / ksm | `components/dashboard/widgets/chart/chart-selector-modal.tsx`, `components/dashboard/widgets/kpi/kpi-selector-modal.tsx` |
| kpi | `components/dashboard/widgets/kpi/kpi-chart-element.tsx` |
| text / rtt / img | `components/dashboard/widgets/text/text-element-unified.tsx`, `components/dashboard/widgets/text/rich-text-toolbar.tsx`, `components/dashboard/widgets/text/dashboard-image-control.tsx` |
| embed | `components/dashboard/embed-code-dropdown.tsx` |
| ssv / sse | `components/dashboard/superset-dashboard-view.tsx`, `components/dashboard/superset-embed.tsx` |
| usage | `components/dashboards/usage-dashboard.tsx` |
| pages | `app/dashboards/{page,create/page,[id]/page,[id]/edit/page,usage/page}.tsx` |
| pub | `app/share/dashboard/[token]/PublicDashboardView.tsx` (+ `page.tsx`) |
| legacy pub | `app/public/dashboard/[token]/page.tsx` |
| hooks | `hooks/api/useDashboards.ts` |
| share | `components/share/ShareModal.tsx`, with endpoints in `hooks/api/useAccess.ts` |

## What this means for the test plan

1. **Duplicate headers are always in the DOM.** Both the builder and the view page render a mobile header (`lg:hidden`) and a desktop header (`hidden lg:block`) at the same time. So `dashboard-back-btn` exists twice (builder:2240 and 2480), `request-edit-pill` exists twice (view:956 and 1190), and the Landing, Fullscreen and Edit Dashboard buttons each appear twice. Only the share button has its duplicate suppressed (actions:76). Tests should use `:visible` locators and a fixed viewport of 1280px or wider.
2. **Two of the three list share test ids are unreachable.** The list view mode is hardcoded to `'table'` (list:141). The card and list renderers (list:1059–1623) never render, so `dashboard-share-card-{id}` and `dashboard-share-mobile-{id}` never reach the DOM. Only `dashboard-share-table-{id}` is live.
3. **Features you asked about that don't exist:**
   - No dashboard-level PDF or PNG export. Export is per widget only: PNG/CSV for charts, KPICard download for KPIs.
   - No dashboard refresh button. It is commented out in view:1025 and actions:65.
   - No delete button on the view page. Commented out in actions:88.
   - No list search, type filter or published filter. These are commented out; per-column filters replace them.
   - No screen-size or filter-layout settings. Commented out in builder:2311 and 2610.
4. **The builder saves as soon as it opens.** `useDebounce` starts with the initial state, so the autosave effect (builder:908) sends `PUT /api/dashboards/{id}/` about 5 seconds after mount. It also takes a lock with `POST .../lock/`. If a test mocks the network, both requests must be expected.
5. **Changing browser tab releases the edit lock.** A `visibilitychange` to hidden triggers `DELETE /lock/` from both builder:866 and edit page:139, plus a save through cleanup. Nothing takes the lock back when the tab becomes visible again.
6. **Share goes through the access API.** The share modal calls `PATCH /api/access/dashboard/{id}/general-access`. `updateDashboardSharing` (`PUT /api/dashboards/{id}/share/`) and `getDashboardSharingStatus` are only referenced by unit tests.
7. **The legacy public route never loads.** `/public/dashboard/[token]` passes `dashboardId={0}` with no data, so `useDashboard(0)` never fetches and the page shows the loading skeleton forever. The working public route is `/share/dashboard/[token]`.

---

## 1. Routes, loading and permission screens

| Feature | Where | data-testids | API | Notes |
|---|---|---|---|---|
| List route `/dashboards` | pages `app/dashboards/page.tsx:3` | — | — | Renders `DashboardListV2`. |
| Create route `/dashboards/create` | `create/page.tsx:31-53` | NONE | `POST /api/dashboards/` `{title:'Untitled Dashboard', grid_columns:12}` | Creates automatically on mount; a ref prevents double creation under StrictMode. Then `router.replace('/dashboards/{id}/edit?new=true')`. On error: toast and push to `/dashboards`. Spinner text "Creating dashboard...". |
| Create: access denied | `create/page.tsx:56-74` | NONE | — | Needs `can_create_dashboards`. Shows "Access Denied / You don't have permission to create dashboards." and a "Back to Dashboards" button. |
| View route `/dashboards/[id]` | `[id]/page.tsx` | NONE for skeleton | `GET /api/dashboards/{id}/` | Needs `can_view_dashboards`, otherwise Access Denied (51-69). Skeleton while loading (71-86). |
| View: no access (403) | `[id]/page.tsx:35,88` | `no-access` | `POST /api/access/dashboard/{id}/request-access` (from the dialog) | Only a 403 shows NoAccess. |
| View: 404 falls back to Superset | `[id]/page.tsx:93-98` | NONE | `GET /api/superset/dashboards/{id}/` | A missing native id falls through to the Superset view, which shows "Error Loading Dashboard". |
| View: native "Not Found" | view:871-890 | NONE | — | "Dashboard Not Found" with a Back button. |
| Edit route `/dashboards/[id]/edit` | `[id]/edit/page.tsx` | NONE | `GET /api/dashboards/{id}/` | Spinner "Loading dashboard...". Requires `access_level === 'edit'`, otherwise "You have view-only access to this dashboard." (242-258). `?new=true` opens the title field in edit mode. |
| Edit: locked by another user | edit page:263-339 | NONE | `GET /api/dashboards/{id}/` polled every 10s | Shows "Dashboard is Currently Locked", "Currently edited by: X", a countdown "Auto-refreshing in N seconds...", and "Refresh Now" / "Go Back" buttons. |
| Edit: unlock on leave | edit page:109-177 | — | `DELETE /api/dashboards/{id}/lock/` plus save | Triggered by beforeunload, popstate, tab hidden, clicks on links (capture phase), and unmount. |
| Usage dashboard `/dashboards/usage` | `usage/page.tsx`, usage:12-111 | NONE | `POST /api/superset/embed_token/{NEXT_PUBLIC_USAGE_DASHBOARD_ID}/` | RoleGuard allows super-admin, admin, analyst. If `currentOrg.viz_url` is missing: "You have not subscribed to Superset for Visualisation." |
| Superset dashboard view | ssv:67-262, sse | NONE | `GET /api/superset/dashboards/{id}/`, `POST .../guest_token/` | Buttons: Share (copies URL, no toast), Refresh, Open in Superset. Has an ErrorBoundary. |
| Public share `/share/dashboard/[token]` | pub:70-252 | NONE | `GET /api/v1/public/dashboards/{token}/` | Invalid token or `is_valid` false shows "Dashboard Not Found" with "Sign in to Dalgo" and "Learn about Dalgo". Header shows org brand, title, "Public View", "Read Only" badge, "Modified …", Powered by Dalgo. Tracks `PUBLIC_DASHBOARD_VIEWED` once per token. |
| Public embed mode | share `page.tsx:14-27`, pub:150-249 | NONE | same | Query params: `embed=true&title&org&theme=light|dark&padding`. No header. Optional title and org row. Dark theme uses `bg-gray-900` / `bg-gray-800`. PoweredByDalgoFooter. Tabs and filters are hidden in embed mode (view:1335, 1352, 1373). |
| Legacy `/public/dashboard/[token]` | legacy pub | — | none | Stuck loading forever (see item 7 above). |

## 2. Dashboard list

| Feature | Where | data-testids | API | Notes |
|---|---|---|---|---|
| Fetch and paginate | list:224-245, hooks:75-128 | NONE | `GET /api/dashboards/?page=N&page_size=M` | Accepts a paginated or a plain-array response. Revalidates on focus; 5s dedupe. |
| Header and Create | list:1640-1666 | ids: `dashboard-create-link`, `dashboard-create-button`, `dashboard-page-title` | — | Create is shown only with `can_create_dashboards`. Title is wrapped in a DocsLink. |
| Sort by Name / Owner / Last Modified | list:251-258, 324-351, 1802-1875 | NONE (sort buttons have no id or testid) | client-side | Default is `updated_at` descending. Clicking the same column toggles direction; a new column starts descending. Icons: ArrowUpDown, ChevronUp, ChevronDown. |
| Name filter popover | list:590-663, 1812-1828 | Checkbox ids `favorites`, `locked`, `shared`; the trigger has none | client-side | Text search (placeholder "Search dashboard names..."), "Show only favorites / locked / shared", Clear. |
| Owner filter popover | list:671-726 | NONE | client-side | Owner search, clickable rows, "No owners found", Clear. Owner is `created_by`, then `changed_by_name`, then 'Unknown'. |
| Date modified filter popover | list:729-807 | Radio ids `all`, `today`, `week`, `month`, `custom` (generic, collision-prone) | client-side | Custom range uses two `type=date` inputs. |
| Active filter summary and Clear all | list:378-397, 1670-1685 | id `dashboard-filters-section` (same string as rfs' `data-testid`) | — | "N filter(s) active", "Clear all". A teal dot marks each active column. |
| Pinned rows (landing and org default) | list:399-411, 1899 | NONE | — | Pinned rows render first. Badges: "My Landing", "Org Default". |
| Lock badge | list:868-881 | NONE | — | "Locked" (red, someone else) or "By You" (blue). |
| Favorite star toggle | list:828-842, lib/favorite-utils.ts | NONE (icon-only, no aria-label) | `POST` / `DELETE /api/dashboards/{id}/favorite/` | Failure shows the toast `toastError.update(…,'favorite')`. |
| Open dashboard (title link) | list:844-849 | NONE | — | Links to `/dashboards/{id}`, or `#` without view permission. |
| Edit icon | list:917-923 | NONE | — | Shown only when `access_level==='edit'`. |
| Share icon | list:924-935 | `dashboard-share-table-{id}`, aria-label "Share dashboard: {title}" | see §8 | `access_level==='edit'`. Tracks `DASHBOARD_SHARED` on copy link. |
| Row menu (kebab) | list:936-1050 | NONE on trigger or items | — | Sections: Landing Page, Duplicate, Delete. |
| Set/remove my landing page | list:949-970, 512-529 | NONE | `POST /api/dashboards/landing-page/set-personal/{id}`, `DELETE /api/dashboards/landing-page/remove-personal` | Toasts come from the hook. Revalidates `/api/currentuserv2`. |
| Set org default | list:972-981 | NONE | `POST /api/dashboards/landing-page/set-org-default/{id}` | Needs `can_manage_org_default_dashboard`. Disabled when the dashboard is already org default ("Current org default"). No remove option in the UI, although the hook has `remove-org-default`. |
| Duplicate | list:985-1008, 448-473 | NONE | `POST /api/dashboards/{id}/duplicate/` | Needs `can_create_dashboards`. Shows "Duplicating..." spinner, then `toastSuccess.duplicated`. |
| Delete with confirm | list:1009-1048, 424-445 | NONE | `DELETE /api/dashboards/{id}/` | Needs `can_delete_dashboards`. AlertDialog "Delete Dashboard", Cancel/Delete, "Deleting...". |
| Pagination | list:1971-2052 | ids `dashboard-page-size-trigger`, `dashboard-page-size-{10,20,50,100}`, `dashboard-prev-page-button`, `dashboard-next-page-button`, `dashboard-page-info`, `dashboard-pagination-info` | page params | Changing page size resets to page 1. Info text "x–y of N". |
| Loading skeleton | list:1691-1760 | NONE | — | 8 skeleton rows. |
| Error state | list:1625-1635 | NONE | — | "Failed to load dashboards" and a Retry button that reloads the page. |
| Empty state | list:1948-1966 | ids `dashboard-empty-state`, `dashboard-empty-text`, `dashboard-empty-create-button` | — | Text is "No dashboards yet", or "No dashboards found" when filters are active. |

List edge cases:
- Filtering and sorting run only on the current server page (list:261, 416).
- Pinned dashboards are taken from the current page only.
- `total` comes from the API.

## 3. Builder: header, title, save, preview, undo

| Feature | Where | data-testids | API | Notes |
|---|---|---|---|---|
| Back | builder:2231-2245, 2474-2485 | `dashboard-back-btn` (appears twice) | save plus `DELETE lock` through cleanup | Calls `onBack`, which runs cleanup (save, unlock, revalidate `/api/dashboards/`) then pushes `/dashboards`. |
| Title edit | builder:2492-2525 (desktop), 2248-2277 (mobile) | `dashboard-title-display`, `dashboard-title-input`, `dashboard-title-input-mobile` (the mobile display div has no testid) | `PUT /api/dashboards/{id}/` | Click to edit; Enter or blur saves. An empty title becomes "Untitled Dashboard". Starts in edit mode when `?new=true`. |
| Description popover | builder:117-195, 2527 | `dashboard-description-display`, `-input`, `-save` (mobile: `dashboard-description-mobile-*`) | PUT dashboard | Max 100 characters with an "n/100" counter. Cmd/Ctrl+Enter saves. Esc or outside click reverts to the snapshot. Empty shows "+ Add description". |
| Explicit Save | builder:2691-2719 | `dashboard-save-btn` | `PUT /api/dashboards/{id}/` `{title, description, grid_columns, target_screen_size, filter_layout, tabs}` | Flushes rich text first. Tracks `DASHBOARD_UPDATED` (source save_button) only on success. There is no Save button in the mobile header. |
| Save status indicator | builder:2589-2607, 2445-2466 | NONE | — | "Saving..." → "Saved" (3s) or error message (5s). The desktop text is `hidden xl:inline` (≥1280px); below that only the icon shows. |
| Autosave | builder:776, 908-912 | — | PUT dashboard | 5s debounce on editor state. Suppressed for 1s after undo/redo. Runs on mount (item 4 above). |
| View (save and open view mode) | builder:2722-2741, 2290-2309; edit page:180-207 | `dashboard-preview-btn`, `view-dashboard-mobile-btn` | save, unlock, then push `/dashboards/{id}` | While navigating: disabled, spinner, text "Saving and opening view...". Tracks `DASHBOARD_UPDATED` (save_and_view) only if saved. |
| Undo / Redo | builder:553-586, 2577-2583, 2423-2440 | NONE (icon-only, no aria-label) | — | History holds 20 entries (`useUndoRedo(…,20)`). Keyboard: Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Ctrl+Y (929-946); ignored inside inputs, contenteditable and ProseMirror. Tab switching is not recorded (1139), but snapshots include `activeTabId`, so undo can jump tabs. |
| Edit lock | builder:836-847, 949-1020 | — | `POST /api/dashboards/{id}/lock/` (returns `lock_token`), `PUT .../lock/refresh/` every 60s, `DELETE .../lock/` | A 423 or "locked by" error triggers `window.alert(...)` then a hard redirect to `/dashboards`. If refresh fails, the token is cleared. beforeunload uses `sendBeacon`; tab hidden uses a keepalive `fetch` DELETE. |
| Screen size / filter-layout settings | builder:2311-2390, 2610-2689 | — | — | Commented out. Filter layout is decided by viewport: vertical if ≥1200px, else horizontal (builder:722). |

## 4. Builder: canvas, cells, add, remove, drag, resize

| Feature | Where | data-testids | API | Notes |
|---|---|---|---|---|
| Add Chart | builder:2540-2559 → csm | `add-chart-btn` (the mobile "Chart" button has none) | `GET /api/charts/` (existence check), `GET /api/charts/?search=` | If the org has zero charts, desktop navigates to `/charts/new?from=dashboard`; mobile always opens the modal. |
| Chart selector modal | csm:21-135 | NONE | `GET /api/charts/?search=…` | Title "Add Chart", search placeholder "Search charts...", "CREATE NEW CHART" link. Cards: charts already on the tab are disabled and labelled "Already added". States: "Loading charts...", "No charts found matching your search.", "No charts available yet." with "CREATE YOUR FIRST CHART". |
| Chart inserted | builder:1665-1749 | `data-component-id="chart-{ts}"` on the cell | `GET /api/charts/{id}/` (fallback to stub metadata on error) | Lands full-width (w=12) at `bottomY`, height from chart type. Has entrance animation and scroll-into-view. Tracks `DASHBOARD_CHART_ADDED`. The excluded-ids list covers the active tab only, so the same chart can be added on another tab. |
| Add KPI and KPI modal | builder:2561-2569, 1752-1802; ksm:20-156 | `add-kpi-btn` (the mobile "KPI" button has none) | `GET /api/kpis/?search=` | Title "Add KPI", "CREATE NEW KPI" links to `/kpis`, "Already added", "No KPIs available yet." with "GO TO KPIs". Reads `kpi.metric.name` without a null check, so a KPI with no metric crashes the modal. |
| Add Text | builder:2571-2574, 1805-1865 | NONE (desktop "Add Text" and mobile "Text" both lack testids) | — | Adds an empty paragraph cell at full width. Tracks `DASHBOARD_TEXT_ELEMENT_ADDED`. |
| Legacy "heading" and "filter" cell types | view:755-775, 804-845 | NONE | — | View mode renders them for old data. Missing filter shows "Filter not found: ID x". They cannot be added anymore. |
| Cell toolbar: chart | cell:93-128 | NONE; titles "View Chart", "Edit Chart", "Remove Chart From Dashboard" | — | Edit is shown only when the chart's `access_level==='edit'` (`GET /api/charts/{id}/`). Hover-revealed on hover-capable devices. Remove has no confirm. |
| Cell toolbar: KPI | cell:147-182 | NONE; titles "View KPI", "Edit KPI", "Remove KPI From Dashboard" | `GET /api/kpis/{id}/` | Edit gated on the KPI's access level. |
| Cell toolbar: text | cell:131-144 | NONE; title "Remove Text From Dashboard" | — | Hover only (`opacity-0`). |
| View/Edit widget navigation | builder:2117-2143, lib/widget-navigation.ts | — | — | Goes to chart/KPI view or edit URL with `source=dashboard`. |
| Remove widget | builder:1869-1888 | — | autosave | Items below slide up (`compactVertical`). Tracks `DASHBOARD_ELEMENT_REMOVED`. |
| Drag to move | cell:185-187; builder:1533-1619, 2843-2879 | NONE; drag strip text "Drag to move"; RGL classes `.react-grid-item`, `.react-draggable` | autosave | Only the top 32px strip is draggable; content has `.drag-cancel`. Layout is committed once, on drag stop. Items only move vertically on collision (`compactType="vertical"`). Auto-scrolls within 60px of the canvas edge, up to 30px per frame. |
| Resize | builder:1631-1662, 2877-2878 | RGL `.react-resizable-handle-{s,w,e,n,sw,nw,se,ne}` | autosave | Minimum sizes per type from `getMinGridDimensions`; max width 12. 12 columns, row height 20, margin and padding 8. |
| Cross-tab widget move | builder:1350-1530; xtab | `cross-tab-drag-overlay` (text "Move {type} to this tab"), `cross-tab-drop-placeholder`; target tab via `data-dashboard-tab-id` | autosave | Hover a tab for 500ms mid-drag to hand off to it. Drop inside the canvas commits; Esc, window blur, or drop outside cancels. Releasing over a tab before 500ms also cancels. Tracks `DASHBOARD_WIDGET_MOVED_BETWEEN_TABS`. |
| Empty canvas (builder) | builder:2817-2835 | NONE | — | No empty-state message, just a blank white canvas with min height 800px. |

## 5. Builder: chart title and chart content

| Feature | Where | data-testids | API | Notes |
|---|---|---|---|---|
| Chart title override | cte:53-195; cev2:266-271 | NONE; titles "Click to edit title", "Hide title", "Show title", "Cancel (Esc)" | autosave | Click to edit; Enter or blur saves; Esc cancels. Typing the original title removes the override. Empty input hides the title. Shows "Custom title • Original: …". Clicking Cancel probably saves anyway, because the input's blur handler fires first. |
| Chart data (builder) | cev2:276-282, 442-485 | NONE | `GET /api/charts/{id}/data/?dashboard_filters=<json>` | Retries at most once; no retry on 404 or "Error generating chart data". |
| Table chart | cev2:488-581, 1335-1417 | NONE | `POST /api/charts/chart-data-preview/?page=&limit=&dashboard_filters=`, `POST .../total-rows/` | 20 rows per page. Dashboard filters are applied only if the filter's schema and table match the chart's. Drill-down by row click, "← Back" breadcrumb. |
| Map chart | cev2:323-435, 1418-1437 | NONE | `GET /api/charts/regions/?country_code=IND…`, `GET /api/charts/regions/{id}/geojsons/`, `GET /api/charts/geojsons/{id}/`, map-data-overlay | Region-click drill-down with toasts. "Home" breadcrumb. Clicking breadcrumb i drills up to level i-1, so clicking the current crumb removes it. |
| Pivot table | cev2:1318-1334 | NONE | chart data | Shows "No data available" when empty. |
| Loading / error | cev2:1291-1317, 600-621 | NONE | — | Loading text: "Loading chart/table data/map...". Error card "Chart Error" with a generic message (data vs configuration), no retry. |
| KPI (builder) | cell:211-221; kpi | `kpi-card-{kpiId}` | `GET /api/kpis/{id}/data/` | The builder does not pass `dashboardFilters` to KPIs, so KPIs ignore filters in edit mode. Error text: "Failed to load KPI". |

## 6. Builder: text widget (rich text and image)

| Feature | Where | data-testids | API | Notes |
|---|---|---|---|---|
| Enter/exit editing | text:212-304 | `dashboard-rich-text-editor` (ProseMirror) | autosave | Click to edit. Outside click or focus moves away commits. Esc discards. Cmd/Ctrl+Enter commits. Drag start commits. Save and tab switch flush pending edits through the `dashboard:rich-text-flush` event. Placeholder: "Start typing…" or "Type on image (optional)…". |
| Toolbar: style and heading | rtt | `rich-text-style`, `rich-text-paragraph`, `rich-text-heading-{1,2,3}` | — | Floating toolbar marked with `[data-rich-text-toolbar]`. |
| Toolbar: font size / B / I / U | rtt | `rich-text-font-size`, `rich-text-bold`, `rich-text-italic`, `rich-text-underline` | — | Font size range 10–32, default 16. |
| Toolbar: alignment | rtt | `rich-text-align`, `rich-text-align-{left,center,right}` | — | |
| Text colour / background colour | rtt:124-219, 526, 570 | `rich-text-color-picker`, `rich-text-bg-color-picker`, `rich-text-{prefix}-{hex}`, `rich-text-custom-{prefix}-{toggle,hex,ok,cancel}` | — | Background colour tracks `DASHBOARD_TEXT_IMAGE_UPDATED`. |
| Image upload | text:340-376; img:212-221 | `rich-text-image`, `rich-text-image-tab-{upload,link}`, `rich-text-image-upload-btn`, `rich-text-image-file-input` | `PUT /api/dashboards/images/` (multipart `file`) | Client-side checks: JPEG/PNG/GIF/WEBP/SVG, max 5MB, with error toasts. Button shows "Uploading…". |
| Image by link | text:378-392 | `rich-text-image-link-input`, `rich-text-image-link-confirm` | — | Enter confirms. Empty input is ignored. |
| Image replace / remove / cancel | text:394-420 | `rich-text-image-reload`, `rich-text-image-remove`, `rich-text-image-cancel-replace` | — | Remove also clears the caption and size. |
| Image fit | img:139-146 | `rich-text-image-size-{fill,fit,stretch}` | — | Maps to object-cover, object-contain, object-fill. |
| Caption | text:505-540 | `rich-text-caption-input`, `rich-text-caption-display`, `rich-text-caption-align-{l,c,r}` | — | Enter or Esc commits (Esc does not cancel). |
| Image render | text:549-567 | `dashboard-text-image` | — | In view mode a text cell with no content, rich text or image renders nothing. |

## 7. Tabs

| Feature | Where | data-testids | API | Notes |
|---|---|---|---|---|
| Tab bar | tabbar:404-465 | `dashboard-tab-bar`, `dashboard-tab-scroll`, `tab-item-{id}` (role=tab, aria-selected) | autosave | In view mode it is shown only with 2 or more tabs (view:505), and never in embed mode. In report mode it sits inside the scroll area. |
| Add tab | tabbar:334-339, 450-461; builder:1147-1156 | `add-tab-btn` (aria-label "Add new tab") | — | New tab is titled "Untitled Tab N" (`getNextTabNumber`) and becomes active. Tracks `DASHBOARD_TAB_CREATED`. |
| Switch tab | tabbar:117-121, 160-174; builder:1134-1142 | `tab-item-{id}` | — | Keyboard: Enter or Space. Switching flushes rich text. Not added to undo history. |
| Rename tab | tabbar:124-157, 227-239 | `tab-title-{id}` (aria "Rename X tab"), `tab-rename-input-{id}` | — | Only a click on the active tab's title starts rename. Enter or blur commits; Esc cancels. Max 50 characters; empty or unchanged reverts. Tracks `DASHBOARD_TAB_RENAMED`. |
| Remove tab | tabbar:264-282; deltab; builder:1159-1181 | `tab-remove-btn-{id}`, `delete-tab-dialog`, `delete-tab-cancel-btn`, `delete-tab-confirm-btn` | — | Hidden when only one tab exists. The dialog says the change "cannot be undone", but undo does restore the tab. After removal the previous tab becomes active. |
| Reorder tabs | tabbar:341-399 | `tab-reorder-indicator-{id}` | — | dnd-kit, starts after 6px of movement. Keyboard: Alt+Left/Right. Auto-scrolls near the tab bar edges. Disabled during a widget drag. Tracks `DASHBOARD_TAB_REORDERED`. |
| Legacy (pre-tabs) data | tabutils:70-97 | — | — | Old top-level layout and components are wrapped into "Untitled Tab 1". |

## 8. View mode (`DashboardNativeView`)

| Feature | Where | data-testids | API | Notes |
|---|---|---|---|---|
| Header metadata | view:1124-1186, 907-1122 | `dashboard-description` (desktop only); title uses class `.dashboard-header-title` | `GET /api/dashboards/{id}/` | Badges: "Published"; "Locked by {email}" or "Locked by you" (mobile shows just "Locked"). Also "Updated by X" and "Modified … ago". |
| Back | view:1128-1133, 912-921 | NONE | — | Hidden in fullscreen. |
| Request edit pill | view:956, 1189-1195 | `request-edit-pill` (appears twice) | request-access POST | Shown only when `access_level==='view'`, and not in report mode. |
| Landing page dropdown | view:1197-1258, 962-1023 | NONE | same landing-page endpoints as the list | Button text: "Set Landing", "My Landing" or "Org Default". Org default section needs `can_manage_org_default_dashboard`. |
| Fullscreen (dashboard) | view:564-568, 1261-1263, 1034-1041 | NONE (icon-only, no label) | — | Uses the shared `useFullscreen('dashboard')` hook (Fullscreen API). There is no exit button; exit with Esc. |
| Share button | actions:70-80 | `dashboard-share-btn`, aria-label "Share dashboard" | see share row | Needs `canEdit` (`access_level==='edit'`). |
| Edit Dashboard | actions:81-86, 152-158 | NONE | — | Needs `canEdit` and not locked by another user. Goes to `/edit`. |
| Actions on mobile/tablet (<1200px) | actions:122-171 | NONE; sr-only "Dashboard actions" | — | Dropdown with "Share Dashboard" and "Edit Dashboard". |
| Share modal | share; view:1617-1628; list:2055-2066 | `share-modal`, `general-access-select`, `copy-link-btn`, `share-submit-btn`, `share-close-btn`, `share-invite-role`, `access-request-row/approve/deny-{id}`, `admin-takeover-btn`, `admin-takeover-confirm-btn` | `/api/access/dashboard/{id}/grants` (GET/POST/PATCH/DELETE), `PATCH .../general-access` `{mode}`, `GET/POST .../request-access`, `POST .../request-access/{rid}/respond`, `POST .../transfer-ownership`, `GET .../candidates`, `GET /api/v1/organizations/people`, active-members, user_groups | Copying the public link tracks `DASHBOARD_SHARED`. Switching to public tracks `DASHBOARD_MADE_PUBLIC` and marks the onboarding milestone. `?openShare=true` opens the modal on load, and closing strips the param. |
| Walkthrough celebration | view:1607-1615, 605-618 | `dashboard-live-modal` | — | Only when onboarding is active: copying the link opens "Congratulations, you're officially live!". |
| Embed code | embed:24-193; view:1043-1049, 1265-1271 | NONE (Code icon trigger; switches, select and inputs have no ids) | none (clipboard only) | Shown only when `public_share_token` exists. Options: Show title/organization/padding switches, Theme select, Width/Height (fallback to 800/600 if empty or invalid). Read-only iframe snippet pointing at `/share/dashboard/{token}?embed=true…`. "Copy Embed Code" becomes "Copied!" for 2s. Tracks `DASHBOARD_EMBED_CODE_COPIED`. |
| Grid render | view:1443-1520 | `.dashboard-grid`, `.dashboard-item` | — | Read-only. `compactType` vertical, row height 20. |
| Empty dashboard | view:1430-1440 | NONE | — | "No Dashboard Components". |
| Chart per-widget toolbar | cev:1820-1871 | NONE; View has aria-label "View Chart", Download has title "Download", Fullscreen has title "Fullscreen" | — | Hover-revealed on hover-capable devices. Not shown in report or frozen mode. |
| Chart PNG download | cev:1567-1601 | NONE ("Download as PNG" menu item) | none (client side) | Branded export: org logo, title, powered-by. Tables and pivots export via DOM capture. Success and failure toasts. |
| Chart CSV export | cev:1604-1700 | NONE ("Export Data as CSV") | `POST /api/charts/download-csv/?dashboard_filters=`; public: `POST /api/v1/public/dashboards/{token}/charts/{id}/download-csv/` | Hidden for number charts. Pivot tables export client-side. Toasts: "Preparing CSV download...", success, "CSV Export Failed". |
| Chart fullscreen | cev:1702-1728, 1805-1817 | NONE | — | Overlay shows org brand, centred title, and PoweredByDalgo. |
| Chart error with Retry | cev:1758-1788 | NONE ("Retry" button) | re-fetch | Also shown when chart data is null and the chart is not a table or map. |
| Chart data (view) | cev:231-300, 1534-1545 | NONE | `GET /api/charts/{id}/data/?dashboard_filters=`, `GET /api/charts/{id}`; public: `GET /api/v1/public/dashboards/{token}/charts/{id}/`, `/data`, `POST .../data-preview/`, `POST .../data-preview/total-rows/`, `.../map-data/`, `/api/v1/public/regions/…`, `/api/v1/public/geojsons/{id}/` | Re-fetches whenever `dashboardFilters` changes. |
| KPI (view) | kpi; view:777-802 | `kpi-card-{id}`; KPICard Download and Fullscreen buttons by title; View button aria-label "View KPI" | `GET /api/kpis/{id}/data/?dashboard_filters=`; public: `GET /api/v1/public/dashboards/{token}/kpis/{id}/data/` | |
| Shared with other surfaces | `/impact` (landing page, `showMinimalHeader`), reports, public view | — | `GET /api/dashboards/landing-page/resolve` | Filters start collapsed for minimal header, public and report modes. |

## 9. Dashboard filters

| Feature | Where | data-testids | API | Notes |
|---|---|---|---|---|
| Panel, vertical (desktop ≥1200px) | panel:641-786 | `dashboard-filters-panel` | — | In the builder it always shows, with empty state "No filters added yet / Click "Add"…". In view mode it only shows when there are filters. |
| Panel, horizontal (<1200px in builder) | panel:519-639 | `dashboard-filters-panel` | — | Hide (X, aria "Hide filters"). When hidden, the builder shows "Show Filters (n)" (builder:2761-2775, no testid). Empty state says "Add Filter". |
| Mobile/tablet view accordion | rfs:29-89 | `dashboard-filters-section` | — | "Filters • N applied". N counts every applied key, including nulls, so after Apply it equals the total filter count. |
| Collapse / expand | panel:403-413 | NONE; aria "Collapse filters panel", "Expand filters panel", "Hide filter list", "Show filter list" | — | Collapsing in view mode fires a window resize after 350ms. A blue dot means filters are applied. |
| Add filter | panel:452, 560, 692 → fcm | NONE ("Add" / "Add Filter" buttons) | — | Edit mode only. |
| Create/Edit filter modal | fcm:123-756 | ids `filter-name`, `single-select`, `multi-select`, `slider-ui`, `input-ui`; Combobox gets an auto-generated id (unstable) | `GET /api/warehouse/sync_tables?fresh=1` (datasets), `GET /api/warehouse/table_columns/{schema}/{table}`, `GET /api/filters/preview/?schema_name&table_name&column_name&filter_type&limit=100`, edit: `GET /api/dashboards/{id}/filters/{fid}/` | Titles "Create Dashboard Filter" / "Edit Dashboard Filter". Info and Preview tabs; Preview is disabled until a column is chosen. Type is auto-detected (`recommended_filter_type` or data type) and shown as "Dropdown Filter", "Range Filter" or "Date Range Filter". Name auto-fills from the column (snake_case to Title Case). Dataset is disabled in edit mode. Buttons: Cancel, "Create Filter" / "Save Changes" (disabled until valid). Helper text: "Fill in all required fields to continue". Edit mode shows "Loading filter configuration...". |
| Create | builder:1963-2001 | — | `POST /api/dashboards/{id}/filters/` | Revalidates the dashboard. Errors only go to the console (no toast). Tracks `DASHBOARD_FILTER_CREATED`. |
| Update | builder:1914-1961 | — | `PUT /api/dashboards/{id}/filters/{fid}/` | Silent on failure. Tracks `DASHBOARD_FILTER_UPDATED`. |
| Delete | fel:129-137 → panel:265-284 | NONE; title "Remove filter" | `DELETE /api/dashboards/{id}/filters/{fid}/` | No confirm. Hidden immediately. `removeFilter` in the builder (2004) is dead code. |
| Edit (opens modal) | fel:120-128 | NONE; title "Edit filter" | — | Hover only. |
| Reorder | fel:98-106; panel:286-315, 375-387 | NONE; title "Drag to reorder" (GripVertical) | `PUT /api/dashboards/{id}/filters/{fid}/` `{order}` for each moved item, then revalidate | dnd-kit, starts after 5px, keyboard sensor enabled. Failure toast "filter order". |
| Value filter, single | widgets:35-222 | Combobox auto ids (`combobox-:rX:-input/-item-{value}`) | private: `GET /api/filters/preview/?…&filter_type=value&limit=100`; public: `GET /api/v1/public/dashboards/{token}/filters/preview/?…` | Placeholder "Select..." in edit, "Choose option..." in view. States: "Loading options...", "Options need attention" plus error, "No options available". Badge shows selected count. At most 100 options. |
| Value filter, multi | widgets:185-201 | Combobox multi auto ids (`-search`, `-select-all`) | same | Value is an array, or null when empty. |
| Numerical filter (slider or inputs) | widgets:225-454 | NONE | `GET …/filters/preview/?…&filter_type=numerical` (stats min/max) | Badge "Range • Slider|Input". Slider commits on release; inputs commit on blur or Enter and clamp to the stats range. Falls back to 0–100 if stats are missing. `handleReset` (341) is unused. |
| Datetime filter | dtw:14-122 | NONE; DatePicker placeholders "Start date" / "End date", labels From/To | — | Start picker disables dates after the end date and vice versa. Summary text: "Filtering from X to Y", "… onwards", "Filtering up to Y". End date gets `T23:59:59` appended when resolved. Disabled when the filter is locked (report mode). |
| Clear one filter | fel:72-80, 111-119 | NONE; title "Clear filter" | — | Hover only. Changes the local value only; Apply is still needed. Hidden when the filter is locked. |
| Apply | panel:318-351 | NONE ("Apply" button) | charts re-fetch with `?dashboard_filters={"<fid>":value,…}` | Deliberate 500ms delay with spinner. Sends every filter, unset ones as null. Tracks `DASHBOARD_FILTER_APPLIED` with context edit/view/public/report. |
| Clear all | panel:354-363, 581-589, 729-737 | NONE (RotateCcw icon only, no aria-label) | — | Disabled when nothing is active. In report mode it resets to defaults instead of clearing. |
| Defaults on load | lib/dashboard-filter-utils.ts:181 | — | — | Pre-populates the panel. Charts in view mode are not filtered until Apply is clicked, except in report mode (view:307-317). |
| Invalid filter | widgets:458-499, fel:46-52 | NONE | — | Messages: "Invalid filter configuration", "Unknown filter type: x", "Filter needs attention". |

Probable bugs to pin down with characterization tests:
- **(a) Numerical defaults are forced to 0–100.** New numerical filters always save `default_min:0, default_max:100` (fcm:155, 313-318) and there is no UI to change them. So every numerical filter starts "applied" at 0–100. The widget then treats `default_min` 0 as unset and uses the data minimum, but keeps `max` at 100 (widgets:283-293).
- **(b) Date filters save numerical-shaped settings.** Datetime filters fall into the non-value branch and save `{ui_mode, default_min, default_max, step}` (fcm:312).
- **(c) Value filter defaults can't be set.** There is no UI for a value filter's default: `hasDefaultValue` can never become true on create.

## 10. Responsive behaviour

| Behaviour | Where | Notes |
|---|---|---|
| Breakpoints | `hooks/useResponsiveLayout.ts:6-14` | mobile ≤767, tablet 768–1199, desktop ≥1200. |
| Builder header | builder:2227 (`lg:hidden`, <1024px) vs 2470 | Uses Tailwind `lg` (1024px), which differs from the hook's 1200px. So between 1024 and 1199px you get the desktop header with horizontal filters. |
| View actions | actions:61 | Desktop buttons at ≥1200px; kebab dropdown below. |
| Filter placement | builder:722, view:1352, rfs:49 | Desktop: sidebar. Otherwise: horizontal bar in the builder, accordion in the view. |
| Public mobile scroll fixes | view:1579-1605 | Global CSS applied only in public mode. |
| Save status text | builder:2593 | Only visible at ≥1280px (`xl`). |

---

## 11. Pure functions to cover with Jest characterization tests

| Function | Location | Existing test? |
|---|---|---|
| `resolveDashboardFilters`, `formatAsChartFilters`, `createFilterConfigLookup`, `getDefaultFilterValues`, `isFilterValueSet` (private) | `lib/dashboard-filter-utils.ts:43,150,166,181,216` | Only `summarizeAppliedFilters` is tested (`lib/__tests__/dashboard-filter-analytics.test.ts`). |
| `compactVertical`, `bottomY` | `lib/dashboard-animation-utils.ts:231,261` | Yes. |
| `calculateSnapZones`, `applyMagneticSnapping`, `wouldCollide`, `calculateComponentDistance`, `calculateOverlap`, `calculateOptimalPushDirection`, `detectSpaceMakingNeeds`, `applySpaceMaking`, `calculateSpaceMakingLayout`, `createTransitionStyles` | same file :100–584 | No. Mostly unused, because space-making is disabled. |
| `generateTabId`, `createNewTab`, `getDefaultTabsConfig`, `getNextTabNumber`, `initializeTabsData`, `getActiveTabData` | tabutils | Yes. |
| `pointerToGridPosition`, `placeItemInLayout`, `moveWidgetBetweenTabs` | xtab | Yes (`cross-tab-drag.test.ts`). |
| `convertFilterToConfig` (three separate copies that behave differently: the builder one validates and fills defaults, the other two don't) | builder:198, view:213, fcm:56 | No. Good candidate to consolidate. |
| `getActiveEditorTab`, `updateActiveEditorTab`, `generateResponsiveLayouts` (unused), `findAvailablePosition` (unused), `ensureTextContentConstraints`, `applyItemConstraints` logic, initial-tab normalization (479-498), save payload build (1045-1054) | builder:356,360,392,2146,432,1229 | No. These are inline or closure code and need extracting first. |
| `getCurrentScreenSize`, `generateResponsiveLayoutsForPreview` | view:175,187 | No. |
| List filter and sort predicate, `getActiveFilterCount`, `hasActiveFilter`, pinned/regular split, pagination maths, local `debounce` (unused) | list:261-352, 378, 555, 399-421, 121 | No. Extract to utils first. |
| `generateEmbedCode` (URL and iframe format) | embed:35 | No. |
| Value selection reducer `handleSelectionChange` (unused), numerical clamp `handleInputChange`, datetime `handleDateChange` null collapse | widgets:113, 317; dtw:34 | Partially (`dashboard-filter-widgets.test.tsx`). |
| Filter-type auto-detect, auto-name, save-settings builder | fcm:232-270, 281-346 | No. |
| `legacyConfigToRichText`, `sanitizeRichTextDocument`, `richTextDocumentsEqual` | `components/dashboard/widgets/text/rich-text-config.ts:61,109,183` | Yes. |
| `resolveChartTitle`, `isTitleOverridden`, `getTitleEditorValue`, `createTitleUpdateConfig` | `lib/chart-title-utils.ts` | Yes (`__tests__/lib/chart-title-utils.test.ts`). |
| `getMinGridDimensions`, `getDefaultGridDimensions`, `calculateTextDimensions`, `getChartTypeFromConfig` | `lib/chart-size-constraints.ts` | Yes (`__tests__/lib/chart-size-constraints.test.ts`). |
| `useUndoRedo` (dedupe by JSON, max history, `setStateWithoutHistory`) | `hooks/useUndoRedo.ts` | No. |
| `toggleFavorite` | `lib/favorite-utils.ts` | Not found. |
| `useDashboards` response normalization (array vs paginated) | hooks:103-116 | Only the share test exists. |
| Widget URL builders | `lib/widget-navigation.ts` | Yes. |

## 12. Interactive elements with no data-testid

**List**
- Sort buttons Name / Owner / Last Modified (list:1802, 1835, 1866).
- The three filter popover triggers (1819, 1852, 1883).
- Filter inputs and "Clear" buttons (595-617, 677-691, 734-741); owner rows (699); date inputs (775, 790).
- "Clear all" (1675).
- Favorite star (828).
- Title link (844).
- Edit icon link (918).
- Row kebab (938) and its items: Set/Remove landing, Set org default, Duplicate, Delete.
- Delete dialog Cancel/Delete (1032-1043).
- Error Retry (1630).
- The page-size, pagination and create controls have `id`s but no testids.

**Builder**
- Mobile title display div (2272).
- "Add Text" (2571); mobile Chart / KPI / Text (2396-2421).
- Undo/Redo, desktop and mobile (2423-2440, 2577-2583). These are icon-only with no aria-label.
- "Show Filters (n)" (2764).
- Save status indicators.

**Cell**
- View / Edit / Remove buttons for chart, KPI and text (cell:95-179). Titles only.
- Drag strip (185).

**Chart title editor**
- Click-to-edit div, input, Cancel, Hide title, Show title (cte:114-182).

**Chart selector / KPI selector**
- Search input, "CREATE NEW …" links, chart/KPI cards (csm:53, 60, 82; ksm:53, 59, 82). No per-item testid.

**View**
- Back (1129, 913).
- Landing dropdown trigger and items (1198-1257, 963-1022).
- Fullscreen (1261, 1034).
- "Edit Dashboard" (actions:83, 155).
- Mobile "Dashboard actions" kebab and its items (actions:139-158).
- Not Found "Back to Dashboards" (881).

**Chart in view (cev)**
- View Chart (1824), Download trigger (1837), "Download as PNG" / "Export Data as CSV" items (1842-1850), Fullscreen (1855), Retry (1774).
- Map breadcrumb Home and level buttons (1922-1941); table "← Back" (1980).
- The same breadcrumb and back buttons in cev2 (1262-1282, 1340).

**Embed**
- Trigger (embed:74), three switches, theme `<select>`, width/height inputs, textarea, Copy button.

**Filters**
- Panel: Add/Add Filter, Apply, Clear-all (icon-only, no aria-label), collapse, hide and list-toggle buttons (aria-labels only).
- Filter element: drag handle, Clear, Edit, Remove (fel:98-137). Titles only.
- Numerical: slider, Min/Max inputs.
- Datetime: two DatePickers.
- Value: Combobox uses `React.useId` ids that change between renders, because no `id` is passed (widgets:186, 203).

**Filter config modal**
- Info/Preview tabs.
- DatasetSelector.
- Column Combobox (auto id).
- Cancel / Create Filter / Save Changes (fcm:745-750).
- Checkboxes have `id`s only.

**Pages**
- Create and view "Access Denied → Back to Dashboards".
- Edit page: locked screen "Back to Dashboards", "Refresh Now", "Go Back" (edit:268, 323, 326); access-denied Back (251).
- Public: "Sign in to Dalgo", "Learn about Dalgo" (pub:127-135).
- Superset view: Share, Refresh, Open in Superset, Back (ssv:135-189).
- Usage page: none.

**Tabs**
- All covered by testids.

**Rich text and image**
- All covered, except the image caption row click target (text:505).

## 13. Existing unit tests in this area (for reference)

- `components/dashboard/__tests__/`: `dashboard-cell-navigation`, `dashboard-filter-widgets`, `responsive-dashboard-actions`
- `components/dashboard/widgets/kpi/__tests__/kpi-chart-element-navigation.test.tsx`
- `components/dashboard/widgets/text/__tests__/`: `rich-text-config`, `text-element-unified`
- `components/dashboard/tabs/__tests__/`: `cross-tab-drag`, `DeleteTabDialog`, `tab-utils`, `TabBar`
- `app/dashboards/create/__tests__/page.test.tsx`
- `app/share/dashboard/[token]/__tests__/PublicDashboardView.test.tsx`
- `hooks/api/__tests__/useDashboards.share.test.ts` (deleted in R0)
- `lib/__tests__/dashboard-animation-utils.test.ts`, `lib/__tests__/dashboard-filter-analytics.test.ts`, `lib/__tests__/widget-navigation.test.ts`

For Playwright, the only existing setup is `e2e/login.spec.ts` and `e2e/helpers/auth.ts`, with `baseURL` at `http://localhost:3001` (`playwright.config.ts`).

## 14. Unused files and code

- **Files nothing imports:** `components/dashboard/DashboardMiniPreview.tsx` (deleted in R0), `GridGuides.tsx` and `SpaceMakingIndicators.tsx`. `SnapIndicators` is referenced only by `hooks/useDashboardAnimation.ts`.
- **Dead exports:** `updateDashboardSharing`, `getDashboardSharingStatus`, `getFilterOptions` (which calls `GET /api/dashboards/filter-options/`), plus the module-level `lockDashboard` and `unlockDashboard` in hooks. The builder uses its own inline versions instead.