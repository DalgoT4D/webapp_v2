/**
 * Tests for chart-size-constraints utility
 * Tests grid calculations, size validations, and content analysis
 */

import {
  GRID_CONFIG,
  CHART_SIZE_CONSTRAINTS,
  pixelsToGridUnits,
  getMinGridDimensions,
  getDefaultGridDimensions,
  validateGridDimensions,
  adjustToMinimumSize,
  analyzeChartContent,
  type GridDimensions,
} from '@/lib/chart-size-constraints';

describe('chart-size-constraints', () => {
  describe('Constants Validation', () => {
    it('should have valid GRID_CONFIG and size constraints for all chart types', () => {
      // Validate GRID_CONFIG
      expect(GRID_CONFIG.cols).toBe(12);
      expect(GRID_CONFIG.rowHeight).toBe(20);
      expect(GRID_CONFIG.margin).toEqual([10, 10]);

      // Validate all chart type constraints exist and are valid
      const expectedTypes = ['map', 'bar', 'line', 'pie', 'table', 'number', 'text', 'default'];
      expectedTypes.forEach((type) => {
        const constraints = CHART_SIZE_CONSTRAINTS[type];
        expect(constraints).toBeDefined();
        expect(constraints.minWidth).toBeGreaterThan(0);
        expect(constraints.minHeight).toBeGreaterThan(0);
        expect(constraints.defaultWidth).toBeGreaterThanOrEqual(constraints.minWidth);
        expect(constraints.defaultHeight).toBeGreaterThanOrEqual(constraints.minHeight);
      });

      // Validate specific chart type sizes - reduced for responsive dashboard behavior
      // All chart types now use compact minimums (80x40 or 80x20) for flexible dashboard layouts
      expect(CHART_SIZE_CONSTRAINTS.map.minWidth).toBe(80);
      expect(CHART_SIZE_CONSTRAINTS.map.minHeight).toBe(40);
      expect(CHART_SIZE_CONSTRAINTS.bar.minWidth).toBe(80);
      expect(CHART_SIZE_CONSTRAINTS.bar.minHeight).toBe(40);
      expect(CHART_SIZE_CONSTRAINTS.pie.minWidth).toBe(80);
      expect(CHART_SIZE_CONSTRAINTS.pie.minHeight).toBe(40);
      expect(CHART_SIZE_CONSTRAINTS.number.minWidth).toBe(80);
      expect(CHART_SIZE_CONSTRAINTS.number.minHeight).toBe(20);
      expect(CHART_SIZE_CONSTRAINTS.table.minWidth).toBe(80);
      expect(CHART_SIZE_CONSTRAINTS.table.minHeight).toBe(40);
    });
  });

  describe('pixelsToGridUnits', () => {
    it('should convert pixels to grid units correctly for various sizes', () => {
      // Normal conversions
      const width600 = pixelsToGridUnits(600, true);
      const height300 = pixelsToGridUnits(300, false);
      expect(width600).toBeGreaterThan(0);
      expect(Number.isInteger(width600)).toBe(true);
      expect(height300).toBe(Math.ceil(300 / GRID_CONFIG.rowHeight));

      // Small values should return at least 1 grid unit
      expect(pixelsToGridUnits(50, true)).toBeGreaterThanOrEqual(1);
      expect(pixelsToGridUnits(30, false)).toBeGreaterThanOrEqual(1);

      // Large values should work correctly
      expect(pixelsToGridUnits(2000, true)).toBeGreaterThan(0);
      expect(pixelsToGridUnits(2000, false)).toBeGreaterThan(0);
    });

    it('should handle edge case pixel values', () => {
      // Zero pixels
      expect(pixelsToGridUnits(0, true)).toBeGreaterThanOrEqual(0);
      expect(pixelsToGridUnits(0, false)).toBe(0);

      // Negative values would be invalid in practice but should not crash
      const negativeWidth = pixelsToGridUnits(-100, true);
      const negativeHeight = pixelsToGridUnits(-100, false);
      expect(negativeWidth).toBeDefined();
      expect(negativeHeight).toBeDefined();
    });
  });

  describe('getMinGridDimensions', () => {
    it('should return valid minimum grid dimensions for all chart types', () => {
      const chartTypes = ['bar', 'pie', 'map', 'table', 'number', 'text'];

      chartTypes.forEach((type) => {
        const dimensions = getMinGridDimensions(type);
        // With compact minimums (80px width, 40px or 20px height), minimum grid units are 1
        expect(dimensions.w).toBeGreaterThanOrEqual(1);
        expect(dimensions.h).toBeGreaterThanOrEqual(1);
      });
    });

    it('should use default constraints for unknown chart type', () => {
      const unknownDimensions = getMinGridDimensions('unknown-type');
      const defaultDimensions = getMinGridDimensions('default');
      expect(unknownDimensions).toEqual(defaultDimensions);
      // With compact minimums, minimum grid units are 1
      expect(unknownDimensions.w).toBeGreaterThanOrEqual(1);
      expect(unknownDimensions.h).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getDefaultGridDimensions', () => {
    it('should return valid default grid dimensions for all chart types', () => {
      const chartTypes = ['bar', 'pie', 'map', 'table', 'number'];

      chartTypes.forEach((type) => {
        const dimensions = getDefaultGridDimensions(type);
        const minDimensions = getMinGridDimensions(type);

        // Defaults should be positive and not exceed max columns
        expect(dimensions.w).toBeGreaterThan(0);
        expect(dimensions.h).toBeGreaterThan(0);
        expect(dimensions.w).toBeLessThanOrEqual(GRID_CONFIG.cols);

        // Defaults should be >= minimums
        expect(dimensions.w).toBeGreaterThanOrEqual(minDimensions.w);
        expect(dimensions.h).toBeGreaterThanOrEqual(minDimensions.h);
      });
    });

    it('should use default constraints for unknown chart type', () => {
      const unknownDimensions = getDefaultGridDimensions('unknown-type');
      const defaultDimensions = getDefaultGridDimensions('default');
      expect(unknownDimensions).toEqual(defaultDimensions);
    });
  });

  describe('validateGridDimensions', () => {
    it('should validate dimensions that meet or exceed minimum requirements', () => {
      const minDimensions = getMinGridDimensions('bar');

      // Valid: meets minimum
      const exactMin = validateGridDimensions('bar', minDimensions);
      expect(exactMin.isValid).toBe(true);

      // Valid: exceeds minimum
      const aboveMin = validateGridDimensions('bar', {
        w: minDimensions.w + 2,
        h: minDimensions.h + 2,
      });
      expect(aboveMin.isValid).toBe(true);
    });

    it('should invalidate dimensions below minimum requirements', () => {
      const minDimensions = getMinGridDimensions('bar');

      // Invalid: below minimum width
      const belowMinWidth = validateGridDimensions('bar', {
        w: minDimensions.w - 1,
        h: minDimensions.h,
      });
      expect(belowMinWidth.isValid).toBe(false);
      expect(belowMinWidth.minRequired).toBeDefined();

      // Invalid: below minimum height
      const belowMinHeight = validateGridDimensions('bar', {
        w: minDimensions.w,
        h: minDimensions.h - 1,
      });
      expect(belowMinHeight.isValid).toBe(false);

      // Invalid: zero dimensions
      const zeroDimensions = validateGridDimensions('bar', { w: 0, h: 0 });
      expect(zeroDimensions.isValid).toBe(false);
      expect(zeroDimensions.minRequired.w).toBeGreaterThan(0);
      expect(zeroDimensions.minRequired.h).toBeGreaterThan(0);
    });

    it('should return minimum required dimensions for all chart types', () => {
      const chartTypes = ['pie', 'table', 'map', 'number'];

      chartTypes.forEach((type) => {
        const result = validateGridDimensions(type, { w: 1, h: 1 });
        expect(result.minRequired).toBeDefined();
        // With compact minimums, minimum grid units are 1
        expect(result.minRequired.w).toBeGreaterThanOrEqual(1);
        expect(result.minRequired.h).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('adjustToMinimumSize', () => {
    it('should not change dimensions that already meet minimum requirements', () => {
      const largeDimensions: GridDimensions = { w: 8, h: 6 };
      const adjusted = adjustToMinimumSize('bar', largeDimensions);
      expect(adjusted.w).toBeGreaterThanOrEqual(largeDimensions.w);
      expect(adjusted.h).toBeGreaterThanOrEqual(largeDimensions.h);

      const veryLargeDimensions: GridDimensions = { w: 12, h: 10 };
      const adjustedLarge = adjustToMinimumSize('number', veryLargeDimensions);
      expect(adjustedLarge.w).toBeGreaterThanOrEqual(veryLargeDimensions.w);
      expect(adjustedLarge.h).toBeGreaterThanOrEqual(veryLargeDimensions.h);
    });

    it('should adjust dimensions below minimum to meet requirements', () => {
      const minDimensions = getMinGridDimensions('bar');

      // Adjust width only
      const adjustedWidth = adjustToMinimumSize('bar', { w: 1, h: minDimensions.h });
      expect(adjustedWidth.w).toBe(minDimensions.w);
      expect(adjustedWidth.h).toBe(minDimensions.h);

      // Adjust height only
      const adjustedHeight = adjustToMinimumSize('bar', { w: minDimensions.w, h: 1 });
      expect(adjustedHeight.w).toBe(minDimensions.w);
      expect(adjustedHeight.h).toBe(minDimensions.h);

      // Adjust both dimensions
      const adjustedBoth = adjustToMinimumSize('map', { w: 1, h: 1 });
      const minMapDimensions = getMinGridDimensions('map');
      expect(adjustedBoth.w).toBeGreaterThanOrEqual(minMapDimensions.w);
      expect(adjustedBoth.h).toBeGreaterThanOrEqual(minMapDimensions.h);

      // Handle zero dimensions
      const adjustedZero = adjustToMinimumSize('pie', { w: 0, h: 0 });
      expect(adjustedZero.w).toBeGreaterThan(0);
      expect(adjustedZero.h).toBeGreaterThan(0);
    });
  });

  describe('analyzeChartContent', () => {
    it('should return base constraints when no data provided', () => {
      const nullResult = analyzeChartContent(null, 'bar');
      expect(nullResult).toEqual(CHART_SIZE_CONSTRAINTS.bar);

      const undefinedResult = analyzeChartContent(undefined, 'pie');
      expect(undefinedResult).toEqual(CHART_SIZE_CONSTRAINTS.pie);

      const emptyResult = analyzeChartContent({}, 'line');
      expect(emptyResult.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.line.minWidth);
    });

    it('should analyze bar charts with varying data complexity', () => {
      // Few categories
      const fewCategories = {
        xAxis: { data: ['A', 'B', 'C'] },
        series: [{ data: [10, 20, 30] }],
      };
      const resultFew = analyzeChartContent(fewCategories, 'bar');
      expect(resultFew.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.bar.minWidth);
      expect(resultFew.minHeight).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.bar.minHeight);

      // Many categories
      const manyCategories = {
        xAxis: { data: Array.from({ length: 20 }, (_, i) => `Category ${i + 1}`) },
        series: [{ data: Array(20).fill(100) }],
      };
      const resultMany = analyzeChartContent(manyCategories, 'bar');
      expect(resultMany.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.bar.minWidth);

      // Multiple series
      const multipleSeries = {
        xAxis: { data: ['Q1', 'Q2', 'Q3', 'Q4'] },
        series: [
          { name: 'Series 1', data: [10, 20, 30, 40] },
          { name: 'Series 2', data: [15, 25, 35, 45] },
        ],
      };
      const resultMultiple = analyzeChartContent(multipleSeries, 'bar');
      expect(resultMultiple.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.bar.minWidth);
    });

    it('should analyze pie charts with varying slice counts', () => {
      // Few slices
      const fewSlices = {
        series: [
          {
            type: 'pie',
            data: [
              { name: 'A', value: 10 },
              { name: 'B', value: 20 },
              { name: 'C', value: 30 },
            ],
          },
        ],
      };
      const resultFew = analyzeChartContent(fewSlices, 'pie');
      expect(resultFew.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.pie.minWidth);
      expect(resultFew.minHeight).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.pie.minHeight);

      // Many slices
      const manySlices = {
        series: [
          {
            type: 'pie',
            data: Array.from({ length: 12 }, (_, i) => ({
              name: `Slice ${i + 1}`,
              value: 100,
            })),
          },
        ],
      };
      const resultMany = analyzeChartContent(manySlices, 'pie');
      expect(resultMany.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.pie.minWidth);
      expect(resultMany.minHeight).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.pie.minHeight);
    });

    it('should analyze line charts with time series data', () => {
      // Single series
      const singleSeries = {
        xAxis: { data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
        series: [{ type: 'line', data: [120, 200, 150, 180, 220, 250] }],
      };
      const resultSingle = analyzeChartContent(singleSeries, 'line');
      expect(resultSingle.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.line.minWidth);
      expect(resultSingle.minHeight).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.line.minHeight);

      // Multiple series
      const multipleSeries = {
        xAxis: { data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
        series: [
          { name: 'Sales', type: 'line', data: [100, 120, 140, 130, 150] },
          { name: 'Revenue', type: 'line', data: [200, 220, 240, 230, 250] },
          { name: 'Profit', type: 'line', data: [50, 60, 70, 65, 75] },
        ],
      };
      const resultMultiple = analyzeChartContent(multipleSeries, 'line');
      expect(resultMultiple.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.line.minWidth);
    });

    it('should analyze table data with varying column and row counts', () => {
      // Few columns
      const fewColumns = {
        columns: [
          { name: 'ID', width: 80 },
          { name: 'Name', width: 150 },
          { name: 'Amount', width: 100 },
        ],
        rows: Array(5).fill({}),
      };
      const resultFew = analyzeChartContent(fewColumns, 'table');
      expect(resultFew.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.table.minWidth);

      // Many columns - should inflate DEFAULT width (not minimum) for Superset-like flexibility
      const manyColumns = {
        columns: Array.from({ length: 10 }, (_, i) => ({
          name: `Column ${i + 1}`,
          width: 120,
        })),
        rows: Array(10).fill({}),
      };
      const resultMany = analyzeChartContent(manyColumns, 'table');
      // Minimum stays flexible, default increases for many columns
      expect(resultMany.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.table.minWidth);
      expect(resultMany.defaultWidth).toBeGreaterThan(CHART_SIZE_CONSTRAINTS.table.defaultWidth);

      // Many rows - should inflate DEFAULT height (not minimum)
      const manyRows = {
        columns: [{ name: 'Data', width: 100 }],
        data: Array(50).fill({}), // Use 'data' not 'rows' to match actual API
      };
      const resultRows = analyzeChartContent(manyRows, 'table');
      expect(resultRows.minHeight).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.table.minHeight);
      expect(resultRows.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.table.minWidth);
    });

    it('should analyze map and number chart types', () => {
      // Map chart
      const mapData = {
        geo: { map: 'USA' },
        series: [{ type: 'map', data: [] }],
      };
      const mapResult = analyzeChartContent(mapData, 'map');
      expect(mapResult.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.map.minWidth);
      expect(mapResult.minHeight).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.map.minHeight);

      // Number card
      const numberData = { value: 1234567 };
      const numberResult = analyzeChartContent(numberData, 'number');
      expect(numberResult.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.number.minWidth);
      expect(numberResult.minHeight).toBeGreaterThanOrEqual(
        CHART_SIZE_CONSTRAINTS.number.minHeight
      );
    });

    it('should handle edge cases and malformed data gracefully', () => {
      // Empty arrays
      const emptyArrays = {
        xAxis: { data: [] },
        series: [{ data: [] }],
      };
      const emptyResult = analyzeChartContent(emptyArrays, 'bar');
      expect(emptyResult.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.bar.minWidth);

      // Malformed data
      const malformed = { invalid: 'data' };
      const malformedResult = analyzeChartContent(malformed, 'bar');
      expect(malformedResult.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.bar.minWidth);

      // Unknown chart type
      const unknownType = { data: [1, 2, 3] };
      const unknownResult = analyzeChartContent(unknownType, 'unknown-type');
      expect(unknownResult).toEqual(CHART_SIZE_CONSTRAINTS.default);

      // Ensure no negative dimensions
      const noNegatives = analyzeChartContent(null, 'bar');
      expect(noNegatives.minWidth).toBeGreaterThan(0);
      expect(noNegatives.minHeight).toBeGreaterThan(0);
      expect(noNegatives.defaultWidth).toBeGreaterThan(0);
      expect(noNegatives.defaultHeight).toBeGreaterThan(0);
    });
  });
});
