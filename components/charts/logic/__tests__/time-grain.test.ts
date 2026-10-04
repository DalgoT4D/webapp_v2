import { findTimeGrainColumn } from '@/components/charts/logic/time-grain';

const COLUMNS = [
  { column_name: 'created', data_type: 'timestamp without time zone' },
  { column_name: 'state', data_type: 'text' },
];

describe('findTimeGrainColumn', () => {
  it('bar/line on a date column', () => {
    expect(findTimeGrainColumn({ chart_type: 'bar', dimension_column: 'created' }, COLUMNS)).toBe(
      COLUMNS[0]
    );
    expect(findTimeGrainColumn({ chart_type: 'line', dimension_column: 'created' }, COLUMNS)).toBe(
      COLUMNS[0]
    );
  });
  it('not for other types, text columns or no dimension', () => {
    expect(
      findTimeGrainColumn({ chart_type: 'pie', dimension_column: 'created' }, COLUMNS)
    ).toBeUndefined();
    expect(
      findTimeGrainColumn({ chart_type: 'bar', dimension_column: 'state' }, COLUMNS)
    ).toBeUndefined();
    expect(findTimeGrainColumn({ chart_type: 'bar' }, COLUMNS)).toBeUndefined();
  });
});
