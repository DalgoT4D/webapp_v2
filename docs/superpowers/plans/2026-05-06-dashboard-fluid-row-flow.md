# Dashboard Fluid Row Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dashboard charts reflow like text in a word processor — every add, delete, resize, or move re-packs charts left-to-right, wrapping to the next row when full, with no whitespace between rows.

**Architecture:** The array order in `state.layout` becomes the source of truth for chart sequence. `(x, y)` is derived state computed by a fixed `flowLayout()` before every render and persist. All five mutation paths funnel through one `applyMutation()` helper. RGL becomes a "dumb positioning shell" — its own collision logic disabled. Drag UX shows an insertion-line overlay during the gesture; reflow runs only on drag/resize *stop*, never mid-gesture (this is the fix for the previous attempt's drag-jump bug).

**Tech Stack:** Next.js 15, React 19, TypeScript, react-grid-layout v1.5.2, Jest + React Testing Library, Tailwind v4, existing Zustand auth store.

**Reference spec:** [docs/superpowers/specs/2026-05-06-dashboard-fluid-row-flow-design.md](../specs/2026-05-06-dashboard-fluid-row-flow-design.md)

**Note on commits:** This plan includes commit steps at end of each task as recommended discipline. The user has a standing preference for no auto-commits — confirm before each commit step or stash + skip per their direction.

---

## File Structure

### New files

- `lib/__tests__/dashboard-animation-utils.test.ts` — Jest unit tests for `flowLayout()` and `applyMutation()`. Pure-function tests, no React or RGL dependency.
- `components/dashboard/InsertionLine.tsx` — Pure presentational component. Renders a 2px blue vertical bar at given grid coordinates during drag. Receives position via props from the parent.

### Modified files

- `lib/dashboard-animation-utils.ts` — Rewrite `flowLayout()` to fix fractional-spacing bug, drop `spacingPx` param, treat array order as source of truth. Add new `applyMutation<T>()` helper. Delete obsolete: `packLayout`, `distributeLayout`, `autoArrangeComponents`, `findOptimalPosition`, `AutoArrangeOptions`, `AUTO_ARRANGE_PRESETS`. Keep snap/space-making functions for now (used elsewhere).
- `hooks/useDashboardAnimation.ts` — Remove `findBestPosition` and `arrangeComponents` methods (callsites in builder go away). Keep the rest of the hook intact.
- `components/dashboard/dashboard-builder-v2.tsx` — Centralize five mutation paths through `applyMutation`. Flip RGL config (`compactType={null}`, `preventCollision={false}`). Add `data-fluid-flow` attribute to GridLayout. Mount `<InsertionLine>` during drag. Compute insertion index from cursor on `onDrag`. Remove `originalPositionsRef` and `draggedItemRef` machinery (the previous attempt's residue). Gate constraint updates on `isDraggingRef`. Remove Smart Pack button.
- `components/dashboard/dashboard-native-view.tsx` — Run `flowLayout()` on render so view-mode reflows legacy and current layouts identically.
- `app/globals.css` — Scope placeholder & blur rules behind `:not([data-fluid-flow])` so they only apply outside fluid mode.

### Type contract

The fluid-mode flow function is generic so it works with any object that has `w`/`h` (and optionally `minW`/`minH`/`maxW`/`maxH`):

```typescript
type FluidFlowItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
};

function flowLayout<T extends FluidFlowItem>(items: T[], gridCols: number): T[];
function applyMutation<T extends FluidFlowItem>(layout: T[], mutate: (l: T[]) => T[], gridCols: number): T[];
```

---

## Phase 1 — Fix `flowLayout()` (foundation)

### Task 1: Set up unit tests for `flowLayout`

**Files:**
- Create: `lib/__tests__/dashboard-animation-utils.test.ts`

- [ ] **Step 1: Verify test infrastructure**

Run: `cd /Users/himanshut4d/Documents/Tech4dev/Dalgo/webapp_v2_ingest/.worktrees/dashboard-fluid-row-flow && ls lib/__tests__/ 2>/dev/null && echo "exists" || echo "create dir"`

If "create dir": `mkdir lib/__tests__`

- [ ] **Step 2: Create the test file with all cases**

Write to `lib/__tests__/dashboard-animation-utils.test.ts`:

```typescript
import { flowLayout } from '../dashboard-animation-utils';

type Item = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number; maxW?: number; maxH?: number };
const item = (i: string, w: number, h: number, extra: Partial<Item> = {}): Item => ({ i, x: 0, y: 0, w, h, ...extra });

describe('flowLayout', () => {
  it('packs 5 charts of w=2 into a single row of 12 cols (no premature wrap)', () => {
    const items = [item('a', 2, 1), item('b', 2, 1), item('c', 2, 1), item('d', 2, 1), item('e', 2, 1)];
    const result = flowLayout(items, 12);
    expect(result.map(r => r.x)).toEqual([0, 2, 4, 6, 8]);
    expect(result.map(r => r.y)).toEqual([0, 0, 0, 0, 0]);
  });

  it('wraps to next row when chart does not fit', () => {
    const items = [item('a', 6, 1), item('b', 6, 1), item('c', 6, 1)];
    const result = flowLayout(items, 12);
    expect(result.map(r => ({ x: r.x, y: r.y }))).toEqual([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 0, y: 1 },
    ]);
  });

  it('uses tallest item as row height; next row starts below tallest', () => {
    const items = [item('kpi1', 3, 1), item('kpi2', 3, 1), item('table', 3, 4), item('next', 3, 1)];
    const result = flowLayout(items, 12);
    expect(result[0]).toMatchObject({ x: 0, y: 0 });
    expect(result[1]).toMatchObject({ x: 3, y: 0 });
    expect(result[2]).toMatchObject({ x: 6, y: 0 });
    expect(result[3]).toMatchObject({ x: 9, y: 0 });
  });

  it('next row starts below the tallest item of the previous row', () => {
    const items = [item('table', 6, 4), item('kpi', 6, 1), item('next', 6, 1)];
    const result = flowLayout(items, 12);
    expect(result[0]).toMatchObject({ x: 0, y: 0 });
    expect(result[1]).toMatchObject({ x: 6, y: 0 });
    expect(result[2]).toMatchObject({ x: 0, y: 4 });
  });

  it('clamps w to minW when w is below minW', () => {
    const items = [item('a', 2, 1, { minW: 4 })];
    const result = flowLayout(items, 12);
    expect(result[0].w).toBe(4);
    expect(result[0].x).toBe(0);
  });

  it('clamps w to grid width when w exceeds gridCols', () => {
    const items = [item('a', 14, 1)];
    const result = flowLayout(items, 12);
    expect(result[0].w).toBe(12);
    expect(result[0].x).toBe(0);
  });

  it('clamps h to minH when h is below minH', () => {
    const items = [item('a', 4, 1, { minH: 2 })];
    const result = flowLayout(items, 12);
    expect(result[0].h).toBe(2);
  });

  it('returns empty array for empty input', () => {
    expect(flowLayout([], 12)).toEqual([]);
  });

  it('preserves array order regardless of (x, y) input', () => {
    // Items deliberately given out-of-order coords; flowLayout should NOT re-sort
    const items = [
      item('first', 3, 1, { x: 9, y: 5 }),
      item('second', 3, 1, { x: 0, y: 0 }),
      item('third', 3, 1, { x: 3, y: 0 }),
    ];
    const result = flowLayout(items, 12);
    expect(result.map(r => r.i)).toEqual(['first', 'second', 'third']);
    expect(result.map(r => r.x)).toEqual([0, 3, 6]);
  });

  it('does not mutate input array', () => {
    const items = [item('a', 4, 1, { x: 99, y: 99 })];
    const snapshot = JSON.parse(JSON.stringify(items));
    flowLayout(items, 12);
    expect(items).toEqual(snapshot);
  });

  it('preserves all non-positional fields (minW, maxH, custom keys)', () => {
    const items = [item('a', 4, 1, { minW: 2, maxW: 8, minH: 1, maxH: 3 })];
    const result = flowLayout(items, 12);
    expect(result[0]).toMatchObject({ minW: 2, maxW: 8, minH: 1, maxH: 3 });
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `npm run test -- lib/__tests__/dashboard-animation-utils.test.ts`

Expected: Several tests fail. Specifically, the "5 charts of w=2" test fails because of the fractional-spacing bug; the "preserves array order" test fails because the current impl sorts by `(y, x)`; the minW/maxW/clamp tests fail because the current impl ignores those fields.

- [ ] **Step 4: Commit failing tests**

```bash
git add lib/__tests__/dashboard-animation-utils.test.ts
git commit -m "test: add failing flowLayout unit tests for fluid row flow"
```

---

### Task 2: Rewrite `flowLayout` to make all tests pass

**Files:**
- Modify: `lib/dashboard-animation-utils.ts:309–344`

- [ ] **Step 1: Replace the `flowLayout` function**

In `lib/dashboard-animation-utils.ts`, replace lines 306–344 (the `flowLayout` function and its docstring) with:

```typescript
/**
 * Type for any item that participates in fluid row flow.
 * Generic so callers can pass richer objects (e.g. RGL Layout items with i/static/etc).
 */
export type FluidFlowItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
};

/**
 * Flow algorithm — arrange items left-to-right, wrap to next row when full.
 *
 * Contract:
 *   - Array order is the source of truth for sequence (input order preserved in output).
 *   - (x, y) is recomputed; w and h are clamped to constraints.
 *   - Row height = tallest item in that row. Next row starts at cumulative_y + max_h.
 *   - All non-positional fields are passed through unchanged.
 *
 * Pure function: does not mutate input.
 */
export function flowLayout<T extends FluidFlowItem>(items: T[], gridCols: number): T[] {
  const result: T[] = [];
  let currentX = 0;
  let currentY = 0;
  let rowHeight = 0;

  for (const original of items) {
    // Clamp dimensions to constraints. minW takes precedence over gridCols mismatch
    // (if minW > gridCols, we still clamp to gridCols to render anything at all).
    const minW = original.minW ?? 1;
    const maxW = original.maxW ?? gridCols;
    const minH = original.minH ?? 1;
    const maxH = original.maxH ?? Number.POSITIVE_INFINITY;

    const w = Math.min(gridCols, Math.max(minW, Math.min(maxW, original.w)));
    const h = Math.max(minH, Math.min(maxH, original.h));

    // Wrap to next row if this item won't fit horizontally
    if (currentX + w > gridCols) {
      currentY += rowHeight;
      currentX = 0;
      rowHeight = 0;
    }

    result.push({ ...original, x: currentX, y: currentY, w, h });

    currentX += w;
    if (h > rowHeight) rowHeight = h;
  }

  return result;
}
```

- [ ] **Step 2: Run tests, verify they pass**

Run: `npm run test -- lib/__tests__/dashboard-animation-utils.test.ts`

Expected: All 11 tests pass.

- [ ] **Step 3: Commit the fix**

```bash
git add lib/dashboard-animation-utils.ts
git commit -m "fix(dashboard): rewrite flowLayout to use array-order source of truth and respect constraints"
```

---

## Phase 2 — Wire reflow into mutation paths

### Task 3: Add `applyMutation` helper

**Files:**
- Modify: `lib/dashboard-animation-utils.ts` (add new export)
- Modify: `lib/__tests__/dashboard-animation-utils.test.ts` (add test cases)

- [ ] **Step 1: Add tests for `applyMutation`**

Append to `lib/__tests__/dashboard-animation-utils.test.ts`:

```typescript
import { applyMutation } from '../dashboard-animation-utils';

describe('applyMutation', () => {
  const items = [item('a', 4, 1), item('b', 4, 1), item('c', 4, 1)];

  it('runs the mutation function then reflows', () => {
    const result = applyMutation(items, (l) => l.filter((i) => i.i !== 'b'), 12);
    expect(result.map((r) => r.i)).toEqual(['a', 'c']);
    expect(result.map((r) => r.x)).toEqual([0, 4]);
  });

  it('does not mutate the original array', () => {
    const snapshot = JSON.parse(JSON.stringify(items));
    applyMutation(items, (l) => [...l, item('d', 4, 1)], 12);
    expect(items).toEqual(snapshot);
  });

  it('appends new items at the correct flowed position', () => {
    const result = applyMutation(items, (l) => [...l, item('d', 4, 1)], 12);
    expect(result.find((r) => r.i === 'd')).toMatchObject({ x: 0, y: 1 }); // wraps to next row
  });
});
```

- [ ] **Step 2: Add `applyMutation` to `lib/dashboard-animation-utils.ts`**

Add immediately after the `flowLayout` function:

```typescript
/**
 * Run a mutation against a layout array, then reflow.
 * Use this for every state change to keep storage and rendering in sync.
 *
 * @example
 *   setLayout(applyMutation(layout, (l) => l.filter((i) => i.i !== id), 12));
 */
export function applyMutation<T extends FluidFlowItem>(
  layout: T[],
  mutate: (l: T[]) => T[],
  gridCols: number
): T[] {
  return flowLayout(mutate(layout), gridCols);
}
```

- [ ] **Step 3: Run tests**

Run: `npm run test -- lib/__tests__/dashboard-animation-utils.test.ts`

Expected: All tests pass (the original 11 from Task 2 + 3 new for `applyMutation` = 14).

- [ ] **Step 4: Commit**

```bash
git add lib/dashboard-animation-utils.ts lib/__tests__/dashboard-animation-utils.test.ts
git commit -m "feat(dashboard): add applyMutation helper for fluid-flow state changes"
```

---

### Task 4: Wire reflow into chart-add path

**Files:**
- Modify: `components/dashboard/dashboard-builder-v2.tsx` around line 1238 (`handleChartSelected`)

- [ ] **Step 1: Add the import**

In `components/dashboard/dashboard-builder-v2.tsx`, find the existing `dashboard-animation-utils` imports (search for `dashboard-animation-utils`). Add `applyMutation` to the import. If there's no existing import block from that file, add:

```typescript
import { applyMutation } from '@/lib/dashboard-animation-utils';
```

- [ ] **Step 2: Define a constant for the grid column count**

Near the top of the file (with other constants, search for `const ROW_HEIGHT` or `const GRID_COLS`), ensure there's a single constant:

```typescript
// Grid is fixed at 12 columns regardless of viewport (Superset-style); fluid-row-flow honors this.
const FLUID_GRID_COLS = 12;
```

If a similar constant already exists, reuse it instead of duplicating.

- [ ] **Step 3: Replace `findBestPosition` usage in `handleChartSelected`**

Locate the `handleChartSelected` callback (around line 1238). The current code looks like:

```typescript
const position = dashboardAnimation.findBestPosition(defaultDimensions, state.layout);
const newItem = { i: chartKey, ...position, ...defaultDimensions, /* etc */ };
setState({ ...state, layout: [...state.layout, newItem], components: { ...state.components, [chartKey]: chart } });
```

Replace with:

```typescript
// Fluid row flow: append at end of ordered list and reflow. Position is derived.
const newItem = {
  i: chartKey,
  x: 0,
  y: 0,
  ...defaultDimensions,
  // preserve any minW/minH/maxW the chart type provides
};
setState({
  ...state,
  layout: applyMutation(state.layout, (l) => [...l, newItem], FLUID_GRID_COLS),
  components: { ...state.components, [chartKey]: chart },
});
```

(Verify the exact shape of `defaultDimensions`, `chartKey`, `chart`, and the existing `setState` call before editing — keep all other side effects untouched.)

- [ ] **Step 4: Verify it builds**

Run: `npm run build 2>&1 | tail -20`

Expected: No TypeScript errors related to your edit.

- [ ] **Step 5: Manual sanity check in dev**

Run dev server, open a dashboard, add a new chart. Expected: chart appears at end of list, all charts repack into proper rows. (No live reflow yet — that comes after all paths wired.)

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/dashboard-builder-v2.tsx
git commit -m "feat(dashboard): wire chart-add path through applyMutation"
```

---

### Task 5: Wire reflow into text/widget add paths

**Files:**
- Modify: `components/dashboard/dashboard-builder-v2.tsx` around line 1308 (`addTextComponent`) and any sibling `add*Component` paths

- [ ] **Step 1: Find all "add*Component" callbacks**

Run: `grep -n "const add[A-Z][a-zA-Z]*Component\|const handleFilter[A-Z]" components/dashboard/dashboard-builder-v2.tsx | head -20`

Note each callback name and line number for use in the next step.

- [ ] **Step 2: Replace `findBestPosition` in each**

For each `add*Component` callback found above, locate the `findBestPosition` line (or equivalent positional placement logic) and replace it with the same `applyMutation` pattern from Task 4 — append the new widget to the array, let reflow handle position.

Example for `addTextComponent` (~L1308):

```typescript
// BEFORE
const position = dashboardAnimation.findBestPosition(textDimensions, state.layout);
const newTextItem = { i: textKey, ...position, ...textDimensions };
setState({ ...state, layout: [...state.layout, newTextItem], /* ... */ });

// AFTER
const newTextItem = { i: textKey, x: 0, y: 0, ...textDimensions };
setState({
  ...state,
  layout: applyMutation(state.layout, (l) => [...l, newTextItem], FLUID_GRID_COLS),
  /* preserve all other state updates */
});
```

- [ ] **Step 3: Build check**

Run: `npm run build 2>&1 | tail -20`

Expected: No TS errors from these edits.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/dashboard-builder-v2.tsx
git commit -m "feat(dashboard): wire widget-add paths through applyMutation"
```

---

### Task 6: Wire reflow into removeComponent

**Files:**
- Modify: `components/dashboard/dashboard-builder-v2.tsx` around line 1341 (`removeComponent`)

- [ ] **Step 1: Locate `removeComponent`**

Run: `grep -n "const removeComponent\|removeComponent =" components/dashboard/dashboard-builder-v2.tsx | head -5`

- [ ] **Step 2: Wrap the layout filter in `applyMutation`**

Locate the body of `removeComponent`. The current pattern likely splices/filters the layout. Replace with:

```typescript
const removeComponent = useCallback((id: string) => {
  setState((prev) => ({
    ...prev,
    layout: applyMutation(prev.layout, (l) => l.filter((item) => item.i !== id), FLUID_GRID_COLS),
    components: Object.fromEntries(
      Object.entries(prev.components).filter(([k]) => k !== id)
    ),
  }));
}, [/* keep existing deps */]);
```

(Match the existing `removeComponent` signature and side effects exactly. The point is just to wrap the layout array transform in `applyMutation`.)

- [ ] **Step 3: Manual sanity check**

In dev, delete a chart from the middle of a row. Expected: chart disappears, neighbors shift left, and (if next row had a chart that now fits) the next-row chart pulls up.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/dashboard-builder-v2.tsx
git commit -m "feat(dashboard): wire removeComponent through applyMutation for gap-closing"
```

---

### Task 7: Wire reflow into handleResizeStop

**Files:**
- Modify: `components/dashboard/dashboard-builder-v2.tsx` around line 1096 (`handleResizeStop`)

- [ ] **Step 1: Locate `handleResizeStop`**

Run: `grep -n "const handleResizeStop\|handleResizeStop =" components/dashboard/dashboard-builder-v2.tsx`

- [ ] **Step 2: Replace the body to apply new w/h then reflow**

Replace the body to find the resized item, write the new w/h, and run `applyMutation`:

```typescript
const handleResizeStop: ItemCallback = useCallback(
  (currentLayout, oldItem, newItem) => {
    setState((prev) => ({
      ...prev,
      layout: applyMutation(
        prev.layout,
        (l) => l.map((item) => (item.i === newItem.i ? { ...item, w: newItem.w, h: newItem.h } : item)),
        FLUID_GRID_COLS
      ),
    }));
    // If there's existing isResizingRef cleanup, keep it.
  },
  [/* keep existing deps */]
);
```

- [ ] **Step 3: During `handleResize` (mid-gesture), DO NOT call applyMutation**

Find `handleResize` (mid-gesture, fires repeatedly). Confirm it does **not** call `applyMutation`. If it currently writes to layout, leave that as-is — the resize-stop will rewrite to the canonical reflowed positions on release. The point is: only the *stop* path reflows, never the during-gesture path.

- [ ] **Step 4: Manual sanity check**

In dev, resize a chart wider so it would push a neighbor off the row. Expected: during the drag the chart resizes freely (RGL's default behavior); on release, layout reflows so the displaced neighbor wraps to the next row.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/dashboard-builder-v2.tsx
git commit -m "feat(dashboard): reflow on resize-stop, preserve free-resize during gesture"
```

---

### Task 8: Wire reflow into handleDragStop, remove originalPositionsRef machinery

**Files:**
- Modify: `components/dashboard/dashboard-builder-v2.tsx` lines 968 (`handleDragStart`), 1006–1074 (`handleDragStop`), and search for `originalPositionsRef` / `draggedItemRef` usages

- [ ] **Step 1: Locate the drag refs**

Run: `grep -n "originalPositionsRef\|draggedItemRef\|isDraggingRef" components/dashboard/dashboard-builder-v2.tsx`

- [ ] **Step 2: Simplify `handleDragStart`**

The current `handleDragStart` snapshots all positions to `originalPositionsRef` to prevent RGL's collision cascade. With fluid flow, that machinery is unnecessary — RGL's collision is disabled (next task) and reflow restores order on stop.

Replace with:

```typescript
const handleDragStart: ItemCallback = useCallback((_layout, _oldItem, _newItem) => {
  isDraggingRef.current = true;
  // No position snapshotting needed; reflow on stop is the source of truth.
  // `newItem.i` is also available via RGL callbacks during drag if needed elsewhere — no ref needed.
}, []);
```

- [ ] **Step 3: Rewrite `handleDragStop`**

Replace the body of `handleDragStop`. The new logic: compute target index from cursor position (or the dropped position the new item ended up at), remove from old index, insert at new index, reflow.

```typescript
const handleDragStop: ItemCallback = useCallback(
  (_currentLayout, _oldItem, newItem) => {
    isDraggingRef.current = false;

    setState((prev) => {
      const targetIndex = computeInsertionIndex(prev.layout, newItem, FLUID_GRID_COLS);
      return {
        ...prev,
        layout: applyMutation(
          prev.layout,
          (l) => moveItemToIndex(l, newItem.i, targetIndex),
          FLUID_GRID_COLS
        ),
      };
    });
  },
  [/* keep existing deps */]
);
```

- [ ] **Step 4: Add `computeInsertionIndex` and `moveItemToIndex` helpers**

In the same file (top-level, before the component) or — preferably — in `lib/dashboard-animation-utils.ts` so they're testable:

```typescript
// Add to lib/dashboard-animation-utils.ts after applyMutation:

/**
 * Given the *current flowed layout* and a newly-positioned item (from RGL drag),
 * compute the linear index at which the dragged item should be inserted.
 * Strategy: walk the array in flow order, find the first item whose *center*
 * is to the right of or below the dragged item's top-left.
 */
export function computeInsertionIndex<T extends FluidFlowItem>(
  layout: T[],
  draggedItem: { i: string; x: number; y: number },
  _gridCols: number
): number {
  const others = layout.filter((it) => it.i !== draggedItem.i);
  for (let idx = 0; idx < others.length; idx++) {
    const o = others[idx];
    const oCenterY = o.y + o.h / 2;
    // Cursor is on or above this item's mid-row AND to the left of its right edge → insert here
    if (draggedItem.y < oCenterY || (draggedItem.y < o.y + o.h && draggedItem.x < o.x + o.w / 2)) {
      return idx;
    }
  }
  return others.length;
}

/**
 * Reorder: remove item with given id from layout, insert at targetIndex (in the
 * post-removal array). targetIndex of `layout.length - 1` appends at end.
 */
export function moveItemToIndex<T extends FluidFlowItem>(
  layout: T[],
  id: string,
  targetIndex: number
): T[] {
  const item = layout.find((it) => it.i === id);
  if (!item) return layout;
  const without = layout.filter((it) => it.i !== id);
  const clamped = Math.max(0, Math.min(targetIndex, without.length));
  return [...without.slice(0, clamped), item, ...without.slice(clamped)];
}
```

Add quick unit tests for these in `lib/__tests__/dashboard-animation-utils.test.ts`:

```typescript
import { moveItemToIndex, computeInsertionIndex } from '../dashboard-animation-utils';

describe('moveItemToIndex', () => {
  const items = [item('a', 3, 1), item('b', 3, 1), item('c', 3, 1), item('d', 3, 1)];

  it('moves first to last', () => {
    expect(moveItemToIndex(items, 'a', 3).map((i) => i.i)).toEqual(['b', 'c', 'd', 'a']);
  });
  it('moves last to first', () => {
    expect(moveItemToIndex(items, 'd', 0).map((i) => i.i)).toEqual(['d', 'a', 'b', 'c']);
  });
  it('returns same array if id not found', () => {
    expect(moveItemToIndex(items, 'z', 0)).toEqual(items);
  });
});

describe('computeInsertionIndex', () => {
  // Layout flowed: a(0,0), b(3,0), c(6,0), d(9,0); each w=3,h=1
  const flowed = flowLayout(
    [item('a', 3, 1), item('b', 3, 1), item('c', 3, 1), item('d', 3, 1)],
    12
  );
  it('inserts at index 0 when dragged to far left of row 0', () => {
    expect(computeInsertionIndex(flowed, { i: 'a', x: 0, y: 0 }, 12)).toBe(0);
  });
  it('inserts at end when dragged below all rows', () => {
    expect(computeInsertionIndex(flowed, { i: 'a', x: 0, y: 99 }, 12)).toBe(3);
  });
});
```

- [ ] **Step 5: Run unit tests**

Run: `npm run test -- lib/__tests__/dashboard-animation-utils.test.ts`

Expected: all pass.

- [ ] **Step 6: Remove `originalPositionsRef` and the snapshot/restore logic**

Search for all references and delete: declarations, calls to populate it, the magnetic-snap-on-drop and snap-back-on-collision logic that uses it.

```bash
grep -n "originalPositionsRef\|draggedItemRef" components/dashboard/dashboard-builder-v2.tsx
# Delete each reference. Keep isDraggingRef.
```

- [ ] **Step 7: Build + manual sanity check**

Run `npm run build` then test in dev: drag a chart from row 2 to row 1. Expected: on release, ordering changes; row 1 charts shift right; one wraps to row 2.

- [ ] **Step 8: Commit**

```bash
git add components/dashboard/dashboard-builder-v2.tsx lib/dashboard-animation-utils.ts lib/__tests__/dashboard-animation-utils.test.ts
git commit -m "feat(dashboard): reflow on drag-stop with insertion-index computation; remove originalPositionsRef machinery"
```

---

### Task 9: Reflow on render in dashboard-native-view

**Files:**
- Modify: `components/dashboard/dashboard-native-view.tsx` around line 1186 (the GridLayout/`Responsive` render block)

- [ ] **Step 1: Locate the layout consumption point**

Run: `grep -n "modifiedLayout\|layout_config\|<GridLayout\|<Responsive" components/dashboard/dashboard-native-view.tsx | head -10`

- [ ] **Step 2: Run flowLayout on the layout before passing to RGL**

Find where `modifiedLayout` (or the equivalent variable holding `layout_config`) is computed. Wrap in `useMemo`:

```typescript
import { flowLayout } from '@/lib/dashboard-animation-utils';

// inside the component:
// View mode supports a "preview different screen size" feature, so cols can differ from 12.
// flowLayout takes gridCols as a param and re-flows for whatever value is in use.
const flowedLayout = useMemo(
  () => flowLayout(modifiedLayout, effectiveScreenConfig?.cols ?? 12),
  [modifiedLayout, effectiveScreenConfig?.cols]
);
```

Pass `flowedLayout` to `<GridLayout layout={flowedLayout} ...>` (and to `<Responsive>` if it's used in this file). Also add the `data-fluid-flow="true"` attribute on the `<GridLayout>` here so the CSS scoping introduced in Task 12 also applies to view mode.

- [ ] **Step 3: Manual sanity check**

In dev, view an existing dashboard in read-only mode. Expected: looks identical to edit mode after reflow. Old dashboards that had odd whitespace now render packed.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/dashboard-native-view.tsx
git commit -m "feat(dashboard): flowLayout on render in view mode for consistent rendering"
```

---

### Task 10: Flip RGL config + delete obsolete utilities + remove Smart Pack button

**Files:**
- Modify: `components/dashboard/dashboard-builder-v2.tsx` around line 2222 (`<GridLayout>` JSX)
- Modify: `lib/dashboard-animation-utils.ts` (delete obsolete exports)
- Modify: `hooks/useDashboardAnimation.ts` (remove `findBestPosition`, `arrangeComponents`)

- [ ] **Step 1: Flip RGL props in dashboard-builder-v2**

Locate `<GridLayout ...>` (~L2222). Change:

```diff
  <GridLayout
    className="layout relative z-10"
+   data-fluid-flow="true"
    layout={getAdjustedLayout(state.layout, currentScreenConfig.cols)}
    cols={12}
    rowHeight={30}
    width={actualContainerWidth}
    onLayoutChange={(newLayout) => handleLayoutChange(newLayout, ...)}
    onDragStart={handleDragStart}
    onDrag={handleDrag}
    onDragStop={handleDragStop}
-   compactType="vertical"
+   compactType={null}
-   preventCollision={false}
+   preventCollision={false}
    allowOverlap={false}
    margin={[8, 8]}
    containerPadding={[8, 8]}
    isDraggable={true}
    isResizable={true}
    resizeHandles={['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne']}
  >
```

(`preventCollision` was already `false` per the audit but double-check; `compactType="vertical"` → `null` is the load-bearing change.)

- [ ] **Step 2: Find and remove the Smart Pack / Auto Arrange button**

Run: `grep -n "Smart Pack\|Auto Arrange\|autoArrange\|smartPack" components/dashboard/dashboard-builder-v2.tsx`

Delete the button JSX and any surrounding handler. Remove the call site that invokes `dashboardAnimation.arrangeComponents` or `autoArrangeComponents`.

- [ ] **Step 3: Remove obsolete methods from `hooks/useDashboardAnimation.ts`**

In `hooks/useDashboardAnimation.ts`, remove the imports and methods related to the old algorithms:

```typescript
// REMOVE these from the imports:
//   autoArrangeComponents
//   findOptimalPosition

// REMOVE these methods from the returned object:
//   findBestPosition
//   arrangeComponents
```

If a method is unused after this, remove its definition. Verify nothing else in the codebase imports them:

```bash
grep -rn "findBestPosition\|arrangeComponents" components/ hooks/ app/ 2>/dev/null
```

- [ ] **Step 4: Delete obsolete exports from `lib/dashboard-animation-utils.ts`**

Remove these top-level exports (and their interfaces):
- `packLayout`
- `distributeLayout`
- `autoArrangeComponents`
- `findOptimalPosition`
- `AutoArrangeOptions`
- `AUTO_ARRANGE_PRESETS`

Keep all snap/space-making/collision functions for now (they're used by other parts of the UI like `applyMagneticSnapping`).

- [ ] **Step 5: Build check**

Run: `npm run build 2>&1 | tail -30`

Expected: builds clean. If TS errors point to a deleted export, find the stale callsite and remove it.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/dashboard-builder-v2.tsx hooks/useDashboardAnimation.ts lib/dashboard-animation-utils.ts
git commit -m "refactor(dashboard): flip RGL to dumb-shell mode; remove Smart Pack button and obsolete layout utilities"
```

---

## Phase 3 — Insertion-line drag UX

### Task 11: Create `<InsertionLine>` component

**Files:**
- Create: `components/dashboard/InsertionLine.tsx`

- [ ] **Step 1: Write the component**

Write to `components/dashboard/InsertionLine.tsx`:

```tsx
'use client';

interface InsertionLineProps {
  /** Pixel x position of the line within the GridLayout container */
  pixelX: number;
  /** Pixel y position of the top of the line */
  pixelY: number;
  /** Pixel height of the line (typically the height of a row) */
  pixelHeight: number;
  /** Whether the line should be visible */
  visible: boolean;
}

/**
 * Vertical 2px blue bar shown during drag to indicate where the chart will land.
 * Positioned absolutely within its parent (the GridLayout container).
 * Uses var(--primary) so it picks up the Dalgo brand teal in light/dark mode.
 */
export function InsertionLine({ pixelX, pixelY, pixelHeight, visible }: InsertionLineProps) {
  if (!visible) return null;
  return (
    <div
      data-testid="fluid-flow-insertion-line"
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: pixelX - 1,
        top: pixelY,
        width: 2,
        height: pixelHeight,
        backgroundColor: 'var(--primary)',
        pointerEvents: 'none',
        zIndex: 1000,
        borderRadius: 2,
        boxShadow: '0 0 4px var(--primary)',
        transition: 'left 80ms ease-out, top 80ms ease-out',
      }}
    />
  );
}
```

- [ ] **Step 2: Build check**

Run: `npm run build 2>&1 | tail -10`

Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/InsertionLine.tsx
git commit -m "feat(dashboard): add InsertionLine component for fluid-flow drag UX"
```

---

### Task 12: Render insertion line during drag + hide RGL placeholder

**Files:**
- Modify: `components/dashboard/dashboard-builder-v2.tsx` — drag handlers + GridLayout wrapper
- Modify: `app/globals.css` — scope rules behind `:not([data-fluid-flow])`

- [ ] **Step 1: Add insertion-line state and live computation**

In `dashboard-builder-v2.tsx`, near other `useState` declarations at the top of the component:

```typescript
const [insertionPos, setInsertionPos] = useState<{ pixelX: number; pixelY: number; pixelHeight: number } | null>(null);
```

- [ ] **Step 2: Update `handleDrag` (mid-gesture) to compute and set the line position**

Find `handleDrag` (or add one if absent in the component, ensuring the RGL `onDrag` prop wires to it):

```typescript
const handleDrag: ItemCallback = useCallback(
  (_currentLayout, _oldItem, newItem) => {
    if (!isDraggingRef.current) return;
    const idx = computeInsertionIndex(state.layout, newItem, FLUID_GRID_COLS);
    setInsertionPos(gridIndexToPixel(state.layout, idx, actualContainerWidth, FLUID_GRID_COLS, ROW_HEIGHT));
  },
  [state.layout, actualContainerWidth]
);
```

`gridIndexToPixel` is a helper to convert the insertion index to pixel coordinates for the line. Add it in the same file:

```typescript
function gridIndexToPixel(
  layout: FluidFlowItem[],
  index: number,
  containerWidthPx: number,
  gridCols: number,
  rowHeightPx: number,
  marginX: number = 8,
  marginY: number = 8
): { pixelX: number; pixelY: number; pixelHeight: number } {
  const colWidth = (containerWidthPx - marginX * (gridCols + 1)) / gridCols;
  const target = layout[index];
  if (!target) {
    // Append at end: place line after the last item
    const last = layout[layout.length - 1];
    if (!last) return { pixelX: marginX, pixelY: marginY, pixelHeight: rowHeightPx };
    return {
      pixelX: marginX + (last.x + last.w) * (colWidth + marginX),
      pixelY: marginY + last.y * (rowHeightPx + marginY),
      pixelHeight: last.h * rowHeightPx + (last.h - 1) * marginY,
    };
  }
  return {
    pixelX: marginX + target.x * (colWidth + marginX),
    pixelY: marginY + target.y * (rowHeightPx + marginY),
    pixelHeight: target.h * rowHeightPx + (target.h - 1) * marginY,
  };
}
```

- [ ] **Step 3: Clear `insertionPos` on `handleDragStop`**

Inside `handleDragStop`, before/after the `setState`:

```typescript
setInsertionPos(null);
```

- [ ] **Step 4: Mount `<InsertionLine>` inside the GridLayout container**

Wrap the `<GridLayout>` in a relatively-positioned div (if not already), and add `<InsertionLine>` as a sibling:

```tsx
<div className="relative">
  <GridLayout ...>{...}</GridLayout>
  <InsertionLine
    pixelX={insertionPos?.pixelX ?? 0}
    pixelY={insertionPos?.pixelY ?? 0}
    pixelHeight={insertionPos?.pixelHeight ?? 0}
    visible={insertionPos !== null}
  />
</div>
```

- [ ] **Step 5: Hide RGL's default placeholder in fluid mode**

In `app/globals.css`, change lines 86–98 (the `.react-grid-item.react-grid-placeholder` rules) to scope behind `:not([data-fluid-flow])`:

```css
/* Show grid lines during drag - lighter blue and thinner (legacy mode only) */
.react-grid-layout:not([data-fluid-flow]) .react-grid-item.react-grid-placeholder,
.dashboard-builder:not([data-fluid-flow]) .react-grid-item.react-grid-placeholder {
  display: block !important;
  opacity: 0.4 !important;
  visibility: visible !important;
  z-index: 500 !important;
  border-radius: 8px;
  border: 1px dashed rgb(191, 219, 254, 0.6) !important;
  box-shadow: 0 2px 6px rgba(191, 219, 254, 0.1) !important;
  position: relative !important;
  animation: placeholderPulse 1.5s ease-in-out infinite alternate;
}

/* In fluid-flow mode, hide RGL's placeholder entirely; we render our own InsertionLine. */
.react-grid-layout[data-fluid-flow] .react-grid-item.react-grid-placeholder {
  display: none !important;
}
```

- [ ] **Step 6: Drop the blur-other-charts rule in fluid mode**

In `app/globals.css`, change lines 66–71 to scope behind `:not([data-fluid-flow])`:

```css
.react-grid-layout:not([data-fluid-flow]):has(.react-draggable-dragging) .react-grid-item:not(.react-draggable-dragging),
.react-grid-layout:not([data-fluid-flow]):has(.resizing) .react-grid-item:not(.resizing) {
  filter: blur(1px);
  opacity: 0.8;
  transition: filter 200ms ease, opacity 200ms ease;
}
```

- [ ] **Step 7: Manual sanity check**

In dev, drag a chart slowly across the dashboard. Expected: blue insertion line appears between the two charts where it would land if released. RGL's pulsing placeholder is hidden. Other charts are not blurred.

- [ ] **Step 8: Commit**

```bash
git add components/dashboard/dashboard-builder-v2.tsx app/globals.css
git commit -m "feat(dashboard): render insertion line during drag; hide RGL placeholder in fluid mode"
```

---

## Phase 4 — Edge case hardening

### Task 13: Freeze constraint updates while dragging

**Files:**
- Modify: `components/dashboard/dashboard-builder-v2.tsx` — wherever `contentConstraints` or chart-data-driven height adjustments mutate `state.layout`

- [ ] **Step 1: Find constraint-update callsites**

Run: `grep -n "contentConstraints\|updateConstraints\|setConstraints" components/dashboard/dashboard-builder-v2.tsx | head -20`

- [ ] **Step 2: Guard each callsite with `isDraggingRef`**

For each callsite, wrap the state update in:

```typescript
if (isDraggingRef.current) return; // skip constraint updates during drag to prevent layout jumps
```

- [ ] **Step 3: Manual sanity check**

In dev, find a dashboard where a chart fetches data and changes height after load. Drag a different chart while the first one is still loading. Expected: drag does not jump or jitter from the height-update mid-gesture.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/dashboard-builder-v2.tsx
git commit -m "fix(dashboard): freeze constraint-driven height updates while dragging"
```

---

### Task 14: Skip reflow during undo/redo

**Files:**
- Modify: `components/dashboard/dashboard-builder-v2.tsx` — `handleLayoutChange` (~L917) and any explicit undo/redo handler

- [ ] **Step 1: Locate `isUndoRedoOperation` flag**

Run: `grep -n "isUndoRedoOperation" components/dashboard/dashboard-builder-v2.tsx`

- [ ] **Step 2: Skip applyMutation when undoing/redoing**

The undo/redo system writes a previously-stored snapshot back to `state.layout`. Those snapshots already contain reflowed (x, y) — running `applyMutation` again is a no-op but adds a render. Add a guard at the top of every applyMutation callsite that fires from a state-history operation:

```typescript
// In handleLayoutChange or wherever undo/redo replays state:
if (isUndoRedoOperation.current) {
  // Snapshot already contains correct flowed layout; just write it back.
  setStateWithoutHistory((prev) => ({ ...prev, layout: incomingSnapshot.layout }));
  return;
}
```

(Match your codebase's exact undo/redo plumbing — the goal is: don't double-reflow restored snapshots.)

- [ ] **Step 3: Manual sanity check**

In dev: add a chart, undo (Cmd+Z), redo (Cmd+Shift+Z). Expected: layout returns to pre-add and post-add states correctly. No flicker, no double-animation.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/dashboard-builder-v2.tsx
git commit -m "fix(dashboard): skip reflow when applying undo/redo snapshots"
```

---

### Task 15: Manual QA + edge case verification

**Files:** None modified (this task is verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`

Expected: all tests pass, including the new fluid-flow unit tests.

- [ ] **Step 2: Run a clean production build**

Run: `npm run build`

Expected: succeeds with no TypeScript errors.

- [ ] **Step 3: Manual QA checklist (dev server, port 3001)**

For each item, mark ✓ when verified. If any fails, file as a bug to fix before merge:

- [ ] **Add chart at end** → appears at end of ordered list, reflows into the right position
- [ ] **Drag chart from row 2 to top of row 1** → row 1 charts shift right, last one wraps to row 2
- [ ] **Drag chart from row 1 (middle) to far right of row 2** → all reflow correctly
- [ ] **Resize chart wider until it would push another off the row** → on release, the displaced chart wraps to next row
- [ ] **Resize chart smaller** → right neighbors shift left; if a next-row chart fits, it pulls up
- [ ] **Delete chart from middle of row 1** → row 1 closes the gap; first chart from row 2 may pull up
- [ ] **Delete the only chart in a row** → all rows below shift up
- [ ] **Drop chart between two charts** → insertion line shows the drop position; release commits there
- [ ] **Drop chart at end (below all rows)** → appends at end of ordered list
- [ ] **Insertion line is visible during drag, hidden on release**
- [ ] **No "drag jump" — chart stays under cursor while dragging**
- [ ] **Other charts are NOT blurred during drag**
- [ ] **Open an old (legacy) dashboard** → renders identically in view mode and edit mode after first edit; no errors
- [ ] **Undo/redo after several mutations** → returns to correct prior states
- [ ] **Real-time chart data changes height while another chart is being dragged** → no jitter
- [ ] **Dashboard with 50+ charts** → reflow on drag-stop completes within ~200ms; no visible lag

- [ ] **Step 4: Save QA checklist results**

If everything passes, no further edits. If any items fail, file each as a bug, fix in a follow-up task, then re-run the affected items.

- [ ] **Step 5: Final commit (if any docs changed during QA)**

```bash
# only if changes were made during QA
git add -p
git commit -m "fix(dashboard): address QA findings for fluid row flow"
```

---

## Out of scope (flagged for follow-up)

- Mobile / narrow-viewport reflow (different column counts at small widths). Current behavior — 12 cols always, charts shrink in pixels — remains for now. Note in PR description.
- Lazy-vs-eager migration of legacy dashboards: spec calls for lazy (first edit triggers reflow); no separate migration task.
