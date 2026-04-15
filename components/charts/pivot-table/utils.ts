import { PivotTableResponse, PivotRow, ColumnSubtotals } from '@/types/pivot-table';

/**
 * Calculate rowSpan for hierarchical row dimensions.
 * Groups consecutive rows that share the same first N labels.
 */
export function calculateRowSpans(rows: PivotRow[], dimCount: number): number[][] {
  const spans: number[][] = rows.map(() => Array(dimCount).fill(1));

  for (let dimIdx = 0; dimIdx < dimCount; dimIdx++) {
    let i = 0;
    while (i < rows.length) {
      if (rows[i].is_subtotal) {
        spans[i][dimIdx] = 1;
        i++;
        continue;
      }

      const currentLabel = rows[i].row_labels[dimIdx];
      if (currentLabel === undefined) {
        i++;
        continue;
      }

      let count = 1;
      for (let j = i + 1; j < rows.length; j++) {
        if (rows[j].is_subtotal) break;
        let parentsMatch = true;
        for (let p = 0; p < dimIdx; p++) {
          if (rows[j].row_labels[p] !== rows[i].row_labels[p]) {
            parentsMatch = false;
            break;
          }
        }
        if (!parentsMatch || rows[j].row_labels[dimIdx] !== currentLabel) break;
        count++;
      }

      spans[i][dimIdx] = count;
      for (let j = i + 1; j < i + count; j++) {
        spans[j][dimIdx] = 0;
      }
      i += count;
    }
  }

  return spans;
}

/**
 * Build an interleaved rendering order of leaf and column-subtotal indices.
 * Returns an array of { type, leafIdx, subIdx } objects.
 */
function buildCsvColumnOrder(
  columnKeys: string[][],
  subtotals?: ColumnSubtotals
): { type: 'leaf' | 'subtotal'; leafIdx?: number; subIdx?: number; label: string }[] {
  if (!subtotals?.keys?.length) {
    return columnKeys.map((key, idx) => ({
      type: 'leaf' as const,
      leafIdx: idx,
      label: key.join(' | '),
    }));
  }

  const insertMap = new Map<number, number>();
  subtotals.insert_after.forEach((afterIdx, subIdx) => {
    insertMap.set(afterIdx, subIdx);
  });

  const order: { type: 'leaf' | 'subtotal'; leafIdx?: number; subIdx?: number; label: string }[] =
    [];
  for (let i = 0; i < columnKeys.length; i++) {
    order.push({ type: 'leaf', leafIdx: i, label: columnKeys[i].join(' | ') });
    if (insertMap.has(i)) {
      const subIdx = insertMap.get(i)!;
      order.push({
        type: 'subtotal',
        subIdx,
        label: `${subtotals.keys[subIdx].join(' | ')} Subtotal`,
      });
    }
  }
  return order;
}

/**
 * Export pivoted data as CSV string.
 * Supports multiple column dimensions via column_keys and column subtotals.
 */
export function exportPivotAsCsv(data: PivotTableResponse, rowDimLabels: string[]): string {
  const lines: string[] = [];
  const columnKeys = data.column_keys ?? [];
  const metricHeaders = data.metric_headers ?? [];
  const hasColumns = columnKeys.length > 0;
  const colOrder = buildCsvColumnOrder(columnKeys, data.column_subtotals);

  // Header row: flatten column keys to "val1 | val2" + metric name
  const headerParts = [...rowDimLabels];
  for (const col of colOrder) {
    for (const metricName of metricHeaders) {
      headerParts.push(`${col.label} | ${metricName}`);
    }
  }
  if (hasColumns) {
    // Total columns
    for (const metricName of metricHeaders) {
      headerParts.push(`Total | ${metricName}`);
    }
  } else {
    // No column dimensions — just metric names
    for (const metricName of metricHeaders) {
      headerParts.push(metricName);
    }
  }
  lines.push(headerParts.map(escapeCsvField).join(','));

  // Data rows
  for (const row of data.rows) {
    const parts: string[] = [];
    for (let d = 0; d < rowDimLabels.length; d++) {
      parts.push(
        row.is_subtotal && d === row.row_labels.length - 1
          ? `${row.row_labels[d] || ''} Subtotal`
          : row.row_labels[d] || ''
      );
    }
    for (const col of colOrder) {
      const colValues =
        col.type === 'leaf'
          ? row.values[col.leafIdx!]
          : (row.column_subtotal_values?.[col.subIdx!] ?? []);
      for (const v of colValues) {
        parts.push(v !== null && v !== undefined ? String(v) : '');
      }
    }
    for (const v of row.row_total) {
      parts.push(v !== null && v !== undefined ? String(v) : '');
    }
    lines.push(parts.map(escapeCsvField).join(','));
  }

  // Grand total
  if (data.grand_total) {
    const parts: string[] = ['Grand Total'];
    for (let d = 1; d < rowDimLabels.length; d++) parts.push('');
    for (const col of colOrder) {
      const colValues =
        col.type === 'leaf'
          ? data.grand_total.values[col.leafIdx!]
          : (data.grand_total.column_subtotal_values?.[col.subIdx!] ?? []);
      for (const v of colValues) {
        parts.push(v !== null && v !== undefined ? String(v) : '');
      }
    }
    for (const v of data.grand_total.row_total) {
      parts.push(v !== null && v !== undefined ? String(v) : '');
    }
    lines.push(parts.map(escapeCsvField).join(','));
  }

  return lines.join('\n');
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
