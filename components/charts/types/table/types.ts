/** Operators available for conditional formatting rules */
export type ConditionalOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

/** Operators available for text/dimension column conditional formatting rules */
export type TextConditionalOperator = '==' | '!=';

interface BaseConditionalFormattingRule {
  column: string;
  color: string; // hex color e.g. "#C8E6C9"
}

/** Conditional formatting rule for numeric columns */
export interface NumericConditionalFormattingRule extends BaseConditionalFormattingRule {
  type: 'numeric';
  operator: ConditionalOperator;
  value: number;
}

/** Conditional formatting rule for text/dimension columns */
export interface TextConditionalFormattingRule extends BaseConditionalFormattingRule {
  type: 'text';
  operator: TextConditionalOperator;
  value: string;
}

/**
 * A single conditional formatting rule.
 * Legacy rules (saved without a `type` field) are treated as numeric at runtime.
 */
export type ConditionalFormattingRule =
  | NumericConditionalFormattingRule
  | TextConditionalFormattingRule;

/** Column alignment options */
export type ColumnAlignment = 'left' | 'center' | 'right';

/** Predefined color theme for table and pivot table charts */
export interface TableTheme {
  id: string;
  label: string;
  header: string;
  headerText: string;
  row: string;
  zebraRow: string;
  border: string;
  subtotalRow: string;
  grandTotalRow: string;
  hoverRow: string;
}

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
  /** Color theme id, defaults to 'gray' */
  theme?: string;
}
