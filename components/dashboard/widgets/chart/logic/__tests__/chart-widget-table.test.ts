import {
  buildWidgetTableConfig,
  getChartWidgetErrorMessage,
  getWidgetTableDimensions,
  toTableDrillFilters,
} from '@/components/dashboard/widgets/chart/logic/chart-widget-table';

const drillDims = [
  { column: 'state', enable_drill_down: true },
  { column: 'district', enable_drill_down: true },
  { column: 'block', enable_drill_down: true },
];

describe('getWidgetTableDimensions', () => {
  it('no drill-down: every dimension; else legacy dimension_columns; else []', () => {
    expect(
      getWidgetTableDimensions(
        { dimensions: [{ column: 'a' }, { column: '' }, { column: 'b' }] },
        null
      )
    ).toEqual(['a', 'b']);
    expect(
      getWidgetTableDimensions({ dimensions: [], dimension_columns: ['x', 'y'] }, null)
    ).toEqual(['x', 'y']);
    expect(getWidgetTableDimensions({ dimension_columns: ['x'] }, null)).toEqual(['x']);
    expect(getWidgetTableDimensions(undefined, null)).toEqual([]);
  });

  it('drill-down: the top column, then the next one per level (clamped to the last)', () => {
    expect(getWidgetTableDimensions({ dimensions: drillDims }, null)).toEqual(['state']);
    expect(
      getWidgetTableDimensions({ dimensions: drillDims }, { currentLevel: 0, appliedFilters: {} })
    ).toEqual(['district']);
    expect(
      getWidgetTableDimensions({ dimensions: drillDims }, { currentLevel: 5, appliedFilters: {} })
    ).toEqual(['block']);
  });
});

describe('toTableDrillFilters', () => {
  it('drill selections become equals filters', () => {
    expect(
      toTableDrillFilters({
        currentLevel: 1,
        appliedFilters: { state: 'Assam', district: 'Kamrup' },
      })
    ).toEqual([
      { column: 'state', operator: 'equals', value: 'Assam' },
      { column: 'district', operator: 'equals', value: 'Kamrup' },
    ]);
    expect(toTableDrillFilters(null)).toEqual([]);
  });
});

describe('buildWidgetTableConfig', () => {
  it('defaults when the chart saved nothing', () => {
    expect(buildWidgetTableConfig({}, undefined, null)).toEqual({
      table_columns: [],
      column_formatting: {},
      sort: [],
      pagination: { enabled: true, page_size: 20 },
      conditionalFormatting: [],
      columnAlignment: {},
      zebraRows: true,
      freezeFirstColumn: false,
      theme: undefined,
    });
  });

  it('saved styling passes through; zebraRows false is kept', () => {
    const cfg = buildWidgetTableConfig(
      {
        customizations: { zebraRows: false, freezeFirstColumn: true, theme: 'dark' },
        sort: [{ column: 'a', direction: 'asc' }],
      },
      ['a'],
      null
    );
    expect(cfg).toMatchObject({
      zebraRows: false,
      freezeFirstColumn: true,
      theme: 'dark',
      sort: [{ column: 'a', direction: 'asc' }],
    });
  });
});

describe('getChartWidgetErrorMessage', () => {
  it('data-ish errors get the dataset hint, others the generic text', () => {
    for (const raw of [
      'No data',
      'bad COLUMN',
      'metric x',
      'dimension y',
      'aggregate z',
      'no rows',
      'Empty result',
    ]) {
      expect(getChartWidgetErrorMessage(raw)).toBe(
        'Please check the dataset or metrics selected and try again'
      );
    }
    expect(getChartWidgetErrorMessage('Chart configuration needs adjustment')).toBe(
      'Chart configuration needs adjustment. Please review your settings and try again'
    );
  });
});
