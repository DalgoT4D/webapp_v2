/**
 * Tests for chart-title-utils
 * Tests title resolution, overrides, and editor value handling
 */

import {
  resolveChartTitle,
  isTitleOverridden,
  getTitleEditorValue,
  createTitleUpdateConfig,
  type ChartData,
  type ChartTitleConfig,
} from '@/lib/chart-title-utils';

describe('chart-title-utils', () => {
  const mockChartData: ChartData = {
    id: 1,
    title: 'Original Chart Title',
  };

  describe('resolveChartTitle', () => {
    it('should resolve titles correctly based on config and chart data', () => {
      // No override - return original title
      expect(resolveChartTitle(mockChartData, {})).toBe('Original Chart Title');

      // showTitle false - return null regardless of override
      expect(resolveChartTitle(mockChartData, { showTitle: false })).toBeNull();
      expect(
        resolveChartTitle(mockChartData, { showTitle: false, titleOverride: 'Custom' })
      ).toBeNull();

      // titleOverride provided - return custom title
      expect(resolveChartTitle(mockChartData, { titleOverride: 'Custom Title' })).toBe(
        'Custom Title'
      );

      // titleOverride null - return original
      expect(resolveChartTitle(mockChartData, { titleOverride: null })).toBe(
        'Original Chart Title'
      );

      // titleOverride empty string - return empty string
      expect(resolveChartTitle(mockChartData, { titleOverride: '' })).toBe('');

      // showTitle true with titleOverride - return custom title
      expect(resolveChartTitle(mockChartData, { showTitle: true, titleOverride: 'Custom' })).toBe(
        'Custom'
      );
    });

    it('should handle missing or invalid chart data gracefully', () => {
      // Null chart data without override
      expect(resolveChartTitle(null, {})).toBeNull();

      // Null chart data with override - override takes precedence
      expect(resolveChartTitle(null, { titleOverride: 'Custom' })).toBe('Custom');

      // Undefined chart data without override
      expect(resolveChartTitle(undefined, {})).toBeNull();
      expect(resolveChartTitle(undefined, { showTitle: true })).toBeNull();

      // Chart data without title
      const noTitle = { id: 1, title: '' };
      expect(resolveChartTitle(noTitle as ChartData, {})).toBeNull();
      expect(resolveChartTitle(noTitle as ChartData, { titleOverride: 'Override' })).toBe(
        'Override'
      );

      // Whitespace-only title - treated as valid title (whitespace preserved)
      const whitespaceTitle = { id: 1, title: '   ' } as ChartData;
      expect(resolveChartTitle(whitespaceTitle, {})).toBe('   ');
    });

    it('should handle special characters and edge case values', () => {
      // Special characters
      const specialTitle = 'Sales & Revenue (2024) - Q1 🚀';
      expect(resolveChartTitle(mockChartData, { titleOverride: specialTitle })).toBe(specialTitle);

      // Very long titles
      const longTitle = 'A'.repeat(500);
      const result = resolveChartTitle(mockChartData, { titleOverride: longTitle });
      expect(result).toBe(longTitle);
      expect(result?.length).toBe(500);

      // Whitespace preservation
      expect(resolveChartTitle(mockChartData, { titleOverride: '   ' })).toBe('   ');

      // HTML entities
      const htmlTitle = 'Sales &amp; Revenue &lt;2024&gt;';
      expect(resolveChartTitle(mockChartData, { titleOverride: htmlTitle })).toBe(htmlTitle);

      // Emojis only
      expect(resolveChartTitle(mockChartData, { titleOverride: '📊 📈 💰' })).toBe('📊 📈 💰');

      // Numeric strings
      expect(resolveChartTitle(mockChartData, { titleOverride: '12345' })).toBe('12345');
    });
  });

  describe('isTitleOverridden', () => {
    it('should detect when title is overridden in various scenarios', () => {
      // No override
      expect(isTitleOverridden(mockChartData, {})).toBe(false);
      expect(isTitleOverridden(mockChartData, { showTitle: false })).toBe(false);

      // Override present (any value including null or empty string)
      expect(isTitleOverridden(mockChartData, { titleOverride: 'Custom Title' })).toBe(true);
      expect(isTitleOverridden(mockChartData, { titleOverride: null })).toBe(true);
      expect(isTitleOverridden(mockChartData, { titleOverride: '' })).toBe(true);

      // showTitle doesn't affect override detection
      expect(isTitleOverridden(mockChartData, { showTitle: true, titleOverride: 'Custom' })).toBe(
        true
      );
    });

    it('should handle missing chart data', () => {
      const configWithOverride = { titleOverride: 'Custom' };
      expect(isTitleOverridden(null, configWithOverride)).toBe(true);
      expect(isTitleOverridden(undefined, configWithOverride)).toBe(true);
      expect(isTitleOverridden(null, {})).toBe(false);
    });
  });

  describe('getTitleEditorValue', () => {
    it('should return correct editor value based on chart data and config', () => {
      // No override - return original title
      expect(getTitleEditorValue(mockChartData, {})).toBe('Original Chart Title');

      // Override present - return override
      expect(getTitleEditorValue(mockChartData, { titleOverride: 'Custom' })).toBe('Custom');

      // Empty override - return empty string
      expect(getTitleEditorValue(mockChartData, { titleOverride: '' })).toBe('');

      // Null override - return original
      expect(getTitleEditorValue(mockChartData, { titleOverride: null })).toBe(
        'Original Chart Title'
      );

      // showTitle false - return empty string
      expect(getTitleEditorValue(mockChartData, { showTitle: false })).toBe('');

      // showTitle false with override - returns empty (getTitleEditorValue calls resolveChartTitle which respects showTitle)
      expect(
        getTitleEditorValue(mockChartData, { showTitle: false, titleOverride: 'Custom' })
      ).toBe('');
    });

    it('should handle missing chart data appropriately', () => {
      // Null/undefined chart data without override
      expect(getTitleEditorValue(null, {})).toBe('');
      expect(getTitleEditorValue(undefined, {})).toBe('');

      // Null/undefined chart data with override
      expect(getTitleEditorValue(null, { titleOverride: 'Custom' })).toBe('Custom');
      expect(getTitleEditorValue(undefined, { titleOverride: 'Override' })).toBe('Override');

      // Chart data without title
      const noTitle = { id: 1, title: '' } as ChartData;
      expect(getTitleEditorValue(noTitle, {})).toBe('');
      expect(getTitleEditorValue(noTitle, { titleOverride: 'Override' })).toBe('Override');
    });

    it('should preserve special characters and formatting in editor', () => {
      // Special characters
      const specialTitle = 'Revenue (2024) - $1.5M 🎉';
      expect(getTitleEditorValue(mockChartData, { titleOverride: specialTitle })).toBe(
        specialTitle
      );

      // Whitespace preservation
      expect(getTitleEditorValue(mockChartData, { titleOverride: '  Spaced Title  ' })).toBe(
        '  Spaced Title  '
      );

      // Unicode
      const unicodeTitle = 'Revenue 数据 مبيعات Доход';
      expect(getTitleEditorValue(mockChartData, { titleOverride: unicodeTitle })).toBe(
        unicodeTitle
      );
    });
  });

  describe('createTitleUpdateConfig', () => {
    it('should create correct config for various new title values', () => {
      // Null - revert to original (clear override)
      expect(createTitleUpdateConfig(null)).toEqual({
        titleOverride: undefined,
        showTitle: true,
      });

      // Empty string - hide title
      expect(createTitleUpdateConfig('')).toEqual({
        titleOverride: '',
        showTitle: false,
      });

      // Custom title - set override and show
      expect(createTitleUpdateConfig('New Custom Title')).toEqual({
        titleOverride: 'New Custom Title',
        showTitle: true,
      });

      // Whitespace-only - treated as custom title
      expect(createTitleUpdateConfig('   ')).toEqual({
        titleOverride: '   ',
        showTitle: true,
      });
    });

    it('should handle edge case title values', () => {
      // Long titles
      const longTitle = 'Very Long Title '.repeat(20);
      expect(createTitleUpdateConfig(longTitle)).toEqual({
        titleOverride: longTitle,
        showTitle: true,
      });

      // Special characters
      const specialTitle = 'Sales & Growth (2024) - Q1/Q2 📊';
      expect(createTitleUpdateConfig(specialTitle)).toEqual({
        titleOverride: specialTitle,
        showTitle: true,
      });

      // Multiline titles
      const multilineTitle = 'Line 1\nLine 2\nLine 3';
      expect(createTitleUpdateConfig(multilineTitle)).toEqual({
        titleOverride: multilineTitle,
        showTitle: true,
      });

      // Unicode
      const unicodeTitle = 'Revenue 数据 مبيعات Доход';
      expect(createTitleUpdateConfig(unicodeTitle)).toEqual({
        titleOverride: unicodeTitle,
        showTitle: true,
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete title editing workflows', () => {
      const chartData: ChartData = { id: 1, title: 'Dashboard Chart' };

      // Workflow 1: User views chart → sees original title
      expect(resolveChartTitle(chartData, {})).toBe('Dashboard Chart');
      expect(getTitleEditorValue(chartData, {})).toBe('Dashboard Chart');
      expect(isTitleOverridden(chartData, {})).toBe(false);

      // Workflow 2: User edits title → creates override
      const config1 = createTitleUpdateConfig('Custom Chart');
      expect(config1.titleOverride).toBe('Custom Chart');
      expect(resolveChartTitle(chartData, config1)).toBe('Custom Chart');
      expect(isTitleOverridden(chartData, config1)).toBe(true);
      expect(getTitleEditorValue(chartData, config1)).toBe('Custom Chart');

      // Workflow 3: User hides title → title hidden but override preserved in editor
      const config2 = createTitleUpdateConfig('');
      expect(config2.showTitle).toBe(false);
      expect(resolveChartTitle(chartData, config2)).toBeNull();

      // Workflow 4: User resets to original → clears override
      const config3 = createTitleUpdateConfig(null as any);
      expect(config3.titleOverride).toBeUndefined();
      expect(resolveChartTitle(chartData, config3)).toBe('Dashboard Chart');
      expect(isTitleOverridden(chartData, config3)).toBe(false);

      // Workflow 5: Full lifecycle test
      const lifecycle = [
        { config: {}, expected: 'Dashboard Chart' },
        { config: { titleOverride: 'Override' }, expected: 'Override' },
        { config: createTitleUpdateConfig(''), expected: null },
        { config: createTitleUpdateConfig(null as any), expected: 'Dashboard Chart' },
      ];

      lifecycle.forEach(({ config, expected }) => {
        expect(resolveChartTitle(chartData, config as ChartTitleConfig)).toBe(expected);
      });
    });

    it('should handle edge cases in complete workflows', () => {
      // Chart with empty original title
      const emptyOriginal: ChartData = { id: 1, title: '' };
      expect(resolveChartTitle(emptyOriginal, {})).toBeNull();
      expect(getTitleEditorValue(emptyOriginal, {})).toBe('');

      const customConfig = { titleOverride: 'Custom Title' };
      expect(resolveChartTitle(emptyOriginal, customConfig)).toBe('Custom Title');
      expect(getTitleEditorValue(emptyOriginal, customConfig)).toBe('Custom Title');

      // Missing chart data with override - override takes precedence
      expect(resolveChartTitle(null, customConfig)).toBe('Custom Title');
      expect(getTitleEditorValue(null, customConfig)).toBe('Custom Title');

      // Concurrent config updates
      const config1 = createTitleUpdateConfig('Title 1');
      const config2 = createTitleUpdateConfig('Title 2');
      expect(resolveChartTitle(mockChartData, config1)).toBe('Title 1');
      expect(resolveChartTitle(mockChartData, config2)).toBe('Title 2');
    });

    it('should maintain title override state correctly across operations', () => {
      const config: ChartTitleConfig = { titleOverride: 'Override' };

      // All utilities should work consistently with same config
      expect(isTitleOverridden(mockChartData, config)).toBe(true);
      expect(getTitleEditorValue(mockChartData, config)).toBe('Override');
      expect(resolveChartTitle(mockChartData, config)).toBe('Override');

      // Editor value → config → resolved title flow
      const editorValue = 'User Entered Title';
      const newConfig = createTitleUpdateConfig(editorValue);
      expect(resolveChartTitle(mockChartData, newConfig)).toBe(editorValue);
      expect(getTitleEditorValue(mockChartData, newConfig)).toBe(editorValue);
    });
  });
});
