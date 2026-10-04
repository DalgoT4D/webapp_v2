import {
  buildPivotDataFields,
  buildPivotExtraConfig,
  calculateRowSpans,
  getPivotRenderProps,
} from '@/components/charts/chart-types/pivot-table/utils';
import type { PivotRow } from '@/types/pivot-table';

describe('pivot config builders', () => {
  it('buildPivotDataFields defaults every field', () => {
    expect(buildPivotDataFields(undefined)).toEqual({
      row_dimensions: [],
      column_dimensions: [],
      show_row_subtotals: false,
      show_column_subtotals: false,
      show_row_grand_total: false,
      show_column_grand_total: false,
    });
    expect(
      buildPivotDataFields({
        row_dimensions: ['s'],
        show_row_subtotals: true,
        row_subtotal_label: 'x',
      })
    ).toEqual({
      row_dimensions: ['s'],
      column_dimensions: [],
      show_row_subtotals: true,
      show_column_subtotals: false,
      show_row_grand_total: false,
      show_column_grand_total: false,
    });
  });

  it('buildPivotExtraConfig adds labels, blank labels fall back', () => {
    expect(
      buildPivotExtraConfig({ row_subtotal_label: 'Sub', column_grand_total_label: '' })
    ).toMatchObject({
      row_subtotal_label: 'Sub',
      column_subtotal_label: 'Subtotal',
      row_grand_total_label: 'Grand Total',
      column_grand_total_label: 'Grand Total',
    });
  });

  it('getPivotRenderProps: labels, totals off by default, override wins over saved customizations', () => {
    const props = getPivotRenderProps(
      { row_dimensions: ['state'], customizations: { zebraRows: true } },
      { zebraRows: false }
    );
    expect(props).toMatchObject({
      rowDimLabels: ['state'],
      showRowGrandTotal: false,
      showColumnGrandTotal: false,
      customizations: { zebraRows: false },
      rowSubtotalLabel: 'Subtotal',
      columnGrandTotalLabel: 'Grand Total',
    });
    expect(getPivotRenderProps({ customizations: { a: 1 } }).customizations).toEqual({ a: 1 });
  });
});

describe('calculateRowSpans', () => {
  const row = (labels: string[], is_subtotal = false): PivotRow => ({
    row_labels: labels,
    is_subtotal,
    values: [],
    row_total: [],
  });

  it('merges equal labels under the same parent; subtotal rows break groups', () => {
    const rows = [
      row(['KA', 'Mysuru']),
      row(['KA', 'Udupi']),
      row(['KA', ''], true),
      row(['TN', 'Salem']),
    ];
    expect(calculateRowSpans(rows, 2)).toEqual([
      [2, 1],
      [0, 1],
      [1, 1],
      [1, 1],
    ]);
  });

  it('same child label under different parents is not merged', () => {
    const rows = [row(['KA', 'X']), row(['TN', 'X'])];
    expect(calculateRowSpans(rows, 2)).toEqual([
      [1, 1],
      [1, 1],
    ]);
  });
});
