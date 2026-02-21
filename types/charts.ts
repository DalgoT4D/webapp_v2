// Chart metric configuration for multiple metrics on bar/line charts
export interface ChartMetric {
  column: string | null; // null for COUNT(*) operations
  aggregation: string; // SUM, COUNT, AVG, MAX, MIN, etc.
  alias?: string; // Display name for the metric
}

// Chart dimension configuration for table charts with drill-down support
export interface ChartDimension {
  column: string;
  enable_drill_down?: boolean;
}

// Chart filter configuration
export interface ChartFilter {
  column: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'greater_than'
    | 'less_than'
    | 'greater_than_equal'
    | 'less_than_equal'
    | 'like'
    | 'like_case_insensitive'
    | 'contains'
    | 'not_contains'
    | 'in'
    | 'not_in'
    | 'is_null'
    | 'is_not_null';
  value: any;
  data_type?: string;
}

// Chart pagination configuration
export interface ChartPagination {
  enabled: boolean;
  page_size: number;
}

// Chart sort configuration
export interface ChartSort {
  column: string;
  direction: 'asc' | 'desc';
}

// Dynamic geographic hierarchy interfaces
export interface GeographicLevel {
  level: number;
  column: string;
  region_type: string;
  label: string;
  parent_level?: number;
  parent_column?: string;
}

export interface GeographicHierarchy {
  country_code: string;
  base_level: GeographicLevel;
  drill_down_levels: GeographicLevel[];
  max_depth?: number;
}

// Region hierarchy from backend
export interface RegionHierarchyLevel {
  level: number;
  region_type: string;
  parent_type?: string;
  label: string;
  is_active: boolean;
}

export interface Chart {
  id: number;
  title: string;
  chart_type: 'bar' | 'pie' | 'line' | 'number' | 'map' | 'table';
  computation_type: 'raw' | 'aggregated';
  schema_name: string;
  table_name: string;
  is_favorite?: boolean;
  extra_config: Record<string, any>;
  echarts_config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ChartCreate {
  title: string;
  chart_type: 'bar' | 'pie' | 'line' | 'number' | 'map' | 'table';
  computation_type: 'raw' | 'aggregated';
  schema_name: string;
  table_name: string;
  extra_config: {
    x_axis_column?: string;
    y_axis_column?: string;
    dimension_column?: string;
    aggregate_column?: string;
    aggregate_function?: string;
    extra_dimension_column?: string;
    // Multiple metrics for bar/line charts
    metrics?: ChartMetric[];
    // Time grain for datetime x-axis columns
    time_grain?: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | null;
    // Map-specific fields
    geographic_column?: string;
    value_column?: string;
    selected_geojson_id?: number;
    layers?: Array<{
      id: string;
      level: number;
      name?: string;
      geojson_id?: number;
    }>;
    // Table-specific fields
    table_columns?: string[];
    column_formatting?: Record<
      string,
      {
        type?: 'currency' | 'percentage' | 'date' | 'number' | 'text';
        precision?: number;
        prefix?: string;
        suffix?: string;
      }
    >;
    customizations?: Record<string, any>;
    // Chart-level filters
    filters?: ChartFilter[];
    // Legacy map fields
    district_column?: string;
    ward_column?: string;
    subward_column?: string;
    drill_down_enabled?: boolean;
    // New dynamic geographic hierarchy
    geographic_hierarchy?: GeographicHierarchy;
    // Pagination and sorting
    pagination?: ChartPagination;
    sort?: ChartSort[];
    // Multiple dimensions for table charts with drill-down support
    dimensions?: ChartDimension[];
    dimension_columns?: string[]; // Array of dimension column names for backward compatibility
  };
}

export interface ChartUpdate {
  title?: string;
  chart_type?: 'bar' | 'pie' | 'line' | 'number' | 'map' | 'table';
  computation_type?: 'raw' | 'aggregated';
  schema_name?: string;
  table_name?: string;
  is_favorite?: boolean;
  extra_config?: {
    x_axis_column?: string;
    y_axis_column?: string;
    dimension_column?: string;
    aggregate_column?: string;
    aggregate_function?: string;
    extra_dimension_column?: string;
    // Multiple metrics for bar/line charts
    metrics?: ChartMetric[];
    // Time grain for datetime x-axis columns
    time_grain?: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | null;
    // Map-specific fields
    geographic_column?: string;
    value_column?: string;
    selected_geojson_id?: number;
    layers?: Array<{
      id: string;
      level: number;
      name?: string;
      geojson_id?: number;
    }>;
    // Table-specific fields
    table_columns?: string[];
    column_formatting?: Record<
      string,
      {
        type?: 'currency' | 'percentage' | 'date' | 'number' | 'text';
        precision?: number;
        prefix?: string;
        suffix?: string;
      }
    >;
    customizations?: Record<string, any>;
    // Chart-level filters
    filters?: ChartFilter[];
    // Multiple dimensions for table charts with drill-down support
    dimensions?: ChartDimension[];
    dimension_columns?: string[]; // Array of dimension column names for backward compatibility
  };
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

  // Multiple metrics for bar/line charts
  metrics?: ChartMetric[];

  // Multiple dimensions for table charts
  dimensions?: string[]; // Array of dimension column names for table charts

  // Map-specific fields
  geographic_column?: string;
  value_column?: string;
  selected_geojson_id?: number;

  // Customizations
  customizations?: Record<string, any>;

  // Chart-level configuration
  extra_config?: {
    time_grain?: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | null;
    filters?: ChartFilter[];
    pagination?: ChartPagination;
    sort?: ChartSort[];
  };

  // Dashboard filters
  dashboard_filters?: Array<{
    filter_id: string;
    value: any;
  }>;

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
  name: string;
  data_type: string;
  column_name?: string; // For backward compatibility
  is_nullable?: boolean;
  column_default?: string;
}

export interface TableInfo {
  table_name: string;
  table_schema: string;
  table_type: string;
}

// Extended ChartCreate type for internal ChartBuilder state
export type ChartBuilderFormData = Partial<ChartCreate> & {
  chart_type?: 'bar' | 'pie' | 'line' | 'number' | 'map' | 'table';
  x_axis_column?: string;
  y_axis_column?: string;
  dimension_column?: string;
  aggregate_column?: string;
  aggregate_function?: string;
  extra_dimension_column?: string;
  // Multiple metrics for bar/line charts
  metrics?: ChartMetric[];
  // Time grain for datetime x-axis columns
  time_grain?: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | null;
  // Map-specific fields
  geographic_column?: string;
  value_column?: string;
  selected_geojson_id?: number;
  country_code?: string;
  layer_level?: number;
  // Table-specific fields
  table_columns?: string[];
  column_formatting?: Record<
    string,
    {
      type?: 'currency' | 'percentage' | 'date' | 'number' | 'text';
      precision?: number;
      prefix?: string;
      suffix?: string;
    }
  >;
  // Multiple dimensions for table charts with drill-down support
  dimensions?: ChartDimension[];
  dimension_columns?: string[]; // Array of dimension column names for backward compatibility
  customizations?: Record<string, any>;
  // Chart-level filters
  filters?: ChartFilter[];
  // Table configuration
  pagination?: ChartPagination;
  sort?: ChartSort[];
  // Map layers configuration
  layers?: Array<{
    id: string;
    level: number;
    name?: string;
    geojson_id?: number;
    geographic_column?: string;
    region_id?: number;
    selected_regions?: Array<{
      region_id: number;
      region_name: string;
      geojson_id?: number;
    }>;
  }>;
  // Legacy simplified map configuration (backward compatibility)
  district_column?: string;
  ward_column?: string;
  subward_column?: string;
  drill_down_enabled?: boolean;

  // New dynamic geographic hierarchy
  geographic_hierarchy?: GeographicHierarchy;
  // Preview payloads for maps
  geojsonPreviewPayload?: {
    geojsonId: number;
  };
  dataOverlayPayload?: {
    schema_name: string;
    table_name: string;
    geographic_column: string;
    value_column?: string; // Optional for count operations, falls back to geographic_column
    aggregate_function: string;
    selected_geojson_id: number;
    filters?: Record<string, any>;
    chart_filters?: ChartFilter[];
    time_grain?: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | null;
  };
};
