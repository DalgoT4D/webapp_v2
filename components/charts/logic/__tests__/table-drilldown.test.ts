import {
  drillIntoTableRow,
  drillUpTable,
  getAllDimensionColumns,
  getCurrentDrillColumn,
  getDrillDownColumns,
  isTableDrillDownEnabled,
} from '@/components/charts/logic/table-drilldown';

const THREE_LEVELS = [
  { column: 'state', enable_drill_down: true },
  { column: 'district', enable_drill_down: true },
  { column: 'block', enable_drill_down: true },
];
const TWO_LEVELS = THREE_LEVELS.slice(0, 2);

describe('table drill-down columns', () => {
  it('drill columns skip non-drill and blank dimensions; all columns skip only blanks', () => {
    const dims = [
      { column: 'year' },
      { column: 'state', enable_drill_down: true },
      { column: '', enable_drill_down: true },
    ];
    expect(isTableDrillDownEnabled(dims)).toBe(true);
    expect(isTableDrillDownEnabled([{ column: 'year' }])).toBe(false);
    expect(isTableDrillDownEnabled(undefined)).toBe(false);
    expect(getDrillDownColumns(dims)).toEqual(['state']);
    expect(getAllDimensionColumns(dims)).toEqual(['year', 'state']);
    expect(getDrillDownColumns(undefined)).toEqual([]);
  });

  it('current column: first level at the top, then level + 1', () => {
    expect(getCurrentDrillColumn(THREE_LEVELS, null)).toBe('state');
    expect(getCurrentDrillColumn(THREE_LEVELS, { currentLevel: 0, appliedFilters: {} })).toBe(
      'district'
    );
    expect(
      getCurrentDrillColumn(THREE_LEVELS, { currentLevel: 5, appliedFilters: {} })
    ).toBeUndefined();
  });
});

describe('drillIntoTableRow', () => {
  it('drills from the top level', () => {
    expect(drillIntoTableRow(THREE_LEVELS, null, { state: 'KA' }, 'state')).toEqual({
      currentLevel: 0,
      appliedFilters: { state: 'KA' },
    });
  });

  it('drills one more level and keeps earlier filters; values become strings', () => {
    const state = { currentLevel: 0, appliedFilters: { state: 'KA' } };
    expect(drillIntoTableRow(THREE_LEVELS, state, { district: 42 }, 'district')).toEqual({
      currentLevel: 1,
      appliedFilters: { state: 'KA', district: '42' },
    });
  });

  it('ignores other columns, empty values and drill-off tables', () => {
    expect(drillIntoTableRow(THREE_LEVELS, null, { district: 'X' }, 'district')).toBeNull();
    expect(drillIntoTableRow(THREE_LEVELS, null, { state: '' }, 'state')).toBeNull();
    expect(drillIntoTableRow([{ column: 'state' }], null, { state: 'KA' }, 'state')).toBeNull();
  });

  it('the last level is clickable but does nothing (pinned)', () => {
    const state = { currentLevel: 0, appliedFilters: { state: 'KA' } };
    expect(drillIntoTableRow(TWO_LEVELS, state, { district: 'M' }, 'district')).toBeNull();
    expect(
      drillIntoTableRow(
        THREE_LEVELS,
        { currentLevel: 1, appliedFilters: {} },
        { block: 'B' },
        'block'
      )
    ).toBeNull();
  });
});

describe('drillUpTable', () => {
  it('goes up one level keeping the filters of the remaining levels', () => {
    const state = { currentLevel: 1, appliedFilters: { state: 'KA', district: 'M' } };
    expect(drillUpTable(state, ['state', 'district', 'block'])).toEqual({
      currentLevel: 0,
      appliedFilters: { state: 'KA' },
    });
  });

  it('from the first level returns to the top', () => {
    expect(
      drillUpTable({ currentLevel: 0, appliedFilters: { state: 'KA' } }, ['state'])
    ).toBeNull();
  });

  it('create passes every dimension, edit/detail the drill columns (differs between builders)', () => {
    const dims = [{ column: 'year' }, ...TWO_LEVELS, { column: 'block', enable_drill_down: true }];
    const state = { currentLevel: 1, appliedFilters: { state: 'KA', district: 'M' } };
    expect(drillUpTable(state, getAllDimensionColumns(dims))).toEqual({
      currentLevel: 0,
      appliedFilters: {},
    });
    expect(drillUpTable(state, getDrillDownColumns(dims))).toEqual({
      currentLevel: 0,
      appliedFilters: { state: 'KA' },
    });
  });
});
