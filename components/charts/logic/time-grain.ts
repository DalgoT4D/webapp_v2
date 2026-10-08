import type { ChartBuilderFormData } from '@/types/charts';
import { isDateAndTimestampColumn } from '@/lib/columnTypeIcons';

const TIME_GRAIN_CHART_TYPES = ['bar', 'line'];

interface DataColumn {
  column_name: string;
  data_type: string;
}

/** The X-axis column when it can take a time grain (bar/line on a date/timestamp column), else undefined. */
export function findTimeGrainColumn<T extends DataColumn>(
  config: ChartBuilderFormData,
  columns: T[]
): T | undefined {
  if (!TIME_GRAIN_CHART_TYPES.includes(config.chart_type || '') || !config.dimension_column) {
    return undefined;
  }
  return columns.find(
    (col) => col.column_name === config.dimension_column && isDateAndTimestampColumn(col.data_type)
  );
}
