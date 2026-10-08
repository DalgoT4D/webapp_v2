import {
  computeHeaderSpans,
  formatPivotCell,
  getPivotConditionalColor,
} from '@/components/charts/chart-types/pivot-table/pivot-cells';
import type { ConditionalFormattingRule } from '@/components/charts/styling/conditional-formatting';

describe('computeHeaderSpans', () => {
  const keys = [
    ['2023', 'flood'],
    ['2023', 'drought'],
    ['2024', 'flood'],
  ];
  it('groups by the prefix up to the level', () => {
    expect(computeHeaderSpans(keys, 0)).toEqual([
      { value: '2023', span: 2, startIdx: 0 },
      { value: '2024', span: 1, startIdx: 2 },
    ]);
    expect(computeHeaderSpans(keys, 1)).toEqual([
      { value: 'flood', span: 1, startIdx: 0 },
      { value: 'drought', span: 1, startIdx: 1 },
      { value: 'flood', span: 1, startIdx: 2 },
    ]);
    expect(computeHeaderSpans([], 0)).toEqual([]);
  });
});

describe('formatPivotCell', () => {
  it('null → N/A; default is 0 decimals (pinned: 0.49 → "0")', () => {
    expect(formatPivotCell(null, undefined)).toBe('N/A');
    expect(formatPivotCell(0.49, undefined)).toBe('0');
    expect(formatPivotCell(1234.5, undefined)).toBe('1,235');
    expect(formatPivotCell(0.49, { decimalPlaces: 2 })).toBe('0.49');
  });
});

describe('getPivotConditionalColor', () => {
  const rules = [
    { column: 'SUM(students)', type: 'numeric', operator: '>=', value: 10, color: '#a' },
    { column: 'SUM(students)', type: 'numeric', operator: '==', value: 20, color: '#b' },
  ] as ConditionalFormattingRule[];
  it('numeric comparison on the metric, last match wins', () => {
    expect(getPivotConditionalColor(rules, 20, 'SUM(students)')).toBe('#b');
    expect(getPivotConditionalColor(rules, 15, 'SUM(students)')).toBe('#a');
    expect(getPivotConditionalColor(rules, 15, 'AVG(x)')).toBeUndefined();
    expect(getPivotConditionalColor(rules, null, 'SUM(students)')).toBeUndefined();
    expect(getPivotConditionalColor([], 15, 'SUM(students)')).toBeUndefined();
  });
});
