# Chart type switching — current behavior (pre-refactor reference)

Pinned by `e2e/charts/type-switch-matrix.spec.ts` (create builder, `TS-create …`) and
`type-switch-matrix-edit.spec.ts` (edit builder, `TS-edit …`). Each source chart is **fully configured**
(2 metrics, extra dimension, legend bottom, data labels, drill/subtotals where applicable) before switching.
P = `[pinned]` (surprising/buggy; see PINNED-BUGS.md). Fixes happen in separate PRs after the refactor.

Related permutation coverage (prefill-only switches, round trips, chains, dataset change, fill order, metric-tab cycling): `e2e/charts/perm-*.spec.ts`.

**Create builder** (rows = source, columns = target):

| src\tgt | bar | line | pie | number | table | map | pivot |
|---|---|---|---|---|---|---|---|
| bar | – | keeps all; label inside→top | X+extra, 1st metric | 1st metric, drops X/extra P | dims=id P | state=statename; save 422 P | rows/cols empty, disabled P |
| line | keeps all; label bottom→top | – | X+extra, 1st metric; label→outside | same as bar P | dims=id P | save 422 P | disabled P |
| pie | keeps X+extra+metric | same; label→top | – | metric P | dims=id P | save 422 P | disabled P |
| number | X empty, disabled P | X empty, disabled P | X empty, disabled P | – | dims=id, keeps number styling P | state=statename, OK | disabled P |
| table | X=statename, extra none, both metrics, no styling | same | X=statename, 1st metric | 1st metric P | – | state=statename, OK | disabled P |
| map | X empty, disabled P | X empty, disabled P | X empty, disabled P | saves map fields and styling P | dims empty, saves map fields P | – | disabled P |
| pivot | X empty, disabled P | X empty, disabled P | X empty, disabled P | 1st metric P | dims=id, both metrics P | state=statename, OK | – |

**Edit builder:** styling is always reset to the new type's defaults, keeping only tooltip, legend and data-label on/off, titles/subtitle and the raw data label position. The user's legend position of bottom becomes top.

| src\tgt | bar | line | pie | number | table | map | pivot |
|---|---|---|---|---|---|---|---|
| bar | – | keeps all; PUT 422 P | X+extra, 1st metric | 1st metric, number defaults P | dims=id; table_columns=[statename,students,male_score] P | state=statename, 2 metric rows P | disabled P |
| line | keeps all; PUT 422 P | – | PUT 422 P | 1st metric P | dims=id P | 2 metric rows P | disabled P |
| pie | X+extra+metric, OK | PUT 422 P | – | metric P | dims=id P | state=statename, OK | disabled P |
| number | X empty, disabled P | X empty, disabled P | X empty, disabled P | – | dims=id; table_columns=[students]; subtitle kept P | OK, subtitle kept | disabled P |
| table | X=id, aggregate column=country P | same P | same P | aggregate column=country P | – | state=id, value=country P | disabled P |
| map | X=statename, SUM students, OK | same | same | OK | dims empty P | – | disabled P |
| pivot | X empty, disabled P | X empty, disabled P | X empty, disabled P | 1st metric P | dims=id P | state=statename, OK | – |

P = `[pinned]` in the test title. That is 30 transitions in create and 33 in edit, each with a one-line comment giving the source reason.

**Pinned reasons, all checked against the source:**
- **Backend rejects the save (422), create — bar/line/pie → map:** the source's legend position "bottom" is carried into the map styling, where it must be a corner value. `sanitizeCustomizationsForChartType` only fixes the data label position.
- **Backend rejects the save (422), edit — bar→line, line→bar, line→pie, pie→line:** the edit page's type-switch logic puts the old data label position back over the corrected one.
- **Map source in create:** its type selector only changes the chart type and skips `handleChartTypeChange`. Auto-prefill is skipped because a state column is already set. So map → bar/line/pie leaves X empty and Save disabled, map → table has no dimension, and map → number/table save the map-only fields.
- **Number/pivot → bar/line/pie (both builders):** X is left empty and Save is disabled, because the unset dimension overwrites the auto-prefilled one.
- **Any → table:** the table dimension comes from auto-prefill (id), not the source dimension.
- **Any → pivot:** rows and columns are reset to empty, so Save is disabled.
- **→ number:** the request still sends aggregate "count" next to the kept SUM metric.
- **Edit only:**
  - Bar/line → map keeps both metric rows, although a map takes one metric.
  - Table → other types pulls dimension/aggregate (or state/value) columns from the table's column list, giving id and country.
  - Map → table has no table dimension.
