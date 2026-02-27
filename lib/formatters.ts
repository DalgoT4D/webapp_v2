/**
 * Number and Date formatting utilities for Dalgo charts
 * Formatting happens on frontend for instant preview (Superset-style)
 */

import { format as dateFnsFormat, isValid, parseISO } from 'date-fns';

export type NumberFormat =
  | 'default'
  | 'comma'
  | 'international'
  | 'indian'
  | 'european'
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
 * @param value - Raw date value (Date object, ISO string, or timestamp)
 * @param options - Format options (format type)
 * @returns Formatted string
 *
 * @example
 * formatDate(new Date('2019-01-14T01:32:10'), { format: 'iso_datetime' }) // "2019-01-14 01:32:10"
 * formatDate('2019-01-14', { format: 'dd_mm_yyyy' })                      // "14/01/2019"
 * formatDate(1547429530000, { format: 'time_only' })                      // "01:32:10"
 */
export function formatDate(
  value: Date | string | number,
  options: DateFormatOptions | DateFormat
): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Parse the date value
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string') {
    // Try to parse ISO string first, fallback to Date constructor
    date = parseISO(value);
    if (!isValid(date)) {
      date = new Date(value);
    }
  } else if (typeof value === 'number') {
    date = new Date(value);
  } else {
    return String(value);
  }

  // Check for invalid date using date-fns isValid
  if (!isValid(date)) {
    return String(value);
  }

  // Support both old (string) and new (object) format
  const formatType = typeof options === 'string' ? options : options.format;

  // Map our format types to date-fns format patterns
  const formatPatterns: Record<DateFormat, string> = {
    default: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", // ISO format
    iso_datetime: 'yyyy-MM-dd HH:mm:ss', // 2019-01-14 01:32:10
    dd_mm_yyyy: 'dd/MM/yyyy', // 14/01/2019
    mm_dd_yyyy: 'MM/dd/yyyy', // 01/14/2019
    yyyy_mm_dd: 'yyyy-MM-dd', // 2019-01-14
    dd_mm_yyyy_time: 'dd-MM-yyyy HH:mm:ss', // 14-01-2019 01:32:10
    time_only: 'HH:mm:ss', // 01:32:10
  };

  const pattern = formatPatterns[formatType] || formatPatterns.default;

  // For 'default' format, return ISO string directly to match original behavior
  if (formatType === 'default') {
    return date.toISOString();
  }

  return dateFnsFormat(date, pattern);
}

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

    case 'european':
      // 1000000 → 1.000.000 (German locale as representative European format)
      return processedValue.toLocaleString('de-DE', {
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
