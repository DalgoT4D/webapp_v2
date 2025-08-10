// Dashboard Filter Types

export enum DashboardFilterType {
  VALUE = 'value', // Categorical/dropdown filter
  NUMERICAL = 'numerical', // Range/slider filter
}

export enum NumericalFilterMode {
  SINGLE = 'single', // Single value
  RANGE = 'range', // Min/max range
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
  available_values?: Array<{ label: string; value: string }>;
}

export interface NumericalFilterSettings {
  mode: NumericalFilterMode;
  min_value?: number;
  max_value?: number;
  default_min?: number;
  default_max?: number;
  default_value?: number;
  step?: number;
}

export interface ValueFilterConfig extends BaseFilterConfig {
  filter_type: DashboardFilterType.VALUE;
  settings: ValueFilterSettings;
}

export interface NumericalFilterConfig extends BaseFilterConfig {
  filter_type: DashboardFilterType.NUMERICAL;
  settings: NumericalFilterSettings;
}

export type DashboardFilterConfig = ValueFilterConfig | NumericalFilterConfig;

// Filter values for applying to charts
export interface FilterValue {
  filterId: string;
  value: string | string[] | number | { min: number; max: number } | null;
}

export interface AppliedFilters {
  [filterId: string]: string | string[] | number | { min: number; max: number } | null;
}

// Filter creation payload
export interface CreateFilterPayload {
  name: string;
  schema_name: string;
  table_name: string;
  column_name: string;
  filter_type: DashboardFilterType;
  settings: ValueFilterSettings | NumericalFilterSettings;
}

// Filter update payload
export interface UpdateFilterPayload {
  name?: string;
  schema_name?: string;
  table_name?: string;
  column_name?: string;
  filter_type?: DashboardFilterType;
  settings?: ValueFilterSettings | NumericalFilterSettings;
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
