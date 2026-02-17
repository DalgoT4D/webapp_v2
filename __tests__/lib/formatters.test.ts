/**
 * Tests for formatters utility
 */

import { formatNumber } from '@/lib/formatters';

describe('formatNumber', () => {
  it.each([
    [null, 'default', ''],
    [undefined, 'default', ''],
    [NaN, 'default', ''],
    [1234567, 'default', '1234567'],
    [1000000, 'international', '1,000,000'],
    [1000000, 'indian', '10,00,000'],
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
    [85.567, { format: 'percentage', decimalPlaces: 1 }, '85.6%'],
    [0.005, { format: 'default', decimalPlaces: 2 }, '0.01'],
    [0, { format: 'international', decimalPlaces: 2 }, '0.00'],
  ])('formatNumber(%s, %j) => %s (with decimal places)', (value, options, expected) => {
    expect(formatNumber(value as number, options as any)).toBe(expected);
  });
});
