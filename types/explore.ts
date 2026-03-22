// types/explore.ts

export interface WarehouseTable {
  id: string;
  name: string;
  schema: string;
  type: 'source' | 'model';
}

export interface TableColumn {
  name: string;
  data_type: string;
}

export interface TableColumnWithType {
  name: string;
  translated_type: 'Numeric' | 'String' | 'Boolean' | 'Datetime' | 'Json';
}

export interface PreviewTableData {
  schema: string;
  table: string;
}

export interface TaskProgress {
  status: 'pending' | 'completed' | 'failed' | 'error';
  results?: NumericStats | StringStats | BooleanStats | DatetimeStats;
}

export interface NumericStats {
  minVal: number;
  maxVal: number;
  mean: number;
  median: number;
  mode: number;
  other_modes?: number[];
  countNull: number;
  countDistinct: number;
}

export interface StringStats {
  charts: Array<{ data: Array<{ category: string; count: number }> }>;
  count: number;
  countNull: number;
  countDistinct: number;
  minVal: number;
  maxVal: number;
  mean: number;
  median: number;
  mode: number;
  other_modes?: number[];
}

export interface BooleanStats {
  count: number;
  countTrue: number;
  countFalse: number;
  countNull: number;
  countDistinct: number;
}

export interface DatetimeStats {
  charts: Array<{
    data: Array<{ year?: number; month?: number; day?: number; frequency: number }>;
  }>;
  minVal: string;
  maxVal: string;
  countNull: number;
  countDistinct: number;
}

export interface MetricsRequest {
  db_schema: string;
  db_table: string;
  column_name: string;
  filter?: {
    range: 'year' | 'month' | 'day';
    limit: number;
    offset: number;
  };
  refresh?: boolean;
}

export interface DbtModelResponse {
  id: string;
  name: string;
  schema: string;
  type: 'source' | 'model';
  display_name: string;
  source_name: string;
  sql_path: string;
  output_cols: string[];
  uuid: string;
}

export interface TreeNode {
  id: string;
  schema: string;
  name?: string;
  type?: 'source' | 'model';
  display_name?: string;
  source_name?: string;
  children?: TreeNode[];
}

export interface SortConfig {
  column: string | null;
  order: 1 | -1;
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
}
