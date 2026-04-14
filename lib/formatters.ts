/**
 * Number and Date formatting utilities for Dalgo charts
 * Formatting happens on frontend for instant preview (Superset-style)
 */

// UI allows 0-10 decimal places; toFixed() accepts 0-100 but we cap at 10 for UX
import { format as dateFnsFormat, isValid, parseISO } from 'date-fns';
export const MAX_DECIMAL_PLACES = 10;

export const NumberFormats = {
  DEFAULT: 'default',
  INTERNATIONAL: 'international',
  INDIAN: 'indian',
  EUROPEAN: 'european',
  PERCENTAGE: 'percentage',
  CURRENCY: 'currency',
  ADAPTIVE_INTERNATIONAL: 'adaptive_international',
  ADAPTIVE_INDIAN: 'adaptive_indian',
} as const;

export type NumberFormat = (typeof NumberFormats)[keyof typeof NumberFormats];

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
/**
 * Date format types supported by the application
 * Based on common strftime-like patterns
 */
export type DateFormat =
  | 'default'
  | 'iso_datetime' // %Y-%m-%d %H:%M:%S | 2019-01-14 01:32:10
  | 'dd_mm_yyyy' // %d/%m/%Y | 14/01/2019
  | 'mm_dd_yyyy' // %m/%d/%Y | 01/14/2019
  | 'yyyy_mm_dd' // %Y-%m-%d | 2019-01-14
  | 'dd_mm_yyyy_time' // %d-%m-%Y %H:%M:%S | 14-01-2019 01:32:10
  | 'time_only'; // %H:%M:%S | 01:32:10

export interface DateFormatOptions {
  format: DateFormat;
}

/**
 * Format a date based on the selected format type
 *
 * @param value - Raw ISO date string from the warehouse (e.g. "2019-01-14T01:32:10" or "2019-01-14T01:32:10Z")
 * @param options - Format options object with a format type
 * @returns Formatted string
 *
 * @example
 * formatDate('2019-01-14T01:32:10', { format: 'iso_datetime' }) // "2019-01-14 01:32:10"
 * formatDate('2019-01-14', { format: 'dd_mm_yyyy' })            // "14/01/2019"
 * formatDate('2025-06-13T00:00:00Z', { format: 'dd_mm_yyyy' }) // "13/06/2025" (formatted in UTC, not local TZ)
 */
export function formatDate(value: string, option: DateFormatOptions): string {
  if (!value) {
    return '';
  }

  const date = parseISO(value);

  // If parseISO fails (e.g. non-standard string), return raw value
  if (!isValid(date)) {
    return value;
  }

  const formatType = option.format;

  // Map our format types to date-fns format patterns
  // 'default' is intentionally excluded — all callers guard against 'default' before calling formatDate
  const formatPatterns: Partial<Record<DateFormat, string>> = {
    iso_datetime: 'yyyy-MM-dd HH:mm:ss', // 2019-01-14 01:32:10
    dd_mm_yyyy: 'dd/MM/yyyy', // 14/01/2019
    mm_dd_yyyy: 'MM/dd/yyyy', // 01/14/2019
    yyyy_mm_dd: 'yyyy-MM-dd', // 2019-01-14
    dd_mm_yyyy_time: 'dd-MM-yyyy HH:mm:ss', // 14-01-2019 01:32:10
    time_only: 'HH:mm:ss', // 01:32:10
  };

  const pattern = formatPatterns[formatType];
  if (!pattern) return value;

  // If the string carries timezone info (Z = UTC, or ±HH:MM offset),
  // strip the suffix and parse as naive — the time components in the string
  // are already in the warehouse timezone, so no conversion is needed.
  if (/Z$|[+-]\d{2}:\d{2}$/.test(value)) {
    const naive = value.replace(/Z$|[+-]\d{2}:\d{2}$/, '');
    return dateFnsFormat(parseISO(naive), pattern);
  }

  return dateFnsFormat(date, pattern);
}

export function formatNumber(value: number, options: FormatOptions | NumberFormat): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '';
  }

  // Support both old (string) and new (object) format
  const format = typeof options === 'string' ? options : options.format;
  const rawDecimalPlaces = typeof options === 'object' ? options.decimalPlaces : undefined;
  // Sanitize decimalPlaces to prevent RangeError in toFixed() (UI allows 0-10)
  const decimalPlaces =
    typeof rawDecimalPlaces === 'number' && Number.isFinite(rawDecimalPlaces)
      ? Math.min(MAX_DECIMAL_PLACES, Math.max(0, rawDecimalPlaces))
      : undefined;

  // Apply decimal places if specified
  const processedValue = decimalPlaces !== undefined ? Number(value.toFixed(decimalPlaces)) : value;

  switch (format) {
    case NumberFormats.DEFAULT:
      // Raw value, with decimal places if specified
      return decimalPlaces !== undefined ? processedValue.toFixed(decimalPlaces) : value.toString();

    case NumberFormats.INTERNATIONAL:
      // 1000000 → 1,000,000
      return processedValue.toLocaleString('en-US', {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      });

    case NumberFormats.INDIAN:
      // 1000000 → 10,00,000
      return processedValue.toLocaleString('en-IN', {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      });

    case NumberFormats.EUROPEAN:
      // 1000000 → 1.000.000 (German locale as representative European format)
      return processedValue.toLocaleString('de-DE', {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      });

    case NumberFormats.PERCENTAGE:
      // 85 → 85%
      const percentValue =
        decimalPlaces !== undefined ? processedValue.toFixed(decimalPlaces) : value.toString();
      return percentValue + '%';

    case NumberFormats.CURRENCY:
      // 1000 → $1,000
      return (
        '$' +
        processedValue.toLocaleString('en-US', {
          minimumFractionDigits: decimalPlaces,
          maximumFractionDigits: decimalPlaces,
        })
      );

    case NumberFormats.ADAPTIVE_INTERNATIONAL: {
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

    case NumberFormats.ADAPTIVE_INDIAN: {
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
