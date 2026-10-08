import {
  buildCreateReportPayload,
  getStartMaxDate,
  pickDefaultDateColumn,
  splitDateColumnValueOnDots,
  toDateColumnValue,
  type SnapshotFormData,
} from '@/components/reports/logic/create-report';
import type { DiscoveredDatetimeColumn } from '@/types/reports';

const column = (overrides: Partial<DiscoveredDatetimeColumn> = {}): DiscoveredDatetimeColumn => ({
  schema_name: 'public',
  table_name: 'sales',
  column_name: 'created_at',
  data_type: 'timestamp',
  is_dashboard_filter: false,
  ...overrides,
});

const form = (overrides: Partial<SnapshotFormData> = {}): SnapshotFormData => ({
  selectedDashboardId: '7',
  reportName: '  Q3 report  ',
  selectedDateColumn: 'public.sales.created_at',
  periodStart: new Date(2025, 0, 5),
  periodEnd: new Date(2025, 2, 31),
  ...overrides,
});

describe('date column choice', () => {
  it('toDateColumnValue joins schema.table.column', () => {
    expect(toDateColumnValue(column())).toBe('public.sales.created_at');
  });

  it("picks the dashboard's existing datetime filter first", () => {
    const filterColumn = column({ column_name: 'visit_date', is_dashboard_filter: true });
    expect(pickDefaultDateColumn([column(), filterColumn])).toBe(filterColumn);
  });

  it('picks the only column when there is exactly one', () => {
    const only = column();
    expect(pickDefaultDateColumn([only])).toBe(only);
  });

  it('picks nothing when there are several and none is a dashboard filter, or none at all', () => {
    expect(pickDefaultDateColumn([column(), column({ column_name: 'updated_at' })])).toBeNull();
    expect(pickDefaultDateColumn([])).toBeNull();
  });

  it('splits the select value on dots', () => {
    expect(splitDateColumnValueOnDots('public.sales.created_at')).toEqual({
      schema_name: 'public',
      table_name: 'sales',
      column_name: 'created_at',
    });
  });

  it('a dot inside a schema name breaks the split (known limitation kept)', () => {
    expect(splitDateColumnValueOnDots('my.schema.sales.created_at')).toEqual({
      schema_name: 'my',
      table_name: 'schema',
      column_name: 'sales',
    });
  });
});

describe('getStartMaxDate', () => {
  const today = new Date(2025, 5, 15);

  it('is the end date when it is before today', () => {
    const end = new Date(2025, 2, 31);
    expect(getStartMaxDate(end, today)).toBe(end);
  });

  it('is today when the end date is today or later, or not set', () => {
    expect(getStartMaxDate(new Date(2025, 5, 15), today)).toBe(today);
    expect(getStartMaxDate(new Date(2025, 11, 1), today)).toBe(today);
    expect(getStartMaxDate(undefined, today)).toBe(today);
  });
});

describe('buildCreateReportPayload', () => {
  it('sends the trimmed name, dashboard and the date range as yyyy-MM-dd', () => {
    expect(buildCreateReportPayload(form(), 7, true)).toEqual({
      title: 'Q3 report',
      dashboard_id: 7,
      date_column: { schema_name: 'public', table_name: 'sales', column_name: 'created_at' },
      period_start: '2025-01-05',
      period_end: '2025-03-31',
    });
  });

  it('keeps the key order of today (title, dashboard_id, date_column, period_start, period_end)', () => {
    expect(Object.keys(buildCreateReportPayload(form(), 7, true))).toEqual([
      'title',
      'dashboard_id',
      'date_column',
      'period_start',
      'period_end',
    ]);
  });

  it('no start date → period_start present but undefined (dropped from JSON)', () => {
    const payload = buildCreateReportPayload(form({ periodStart: undefined }), 7, true);
    expect(JSON.stringify(payload)).toBe(
      '{"title":"Q3 report","dashboard_id":7,"date_column":{"schema_name":"public","table_name":"sales","column_name":"created_at"},"period_end":"2025-03-31"}'
    );
  });

  it('dashboard without date columns: no date fields', () => {
    expect(buildCreateReportPayload(form({ selectedDateColumn: '' }), 7, false)).toEqual({
      title: 'Q3 report',
      dashboard_id: 7,
    });
  });

  it('pinned create race: columns still loading (hasDatetimeColumns false) drops the chosen range', () => {
    expect(buildCreateReportPayload(form(), 7, false)).toEqual({
      title: 'Q3 report',
      dashboard_id: 7,
    });
  });
});
