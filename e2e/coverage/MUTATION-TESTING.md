# Mutation testing — does the suite catch real regressions?

**Result: 34 / 34 planted bugs caught, each by a directly relevant test** (2026-09-29).

## Method
- 34 realistic "refactor slips" (1–5 line changes) designed **blind** — from app code and feature inventories only, without reading any test.
- One at a time: apply → production build → targeted specs → (if not caught) whole area folder → revert. App code verified unchanged (`git status`) after every drill.
- A catch counts only if the failing test is **related** to the bug and passes on clean code. Catches by unrelated tests (load noise) or infra failures (staging 5xx, setup) were re-run against the specs that *should* catch them.

## Gaps the drill found → new tests
| Mutation | First result | New test |
|---|---|---|
| M01 sort dropped from the **save** payload | caught only incidentally (per-option tests assert the preview request) | `charts/save-persistence.spec.ts` SAVE-1 / SAVE-2 — every data option reaches the saved chart; edit keeps them |
| M17 new widget lands at the **top** | **missed** (add-widget tests started from an empty canvas) | `dashboards/widget-placement.spec.ts` D-B5b |
| M18 deleting the active tab selects the **next** tab | **missed** | `dashboards/sequential-actions.spec.ts` D-T1b |
| M20 a **second** filter Apply is a no-op | **missed** | `dashboards/sequential-actions.spec.ts` D-F5b |

## All mutations
| id | area | bug | caught by |
|---|---|---|---|
| M01 | charts | sort dropped from create POST | save-persistence › SAVE-1 |
| M02 | charts | time_grain missing from preview deps | builder-shared › time grain › grain year |
| M03 | charts | wrong route after create | builder-bar (save helper expects detail URL) |
| M04 | charts | isFormValid drops the dimension check | perm-chains (pinned "Save disabled") |
| M05 | charts | edit drops filters from PUT | edit › C-E2 update existing |
| M06 | charts | edit type switch loses showDataLabels | type-switch-matrix-edit › bar → line |
| M07 | charts | switch to pie keeps all metrics | type-switch › bar → pie keeps first metric |
| M08 | charts | sort direction no-op | builder-shared › sort › by metric descending |
| M09 | charts | metric limit off-by-one | builder-number › one metric |
| M10 | charts | prefill picks last text column | builder-map › prefill-dependent test |
| M11 | charts | pivot column grand total sends row flag | builder-pivot › row grand total |
| M12 | charts | Save As New ignores typed name | edit › C-E3 save as new |
| M13 | charts | duplicate doesn't refresh list | list › C-L8 duplicate |
| M14 | dashboards | drag layout not committed | builder › D-B10 drag |
| M15 | dashboards | tab rename commits old title | tabs › D-T1 |
| M16 | dashboards | description dropped from PUT | builder-text (PUT snapshot) |
| M17 | dashboards | new widget lands at y=0 | widget-placement › D-B5b |
| M18 | dashboards | delete tab selects next | sequential-actions › D-T1b |
| M19 | dashboards | undo reverts two steps | gaps-builder › undo history |
| M20 | dashboards | second Apply is a no-op | sequential-actions › D-F5b |
| M21 | dashboards | Clear all leaves charts filtered | filters › D-F6 |
| M22 | dashboards | Edit Dashboard wrong route | gaps-view › responsive actions |
| M23 | dashboards | list delete row stays | list › D-L5 (isolated) |
| M24 | reports | summary save sends stale draft | gaps-create-viewer › summary save |
| M25 | reports | @mention dropdown not opening at start | comments › R-M3 |
| M26 | reports | delete comment uses wrong id | comments › R-M1 |
| M27 | reports | period_start = end date | create › R-C1 |
| M28 | reports | recipients split only on commas | viewer › R-V5 |
| M29 | reports | new sort column starts asc | list › R-L3 |
| M30 | reports | View Chart from report says "Back to Dashboard" | cross › X-2 |
| M31 | charts | only 1st metric saved | metrics-matrix-a › MM-bar-4 |
| M32 | charts | filter value saved empty | builder-shared › operator equals |
| M33 | dashboards | resize not persisted | builder › D-B10 resize |
| M34 | dashboards | uploaded image URL not stored | builder-text › D-B8 upload |

Runner + catalog: `e2e/scripts/mutation/mutate.py` + `mutations.json`. Re-run after the refactor (stop other runs first; it rebuilds and restarts the :3000 server):
`python3 e2e/scripts/mutation/mutate.py M01 M02 …` (add `TARGETED_ONLY=1` to skip the whole-area fallback).
`TARGETED` lists the catching spec for every mutation (R6c); the whole-area fallback still runs on a miss.

## Re-run after the refactor (R6c)

**34/34 caught** — re-run 2026-10-05 on the refactored tip 733f8a37 (production build, :3000).

| Mutation | Result | Caught by |
|---|---|---|
| M01 | caught | [chromium] › e2e/charts/save-persistence.spec.ts:30:7 › chart save persistence › SAVE-1 bar: X, extra dimension, 2 metrics, sort, pagination, filter all reach the saved chart; edit keeps them  |
| M02 | caught | [chromium] › e2e/charts/builder-shared.spec.ts:235:11 › Data config (bar vehicle) › time grain › grain year  |
| M03 | caught | [chromium] › e2e/charts/builder-bar.spec.ts:163:9 › bar styling › bar: orientation vertical after horizontal  |
| M04 | caught | [chromium] › e2e/charts/perm-chains.spec.ts:59:11 › PERM-chains-create › [pinned] PERM-chains-create pivot → line → number → pivot — ends with Save disabled  |
| M05 | caught | [chromium] › e2e/charts/edit.spec.ts:130:7 › charts edit › C-E2 Save → Update existing sends PUT and lands on detail  |
| M06 | caught | [chromium] › e2e/charts/type-switch-matrix-edit.spec.ts:460:11 › TS-edit from bar › TS-edit bar → line [pinned] update rejected 422: previous dataLabelPosition kept  |
| M07 | caught | [chromium] › e2e/charts/type-switch.spec.ts:59:7 › type switch keep/trim rules › bar → pie keeps only the first metric; label position inside stays (valid for pie)  |
| M08 | caught | [chromium] › e2e/charts/builder-shared.spec.ts:485:9 › Data config (bar vehicle) › sort › by metric descending  |
| M09 | caught | [chromium] › e2e/charts/builder-number.spec.ts:101:7 › number styling › number: data config — one metric, no X axis / extra dimension / pagination / sort / display name  |
| M10 | caught | [chromium] › e2e/charts/builder-shared.spec.ts:68:11 › C-B create-flow basics › bar › C-B3 bar: create via picker → save payload → lands on detail  |
| M11 | caught | [chromium] › e2e/charts/builder-pivot.spec.ts:254:7 › builder pivot — totals › pivot row grand total (right column) + custom label  |
| M12 | caught | [chromium] › e2e/charts/edit.spec.ts:130:7 › charts edit › C-E2 Save → Update existing sends PUT and lands on detail  |
| M13 | caught | [chromium] › e2e/charts/list.spec.ts:426:7 › charts list › C-L8 duplicate → "Copy of X", again → "Copy of X (2)", copy of copy → "(3)"  |
| M14 | caught | [chromium] › e2e/dashboards/builder.spec.ts:347:9 › dashboard builder › D-B10 drag and resize › drag by the top strip moves the widget; neighbour compacts up  |
| M15 | caught | [chromium] › e2e/dashboards/tabs.spec.ts:48:7 › dashboard tabs › D-T1 add, switch, rename (Enter / Esc / blur / 50 chars) and remove with dialog  |
| M16 | caught | [chromium] › e2e/dashboards/builder-text.spec.ts:136:9 › dashboard builder — text widget › D-B7 rich text › bold, italic, underline and alignment  |
| M17 | caught | [chromium] › e2e/dashboards/widget-placement.spec.ts:33:7 › dashboard builder — placement of new widgets › D-B5b new chart, KPI and text land below existing widgets; existing ones stay put  |
| M18 | caught | [chromium] › e2e/dashboards/sequential-actions.spec.ts:31:7 › dashboard — second actions › D-T1b deleting the active MIDDLE tab selects the previous tab; others keep their order  |
| M19 | caught | [chromium] › e2e/dashboards/gaps-builder.spec.ts:145:7 › dashboard builder gaps › GAP-D undo history keeps 20 steps  |
| M20 | caught | [chromium] › e2e/dashboards/sequential-actions.spec.ts:66:7 › dashboard — second actions › D-F5b a SECOND Apply with a changed value refetches charts with the new value  |
| M21 | caught | [chromium] › e2e/dashboards/filters.spec.ts:479:7 › dashboard filters — apply / clear (view) › D-F6 clear one filter (local only), clear all refetches unfiltered, applied dot  |
| M22 | caught | [chromium] › e2e/dashboards/gaps-view.spec.ts:201:7 › GAP-D view responsive actions › GAP-D tablet (<1200px) actions menu: Share Dashboard and Edit Dashboard  |
| M23 | caught | [isolated] › e2e/dashboards/list.spec.ts:292:7 › dashboard list › D-L5 row menu: delete asks for confirmation; Cancel keeps, Delete removes  |
| M24 | caught | [chromium] › e2e/reports/gaps-create-viewer.spec.ts:335:7 › report viewer — gaps › GAP-R viewer summary save failure keeps edit mode with a toast  |
| M25 | caught | [chromium] › e2e/reports/comments.spec.ts:202:7 › report comments › [pinned] R-M3 @mention dropdown: max 5, filter, arrows wrap, Enter/click insert, Esc closes  |
| M26 | caught | [chromium] › e2e/reports/comments.spec.ts:52:7 › report comments › R-M1 summary thread: add (POST), edit (PUT) shows "edited", delete  |
| M27 | caught | [chromium] › e2e/reports/create.spec.ts:29:7 › create report › R-C1 dashboard with a date column: auto-selects it, end date required, POST payload  |
| M28 | caught | [chromium] › e2e/reports/viewer.spec.ts:285:7 › report viewer › R-V5 Email PDF dialog: validation + send (intercepted)  |
| M29 | caught | [chromium] › e2e/reports/list.spec.ts:102:7 › reports list › R-L3 sort toggles per column (new column starts desc) and pagination  |
| M30 | caught | [chromium] › e2e/cross/navigation.spec.ts:48:7 › cross-area navigation › X-2 report → View KPI → "Back to Report"  |
| M31 | caught | [chromium] › e2e/charts/metrics-matrix-a.spec.ts:157:11 › metrics matrix bar › MM-bar-4 two metrics (simple+calculated)  |
| M32 | caught | [chromium] › e2e/charts/builder-shared.spec.ts:313:11 › Data config (bar vehicle) › filters › operator equals (text value input)  |
| M33 | caught | [chromium] › e2e/dashboards/builder.spec.ts:381:9 › dashboard builder › D-B10 drag and resize › resize grows the widget and clamps at the per-type minimum  |
| M34 | caught | [chromium] › e2e/dashboards/builder-text.spec.ts:241:9 › dashboard builder — text widget › D-B8 image › upload: wrong type and >5MB rejected client-side, valid PNG uploads  |

M02, M04, M17, M29 and M31 now point at code shared by more screens than before (see each mutation's `r6_note` in mutations.json); each was still caught.
