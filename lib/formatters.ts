/**
 * Number and Date formatting utilities for Dalgo charts
 * Formatting happens on frontend for instant preview (Superset-style)
 */

export type NumberFormat =
  | 'default'
  | 'comma'
  | 'international'
  | 'indian'
  | 'percentage'
  | 'currency'
  | 'adaptive_international'
  | 'adaptive_indian';

export interface FormatOptions {
  format: NumberFormat;
  decimalPlaces?: number;
}

/**
 * Format a number based on the selected format type and decimal places
 *
 * @param value - Raw numeric value
 * @param options - Format options (format type and decimal places)
 * @returns Formatted string
 *
 * @example
 * formatNumber(1000000, { format: 'international', decimalPlaces: 2 }) // "1,000,000.00"
 * formatNumber(1000000, { format: 'indian' })                          // "10,00,000"
 * formatNumber(85.5, { format: 'percentage' })                         // "85.5%"
 */
export function formatNumber(value: number, options: FormatOptions | NumberFormat): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '';
  }

  // Support both old (string) and new (object) format
  const format = typeof options === 'string' ? options : options.format;
  const decimalPlaces = typeof options === 'object' ? options.decimalPlaces : undefined;

  // Apply decimal places if specified
  const processedValue = decimalPlaces !== undefined ? Number(value.toFixed(decimalPlaces)) : value;

  switch (format) {
    case 'default':
      // Raw value, with decimal places if specified
      return decimalPlaces !== undefined ? processedValue.toFixed(decimalPlaces) : value.toString();

    case 'international':
      // 1000000 → 1,000,000
      return processedValue.toLocaleString('en-US', {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      });

    case 'indian':
      // 1000000 → 10,00,000
      return processedValue.toLocaleString('en-IN', {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      });

    case 'percentage':
      // 85 → 85%
      const percentValue =
        decimalPlaces !== undefined ? processedValue.toFixed(decimalPlaces) : value.toString();
      return percentValue + '%';

    case 'comma':
      // Same as international (for backward compatibility)
      return processedValue.toLocaleString('en-US', {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      });

    case 'currency':
      // 1000 → $1,000
      return (
        '$' +
        processedValue.toLocaleString('en-US', {
          minimumFractionDigits: decimalPlaces,
          maximumFractionDigits: decimalPlaces,
        })
      );

    case 'adaptive_international': {
      // International SI-like notation: K, M, B
      const absValue = Math.abs(processedValue);
      const sign = processedValue < 0 ? '-' : '';
      const decimals = decimalPlaces ?? 2;

      if (absValue >= 1_000_000_000) {
        return sign + (absValue / 1_000_000_000).toFixed(decimals) + 'B';
      } else if (absValue >= 1_000_000) {
        return sign + (absValue / 1_000_000).toFixed(decimals) + 'M';
      } else if (absValue >= 1_000) {
        return sign + (absValue / 1_000).toFixed(decimals) + 'K';
      }
      return decimalPlaces !== undefined ? processedValue.toFixed(decimalPlaces) : value.toString();
    }

    case 'adaptive_indian': {
      // Indian notation: K, L (Lakh), Cr (Crore)
      const absValue = Math.abs(processedValue);
      const sign = processedValue < 0 ? '-' : '';
      const decimals = decimalPlaces ?? 2;

      if (absValue >= 10_000_000) {
        // 1 Crore = 10,000,000
        return sign + (absValue / 10_000_000).toFixed(decimals) + 'Cr';
      } else if (absValue >= 100_000) {
        // 1 Lakh = 100,000
        return sign + (absValue / 100_000).toFixed(decimals) + 'L';
      } else if (absValue >= 1_000) {
        return sign + (absValue / 1_000).toFixed(decimals) + 'K';
      }
      return decimalPlaces !== undefined ? processedValue.toFixed(decimalPlaces) : value.toString();
    }

    default:
      return value.toString();
  }
}
