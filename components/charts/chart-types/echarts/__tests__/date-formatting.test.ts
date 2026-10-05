/**
 * Tests for Chart Date Formatting Utilities
 */

import {
  createPieDateFormatter,
  applyPieDateFormatting,
  applyLineBarDateFormatting,
} from '@/components/charts/chart-types/echarts/date-formatting';

describe('chart-formatting-utils', () => {
  describe('createPieDateFormatter', () => {
    it('should format a plain date string', () => {
      const formatter = createPieDateFormatter('dd_mm_yyyy');
      expect(formatter('2019-01-14')).toBe('14/01/2019');
    });

    it('should format combined "date - category" names (date is first part)', () => {
      const formatter = createPieDateFormatter('dd_mm_yyyy');
      expect(formatter('2019-01-14 - Electronics')).toBe('14/01/2019 - Electronics');
    });

    it('should format combined "category - date" names (date is second part)', () => {
      const formatter = createPieDateFormatter('dd_mm_yyyy');
      expect(formatter('Electronics - 2019-01-14')).toBe('Electronics - 14/01/2019');
    });

    it('should format combined "date - date" names when both parts are dates', () => {
      const formatter = createPieDateFormatter('dd_mm_yyyy');
      expect(formatter('2019-01-14 - 2020-06-30')).toBe('14/01/2019 - 30/06/2020');
    });

    it('should leave non-date strings unchanged', () => {
      const formatter = createPieDateFormatter('dd_mm_yyyy');
      expect(formatter('Electronics')).toBe('Electronics');
      expect(formatter('Category - SubCategory')).toBe('Category - SubCategory');
    });
  });

  describe('applyPieDateFormatting', () => {
    const makePieConfig = (data = [{ name: '2019-01-14', value: 100 }]) => ({
      series: [{ type: 'pie', label: {}, data }],
      legend: { data: ['2019-01-14'] },
    });

    it('should do nothing when dateFormat is default or missing', () => {
      const config = makePieConfig();
      applyPieDateFormatting(config, {});
      expect((config.series[0] as any).label.formatter).toBeUndefined();

      applyPieDateFormatting(config, { dateFormat: 'default' });
      expect((config.series[0] as any).label.formatter).toBeUndefined();
    });

    it('should format series.data names with date format', () => {
      const config = makePieConfig();
      applyPieDateFormatting(config, { dateFormat: 'dd_mm_yyyy' });
      expect((config.series[0] as any).data[0].name).toBe('14/01/2019');
    });

    it('should format combined "date - category" names in series.data', () => {
      const config = makePieConfig([{ name: '2019-01-14 - Electronics', value: 100 }]);
      applyPieDateFormatting(config, { dateFormat: 'dd_mm_yyyy' });
      expect((config.series[0] as any).data[0].name).toBe('14/01/2019 - Electronics');
    });

    it('should format combined "category - date" names in series.data', () => {
      const config = makePieConfig([{ name: 'Electronics - 2019-01-14', value: 100 }]);
      applyPieDateFormatting(config, { dateFormat: 'dd_mm_yyyy' });
      expect((config.series[0] as any).data[0].name).toBe('Electronics - 14/01/2019');
    });

    it('should update legend.data to match formatted names', () => {
      const config = makePieConfig();
      applyPieDateFormatting(config, { dateFormat: 'dd_mm_yyyy' });
      expect((config.legend as any).data[0]).toBe('14/01/2019');
    });

    it('should update combined legend.data entries correctly', () => {
      const config = {
        series: [
          { type: 'pie', label: {}, data: [{ name: '2019-01-14 - Electronics', value: 100 }] },
        ],
        legend: { data: ['2019-01-14 - Electronics'] },
      };
      applyPieDateFormatting(config, { dateFormat: 'dd_mm_yyyy' });
      expect((config.legend as any).data[0]).toBe('14/01/2019 - Electronics');
    });

    it('should add legend formatter for dates', () => {
      const config = makePieConfig();
      applyPieDateFormatting(config, { dateFormat: 'dd_mm_yyyy' });
      expect(typeof (config.legend as any).formatter).toBe('function');
      expect((config.legend as any).formatter('2019-01-14')).toBe('14/01/2019');
      expect((config.legend as any).formatter('2019-01-14 - Electronics')).toBe(
        '14/01/2019 - Electronics'
      );
    });

    it('should inject label formatter using date format for name', () => {
      const config = makePieConfig();
      applyPieDateFormatting(config, { dateFormat: 'dd_mm_yyyy', labelFormat: 'name_percentage' });
      const formatter = (config.series[0] as any).label.formatter;
      expect(formatter({ value: 100, name: '2019-01-14', percent: 40 })).toBe('14/01/2019\n40%');
    });

    it('should inject label formatter that handles combined names', () => {
      const config = makePieConfig([{ name: '2019-01-14 - Electronics', value: 100 }]);
      applyPieDateFormatting(config, { dateFormat: 'dd_mm_yyyy', labelFormat: 'name_percentage' });
      const formatter = (config.series[0] as any).label.formatter;
      expect(formatter({ value: 100, name: '2019-01-14 - Electronics', percent: 40 })).toBe(
        '14/01/2019 - Electronics\n40%'
      );
    });

    it('should do nothing when series is missing', () => {
      const config: Record<string, unknown> = {};
      applyPieDateFormatting(config, { dateFormat: 'dd_mm_yyyy' });
      expect(config.series).toBeUndefined();
    });
  });

  describe('applyLineBarDateFormatting', () => {
    it('should do nothing when xAxisDateFormat is default or missing', () => {
      const config = { xAxis: { axisLabel: {} } };
      applyLineBarDateFormatting(config, {});
      expect((config.xAxis as any).axisLabel.formatter).toBeUndefined();

      applyLineBarDateFormatting(config, { xAxisDateFormat: 'default' });
      expect((config.xAxis as any).axisLabel.formatter).toBeUndefined();
    });

    it('should apply X-axis date formatter', () => {
      const config = { xAxis: { axisLabel: {} } };
      applyLineBarDateFormatting(config, { xAxisDateFormat: 'dd_mm_yyyy' });
      const formatter = (config.xAxis as any).axisLabel.formatter;
      expect(formatter('2019-01-14')).toBe('14/01/2019');
    });

    it('should apply formatter to each axis when xAxis is an array', () => {
      const config = { xAxis: [{ axisLabel: {} }, { axisLabel: {} }] };
      applyLineBarDateFormatting(config, { xAxisDateFormat: 'yyyy_mm_dd' });
      (config.xAxis as any[]).forEach((axis) => {
        expect(axis.axisLabel.formatter('2019-01-14')).toBe('2019-01-14');
      });
    });

    it('should do nothing when xAxis is missing', () => {
      const config: Record<string, unknown> = {};
      applyLineBarDateFormatting(config, { xAxisDateFormat: 'dd_mm_yyyy' });
      expect(config.xAxis).toBeUndefined();
    });
  });
});
