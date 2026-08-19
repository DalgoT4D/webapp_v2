import { cellsToGrid } from '../cellsToGrid';
import type { PivotTableResponse, PivotCell } from '@/types/pivot-table';

// Test convenience: derive the column axes from the cells by first appearance.
// The real backend sorts these by raw value; test fixtures are already in sorted
// order, and tests that care about ordering pass column_keys explicitly.
function axisKeys(cells: PivotCell[], kind: PivotCell['col_kind']): string[][] {
  const seen = new Set<string>();
  const keys: string[][] = [];
  for (const c of cells) {
    if (c.col_kind !== kind) continue;
    const id = JSON.stringify(c.col_key);
    if (!seen.has(id)) {
      seen.add(id);
      keys.push(c.col_key);
    }
  }
  return keys;
}

function resp(cells: PivotCell[], overrides: Partial<PivotTableResponse> = {}): PivotTableResponse {
  return {
    row_dimension_names: ['district'],
    column_dimension_names: ['month', 'program'],
    metric_headers: ['Count'],
    column_keys: axisKeys(cells, 'leaf'),
    column_subtotal_keys: axisKeys(cells, 'col_subtotal'),
    cells,
    ...overrides,
  };
}

describe('cellsToGrid — multi column dimension', () => {
  // Mumbai row: two leaf columns (Education, Health), one column subtotal (2026-01),
  // one row total; plus a grand-total row.
  const cells: PivotCell[] = [
    {
      row_key: ['Mumbai'],
      col_key: ['2026-01', 'Education'],
      row_kind: 'data',
      col_kind: 'leaf',
      values: [5],
    },
    {
      row_key: ['Mumbai'],
      col_key: ['2026-01', 'Health'],
      row_kind: 'data',
      col_kind: 'leaf',
      values: [3],
    },
    {
      row_key: ['Mumbai'],
      col_key: ['2026-01'],
      row_kind: 'data',
      col_kind: 'col_subtotal',
      values: [8],
    },
    { row_key: ['Mumbai'], col_key: [], row_kind: 'data', col_kind: 'row_total', values: [8] },
    {
      row_key: [],
      col_key: ['2026-01', 'Education'],
      row_kind: 'grand_total',
      col_kind: 'leaf',
      values: [5],
    },
    {
      row_key: [],
      col_key: ['2026-01', 'Health'],
      row_kind: 'grand_total',
      col_kind: 'leaf',
      values: [3],
    },
    {
      row_key: [],
      col_key: ['2026-01'],
      row_kind: 'grand_total',
      col_kind: 'col_subtotal',
      values: [8],
    },
    { row_key: [], col_key: [], row_kind: 'grand_total', col_kind: 'row_total', values: [8] },
  ];

  it('derives leaf column keys in arrival order', () => {
    const grid = cellsToGrid(resp(cells));
    expect(grid.column_keys).toEqual([
      ['2026-01', 'Education'],
      ['2026-01', 'Health'],
    ]);
  });

  it('passes through metadata', () => {
    const grid = cellsToGrid(resp(cells));
    expect(grid.column_dimension_names).toEqual(['month', 'program']);
    expect(grid.metric_headers).toEqual(['Count']);
  });

  it('builds one data row with positional values, row_total and column subtotal', () => {
    const grid = cellsToGrid(resp(cells));
    expect(grid.rows).toHaveLength(1);
    const row = grid.rows[0];
    expect(row.row_labels).toEqual(['Mumbai']);
    expect(row.is_subtotal).toBe(false);
    expect(row.values).toEqual([[5], [3]]); // [leafIdx][metric]
    expect(row.column_subtotal_values).toEqual([[8]]);
    expect(row.row_total).toEqual([8]);
  });

  it('builds the grand_total entry', () => {
    const grid = cellsToGrid(resp(cells));
    expect(grid.grand_total).not.toBeNull();
    expect(grid.grand_total!.values).toEqual([[5], [3]]);
    expect(grid.grand_total!.column_subtotal_values).toEqual([[8]]);
    expect(grid.grand_total!.row_total).toEqual([8]);
  });

  it('derives column_subtotals keys + insert_after (after last matching leaf)', () => {
    const grid = cellsToGrid(resp(cells));
    expect(grid.column_subtotals).toEqual({
      keys: [['2026-01']],
      insert_after: [1], // after Health (leaf index 1), the last leaf under 2026-01
    });
  });
});

describe('cellsToGrid — no column subtotals present', () => {
  const cells: PivotCell[] = [
    { row_key: ['CA'], col_key: ['2024'], row_kind: 'data', col_kind: 'leaf', values: [10] },
    { row_key: ['CA'], col_key: ['2025'], row_kind: 'data', col_kind: 'leaf', values: [20] },
    { row_key: ['CA'], col_key: [], row_kind: 'data', col_kind: 'row_total', values: [30] },
  ];

  it('omits column_subtotals and column_subtotal_values', () => {
    const grid = cellsToGrid(resp(cells, { column_dimension_names: ['year'] }));
    expect(grid.column_subtotals).toBeUndefined();
    expect(grid.rows[0].column_subtotal_values).toBeUndefined();
    expect(grid.rows[0].values).toEqual([[10], [20]]);
    expect(grid.rows[0].row_total).toEqual([30]);
  });

  it('returns null grand_total when no grand-total cells', () => {
    const grid = cellsToGrid(resp(cells, { column_dimension_names: ['year'] }));
    expect(grid.grand_total).toBeNull();
  });
});

describe('cellsToGrid — row subtotals', () => {
  // Two data rows under Mumbai + a Mumbai subtotal row.
  const cells: PivotCell[] = [
    {
      row_key: ['Mumbai', 'Education'],
      col_key: ['2024'],
      row_kind: 'data',
      col_kind: 'leaf',
      values: [5],
    },
    {
      row_key: ['Mumbai', 'Education'],
      col_key: [],
      row_kind: 'data',
      col_kind: 'row_total',
      values: [5],
    },
    {
      row_key: ['Mumbai', 'Health'],
      col_key: ['2024'],
      row_kind: 'data',
      col_kind: 'leaf',
      values: [3],
    },
    {
      row_key: ['Mumbai', 'Health'],
      col_key: [],
      row_kind: 'data',
      col_kind: 'row_total',
      values: [3],
    },
    {
      row_key: ['Mumbai'],
      col_key: ['2024'],
      row_kind: 'row_subtotal',
      col_kind: 'leaf',
      values: [8],
    },
    {
      row_key: ['Mumbai'],
      col_key: [],
      row_kind: 'row_subtotal',
      col_kind: 'row_total',
      values: [8],
    },
  ];

  it('preserves row order and flags the subtotal row', () => {
    const grid = cellsToGrid(
      resp(cells, {
        row_dimension_names: ['district', 'program'],
        column_dimension_names: ['year'],
      })
    );
    expect(grid.rows.map((r) => [r.row_labels, r.is_subtotal])).toEqual([
      [['Mumbai', 'Education'], false],
      [['Mumbai', 'Health'], false],
      [['Mumbai'], true],
    ]);
    expect(grid.rows[2].values).toEqual([[8]]);
    expect(grid.rows[2].row_total).toEqual([8]);
  });
});

describe('cellsToGrid — no column dimensions', () => {
  // Values live only in the row_total column (col_key []).
  const cells: PivotCell[] = [
    {
      row_key: ['Action Against Hunger', 'Completed'],
      col_key: [],
      row_kind: 'data',
      col_kind: 'row_total',
      values: [18],
    },
    {
      row_key: ['Action Against Hunger', 'In Progress'],
      col_key: [],
      row_kind: 'data',
      col_kind: 'row_total',
      values: [7],
    },
  ];

  it('produces empty column_keys and puts values in row_total', () => {
    const grid = cellsToGrid(
      resp(cells, {
        row_dimension_names: ['ngo_name', 'status'],
        column_dimension_names: [],
        metric_headers: ['Total Count'],
      })
    );
    expect(grid.column_keys).toEqual([]);
    expect(grid.rows).toHaveLength(2);
    expect(grid.rows[0].values).toEqual([]);
    expect(grid.rows[0].row_total).toEqual([18]);
    expect(grid.rows[1].row_total).toEqual([7]);
  });
});

describe('cellsToGrid — empty', () => {
  it('handles no cells', () => {
    const grid = cellsToGrid(resp([]));
    expect(grid.rows).toEqual([]);
    expect(grid.column_keys).toEqual([]);
    expect(grid.grand_total).toBeNull();
  });
});

describe('cellsToGrid — backend column order under sparse cells', () => {
  // Row A skips a MIDDLE column (2026-02). Cells arrive row-major, so by arrival
  // the leaf columns first appear as 01, 03 (from A), then 02 (from B). The grid
  // must follow the backend's sorted column_keys, not arrival order.
  const cells: PivotCell[] = [
    { row_key: ['A'], col_key: ['2026-01'], row_kind: 'data', col_kind: 'leaf', values: [1] },
    { row_key: ['A'], col_key: ['2026-03'], row_kind: 'data', col_kind: 'leaf', values: [2] },
    { row_key: ['B'], col_key: ['2026-01'], row_kind: 'data', col_kind: 'leaf', values: [3] },
    { row_key: ['B'], col_key: ['2026-02'], row_kind: 'data', col_kind: 'leaf', values: [4] },
    { row_key: ['B'], col_key: ['2026-03'], row_kind: 'data', col_kind: 'leaf', values: [5] },
  ];

  it('places values under the correct sorted columns', () => {
    const grid = cellsToGrid(
      resp(cells, {
        column_dimension_names: ['month'],
        column_keys: [['2026-01'], ['2026-02'], ['2026-03']], // backend-sorted
      })
    );
    expect(grid.column_keys).toEqual([['2026-01'], ['2026-02'], ['2026-03']]);
    const rowA = grid.rows.find((r) => r.row_labels[0] === 'A')!;
    // A: Jan=1, Feb missing (null), Mar=2 lands in slot 2 (not slot 1).
    expect(rowA.values).toEqual([[1], [null], [2]]);
    const rowB = grid.rows.find((r) => r.row_labels[0] === 'B')!;
    expect(rowB.values).toEqual([[3], [4], [5]]);
  });
});

describe('cellsToGrid — composite key collision', () => {
  // Two distinct 2-level leaf keys that would collide under a naive space join:
  // ['a','b c'] and ['a b','c'] both flatten to "a b c". They must stay separate.
  const cells: PivotCell[] = [
    { row_key: ['R'], col_key: ['a', 'b c'], row_kind: 'data', col_kind: 'leaf', values: [1] },
    { row_key: ['R'], col_key: ['a b', 'c'], row_kind: 'data', col_kind: 'leaf', values: [2] },
  ];

  it('keeps ambiguous composite column keys distinct', () => {
    const grid = cellsToGrid(resp(cells, { column_dimension_names: ['x', 'y'] }));
    expect(grid.column_keys).toEqual([
      ['a', 'b c'],
      ['a b', 'c'],
    ]);
    expect(grid.rows[0].values).toEqual([[1], [2]]);
  });
});

describe('cellsToGrid — sparse cells', () => {
  // Row B is missing the '2024' leaf entirely — that slot must be null-filled.
  const cells: PivotCell[] = [
    { row_key: ['A'], col_key: ['2024'], row_kind: 'data', col_kind: 'leaf', values: [1] },
    { row_key: ['A'], col_key: ['2025'], row_kind: 'data', col_kind: 'leaf', values: [2] },
    { row_key: ['B'], col_key: ['2025'], row_kind: 'data', col_kind: 'leaf', values: [9] },
  ];

  it('null-fills a leaf column absent for a row', () => {
    const grid = cellsToGrid(resp(cells, { column_dimension_names: ['year'] }));
    expect(grid.column_keys).toEqual([['2024'], ['2025']]);
    const rowB = grid.rows.find((r) => r.row_labels[0] === 'B')!;
    expect(rowB.values).toEqual([[null], [9]]); // 2024 slot null-filled
  });
});
