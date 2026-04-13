import { PivotTableResponse, PivotRow } from '@/types/pivot-table';

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
 * Export pivoted data as CSV string.
 * Supports multiple column dimensions via column_keys.
 */
export function exportPivotAsCsv(data: PivotTableResponse, rowDimLabels: string[]): string {
  const lines: string[] = [];
  const columnKeys = data.column_keys ?? [];
  const metricHeaders = data.metric_headers ?? [];
  const hasColumns = columnKeys.length > 0;

  // Header row: flatten column keys to "val1 | val2" + metric name
  const headerParts = [...rowDimLabels];
  for (const colKey of columnKeys) {
    for (const metricName of metricHeaders) {
      headerParts.push(`${colKey.join(' | ')} | ${metricName}`);
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
    for (const colValues of row.values) {
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
    for (const colValues of data.grand_total.values) {
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
