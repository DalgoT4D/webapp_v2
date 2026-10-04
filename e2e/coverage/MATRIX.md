# E2E Coverage Matrix — Charts · Dashboards · Reports

Pre-refactor guard suite. Goal: every user-facing behavior pinned **as it is today** (bugs included), so the refactor can be verified row by row.

Detailed per-area inventories (file:line, testids, endpoints): [charts.md](charts.md) · [dashboards.md](dashboards.md) · [reports.md](reports.md) · Test data: [staging-data.md](staging-data.md)

**Priority:** P0 = core flow, must exist before refactor starts · P1 = every option/variant · P2 = edge/error states, nice-to-have
**Assert type:** `UI` = visible behavior · `PAY` = request payload snapshot · `SHOT` = screenshot baseline · `NAV` = URL/navigation

---

## 0. Harness (build first)

| Piece | Design |
|---|---|
| Project | `staging-chromium` only, viewport 1440×900 (above every breakpoint: 1024/1200/1280), `reducedMotion: 'reduce'`, trace `retain-on-failure` |
| Auth | `global-setup.ts` logs in once → `storageState`; all specs reuse |
| API client fixture | `api` = Playwright `request` with same cookies + `x-dalgo-org` — for fast setup/teardown (create chart/dashboard without UI when the test isn't *about* creation) |
| Naming | every created object `e2e-<runId>-<slug>`; `runId` per worker run |
| Cleanup | per-test fixture tracks created ids → deletes in teardown; `global-teardown.ts` sweeps any `e2e-*` left (charts, dashboards, KPIs, metrics, reports) |
| Payload capture | `capture(page, method, urlGlob)` → returns parsed body; `expectPayload(body).toMatchSnapshot('x.json')` after normalizing ids/timestamps/runId. **Main refactor guard.** |
| Screenshot | `expectChart(locator)` → waits for data response + ECharts `finished`, masks timestamps, `toHaveScreenshot({ maxDiffPixelRatio: 0.01 })` |
| Selectors | testid first → role/label → never CSS classes. Missing testids added in a prep PR (see §7) |
| Parallelism | `fullyParallel`, 4 workers; tests never share mutable objects; seed objects read-only |

---

## 1. Charts

### 1.1 List page — `charts/list.spec.ts`
| # | Case | Pri | Assert |
|---|---|---|---|
| C-L1 | Loads, shows seeded charts, counter "x–y of N" | P0 | UI |
| C-L2 | Sort each column (Name/Source/Type/Modified), toggle asc↔desc, new column starts desc | P1 | UI |
| C-L3 | Filter: name text, favorites only, data source multi, chart type multi, date modified (today/week/month/custom) | P1 | UI |
| C-L4 | Filter active dot, "N filter(s) active", per-popover Clear, Clear all | P1 | UI |
| C-L5 | Filters act on current page only (pin current behavior) | P2 | UI |
| C-L6 | Favorite toggle on/off persists after reload | P1 | UI+PAY |
| C-L7 | Row → title link opens detail; edit icon opens edit | P0 | NAV |
| C-L8 | Duplicate → "Copy of X", again → "Copy of X (2)" | P1 | UI+PAY |
| C-L9 | Delete single: dialog lists using dashboards / "not used" message, confirm deletes | P0 | UI+PAY |
| C-L10 | Selection mode: select, select all, deselect all, bulk delete 1 vs many (confirm text differs), exit | P1 | UI+PAY |
| C-L11 | Pagination: page size 10/20/50/100, next/prev, clamp after delete | P1 | UI |
| C-L12 | Export submenu per type (bar/line/pie/number: PNG+PDF · map: PNG+PDF · table/pivot: CSV) → download event | P1 | UI(download) |
| C-L13 | Share icon opens ShareModal (rtype chart) | P1 | UI |
| C-L14 | Empty state "No charts found" with filters active | P2 | UI |

### 1.2 Create step 1 — `charts/create-pick.spec.ts`
| # | Case | Pri | Assert |
|---|---|---|---|
| C-P1 | Dataset picker search + select; 7 type cards; Continue disabled until both | P0 | UI |
| C-P2 | Keyboard Enter/Space selects card | P2 | UI |
| C-P3 | Back / Cancel → /charts; with `?from=dashboard` → history back | P1 | NAV |

### 1.3 Builder per chart type — `charts/builder-<type>.spec.ts` (×7)
For **each** type: create → configure → preview renders → save → detail page renders → reopen edit → update → save.

| # | Case | Pri | Assert |
|---|---|---|---|
| C-B1 | Default title pattern, auto-prefill from columns | P0 | UI+PAY |
| C-B2 | Save disabled until valid (per-type `isFormValid` rule) | P0 | UI |
| C-B3 | Create save → `POST /api/charts/` payload snapshot → lands on detail | P0 | PAY+NAV |
| C-B4 | Preview screenshot after default config | P0 | SHOT |
| C-B5 | Data tab: Chart Data / Raw Data tables, pagination | P1 | UI |
| C-B6 | Unsaved-changes guard on Back: Save&Leave / Leave / Stay | P1 | UI+NAV |

**Data config (bar/line/pie, shared):** X axis · time grain (each option, hour/min/sec disabled on date col) · extra dimension · filters (each operator: equals…is_not_null; value input variants: combobox / multi / text / date picker / none) · pagination (none/20/50/100/200) · sort (dimension, metric, asc/desc, auto-clear) → one test per control, `PAY` on chart-data request. **P1**

**Metrics:** add/remove, Simple (each agg fn, numeric-only columns for non-count) · Calculated (valid expr, invalid → error msg) · Saved (pick from library, used ones hidden) · display name auto vs manual · Add to library. **P0 for Simple, P1 rest**

**Styling per type (P1, SHOT + PAY each):**
- Bar: vertical/horizontal · stacked (with extra dim) · tooltip · legend on/off, paginated/all, 4 positions · data labels + 3 positions · axis titles · x rotation 0/45/90 · number format + decimals · date format
- Line: smooth/straight · data points · legend · labels 4 positions · axes
- Pie: donut/full · slice limit all/3/5/10 → "Other" · label format ×4 · inside/outside · number/date format
- Number: size s/m/l · subtitle · prefix/suffix · number format
- Map: state column → geojson auto · district drill level · color scheme ×6 · tooltip/legend · no-data label · legend corner ×4 · region names · zoom ± · drill-down click + breadcrumb Home/Back · Download states/districts CSV
- Table: multi dims + reorder · remove · drill-down toggle + click cell + "← Back" · freeze column · column alignment · number/date format per col · conditional formatting (numeric + text ops, colors, last-wins) · theme gray/blue · zebra · search + clear · URL "Link" cells · pagination
- Pivot: row/col dims add/remove · subtotals (need 2+ dims) · grand totals + custom labels · per-metric format · date format · cond. formatting · freeze · theme/zebra

**Type switch (P1):** bar→line→pie→number→table→map keeps/trims fields per rules (pie/number/map keep first metric only).

### 1.4 Edit flow — `charts/edit.spec.ts`
| # | Case | Pri | Assert |
|---|---|---|---|
| C-E1 | Load existing (per type) → form shows saved config | P0 | UI |
| C-E2 | Save → dialog: Update existing (`PUT` payload) | P0 | PAY |
| C-E3 | Save → Save as new (name step, blank disabled) → new id | P1 | PAY+NAV |
| C-E4 | Cancel with/without changes; Back with changes → confirm | P1 | UI+NAV |
| C-E5 | Invalid config overlay + last-good preview kept | P2 | UI |
| C-E6 | `?from=dashboard` / `?from=report` back labels and return | P1 | NAV |
| C-E7 | Create-vs-edit differences pinned (default agg count vs sum, page size 20 vs 25, legend defaults) | P1 | PAY |

### 1.5 Detail page — `charts/detail.spec.ts`
| # | Case | Pri | Assert |
|---|---|---|---|
| C-D1 | Each seeded type renders (bar/line/pie/map/table/pivot + created number) | P0 | SHOT |
| C-D2 | Edit link, Share (`?openShare=true` auto-opens) | P1 | UI+NAV |
| C-D3 | Export PNG / PDF / CSV per type; table drill → "Export current view" | P1 | download |
| C-D4 | Map drill-down toasts; table drill-down | P1 | UI |
| C-D5 | Back variants (plain / from dashboard / from report) | P1 | NAV |

### 1.6 Metrics × chart type — `charts/metrics-matrix-{a,b}.spec.ts`
User requirement: **metric types and number of metrics tested for every chart type.** Each case asserts data-request PAY, preview SHOT, save PAY, edit-reopen (row count + tab + alias), detail SHOT.

| Chart type | simple | calculated | saved | 2 metrics | 3 mixed | remove middle | max-1 rule |
|---|---|---|---|---|---|---|---|
| bar | MM-bar-1 | MM-bar-2 | MM-bar-3 | MM-bar-4 | MM-bar-5 | MM-bar-6 | — |
| line | MM-line-1 | MM-line-2 | MM-line-3 | MM-line-4 | MM-line-5 | MM-line-6 | — |
| table | MM-table-1 | MM-table-2 | MM-table-3 | MM-table-4 | MM-table-5 | MM-table-6 | — |
| pivot | MM-pivot-1 | MM-pivot-2 | MM-pivot-3 | MM-pivot-4 | MM-pivot-5 | MM-pivot-6 | — |
| pie | MM-pie-1 | MM-pie-2 | MM-pie-3 | — | — | — | MM-pie-4 |
| number | MM-number-1 | MM-number-2 | MM-number-3 | — | — | — | MM-number-4 |
| map | MM-map-1 | MM-map-2 | MM-map-3 | — | — | — | MM-map-4 |

Plus: pie with extra dimension · table 3-level drill chain (statename → districtname → climate_event).

---

## 2. Dashboards

### 2.1 List — `dashboards/list.spec.ts`
| # | Case | Pri |
|---|---|---|
| D-L1 | Loads, pinned rows first, "My Landing"/"Org Default" badges | P0 |
| D-L2 | Sort Name/Owner/Modified | P1 |
| D-L3 | Filters: name + favorites/locked/shared · owner · date modified · Clear all | P1 |
| D-L4 | Favorite toggle | P1 |
| D-L5 | Row menu: set/remove my landing (on an e2e dashboard, restore after) · duplicate · delete w/ confirm | P0 |
| D-L6 | Pagination | P1 |
| D-L7 | Lock badge "By You" while editor open in other page | P2 |

### 2.2 Create + builder — `dashboards/builder-*.spec.ts`
| # | Case | Pri | Assert |
|---|---|---|---|
| D-B1 | `/dashboards/create` → auto POST → `/edit?new=true`, title in edit mode | P0 | PAY+NAV |
| D-B2 | Title edit (Enter/blur, empty → "Untitled Dashboard"), description (100 char counter, Cmd+Enter, Esc reverts) | P0 | PAY |
| D-B3 | Explicit Save payload snapshot; save status "Saving… → Saved" | P0 | PAY |
| D-B4 | Autosave fires ~5s after change (and on mount — pin) | P1 | PAY |
| D-B5 | Add Chart modal: search, "Already added" disabled, insert → cell renders | P0 | UI+SHOT |
| D-B6 | Add KPI modal same | P0 | UI |
| D-B7 | Add Text → rich text: paragraph/H1-3, font size, B/I/U, align, text color, bg color, custom hex | P1 | PAY |
| D-B8 | Text image: upload (valid/invalid type/>5MB), link, replace, remove, fit fill/fit/stretch, caption + align | P1 | PAY |
| D-B9 | Cell toolbar: View/Edit/Remove for chart, KPI, text; remove compacts layout | P0 | PAY |
| D-B10 | Drag to move (only top strip), resize (min size per type) → layout in payload | P1 | PAY |
| D-B11 | Chart title override: edit, Esc cancel, hide/show, reset to original | P1 | PAY |
| D-B12 | Undo/Redo buttons + Cmd+Z / Cmd+Shift+Z / Ctrl+Y, ignored inside inputs | P1 | UI |
| D-B13 | View button → save + unlock → view page | P0 | NAV+PAY |
| D-B14 | Lock: POST lock on open, DELETE on leave; second page sees "Currently Locked" screen + countdown | P1 | UI+PAY |
| D-B15 | Table/map/pivot cells in builder: drill-down, breadcrumb | P2 | UI |

### 2.3 Tabs — `dashboards/tabs.spec.ts`
| # | Case | Pri |
|---|---|---|
| D-T1 | Add tab ("Untitled Tab N"), switch, rename (Enter/blur/Esc, 50 char), remove (dialog), hidden when 1 tab | P0 |
| D-T2 | Reorder by drag + Alt+←/→ | P1 |
| D-T3 | Cross-tab widget move (hover tab 500ms → drop) and cancel paths (Esc, early release) | P1 |
| D-T4 | Undo restores deleted tab (pin) | P2 |
| D-T5 | View mode: tab bar only with ≥2 tabs | P1 |

### 2.4 Filters — `dashboards/filters.spec.ts`
| # | Case | Pri | Assert |
|---|---|---|---|
| D-F1 | Create value filter (single, multi) via modal: dataset → column → auto type + auto name → preview tab | P0 | PAY |
| D-F2 | Create numerical (slider, input) filter; pin forced default 0–100 | P1 | PAY |
| D-F3 | Create datetime filter; start/end cross-limits; summary text | P1 | PAY |
| D-F4 | Edit filter (dataset disabled), delete (no confirm), reorder drag | P1 | PAY |
| D-F5 | Apply → every chart refetches with `dashboard_filters` JSON (snapshot), KPI too | P0 | PAY+SHOT |
| D-F6 | Clear one, Clear all, applied dot | P1 | UI |
| D-F7 | Filter only applies to charts with matching schema/table | P1 | PAY |
| D-F8 | Builder: KPIs ignore filters (pin) | P2 | PAY |

### 2.5 View mode — `dashboards/view.spec.ts`
| # | Case | Pri |
|---|---|---|
| D-V1 | Seeded 411/412 render: header, badges, all cells | P0 (SHOT) |
| D-V2 | Charts not filtered until Apply | P1 |
| D-V3 | Chart toolbar: View Chart nav, Download PNG, Export CSV (not for number), fullscreen overlay | P1 |
| D-V4 | KPI card: download, fullscreen, view | P1 |
| D-V5 | Dashboard fullscreen (Esc exits) | P2 |
| D-V6 | Landing dropdown: set/remove my landing (restore) | P1 |
| D-V7 | Edit Dashboard → /edit; share button → modal | P0 |
| D-V8 | Embed code: toggles/theme/size → snippet string snapshot, copy | P1 |
| D-V9 | Empty dashboard "No Dashboard Components" | P2 |

### 2.6 Share + public — `dashboards/share-public.spec.ts`
| # | Case | Pri |
|---|---|---|
| D-S1 | ShareModal: general access Default/Private/Public (on e2e dashboard), copy public link | P0 |
| D-S2 | Public `/share/dashboard/<token>` loads logged-out: header, Read Only, charts, filters, CSV download | P0 |
| D-S3 | Embed mode `?embed=true&title&org&theme=dark&padding` | P1 |
| D-S4 | Invalid token → "Dashboard Not Found" | P1 |
| D-S5 | Legacy `/public/dashboard/<token>` stuck loading (pin bug) | P2 |
| D-S6 | People grant add/remove (needs 2nd user — see §6) | P2 |

---

## 3. Reports

### 3.1 List — `reports/list.spec.ts`
| # | Case | Pri |
|---|---|---|
| R-L1 | Loads seeded 150/151, row click → viewer | P0 |
| R-L2 | Filters title/dashboard/creator (debounced 400ms, server params) + Clear all | P1 (PAY) |
| R-L3 | Sort 4 columns, pagination | P1 |
| R-L4 | Row menu: view, email PDF, delete (e2e report only) | P0 |

### 3.2 Create — `reports/create.spec.ts`
| # | Case | Pri |
|---|---|---|
| R-C1 | Dashboard with date column: auto-selects column, end date required, POST payload snapshot | P0 |
| R-C2 | Dashboard without date column: hint shown, dates skipped | P1 |
| R-C3 | Validation messages; Cancel does not reset form (pin) | P1 |

### 3.3 Viewer — `reports/viewer.spec.ts`
| # | Case | Pri |
|---|---|---|
| R-V1 | Header metadata, dashboard link, frozen charts render (no toolbar) | P0 (SHOT) |
| R-V2 | Summary edit / save (PUT) / cancel / no-op when unchanged | P0 |
| R-V3 | Filters panel collapsed; Clear all resets to defaults, locked date filter | P1 |
| R-V4 | Download PDF (payload includes current filters) | P1 |
| R-V5 | Email PDF dialog: validation (empty, >20, invalid) + send (intercept to avoid real email) | P1 |
| R-V6 | View Chart → `?from=report` → "Back to Report" | P1 |
| R-V7 | Invalid id / not found states | P2 |

### 3.4 Comments — `reports/comments.spec.ts`
| # | Case | Pri |
|---|---|---|
| R-M1 | Summary thread: add, edit, delete, "edited" label | P0 |
| R-M2 | Chart + KPI thread; icon state (pin chart-icon bug) | P1 |
| R-M3 | @mention dropdown: filter, arrows, Enter, Esc, max 5 | P1 |
| R-M4 | Deep link `?commentTarget=summary` / `chart&chartId=` auto-opens | P1 |

### 3.5 Share + public — `reports/share-public.spec.ts`
| # | Case | Pri |
|---|---|---|
| R-S1 | Make e2e report public → copy link → `/share/report/<token>` logged-out renders | P0 |
| R-S2 | Print mode `?print=true` → `data-pdf-ready` | P1 |
| R-S3 | Invalid token → "Report Not Found" | P1 |

---

## 4. Cross-cutting — `cross/navigation.spec.ts`
| # | Case | Pri |
|---|---|---|
| X-1 | Dashboard → View Chart → Back to Dashboard; → Edit Chart → save → returns | P0 |
| X-2 | Report → View Chart/KPI → Back to Report | P1 |
| X-3 | Delete chart used in dashboard → dialog lists dashboard → dashboard cell behavior after | P1 |
| X-4 | Chart edited → dashboard shows updated chart | P1 |

---

## 5. Jest characterization (pure logic, parallel track)
Untested + high refactor risk. Pin via input→output snapshots **before** refactor:
- Charts: `getDefaultCustomizations` ×2, `isFormValid` ×2, payload builders (configure + edit), `convertLayersToSimplified`/`convertSimplifiedToLayers`, chart-type-switch mapping, `chart-legend-utils.ts`, `transformMapDataOverlayPayload`, pivot utils (CSV, row spans, prune), `form-utils.deepEqual`/`generateDuplicateTitle`, table drill reducers
- Dashboards: `dashboard-filter-utils` (resolve/format/defaults), `convertFilterToConfig` ×3, `useUndoRedo`, `generateEmbedCode`, filter modal type-detect + settings builder
- Reports: `groupLayoutByRows`, recipient parsing, snapshot payload builder, PDF filename sanitizer

(Many inline → minimal extract-to-export needed; no behavior change.)

---

## 6. Known gaps / needs
- **2nd user (view-only) + 3rd (no delete perms)** needed for: request-edit pill, access-denied screens, permission-gated buttons, comment moderation, lock-by-other. Without them these rows stay manual.
- **Email / PDF** go through real backend services → intercept with `page.route` (assert payload, return 200) to avoid sending mails from staging.
- Seed data can change → screenshots baseline against **e2e-created** charts on stable `production.mart_*` tables where possible.

## 7. Prep PR — missing testids (attribute-only, no behavior change)
Needed before writing tests. Touches shared `components/ui/` → **needs approval**:
- `combobox.tsx`: callers pass stable `id` (dataset, x-axis, filter column/value, sort, table dims, map cols, dashboard filter widgets, report dashboard picker)
- `confirmation-dialog.tsx`, `date-picker.tsx`: confirm/cancel/OK/clear testids
- Feature components: list sort/filter triggers, row kebabs + items, favorite stars, builder undo/redo/add-text, cell toolbar buttons, filter panel Apply/Clear/Add, chart export items, SaveOptionsDialog, UnsavedChangesExitDialog, type cards, styling controls, public view headers
