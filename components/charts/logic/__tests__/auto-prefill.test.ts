import {
  hasExistingChartConfig,
  hasExistingMapConfig,
} from '@/components/charts/logic/auto-prefill';

describe('hasExistingChartConfig', () => {
  it('is false for a fresh config (aggregate_function alone does not count)', () => {
    expect(hasExistingChartConfig({ chart_type: 'bar', aggregate_function: 'count' })).toBe(false);
    expect(hasExistingChartConfig({ metrics: [], table_columns: [] })).toBe(false);
  });

  it.each([
    ['dimension_column', { dimension_column: 'a' }],
    ['aggregate_column', { aggregate_column: 'a' }],
    ['geographic_column', { geographic_column: 'a' }],
    ['x_axis_column', { x_axis_column: 'a' }],
    ['y_axis_column', { y_axis_column: 'a' }],
    ['table_columns', { table_columns: ['a'] }],
    ['metrics', { metrics: [{ aggregation: 'count' }] }],
  ])('is true with %s', (_name, config) => {
    expect(hasExistingChartConfig(config)).toBe(true);
  });
});

describe('hasExistingMapConfig', () => {
  it('counts value_column but not axis or table fields', () => {
    expect(hasExistingMapConfig({ value_column: 'v' })).toBe(true);
    expect(hasExistingMapConfig({ x_axis_column: 'x', table_columns: ['a'] })).toBe(false);
  });
});
