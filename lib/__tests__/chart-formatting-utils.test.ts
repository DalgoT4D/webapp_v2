/**
 * Tests for Chart Formatting Utilities
 */

import {
  formatAxisValue,
  createTooltipFormatter,
  createYAxisLabelFormatter,
  createXAxisLabelFormatter,
  createDataLabelFormatter,
  createPieDimensionFormatter,
} from '../chart-formatting-utils';

describe('chart-formatting-utils', () => {
  describe('formatAxisValue', () => {
    it('should format Y-axis values for bar/line charts using yAxisNumberFormat', () => {
      const customizations = {
        yAxisNumberFormat: 'adaptive_international' as const,
        yAxisDecimalPlaces: 1,
      };
      expect(formatAxisValue(1500000, customizations, 'y', 'bar')).toBe('1.5M');
      expect(formatAxisValue(1500000, customizations, 'y', 'line')).toBe('1.5M');
      expect(formatAxisValue('1500000', customizations, 'y', 'bar')).toBe('1.5M');
      expect(formatAxisValue('invalid', customizations, 'y', 'bar')).toBe('invalid');
    });

    it('should format X-axis values only when xAxisNumberFormat is explicitly set', () => {
      const withFormat = {
        xAxisNumberFormat: 'adaptive_international' as const,
        xAxisDecimalPlaces: 1,
      };
      const withoutFormat = {};

      expect(formatAxisValue(1500000, withFormat, 'x', 'bar')).toBe('1.5M');
      expect(formatAxisValue(1500000, withoutFormat, 'x', 'bar')).toBe(1500000);
      expect(formatAxisValue('January', withFormat, 'x', 'bar')).toBe('January');
    });

    it('should use numberFormat for non-axis charts (pie)', () => {
      const customizations = { numberFormat: 'adaptive_international' as const, decimalPlaces: 1 };
      expect(formatAxisValue(1500000, customizations, 'y', 'pie')).toBe('1.5M');
    });
  });

  describe('createTooltipFormatter', () => {
    it('should format tooltips for bar/line charts with Y-axis and X-axis formatting', () => {
      const customizations = {
        yAxisNumberFormat: 'adaptive_international' as const,
        yAxisDecimalPlaces: 1,
        xAxisNumberFormat: 'adaptive_international' as const,
        xAxisDecimalPlaces: 0,
      };
      const formatter = createTooltipFormatter(customizations, 'bar');

      // Single series with numeric X-axis
      const result = formatter({
        marker: '<span>●</span>',
        seriesName: 'Sales',
        name: 2000000,
        value: 1500000,
      });
      expect(result).toContain('1.5M');
      expect(result).toContain('2M');
      expect(result).toContain('Sales');
    });

    it('should format multi-series tooltips for line charts', () => {
      const customizations = {
        yAxisNumberFormat: 'adaptive_international' as const,
        yAxisDecimalPlaces: 1,
      };
      const formatter = createTooltipFormatter(customizations, 'line');

      const result = formatter([
        { marker: '●', seriesName: 'Revenue', name: 'Q1', value: 2500000 },
        { marker: '●', seriesName: 'Profit', name: 'Q1', value: 500000 },
      ]);
      expect(result).toContain('2.5M');
      expect(result).toContain('500.0K');
    });

    it('should format pie chart tooltips with percentage', () => {
      const customizations = { numberFormat: 'adaptive_international' as const, decimalPlaces: 1 };
      const formatter = createTooltipFormatter(customizations, 'pie');

      const result = formatter({
        marker: '●',
        seriesName: 'Category',
        name: 'Product A',
        value: 1500000,
        percent: 35.5,
      });
      expect(result).toContain('1.5M');
      expect(result).toContain('35.5%');
    });
  });

  describe('createYAxisLabelFormatter', () => {
    it('should return formatter when yAxisNumberFormat is set, undefined otherwise', () => {
      expect(createYAxisLabelFormatter({})).toBeUndefined();
      expect(createYAxisLabelFormatter({ yAxisNumberFormat: 'default' })).toBeUndefined();

      const formatter = createYAxisLabelFormatter({
        yAxisNumberFormat: 'adaptive_international' as const,
        yAxisDecimalPlaces: 1,
      });
      expect(formatter!(1500000)).toBe('1.5M');
    });
  });

  describe('createXAxisLabelFormatter', () => {
    it('should return formatter when xAxisNumberFormat is set, undefined otherwise', () => {
      expect(createXAxisLabelFormatter({})).toBeUndefined();
      expect(createXAxisLabelFormatter({ xAxisNumberFormat: 'default' })).toBeUndefined();

      const formatter = createXAxisLabelFormatter({
        xAxisNumberFormat: 'adaptive_international' as const,
        xAxisDecimalPlaces: 1,
      });
      expect(formatter!(2500000)).toBe('2.5M');
      expect(formatter!('January')).toBe('January');
    });
  });

  describe('createDataLabelFormatter', () => {
    it('should format data labels using appropriate format based on chart type', () => {
      const barFormatter = createDataLabelFormatter(
        { yAxisNumberFormat: 'adaptive_international' as const, yAxisDecimalPlaces: 1 },
        'bar'
      );
      expect(barFormatter({ value: 1500000 })).toBe('1.5M');

      const pieFormatter = createDataLabelFormatter(
        { numberFormat: 'adaptive_international' as const, decimalPlaces: 1 },
        'pie'
      );
      expect(pieFormatter({ value: 1500000 })).toBe('1.5M');

      const defaultFormatter = createDataLabelFormatter({ yAxisNumberFormat: 'default' }, 'bar');
      expect(defaultFormatter({ value: 1500 })).toBe('1,500');
    });
  });

  describe('createPieDimensionFormatter', () => {
    it('should return raw values when format is default (no formatting)', () => {
      const formatter = createPieDimensionFormatter(undefined, undefined);
      expect(formatter(1000)).toBe('1000');
      expect(formatter(1234567)).toBe('1234567');
      expect(formatter('Maharashtra - 11060148')).toBe('Maharashtra - 11060148');
    });

    it('should format number types with specified format', () => {
      const formatter = createPieDimensionFormatter('adaptive_international', 1);
      expect(formatter(1500000)).toBe('1.5M');
    });

    it('should format bigint types with specified format', () => {
      const formatter = createPieDimensionFormatter('indian', undefined);
      expect(formatter(BigInt(1000000))).toBe('10,00,000');
    });

    it('should format "dimension - extra_dimension" strings with specified format', () => {
      const formatter = createPieDimensionFormatter('international', undefined);
      expect(formatter('Maharashtra - 11060148')).toBe('Maharashtra - 11,060,148');
      expect(formatter('1000 - 2000')).toBe('1,000 - 2,000');
    });

    it('should not format non-numeric strings', () => {
      const formatter = createPieDimensionFormatter('international', undefined);
      expect(formatter('Category A')).toBe('Category A');
      expect(formatter('Product - Description')).toBe('Product - Description');
    });
  });
});
