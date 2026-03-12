// Dashboard Filter Types

export enum DashboardFilterType {
  VALUE = 'value', // Categorical/dropdown filter
  NUMERICAL = 'numerical', // Range/slider filter
  DATETIME = 'datetime', // Date range filter
}

export enum NumericalFilterUIMode {
  SLIDER = 'slider', // Interactive slider UI
  INPUT = 'input', // Min/Max input fields UI
}

export interface BaseFilterConfig {
  id: string;
  name: string;
  schema_name: string;
  table_name: string;
  column_name: string;
  filter_type: DashboardFilterType;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface ValueFilterSettings {
  has_default_value: boolean;
  default_value?: string | string[];
  can_select_multiple: boolean;
  // Note: available_values are fetched dynamically, not stored in settings
}

export interface NumericalFilterSettings {
  ui_mode: NumericalFilterUIMode; // Choose between slider or input UI
  // Note: min_value, max_value are fetched dynamically from warehouse
  default_min?: number; // User-configured default range minimum
  default_max?: number; // User-configured default range maximum
  step?: number; // UI configuration for slider precision
}

export interface DateTimeFilterSettings {
  // Note: min_date, max_date are fetched dynamically from warehouse
  default_start_date?: string; // User-configured default
  default_end_date?: string; // User-configured default
  date_format?: string; // Display format preference
}

export interface ValueFilterConfig extends BaseFilterConfig {
  filter_type: DashboardFilterType.VALUE;
  settings: ValueFilterSettings;
}

export interface NumericalFilterConfig extends BaseFilterConfig {
  filter_type: DashboardFilterType.NUMERICAL;
  settings: NumericalFilterSettings;
}

export interface DateTimeFilterConfig extends BaseFilterConfig {
  filter_type: DashboardFilterType.DATETIME;
  settings: DateTimeFilterSettings;
}

export type DashboardFilterConfig =
  | ValueFilterConfig
  | NumericalFilterConfig
  | DateTimeFilterConfig;

// Filter values for applying to charts
export interface FilterValue {
  filterId: string;
  value:
    | string
    | string[]
    | number
    | { min: number; max: number }
    | { start_date?: string; end_date?: string }
    | null;
}

export interface AppliedFilters {
  [filterId: string]:
    | string
    | string[]
    | number
    | { min: number; max: number }
    | { start_date?: string; end_date?: string }
    | null;
}

// Filter creation payload
export interface CreateFilterPayload {
  name: string;
  schema_name: string;
  table_name: string;
  column_name: string;
  filter_type: DashboardFilterType;
  settings: ValueFilterSettings | NumericalFilterSettings | DateTimeFilterSettings;
}

// Filter update payload
export interface UpdateFilterPayload {
  name?: string;
  schema_name?: string;
  table_name?: string;
  column_name?: string;
  filter_type?: DashboardFilterType;
  settings?: ValueFilterSettings | NumericalFilterSettings | DateTimeFilterSettings;
}

// API response types
export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

export interface NumericalFilterStats {
  min_value: number;
  max_value: number;
  avg_value: number;
  distinct_count: number;
}
