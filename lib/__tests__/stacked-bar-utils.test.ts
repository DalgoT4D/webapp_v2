import { applyStackedBarLabels, createStackedTotalFormatter } from '../stacked-bar-utils';

describe('stacked-bar-utils', () => {
  describe('createStackedTotalFormatter', () => {
    const seriesArray = [{ data: [10, 20, 30] }, { data: [5, 10, 15] }, { data: [3, 7, 0] }];

    it('should return total for each data index', () => {
      const formatter = createStackedTotalFormatter(seriesArray);
      expect(formatter({ dataIndex: 0 })).toBe('18'); // 10 + 5 + 3
      expect(formatter({ dataIndex: 1 })).toBe('37'); // 20 + 10 + 7
      expect(formatter({ dataIndex: 2 })).toBe('45'); // 30 + 15 + 0
    });

    it('should return empty string when total is zero', () => {
      const zeroSeries = [{ data: [0, 0] }, { data: [0, 0] }];
      const formatter = createStackedTotalFormatter(zeroSeries);
      expect(formatter({ dataIndex: 0 })).toBe('');
    });
  });

  describe('applyStackedBarLabels', () => {
    const stackedConfig = { series: [{ type: 'bar', data: [1, 2], stack: 'total' }] };
    const nonStackedConfig = { series: [{ type: 'bar', data: [1, 2] }] };

    it('should apply labels when stacked and showDataLabels', () => {
      const result = applyStackedBarLabels(stackedConfig, { stacked: true, showDataLabels: true });
      expect(result.series[0].label.position).toBe('top');
      expect(result.series[0].label.show).toBe(true);
    });

    it('should detect stacking from series stack property', () => {
      const result = applyStackedBarLabels(stackedConfig, { showDataLabels: true });
      expect(result.series[0].label.position).toBe('top');
    });

    it('should not modify non-stacked config', () => {
      const result = applyStackedBarLabels(nonStackedConfig, { showDataLabels: true });
      expect(result.series[0].labelLayout).toBeUndefined();
    });

    it('should not modify when showDataLabels is false', () => {
      const result = applyStackedBarLabels(stackedConfig, { stacked: true });
      expect(result.series[0].labelLayout).toBeUndefined();
    });

    it('should only show total on last series', () => {
      const multiSeriesConfig = {
        series: [
          { type: 'bar', data: [10, 20], stack: 'total' },
          { type: 'bar', data: [5, 10], stack: 'total' },
        ],
      };
      const result = applyStackedBarLabels(multiSeriesConfig, { showDataLabels: true });

      // First series should have label.show: false
      expect(result.series[0].label.show).toBe(false);

      // Last series should have label.show: true with formatter
      expect(result.series[1].label.show).toBe(true);
      const lastFormatter = result.series[1].label.formatter;
      expect(lastFormatter({ dataIndex: 0 })).toBe('15'); // 10 + 5
      expect(lastFormatter({ dataIndex: 1 })).toBe('30'); // 20 + 10
    });
  });
});
