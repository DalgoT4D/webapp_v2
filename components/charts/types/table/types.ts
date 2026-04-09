/** Operators available for conditional formatting rules */
export type ConditionalOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

/** A single conditional formatting rule */
export interface ConditionalFormattingRule {
  column: string;
  operator: ConditionalOperator;
  value: number;
  color: string; // hex color e.g. "#C8E6C9"
}

/** Column alignment options */
export type ColumnAlignment = 'left' | 'center' | 'right';

/** All table customization settings stored in extra_config.customizations */
export interface TableCustomizations {
  /** Existing: per-column number formatting */
  columnFormatting?: Record<
    string,
    {
      numberFormat?: string;
      decimalPlaces?: number;
    }
  >;
  /** Conditional formatting rules */
  conditionalFormatting?: ConditionalFormattingRule[];
  /** Per-column alignment overrides (columns not listed use auto-detection) */
  columnAlignment?: Record<string, ColumnAlignment>;
  /** Enable alternating row backgrounds */
  zebraRows?: boolean;
  /** Pin first column when scrolling horizontally */
  freezeFirstColumn?: boolean;
}
