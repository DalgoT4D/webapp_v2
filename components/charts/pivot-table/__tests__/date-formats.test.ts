import {
  applyPivotDateFormat,
  computePivotDateFormats,
  resolvePivotTotals,
  exportPivotAsCsv,
  pruneStaleFormatting,
} from '../utils';
import type { PivotTableResponse } from '@/types/pivot-table';

describe('applyPivotDateFormat', () => {
  it('returns the raw value when no format is set', () => {
    expect(applyPivotDateFormat('2025-08-12T20:45:58', null)).toBe('2025-08-12T20:45:58');
    expect(applyPivotDateFormat('2025-08-12T20:45:58', undefined)).toBe('2025-08-12T20:45:58');
  });

  it("returns the raw value for the 'default' format", () => {
    expect(applyPivotDateFormat('2025-08-12T20:45:58', 'default')).toBe('2025-08-12T20:45:58');
  });

  it('formats a parseable date with the given format', () => {
    expect(applyPivotDateFormat('2025-08-12T20:45:58', 'yyyy_mm_dd')).toBe('2025-08-12');
    expect(applyPivotDateFormat('2025-08-12T20:45:58', 'dd_mm_yyyy')).toBe('12/08/2025');
  });

  it('returns the raw value for a non-date string', () => {
    expect(applyPivotDateFormat('Maharashtra', 'yyyy_mm_dd')).toBe('Maharashtra');
  });

  it('returns empty string unchanged', () => {
    expect(applyPivotDateFormat('', 'yyyy_mm_dd')).toBe('');
  });
});

describe('computePivotDateFormats', () => {
  it('maps a chosen date format to a datetime dimension', () => {
    const extra = {
      row_dimensions: ['state', 'last_updated'],
      column_dimensions: ['created_at'],
    };
    const cust = {
      dateColumnFormatting: {
        last_updated: { dateFormat: 'yyyy_mm_dd' },
        created_at: { dateFormat: 'dd_mm_yyyy' },
      },
    };
    const { rowDimDateFormats, columnDimDateFormats } = computePivotDateFormats(extra, cust);
    expect(rowDimDateFormats).toEqual([null, 'yyyy_mm_dd']);
    expect(columnDimDateFormats).toEqual(['dd_mm_yyyy']);
  });

  it('returns nulls when no formatting is configured', () => {
    const extra = { row_dimensions: ['a', 'b'], column_dimensions: ['c'] };
    const { rowDimDateFormats, columnDimDateFormats } = computePivotDateFormats(extra, {});
    expect(rowDimDateFormats).toEqual([null, null]);
    expect(columnDimDateFormats).toEqual([null]);
  });

  it('handles empty/undefined config safely', () => {
    const { rowDimDateFormats, columnDimDateFormats } = computePivotDateFormats(
      undefined,
      undefined
    );
    expect(rowDimDateFormats).toEqual([]);
    expect(columnDimDateFormats).toEqual([]);
  });
});

describe('pruneStaleFormatting', () => {
  it('drops keys not present in the valid-column list', () => {
    const existing = {
      created_at: { dateFormat: 'yyyy_mm_dd' },
      removed_dim: { dateFormat: 'dd_mm_yyyy' },
    };
    const { cleaned, changed } = pruneStaleFormatting(existing, ['created_at']);
    expect(cleaned).toEqual({ created_at: { dateFormat: 'yyyy_mm_dd' } });
    expect(changed).toBe(true);
  });

  it('keeps every key and reports no change when all are valid', () => {
    const existing = {
      sum_amount: { numberFormat: 'indian', decimalPlaces: 2 },
      count: { numberFormat: 'international', decimalPlaces: 0 },
    };
    const { cleaned, changed } = pruneStaleFormatting(existing, ['sum_amount', 'count']);
    expect(cleaned).toEqual(existing);
    expect(changed).toBe(false);
  });

  it('drops all keys when the valid-column list is empty', () => {
    const existing = { a: { dateFormat: 'time_only' } };
    const { cleaned, changed } = pruneStaleFormatting(existing, []);
    expect(cleaned).toEqual({});
    expect(changed).toBe(true);
  });

  it('handles an undefined/empty existing record without change', () => {
    expect(pruneStaleFormatting(undefined, ['a'])).toEqual({ cleaned: {}, changed: false });
    expect(pruneStaleFormatting({}, ['a'])).toEqual({ cleaned: {}, changed: false });
  });
});

describe('resolvePivotTotals', () => {
  it('uses the two independent flags when present', () => {
    expect(
      resolvePivotTotals({ show_row_grand_total: true, show_column_grand_total: false })
    ).toEqual({ showRowGrandTotal: true, showColumnGrandTotal: false });
  });

  it('treats the two flags independently', () => {
    expect(resolvePivotTotals({ show_row_grand_total: true })).toEqual({
      showRowGrandTotal: true,
      showColumnGrandTotal: false,
    });
    expect(resolvePivotTotals({ show_column_grand_total: true })).toEqual({
      showRowGrandTotal: false,
      showColumnGrandTotal: true,
    });
  });

  it('defaults to false when nothing is set', () => {
    expect(resolvePivotTotals(undefined)).toEqual({
      showRowGrandTotal: false,
      showColumnGrandTotal: false,
    });
    expect(resolvePivotTotals({})).toEqual({
      showRowGrandTotal: false,
      showColumnGrandTotal: false,
    });
  });
});

describe('exportPivotAsCsv grand-total gating', () => {
  // One row dim (state), one column dim (year) with two leaf columns, one metric.
  const data = {
    column_keys: [['2024'], ['2025']],
    column_dimension_names: ['year'],
    metric_headers: ['Count'],
    rows: [{ row_labels: ['CA'], is_subtotal: false, values: [[10], [20]], row_total: [30] }],
    grand_total: { values: [[10], [20]], row_total: [30] },
  } as unknown as PivotTableResponse;

  it('includes both totals when both flags on', () => {
    const csv = exportPivotAsCsv(data, ['state'], true, true);
    const [header, dataRow, gtRow] = csv.split('\n');
    expect(header).toBe('state,2024 | Count,2025 | Count,Total | Count');
    expect(dataRow).toBe('CA,10,20,30');
    expect(gtRow).toBe('Grand Total,10,20,30');
  });

  it('omits the Total column when row grand total off', () => {
    const csv = exportPivotAsCsv(data, ['state'], false, true);
    const [header, dataRow, gtRow] = csv.split('\n');
    expect(header).toBe('state,2024 | Count,2025 | Count');
    expect(dataRow).toBe('CA,10,20');
    // grand total row present, but no trailing corner cell
    expect(gtRow).toBe('Grand Total,10,20');
  });

  it('omits the Grand Total row when column grand total off', () => {
    const csv = exportPivotAsCsv(data, ['state'], true, false);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2); // header + one data row, no grand total row
    expect(lines[0]).toBe('state,2024 | Count,2025 | Count,Total | Count');
  });

  it('omits both when both off', () => {
    const csv = exportPivotAsCsv(data, ['state'], false, false);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('state,2024 | Count,2025 | Count');
    expect(lines[1]).toBe('CA,10,20');
  });
});
