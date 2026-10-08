/** Operators available for conditional formatting rules */
export type ConditionalOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

/** Operators available for text/dimension column conditional formatting rules */
export type TextConditionalOperator = '==' | '!=';

interface BaseConditionalFormattingRule {
  column: string;
  color: string; // hex color e.g. "#C8E6C9"
  /**
   * Optional dimension column name the rule is scoped to.
   * undefined = rule applies at all drill levels.
   * Stored as a column name (not index) so reordering dimensions doesn't break rules.
   */
  level?: string;
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

/** Light pastel preset colors for conditional formatting */
export const PRESET_COLORS = [
  { hex: '#C8E6C9', label: 'Light Green' },
  { hex: '#FFCDD2', label: 'Light Red' },
  { hex: '#FFE0B2', label: 'Light Amber' },
  { hex: '#BBDEFB', label: 'Light Blue' },
  { hex: '#E1BEE7', label: 'Light Purple' },
  { hex: '#B2DFDB', label: 'Light Teal' },
  { hex: '#FFF9C4', label: 'Light Yellow' },
] as const;

/** Operators for conditional formatting with display labels */
export const CONDITIONAL_OPERATORS: Array<{
  value: ConditionalOperator;
  label: string;
}> = [
  { value: '>', label: 'Greater than (>)' },
  { value: '<', label: 'Less than (<)' },
  { value: '>=', label: 'Greater than or equal (>=)' },
  { value: '<=', label: 'Less than or equal (<=)' },
  { value: '==', label: 'Equal to (==)' },
  { value: '!=', label: 'Not equal to (!=)' },
] as const;

/** Operators for text/dimension column conditional formatting */
export const TEXT_CONDITIONAL_OPERATORS: Array<{
  value: TextConditionalOperator;
  label: string;
}> = [
  { value: '==', label: 'Equal to (==)' },
  { value: '!=', label: 'Not equal to (!=)' },
] as const;

/** Regex for validating hex color codes */
export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
