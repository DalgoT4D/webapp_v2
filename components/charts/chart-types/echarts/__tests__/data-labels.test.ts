/**
 * Tests for Chart Data Label Rules
 */

import { sanitizeCustomizationsForChartType } from '@/components/charts/chart-types/echarts/data-labels';

describe('chart-formatting-utils', () => {
  describe('sanitizeCustomizationsForChartType', () => {
    it("coerces bar's 'top' to pie's default 'outside' when switching to pie", () => {
      const result = sanitizeCustomizationsForChartType(
        { dataLabelPosition: 'top', showLegend: true },
        'pie'
      );
      expect(result.dataLabelPosition).toBe('outside');
      expect(result.showLegend).toBe(true); // other fields untouched
    });

    it("coerces pie's 'outside' to bar's default 'top' when switching to bar", () => {
      const result = sanitizeCustomizationsForChartType({ dataLabelPosition: 'outside' }, 'bar');
      expect(result.dataLabelPosition).toBe('top');
    });

    it('keeps a value that is already valid for the new chart type', () => {
      const result = sanitizeCustomizationsForChartType({ dataLabelPosition: 'inside' }, 'pie');
      expect(result.dataLabelPosition).toBe('inside');
    });

    it("coerces line's 'bottom' (invalid for bar) to bar's 'top'", () => {
      const result = sanitizeCustomizationsForChartType({ dataLabelPosition: 'bottom' }, 'bar');
      expect(result.dataLabelPosition).toBe('top');
    });

    it('drops dataLabelPosition for chart types without the field (number/table/map)', () => {
      const result = sanitizeCustomizationsForChartType(
        { dataLabelPosition: 'top', numberSize: 'medium' },
        'number'
      );
      expect('dataLabelPosition' in result).toBe(false);
      expect(result.numberSize).toBe('medium');
    });

    it('returns a new object and does not mutate the input', () => {
      const input = { dataLabelPosition: 'top' };
      const result = sanitizeCustomizationsForChartType(input, 'pie');
      expect(input.dataLabelPosition).toBe('top');
      expect(result).not.toBe(input);
    });

    it('handles undefined customizations', () => {
      expect(sanitizeCustomizationsForChartType(undefined, 'pie')).toEqual({});
    });
  });
});
