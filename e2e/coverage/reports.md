# Reports — E2E coverage inventory

The inventory below covers the whole reports area plus the public dashboard/report pages, read at commit `47e45dfc`. Repo root is `/Users/himanshut4d/Documents/Tech4dev/Dalgo/webapp_v2`, and all paths below are relative to it. Line numbers are approximate (±2).

## 0. Scope and what exists today

- **Report routes:**
  - `app/reports/page.tsx`: the list (774 lines).
  - `app/reports/[snapshotId]/page.tsx`: the viewer (388 lines).
  - `app/share/report/[token]/page.tsx` and `PublicReportView.tsx`: the public report.
- **Public dashboard routes:**
  - `app/share/dashboard/[token]/page.tsx` and `PublicDashboardView.tsx`: public dashboard, with an embed mode.
  - `app/public/dashboard/[token]/page.tsx`: an older public dashboard page with no header or error card.
  - **There is no public chart or public KPI route.** Only `/share/dashboard`, `/share/report` and `/public/dashboard` exist.
- **Components:** `components/reports/`: `create-snapshot-dialog.tsx`, `share-via-email-dialog.tsx`, `report-share-menu.tsx`, `comment-popover.tsx`, `comment-icon.tsx`, `print-layout.tsx`, `utils.ts`.
- **Hooks:** `hooks/api/useReports.ts`, `hooks/api/useComments.ts`, `hooks/usePdfDownload.ts`, `hooks/useMentionInput.ts`, `hooks/useOpenShareDeepLink.ts`.
- **Types:** `types/reports.ts`, `types/comments.ts`.
- **Shared code the reports area depends on:**
  - `components/share/ShareModal.tsx` (with `hooks/api/useAccess.ts`)
  - `components/access/request-edit-pill.tsx` and `request-access-dialog.tsx`
  - `components/dashboard/dashboard-native-view.tsx` (the `isReportMode` path)
  - `chart-element-view.tsx`, `kpi-chart-element.tsx`, `unified-filters-panel.tsx`, `filter-element.tsx`, `dashboard-filter-widgets.tsx`
- **Gating and auth:**
  - The Reports nav item is hidden unless the `REPORTS` feature flag is on (`components/main-layout.tsx:132-137`). The `/reports` route itself has no flag guard.
  - Share routes skip auth (`components/client-layout.tsx:24-45`, `lib/api.ts:55`).
- **Existing tests:**
  - Playwright: only `e2e/login.spec.ts` and `e2e/helpers/auth.ts`, with base URL `http://localhost:3001`.
  - Jest: in `components/reports/__tests__/` (utils, comment-utils, comment-icon, comment-popover, comment-states-lookup, create-snapshot-dialog, reports-page, snapshot-viewer-page, plus a mock-data file). Also `PublicReportView.test.tsx` and `PublicDashboardView.test.tsx`.
- **Things that don't exist:** scheduling or recurring reports, report duplication, editing a report's title or date range after creation, or any org-level report settings. The only editable field on a report is the summary.

---

## 1. Reports list (`/reports`), `app/reports/page.tsx`

| Feature | Where | Existing data-testids | API | Notes / edge cases |
|---|---|---|---|---|
| Page header + docs link | 262-273 | NONE | — | Heading "Reports" is wrapped in `DocsLink path="/reports"`. |
| Fetch list | 122; `useReports.ts:36-48` | — | `GET /api/reports/` plus `?search=&dashboard_title=&created_by=` | SWR `revalidateOnFocus: true`. Only non-empty params are sent. The SWR key changes with filters. |
| Loading skeleton | 308-369 | NONE | — | Shown only when `isLoading && !hasAnyFilter`: a 5-column header and 8 skeleton rows. While a filter is being typed, the table renders instead of the skeleton. |
| Empty state (no reports) | 370-384 | `create-first-report-btn` | — | Shown when `snapshots.length===0 && !hasAnyFilter`. Text is "No reports yet". The CTA only appears with `CAN_CREATE_DASHBOARDS`. |
| No filter matches | 571-579 | NONE | — | Row text "No reports match the current filters" (colSpan 5). |
| Error state | — | — | — | **Missing.** `isError` is never read, so a failed API call looks like "No reports yet". Worth pinning in a characterization test. |
| Create report button (header) | 274-283 | `create-report-btn` | see §2 | Gated on `hasPermission(CAN_CREATE_DASHBOARDS)`. `onCreated` calls `mutate()`. |
| Title filter (popover) | 404-441 | input `report-filter-title`; trigger NONE; Clear NONE | `?search=` | Debounced 400 ms (`FILTER_DEBOUNCE_MS`, line 62). Resets to page 1. Active icon is teal with a dot. |
| Dashboard filter | 458-495 | input `report-filter-dashboard`; trigger/Clear NONE | `?dashboard_title=` | Same behaviour. |
| Creator filter | 512-549 | input `report-filter-creator`; trigger/Clear NONE | `?created_by=` | Placeholder "Search by email...". |
| Active filter summary + Clear all | 287-302 | NONE | — | Shows "N filter(s) active", with correct pluralisation. "Clear all" resets all three inputs. |
| Sorting, 4 columns (client-side) | 161-171, 200-232; headers 394, 448, 502, 555 | NONE on any sort button | — | Default is `created_at desc`. Clicking the same column toggles asc/desc. A new column always starts at **desc**. String sorts are case-insensitive. Icons are ArrowUpDown (inactive), ChevronUp or ChevronDown. |
| Pagination (client-side) | 234-238, 686-750 | NONE (page-size select, prev, next, counter) | — | Page sizes 10/20/50/100, default 10. Changing size resets to page 1. Counter reads "a–b of N", or "0–0 of 0" when empty. "X of Y" has a minimum of 1. Prev is disabled on page 1, Next when `current>=totalPages`. **Edge case:** a delete that empties the last page does not step back a page. |
| Row click → view | 582-587 | `report-row-{id}` | — | Goes to `/reports/{id}`. The actions cell stops propagation (612-615). |
| Row cells | 588-610 | NONE | — | Missing `dashboard_title` shows "—". `created_by` hides the avatar and email when empty. Created-on uses `formatCreatedOn`. |
| Share icon (row) | 616-627 | `report-share-{id}` | see §5 | Only shown when `snapshot.access_level==='edit'`. Opens `ShareModal rtype="report"`. |
| Row actions menu | 628-671 | trigger `report-actions-{id}` | — | aria-label "Report actions". |
| → View Report | 641-647 | `report-view-{id}` | — | |
| → Email PDF | 648-656 | `report-email-pdf-{id}` | see §6 | Requires `access_level==='edit'`. |
| → Delete | 657-669 | `report-delete-{id}` | `DELETE /api/reports/{id}/` | Requires `canDelete` (`CAN_DELETE_DASHBOARDS`) **and** `access_level==='edit'`. Confirm dialog: title "Delete report?", description quotes the title, button "DELETE" (uppercased by the dialog). On success: toast, `mutate()`, `REPORT_DELETED` analytics. On failure: `toastError.delete`. The confirm dialog (`components/ui/confirmation-dialog.tsx`) has **no testids**. |

## 2. Create report dialog, `components/reports/create-snapshot-dialog.tsx`

It is only used from the list page. It supports a preselected dashboard (`dashboardId` prop), but nothing passes one today, so creating a report from inside a dashboard is not wired up.

| Feature | Where | Existing data-testids | API | Notes |
|---|---|---|---|---|
| Default trigger | 193-196 | `create-snapshot-trigger` | — | Only used when no `trigger` prop is passed, which is currently never. |
| Dialog shell | 199-201 | `create-snapshot-dialog` | — | Title "Create a report". |
| Dashboard picker (Combobox) | 210-232 | **Unstable:** Combobox gets no `id`, so its testids are `combobox-{useId}-input`, `-item-{value}`, `-listbox`, `-empty` (`components/ui/combobox.tsx:313`) | `GET` dashboards list via `useDashboards({dashboard_type:'native'})` (only while open and no preselect), and `useDashboard(id)` for the selected one | Required ("Please select a dashboard"). Changing the dashboard clears the date column. With a preselected dashboard, the title shows as plain text instead. |
| Report name | 239-254 | `snapshot-report-name` | — | Required. Whitespace-only fails with "Please enter a report name". Trimmed before submit. |
| Datetime column discovery | 107-109; `useReports.ts:84-91` | — | `GET /api/reports/dashboards/{dashboardId}/datetime-columns/` | Placeholders: "Discovering date columns..." while loading, "No date columns available", or "Pick the date-time column to filter by". |
| Auto-select date column | 118-127 | — | — | Picks the column with `is_dashboard_filter`, otherwise the only column if there is exactly one, otherwise nothing. |
| Date column select | 267-303 | trigger `snapshot-date-column`; items NONE | — | Option label is `table.column`, value is `schema.table.column`. Disabled when there are no columns, no dashboard, or it's still loading. Required only when columns exist. |
| No-datetime message | 262-266 | NONE | — | "No datetime columns found — date filtering will be skipped." Filter and Duration sections dim (and Duration ignores pointer events). Errors are cleared (142-146). |
| Start date picker | 316-326 | NONE (DatePicker has no testids; its OK/Cancel/Clear buttons are unlabelled for tests) | — | Optional. Max is the earlier of end date and today. Uses `useDatePickerWithConfirm` (staged selection, then confirm). |
| End date picker | 332-346 | NONE | — | Required when columns exist ("Please select an end date"). Max is today. |
| Cancel | 355-357 | `snapshot-cancel-btn` | — | Closes the dialog. **The form is not reset**, so reopening shows the old values. |
| Generate Report | 358-364 | `snapshot-submit-btn` | `POST /api/reports/` body `{title, dashboard_id, date_column?, period_start?, period_end?}` (dates as `yyyy-MM-dd`) | Label becomes "Generating..." while submitting. On success: `REPORT_CREATED` analytics (with `has_date_filter`), toast, close, reset, `onCreated`. On failure: `toastError.create`. Date fields are only sent when columns exist and one is selected. The `description` field in the type is never sent. |

## 3. Report viewer (`/reports/[snapshotId]`), `app/reports/[snapshotId]/page.tsx`

| Feature | Where | Existing data-testids | API | Notes |
|---|---|---|---|---|
| Invalid ID | 38-39, 124-133 | `report-go-back-btn` | — | Non-numeric or ≤0 shows "Invalid report ID." `router.back()`. |
| Load | 45; `useReports.ts:50-56` | — | `GET /api/reports/{id}/view/` | Returns `dashboard_data`, `report_metadata`, `frozen_chart_configs`, `access_level`. |
| Loading skeleton | 135-143 | NONE | — | Three skeletons. |
| Error / not found | 145-154 | `report-go-back-btn` (same id as above) | — | "Failed to load report." |
| View analytics | 72-79 | — | — | `REPORT_VIEWED` fires once per mount. |
| Back | 164-172 | `report-back-btn` | — | Always goes to `/reports`. |
| Title + metadata | 174-206 | link `report-dashboard-link`; others NONE | — | Period is "{start or 'All'} - {end}" via `formatDateShort`. "Created by" only when present. Dashboard is a link to `/dashboards/{id}` when `dashboard_id` exists, otherwise plain text. |
| Request Edit pill | 210-214; `components/access/request-edit-pill.tsx` | `request-edit-pill` | `POST /api/access/report/{id}/request-access` (`useAccess.ts:331`) | Only shown when `access_level==='view'`. After sending it reads "Request Edit sent" and is disabled. The dialog (`request-access-dialog.tsx`) has **no testids**: level select locked to Edit, note textarea, Cancel/Send. |
| Download PDF | 215-238; `hooks/usePdfDownload.ts` | `report-download-btn` | `POST /api/reports/{id}/export/pdf/` body `{dashboard_filters: currentFilters}` (binary) | Shown to **all** viewers, not just editors. Spinner while exporting, button disabled. Info toast "Generating Report PDF...", then success or error toast. Filename is the title with characters other than letters, digits, space, `-` and `_` stripped, falling back to `report.pdf`. `REPORT_EXPORTED` fires only on success. The export uses the viewer's live filters (from `onFiltersChange`). |
| Share button | 239-249 | `report-share-btn` | §5 | Requires `access_level==='edit'`. The RBAC share permission is deliberately not checked. |
| Email PDF button | 250-259 | `report-email-pdf-btn` | §6 | Same gate. |
| Executive Summary (read-only) | 317-337 | textarea `report-summary-textarea` | — | Always rendered, read-only unless editing. Placeholder "Add your notes here". "Last updated by: X" only when `last_modified_by` is set. |
| Edit summary | 297-314 | `summary-edit-btn` | — | Requires `canEdit` (`access_level==='edit'`). Focuses the textarea via querySelector on the testid. |
| Save summary | 100-122, 353-361 | `report-save-btn` | `PUT /api/reports/{id}/` body `{summary}` | No-op if the trimmed text is unchanged (no API call, no toast). Label "Saving..." while saving. Success: `REPORT_SUMMARY_UPDATED`, `mutate()`, toast "saved". Failure: toast, stays in edit mode. |
| Cancel summary edit | 340-352 | `report-cancel-edit-btn` | — | Restores the server value. Disabled while saving. |
| Summary sync | 93-98 | — | — | The draft re-syncs from the server only while the user hasn't typed. |
| Summary comments | 286-296 | `comment-trigger-summary` | §4 | **Only shown when `canEdit`.** View-only users cannot see or add summary comments. |
| Dashboard canvas (report mode) | 267-367 | see §7 | chart/KPI data endpoints in §7 | `DashboardNativeView` with `isReportMode`, `hideHeader`, frozen configs. |
| Comment deep link | 42-43, 277-279, 294 | — | — | `?commentTarget=summary` auto-opens the summary popover. `?commentTarget=chart&chartId=N` auto-opens that chart's (or KPI's) popover. |
| Comment states | 81-86 | — | `GET /api/reports/{id}/comments/states/` | Re-fetched after any comment change. |
| Share modal mount | 370-378 | `share-modal` etc. | §5 | **No `?openShare=true` deep link here.** The page does not use `ReportShareMenu`, but `DashboardNativeView` calls `useOpenShareDeepLink` internally (`dashboard-native-view.tsx:301`); what that does in report mode was not checked. |

## 4. Comments and @mentions, `components/reports/comment-popover.tsx`, `comment-icon.tsx`, `hooks/api/useComments.ts`

| Feature | Where | Existing data-testids | API | Notes |
|---|---|---|---|---|
| Trigger | 735-745 | `comment-trigger-summary`, `comment-trigger-chart-{chartId}`, `comment-trigger-kpi-{kpiId}` | — | aria-label "Summary comments", "Chart comments" or "KPI comments". |
| Icon states | `comment-icon.tsx:16-44` | `comment-mention-badge` (`mentioned`), `comment-dot-unread` (`unread`), `comment-dot-outline` (`read`), nothing for `none` | — | The icon turns primary colour while the popover is open. |
| Open → mark read | 567-588 | — | `POST /api/reports/{id}/comments/mark-read/` `{target_type, target_id}` | Fails silently, then calls `onStateChange`. Closing clears the draft. |
| Load thread | 519-523 | — | `GET /api/reports/{id}/comments/?target_type=&target_id=` | Only fetched while open. |
| Mentionable users | 524 | — | `GET /api/reports/mentionable-users/` | Only while open. |
| Empty thread | 759 | NONE | — | No list is rendered, only the input. |
| Comment item | 323-396 | `comment-{id}` | — | Avatar colour comes from `getAvatarColor`, initial from `getInitials`. Time uses `formatCommentTime`. "· edited" shows when `updated_at` and `created_at` differ by more than 1000 ms. |
| New-comment dot | 353-359 | `comment-new-dot-{id}` | — | Shown when `is_new`. |
| Deleted placeholder | 294-321 | `comment-{id}-deleted` | — | "This message was deleted". Placeholders are hidden when **every** comment in the thread is deleted (548-554). |
| Mentions rendered | 150-167 | NONE | — | `@email` renders as the bare email in primary colour, without the `@`. |
| Add comment input | 793-810 | `comment-input` | — | Placeholder "Add a comment or @tag someone." Enter submits, Shift+Enter does nothing (it's a single-line `<input>`). |
| Submit | 591-646, 811-824 | `comment-submit-btn` | `POST /api/reports/{id}/comments/` `{target_type, target_id, content, mentioned_emails}`, then mark-read | Disabled when the draft is empty or submitting. `REPORT_COMMENT_CREATED` includes is_reply, thread_size, mention_count. Failure: `toastError.create`. |
| @mention dropdown | 87-146, 527-533 | `mention-dropdown`, `mention-user-{email}` | — | Opens when typing `@` followed by non-space text before the cursor (`useMentionInput.ts:5`). Case-insensitive substring match, at most 5 results. Arrow keys wrap, Enter selects, Escape closes. Selecting inserts `@email `. Clicking inside the dropdown does not close the popover (750-756). |
| Comment menu | 360-394 | `comment-menu-{id}` | — | Only visible on hover (opacity-0 otherwise). Shown when the user is the author or can moderate. |
| Edit (author only) | 373-381, 399-447 | `edit-btn-{id}`, `comment-edit-textarea-{id}`, `cancel-edit-btn-{id}`, `save-edit-btn-{id}` | `PUT /api/reports/{id}/comments/{cid}/` `{content, mentioned_emails}` | Save is disabled when the text is empty. Mentions work in the edit box too. Failure: toast, stays in edit mode. `REPORT_COMMENT_UPDATED`. |
| Delete (author, or moderator with report Edit) | 382-391, 453-477, 714-729 | `delete-btn-{id}`, `cancel-delete-btn-{id}`, `confirm-delete-btn-{id}` | `DELETE /api/reports/{id}/comments/{cid}/` | AlertDialog titled "Delete Comment". `REPORT_COMMENT_DELETED`. |
| Auto-scroll | 556-564 | — | — | Scrolls to the bottom 100 ms after opening or when the comment count changes. |

**Suspected bugs to pin before the refactor:**
1. `chart-element-view.tsx:1905` looks up the chart comment state with `s.chart_id === chartId`, but `CommentStateEntry` only has `target_id` (`types/comments.ts:17-21`). The chart comment icon probably always shows `none`. The KPI version uses `target_id` (`kpi-chart-element.tsx:88`), and the Jest test `comment-states-lookup.test.ts` mirrors the `target_id` form, so it does not catch this.
2. Neither the chart nor the KPI lookup filters by `target_type`, so a chart and a KPI with the same id would share a state.
3. The mark-read call after submitting (line 623) sends `chart_id: chartId`, while the call on open sends `target_id`. `MarkReadPayload` only defines `target_id`.

## 5. Share via link and permissions (ShareModal, `rtype="report"`), `components/share/ShareModal.tsx`, `hooks/api/useAccess.ts`

| Feature | Where | Existing data-testids | API | Notes |
|---|---|---|---|---|
| Modal | 610-623 | `share-modal` | `GET /api/access/report/{id}/grants`, `.../candidates` (transfer), `.../request-access` | Title `Share "{title}"`. Clicking outside does not close it. The "inner charts inherit" note only appears for dashboards. |
| Pending access requests | 628-680 | `access-request-row-{id}`, `access-request-approve-{id}`, `access-request-deny-{id}` | `POST /api/access/report/{id}/request-access/{reqId}/respond` | Approving also refreshes the grants. |
| People / group / email typeahead | 685-717; `principal-typeahead.tsx:99` | `share-chip-input` | people and groups via `usePeople`/`useUserGroups` | The owner and people who already have access are disabled, with a reason shown. Paste splits multiple emails. Backspace removes the last chip. |
| Staged chips (level select, remove) | 722-764 | NONE (select, and remove via aria-label `Remove {label}`) | — | Level is View or Edit. |
| Pending-invite warning + role | 767-815 | `share-invite-role` | roles via `useRoles` | Only admins pick a role. Others see "invited as Member". |
| People with access | 818-963 | NONE on the row level select or remove (aria-label `Remove {label}`) | `PATCH/DELETE /api/access/report/{id}/grants/{shareId}` | Shows a "You" badge, "Pending" badge, and role/group badge. Inherited rows (`share_id===null`) have a tooltip and remove disabled. The "Transfer ownership" option only appears for owner/admin on an Edit user. |
| Admin takeover | 834-845, 1142-1167 | `admin-takeover-btn`, `admin-takeover-confirm-btn` | `POST /api/access/report/{id}/transfer-ownership` | |
| Transfer confirm | 1115-1139 | NONE | same | |
| General access (Default / Private / Public) | 968-1036 | `general-access-select` | `PATCH /api/access/report/{id}/general-access` `{mode}` | Hidden for users whose access comes from the org floor. Public is disabled when public sharing is off at org level, and only listed when `supports_public`. Options are restricted by parent dashboards, with the list of blocking dashboards shown. Toasts: "…is now public / visible to everyone in your org / private". `REPORT_MADE_PUBLIC` fires on going public (`useAccess.ts:287-306`). |
| Security notice + copy public link | 1038-1059 | `copy-link-btn` | clipboard | "COPY PUBLIC LINK". `onCopyLink` fires only when the clipboard write succeeds. The report pages **don't pass `onCopyLink`**, so the COPY_LINK analytics event only fires via the unused `ReportShareMenu`. |
| Public access stats | 1061-1071 | NONE | — | Shown when count > 0, with last-accessed time. |
| Legacy email section | 1169-1258 | NONE | — | Only renders when `onShareViaEmail` is passed. Reports don't pass it, so it's **dead for reports**. |
| Footer | 1263-1275 | `share-close-btn`, `share-submit-btn` | `POST /api/access/report/{id}/grants` | SHARE is disabled with no chips. Label "SHARING…" while sending. |

**Dead or unused code in this flow:**
- `ReportShareMenu` (`components/reports/report-share-menu.tsx`, deleted in R0): testids `report-share-btn`, `share-via-link-item`, `share-via-email-item`. It is not imported anywhere and reuses the same `report-share-btn` testid as the viewer.
- `updateReportSharing` and `getReportSharingStatus` (`useReports.ts:95-115`, `PUT/GET /api/reports/{id}/share/`) are also unused.

## 6. Share via email (PDF attachment), `components/reports/share-via-email-dialog.tsx`

| Feature | Where | Existing data-testids | API | Notes |
|---|---|---|---|---|
| Dialog | 89-100 | `share-via-email-dialog` | — | Opened from the list row menu or the viewer button. Clicking outside does not close it. Opening resets the form, with the subject defaulting to "Report: {title}". |
| Subject | 110-122 | `share-email-subject` | — | Optional. Trimmed, and an empty value is sent as undefined. |
| Recipients | 125-142 | `share-email-input` | — | Split on `,` or `;`, trimmed, empty entries dropped. |
| Validation | 41-61 | — | — | Error toasts: "Please enter at least one email address", "Maximum 20 recipients allowed", "Invalid email(s): a, b" (checked against `EMAIL_REGEX`). |
| Send | 156-168 | `share-email-send-btn` | `POST /api/reports/{id}/share/email/` `{recipient_emails, subject}` | Disabled when the input is empty or sending. Label "Sending..." while sending. Success toast "Report sent to N recipient(s)", then closes. Failure toast "Failed to send report". `REPORT_SHARED` includes the recipient count only. The `message` field is never sent. |
| Cancel | 148-155 | `share-email-cancel-btn` | — | |

## 7. Report-mode dashboard canvas (shared with the public report)

| Feature | Where | Existing data-testids | API | Notes |
|---|---|---|---|---|
| Frozen chart render | `chart-element-view.tsx:488-522` | NONE | private: `POST /api/reports/{sid}/charts/{cid}/data/`; public: `POST {BACKEND}/api/v1/public/reports/{token}/charts/{cid}/data/` | Uses `frozenChartConfig`. The hover toolbar (download PNG/CSV, fullscreen) is **hidden** for frozen charts (1820). |
| Table chart | `useChart.ts:82-156`; `chart-element-view.tsx:589-619` | NONE | `/api/reports/{sid}/charts/{cid}/table-data/` and `/total-rows/`; public `.../public/reports/{t}/charts/{cid}/data-preview/` and `/total-rows/` | |
| Map chart | `useChart.ts:469-510`; `chart-element-view.tsx:923` | NONE | `/api/reports/{sid}/charts/{cid}/map-data/`; public `.../public/reports/{t}/charts/{cid}/map-data/` | |
| KPI | `useKPIs.ts:65-98`; `kpi-chart-element.tsx` | NONE | `/api/reports/{sid}/kpis/{id}/data/`; public `/api/v1/public/reports/{t}/kpis/{id}/data/` | Download and fullscreen are hidden when `snapshotId` is set. |
| "View Chart" / "View KPI" | `chart-element-view.tsx:1885-1897`; `dashboard-native-view.tsx:731-739, 793-800` | NONE (aria-label "View Chart") | — | Goes to `/charts/{id}?from=report` or `/kpis?open={id}&from=report`. The target page shows a "Back to Report" label (`lib/widget-navigation.ts:32`). Hidden in public, embed and print modes. |
| Filters in report mode | `dashboard-native-view.tsx:306-318`; `unified-filters-panel.tsx:353-401`; `filter-element.tsx:40-41,108` | whatever filter-panel testids already exist (not audited) | public filter preview `/api/v1/public/reports/{t}/filters/preview/?schema_name=&table_name=…` (`dashboard-filter-widgets.tsx:63,252`) | Default filter values are computed up front. The panel starts **collapsed** in report mode. **Clear all resets to defaults** (keeping the locked date) instead of emptying. Locked filters (`settings.locked`) have no action buttons and don't count toward the active-filter dot. Filter-applied analytics use context `REPORT`. |
| Tabs | `dashboard-native-view.tsx:1373-1405` | NONE | — | In report mode the tab bar sits **inside** the scroll area below the summary; on a dashboard it's sticky. |

## 8. Public report (`/share/report/[token]`)

| Feature | Where | Existing data-testids | API | Notes |
|---|---|---|---|---|
| Route + auth bypass | `page.tsx:1-43`; `client-layout.tsx:36-45` | — | `GET /api/v1/public/reports/{token}/view/` (`apiPublicGet`, `useReports.ts:138-154`) | No login required. A Suspense fallback shows "Loading report...". |
| Loading | `PublicReportView.tsx:61-71` | NONE | — | Spinner and "Loading report...". Renders nothing in print mode. |
| Invalid / expired | 73-99 | NONE | — | Shown on error **or** `!is_valid`. Card "Report Not Found" with a "Sign in to Dalgo" link (to /login) and "Learn about Dalgo" (dalgo.org, new tab). |
| Header | 162-192 | NONE | — | `OrgBrand` (logo or name), title, period ("All" when there's no start), "Public View", a "Read Only" badge, and the Powered-by-Dalgo image. |
| Summary | 201-212 | NONE | — | Only rendered when a summary exists. Read-only. Whitespace is preserved. |
| Canvas | 194-213 | — | public endpoints in §7 | `isReportMode` plus `isPublicMode`. No comments, share, download or edit controls. |
| Footer | 216 | NONE | — | `PoweredByDalgoFooter`. |
| Analytics | 42-59 | — | — | `PUBLIC_REPORT_VIEWED` once per token. Skipped in print mode and when invalid. |
| Print mode `?print=true` | `page.tsx:12`; `PublicReportView.tsx:104-156` | `data-pdf-ready="true"` attribute (not a testid; the backend exporter waits for it) | — | White background. Header shows created-by and dashboard title separated by `\|`, but no "Public View" badge. Summary only if present. Uses `PrintLayout` instead of the canvas. |
| `?dashboard_filters=<json>` | `page.tsx:14-23` | — | — | Only used in print mode. Malformed JSON is silently ignored. |

## 9. Public dashboard (`/share/dashboard/[token]`, `/public/dashboard/[token]`)

| Feature | Where | Existing data-testids | API | Notes |
|---|---|---|---|---|
| Fetch | `PublicDashboardView.tsx:72`; `usePublicDashboard` in `useDashboards` | — | public dashboard view endpoint (not opened here), plus chart endpoints `/api/v1/public/dashboards/{t}/charts/{cid}/`, `/data`, `/data-preview/`, `/total-rows/`, `/map-data/`, `/download-csv/`, KPI `/api/v1/public/dashboards/{t}/kpis/{id}/data/`, regions and geojsons | |
| Loading / not found | 102-137 | NONE | — | "Dashboard Not Found" card with the same links as the report version. |
| Error boundary | 39-66 | NONE | — | Shows a red box with the error message and stack. |
| Header (non-embed) | 157-190 | NONE | — | Title, "Public View", "Read Only", "Modified {relative time}" (only when the date is valid), and the description. |
| Embed mode `?embed=true` | `page.tsx:14-31`; view 145-229 | NONE | — | Options `title`, `org`, `padding` (default `true`) and `theme` (`light`/`dark`). Hides the main header. Title and org bar only show when enabled. Dark theme classes. Footer only in embed mode. |
| Analytics | 83-100 | — | — | `PUBLIC_DASHBOARD_VIEWED` includes `is_embed`. Requires `org_slug`. |
| Public chart toolbar | `chart-element-view.tsx:1820-1866` | NONE | CSV: `/api/v1/public/dashboards/{t}/charts/{cid}/download-csv/` | PNG, CSV (not offered for NUMBER charts) and fullscreen are **available** on public dashboards. |
| Legacy route `/public/dashboard/[token]` | `app/public/dashboard/[token]/page.tsx` | NONE | via `DashboardNativeView isPublicMode` | No header, no error card, no embed support. |

---

## 10. Pure utility functions (Jest characterization candidates)

| Function | Location | Already tested? | Behaviour to pin |
|---|---|---|---|
| `formatDateShort` | `components/reports/utils.ts:10` | yes (utils.test) | Format `MMM do, yyyy`. Depends on local timezone for date-only strings (`new Date('2026-03-31')` is UTC midnight). |
| `formatCreatedOn` | `utils.ts:21` | yes | Relative under 7 days, `d MMM` this year, otherwise `d MMM yyyy`. Future dates count as relative. |
| `formatCommentTime` | `utils.ts:49` | yes (comment-utils) | "just now", "N min(s). ago", "N hr(s). ago", days, weeks, then date-fns relative. |
| `getAvatarColor` | `utils.ts:93` | yes | Deterministic hash into 10 colours. |
| `getInitials` | `utils.ts:105` | yes | Uppercase first character, `?` fallback. |
| `parseCommentMentions` | `utils.ts:116` | yes | Splits into text and mention parts. The `@` is dropped from the mention value. |
| `extractMentionedEmails` | `utils.ts:143` | yes | Removes duplicates. |
| `EMAIL_REGEX`, `MAX_RECIPIENTS=20` | `utils.ts:4-5` | partial | |
| `groupLayoutByRows` | `components/reports/print-layout.tsx:37` | **no** (not exported) | Drops `filter` components and missing ids. Groups by `y`, sorts by `x` within a row and rows by `y`. Also pin the height floors (chart ≥300 px, text ≥60 px, 20 px per row). |
| Recipient parsing and validation | inline in `share-via-email-dialog.tsx:41-61` | via component only | Worth extracting to a `parseRecipients` helper. |
| List sort comparator | inline in `app/reports/page.tsx:200-232` | via page test | Worth extracting. Handles null dates as 0 and lowercases strings. |
| Pagination math | inline in `page.tsx:235-238, 690-692` | via page | Minimum 1 page, "0–0 of 0" label. |
| `handleSort` toggle rule | inline `page.tsx:161-171` | via page | A new column starts at desc. |
| Filter param builder | inline `page.tsx:113-120`; `useReports.ts:37-41` | no | |
| Date-column auto-select rule | inline `create-snapshot-dialog.tsx:119-127` | via dialog test | Dashboard-filter column first, then the only column. |
| `startMaxDate` rule | inline `create-snapshot-dialog.tsx:188` | no | |
| Snapshot payload builder | inline `create-snapshot-dialog.tsx:151-163` | via dialog | Splits `schema.table.column` on `.`, so a schema or table name containing a dot would break it. |
| Edited-threshold check | inline `comment-popover.tsx:346-348` | no | More than 1000 ms. |
| `visibleComments` filter | inline `comment-popover.tsx:548-554` | partial | |
| Mention filter (5 results, case-insensitive) | inline `comment-popover.tsx:219-225, 527-533` | no | Duplicated in two places. |
| `AT_MENTION_PATTERN` / mention insertion | `hooks/useMentionInput.ts:5, 45-78` | ? | Inserts `@email ` at the cursor. |
| PDF filename sanitizer | inline `hooks/usePdfDownload.ts:35-44` | ? | |
| Comment-state lookups | inline in the viewer (290), `chart-element-view.tsx:1905`, `kpi-chart-element.tsx:88` | the lookup test mirrors, not imports | The `chart_id` bug from §4. |
| Widget navigation helpers | `lib/widget-navigation.ts` (all exported) | ? | `parseWidgetNavigationSource`, `getChartViewUrl`, `getKpiViewUrl`, `getWidgetBackLabel`. |
| `dashboard_filters` query parse | inline `app/share/report/[token]/page.tsx:15-23` | no | |
| Public dashboard embed option parsing | inline `app/share/dashboard/[token]/page.tsx:14-28` | no | |

## 11. Interactive elements with no data-testid

**Reports list (`app/reports/page.tsx`):**
- Sort buttons: Title (394), Dashboard Used (448), Created by (502), Created on (555).
- Filter popover triggers (411, 465, 519) and their "Clear" buttons (423, 477, 531).
- "Clear all" filters (292).
- Page-size select (707) and its options; Prev (724); Next (738).
- Page counter text (734) and item-count text (689-693).
- Empty-state and no-match text (373, 577).
- Delete confirmation dialog buttons (`components/ui/confirmation-dialog.tsx:92,100`).

**Create dialog:**
- Dashboard Combobox. It has testids, but they come from `useId` and change between renders, so a stable `id` prop is needed.
- Date column `SelectItem`s (292).
- Start and end DatePicker triggers and the OK/Cancel/Clear buttons (`components/ui/date-picker.tsx:77,95,174,181`).
- Validation error messages (230, 252, 302, 345).
- "No datetime columns" hint (263).

**Viewer:**
- Period, created-by and last-modified-by text (177-189, 319-324).
- Loading skeleton.
- Request Access dialog: level select, note textarea, Cancel, Send (`request-access-dialog.tsx:72-101`).

**Comments:**
- The deleted placeholder text itself has none (only its container does).
- The "edited" label (349).

**ShareModal:**
- Staged chip level select and remove (737, 749).
- Row level select and remove for people with access (888, 949).
- "Transfer ownership" option.
- Transfer dialog Cancel/Transfer (1126, 1129).
- Takeover Cancel (1153).
- Cascade dialog CANCEL/CONTINUE (1103, 1106).
- General-access options.
- Public access stats text.

**Frozen charts:**
- The "View Chart" button inside the title row (`chart-element-view.tsx:1887`).
- KPI view button.

**Public report and public dashboard views:**
- Neither has any testids: loading, not-found card, the "Sign in to Dalgo" and "Learn about Dalgo" links, header, "Read Only" badge, summary block, footer.
- Embed title and org bar.
- Public chart toolbar (download PNG/CSV, fullscreen).

**App shell:**
- The "Reports" item in `components/main-layout.tsx:132`, if the nav doesn't add testids generically.

## 12. Permission and conditional UI matrix

| UI | Condition |
|---|---|
| Create Report (header and empty state) | RBAC `CAN_CREATE_DASHBOARDS` |
| Row share icon, row "Email PDF" | `snapshot.access_level==='edit'` |
| Row "Delete" | `CAN_DELETE_DASHBOARDS` **and** `access_level==='edit'` |
| Viewer Share, Email PDF, Edit summary, summary comment trigger | `viewData.access_level==='edit'` |
| Viewer Download PDF, chart/KPI comment triggers | everyone who can open the report |
| Request Edit pill | `access_level==='view'` |
| Comment Edit | author only |
| Comment Delete | author, or report Edit (moderator) |
| ShareModal general access section | hidden when `caller_access_via_floor` |
| Public option | `supports_public`; disabled unless `allow_public_sharing`; restricted by parent dashboards |
| Invite role select | admin only |
| Transfer ownership | owner or admin, on a user row with Edit |
| Reports nav item | `REPORTS` feature flag |

## 13. Suggested Playwright data setup notes

- You'll need a user with edit access, a view-only user, and a user without `CAN_DELETE_DASHBOARDS`. You'll also need one native dashboard with a datetime column and one without.
- Public report tests need the report set to Public first, then the token taken from `public_url`.
- PDF export and email go through a backend Playwright renderer. Mock or intercept `POST /api/reports/{id}/export/pdf/` and `/share/email/` unless you run the full stack.
- `data-pdf-ready="true"` on `/share/report/{token}?print=true` is a usable readiness hook.