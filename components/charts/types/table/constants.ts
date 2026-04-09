import type { ConditionalOperator } from './types';

/** Light pastel preset colors for conditional formatting */
export const PRESET_COLORS = [
  { hex: '#C8E6C9', label: 'Light Green' },
  { hex: '#FFCDD2', label: 'Light Red' },
  { hex: '#FFE0B2', label: 'Light Amber' },
  { hex: '#BBDEFB', label: 'Light Blue' },
  { hex: '#E1BEE7', label: 'Light Purple' },
  { hex: '#B2DFDB', label: 'Light Teal' },
  { hex: '#FFF9C4', label: 'Light Yellow' },
  { hex: '#F8BBD0', label: 'Light Pink' },
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

/** Regex for validating hex color codes */
export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
