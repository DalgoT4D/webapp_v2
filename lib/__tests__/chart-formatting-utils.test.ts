/**
 * Tests for Chart Formatting Utilities
 */

import {
  formatAxisValue,
  createTooltipFormatter,
  createPieDimensionFormatter,
  applyNumberChartFormatting,
  applyPieChartFormatting,
  applyLineBarChartFormatting,
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

    it('should preserve date strings instead of parsing them as numbers', () => {
      // Number("2019-01-14") returns NaN, while parseFloat("2019-01-14") returns 2019
      // This ensures date strings are returned as-is, not corrupted to "2,019"
      const withFormat = {
        yAxisNumberFormat: 'international' as const,
        xAxisNumberFormat: 'international' as const,
      };

      // Y-axis: date strings should be preserved
      expect(formatAxisValue('2019-01-14', withFormat, 'y', 'bar')).toBe('2019-01-14');
      expect(formatAxisValue('2025-04-15T10:30:00', withFormat, 'y', 'line')).toBe(
        '2025-04-15T10:30:00'
      );

      // X-axis: date strings should be preserved
      expect(formatAxisValue('2019-01-14', withFormat, 'x', 'bar')).toBe('2019-01-14');
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

  describe('applyNumberChartFormatting', () => {
    it('should format value with given number format', () => {
      const config = { series: [{ type: 'gauge', detail: {} }] };
      applyNumberChartFormatting(config, { numberFormat: 'international' });
      const formatter = (config.series[0] as any).detail.formatter;
      expect(formatter(1234567)).toBe('1,234,567');
    });

    it('should apply decimal places', () => {
      const config = { series: [{ type: 'gauge', detail: {} }] };
      applyNumberChartFormatting(config, { numberFormat: 'international', decimalPlaces: 2 });
      const formatter = (config.series[0] as any).detail.formatter;
      expect(formatter(1234567)).toBe('1,234,567.00');
    });

    it('should apply prefix and suffix', () => {
      const config = { series: [{ type: 'gauge', detail: {} }] };
      applyNumberChartFormatting(config, {
        numberFormat: 'international',
        decimalPlaces: 0,
        numberPrefix: '$',
        numberSuffix: ' USD',
      });
      const formatter = (config.series[0] as any).detail.formatter;
      expect(formatter(1000)).toBe('$1,000 USD');
    });

    it('should use default format when numberFormat is undefined', () => {
      const config = { series: [{ type: 'gauge', detail: {} }] };
      applyNumberChartFormatting(config, {});
      const formatter = (config.series[0] as any).detail.formatter;
      expect(formatter(1000)).toBe('1000');
    });

    it('should do nothing when series is missing', () => {
      const config: Record<string, unknown> = {};
      applyNumberChartFormatting(config, { numberFormat: 'international' });
      expect(config.series).toBeUndefined();
    });

    it('should handle single series object (not array)', () => {
      const config = { series: { type: 'gauge', detail: {} } };
      applyNumberChartFormatting(config, { numberFormat: 'international' });
      const seriesArray = config.series as any[];
      expect(Array.isArray(seriesArray)).toBe(true);
      expect(seriesArray[0].detail.formatter(1000)).toBe('1,000');
    });
  });

  describe('applyPieChartFormatting', () => {
    const makePieConfig = (data = [{ name: 'A', value: 100 }]) => ({
      series: [{ type: 'pie', label: {}, data }],
      legend: { data: ['A'] },
    });

    it('should inject label formatter with percentage as default', () => {
      const config = makePieConfig();
      applyPieChartFormatting(config, {});
      const formatter = (config.series[0] as any).label.formatter;
      expect(formatter({ value: 100, name: 'A', percent: 40 })).toBe('40%');
    });

    it('should return value when labelFormat is value', () => {
      const config = makePieConfig();
      applyPieChartFormatting(config, { labelFormat: 'value', numberFormat: 'international' });
      const formatter = (config.series[0] as any).label.formatter;
      expect(formatter({ value: 1000, name: 'A', percent: 40 })).toBe('1,000');
    });

    it('should format numeric dimension names in series.data', () => {
      const config = makePieConfig([{ name: '1000000', value: 100 }]);
      applyPieChartFormatting(config, { numberFormat: 'international' });
      const data = (config.series[0] as any).data;
      expect(data[0].name).toBe('1,000,000');
    });

    it('should update legend.data to match formatted names', () => {
      const config = {
        series: [{ type: 'pie', label: {}, data: [{ name: '1000000', value: 100 }] }],
        legend: { data: ['1000000'] },
      };
      applyPieChartFormatting(config, { numberFormat: 'international' });
      expect((config.legend as any).data[0]).toBe('1,000,000');
    });

    it('should show/hide data labels based on showDataLabels', () => {
      const configHidden = makePieConfig();
      applyPieChartFormatting(configHidden, { showDataLabels: false });
      expect((configHidden.series[0] as any).label.show).toBe(false);

      const configVisible = makePieConfig();
      applyPieChartFormatting(configVisible, { showDataLabels: true });
      expect((configVisible.series[0] as any).label.show).toBe(true);
    });

    it('should do nothing when series is missing', () => {
      const config: Record<string, unknown> = {};
      applyPieChartFormatting(config, {});
      expect(config.series).toBeUndefined();
    });
  });

  describe('applyLineBarChartFormatting', () => {
    it('should apply Y-axis label formatter with number format', () => {
      const config = { yAxis: { axisLabel: {} } };
      applyLineBarChartFormatting(config, { yAxisNumberFormat: 'international' });
      const formatter = (config.yAxis as any).axisLabel.formatter;
      expect(formatter(1234567)).toBe('1,234,567');
    });

    it('should apply Y-axis label formatter with decimal places only', () => {
      const config = { yAxis: { axisLabel: {} } };
      applyLineBarChartFormatting(config, { yAxisDecimalPlaces: 2 });
      const formatter = (config.yAxis as any).axisLabel.formatter;
      expect(formatter(1234567)).toBe('1234567.00');
    });

    it('should apply X-axis label formatter with number format', () => {
      const config = { xAxis: { axisLabel: {} } };
      applyLineBarChartFormatting(config, { xAxisNumberFormat: 'international' });
      const formatter = (config.xAxis as any).axisLabel.formatter;
      expect(formatter(1234567)).toBe('1,234,567');
    });

    it('should apply X-axis label formatter with decimal places only', () => {
      const config = { xAxis: { axisLabel: {} } };
      applyLineBarChartFormatting(config, { xAxisDecimalPlaces: 2 });
      const formatter = (config.xAxis as any).axisLabel.formatter;
      expect(formatter(1000)).toBe('1000.00');
    });

    it('should apply data label formatter when showDataLabels is true and hasYAxisFormatting', () => {
      const config = { series: [{ type: 'bar', label: {} }] };
      applyLineBarChartFormatting(config, {
        showDataLabels: true,
        yAxisNumberFormat: 'international',
      });
      const formatter = (config.series[0] as any).label.formatter;
      expect(formatter({ value: 1234567 })).toBe('1,234,567');
    });

    it('should not apply data label formatter when showDataLabels is false', () => {
      const config = { series: [{ type: 'bar', label: {} }] };
      applyLineBarChartFormatting(config, {
        showDataLabels: false,
        yAxisNumberFormat: 'international',
      });
      expect((config.series[0] as any).label.formatter).toBeUndefined();
    });

    it('should do nothing when no formatting is configured', () => {
      const config = { yAxis: { axisLabel: {} }, xAxis: { axisLabel: {} } };
      applyLineBarChartFormatting(config, {});
      expect((config.yAxis as any).axisLabel.formatter).toBeUndefined();
      expect((config.xAxis as any).axisLabel.formatter).toBeUndefined();
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
