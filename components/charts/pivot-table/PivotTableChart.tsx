'use client';

import { useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { PivotTableResponse, PivotSort } from '@/types/pivot-table';
import { formatNumber, NumberFormats, type NumberFormat } from '@/lib/formatters';
import type { ConditionalFormattingRule } from '../types/table/types';
import { getTableTheme } from '../types/table/constants';
import { calculateRowSpans } from './utils';
import { useTableSearch } from '../hooks/useTableSearch';
import { TableSearchBar } from '../TableSearchBar';

interface ColumnFormatConfig {
  numberFormat?: NumberFormat;
  decimalPlaces?: number;
}

// Represents a column in the rendered table — either a leaf data column or a column subtotal
interface RenderColumn {
  type: 'leaf' | 'column_subtotal';
  leafIdx?: number; // index into column_keys (for leaf)
  subIdx?: number; // index into column_subtotals.keys (for subtotal)
  headerKey: string[]; // padded key for header span computation
}

// Marker used in padded header keys to identify subtotal levels
const COL_SUBTOTAL_MARKER = '__COL_SUBTOTAL__';

interface PivotTableChartProps {
  data: PivotTableResponse;
  rowDimLabels: string[];
  customizations?: Record<string, unknown>;
  subtotalLabel?: string;
  columnSubtotalLabel?: string;
  grandTotalLabel?: string;
  onSort?: (sort: PivotSort) => void;
  pagination?: {
    page: number;
    pageSize: number;
    totalGroups: number;
    onPageChange: (page: number) => void;
  };
}

/**
 * Calculate colspan spans for nested column headers.
 * For header level `level`, counts how many consecutive column_keys share
 * the same value at indices 0..level.
 */
function computeHeaderSpans(
  columnKeys: string[][],
  level: number
): { value: string; span: number; startIdx: number }[] {
  const spans: { value: string; span: number; startIdx: number }[] = [];
  let i = 0;
  while (i < columnKeys.length) {
    const currentKey = columnKeys[i];
    let count = 1;
    for (let j = i + 1; j < columnKeys.length; j++) {
      let match = true;
      for (let l = 0; l <= level; l++) {
        if (columnKeys[j][l] !== currentKey[l]) {
          match = false;
          break;
        }
      }
      if (!match) break;
      count++;
    }
    spans.push({ value: currentKey[level], span: count, startIdx: i });
    i += count;
  }
  return spans;
}

export default function PivotTableChart({
  data,
  rowDimLabels,
  customizations,
  subtotalLabel,
  columnSubtotalLabel,
  grandTotalLabel,
  onSort,
  pagination,
}: PivotTableChartProps) {
  const dimCount = rowDimLabels.length;
  const columnKeys = data.column_keys ?? [];
  const metricHeaders = data.metric_headers ?? [];
  const hasColumnKeys = columnKeys.length > 0;
  const metricCount = metricHeaders.length;
  const numColDims = data.column_dimension_names?.length || 0;

  // Extract customization values
  const columnFormatting: Record<string, ColumnFormatConfig> =
    (customizations?.columnFormatting as Record<string, ColumnFormatConfig>) || {};
  const conditionalFormatting: ConditionalFormattingRule[] =
    (customizations?.conditionalFormatting as ConditionalFormattingRule[]) || [];
  const zebraRows: boolean = (customizations?.zebraRows as boolean) || false;
  const freezeFirstColumn: boolean = (customizations?.freezeFirstColumn as boolean) || false;
  const theme = getTableTheme(customizations?.theme as string | undefined);

  const rowSpans = useMemo(
    () => calculateRowSpans(data.rows ?? [], dimCount),
    [data.rows, dimCount]
  );

  // Build an interleaved column list that includes both leaf and subtotal columns.
  // When column subtotals are absent, each entry is simply a leaf column.
  const effectiveColumns: RenderColumn[] = useMemo(() => {
    const subtotals = data.column_subtotals;
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
  }, [columnKeys, data.column_subtotals, hasColumnKeys, numColDims]);

  const totalPages = pagination ? Math.ceil(pagination.totalGroups / pagination.pageSize) : 1;

  const formatCell = useCallback(
    (value: number | null, metricName: string): string => {
      if (value === null || value === undefined) return 'N/A';

      const metricFormat = columnFormatting[metricName];
      if (metricFormat?.numberFormat && metricFormat.numberFormat !== NumberFormats.DEFAULT) {
        return formatNumber(Number(value), {
          format: metricFormat.numberFormat,
          decimalPlaces: metricFormat.decimalPlaces,
        });
      }

      // Default formatting with decimal places if configured
      const decimals =
        typeof metricFormat?.decimalPlaces === 'number' ? metricFormat.decimalPlaces : 0;
      return Number(value).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    },
    [columnFormatting]
  );

  /** Evaluate conditional formatting rules and return matching color */
  const getConditionalColor = useCallback(
    (value: number | null, metricName: string): string | undefined => {
      if (!conditionalFormatting.length || value === null || value === undefined) return undefined;

      const numValue = Number(value);
      if (isNaN(numValue)) return undefined;

      // Last matching rule wins
      let matchedColor: string | undefined;
      for (const rule of conditionalFormatting) {
        if (rule.column !== metricName) continue;

        let matches = false;
        switch (rule.operator) {
          case '>':
            matches = numValue > rule.value;
            break;
          case '<':
            matches = numValue < rule.value;
            break;
          case '>=':
            matches = numValue >= rule.value;
            break;
          case '<=':
            matches = numValue <= rule.value;
            break;
          case '==':
            matches = numValue === rule.value;
            break;
          case '!=':
            matches = numValue !== rule.value;
            break;
        }
        if (matches) {
          matchedColor = rule.color;
        }
      }
      return matchedColor;
    },
    [conditionalFormatting]
  );

  // --- Search integration ---

  // Build flat cell list for search: row dimension labels + value cells + row totals
  const searchCells = useMemo(() => {
    const cells: { rowIndex: number; colIndex: number; displayValue: string }[] = [];
    const rows = data.rows ?? [];

    rows.forEach((row, rowIdx) => {
      let colCounter = 0;

      // Row dimension labels
      for (let d = 0; d < dimCount; d++) {
        if (row.is_subtotal && d === 0) {
          const groupLabel = row.row_labels.join(' > ');
          const suffix = subtotalLabel || 'Subtotal';
          cells.push({
            rowIndex: rowIdx,
            colIndex: colCounter,
            displayValue: `${groupLabel} ${suffix}`,
          });
        } else if (!row.is_subtotal) {
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
  }, [
    data.rows,
    dimCount,
    hasColumnKeys,
    metricHeaders,
    formatCell,
    subtotalLabel,
    effectiveColumns,
  ]);

  const search = useTableSearch(searchCells);

  const isSearchMatch = useCallback(
    (rowIdx: number, colIdx: number): boolean => {
      return search.matches.some((m) => m.rowIndex === rowIdx && m.colIndex === colIdx);
    },
    [search.matches]
  );

  /** Get inline style for a cell, layering search highlight on top of conditional formatting */
  const getSearchStyle = useCallback(
    (rowIdx: number, colIdx: number, baseBgColor?: string): React.CSSProperties => {
      const style: React.CSSProperties = {};
      if (isSearchMatch(rowIdx, colIdx)) {
        style.backgroundColor = '#fde68a'; // amber-200 for search matches
      } else if (baseBgColor) {
        style.backgroundColor = baseBgColor;
      }
      return style;
    },
    [isSearchMatch]
  );

  // Pre-compute header spans for each column dimension level using effective columns
  const headerLevels = useMemo(() => {
    if (!hasColumnKeys || numColDims === 0) return [];
    const allKeys = effectiveColumns.map((c) => c.headerKey);
    const levels = [];
    for (let level = 0; level < numColDims; level++) {
      levels.push(computeHeaderSpans(allKeys, level));
    }
    return levels;
  }, [effectiveColumns, hasColumnKeys, numColDims]);

  // Frozen column styles (colors applied via inline styles using theme)
  const frozenCellClass = freezeFirstColumn
    ? 'sticky left-0 z-10 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]'
    : '';
  const frozenHeaderClass = freezeFirstColumn
    ? 'sticky left-0 z-30 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]'
    : '';

  // Shared border style object for cells
  const borderStyle: React.CSSProperties = { borderColor: theme.border };
  // Header cell style (background + text + border)
  const headerCellStyle: React.CSSProperties = {
    backgroundColor: theme.header,
    color: theme.headerText,
    borderColor: theme.border,
  };

  if (!data.rows || data.rows.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full text-muted-foreground"
        data-testid="pivot-table-empty"
      >
        No data available
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="pivot-table-chart">
      {/* Search bar */}
      <div className="flex justify-end flex-shrink-0 px-2 py-1">
        <TableSearchBar
          query={search.query}
          onQueryChange={search.setQuery}
          totalMatches={search.totalMatches}
          onClear={search.clear}
        />
      </div>

      {/* Scrollable table */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table
          className="w-full border-separate border-spacing-0 text-sm"
          data-testid="pivot-table"
        >
          <thead
            className="sticky top-0 z-20"
            style={{ backgroundColor: theme.header, color: theme.headerText }}
          >
            {/* Nested column dimension header rows */}
            {headerLevels.map((spans, level) => (
              <tr key={`col-header-${level}`}>
                {/* Empty corner cell — only on the first header row */}
                {level === 0 && (
                  <th
                    colSpan={dimCount}
                    rowSpan={numColDims}
                    className={`border-b border-r ${frozenHeaderClass}`}
                    style={headerCellStyle}
                  />
                )}
                {spans.map((span, spanIdx) => {
                  const isSubtotalHeader = span.value === COL_SUBTOTAL_MARKER;
                  return (
                    <th
                      key={`ch-${level}-${spanIdx}`}
                      colSpan={span.span * metricCount}
                      className={`px-3 py-2 text-center font-semibold border-b border-r ${
                        isSubtotalHeader ? 'italic' : ''
                      }`}
                      style={{
                        ...headerCellStyle,
                        ...(isSubtotalHeader
                          ? { backgroundColor: theme.subtotalRow, color: theme.headerText }
                          : {}),
                      }}
                    >
                      {isSubtotalHeader ? columnSubtotalLabel || 'Subtotal' : span.value}
                    </th>
                  );
                })}
                {/* Total column header — only on first row, spanning all header rows */}
                {level === 0 && (
                  <th
                    colSpan={metricCount}
                    rowSpan={numColDims}
                    className="px-3 py-2 text-center font-semibold border-b"
                    style={headerCellStyle}
                  >
                    Total
                  </th>
                )}
              </tr>
            ))}

            {/* Metric names row */}
            <tr>
              {rowDimLabels.map((label, idx) => (
                <th
                  key={`dim-header-${idx}`}
                  className={`px-3 py-2 text-left font-semibold border-b border-r ${
                    idx === 0 ? frozenHeaderClass : ''
                  }`}
                  style={headerCellStyle}
                >
                  {label}
                </th>
              ))}
              {hasColumnKeys ? (
                <>
                  {effectiveColumns.map((col, colIdx) => {
                    const isColSubtotal = col.type === 'column_subtotal';
                    return metricHeaders.map((metric, mIdx) => (
                      <th
                        key={`metric-${colIdx}-${mIdx}`}
                        className={`px-3 py-2 text-right font-medium border-b border-r cursor-pointer hover:opacity-80 ${
                          isColSubtotal ? 'italic' : ''
                        }`}
                        style={{
                          ...headerCellStyle,
                          ...(isColSubtotal
                            ? { backgroundColor: theme.subtotalRow, color: theme.headerText }
                            : {}),
                        }}
                        onClick={() =>
                          onSort?.({
                            column: metric,
                            pivot_value: col.headerKey
                              .filter((v) => v !== COL_SUBTOTAL_MARKER)
                              .join(' | '),
                            direction: 'desc',
                          })
                        }
                      >
                        {metric}
                      </th>
                    ));
                  })}
                  {/* Total column metrics */}
                  {metricHeaders.map((metric, mIdx) => (
                    <th
                      key={`metric-total-${mIdx}`}
                      className="px-3 py-2 text-right font-medium border-b border-r last:border-r-0 cursor-pointer hover:opacity-80"
                      style={headerCellStyle}
                      onClick={() => onSort?.({ column: metric, direction: 'desc' })}
                    >
                      {metric}
                    </th>
                  ))}
                </>
              ) : (
                metricHeaders.map((metric, mIdx) => (
                  <th
                    key={`metric-${mIdx}`}
                    className="px-3 py-2 text-right font-medium border-b cursor-pointer hover:opacity-80"
                    style={headerCellStyle}
                    onClick={() => onSort?.({ column: metric, direction: 'desc' })}
                  >
                    {metric}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIdx) => {
              const isZebraRow = zebraRows && !row.is_subtotal && rowIdx % 2 === 1;
              const rowBg = row.is_subtotal
                ? theme.subtotalRow
                : isZebraRow
                  ? theme.zebraRow
                  : theme.row;
              // Track column index to stay in sync with searchCells
              let colCounter = 0;

              return (
                <tr
                  key={`row-${rowIdx}`}
                  data-testid={`pivot-row-${rowIdx}`}
                  className={row.is_subtotal ? 'font-semibold' : ''}
                  style={{ backgroundColor: rowBg }}
                >
                  {/* Row dimension cells */}
                  {Array.from({ length: dimCount }).map((_, dimIdx) => {
                    const cellCol = colCounter;
                    colCounter++;

                    if (row.is_subtotal) {
                      if (dimIdx === 0) {
                        const groupLabel = row.row_labels.join(' > ');
                        const suffix = subtotalLabel || 'Subtotal';
                        return (
                          <td
                            key={`dim-${dimIdx}`}
                            colSpan={dimCount}
                            data-search-cell={`${rowIdx}-${cellCol}`}
                            className={`px-3 py-2 border-b border-r italic ${dimIdx === 0 ? frozenCellClass : ''}`}
                            style={{
                              ...borderStyle,
                              ...(dimIdx === 0 && freezeFirstColumn
                                ? { backgroundColor: rowBg }
                                : {}),
                              ...getSearchStyle(rowIdx, cellCol),
                            }}
                          >
                            {groupLabel} {suffix}
                          </td>
                        );
                      }
                      return null;
                    }

                    const span = rowSpans[rowIdx]?.[dimIdx] ?? 1;
                    if (span === 0) return null;

                    return (
                      <td
                        key={`dim-${dimIdx}`}
                        rowSpan={span > 1 ? span : undefined}
                        data-search-cell={`${rowIdx}-${cellCol}`}
                        className={`px-3 py-2 border-b border-r align-top ${dimIdx === 0 ? frozenCellClass : ''}`}
                        style={{
                          ...borderStyle,
                          ...(dimIdx === 0 && freezeFirstColumn ? { backgroundColor: rowBg } : {}),
                          ...getSearchStyle(rowIdx, cellCol),
                        }}
                      >
                        {row.row_labels[dimIdx] || ''}
                      </td>
                    );
                  })}

                  {/* Value cells per effective column (leaf + subtotal interleaved) */}
                  {hasColumnKeys
                    ? effectiveColumns.map((col, ecIdx) => {
                        const isColSubtotal = col.type === 'column_subtotal';
                        const colValues =
                          col.type === 'leaf'
                            ? row.values[col.leafIdx!]
                            : (row.column_subtotal_values?.[col.subIdx!] ??
                              Array(metricCount).fill(null));
                        return colValues.map((val, mIdx) => {
                          const cellCol = colCounter;
                          colCounter++;
                          const metricName = metricHeaders[mIdx] || '';
                          const bgColor = isColSubtotal
                            ? undefined
                            : getConditionalColor(val, metricName);
                          return (
                            <td
                              key={`val-${ecIdx}-${mIdx}`}
                              data-search-cell={`${rowIdx}-${cellCol}`}
                              className={`px-3 py-2 text-right border-b border-r tabular-nums ${
                                isColSubtotal ? 'font-semibold italic' : ''
                              }`}
                              style={{
                                ...borderStyle,
                                ...(isColSubtotal && !row.is_subtotal
                                  ? { backgroundColor: theme.subtotalRow }
                                  : {}),
                                ...getSearchStyle(rowIdx, cellCol, bgColor),
                              }}
                            >
                              {formatCell(val, metricName)}
                            </td>
                          );
                        });
                      })
                    : null}

                  {/* Row total cells */}
                  {row.row_total.map((val, mIdx) => {
                    const cellCol = colCounter;
                    colCounter++;
                    const metricName = metricHeaders[mIdx] || '';
                    const bgColor = getConditionalColor(val, metricName);
                    return (
                      <td
                        key={`total-${mIdx}`}
                        data-search-cell={`${rowIdx}-${cellCol}`}
                        className="px-3 py-2 text-right font-medium border-b tabular-nums"
                        style={{ ...borderStyle, ...getSearchStyle(rowIdx, cellCol, bgColor) }}
                      >
                        {formatCell(val, metricName)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>

          {/* Grand total row — sticky at bottom like header is sticky at top */}
          {data.grand_total && (
            <tfoot className="sticky bottom-0 z-10">
              <tr
                className="font-bold"
                style={{ backgroundColor: theme.grandTotalRow }}
                data-testid="pivot-grand-total-row"
              >
                <td
                  colSpan={dimCount}
                  className={`px-3 py-2 border-t-2 border-b border-r ${frozenCellClass}`}
                  style={{
                    borderColor: theme.border,
                    ...(freezeFirstColumn ? { backgroundColor: theme.grandTotalRow } : {}),
                  }}
                >
                  {grandTotalLabel || 'Grand Total'}
                </td>
                {hasColumnKeys
                  ? effectiveColumns.map((col, ecIdx) => {
                      const colValues =
                        col.type === 'leaf'
                          ? data.grand_total!.values[col.leafIdx!]
                          : (data.grand_total!.column_subtotal_values?.[col.subIdx!] ??
                            Array(metricCount).fill(null));
                      const isColSubtotal = col.type === 'column_subtotal';
                      return colValues.map((val, mIdx) => {
                        const metricName = metricHeaders[mIdx] || '';
                        return (
                          <td
                            key={`gt-val-${ecIdx}-${mIdx}`}
                            className={`px-3 py-2 text-right border-t-2 border-b border-r tabular-nums ${
                              isColSubtotal ? 'italic' : ''
                            }`}
                            style={borderStyle}
                          >
                            {formatCell(val, metricName)}
                          </td>
                        );
                      });
                    })
                  : null}
                {data.grand_total.row_total.map((val, mIdx) => {
                  const metricName = metricHeaders[mIdx] || '';
                  return (
                    <td
                      key={`gt-total-${mIdx}`}
                      className="px-3 py-2 text-right border-t-2 border-b tabular-nums"
                      style={borderStyle}
                    >
                      {formatCell(val, metricName)}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div
          className="flex items-center justify-between pt-3 border-t flex-shrink-0"
          style={{ borderColor: theme.border }}
          data-testid="pivot-pagination"
        >
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {totalPages} ({pagination.totalGroups} groups)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              data-testid="pivot-prev-page-btn"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              data-testid="pivot-next-page-btn"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
