import { getApiCustomizations, mergeTableColumnFormatting } from '@/lib/chart-payload-utils';
import { ChartTypes } from '@/types/charts';

describe('getApiCustomizations', () => {
  const base = {
    showLegend: true,
    showTooltip: true,
  };

  it('strips numberFormat and decimalPlaces for number charts', () => {
    const input = { ...base, numberFormat: 'indian', decimalPlaces: 2 };
    expect(getApiCustomizations(ChartTypes.NUMBER, input)).toEqual(base);
  });

  it('strips numberFormat and decimalPlaces for pie charts', () => {
    const input = { ...base, numberFormat: 'indian', decimalPlaces: 0 };
    expect(getApiCustomizations(ChartTypes.PIE, input)).toEqual(base);
  });

  it('strips numberFormat and decimalPlaces for map charts', () => {
    const input = { ...base, numberFormat: 'default', decimalPlaces: 1 };
    expect(getApiCustomizations(ChartTypes.MAP, input)).toEqual(base);
  });

  it('strips axis formatting keys for bar charts', () => {
    const input = {
      ...base,
      yAxisNumberFormat: 'adaptive_international',
      yAxisDecimalPlaces: 2,
      xAxisNumberFormat: 'default',
      xAxisDecimalPlaces: 0,
    };
    expect(getApiCustomizations(ChartTypes.BAR, input)).toEqual(base);
  });

  it('strips axis formatting keys for line charts', () => {
    const input = {
      ...base,
      yAxisNumberFormat: 'percentage',
      yAxisDecimalPlaces: 1,
      xAxisNumberFormat: 'international',
      xAxisDecimalPlaces: 3,
    };
    expect(getApiCustomizations(ChartTypes.LINE, input)).toEqual(base);
  });

  it('strips dateFormat for pie charts', () => {
    const input = { ...base, dateFormat: 'dd_mm_yyyy' };
    expect(getApiCustomizations(ChartTypes.PIE, input)).toEqual(base);
  });

  it('strips xAxisDateFormat for bar charts', () => {
    const input = { ...base, xAxisDateFormat: 'dd_mm_yyyy' };
    expect(getApiCustomizations(ChartTypes.BAR, input)).toEqual(base);
  });

  it('strips xAxisDateFormat for line charts', () => {
    const input = { ...base, xAxisDateFormat: 'iso_datetime' };
    expect(getApiCustomizations(ChartTypes.LINE, input)).toEqual(base);
  });

  it('returns customizations unchanged for table charts', () => {
    const input = { ...base, columnFormatting: {} };
    expect(getApiCustomizations(ChartTypes.TABLE, input)).toEqual(input);
  });

  it('handles undefined customizations', () => {
    expect(getApiCustomizations(ChartTypes.NUMBER, undefined)).toEqual({});
    expect(getApiCustomizations(ChartTypes.BAR, undefined)).toEqual({});
    expect(getApiCustomizations(ChartTypes.TABLE, undefined)).toBeUndefined();
  });
});

describe('mergeTableColumnFormatting', () => {
  it('returns empty object when customizations is undefined', () => {
    expect(mergeTableColumnFormatting(undefined)).toEqual({});
  });

  it('returns columnFormatting when no dateColumnFormatting', () => {
    const input = { columnFormatting: { amount: { numberFormat: 'indian' } } };
    expect(mergeTableColumnFormatting(input)).toEqual({ amount: { numberFormat: 'indian' } });
  });

  it('merges dateColumnFormatting into column_formatting', () => {
    const input = {
      columnFormatting: { amount: { numberFormat: 'indian' } },
      dateColumnFormatting: { created_at: { dateFormat: 'dd_mm_yyyy' } },
    };
    expect(mergeTableColumnFormatting(input)).toEqual({
      amount: { numberFormat: 'indian' },
      created_at: { dateFormat: 'dd_mm_yyyy' },
    });
  });

  it('defaults missing dateFormat to "default"', () => {
    const input = { dateColumnFormatting: { created_at: {} } };
    expect(mergeTableColumnFormatting(input)).toEqual({
      created_at: { dateFormat: 'default' },
    });
  });

  it('dateColumnFormatting overwrites columnFormatting for the same column', () => {
    const input = {
      columnFormatting: { created_at: { numberFormat: 'indian' } },
      dateColumnFormatting: { created_at: { dateFormat: 'dd_mm_yyyy' } },
    };
    expect(mergeTableColumnFormatting(input)).toEqual({
      created_at: { dateFormat: 'dd_mm_yyyy' },
    });
  });
});
