import {
  autoLabel,
  DEFAULT_METRIC_ALIAS,
  summaryOf,
} from '@/components/charts/logic/metric-labels';

describe('summaryOf', () => {
  it('expression (first 40 chars) or AGG(column)', () => {
    expect(summaryOf({ column_expression: 'x'.repeat(50) })).toBe('x'.repeat(40));
    expect(summaryOf({ aggregation: 'sum', column: 'students' })).toBe('SUM(students)');
    expect(summaryOf({ aggregation: 'count', column: null })).toBe('COUNT(*)');
    expect(summaryOf({})).toBe('(*)');
  });
});

describe('autoLabel', () => {
  it('count of all rows is "Total Count"', () => {
    expect(DEFAULT_METRIC_ALIAS).toBe('Total Count');
    expect(autoLabel('count', null)).toBe('Total Count');
    expect(autoLabel('COUNT', '*')).toBe('Total Count');
    expect(autoLabel(undefined, undefined)).toBe('Total Count');
  });
  it('anything else is AGG(column)', () => {
    expect(autoLabel('sum', 'students')).toBe('SUM(students)');
    expect(autoLabel('count', 'id')).toBe('COUNT(id)');
    expect(autoLabel('avg', null)).toBe('AVG(*)');
  });
});
