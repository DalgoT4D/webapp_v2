/**
 * Tests for formatters utility
 */

import { formatNumber, formatDate } from '@/lib/formatters';

describe('formatNumber', () => {
  it.each([
    [null, 'default', ''],
    [undefined, 'default', ''],
    [NaN, 'default', ''],
    [1234567, 'default', '1234567'],
    [1000000, 'international', '1,000,000'],
    [1000000, 'indian', '10,00,000'],
    [1000000, 'european', '1.000.000'],
    [85.5, 'percentage', '85.5%'],
    [1000, 'currency', '$1,000'],
    [1000000, 'comma', '1,000,000'],
    [-1234567, 'international', '-1,234,567'],
    [0, 'international', '0'],
    [0, 'indian', '0'],
  ])('formatNumber(%s, %s) => %s', (value, format, expected) => {
    expect(formatNumber(value as any, format as any)).toBe(expected);
  });

  it.each([
    [1234.567, { format: 'default', decimalPlaces: 2 }, '1234.57'],
    [1234567, { format: 'international', decimalPlaces: 2 }, '1,234,567.00'],
    [1234567, { format: 'indian', decimalPlaces: 2 }, '12,34,567.00'],
    [1234567, { format: 'european', decimalPlaces: 2 }, '1.234.567,00'],
    [85.567, { format: 'percentage', decimalPlaces: 1 }, '85.6%'],
    [0.005, { format: 'default', decimalPlaces: 2 }, '0.01'],
    [0, { format: 'international', decimalPlaces: 2 }, '0.00'],
  ])('formatNumber(%s, %j) => %s (with decimal places)', (value, options, expected) => {
    expect(formatNumber(value as number, options as any)).toBe(expected);
  });

  // Adaptive International (K, M, B)
  it.each([
    [500, 'adaptive_international', '500'],
    [1000, 'adaptive_international', '1.00K'],
    [1234567, 'adaptive_international', '1.23M'],
    [1500000000, 'adaptive_international', '1.50B'],
    [-2500000, 'adaptive_international', '-2.50M'],
    [0, 'adaptive_international', '0'],
  ])('formatNumber(%s, %s) => %s (adaptive international)', (value, format, expected) => {
    expect(formatNumber(value as number, format as any)).toBe(expected);
  });

  // Adaptive Indian (K, L, Cr)
  it.each([
    [500, 'adaptive_indian', '500'],
    [1000, 'adaptive_indian', '1.00K'],
    [100000, 'adaptive_indian', '1.00L'],
    [1234567, 'adaptive_indian', '12.35L'],
    [10000000, 'adaptive_indian', '1.00Cr'],
    [150000000, 'adaptive_indian', '15.00Cr'],
    [-5000000, 'adaptive_indian', '-50.00L'],
    [0, 'adaptive_indian', '0'],
  ])('formatNumber(%s, %s) => %s (adaptive indian)', (value, format, expected) => {
    expect(formatNumber(value as number, format as any)).toBe(expected);
  });

  // Adaptive with custom decimal places
  it.each([
    [1234567, { format: 'adaptive_international', decimalPlaces: 1 }, '1.2M'],
    [1234567, { format: 'adaptive_indian', decimalPlaces: 1 }, '12.3L'],
    [1500000000, { format: 'adaptive_international', decimalPlaces: 3 }, '1.500B'],
    [150000000, { format: 'adaptive_indian', decimalPlaces: 0 }, '15Cr'],
  ])('formatNumber(%s, %j) => %s (adaptive with decimal places)', (value, options, expected) => {
    expect(formatNumber(value as number, options as any)).toBe(expected);
  });
});

describe('formatDate', () => {
  // Use a fixed date for testing: 2019-01-14 01:32:10 UTC
  const testDate = new Date('2019-01-14T01:32:10.000Z');
  const testDateString = '2019-01-14T01:32:10.000Z';
  const testTimestamp = testDate.getTime();

  it.each([
    [null, 'default', ''],
    [undefined, 'default', ''],
  ])('formatDate(%s, %s) => %s (null/undefined)', (value, format, expected) => {
    expect(formatDate(value as any, format as any)).toBe(expected);
  });

  it('should return original value for invalid date strings', () => {
    expect(formatDate('not-a-date', 'iso_datetime')).toBe('not-a-date');
  });

  it('should format Date object with iso_datetime format', () => {
    const result = formatDate(testDate, 'iso_datetime');
    // The result depends on local timezone, so we check the pattern
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('should format Date object with dd_mm_yyyy format', () => {
    const result = formatDate(testDate, 'dd_mm_yyyy');
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('should format Date object with mm_dd_yyyy format', () => {
    const result = formatDate(testDate, 'mm_dd_yyyy');
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('should format Date object with yyyy_mm_dd format', () => {
    const result = formatDate(testDate, 'yyyy_mm_dd');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should format Date object with dd_mm_yyyy_time format', () => {
    const result = formatDate(testDate, 'dd_mm_yyyy_time');
    expect(result).toMatch(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/);
  });

  it('should format Date object with time_only format', () => {
    const result = formatDate(testDate, 'time_only');
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('should format string date input', () => {
    const result = formatDate(testDateString, 'yyyy_mm_dd');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should format timestamp number input', () => {
    const result = formatDate(testTimestamp, 'yyyy_mm_dd');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should accept options object format', () => {
    const result = formatDate(testDate, { format: 'dd_mm_yyyy' });
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('should return ISO string for default format', () => {
    const result = formatDate(testDate, 'default');
    expect(result).toBe(testDate.toISOString());
  });

  // Test specific date values (using local timezone adjusted expectations)
  it('should format a known date correctly with yyyy_mm_dd', () => {
    // Create a date in local timezone to avoid timezone issues
    const localDate = new Date(2019, 0, 14, 1, 32, 10); // Month is 0-indexed
    const result = formatDate(localDate, 'yyyy_mm_dd');
    expect(result).toBe('2019-01-14');
  });

  it('should format a known date correctly with dd_mm_yyyy', () => {
    const localDate = new Date(2019, 0, 14, 1, 32, 10);
    const result = formatDate(localDate, 'dd_mm_yyyy');
    expect(result).toBe('14/01/2019');
  });

  it('should format a known date correctly with mm_dd_yyyy', () => {
    const localDate = new Date(2019, 0, 14, 1, 32, 10);
    const result = formatDate(localDate, 'mm_dd_yyyy');
    expect(result).toBe('01/14/2019');
  });

  it('should format a known date correctly with time_only', () => {
    const localDate = new Date(2019, 0, 14, 1, 32, 10);
    const result = formatDate(localDate, 'time_only');
    expect(result).toBe('01:32:10');
  });

  it('should format a known date correctly with iso_datetime', () => {
    const localDate = new Date(2019, 0, 14, 1, 32, 10);
    const result = formatDate(localDate, 'iso_datetime');
    expect(result).toBe('2019-01-14 01:32:10');
  });

  it('should format a known date correctly with dd_mm_yyyy_time', () => {
    const localDate = new Date(2019, 0, 14, 1, 32, 10);
    const result = formatDate(localDate, 'dd_mm_yyyy_time');
    expect(result).toBe('14-01-2019 01:32:10');
  });
});
