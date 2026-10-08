import {
  getPrintChartHeight,
  getPrintTextHeight,
  groupLayoutByRows,
  type PrintLayoutItem,
} from '@/components/reports/logic/print-rows';

const item = (i: string, x: number, y: number): PrintLayoutItem => ({ i, x, y, w: 4, h: 6 });

describe('groupLayoutByRows', () => {
  const components = {
    a: { type: 'chart' },
    b: { type: 'text' },
    c: { type: 'chart' },
    f: { type: 'filter' },
    d: { type: 'heading' },
  };

  it('groups by y, sorts items by x within a row and rows by y', () => {
    const rows = groupLayoutByRows(
      [item('c', 8, 6), item('a', 4, 0), item('b', 0, 0), item('d', 0, 6)],
      components
    );
    expect(rows.map((r) => ({ y: r.y, ids: r.items.map((it) => it.i) }))).toEqual([
      { y: 0, ids: ['b', 'a'] },
      { y: 6, ids: ['d', 'c'] },
    ]);
  });

  it('drops legacy filter components and layout items with no component', () => {
    const rows = groupLayoutByRows(
      [item('f', 0, 0), item('ghost', 4, 0), item('a', 0, 3)],
      components
    );
    expect(rows).toEqual([{ y: 3, items: [item('a', 0, 3)] }]);
  });

  it('empty layout → no rows', () => {
    expect(groupLayoutByRows([], components)).toEqual([]);
  });
});

describe('print heights', () => {
  it('charts: 20 px per grid row, at least 300 px', () => {
    expect(getPrintChartHeight(6)).toBe(300);
    expect(getPrintChartHeight(20)).toBe(400);
  });

  it('text: 20 px per grid row, at least 60 px', () => {
    expect(getPrintTextHeight(2)).toBe(60);
    expect(getPrintTextHeight(5)).toBe(100);
  });
});
