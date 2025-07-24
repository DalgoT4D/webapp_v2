export interface Chart {
  id: number;
  title: string;
  description?: string;
  chart_type: 'bar' | 'pie' | 'line';
  computation_type: 'raw' | 'aggregated';
  schema_name: string;
  table_name: string;
  x_axis_column?: string;
  y_axis_column?: string;
  dimension_column?: string;
  aggregate_column?: string;
  aggregate_function?: string;
  extra_dimension_column?: string;
  config: Record<string, any>;
  customizations: Record<string, any>;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChartCreate {
  title: string;
  description?: string;
  chart_type: 'bar' | 'pie' | 'line';
  computation_type: 'raw' | 'aggregated';
  schema_name: string;
  table_name: string;
  x_axis_column?: string;
  y_axis_column?: string;
  dimension_column?: string;
  aggregate_column?: string;
  aggregate_function?: string;
  extra_dimension_column?: string;
  customizations?: Record<string, any>;
}

export interface ChartUpdate {
  title?: string;
  description?: string;
  customizations?: Record<string, any>;
  is_favorite?: boolean;
}

export interface ChartDataPayload {
  chart_type: string;
  computation_type: 'raw' | 'aggregated';
  schema_name: string;
  table_name: string;

  // For raw data
  x_axis?: string;
  y_axis?: string;

  // For aggregated data
  dimension_col?: string;
  aggregate_col?: string;
  aggregate_func?: string;
  extra_dimension?: string;

  // Customizations
  customizations?: Record<string, any>;

  // Pagination
  offset?: number;
  limit?: number;
}

export interface ChartDataResponse {
  data: Record<string, any>;
  echarts_config: Record<string, any>;
}

export interface DataPreviewResponse {
  columns: string[];
  column_types: Record<string, string>;
  data: Record<string, any>[];
  total_rows: number;
  page: number;
  page_size: number;
}

export interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default?: string;
}

export interface TableInfo {
  table_name: string;
  table_schema: string;
  table_type: string;
}
