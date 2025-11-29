/**
 * Column formatting utilities for table charts
 *
 * Provides type-safe formatting for different column types:
 * - currency, percentage, number, date, text
 */

export type ColumnFormatType = 'currency' | 'percentage' | 'date' | 'number' | 'text';

export interface ColumnFormatConfig {
  type?: ColumnFormatType;
  precision?: number;
  prefix?: string;
  suffix?: string;
}

export type ColumnFormattingConfig = Record<string, ColumnFormatConfig>;

/**
 * Individual formatters for each column type
 */
const formatters: Record<ColumnFormatType, (value: any, config: ColumnFormatConfig) => string> = {
  currency: (value, { precision = 2, prefix = '', suffix = '' }) => {
    const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
    return `${prefix}$${numValue.toFixed(precision)}${suffix}`;
  },

  percentage: (value, { precision = 2, prefix = '', suffix = '' }) => {
    const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
    return `${prefix}${(numValue * 100).toFixed(precision)}%${suffix}`;
  },

  number: (value, { precision = 2, prefix = '', suffix = '' }) => {
    const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
    return `${prefix}${numValue.toFixed(precision)}${suffix}`;
  },

  date: (value, { prefix = '', suffix = '' }) => {
    try {
      const dateValue = new Date(value);
      return `${prefix}${dateValue.toLocaleDateString()}${suffix}`;
    } catch {
      return value?.toString() || '';
    }
  },

  text: (value, { prefix = '', suffix = '' }) => {
    return `${prefix}${value?.toString() || ''}${suffix}`;
  },
};

/**
 * Format a cell value based on column formatting configuration
 *
 * @param value - The raw cell value
 * @param column - The column name/key
 * @param columnFormatting - Formatting configuration for all columns
 * @returns Formatted string value
 *
 * @example
 * ```tsx
 * const formatted = formatCellValue(1234.5, 'price', {
 *   price: { type: 'currency', precision: 2 }
 * });
 * // Returns: "$1234.50"
 * ```
 */
export function formatCellValue(
  value: any,
  column: string,
  columnFormatting: ColumnFormattingConfig = {}
): string {
  const formatting = columnFormatting[column];

  // No formatting config or null value - return as string
  if (!formatting || value == null) {
    return value?.toString() || '';
  }

  const { type = 'text', precision = 2, prefix = '', suffix = '' } = formatting;
  const formatter = formatters[type];

  if (!formatter) {
    return value?.toString() || '';
  }

  return formatter(value, { type, precision, prefix, suffix });
}

/**
 * Get sort direction for a column from sort config array
 *
 * @param column - Column name to check
 * @param sortConfig - Array of sort configurations
 * @returns 'asc' | 'desc' | undefined
 */
export function getSortDirection(
  column: string,
  sortConfig: Array<{ column: string; direction: 'asc' | 'desc' }> = []
): 'asc' | 'desc' | undefined {
  const config = sortConfig.find((s) => s.column === column);
  return config?.direction;
}

/**
 * Toggle sort direction for a column
 *
 * @param currentDirection - Current sort direction
 * @returns New sort direction (asc -> desc, desc/undefined -> asc)
 */
export function toggleSortDirection(currentDirection: 'asc' | 'desc' | undefined): 'asc' | 'desc' {
  return currentDirection === 'asc' ? 'desc' : 'asc';
}

/**
 * Extract columns to display from data
 * Prioritizes explicit table_columns config, falls back to data keys
 *
 * @param data - Table data array
 * @param tableColumns - Optional explicit column configuration
 * @returns Array of column names to display
 */
export function extractDisplayColumns(
  data: Record<string, any>[],
  tableColumns?: string[]
): string[] {
  if (tableColumns && tableColumns.length > 0) {
    return tableColumns;
  }
  if (data.length > 0) {
    return Object.keys(data[0]);
  }
  return [];
}
