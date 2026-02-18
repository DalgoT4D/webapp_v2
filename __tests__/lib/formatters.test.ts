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
