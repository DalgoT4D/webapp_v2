import type { ConditionalOperator, TextConditionalOperator, TableTheme } from './types';

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

/** Default theme id used when no theme is specified */
export const DEFAULT_THEME_ID = 'gray';

/** Predefined color themes for table and pivot table charts */
export const TABLE_THEMES: TableTheme[] = [
  {
    id: 'gray',
    label: 'Gray',
    header: '#F3F4F6',
    headerText: '#111827',
    row: '#FFFFFF',
    zebraRow: '#F9FAFB',
    border: '#D1D5DB',
    subtotalRow: '#E5E7EB',
    grandTotalRow: '#D1D5DB',
    hoverRow: '#F9FAFB',
  },
  {
    id: 'blue',
    label: 'Blue',
    header: '#DBEAFE',
    headerText: '#1E3A5F',
    row: '#FFFFFF',
    zebraRow: '#EFF6FF',
    border: '#BFDBFE',
    subtotalRow: '#DBEAFE',
    grandTotalRow: '#BFDBFE',
    hoverRow: '#EFF6FF',
  },
];

/** Look up a theme by id, falling back to the default gray theme */
export function getTableTheme(themeId?: string): TableTheme {
  return TABLE_THEMES.find((t) => t.id === themeId) ?? TABLE_THEMES[0];
}
