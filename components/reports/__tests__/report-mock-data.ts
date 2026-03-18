/**
 * Mock Data Factories for Report/Snapshot Tests
 */

import type {
  ReportSnapshot,
  DateColumn,
  DiscoveredDatetimeColumn,
  SnapshotViewData,
  ShareStatus,
} from '@/types/reports';

// ============ Mock Data Factories ============

export const createMockDateColumn = (overrides: Partial<DateColumn> = {}): DateColumn => ({
  schema_name: 'public',
  table_name: 'sales',
  column_name: 'created_at',
  ...overrides,
});

export const createMockSnapshot = (overrides: Partial<ReportSnapshot> = {}): ReportSnapshot => ({
  id: 1,
  title: 'Monthly Sales Report',
  dashboard_title: 'Sales Dashboard',
  date_column: createMockDateColumn(),
  period_start: '2025-01-01',
  period_end: '2025-01-31',
  status: 'generated',
  summary: 'Monthly sales overview for January 2025',
  created_by: 'user@test.com',
  created_at: '2025-01-31T10:00:00Z',
  updated_at: '2025-01-31T10:00:00Z',
  ...overrides,
});

export const createMockDiscoveredDatetimeColumn = (
  overrides: Partial<DiscoveredDatetimeColumn> = {}
): DiscoveredDatetimeColumn => ({
  schema_name: 'public',
  table_name: 'sales',
  column_name: 'created_at',
  data_type: 'timestamp',
  is_dashboard_filter: false,
  ...overrides,
});

export const createMockSnapshotViewData = (
  overrides: Partial<SnapshotViewData> = {}
): SnapshotViewData => ({
  dashboard_data: {
    id: 1,
    title: 'Sales Dashboard',
    components: {},
    filters: [],
    dashboard_type: 'native',
    is_published: true,
    is_locked: false,
    locked_by: null,
    is_public: false,
    created_by: 'user@test.com',
    org_id: 1,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  report_metadata: {
    snapshot_id: 1,
    title: 'Monthly Sales Report',
    date_column: createMockDateColumn(),
    period_start: '2025-01-01',
    period_end: '2025-01-31',
    summary: 'Monthly sales overview',
    status: 'generated',
    created_at: '2025-01-31T10:00:00Z',
    updated_at: '2025-01-31T10:00:00Z',
    created_by: 'user@test.com',
    dashboard_title: 'Sales Dashboard',
  },
  frozen_chart_configs: {},
  ...overrides,
});

export const createMockShareStatus = (overrides: Partial<ShareStatus> = {}): ShareStatus => ({
  is_public: false,
  public_access_count: 0,
  ...overrides,
});

// ============ Default Mock Data ============

export const mockSnapshots: ReportSnapshot[] = [
  createMockSnapshot({ id: 1, title: 'Q1 Sales Report' }),
  createMockSnapshot({
    id: 2,
    title: 'Q2 Sales Report',
    period_start: '2025-04-01',
    period_end: '2025-06-30',
  }),
  createMockSnapshot({
    id: 3,
    title: 'Annual Report 2024',
    status: 'viewed',
    created_by: 'admin@test.com',
  }),
];

export const mockDatetimeColumns: DiscoveredDatetimeColumn[] = [
  createMockDiscoveredDatetimeColumn({
    column_name: 'created_at',
    is_dashboard_filter: true,
  }),
  createMockDiscoveredDatetimeColumn({
    column_name: 'updated_at',
    is_dashboard_filter: false,
  }),
  createMockDiscoveredDatetimeColumn({
    schema_name: 'public',
    table_name: 'orders',
    column_name: 'order_date',
    is_dashboard_filter: false,
  }),
];

export const mockShareStatus: ShareStatus = createMockShareStatus({
  is_public: true,
  public_url: 'http://localhost:3001/share/report/test-token-123',
  public_access_count: 42,
  last_public_accessed: '2025-02-15T14:30:00Z',
  public_shared_at: '2025-02-01T09:00:00Z',
});
