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
  type ChartSizeConstraint,
} from '@/lib/chart-size-constraints';

describe('chart-size-constraints', () => {
  describe('Constants', () => {
    it('should have correct GRID_CONFIG values', () => {
      expect(GRID_CONFIG.cols).toBe(12);
      expect(GRID_CONFIG.rowHeight).toBe(60);
      expect(GRID_CONFIG.margin).toEqual([10, 10]);
    });

    it('should have size constraints for all chart types', () => {
      const expectedTypes = ['map', 'bar', 'line', 'pie', 'table', 'number', 'text', 'default'];

      expectedTypes.forEach((type) => {
        expect(CHART_SIZE_CONSTRAINTS[type]).toBeDefined();
        expect(CHART_SIZE_CONSTRAINTS[type].minWidth).toBeGreaterThan(0);
        expect(CHART_SIZE_CONSTRAINTS[type].minHeight).toBeGreaterThan(0);
        expect(CHART_SIZE_CONSTRAINTS[type].defaultWidth).toBeGreaterThanOrEqual(
          CHART_SIZE_CONSTRAINTS[type].minWidth
        );
        expect(CHART_SIZE_CONSTRAINTS[type].defaultHeight).toBeGreaterThanOrEqual(
          CHART_SIZE_CONSTRAINTS[type].minHeight
        );
      });
    });

    it('should have appropriate sizes for map charts', () => {
      expect(CHART_SIZE_CONSTRAINTS.map.minWidth).toBe(500);
      expect(CHART_SIZE_CONSTRAINTS.map.minHeight).toBe(450);
    });

    it('should have appropriate sizes for bar charts', () => {
      expect(CHART_SIZE_CONSTRAINTS.bar.minWidth).toBe(500);
      expect(CHART_SIZE_CONSTRAINTS.bar.minHeight).toBe(480);
    });

    it('should have appropriate sizes for pie charts', () => {
      expect(CHART_SIZE_CONSTRAINTS.pie.minWidth).toBe(450);
      expect(CHART_SIZE_CONSTRAINTS.pie.minHeight).toBe(450);
    });

    it('should have appropriate sizes for number cards', () => {
      expect(CHART_SIZE_CONSTRAINTS.number.minWidth).toBe(320);
      expect(CHART_SIZE_CONSTRAINTS.number.minHeight).toBe(320);
    });

    it('should have appropriate sizes for tables', () => {
      expect(CHART_SIZE_CONSTRAINTS.table.minWidth).toBe(400);
      expect(CHART_SIZE_CONSTRAINTS.table.minHeight).toBe(420);
    });
  });

  describe('pixelsToGridUnits', () => {
    it('should convert width pixels to grid units correctly', () => {
      const result = pixelsToGridUnits(600, true);
      expect(result).toBeGreaterThan(0);
      expect(Number.isInteger(result)).toBe(true);
    });

    it('should convert height pixels to grid units correctly', () => {
      const result = pixelsToGridUnits(300, false);
      expect(result).toBe(Math.ceil(300 / GRID_CONFIG.rowHeight));
    });

    it('should return at least 1 grid unit for small widths', () => {
      const result = pixelsToGridUnits(50, true);
      expect(result).toBeGreaterThanOrEqual(1);
    });

    it('should return at least 1 grid unit for small heights', () => {
      const result = pixelsToGridUnits(30, false);
      expect(result).toBeGreaterThanOrEqual(1);
    });

    it('should handle zero pixels', () => {
      const widthResult = pixelsToGridUnits(0, true);
      const heightResult = pixelsToGridUnits(0, false);
      expect(widthResult).toBeGreaterThanOrEqual(0);
      expect(heightResult).toBe(0);
    });

    it('should handle large pixel values', () => {
      const widthResult = pixelsToGridUnits(2000, true);
      const heightResult = pixelsToGridUnits(2000, false);
      expect(widthResult).toBeGreaterThan(0);
      expect(heightResult).toBeGreaterThan(0);
    });
  });

  describe('getMinGridDimensions', () => {
    it('should return minimum grid dimensions for bar chart', () => {
      const dimensions = getMinGridDimensions('bar');
      expect(dimensions.w).toBeGreaterThanOrEqual(2);
      expect(dimensions.h).toBeGreaterThanOrEqual(2);
    });

    it('should return minimum grid dimensions for pie chart', () => {
      const dimensions = getMinGridDimensions('pie');
      expect(dimensions.w).toBeGreaterThanOrEqual(2);
      expect(dimensions.h).toBeGreaterThanOrEqual(2);
    });

    it('should return minimum grid dimensions for map chart', () => {
      const dimensions = getMinGridDimensions('map');
      expect(dimensions.w).toBeGreaterThanOrEqual(2);
      expect(dimensions.h).toBeGreaterThanOrEqual(2);
    });

    it('should return minimum grid dimensions for table', () => {
      const dimensions = getMinGridDimensions('table');
      expect(dimensions.w).toBeGreaterThanOrEqual(2);
      expect(dimensions.h).toBeGreaterThanOrEqual(2);
    });

    it('should return minimum grid dimensions for number card', () => {
      const dimensions = getMinGridDimensions('number');
      expect(dimensions.w).toBeGreaterThanOrEqual(2);
      expect(dimensions.h).toBeGreaterThanOrEqual(2);
    });

    it('should use default constraints for unknown chart type', () => {
      const dimensions = getMinGridDimensions('unknown-type');
      const defaultDimensions = getMinGridDimensions('default');
      expect(dimensions).toEqual(defaultDimensions);
    });

    it('should ensure minimum of 2 grid units for width', () => {
      const dimensions = getMinGridDimensions('text');
      expect(dimensions.w).toBeGreaterThanOrEqual(2);
    });

    it('should ensure minimum of 2 grid units for height', () => {
      const dimensions = getMinGridDimensions('text');
      expect(dimensions.h).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getDefaultGridDimensions', () => {
    it('should return default grid dimensions for bar chart', () => {
      const dimensions = getDefaultGridDimensions('bar');
      expect(dimensions.w).toBeGreaterThan(0);
      expect(dimensions.h).toBeGreaterThan(0);
      expect(dimensions.w).toBeLessThanOrEqual(GRID_CONFIG.cols);
    });

    it('should return default grid dimensions for pie chart', () => {
      const dimensions = getDefaultGridDimensions('pie');
      expect(dimensions.w).toBeGreaterThan(0);
      expect(dimensions.h).toBeGreaterThan(0);
    });

    it('should not exceed maximum grid columns', () => {
      const dimensions = getDefaultGridDimensions('map');
      expect(dimensions.w).toBeLessThanOrEqual(GRID_CONFIG.cols);
    });

    it('should return larger dimensions than minimum', () => {
      const minDimensions = getMinGridDimensions('bar');
      const defaultDimensions = getDefaultGridDimensions('bar');
      expect(defaultDimensions.w).toBeGreaterThanOrEqual(minDimensions.w);
      expect(defaultDimensions.h).toBeGreaterThanOrEqual(minDimensions.h);
    });

    it('should use default constraints for unknown chart type', () => {
      const dimensions = getDefaultGridDimensions('unknown-type');
      const defaultDimensions = getDefaultGridDimensions('default');
      expect(dimensions).toEqual(defaultDimensions);
    });
  });

  describe('validateGridDimensions', () => {
    it('should validate dimensions that meet minimum requirements', () => {
      const minDimensions = getMinGridDimensions('bar');
      const result = validateGridDimensions('bar', {
        w: minDimensions.w + 2,
        h: minDimensions.h + 2,
      });
      expect(result.isValid).toBe(true);
    });

    it('should invalidate dimensions below minimum width', () => {
      const minDimensions = getMinGridDimensions('bar');
      const result = validateGridDimensions('bar', {
        w: minDimensions.w - 1,
        h: minDimensions.h,
      });
      expect(result.isValid).toBe(false);
    });

    it('should invalidate dimensions below minimum height', () => {
      const minDimensions = getMinGridDimensions('bar');
      const result = validateGridDimensions('bar', {
        w: minDimensions.w,
        h: minDimensions.h - 1,
      });
      expect(result.isValid).toBe(false);
    });

    it('should return minimum required dimensions', () => {
      const result = validateGridDimensions('pie', { w: 1, h: 1 });
      expect(result.minRequired).toBeDefined();
      expect(result.minRequired.w).toBeGreaterThanOrEqual(2);
      expect(result.minRequired.h).toBeGreaterThanOrEqual(2);
    });

    it('should validate exact minimum dimensions as valid', () => {
      const minDimensions = getMinGridDimensions('table');
      const result = validateGridDimensions('table', minDimensions);
      expect(result.isValid).toBe(true);
    });

    it('should handle zero dimensions', () => {
      const result = validateGridDimensions('bar', { w: 0, h: 0 });
      expect(result.isValid).toBe(false);
      expect(result.minRequired.w).toBeGreaterThan(0);
      expect(result.minRequired.h).toBeGreaterThan(0);
    });
  });

  describe('adjustToMinimumSize', () => {
    it('should not change dimensions that meet minimum requirements', () => {
      const originalDimensions: GridDimensions = { w: 8, h: 6 };
      const adjusted = adjustToMinimumSize('bar', originalDimensions);
      expect(adjusted.w).toBeGreaterThanOrEqual(originalDimensions.w);
      expect(adjusted.h).toBeGreaterThanOrEqual(originalDimensions.h);
    });

    it('should increase width to minimum if below', () => {
      const minDimensions = getMinGridDimensions('bar');
      const adjusted = adjustToMinimumSize('bar', { w: 1, h: minDimensions.h });
      expect(adjusted.w).toBe(minDimensions.w);
    });

    it('should increase height to minimum if below', () => {
      const minDimensions = getMinGridDimensions('bar');
      const adjusted = adjustToMinimumSize('bar', { w: minDimensions.w, h: 1 });
      expect(adjusted.h).toBe(minDimensions.h);
    });

    it('should adjust both dimensions if both are below minimum', () => {
      const minDimensions = getMinGridDimensions('map');
      const adjusted = adjustToMinimumSize('map', { w: 1, h: 1 });
      expect(adjusted.w).toBeGreaterThanOrEqual(minDimensions.w);
      expect(adjusted.h).toBeGreaterThanOrEqual(minDimensions.h);
    });

    it('should handle zero dimensions', () => {
      const adjusted = adjustToMinimumSize('pie', { w: 0, h: 0 });
      expect(adjusted.w).toBeGreaterThan(0);
      expect(adjusted.h).toBeGreaterThan(0);
    });

    it('should preserve larger dimensions', () => {
      const largeDimensions: GridDimensions = { w: 12, h: 10 };
      const adjusted = adjustToMinimumSize('number', largeDimensions);
      expect(adjusted.w).toBeGreaterThanOrEqual(largeDimensions.w);
      expect(adjusted.h).toBeGreaterThanOrEqual(largeDimensions.h);
    });
  });

  describe('analyzeChartContent', () => {
    describe('No Data Cases', () => {
      it('should return base constraints when no data provided', () => {
        const result = analyzeChartContent(null, 'bar');
        expect(result).toEqual(CHART_SIZE_CONSTRAINTS.bar);
      });

      it('should return base constraints for undefined data', () => {
        const result = analyzeChartContent(undefined, 'pie');
        expect(result).toEqual(CHART_SIZE_CONSTRAINTS.pie);
      });
    });

    describe('Bar Chart Analysis', () => {
      it('should analyze bar chart with few categories', () => {
        const chartData = {
          xAxis: { data: ['A', 'B', 'C'] },
          series: [{ data: [10, 20, 30] }],
        };
        const result = analyzeChartContent(chartData, 'bar');
        expect(result.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.bar.minWidth);
        expect(result.minHeight).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.bar.minHeight);
      });

      it('should handle bar charts with many categories', () => {
        const manyCategories = Array.from({ length: 20 }, (_, i) => `Category ${i + 1}`);
        const chartData = {
          xAxis: { data: manyCategories },
          series: [{ data: Array(20).fill(100) }],
        };
        const result = analyzeChartContent(chartData, 'bar');
        // Should at least return base constraints
        expect(result.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.bar.minWidth);
        expect(result.minHeight).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.bar.minHeight);
      });

      it('should handle bar chart with multiple series', () => {
        const chartData = {
          xAxis: { data: ['Q1', 'Q2', 'Q3', 'Q4'] },
          series: [
            { name: 'Series 1', data: [10, 20, 30, 40] },
            { name: 'Series 2', data: [15, 25, 35, 45] },
          ],
        };
        const result = analyzeChartContent(chartData, 'bar');
        expect(result.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.bar.minWidth);
      });
    });

    describe('Pie Chart Analysis', () => {
      it('should analyze pie chart with few slices', () => {
        const chartData = {
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
        const result = analyzeChartContent(chartData, 'pie');
        expect(result.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.pie.minWidth);
        expect(result.minHeight).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.pie.minHeight);
      });

      it('should handle pie charts with many slices', () => {
        const manySlices = Array.from({ length: 12 }, (_, i) => ({
          name: `Slice ${i + 1}`,
          value: 100,
        }));
        const chartData = {
          series: [{ type: 'pie', data: manySlices }],
        };
        const result = analyzeChartContent(chartData, 'pie');
        // Should at least return base constraints
        expect(result.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.pie.minWidth);
        expect(result.minHeight).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.pie.minHeight);
      });
    });

    describe('Table Analysis', () => {
      it('should analyze table with few columns', () => {
        const chartData = {
          columns: [
            { name: 'ID', width: 80 },
            { name: 'Name', width: 150 },
            { name: 'Amount', width: 100 },
          ],
          rows: Array(5).fill({}),
        };
        const result = analyzeChartContent(chartData, 'table');
        expect(result.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.table.minWidth);
      });

      it('should increase width for tables with many columns', () => {
        const manyColumns = Array.from({ length: 10 }, (_, i) => ({
          name: `Column ${i + 1}`,
          width: 120,
        }));
        const chartData = {
          columns: manyColumns,
          rows: Array(10).fill({}),
        };
        const result = analyzeChartContent(chartData, 'table');
        expect(result.minWidth).toBeGreaterThan(CHART_SIZE_CONSTRAINTS.table.minWidth);
      });

      it('should handle tables with many rows', () => {
        const chartData = {
          columns: [{ name: 'Data', width: 100 }],
          rows: Array(50).fill({}),
        };
        const result = analyzeChartContent(chartData, 'table');
        // Should at least return base constraints
        expect(result.minHeight).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.table.minHeight);
        expect(result.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.table.minWidth);
      });
    });

    describe('Map Chart Analysis', () => {
      it('should return base constraints for map charts', () => {
        const chartData = {
          geo: { map: 'USA' },
          series: [{ type: 'map', data: [] }],
        };
        const result = analyzeChartContent(chartData, 'map');
        expect(result.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.map.minWidth);
        expect(result.minHeight).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.map.minHeight);
      });
    });

    describe('Number Card Analysis', () => {
      it('should return base constraints for number cards', () => {
        const chartData = { value: 1234567 };
        const result = analyzeChartContent(chartData, 'number');
        expect(result.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.number.minWidth);
        expect(result.minHeight).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.number.minHeight);
      });
    });

    describe('Line Chart Analysis', () => {
      it('should analyze line chart with time series data', () => {
        const chartData = {
          xAxis: {
            data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          },
          series: [
            {
              type: 'line',
              data: [120, 200, 150, 180, 220, 250],
            },
          ],
        };
        const result = analyzeChartContent(chartData, 'line');
        expect(result.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.line.minWidth);
        expect(result.minHeight).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.line.minHeight);
      });

      it('should handle line chart with multiple series', () => {
        const chartData = {
          xAxis: { data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
          series: [
            { name: 'Sales', type: 'line', data: [100, 120, 140, 130, 150] },
            { name: 'Revenue', type: 'line', data: [200, 220, 240, 230, 250] },
            { name: 'Profit', type: 'line', data: [50, 60, 70, 65, 75] },
          ],
        };
        const result = analyzeChartContent(chartData, 'line');
        expect(result.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.line.minWidth);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty data arrays', () => {
        const chartData = {
          xAxis: { data: [] },
          series: [{ data: [] }],
        };
        const result = analyzeChartContent(chartData, 'bar');
        expect(result.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.bar.minWidth);
      });

      it('should handle malformed chart data', () => {
        const chartData = { invalid: 'data' };
        const result = analyzeChartContent(chartData, 'bar');
        expect(result.minWidth).toBeGreaterThanOrEqual(CHART_SIZE_CONSTRAINTS.bar.minWidth);
      });

      it('should use default constraints for unknown chart type', () => {
        const chartData = { data: [1, 2, 3] };
        const result = analyzeChartContent(chartData, 'unknown-type');
        expect(result).toEqual(CHART_SIZE_CONSTRAINTS.default);
      });

      it('should not return negative dimensions', () => {
        const chartData = null;
        const result = analyzeChartContent(chartData, 'bar');
        expect(result.minWidth).toBeGreaterThan(0);
        expect(result.minHeight).toBeGreaterThan(0);
        expect(result.defaultWidth).toBeGreaterThan(0);
        expect(result.defaultHeight).toBeGreaterThan(0);
      });
    });
  });
});
