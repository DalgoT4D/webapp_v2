import type { Chart } from '@/hooks/api/useCharts';

export const makeChart = (patch: Partial<Chart> = {}): Chart => ({
  id: 1,
  title: 'Students',
  chart_type: 'bar',
  computation_type: 'aggregated',
  schema_name: 'public',
  table_name: 'students',
  extra_config: {},
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...patch,
});
