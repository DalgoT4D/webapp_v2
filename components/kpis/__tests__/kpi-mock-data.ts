import type { KPI } from '@/types/kpis';

export function createMockKpi(overrides: Partial<KPI> = {}): KPI {
  return {
    id: 99,
    name: 'Learners reached',
    metric: {
      id: 7,
      name: 'Learners',
      description: null,
      schema_name: 'public',
      table_name: 'learners',
      column: 'id',
      aggregation: 'count',
      column_expression: null,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    },
    target_value: 100,
    direction: 'increase',
    green_threshold_pct: 90,
    amber_threshold_pct: 70,
    time_grain: 'monthly',
    time_dimension_column: null,
    metric_type_tag: 'output',
    program_tags: [],
    display_order: 0,
    extra_config: {},
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    access_level: 'edit',
    ...overrides,
  };
}
