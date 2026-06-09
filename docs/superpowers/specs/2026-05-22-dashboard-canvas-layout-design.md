# Dashboard Canvas Layout — Design Spec

**Date:** 2026-05-22
**Linear:** [DALGO-1219](https://linear.app/dalgo/issue/DALGO-1219/dashboard-canvas-fluid-layout)
**Status:** Draft — for Thu/Fri working session
**Supersedes:** [2026-05-06 fluid row flow](2026-05-06-dashboard-fluid-row-flow-design.md)

---

## Problem

Authors can't build the layouts they want; viewers see inconsistent results. Specific bugs from DALGO-1219:

1. Can't place a short chart **below** another short chart when both sit beside a tall chart.
2. Drag from bottom to top doesn't autoscroll; inserts in the wrong row.
3. The blue insertion line appears in unpredictable positions.
4. Behavior overall isn't predictable.

**Root cause.** The fluid-row-flow model forces array order to determine visual position. Users think visually; the mismatch produces every reported bug.

---

## Decision

Switch to a **predictable grid with auto-compact**, the model used by Grafana, Metabase, Datadog, and Retool.

Each widget owns its `(x, y, w, h)`. The only automatic behavior is **gravity-up**: a widget slides up if there's empty space directly above it.

This is what `react-grid-layout` does by default. The current branch turns it off and re-derives positions from array order. We turn it back on.

---

## The Model — One Rule

> A dashboard is a set of widgets. Each widget has `(x, y, w, h)` in grid units on a 12-column grid. **Each widget remembers its own position.** The only automatic behavior is gravity-up: if there is empty space above a widget, the widget slides up to close it. Nothing else moves on its own.

That is the entire behavioral contract.

---

## Behavior

| Action | What happens |
|---|---|
| **Add widget** | Lands at the bottom of the canvas, full-width. User drags & resizes from there. |
| **Drag widget** | Ghost outline follows the cursor, snapped to grid cells. Widgets in the outline's path slide **down** (cascading). On drop, widget lands at the outline. Gravity-up compacts after. |
| **Resize wider / taller** | Widget grows from the drag edge. If it overlaps a neighbor, the neighbor slides **down**. The widget's `x` never changes. |
| **Resize narrower / shorter** | Widget shrinks. Anything directly below slides up. |
| **Delete widget** | Widget removed. Anything below slides up. Widgets to the side stay where they are. |
| **Drag near canvas edge** | Canvas autoscrolls so user can reach top/bottom. |
| **"Compact" toolbar action** | One-time vertical compaction across the whole canvas. Manual, not automatic. |

**Not automatic:**
- No swapping, reordering, or array-order-based reflow.
- No horizontal pushing — neighbors only move vertically.
- No wrapping when resizing wider — the widget hits the grid edge and stops.
- Empty horizontal bands are permitted. The user closes them with Compact or by dragging.

---

## Test Cases (the contract)

Each must pass with an NGO author who has **not** been trained. They should predict the outcome **before** acting.

1. **Add a new chart, then move it second-from-top, full-width.**
   - New chart appears at the bottom.
   - User drags up. Ghost outline shows the landing spot.
   - Charts below the drop slide down.

2. **Move a bottom-row chart to the empty space next to the top-left tall chart.**
   - Canvas autoscrolls during the drag.
   - Ghost outline targets the empty cell.
   - Chart lands there. Nothing else reorganizes.

3. **Make a small chart taller until it matches the chart next to it.**
   - The resized chart grows downward.
   - Nothing else moves (no neighbor was in its growth path).

4. **Delete the chart in the middle of row 2.**
   - Chart removed.
   - Charts to the right do **not** shift left.
   - Anything directly below slides up.

5. **Place a chart in the empty band below a short chart that sits next to a tall chart.**
   - Drag, see ghost outline targeting that empty cell, drop, done.

6. **Click "Compact dashboard."**
   - Every widget slides up as far as it can.
   - Horizontal bands close.

**If a user is surprised by any outcome, the model is wrong, not the user.**

---

## Mobile

The model works for mobile in two paths — pick the right one when we're ready to invest.

**Path A (today's behavior, no change).** A dashboard is authored for a fixed `target_screen_size`. On any viewport, the 12 columns just scale down proportionally. Charts at 375px width are tiny but legible enough for many use cases. This is what we have now; the new model preserves it.

**Path B (real responsive, future).** At the narrowest breakpoint, collapse to 1 column. Widgets stack vertically in **reading order: top-to-bottom, then left-to-right derived from `(y, x)`**. This matches what the user sees on the desktop layout. `react-grid-layout` supports per-breakpoint layouts natively, so no model change is required — just a new layout produced from the desktop one.

Worth flagging: the previous fluid-flow model claimed array-order = reading-order. The grid model uses `(y, x)`, which actually matches the on-screen position. Mobile reflow is therefore **more** predictable in this model than the one it replaces.

---

## Edge Cases

| Case | Expected behavior |
|---|---|
| **Text widget grows while typing** | If the new height would overlap a neighbor below, freeze the size update while the editor has focus; apply on blur. Avoids mid-keystroke layout jumps. |
| **Chart data changes height at runtime** (e.g., new rows in a table) | Defer the height update during an active drag/resize. Apply on next idle frame. |
| **Resize widens onto two neighbors** | Both neighbors push down. RGL handles this natively. |
| **Drag cancel (Esc key)** | Restores both the dragged widget and any pushed neighbors to pre-drag positions. |
| **"Compact" toolbar action** | Single undo history entry, not N. One mutation, one undo. |
| **Widget can't fit due to `minW` / `minH`** | Ghost outline shows rejected (red or hidden); drop snaps the widget back. |
| **Very tall dashboards (50+ widgets)** | Delete or compact may animate many widgets at once. Use CSS-transform-based animations (GPU) to keep it smooth. |
| **Autoscroll velocity** | Proportional to cursor distance from canvas edge, capped (~30px/frame) to prevent runaway scroll. |

---

## Out of Scope

- True responsive reflow at narrow widths (Path B in Mobile section above) — design for it when we invest in mobile.
- Container / row primitives for nested layouts (Tableau-style).
- Multiplayer concurrent editing (lock-based exclusivity already in place).
- Filter-state conditional rendering (Grafana 12 feature; not needed yet).

---

## Success Criteria

- All six test cases pass without user confusion.
- All four bugs in DALGO-1219 are resolved.
- No empty rows between widgets unless the user creates them.
- Existing dashboards load and render correctly; first edit reflows once.
- Net code change: removal, not addition.
