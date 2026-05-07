import {
  flowLayout,
  applyMutation,
  moveItemToIndex,
  computeInsertionIndex,
} from '../dashboard-animation-utils';

type Item = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
};
const item = (i: string, w: number, h: number, extra: Partial<Item> = {}): Item => ({
  i,
  x: 0,
  y: 0,
  w,
  h,
  ...extra,
});

// Dashboard always renders on a 12-column grid (Superset-style); kept fixed across viewport sizes.
const GRID_COLS = 12;

describe('flowLayout', () => {
  it('packs 5 charts of w=2 into a single row of 12 cols (no premature wrap)', () => {
    const items = [
      item('a', 2, 1),
      item('b', 2, 1),
      item('c', 2, 1),
      item('d', 2, 1),
      item('e', 2, 1),
    ];
    const result = flowLayout(items, GRID_COLS);
    expect(result.map((r) => r.x)).toEqual([0, 2, 4, 6, 8]);
    expect(result.map((r) => r.y)).toEqual([0, 0, 0, 0, 0]);
  });

  it('wraps to next row when chart does not fit', () => {
    const items = [item('a', 6, 1), item('b', 6, 1), item('c', 6, 1)];
    const result = flowLayout(items, GRID_COLS);
    expect(result.map((r) => ({ x: r.x, y: r.y }))).toEqual([
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 0, y: 1 },
    ]);
  });

  it('uses tallest item as row height; next row starts at y = tallest h', () => {
    // First row: 4 items totaling exactly 12 cols. Tallest is 'table' with h=4.
    // The 5th item must wrap to row 2 and land at y=4 (below the tallest of row 1).
    const items = [
      item('kpi1', 3, 1),
      item('kpi2', 3, 1),
      item('table', 3, 4),
      item('kpi3', 3, 1),
      item('row2', 3, 1),
    ];
    const result = flowLayout(items, GRID_COLS);
    expect(result[0]).toMatchObject({ x: 0, y: 0 });
    expect(result[1]).toMatchObject({ x: 3, y: 0 });
    expect(result[2]).toMatchObject({ x: 6, y: 0 });
    expect(result[3]).toMatchObject({ x: 9, y: 0 });
    expect(result[4]).toMatchObject({ x: 0, y: 4 });
  });

  it('next row starts below the tallest item of the previous row', () => {
    const items = [item('table', 6, 4), item('kpi', 6, 1), item('next', 6, 1)];
    const result = flowLayout(items, GRID_COLS);
    expect(result[0]).toMatchObject({ x: 0, y: 0 });
    expect(result[1]).toMatchObject({ x: 6, y: 0 });
    expect(result[2]).toMatchObject({ x: 0, y: 4 });
  });

  it('clamps w to minW when w is below minW', () => {
    const items = [item('a', 2, 1, { minW: 4 })];
    const result = flowLayout(items, GRID_COLS);
    expect(result[0].w).toBe(4);
    expect(result[0].x).toBe(0);
  });

  it('clamps w to grid width when w exceeds gridCols', () => {
    const items = [item('a', 14, 1)];
    const result = flowLayout(items, GRID_COLS);
    expect(result[0].w).toBe(GRID_COLS);
    expect(result[0].x).toBe(0);
  });

  it('clamps h to minH when h is below minH', () => {
    const items = [item('a', 4, 1, { minH: 2 })];
    const result = flowLayout(items, GRID_COLS);
    expect(result[0].h).toBe(2);
  });

  it('returns empty array for empty input', () => {
    expect(flowLayout([], GRID_COLS)).toEqual([]);
  });

  it('preserves array order regardless of (x, y) input', () => {
    // Items deliberately given out-of-order coords; flowLayout should NOT re-sort
    const items = [
      item('first', 3, 1, { x: 9, y: 5 }),
      item('second', 3, 1, { x: 0, y: 0 }),
      item('third', 3, 1, { x: 3, y: 0 }),
    ];
    const result = flowLayout(items, GRID_COLS);
    expect(result.map((r) => r.i)).toEqual(['first', 'second', 'third']);
    expect(result.map((r) => r.x)).toEqual([0, 3, 6]);
  });

  it('does not mutate input array', () => {
    const items = [item('a', 4, 1, { x: 99, y: 99 })];
    const snapshot = JSON.parse(JSON.stringify(items));
    flowLayout(items, GRID_COLS);
    expect(items).toEqual(snapshot);
  });

  it('preserves all non-positional fields (minW, maxH, custom keys)', () => {
    const items = [item('a', 4, 1, { minW: 2, maxW: 8, minH: 1, maxH: 3 })];
    const result = flowLayout(items, GRID_COLS);
    expect(result[0]).toMatchObject({ minW: 2, maxW: 8, minH: 1, maxH: 3 });
  });
});

describe('applyMutation', () => {
  const items = [item('a', 4, 1), item('b', 4, 1), item('c', 4, 1)];

  it('runs the mutation function then reflows', () => {
    const result = applyMutation(items, (l) => l.filter((i) => i.i !== 'b'), GRID_COLS);
    expect(result.map((r) => r.i)).toEqual(['a', 'c']);
    expect(result.map((r) => r.x)).toEqual([0, 4]);
  });

  it('does not mutate the original array', () => {
    const snapshot = JSON.parse(JSON.stringify(items));
    applyMutation(items, (l) => [...l, item('d', 4, 1)], GRID_COLS);
    expect(items).toEqual(snapshot);
  });

  it('appends new items at the correct flowed position', () => {
    const result = applyMutation(items, (l) => [...l, item('d', 4, 1)], GRID_COLS);
    expect(result.find((r) => r.i === 'd')).toMatchObject({ x: 0, y: 1 }); // wraps to next row
  });
});

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
  // Two-row scenario for "drag from bottom to up" coverage:
  // Row 0: a(0,0), b(3,0), c(6,0), d(9,0); each w=3 h=1.
  // Row 1: e(0,1) w=3 h=1.
  // Dragging 'e' from row 1 up to row 0 should land at the correct in-row index, NOT collapse to 0.
  const flowed = flowLayout(
    [item('a', 3, 1), item('b', 3, 1), item('c', 3, 1), item('d', 3, 1), item('e', 3, 1)],
    GRID_COLS
  );
  // Drag args helper — full bounds {i,x,y,w,h} as RGL provides on dragStop
  const drag = (i: string, x: number, y: number, w = 3, h = 1) => ({ i, x, y, w, h });

  it('inserts at end when dragged below all rows', () => {
    expect(computeInsertionIndex(flowed, drag('a', 0, 99), GRID_COLS)).toBe(4);
  });

  it('displaces leftmost item when dragged onto its slot from a later index', () => {
    // Drag 'e' (oldIdx=4, originally row 1) up to (0,0) — center (1.5, 0.5).
    // a's center is also 1.5; since 'e' came from after 'a' in array order, a leftward
    // drag onto a's exact slot displaces a (insert e at idx 0). Without this, equal-width
    // siblings can never swap leftward.
    expect(computeInsertionIndex(flowed, drag('e', 0, 0), GRID_COLS)).toBe(0);
  });

  it('swaps with previous sibling in the same row (leftward drag, equal widths)', () => {
    // Two-chart row scenario the user reported: drag 'b' onto 'a' should produce [b, a].
    // RGL clamps x to 0, so the dragged center exactly matches a's center (2 = 2);
    // direction-aware tie-break makes equal-center leftward drag count as a hit.
    const tworow = flowLayout([item('a', 4, 1), item('b', 4, 1)], GRID_COLS);
    expect(computeInsertionIndex(tworow, drag('b', 0, 0, 4, 1), GRID_COLS)).toBe(0);
  });

  it('partial leftward drag below the target center does not displace it', () => {
    // Mirror of the swap test: drag 'b' partway toward 'a' (x=2 → center 4 > a.center 2).
    // Lenient compare requires reaching/crossing the center; until then, no displace.
    const tworow = flowLayout([item('a', 4, 1), item('b', 4, 1)], GRID_COLS);
    expect(computeInsertionIndex(tworow, drag('b', 2, 0, 4, 1), GRID_COLS)).toBe(1);
  });

  it('tall chart dragged over a row of short cards displaces them (containment)', () => {
    // Reproduces the user-reported overlap: a tall chart in row 1 dragged up over
    // two short number cards in row 0. The dragged item's center sits far below the
    // cards' row band, so center-based logic alone would miss them — containment
    // catches this and inserts the tall chart before the first contained card.
    const lay = flowLayout(
      [item('num1', 6, 3), item('num2', 6, 3), item('stacked', 12, 15)],
      GRID_COLS
    );
    // Drag 'stacked' to (0, 0): bounds (0..12, 0..15) fully contain num1 (0..6, 0..3)
    // and num2 (6..12, 0..3). Dragged was originally at the end → leftward intent →
    // insert before the first contained item.
    expect(computeInsertionIndex(lay, drag('stacked', 0, 0, 12, 15), GRID_COLS)).toBe(0);
  });

  it('rightward containment lands after the last contained item', () => {
    // Tall chart originally at the top dragged down past two short cards. With
    // rightward intent, insertion should land after the last contained item so
    // the row collapses cleanly.
    const lay = flowLayout(
      [item('stacked', 12, 15), item('num1', 6, 3), item('num2', 6, 3)],
      GRID_COLS
    );
    // Drag 'stacked' down to (0, 15): bounds (0..12, 15..30) fully contain both
    // num1 (0..6, 15..18) and num2 (6..12, 15..18). Insert after last → idx 2.
    expect(computeInsertionIndex(lay, drag('stacked', 0, 15, 12, 15), GRID_COLS)).toBe(2);
  });

  it('inserts mid-row when dragged between two items in the same row', () => {
    // Drag 'e' to (4, 0): center (5.5, 0.5). c's center is 7.5 → insert before c (idx 2).
    expect(computeInsertionIndex(flowed, drag('e', 4, 0), GRID_COLS)).toBe(2);
  });

  it('does NOT collapse to index 0 when dragged into the right side of row 0 (bug fix)', () => {
    // Previously the function returned 0 for any y < first item's center, even if x was far right.
    // Drag 'e' to (8, 0): center (9.5, 0.5). All of a/b/c are to the left → insert at idx 3 (before d).
    expect(computeInsertionIndex(flowed, drag('e', 8, 0), GRID_COLS)).toBe(3);
  });

  it('inserts at end of row 0 when dragged to right edge', () => {
    // Drag 'e' to (10, 0): center (11.5, 0.5). All of a/b/c/d are to the left → insert after d (idx 4).
    expect(computeInsertionIndex(flowed, drag('e', 10, 0), GRID_COLS)).toBe(4);
  });

  it('handles same-row drop by horizontal center, not by y', () => {
    // Drag 'd' (originally at x=9, row 0) to x=2 (left of b): center (3.5, 0.5).
    // others = [a,b,c,e]. b center is 4.5 → insert before b (idx 1).
    expect(computeInsertionIndex(flowed, drag('d', 2, 0), GRID_COLS)).toBe(1);
  });
});
