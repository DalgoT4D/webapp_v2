# Conditional Formatting + Table Drill-Down: Implementation Plan

**Date**: 2026-04-15  
**Status**: Ready for implementation  
**Branch**: sprint/charts-enhancement

---

## Background

After shipping non-numeric conditional formatting support, a UX analysis and researcher review identified 10 pitfalls at the intersection of conditional formatting and table drill-down. This document is the approved implementation plan, incorporating the UX researcher's verdict on the level-scoping approach.

---

## Approved UX Approach (from researcher review)

**Problem 1 — Dimension rules silently dormant at top level**  
Keep the rule card UI unchanged. Add a read-only contextual annotation inside each rule card when drill-down is ON and the rule targets a dimension column: *"Active at drill level: district"*. No new user input required — purely informational.

**Problem 2 — Metric thresholds are one-size-fits-all across levels**  
Add an optional `level?: number` field to `ConditionalFormattingRule` (backward-compatible; `undefined` = applies at all levels). When drill-down is ON and a **metric** column is selected, show an optional inline **"Scope to level"** chip after the value input. Defaults to empty (global). When activated, a compact dropdown appears labelled with column names — **not numbers**: `All levels / state / district / city`. Internally stores `level: 0`, but users always see the dimension column name.

**What was rejected**: A "select Level first, column auto-fills" flow. Users think in column names, not level indices. Level numbers are never shown to users anywhere in the UI.

---

## Data Model Change

### `components/charts/types/table/types.ts`

Add `level?: number` to the base rule interface (shared by both numeric and text variants):

```typescript
interface BaseConditionalFormattingRule {
  column: string;
  color: string;
  /** Optional drill level this rule is scoped to. undefined = fires at all levels. */
  level?: number;
}
```

No migration needed. Existing rules without `level` continue to behave exactly as today.

---

## Implementation Tasks

### Task 1 — Fix TypeScript type mismatch (Pitfall 5) ✦ Priority 1 · Broken

**File**: `components/charts/TableChart.tsx` (lines 82–87)

The inline `conditionalFormatting` type in `TableChartProps.config` still types `value` as `number`, breaking text rules at compile time.

**Change**: Replace the inline type with an import:

```typescript
import type { ConditionalFormattingRule } from './types/table/types';

// In TableChartProps.config:
conditionalFormatting?: ConditionalFormattingRule[];
```

---

### Task 2 — Suppress conditional color on drillable cells (Pitfall 2) ✦ Priority 1 · Broken

**File**: `components/charts/TableChart.tsx` (~line 456)

A rule like `district == "Bengaluru" → red` applied to the current drillable column produces contradictory visuals: red background + blue underline. Drillable cells are navigational — their background must not be overridden.

**Change**: Move `getConditionalColor` call to after `isDrillDownClickable` is determined, and short-circuit when true:

```typescript
const isDrillDownClickable = drillDownEnabled && column === currentDimensionColumn;
const conditionalColor = isDrillDownClickable
  ? undefined
  : getConditionalColor(rawValue, column);
```

---

### Task 3 — Fix frozen column + conditional color scroll artifact (Pitfall 9) ✦ Priority 2

**File**: `components/charts/TableChart.tsx` (frozen cell render ~lines 458–472)

`sticky left-0 bg-background` on the `TableCell` is overridden by `style={{ backgroundColor }}`. When scrolled horizontally, the sticky cell's opaque background breaks, and scrolled-behind content bleeds through.

**Change**: Move the conditional color to an inner wrapper `div`; keep the `TableCell` responsible only for sticky positioning:

```tsx
<TableCell
  className={`py-0 px-0 ${alignClass} ${isFrozen ? 'sticky left-0 z-10 bg-background border-r shadow-[1px_0_0_0_hsl(var(--border))]' : ''} ...`}
  style={undefined}  {/* no backgroundColor here */}
  onClick={...}
>
  <div
    className="py-1.5 px-2 w-full h-full"
    style={conditionalColor ? { backgroundColor: conditionalColor } : undefined}
  >
    {cellContent}
  </div>
</TableCell>
```

> Padding must move from `TableCell` to the inner `div` (`py-1.5 px-2`) to preserve visual spacing. Apply this pattern to **all** cells (frozen and non-frozen) for consistency; only frozen cells need the `bg-background` on the outer `TableCell`.

---

### Task 4 — Thread drill-down context into ConditionalFormattingSection (Pitfall 1 + 6) ✦ Priority 2

This is the prerequisite for Tasks 5 and 6. `ConditionalFormattingSection` currently has no knowledge of drill-down state or dimension order.

**Files**:
- `components/charts/types/table/ConditionalFormattingSection.tsx` — add props
- `components/charts/types/table/TableChartCustomizations.tsx` — pass props through
- `components/charts/ChartCustomizations.tsx` — compute and pass values

**New props on `ConditionalFormattingSection`**:

```typescript
interface ConditionalFormattingSectionProps {
  // ...existing props...
  drillDownEnabled?: boolean;
  /** Ordered dimension columns when drill-down is ON, e.g. ['state', 'district', 'city'] */
  orderedDimensions?: string[];
}
```

**In `ChartCustomizations.tsx`** (TABLE case): compute `orderedDimensions` from `formData.dimensions` filtered by `enable_drill_down === true`, in order. Pass `drillDownEnabled` and `orderedDimensions` down to `TableChartCustomizations`, which passes them to `ConditionalFormattingSection`.

---

### Task 5 — Dimension rule dormancy annotation (Pitfall 1 + 6) ✦ Priority 2

**File**: `components/charts/types/table/ConditionalFormattingSection.tsx`

Using the props from Task 4, build a helper:

```typescript
const getDimensionLevel = (col: string): number | undefined => {
  if (!drillDownEnabled || !orderedDimensions) return undefined;
  const idx = orderedDimensions.indexOf(col);
  return idx >= 0 ? idx : undefined;
};
```

**In the column dropdown**, annotate dimension columns with their level label (using column name language, not numbers):

```
state     — visible at top level
district  — visible after drilling into state
city      — visible after drilling into district
revenue
count
```

Render as `<SelectItem>` with a muted suffix. Example implementation:

```tsx
<SelectItem key={col} value={col}>
  <span>{col}</span>
  {dimLevel !== undefined && dimLevel > 0 && (
    <span className="ml-2 text-xs text-muted-foreground">
      after drilling into {orderedDimensions[dimLevel - 1]}
    </span>
  )}
</SelectItem>
```

**In each rule card**, when `getDimensionLevel(rule.column)` returns a value, show a read-only annotation below Row 1:

```tsx
{dimLevel !== undefined && (
  <p className="text-xs text-muted-foreground">
    {dimLevel === 0
      ? 'Active at the top level.'
      : `Active after drilling into ${orderedDimensions[dimLevel - 1]}.`}
  </p>
)}
```

---

### Task 6 — Level-scoped metric rules: data model + UI (Pitfall 10) ✦ Priority 2

This implements the approved UX approach for per-level metric thresholds.

#### 6a. Data model — `components/charts/types/table/types.ts`

Add `level?: number` to `BaseConditionalFormattingRule` (see Data Model Change section above).

#### 6b. Runtime enforcement — `components/charts/TableChart.tsx`

Pass `currentDrillLevel?: number` as a new prop to `TableChart`. In `getConditionalColor`, add a level check:

```typescript
// After ruleType/column check, before operator evaluation:
if (rule.level !== undefined && rule.level !== currentDrillLevel) continue;
```

**In `ChartDetailClient.tsx`**, pass `currentDrillLevel` to `TableChart`:

```typescript
currentDrillLevel={
  tableDrillDownState
    ? tableDrillDownState.currentLevel + 1  // currentLevel is 0-indexed drill depth
    : 0
}
```

#### 6c. UI — `components/charts/types/table/ConditionalFormattingSection.tsx`

When `drillDownEnabled` is true and the rule's column is a **metric** (i.e. not in `orderedDimensions`), render a "Scope to level" chip after the value input in Row 1.

The chip is a compact `Select` defaulting to `undefined` (all levels):

```tsx
{drillDownEnabled && !isDimensionColumn(rule.column) && orderedDimensions && (
  <Select
    value={rule.level !== undefined ? String(rule.level) : '__all__'}
    onValueChange={(val) =>
      handleUpdateRule(index, 'level', val === '__all__' ? undefined : Number(val))
    }
  >
    <SelectTrigger className="h-8 text-xs w-[130px]" data-testid={`rule-level-${index}`}>
      <SelectValue placeholder="All levels" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="__all__">All levels</SelectItem>
      {orderedDimensions.map((dimCol, i) => (
        <SelectItem key={i} value={String(i)}>
          {dimCol} level
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)}
```

Update `handleUpdateRule` to handle `field === 'level'` — store `undefined` for "all levels", `number` for a specific level.

---

### Task 7 — Dimension reorder invalidation guard ✦ Priority 2 · Edge Case

**File**: `components/charts/TableDimensionsSelector.tsx` — `handleDragEnd`

When dimensions are reordered, level-scoped rules become misaligned (a rule scoped to level 0 now points to a different column). After `arrayMove`, run a check against `customizations.conditionalFormatting`:

This requires passing `conditionalFormatting` rules into `TableDimensionsSelector` and a callback `onDrillOrderChange` that triggers a warning banner if any rules have `level` set.

**Recommended pattern**: `TableDimensionsSelector` accepts an optional `hasLevelScopedRules?: boolean` prop. When `handleDragEnd` fires and `hasLevelScopedRules` is true, call an `onReorderWithScopedRules?()` callback. The parent (`ChartBuilder` or the chart edit page) shows a non-blocking warning banner:

> "The drill-down order changed. Review your conditional formatting rules — level-scoped rules may now target different columns."

Do not auto-delete or auto-remap rules. The user audits.

---

### Task 8 — Drill-down toggle OFF: handle level-scoped orphans ✦ Priority 2 · Edge Case

**File**: `components/charts/TableDimensionsSelector.tsx` — `handleDrillDownToggle`

When drill-down is toggled OFF and any rules have `level` set, show an inline confirmation within the `ConditionalFormattingSection`:

> "Drill-down is off. Level-scoped rules are inactive. [Keep them] [Remove them]"

"Keep them" = rules persist but don't fire (they reactivate if drill-down is re-enabled).  
"Remove them" = strip `level` from all rules (they become global).

This requires `TableChartCustomizations` to pass a `conditionalFormatting` update callback that can be triggered from the `drillDownEnabled` change event.

---

### Task 9 — Remove dimension with scoped rules: warn user ✦ Priority 2 · Edge Case

**File**: `components/charts/TableDimensionsSelector.tsx` — `handleRemoveDimension`

When a dimension is removed that has conditional formatting rules scoped to its level, warn before removing:

> "Removing this dimension will deactivate N conditional formatting rule(s) scoped to it."

Pass `scopedRuleCounts?: Record<number, number>` (level index → count of scoped rules) from the parent into `TableDimensionsSelector`.

---

### Task 10 — Fix `columnOrder` guard on drill level change (Pitfall 3) ✦ Priority 2

**File**: `app/charts/[id]/ChartDetailClient.tsx` (lines ~821–829)

The `columnOrder` guard fails at deeper drill levels because the saved order includes the top-level dimension column (e.g. `state`) which is absent from the API response at Level 1.

**Fix**: When `tableDrillDownState` is active, build a drill-adjusted order before the guard:
1. Strip the previous dimension column from saved `columnOrder`
2. Prepend the current dimension column at position 0
3. Run the existing guard against this adjusted order

```typescript
const effectiveOrder = (() => {
  if (!tableDrillDownState || !savedOrder) return savedOrder;
  // Remove all dimension columns that aren't the current one
  const metricOrder = savedOrder.filter((c: string) => !allDrillDimensions.includes(c));
  return [currentDimensionColumn, ...metricOrder];
})();
```

---

### Task 11 — Helper text for exact-match text rules (Pitfall 7) ✦ Priority 3

**File**: `components/charts/types/table/ConditionalFormattingSection.tsx`

When `type === 'text'` and the rule's column is a dimension column, show a helper below the value input:

```tsx
<p className="text-xs text-muted-foreground mt-1">
  Value must match exact database value (case-sensitive).
</p>
```

---

### Task 12 — Export filename context during drill-down (Pitfall 8) ✦ Priority 3

**File**: `app/charts/[id]/ChartDetailClient.tsx`

When `tableDrillDownState` is active, modify the export filename to include drill filter context. Change the export button label to **"Export current view"**.

```typescript
const exportFilename = tableDrillDownState
  ? `${chart.title}_${Object.values(tableDrillDownState.appliedFilters).join('_')}`
  : chart.title;
```

---

## Files Changed Summary

| File | Tasks |
|------|-------|
| `components/charts/types/table/types.ts` | 6a — add `level?: number` to `BaseConditionalFormattingRule` |
| `components/charts/TableChart.tsx` | 1, 2, 3, 6b — type fix, drill-click suppression, frozen cell wrapper, level enforcement |
| `components/charts/types/table/ConditionalFormattingSection.tsx` | 4, 5, 6c, 11 — drill props, dimension annotations, level scope chip, helper text |
| `components/charts/types/table/TableChartCustomizations.tsx` | 4 — pass `drillDownEnabled` + `orderedDimensions` through |
| `components/charts/ChartCustomizations.tsx` | 4 — compute and pass `drillDownEnabled` + `orderedDimensions` |
| `components/charts/TableDimensionsSelector.tsx` | 7, 8, 9 — reorder warning, toggle-off handler, remove-dimension warning |
| `app/charts/[id]/ChartDetailClient.tsx` | 6b, 10, 12 — pass `currentDrillLevel`, fix `columnOrder` guard, export filename |
| `components/charts/types/table/__tests__/ConditionalFormattingSection.test.tsx` | All — add drill-down test cases |

---

## Suggested Implementation Order

```
Task 1 → Task 2          (independent quick fixes, do in parallel)
Task 3                   (isolated TableChart cell rendering)
Task 4                   (prerequisite for 5, 6c)
Task 5 → Task 6a + 6b   (annotation first, then data model + runtime)
Task 6c                  (UI for level scoping, after 6a + 6b confirmed)
Task 7 → Task 8 → Task 9 (edge case guards, do in order)
Task 10                  (independent, ChartDetailClient)
Task 11 → Task 12        (low priority, do last)
```

---

## Verification Checklist

- [ ] Text rules no longer cause TypeScript errors (Task 1)
- [ ] Drillable dimension cell shows no conditional color, only blue underline (Task 2)
- [ ] Frozen column with a matching rule scrolls correctly — no background bleed (Task 3)
- [ ] Column dropdown shows "after drilling into state" labels for lower-level dimensions (Task 5)
- [ ] Rule cards for lower-level dimensions show the "Active after drilling into X" annotation (Task 5)
- [ ] Metric rule with level scope = "district level" only highlights at Level 1, not Level 0 (Task 6)
- [ ] Metric rule with "All levels" highlights at every level (Task 6, backward compat)
- [ ] Dragging to reorder dimensions shows a warning banner when level-scoped rules exist (Task 7)
- [ ] Toggling drill-down OFF with level-scoped rules shows keep/remove prompt (Task 8)
- [ ] Removing a dimension with scoped rules shows a warning count (Task 9)
- [ ] Column order does not revert on drill-in; metric column order is preserved (Task 10)
- [ ] All existing conditional formatting tests still pass
- [ ] New tests cover: level-scoped rules fire/suppress correctly, annotation renders, scope chip persists

---

## Resolved Decisions

1. **Pitfall 4 (alias collision)** — Add "(dimension)" / "(metric)" labels to the column dropdown as part of Task 5. Merged into Task 5 scope.
2. **Task 8 wording** — Use an inline prompt/banner inside `ConditionalFormattingSection` when drill-down is toggled OFF with level-scoped rules present.
3. **Task 3 cell wrapper** — `py-1.5` padding on the inner `div` is sufficient. No flex/align-items needed.
