# Conditional Formatting + Table Drill-Down: Pitfall Analysis & Fix Plan

**Date**: 2026-04-14  
**Status**: Awaiting review  
**Context**: After shipping non-numeric conditional formatting support, the following pitfalls were identified at the intersection of conditional formatting and table drill-down. Each item is documented with the exact scenario, affected code location, severity, and a recommended fix.

---

## Priority 1 — Broken (Must Fix)

### Pitfall 2 — Drill-click affordance conflicts with conditional color

**Scenario**  
When a user creates a rule like `district == "Bengaluru" → red`, and then drills into a level where `district` is the current drillable column, the cell "Bengaluru" renders with both a red `backgroundColor` (from conditional formatting) and `text-blue-600 hover:underline cursor-pointer` (from drill-down affordance). Red implies "blocked/error"; blue underline says "click me". These signals directly contradict.

**Affected code**  
- `components/charts/TableChart.tsx` — `getConditionalColor` call site (line ~456) and `isDrillDownClickable` class application (line ~461–472)

**Fix**  
Suppress `conditionalColor` entirely when `isDrillDownClickable` is true for that cell. Dimension columns are navigational — their background should not be overridden by data-value rules.

```tsx
// In TableChart.tsx, before applying conditionalColor:
const conditionalColor = isDrillDownClickable
  ? undefined
  : getConditionalColor(rawValue, column);
```

---

### Pitfall 5 — TypeScript type mismatch: `value: number` on text rules

**Scenario**  
`TableChartProps.config.conditionalFormatting` in `TableChart.tsx` (lines 82–87) types `value` as `number`. Text rules (introduced in the latest feature) have `value: string`. This produces TypeScript errors and will block strict builds. At runtime it works because `getConditionalColor` already uses `(rule as any).type`, but the prop type must be corrected.

**Affected code**  
- `components/charts/TableChart.tsx` — inline `conditionalFormatting` type in `TableChartProps` (lines 82–87)

**Fix**  
Replace the inline type with an import of `ConditionalFormattingRule` from `components/charts/types/table/types.ts`:

```typescript
import type { ConditionalFormattingRule } from './types/table/types';

// In TableChartProps.config:
conditionalFormatting?: ConditionalFormattingRule[];
```

---

## Priority 2 — Confusing (Should Fix)

### Pitfall 9 — Frozen column + conditional color: inline style clobbers sticky background

**Scenario**  
When `freezeFirstColumn` is enabled, the frozen `TableCell` has `bg-background sticky left-0` to hold its background during horizontal scroll. A conditional formatting rule on that same column applies `style={{ backgroundColor: color }}` inline, which overrides the Tailwind `bg-background` class. When the user scrolls horizontally, the sticky cell shows the conditional color correctly, but the visual effect of the freeze (opaque background that masks scrolling content behind it) breaks — the colored cell becomes transparent against the scrolled-behind content.

**Affected code**  
- `components/charts/TableChart.tsx` — frozen cell render block (lines ~458–472), specifically the interaction between the `sticky left-0 bg-background` class and the `style={{ backgroundColor }}` prop

**Fix**  
Apply the conditional color via an inner wrapper `div` instead of on the `TableCell` itself, so the `TableCell` retains full control of the sticky background:

```tsx
<TableCell
  className={`... ${isFrozen ? 'sticky left-0 z-10 bg-background border-r' : ''}`}
  // No backgroundColor style here
>
  <div style={conditionalColor ? { backgroundColor: conditionalColor } : undefined}
       className="w-full h-full px-2 py-1.5">
    {cellValue}
  </div>
</TableCell>
```

> **Note**: This requires adjusting padding from the `TableCell` to the inner `div` so visual spacing is preserved.

---

### Pitfall 1 — Rules for lower-level dimension columns are silently dormant at Level 0

**Scenario**  
The `ConditionalFormattingSection` lists all dimension columns at once (`state`, `district`, `city`). A user authoring a rule on `district` at Level 0 sees it do nothing — there's no indication that the rule is only active when drilling into Level 1. The rule is correct; the UI just gives no feedback.

**Affected code**  
- `components/charts/types/table/ConditionalFormattingSection.tsx` — column selector dropdown
- `components/charts/ChartCustomizations.tsx` — the `allDisplayedColumns` list passed as `allColumns`

**Fix**  
When drill-down is configured, pass a `drillLevelMap?: Record<string, number>` prop to `ConditionalFormattingSection` (e.g. `{ state: 0, district: 1, city: 2 }`). In the column selector, annotate each drill dimension with its level:

```
state       (Level 0)
district    (Level 1)
city        (Level 2)
revenue     
count       
```

Additionally, show a badge on each rule card whose column is not Level 0: **"Active from Level N"**.

---

### Pitfall 6 — `allColumns` in the authoring UI lists all drill levels simultaneously

**Scenario**  
Closely related to Pitfall 1. The column selector lists every possible column across all drill levels, giving no structural indication of when each is visible. A user creating rules doesn't know that `state` and `district` are never visible at the same time.

**Affected code**  
- `components/charts/ChartCustomizations.tsx` — `allDisplayedColumns` computation (lines ~190–206)

**Fix**  
Same `drillLevelMap` prop as Pitfall 1. No change to `allDisplayedColumns` — all columns should remain selectable. The fix is purely presentational: annotate the dropdown and add a helper note: *"Columns at deeper drill levels are only visible after drilling in."*

---

### Pitfall 3 — `columnOrder` guard silently fails after drilling

**Scenario**  
The saved `columnOrder` (e.g. `[state, revenue, count]`) is validated by checking that all saved columns are present in the API-returned columns. After drilling to Level 1, `state` is no longer in the response — the guard fails, `columnOrder` is ignored, and columns revert to API order. On drill-up, `columnOrder` snaps back. The user experiences unexplained column reordering when navigating drill levels.

**Affected code**  
- `app/charts/[id]/ChartDetailClient.tsx` — `columnOrder` guard (lines ~821–829)

**Fix**  
When drill-down is active, strip the previous level's dimension column from the saved `columnOrder` before the guard check, and prepend the current dimension column at position 0. Metric column ordering is preserved. On drill-up, restore the original saved order.

---

### Pitfall 10 — `!=` text rules apply level-agnostically across all drill levels

**Scenario**  
A rule `district != "Pune" → orange` created while thinking about Maharashtra's Level 1 data will also fire inside Gujarat at Level 1, highlighting every district there (since none are "Pune"). There is no way to scope a rule to a specific drill path.

**Affected code**  
- `components/charts/types/table/ConditionalFormattingSection.tsx` — rule authoring UI
- `components/charts/types/table/types.ts` — `ConditionalFormattingRule` type
- `components/charts/TableChart.tsx` — `getConditionalColor`

**Fix**  
This is a phased fix:
1. **Immediate (low effort)**: Add a helper note in the rule card when the column is a drill-level dimension: *"This rule will apply at every drill level where this column is visible."*
2. **Future enhancement**: Add an optional `scope` field to `ConditionalFormattingRule` (e.g. `scope?: 'global' | string[]` where the string values are dimension filter paths). `getConditionalColor` would skip rules whose scope doesn't match the current drill path. The authoring UI would expose this as an advanced option.

---

## Priority 3 — Low (Nice to Have)

### Pitfall 4 — Dimension/metric alias collision triggers rule on wrong column

**Scenario**  
If a metric alias happens to share a name with a dimension column from another drill level (e.g. both a dimension `year` and a metric aliased as `year`), `columnTypeMap` will mark it as `'numeric'` (metric takes precedence), and a conditional rule authored against `year` may silently match the wrong column.

**Affected code**  
- `components/charts/ChartCustomizations.tsx` — `columnTypeMap` computation

**Fix**  
Detect alias collisions at build time and warn in the UI. In `ConditionalFormattingSection`, annotate column entries as "(dimension)" or "(metric)" so users can distinguish them.

---

### Pitfall 7 — Breadcrumb uses raw column names; text rule values must match exact DB values

**Scenario**  
The breadcrumb renders raw column names and values (e.g. `geo_l1_cd: KA`). If the display name for a column differs from its raw name, users attempting to author a text rule by reading the breadcrumb may enter the display name as the rule value — which won't match.

**Affected code**  
- `app/charts/[id]/ChartDetailClient.tsx` — breadcrumb render (lines ~807–811)

**Fix**  
Add a helper text to text rule value inputs: *"Value must match exact database value (case-sensitive)."* Optionally, use column display labels in the breadcrumb if a label map is available.

---

### Pitfall 8 — Export during drill-down silently exports the filtered subset

**Scenario**  
When a user is drilled in to Level 1 and exports to CSV, the exported file is the drill-filtered subset (e.g. only Karnataka's districts) with no indication in the filename or content. The user may expect a full export.

**Affected code**  
- `app/charts/[id]/ChartDetailClient.tsx` — export logic
- `components/charts/ChartExportDropdown.tsx` (or equivalent)

**Fix**  
When `tableDrillDownState` is active:
- Append drill context to the filename: `{chart_title}_{filter_values}.csv`
- Change the export button label to **"Export current view"**

---

## Summary Table

| # | Pitfall | Severity | Primary file | Status |
|---|---------|----------|--------------|--------|
| 2 | Drill-click affordance vs. conditional color conflict | **Broken** | `TableChart.tsx` | ☐ |
| 5 | TypeScript `value: number` mismatch for text rules | **Broken** | `TableChart.tsx` | ☐ |
| 9 | Frozen column: inline style clobbers sticky bg | Confusing | `TableChart.tsx` | ☐ |
| 1 | Lower-level dimension rules silently dormant | Confusing | `ConditionalFormattingSection.tsx` | ☐ |
| 6 | Authoring UI lists all drill-level columns at once | Confusing | `ChartCustomizations.tsx` | ☐ |
| 3 | `columnOrder` guard fails on dimension column swap | Confusing | `ChartDetailClient.tsx` | ☐ |
| 10 | `!=` text rules apply across all drill levels | Confusing | `ConditionalFormattingSection.tsx` + `types.ts` | ☐ |
| 4 | Dimension/metric alias collision | Silent bug | `ChartCustomizations.tsx` | ☐ |
| 7 | Breadcrumb raw names vs. text rule value authoring | Low | `ChartDetailClient.tsx` | ☐ |
| 8 | Export during drill-down exports filtered subset | Low | `ChartDetailClient.tsx` | ☐ |
