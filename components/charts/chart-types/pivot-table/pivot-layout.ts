import type { PivotGrid, PivotRow } from '@/types/pivot-table';

/** A column in the rendered table — a leaf data column or a column subtotal. */
export interface RenderColumn {
  type: 'leaf' | 'column_subtotal';
  leafIdx?: number; // index into column_keys (for leaf)
  subIdx?: number; // index into column_subtotals.keys (for subtotal)
  headerKey: string[]; // padded key for header span computation
}

/** Marker used in padded header keys to identify subtotal levels. */
export const COL_SUBTOTAL_MARKER = '__COL_SUBTOTAL__';

export interface SearchCell {
  rowIndex: number;
  colIndex: number;
  displayValue: string;
}

/**
 * Leaf columns with column subtotals interleaved after the leaf they follow; subtotal keys are
 * padded to the leaf depth with COL_SUBTOTAL_MARKER. Moved verbatim from PivotTableChart.
 */
export function buildEffectiveColumns(
  columnKeys: string[][],
  subtotals: PivotGrid['column_subtotals'],
  hasColumnKeys: boolean,
  numColDims: number
): RenderColumn[] {
  if (!hasColumnKeys || !subtotals?.keys?.length) {
    return columnKeys.map((key, idx) => ({
      type: 'leaf' as const,
      leafIdx: idx,
      headerKey: key,
    }));
  }

  // Map: leaf column index → subtotal index to insert after it
  const insertMap = new Map<number, number>();
  subtotals.insert_after.forEach((afterIdx, subIdx) => {
    insertMap.set(afterIdx, subIdx);
  });

  const cols: RenderColumn[] = [];
  for (let i = 0; i < columnKeys.length; i++) {
    cols.push({ type: 'leaf', leafIdx: i, headerKey: columnKeys[i] });
    if (insertMap.has(i)) {
      const subIdx = insertMap.get(i)!;
      // Pad subtotal key to same depth as leaf keys using marker
      const padded = [...subtotals.keys[subIdx]];
      while (padded.length < numColDims) padded.push(COL_SUBTOTAL_MARKER);
      cols.push({ type: 'column_subtotal', subIdx, headerKey: padded });
    }
  }
  return cols;
}

/**
 * The flat cell list search runs over — row labels (skipping cells merged by rowSpan), value
 * cells per effective column, row totals — with the same column counter the table renders.
 * Moved verbatim from PivotTableChart.
 */
export function buildPivotSearchCells(
  rows: PivotRow[],
  dimCount: number,
  rowSpans: number[][],
  hasColumnKeys: boolean,
  effectiveColumns: RenderColumn[],
  metricHeaders: string[],
  formatCell: (value: number | null, metricName: string) => string,
  rowSubtotalLabel: string | undefined
): SearchCell[] {
  const cells: SearchCell[] = [];

  rows.forEach((row, rowIdx) => {
    let colCounter = 0;

    // Row dimension labels
    for (let d = 0; d < dimCount; d++) {
      if (row.is_subtotal && d === 0) {
        const groupLabel = row.row_labels.join(' > ');
        const suffix = rowSubtotalLabel || 'Subtotal';
        cells.push({
          rowIndex: rowIdx,
          colIndex: colCounter,
          displayValue: `${groupLabel} ${suffix}`,
        });
      } else if (!row.is_subtotal && (rowSpans[rowIdx]?.[d] ?? 1) !== 0) {
        // Skip cells merged into the row above (rowSpan) — they aren't rendered,
        // so counting them would over-report matches for a single visible cell.
        cells.push({
          rowIndex: rowIdx,
          colIndex: colCounter,
          displayValue: String(row.row_labels[d] || ''),
        });
      }
      colCounter++;
    }

    // Value cells per effective column (leaf + subtotal interleaved)
    if (hasColumnKeys) {
      effectiveColumns.forEach((col) => {
        const colValues =
          col.type === 'leaf'
            ? row.values[col.leafIdx!]
            : (row.column_subtotal_values?.[col.subIdx!] ?? []);
        colValues.forEach((val, mIdx) => {
          const metricName = metricHeaders[mIdx] || '';
          cells.push({
            rowIndex: rowIdx,
            colIndex: colCounter,
            displayValue: formatCell(val, metricName),
          });
          colCounter++;
        });
      });
    }

    // Row total cells
    row.row_total.forEach((val, mIdx) => {
      const metricName = metricHeaders[mIdx] || '';
      cells.push({
        rowIndex: rowIdx,
        colIndex: colCounter,
        displayValue: formatCell(val, metricName),
      });
      colCounter++;
    });
  });

  return cells;
}
