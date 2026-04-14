'use client';

import { useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { PivotTableResponse, PivotSort } from '@/types/pivot-table';
import { formatNumber, NumberFormats, type NumberFormat } from '@/lib/formatters';
import type { ConditionalFormattingRule } from '../types/table/types';
import { calculateRowSpans, exportPivotAsCsv } from './utils';

interface ColumnFormatConfig {
  numberFormat?: NumberFormat;
  decimalPlaces?: number;
}

interface PivotTableChartProps {
  data: PivotTableResponse;
  rowDimLabels: string[];
  customizations?: Record<string, unknown>;
  subtotalLabel?: string;
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

  const rowSpans = useMemo(
    () => calculateRowSpans(data.rows ?? [], dimCount),
    [data.rows, dimCount]
  );

  const totalPages = pagination ? Math.ceil(pagination.totalGroups / pagination.pageSize) : 1;

  const handleExport = useCallback(() => {
    const csv = exportPivotAsCsv(data, rowDimLabels);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pivot-table.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [data, rowDimLabels]);

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

  // Pre-compute header spans for each column dimension level
  const headerLevels = useMemo(() => {
    if (!hasColumnKeys || numColDims === 0) return [];
    const levels = [];
    for (let level = 0; level < numColDims; level++) {
      levels.push(computeHeaderSpans(columnKeys, level));
    }
    return levels;
  }, [columnKeys, hasColumnKeys, numColDims]);

  // Frozen column styles
  const frozenCellClass = freezeFirstColumn
    ? 'sticky left-0 z-10 bg-background border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]'
    : '';
  const frozenHeaderClass = freezeFirstColumn
    ? 'sticky left-0 z-20 bg-muted/50 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]'
    : '';

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
      {/* Export button */}
      <div className="flex justify-end mb-2 flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={handleExport} data-testid="pivot-export-csv-btn">
          <Download className="h-4 w-4 mr-1" />
          CSV
        </Button>
      </div>

      {/* Scrollable table */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full border-collapse text-sm" data-testid="pivot-table">
          <thead className="sticky top-0 bg-background z-10">
            {/* Nested column dimension header rows */}
            {headerLevels.map((spans, level) => (
              <tr key={`col-header-${level}`} className="border-b">
                {/* Empty corner cell — only on the first header row */}
                {level === 0 && (
                  <th
                    colSpan={dimCount}
                    rowSpan={numColDims}
                    className={`border-r bg-muted/50 ${frozenHeaderClass}`}
                  />
                )}
                {spans.map((span, spanIdx) => (
                  <th
                    key={`ch-${level}-${spanIdx}`}
                    colSpan={span.span * metricCount}
                    className="px-3 py-2 text-center font-semibold border-r bg-muted/50"
                  >
                    {span.value}
                  </th>
                ))}
                {/* Total column header — only on first row, spanning all header rows */}
                {level === 0 && (
                  <th
                    colSpan={metricCount}
                    rowSpan={numColDims}
                    className="px-3 py-2 text-center font-semibold bg-muted/50"
                  >
                    Total
                  </th>
                )}
              </tr>
            ))}

            {/* Metric names row */}
            <tr className="border-b">
              {rowDimLabels.map((label, idx) => (
                <th
                  key={`dim-header-${idx}`}
                  className={`px-3 py-2 text-left font-semibold border-r bg-muted/50 ${
                    idx === 0 ? frozenHeaderClass : ''
                  }`}
                >
                  {label}
                </th>
              ))}
              {hasColumnKeys
                ? [...columnKeys, null].map((colKey, colIdx) => {
                    const isTotal = colKey === null;
                    return metricHeaders.map((metric, mIdx) => (
                      <th
                        key={`metric-${colIdx}-${mIdx}`}
                        className="px-3 py-2 text-right font-medium border-r last:border-r-0 bg-muted/50 cursor-pointer hover:bg-muted"
                        onClick={() =>
                          onSort?.({
                            column: metric,
                            pivot_value: isTotal ? undefined : colKey?.join(' | '),
                            direction: 'desc',
                          })
                        }
                      >
                        {metric}
                      </th>
                    ));
                  })
                : metricHeaders.map((metric, mIdx) => (
                    <th
                      key={`metric-${mIdx}`}
                      className="px-3 py-2 text-right font-medium bg-muted/50 cursor-pointer hover:bg-muted"
                      onClick={() => onSort?.({ column: metric, direction: 'desc' })}
                    >
                      {metric}
                    </th>
                  ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIdx) => {
              const isZebraRow = zebraRows && !row.is_subtotal && rowIdx % 2 === 1;

              return (
                <tr
                  key={`row-${rowIdx}`}
                  data-testid={`pivot-row-${rowIdx}`}
                  className={
                    row.is_subtotal
                      ? 'font-semibold bg-gray-200 border-t border-b border-gray-300'
                      : `border-b hover:bg-muted/10 ${isZebraRow ? 'bg-muted' : ''}`
                  }
                >
                  {/* Row dimension cells */}
                  {Array.from({ length: dimCount }).map((_, dimIdx) => {
                    if (row.is_subtotal) {
                      if (dimIdx === 0) {
                        const groupLabel = row.row_labels.join(' > ');
                        const suffix = subtotalLabel || 'Subtotal';
                        return (
                          <td
                            key={`dim-${dimIdx}`}
                            colSpan={dimCount}
                            className={`px-3 py-2 border-r italic ${dimIdx === 0 ? frozenCellClass : ''}`}
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
                        className={`px-3 py-2 border-r align-top ${dimIdx === 0 ? frozenCellClass : ''}`}
                      >
                        {row.row_labels[dimIdx] || ''}
                      </td>
                    );
                  })}

                  {/* Value cells per column key */}
                  {hasColumnKeys
                    ? row.values.map((colValues, colIdx) =>
                        colValues.map((val, mIdx) => {
                          const metricName = metricHeaders[mIdx] || '';
                          const bgColor = getConditionalColor(val, metricName);
                          return (
                            <td
                              key={`val-${colIdx}-${mIdx}`}
                              className="px-3 py-2 text-right border-r tabular-nums"
                              style={bgColor ? { backgroundColor: bgColor } : undefined}
                            >
                              {formatCell(val, metricName)}
                            </td>
                          );
                        })
                      )
                    : null}

                  {/* Row total cells */}
                  {row.row_total.map((val, mIdx) => {
                    const metricName = metricHeaders[mIdx] || '';
                    const bgColor = getConditionalColor(val, metricName);
                    return (
                      <td
                        key={`total-${mIdx}`}
                        className="px-3 py-2 text-right font-medium tabular-nums"
                        style={bgColor ? { backgroundColor: bgColor } : undefined}
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
                className="font-bold border-t-2 border-b border-gray-400 bg-gray-300"
                data-testid="pivot-grand-total-row"
              >
                <td
                  colSpan={dimCount}
                  className={`px-3 py-2 border-r ${frozenCellClass ? frozenCellClass + ' !bg-gray-300' : ''}`}
                >
                  {grandTotalLabel || 'Grand Total'}
                </td>
                {hasColumnKeys
                  ? data.grand_total.values.map((colValues, colIdx) =>
                      colValues.map((val, mIdx) => {
                        const metricName = metricHeaders[mIdx] || '';
                        return (
                          <td
                            key={`gt-val-${colIdx}-${mIdx}`}
                            className="px-3 py-2 text-right border-r tabular-nums"
                          >
                            {formatCell(val, metricName)}
                          </td>
                        );
                      })
                    )
                  : null}
                {data.grand_total.row_total.map((val, mIdx) => {
                  const metricName = metricHeaders[mIdx] || '';
                  return (
                    <td key={`gt-total-${mIdx}`} className="px-3 py-2 text-right tabular-nums">
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
