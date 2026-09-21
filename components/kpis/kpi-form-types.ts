import type { NumberFormat } from '@/lib/formatters';

/** Default for newly created KPIs; existing KPI customizations are preserved on edit. */
export const DEFAULT_KPI_DECIMAL_PLACES = '2';

export interface KPIFormData {
  metric_id: number | null;
  name: string;
  target_value: string;
  direction: string;
  green_threshold_pct: string;
  amber_threshold_pct: string;
  time_grain: string;
  time_dimension_column: string;
  metric_type_tag: string;
  program_tags: string[];
  numberFormat: NumberFormat | '';
  decimalPlaces: string;
  numberPrefix: string;
  numberSuffix: string;
}
