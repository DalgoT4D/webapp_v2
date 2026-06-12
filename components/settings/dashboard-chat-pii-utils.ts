import type { DashboardChatPIIColumn } from '@/hooks/api/useDashboardAIChat';

type DashboardChatPIIColumnIdentity = Pick<
  DashboardChatPIIColumn,
  'schema_name' | 'table_name' | 'column_name'
>;

export function getDashboardChatPIIColumnKey(column: DashboardChatPIIColumnIdentity) {
  return `${column.schema_name}.${column.table_name}.${column.column_name}`;
}

export function getDashboardChatPIIColumnTestId(column: DashboardChatPIIColumnIdentity) {
  return getDashboardChatPIIColumnKey(column)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}
