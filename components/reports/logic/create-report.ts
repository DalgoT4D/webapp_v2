import { format } from 'date-fns';
import type { CreateSnapshotPayload, DateColumn, DiscoveredDatetimeColumn } from '@/types/reports';

/** The create-report form (react-hook-form values). */
export interface SnapshotFormData {
  selectedDashboardId: string;
  reportName: string;
  selectedDateColumn: string;
  periodStart: Date | undefined;
  periodEnd: Date | undefined;
}

type ColumnRef = Pick<DiscoveredDatetimeColumn, 'schema_name' | 'table_name' | 'column_name'>;

/** Select value (and option testid suffix) for a discovered column: `schema.table.column`. */
export function toDateColumnValue(col: ColumnRef): string {
  return `${col.schema_name}.${col.table_name}.${col.column_name}`;
}

/** Column chosen for the user: the dashboard's existing datetime filter, else the only column, else none. */
export function pickDefaultDateColumn(
  columns: DiscoveredDatetimeColumn[]
): DiscoveredDatetimeColumn | null {
  const dashboardFilter = columns.find((col) => col.is_dashboard_filter);
  return dashboardFilter ?? (columns.length === 1 ? columns[0] : null);
}

/**
 * Select value → `date_column`. Known limitation kept (reports.md §10; not a PINNED-BUGS row):
 * it splits on every dot, so a schema or table name containing "." produces the wrong parts.
 */
export function splitDateColumnValueOnDots(value: string): DateColumn {
  const [schema_name, table_name, column_name] = value.split('.');
  return { schema_name, table_name, column_name } as DateColumn;
}

/** Start date cannot exceed the earlier of periodEnd or today. */
export function getStartMaxDate(periodEnd: Date | undefined, today: Date): Date {
  return periodEnd && periodEnd < today ? periodEnd : today;
}

/**
 * POST body for a new report. Date fields are sent only when the dashboard has date columns.
 * PINNED-BUGS: "Create race — Generate while "Discovering date columns…" creates report with no `date_column`/`period_end`"
 * — while the columns load, `hasDatetimeColumns` is false, so the chosen range is dropped.
 */
export function buildCreateReportPayload(
  values: Pick<SnapshotFormData, 'reportName' | 'selectedDateColumn' | 'periodStart' | 'periodEnd'>,
  dashboardId: number,
  hasDatetimeColumns: boolean
): CreateSnapshotPayload {
  const payload: CreateSnapshotPayload = {
    title: values.reportName.trim(),
    dashboard_id: dashboardId,
  };

  if (hasDatetimeColumns && values.selectedDateColumn) {
    payload.date_column = splitDateColumnValueOnDots(values.selectedDateColumn);
    payload.period_start = values.periodStart
      ? format(values.periodStart, 'yyyy-MM-dd')
      : undefined;
    payload.period_end = values.periodEnd ? format(values.periodEnd, 'yyyy-MM-dd') : undefined;
  }

  return payload;
}
