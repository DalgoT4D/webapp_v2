import type { NumberFormat } from '@/lib/formatters';

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
