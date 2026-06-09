# Dashboard Fluid Row Flow — Design Spec

**Date:** 2026-05-06
**Branch:** `enhancment/dashborad-fluid-row-flow`
**Status:** Design — awaiting approval

---

## Problem

Dashboard charts in Dalgo are positioned with absolute `(x, y)` coordinates on a 12-column grid. Once placed, charts do not auto-rearrange. If a user wants to move a chart from the bottom row to the top, swap two charts in a row, or close a gap left by a deleted chart, they must manually drag every other chart into place. This is the single most-cited friction point from customers.

A previous attempt to enable natural rearrangement (commit `3638901 "Arrange the dashboard"`) was reverted because removing the position-restoration logic caused `react-grid-layout`'s built-in collision handling to shuffle charts in unpredictable ways.

## Goal

Make the dashboard behave like text in a word processor: charts are an ordered sequence that flows left-to-right and wraps to the next row when the current row is full. Every mutation — add, delete, resize, move — re-runs the flow so the layout is always packed and gap-free between rows.

## Non-Goals

- Free-form / canvas positioning (Looker Studio / PowerPoint style). Explicitly rejected.
- Masonry / Pinterest-style gap-filling within rows. Breaks reading order; rejected after explicit discussion.
- Mobile-specific layout reflow (different column counts at narrow widths). Out of scope; flagged as future work.
- Backend persistence schema changes. We keep the existing `{i,x,y,w,h,minW,minH,maxW}` wire format.

## The Model — one rule

> A dashboard is an **ordered list** of charts. Each chart has a width `w` and height `h` in grid units. We render charts left-to-right on a 12-column grid, packing as many as fit per row. When a chart doesn't fit on the current row, it wraps to the next row. **Row height = the height of the tallest chart in that row.** The next row begins immediately below the previous row's bottom edge. Any change — add, delete, resize, move — re-runs the flow.

That's the entire behavioral contract. Everything else is mechanics.

## Behavior matrix

| Action | What happens |
|---|---|
| **Add** at index N | Chart inserted at position N; charts at N..end shift right; trailing charts wrap to next row if overflow |
| **Delete** | Charts to the right shift left; first chart of next row pulls up if it now fits |
| **Resize larger** | Right neighbors shift right; trailing chart wraps if overflow |
| **Resize smaller** | Right neighbors shift left to close the gap; next-row chart pulls up if it now fits |
| **Move** chart from index `i` to `j` | Equivalent to "delete at `i`, insert at `j`"; one fluid reflow |
| **Drop on empty space below all charts** | Append to end of ordered list |

**Whitespace rule:** Whitespace within a row (e.g., next to a tall table when row 1 is short on remaining width) is permitted — this is the "ragged right edge" of a paragraph. Whitespace **between** rows is impossible by construction. No vertical gaps ever.

## Drag UX

While dragging a chart:
- The chart follows the cursor freely (no live reflow)
- A **blue insertion line** is drawn between the two existing charts where the dragged chart will land if released
- The insertion index is computed from cursor (x, y) by walking the ordered list and finding which slot the cursor center falls into
- On `dragStop`: chart is removed from its old position, inserted at the computed index, and the entire layout reflows once

This avoids the "drag-jump" bug from the previous attempt: live reflow during drag teleports the chart away from the cursor because RGL's controlled `layout` prop overrides the in-flight drag position.

Resize uses the same pattern: chart resizes freely while dragging the corner; on `resizeStop`, reflow runs once.

## Architecture

### Storage model

**Wire format unchanged.** We persist `state.layout` as today: `[{i, x, y, w, h, minW, minH, maxW}, ...]`. **The change is semantic:** the **array order** becomes the source of truth for sequence; `(x, y)` is **derived state** computed by `flowLayout()` before every render and before every persist.

This means:
- No backend migration needed
- Old dashboards open as-is; first edit reflows them into clean rows
- View mode reads the same shape, just runs `flowLayout()` on render
- Undo/redo continues to work with the existing history mechanism (the array snapshots are still meaningful)

### Renderer

`react-grid-layout` v1.5.2 stays as the renderer. It becomes a "dumb positioning shell": absolute-positioned divs with drag/resize handles. We feed it `(x, y, w, h)` produced by our flow algorithm. RGL's own collision/compaction is disabled.

**RGL config changes:**
- `compactType={null}` (was `"vertical"`) — RGL no longer applies its own gravity
- `preventCollision={false}` (was `true`) — allow charts to land between others; reflow restores order
- `allowOverlap={false}` — kept; RGL still snaps to a non-overlapping position momentarily, but reflow on stop is the real source of truth
- All other props (drag handles, resize handles, margins) unchanged

### The flow algorithm

`flowLayout()` already exists in [lib/dashboard-animation-utils.ts](lib/dashboard-animation-utils.ts) but has bugs that must be fixed before it can be the source of truth:

1. **Fractional spacing accumulates in `currentX`.** `spacing = spacingPx / 30` mixes integer column units with fractions; after a few items, `currentX` drifts and rows wrap prematurely. **Fix:** keep `currentX` in pure integer column units; spacing is purely a CSS margin concern (already handled by RGL's `margin` prop), not part of the column math.
2. **Sort by `(y, x)` destroys array order.** Currently sorts the input by current visual position. After this change, the array order IS the truth — **remove the sort** entirely; iterate the array as-is.
3. **No respect of `minW`/`minH`.** If a chart's `w` violates `minW`, the flow function should not silently accept it. **Fix:** clamp `w = max(minW, min(maxW, w))` when reading the item.
4. **No clamp on `w > 12`.** A chart wider than the grid is impossible. **Fix:** `w = min(w, 12)` at read time.
5. **Spacing-related `Math.floor(currentY)` collapses adjacent rows.** Cumulative fractional `y` floors to the same value for adjacent same-height rows. **Fix:** `y` stays in integer grid units; spacing is RGL's responsibility.

The fixed signature:

```ts
function flowLayout(
  components: LayoutItem[],          // ordered array — order is truth
  gridCols: number = 12
): LayoutItem[]
```

Returns a new array of the same items with `(x, y)` rewritten. `w`, `h`, `minW`, `minH`, `maxW`, and `i` are passed through unchanged. **Pure function. Deterministic. Unit-testable.**

### Mutation pipeline — five hookpoints

Every mutation that changes `state.layout` must run through reflow. Today the mutations are scattered. We centralize:

```ts
function applyMutation(
  layout: LayoutItem[],
  mutation: (l: LayoutItem[]) => LayoutItem[]
): LayoutItem[] {
  const mutated = mutation(layout);
  return flowLayout(mutated, GRID_COLS);
}
```

The five paths in [components/dashboard/dashboard-builder-v2.tsx](components/dashboard/dashboard-builder-v2.tsx):
1. `handleDragStop` (~L1006) — compute insert index from cursor; remove from old index; insert at new; reflow
2. `handleResizeStop` (~L1096) — write new w/h to the resized item; reflow
3. `handleChartSelected` (~L1254) — append new chart to end of array; reflow (replaces `findOptimalPosition` logic)
4. `addTextComponent` and similar widget-add paths — append; reflow
5. `removeComponent` (~L1341) — splice; reflow

`handleLayoutChange`, `handleDrag`, and `handleResize` (the *during-drag* events) **do not** call reflow. They only update internal refs / dragging state and render the insertion-line overlay. This is the critical fix for the previous attempt's drag-jump bug.

View mode in [components/dashboard/dashboard-native-view.tsx](components/dashboard/dashboard-native-view.tsx) (~L1186) runs `flowLayout()` on render — read-only, no mutations, but the (x,y) must be recomputed from array order.

### Insertion-line overlay

A new component `<InsertionLine>` renders during drag at the position computed from the cursor. Implementation:
- Mounted inside the GridLayout container, absolutely positioned
- Visibility tied to `isDraggingRef.current` and a derived `insertIndex` state
- Position computed from (a) the dragged item's current cursor (x, y) in grid coords, (b) walking the ordered list to find which item-boundary the cursor is closest to
- A simple vertical 2px blue bar between two charts, or horizontal at row-end / row-start

RGL's default placeholder must be hidden in fluid mode. Currently styled visible at [app/globals.css:86–98](app/globals.css#L86-L98). We add a `data-fluid-flow` attribute on the GridLayout container and scope the placeholder rules to `:not([data-fluid-flow])` so the legacy mode is unaffected (if/when we keep it).

### CSS adjustments

In [app/globals.css](app/globals.css):
- Lines 66–71 (`.react-grid-layout:has(.react-draggable-dragging) .react-grid-item:not(.react-draggable-dragging) { filter: blur... }`): drop in fluid mode — incompatible with "everything reflows visibly during drag." Scope behind `:not([data-fluid-flow])`.
- Line 14–23 (`.react-grid-item { transition: all 400ms... }`): keep, but the transition is what makes reflow look good. Verify it doesn't conflict with the drag-stop reflow timing.

## Phase plan

Each phase is independently shippable and verifiable.

### Phase 1 — Fix `flowLayout()` (foundational)
- Rewrite `flowLayout()` per the bug list above
- Pure function, no UI changes
- Add unit tests in `lib/__tests__/dashboard-animation-utils.test.ts`:
  - 5 charts of `w=2` fit in one row of 12 cols
  - Chart wider than remaining row width wraps
  - Tall chart sets row height; following short charts wrap below tallest, not below shortest
  - `minW` clamp respected
  - `w > 12` clamped to 12
  - Empty input returns empty
  - Order preserved exactly
- **Done when:** all unit tests pass; no behavioral change visible in app yet (function not yet wired in)

### Phase 2 — Wire reflow into mutation paths
- Centralize the five mutation paths through `applyMutation`
- Update `handleDragStop`, `handleResizeStop`, `handleChartSelected`, widget-add paths, `removeComponent`
- Update view mode to reflow on render
- Flip RGL config: `compactType={null}`, `preventCollision={false}`
- Remove/obsolete `findOptimalPosition` callsite
- **Done when:** dragging a chart from row 2 to row 1 results in correct sequential reflow; deleting a chart closes the gap; resizing a chart shifts neighbors; view mode renders identical to edit mode

### Phase 3 — Insertion-line drag UX
- Add `<InsertionLine>` component
- Compute insert index from cursor in `onDrag`
- Hide RGL's default placeholder via `data-fluid-flow` attribute
- Drop the blur-other-charts CSS rule in fluid mode
- **Done when:** dragging shows a clear blue line where chart will land; release commits at that index; no drag-jump

### Phase 4 — Edge case hardening
- Test: 50+ charts, drag performance acceptable
- Test: real-time chart data updates during drag don't cause jumps (freeze constraint updates while `isDraggingRef.current === true`)
- Test: undo/redo with reflow (skip reflow when `isUndoRedoOperation === true`; the snapshots already contain the correct flowed (x,y))
- Test: filter widgets and text components participate correctly in reflow
- Manual QA pass on representative dashboards
- **Done when:** no regressions across normal dashboard sizes and content types

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Drag-jump (previous attempt's failure mode) | Reflow only on drag-stop, not during drag. Insertion-line overlay handles "where will it land" feedback. |
| Resize-jump (corner handle disconnects) | Reflow only on resize-stop, not during resize. |
| Loop: setState in onLayoutChange triggers another onLayoutChange | Deep-equality check before setState; `setStateWithoutHistory` for interactive flows. |
| Real-time chart data updates change height mid-drag | Freeze constraint-driven height updates while `isDraggingRef.current === true`. |
| Old dashboards have non-flowed (x,y) coordinates | First load → first edit reflows. Or run a one-time migration on dashboard load that reflows and saves. (Decision deferred to plan stage.) |
| Tall chart + short charts in same row leaves whitespace | By design — documented behavior. Users learn it like text-flow. |
| 50+ charts, transition lag | RAF-throttle reflow if needed; but flow algorithm is O(n), not the bottleneck. |

## Decisions (resolved 2026-05-06)

1. **Legacy dashboards:** Lazy reflow. Existing dashboards render with their stored `(x, y)` until the user makes any of the five mutations, at which point reflow runs and the new layout is saved on next persist. No data migration needed.
2. **"Smart Pack" / "Auto Arrange" button:** Remove in Phase 2. Redundant once fluid flow is always on.
3. **Mobile / narrow viewport:** Out of scope. In production, mobile users typically view a single-chart dashboard and do not enter edit mode — current behavior (12 cols always, charts shrink in pixels) is acceptable. Flag in PR description.

## Success criteria

A user can:
- [ ] Drag a chart from the last row to the top — all other charts shift right and wrap as expected
- [ ] Resize a chart wider — neighbors shift right, last in row wraps down
- [ ] Resize a chart smaller — neighbors shift left to close the gap
- [ ] Delete a chart — gap closes, next-row chart pulls up
- [ ] Add a new chart — it appends at the end, reflowed into place
- [ ] See an insertion line during drag indicating where the chart will land
- [ ] Open an old dashboard — it renders identically to today; first edit triggers clean reflow
- [ ] Use undo/redo and see the reflowed layout, not the raw mutation
- [ ] Use the dashboard in view (read-only) mode — same layout as edit mode

No regressions in chart selection, filtering, text components, screen-size preview, or save/load.

## Files touched (summary)

- `lib/dashboard-animation-utils.ts` — fix `flowLayout()`; remove obsolete `findOptimalPosition`, `packLayout`, `distributeLayout`, `autoArrangeComponents` (Phase 2 cleanup)
- `lib/__tests__/dashboard-animation-utils.test.ts` — new unit test file
- `components/dashboard/dashboard-builder-v2.tsx` — centralize mutations through `applyMutation`; flip RGL config; add `<InsertionLine>`; gate live constraint updates on `isDraggingRef`
- `components/dashboard/dashboard-native-view.tsx` — reflow on render
- `components/dashboard/InsertionLine.tsx` — new component
- `app/globals.css` — scope placeholder & blur rules behind `:not([data-fluid-flow])`

No new dependencies. No backend changes. No data migrations.
