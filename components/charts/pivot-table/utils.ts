import { PivotTableResponse, PivotRow, ColumnSubtotals } from '@/types/pivot-table';
import { formatDate, type DateFormat } from '@/lib/formatters';

/**
 * Apply a display-only date format to a pivot row-label / column-header value.
 * Returns the value unchanged when no format is set, the format is 'default',
 * or the value isn't a parseable date (formatDate returns the raw value in that case).
 */
export function applyPivotDateFormat(value: string, format: DateFormat | null | undefined): string {
  if (!format || format === 'default' || !value) return value;
  return formatDate(value, { format });
}

interface PivotDateFormatConfig {
  dateFormat?: DateFormat;
}

/**
 * Resolve the two independent grand-total flags from extra_config.
 * - showRowGrandTotal → rightmost "Total" column (each row summed across columns)
 * - showColumnGrandTotal → bottom "Total" row (each column summed across rows)
 */
export function resolvePivotTotals(extraConfig: Record<string, unknown> | undefined): {
  showRowGrandTotal: boolean;
  showColumnGrandTotal: boolean;
} {
  return {
    showRowGrandTotal: (extraConfig?.show_row_grand_total as boolean | undefined) ?? false,
    showColumnGrandTotal: (extraConfig?.show_column_grand_total as boolean | undefined) ?? false,
  };
}

// Default labels for pivot subtotal / grand-total headers when the user hasn't set one.
const DEFAULT_SUBTOTAL_LABEL = 'Subtotal';
const DEFAULT_GRAND_TOTAL_LABEL = 'Grand Total';

/** Pivot toggle + dimension fields the backend data pipeline reads off the payload root. */
export interface PivotDataFields {
  row_dimensions: string[];
  column_dimensions: string[];
  show_row_subtotals: boolean;
  show_column_subtotals: boolean;
  show_row_grand_total: boolean;
  show_column_grand_total: boolean;
}

/** Full pivot config persisted in a saved chart's extra_config (data fields + display labels). */
interface PivotExtraConfigFields extends PivotDataFields {
  row_subtotal_label: string;
  column_subtotal_label: string;
  row_grand_total_label: string;
  column_grand_total_label: string;
}

/**
 * Top-level pivot fields for a chart-data fetch payload. The `/chart-data/`
 * pipeline (pivot_service + ROLLUP query builder) reads these off the payload
 * root — not from extra_config — so this is the only place they belong on a
 * data request. Labels are display-only and omitted here.
 */
export function buildPivotDataFields(
  extraConfig: Record<string, unknown> | undefined
): PivotDataFields {
  const ec = extraConfig ?? {};
  return {
    row_dimensions: (ec.row_dimensions as string[]) || [],
    column_dimensions: (ec.column_dimensions as string[]) || [],
    show_row_subtotals: (ec.show_row_subtotals as boolean) ?? false,
    show_column_subtotals: (ec.show_column_subtotals as boolean) ?? false,
    show_row_grand_total: (ec.show_row_grand_total as boolean) ?? false,
    show_column_grand_total: (ec.show_column_grand_total as boolean) ?? false,
  };
}

/**
 * Normalized pivot config fields, persisted inside a saved chart's `extra_config`
 * (the source of truth read back at render time and by the backend by-id path).
 * Single builder used everywhere a pivot chart is saved so the shape can't drift.
 */
export function buildPivotExtraConfig(
  extraConfig: Record<string, unknown> | undefined
): PivotExtraConfigFields {
  const ec = extraConfig ?? {};
  return {
    ...buildPivotDataFields(extraConfig),
    row_subtotal_label: (ec.row_subtotal_label as string) || DEFAULT_SUBTOTAL_LABEL,
    column_subtotal_label: (ec.column_subtotal_label as string) || DEFAULT_SUBTOTAL_LABEL,
    row_grand_total_label: (ec.row_grand_total_label as string) || DEFAULT_GRAND_TOTAL_LABEL,
    column_grand_total_label: (ec.column_grand_total_label as string) || DEFAULT_GRAND_TOTAL_LABEL,
  };
}

/**
 * Assemble the full prop set for <PivotTableChart> from a chart's extra_config,
 * computing date formats and grand-total gates once. Every render site (builder
 * preview, detail, dashboard cells) uses this so the mapping can't drift.
 * `customizationsOverride` lets the live builder preview pass in-progress
 * customizations that aren't yet saved into extra_config.
 */
export function getPivotRenderProps(
  extraConfig: Record<string, unknown> | undefined,
  customizationsOverride?: Record<string, unknown>
) {
  const ec = extraConfig ?? {};
  const customizations =
    customizationsOverride ?? (ec.customizations as Record<string, unknown>) ?? {};
  const { rowDimDateFormats, columnDimDateFormats } = computePivotDateFormats(ec, customizations);
  const { showRowGrandTotal, showColumnGrandTotal } = resolvePivotTotals(ec);
  return {
    rowDimLabels: (ec.row_dimensions as string[]) || [],
    rowDimDateFormats,
    columnDimDateFormats,
    showRowGrandTotal,
    showColumnGrandTotal,
    customizations,
    rowSubtotalLabel: (ec.row_subtotal_label as string) || DEFAULT_SUBTOTAL_LABEL,
    columnSubtotalLabel: (ec.column_subtotal_label as string) || DEFAULT_SUBTOTAL_LABEL,
    rowGrandTotalLabel: (ec.row_grand_total_label as string) || DEFAULT_GRAND_TOTAL_LABEL,
    columnGrandTotalLabel: (ec.column_grand_total_label as string) || DEFAULT_GRAND_TOTAL_LABEL,
  };
}

/**
 * Compute per-dimension display date formats for a pivot's row and column axes,
 * aligned by dimension index. A dimension gets a format when the user chose a
 * date format for it (display-only; does not change grouping).
 */
export function computePivotDateFormats(
  extraConfig: Record<string, unknown> | undefined,
  customizations: Record<string, unknown> | undefined
): { rowDimDateFormats: (DateFormat | null)[]; columnDimDateFormats: (DateFormat | null)[] } {
  const rowDims = (extraConfig?.row_dimensions as string[]) || [];
  const colDims = (extraConfig?.column_dimensions as string[]) || [];
  const dateFmt =
    (customizations?.dateColumnFormatting as Record<string, PivotDateFormatConfig>) || {};

  const formatFor = (dim: string): DateFormat | null => dateFmt[dim]?.dateFormat ?? null;

  return {
    rowDimDateFormats: rowDims.map(formatFor),
    columnDimDateFormats: colDims.map(formatFor),
  };
}

/**
 * Drop formatting entries whose column is no longer part of the chart (e.g. a row
 * dimension or metric the user removed). Mirrors the table chart's stale-config
 * scrub so saved pivot configs don't accumulate orphaned formatting. Returns the
 * cleaned record plus a `changed` flag so callers can skip a no-op state update.
 */
export function pruneStaleFormatting<T>(
  existing: Record<string, T> | undefined,
  validColumns: string[]
): { cleaned: Record<string, T>; changed: boolean } {
  const source = existing ?? {};
  const validSet = new Set(validColumns);
  const cleaned: Record<string, T> = {};
  let changed = false;
  for (const [column, value] of Object.entries(source)) {
    if (validSet.has(column)) {
      cleaned[column] = value;
    } else {
      changed = true;
    }
  }
  return { cleaned, changed };
}

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
 * Grand totals mirror the on-screen table: showRowGrandTotal gates the rightmost
 * "Total" columns, showColumnGrandTotal gates the bottom "Grand Total" row, and the
 * corner appears only when both are on. Both default on for back-compat.
 */
export function exportPivotAsCsv(
  data: PivotTableResponse,
  rowDimLabels: string[],
  showRowGrandTotal = true,
  showColumnGrandTotal = true
): string {
  const lines: string[] = [];
  const columnKeys = data.column_keys ?? [];
  const metricHeaders = data.metric_headers ?? [];
  const hasColumns = columnKeys.length > 0;
  const colOrder = buildCsvColumnOrder(columnKeys, data.column_subtotals);

  // With no column dimensions, row_total holds the primary metric values, so those
  // cells always render; with column dimensions they are the row grand total.
  const renderRowTotalCells = !hasColumns || showRowGrandTotal;

  // Header row: flatten column keys to "val1 | val2" + metric name
  const headerParts = [...rowDimLabels];
  for (const col of colOrder) {
    for (const metricName of metricHeaders) {
      headerParts.push(`${col.label} | ${metricName}`);
    }
  }
  if (hasColumns) {
    // Total columns (row grand total)
    if (showRowGrandTotal) {
      for (const metricName of metricHeaders) {
        headerParts.push(`Total | ${metricName}`);
      }
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
    if (renderRowTotalCells) {
      for (const v of row.row_total) {
        parts.push(v !== null && v !== undefined ? String(v) : '');
      }
    }
    lines.push(parts.map(escapeCsvField).join(','));
  }

  // Grand total row (column grand total)
  if (showColumnGrandTotal && data.grand_total) {
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
    // Trailing cells are the corner (with columns) or the metric totals (without) —
    // shown only when the row grand total is on.
    if (renderRowTotalCells) {
      for (const v of data.grand_total.row_total) {
        parts.push(v !== null && v !== undefined ? String(v) : '');
      }
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
