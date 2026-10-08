import { buildEffectiveColumns, buildPivotSearchCells, COL_SUBTOTAL_MARKER } from '../pivot-layout';

describe('buildEffectiveColumns', () => {
  it('without subtotals: one leaf per column key', () => {
    expect(buildEffectiveColumns([['2024'], ['2025']], undefined, true, 1)).toEqual([
      { type: 'leaf', leafIdx: 0, headerKey: ['2024'] },
      { type: 'leaf', leafIdx: 1, headerKey: ['2025'] },
    ]);
  });

  it('a subtotal after its leaf, padded to the leaf depth', () => {
    const cols = buildEffectiveColumns(
      [
        ['A', 'x'],
        ['A', 'y'],
      ],
      { keys: [['A']], insert_after: [1] } as never,
      true,
      2
    );
    expect(cols[2]).toEqual({
      type: 'column_subtotal',
      subIdx: 0,
      headerKey: ['A', COL_SUBTOTAL_MARKER],
    });
  });
});

describe('buildPivotSearchCells', () => {
  it('skips row-label cells merged by rowSpan but keeps counting the column', () => {
    const rows = [
      { row_labels: ['North', 'A'], values: [[1]], row_total: [1], is_subtotal: false },
      { row_labels: ['North', 'B'], values: [[2]], row_total: [2], is_subtotal: false },
    ] as never;
    const cells = buildPivotSearchCells(
      rows,
      2,
      [
        [2, 1],
        [0, 1],
      ],
      true,
      [{ type: 'leaf', leafIdx: 0, headerKey: ['x'] }],
      ['Sum'],
      (v) => String(v),
      undefined
    );
    expect(cells.filter((c) => c.rowIndex === 1).map((c) => c.colIndex)).toEqual([1, 2, 3]);
  });
});
