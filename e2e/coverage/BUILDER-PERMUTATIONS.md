# Chart builder permutations — current behavior (pre-refactor reference)

Pinned by `e2e/charts/perm-*.spec.ts` (286 tests, create **and** edit builder). Each test records every step
(visible controls, Save state, data request, save payload + status) into one journal baseline
(`e2e/__snapshots__/charts/perm-*/<test>.journal.json`). Full type → type matrix from a fully configured
chart: [TYPE-SWITCH-BEHAVIOR.md](TYPE-SWITCH-BEHAVIOR.md). Bugs: [PINNED-BUGS.md](PINNED-BUGS.md).

| Scenario | File | Tests |
|---|---|---|
| Prefill-only switch (42 pairs × create/edit) | perm-prefill-switch.spec.ts | 84 |
| Round trip A → B → A (+14 no-switch controls) | perm-roundtrip.spec.ts | 98 |
| Chains (8 chains incl. all 7 types, × 2) | perm-chains.spec.ts | 16 |
| Dataset change (7 types × 2) | perm-dataset-change.spec.ts | 14 |
| Fill order (6 types × a/b, c, d, e × 2) | perm-fill-order.spec.ts | 48 |
| Metric tab cycling (row 0 ×7, row 1 ×4, × 2) | perm-metric-tabs.spec.ts | 22 |

## Round trip A → B → A — what is lost today

**Create builder**
- `dataLabelPosition` resets (e.g. inside → top; dropped through pivot / table / number).
- Through **pie**: metric #2 dropped. Through pie / table / pivot: line's `time_grain` cleared.
- **Table** always comes back with dimensions `[id]` (not statename + districtname).
- Bar / line / pie via **number or map**: no X axis → Save disabled.
- **Pivot** comes back with empty row/col dimensions (Save disabled), except via map.
- Map and number round trips keep everything.

**Edit builder** — everything above, plus every switch resets customizations to edit defaults: orientation,
lineStyle, chartStyle, colorScheme, numberSize, pivot theme, table freeze/zebra lost; pie legendPosition
right → top; showTooltip returns true after pivot / table / number. Edit-only mapping: table's first two
`table_columns` (id, country) become dimension + aggregate column; line → map uses `date` as geographic
column; passing through table adds `x_axis_column` + `table_columns` to the saved payload.

## Dataset change (education → maternal) — per type

Kept for every type: title, type, customizations.

| Type | Behavior |
|---|---|
| bar / line / pie | Re-prefilled: X = `bmi_raw`, metric COUNT(*); extra dimension, sort, pagination, time grain cleared |
| number | Re-prefilled to COUNT(*) |
| pivot | Re-prefilled: rows `bmi_raw`, cols `_airbyte_extracted_at`, totals off |
| table 🐞 | Dimensions blanked, metrics emptied, **no re-prefill**; old dataset's `table_columns` still saved |
| map 🐞 | State column + metric cleared, not refilled → Save disabled |

## Fill order

- **(a) metrics first vs (b) dimensions first** → identical final request + UI for every type, both builders.
- **(c) switch before any metric**: create map → bar keeps no dimension (Save disabled); edit pie → bar → 422 on save.
- **(d) remove all metrics, then switch**: bar / line / pie / table leave Save **enabled** but backend 422s; map → Save disabled.
- **(e) X axis to a date column and back**: time grain appears, then clears.

## Metric tab cycling

- Every step sends a request except clicking the Calculated / Saved tab (nothing committed yet).
- Saved → Simple keeps SUM(students), drops the library link.
- Map: overlay payload renames the alias to `"value"`, so Saved → Simple sends no request.
- Cycling row 1 never affects row 0.
