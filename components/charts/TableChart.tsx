'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertCircle,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatNumber, formatDate, type NumberFormat, type DateFormat } from '@/lib/formatters';
import { getTableTheme } from './types/table/constants';
import { useTableSearch } from './hooks/useTableSearch';
import { TableSearchBar } from './TableSearchBar';
import { useResizeObserver } from '@/hooks/useResizeObserver';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ConditionalFormattingRule } from './types/table/types';

// URL detection pattern - matches http://, https://, and www. prefixed URLs
const URL_PATTERN = /^(https?:\/\/|www\.)/i;

/**
 * Container width (in px) below which the table switches to its narrow layout.
 * The pagination footer alone needs ~300px for the "Showing X to Y of Z rows" text
 * plus the page-size select, so below this the controls crush or overflow. This
 * catches both phone viewports and narrow chart cells on a desktop dashboard.
 */
const NARROW_TABLE_WIDTH_PX = 480;

/**
 * Max width (in px) of a single cell in narrow layout. Without a cap, cells never
 * truncate (the base table sets `whitespace-nowrap`) and the table's intrinsic width
 * grows past 1500px, so users scrub sideways through a tiny window. ~140px keeps
 * 2-3 columns visible on a 360px phone screen; full values stay available via `title`.
 */
const NARROW_CELL_MAX_WIDTH_PX = 140;

/**
 * Check if a value is a valid URL that should be rendered as a clickable link
 */
function isValidUrl(value: any): boolean {
  if (value == null || typeof value !== 'string') {
    return false;
  }
  return URL_PATTERN.test(value.trim());
}

/**
 * Caps a cell's content width in narrow layout so the column stops growing with its
 * longest value. The clamp lives on an inner block element rather than on the `<td>`
 * itself because `max-width` on a table cell is only a hint under `table-layout: auto`
 * — browsers still widen the column to fit the content. On desktop this renders the
 * children untouched (no extra element), so the desktop DOM is unchanged.
 */
function NarrowCellClamp({ isNarrow, children }: { isNarrow: boolean; children: React.ReactNode }) {
  if (!isNarrow) {
    return <>{children}</>;
  }
  return (
    <div className="truncate" style={{ maxWidth: NARROW_CELL_MAX_WIDTH_PX }}>
      {children}
    </div>
  );
}

/**
 * Normalize a URL for use in href attribute
 * Adds https:// prefix to www. URLs if missing
 */
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.toLowerCase().startsWith('www.')) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

interface TableChartProps {
  data?: Record<string, any>[];
  config?: {
    table_columns?: string[];
    column_formatting?: Record<
      string,
      {
        type?: 'currency' | 'percentage' | 'date' | 'number' | 'text';
        numberFormat?: NumberFormat;
        dateFormat?: DateFormat;
        decimalPlaces?: number;
        /** @deprecated Use decimalPlaces instead. Kept for backwards compatibility. */
        precision?: number;
        prefix?: string;
        suffix?: string;
      }
    >;
    sort?: Array<{
      column: string;
      direction: 'asc' | 'desc';
    }>;
    pagination?: {
      enabled: boolean;
      page_size: number;
    };
    conditionalFormatting?: ConditionalFormattingRule[];
    columnAlignment?: Record<string, string>;
    zebraRows?: boolean;
    freezeFirstColumn?: boolean;
    theme?: string;
  };
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  isLoading?: boolean;
  error?: any;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
  };
  onRowClick?: (rowData: Record<string, any>, columnName: string) => void;
  drillDownEnabled?: boolean;
  currentDimensionColumn?: string;
  /**
   * 0-based index of the currently-displayed dimension in orderedDimensions.
   * 0 = top level (no drill). Used to enforce level-scoped conditional formatting rules.
   */
  currentDrillLevel?: number;
}

export function TableChart({
  data = [],
  config = {},
  onSort,
  isLoading,
  error,
  pagination,
  onRowClick,
  drillDownEnabled = false,
  currentDimensionColumn,
  currentDrillLevel = 0,
}: TableChartProps) {
  const { table_columns, column_formatting = {}, sort = [], pagination: configPagination } = config;

  // Resolve color theme
  const theme = useMemo(() => getTableTheme(config.theme), [config.theme]);

  // --- Narrow (mobile / small chart cell) layout detection ---
  // Container-based, because a chart cell on a desktop dashboard can be just as narrow
  // as a phone. `width` is 0 until the ResizeObserver has measured, so fall back to the
  // viewport check for the first paint (and for any container we fail to measure).
  const { ref: containerRef, width: containerWidth } = useResizeObserver<HTMLDivElement>();
  const isMobileViewport = useIsMobile();
  const isNarrow = containerWidth > 0 ? containerWidth < NARROW_TABLE_WIDTH_PX : isMobileViewport;

  // Pagination buttons grow to a 40px touch target in narrow layout; desktop keeps 32px.
  const paginationButtonClass = isNarrow ? 'h-10 w-10' : 'h-8 w-8';

  // Determine if we're using server-side pagination (pagination prop provided) or fallback to client-side
  const isServerSidePagination = !!pagination;

  // Client-side pagination state (fallback when no server-side pagination)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(configPagination?.page_size || 10);

  // Get columns to display - either from config or all available columns
  const columns = useMemo(() => {
    if (table_columns && table_columns.length > 0) {
      return table_columns;
    }
    if (data.length > 0) {
      return Object.keys(data[0]);
    }
    return [];
  }, [data, table_columns]);

  // Freeze the first column whenever the builder asked for it, and always in narrow layout:
  // horizontal scrolling is the only way to read a table on a phone, and without a frozen
  // first column the row identifier scrolls out of view. Skipped for single-column tables,
  // where a sticky column would just eat the whole width.
  const freezeFirstColumn = (isNarrow && columns.length > 1) || !!config.freezeFirstColumn;

  // Calculate paginated data
  const paginatedData = useMemo(() => {
    if (isServerSidePagination) {
      // For server-side pagination, data is already paginated
      return data;
    }

    // Client-side pagination fallback
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, pageSize, isServerSidePagination]);

  // Calculate total pages
  const totalPages = useMemo(() => {
    if (isServerSidePagination) {
      return Math.ceil((pagination?.total || 0) / (pagination?.pageSize || 10));
    }
    // Client-side pagination fallback
    if (data.length === 0) return 1;
    return Math.ceil(data.length / pageSize);
  }, [data.length, pageSize, isServerSidePagination, pagination?.total, pagination?.pageSize]);

  // Reset to page 1 when data changes (client-side only)
  useMemo(() => {
    if (!isServerSidePagination) {
      setCurrentPage(1);
    }
  }, [data, isServerSidePagination]);

  // Format cell value based on column formatting config
  const formatCellValue = (value: any, column: string) => {
    const formatting = column_formatting[column];

    if (!formatting || value == null) {
      return value?.toString() || '';
    }

    const { type, numberFormat, dateFormat, prefix = '', suffix = '' } = formatting;
    // Support both decimalPlaces (new) and precision (old) for backwards compatibility
    const decimalPlaces = formatting.decimalPlaces ?? formatting.precision;

    // Use formatDate path when dateFormat is explicitly specified
    if (dateFormat && dateFormat !== 'default') {
      try {
        const formatted = formatDate(value, { format: dateFormat });
        return `${prefix}${formatted}${suffix}`;
      } catch {
        return value?.toString() || '';
      }
    }

    // Use formatNumber path when:
    // - numberFormat is explicitly specified, OR
    // - decimalPlaces is specified AND no type is specified (for pure decimal formatting)
    // Also handles numeric strings from aggregated metric columns (e.g. backend returns "6500000")
    if (numberFormat || (decimalPlaces !== undefined && !type)) {
      const numericValue = Number(value);
      if (!isNaN(numericValue)) {
        const formatted = formatNumber(numericValue, {
          format: numberFormat || 'default',
          decimalPlaces: decimalPlaces,
        });
        return `${prefix}${formatted}${suffix}`;
      }
      return value?.toString() || '';
    }

    // For type-based formatting, only format actual numeric values (typeof === 'number')
    switch (type) {
      case 'currency':
        if (typeof value !== 'number') return value?.toString() || '';
        return `${prefix}$${value.toFixed(decimalPlaces ?? 2)}${suffix}`;

      case 'percentage':
        if (typeof value !== 'number') return value?.toString() || '';
        return `${prefix}${(value * 100).toFixed(decimalPlaces ?? 2)}%${suffix}`;

      case 'number':
        if (typeof value !== 'number') return value?.toString() || '';
        return `${prefix}${value.toFixed(decimalPlaces ?? 0)}${suffix}`;

      case 'date':
        try {
          const dateValue = new Date(value);
          return `${prefix}${dateValue.toLocaleDateString()}${suffix}`;
        } catch {
          return value?.toString() || '';
        }

      case 'text':
      default:
        return `${prefix}${value?.toString() || ''}${suffix}`;
    }
  };

  // Evaluate conditional formatting rules for a cell
  const getConditionalColor = (value: any, column: string): string | undefined => {
    const rules = config.conditionalFormatting;
    if (!rules || rules.length === 0) return undefined;

    // Last matching rule wins
    let matchedColor: string | undefined;
    for (const rule of rules) {
      if (rule.column !== column) continue;
      // Skip rules scoped to a different drill level (level stores dimension column name)
      if (rule.level !== undefined && rule.level !== currentDimensionColumn) continue;

      // Treat legacy rules saved without a `type` field as numeric
      const ruleType = (rule as { type?: 'numeric' | 'text' }).type ?? 'numeric';
      let matches = false;

      if (ruleType === 'text') {
        // String comparison (case-sensitive exact match)
        const cellStr = String(value ?? '');
        const ruleStr = String(rule.value);
        matches = rule.operator === '==' ? cellStr === ruleStr : cellStr !== ruleStr;
      } else {
        // Numeric comparison — skip this rule if cell value is not numeric
        const numValue = Number(value);
        if (isNaN(numValue)) continue;

        switch (rule.operator) {
          case '>':
            matches = numValue > (rule.value as number);
            break;
          case '<':
            matches = numValue < (rule.value as number);
            break;
          case '>=':
            matches = numValue >= (rule.value as number);
            break;
          case '<=':
            matches = numValue <= (rule.value as number);
            break;
          case '==':
            // rule.value is a number — use numeric comparison to preserve float equality
            matches = numValue === (rule.value as number);
            break;
          case '!=':
            matches = numValue !== (rule.value as number);
            break;
        }
      }

      if (matches) {
        matchedColor = rule.color;
      }
    }
    return matchedColor;
  };

  // Get alignment class for a column.
  // Auto is position-aware for multi-column tables to keep the layout balanced
  // regardless of column order:
  //   - First column → always left (row-identifier convention)
  //   - Last column → always right (totals convention)
  //   - Middle (and single-column) → type-based: numeric right, text left
  // Users can always override per column via the alignment dropdown.
  const getAlignmentClass = (column: string, sampleValue: any): string => {
    const explicitAlignment = config.columnAlignment?.[column];
    if (explicitAlignment) {
      switch (explicitAlignment) {
        case 'left':
          return 'text-left';
        case 'center':
          return 'text-center';
        case 'right':
          return 'text-right';
      }
    }
    if (columns.length > 1) {
      const colIdx = columns.indexOf(column);
      if (colIdx === 0) return 'text-left';
      if (colIdx === columns.length - 1) return 'text-right';
    }
    // Type-based fallback for middle columns and single-column tables
    if (sampleValue != null) {
      const isNumeric = typeof sampleValue === 'number' || !isNaN(Number(sampleValue));
      return isNumeric ? 'text-right' : 'text-left';
    }
    return 'text-left';
  };

  // --- Search integration ---

  // Build flat cell list from visible (paginated) data for search
  const searchCells = useMemo(() => {
    const cells: { rowIndex: number; colIndex: number; displayValue: string }[] = [];
    paginatedData.forEach((row, rowIdx) => {
      columns.forEach((column, colIdx) => {
        const rawValue = row[column];
        const displayValue = formatCellValue(rawValue, column);
        cells.push({ rowIndex: rowIdx, colIndex: colIdx, displayValue: String(displayValue) });
      });
    });
    return cells;
  }, [paginatedData, columns, column_formatting]);

  const search = useTableSearch(searchCells);

  // Helper: is this cell a search match?
  const isSearchMatch = useCallback(
    (rowIdx: number, colIdx: number): boolean => {
      return search.matches.some((m) => m.rowIndex === rowIdx && m.colIndex === colIdx);
    },
    [search.matches]
  );

  // Get sort direction for a column
  const getSortDirection = (column: string) => {
    const sortConfig = sort.find((s) => s.column === column);
    return sortConfig?.direction;
  };

  // Handle column header click for sorting
  const handleSort = (column: string) => {
    if (!onSort) return;

    const currentDirection = getSortDirection(column);
    const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
    onSort(column, newDirection);
  };

  // Loading / error / empty states render inside the same wrapper as the table (below)
  // rather than returning early, so the ResizeObserver ref stays attached to a mounted
  // node. The hook observes once on mount; an early return here would leave it with
  // nothing to measure and the narrow layout would never activate after data arrives.
  let stateContent: React.ReactNode = null;

  if (isLoading) {
    stateContent = (
      <div className="relative w-full h-full min-h-[300px]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-sm text-muted-foreground">Loading table data...</p>
          </div>
        </div>
      </div>
    );
  } else if (error) {
    stateContent = (
      <div className="relative h-full">
        <div className="absolute top-0 left-0 right-0 z-10 p-4">
          <Alert variant="warning">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Table configuration needs a small adjustment. Please review your settings and try
              again.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  } else if (!data || data.length === 0) {
    stateContent = (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-muted-foreground">
          <p>No data available</p>
          <p className="text-sm mt-2">Configure your table to display data</p>
        </div>
      </div>
    );
  } else if (columns.length === 0) {
    stateContent = (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-muted-foreground">
          <p>No columns configured</p>
          <p className="text-sm mt-2">Select columns to display in the table</p>
        </div>
      </div>
    );
  }

  // Both this return and the one below use an identical root <div>, so React reuses the
  // same DOM node when the table swaps from loading to data — which is what keeps the
  // ResizeObserver attached across that transition.
  if (stateContent) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col" data-testid="table-chart">
        {stateContent}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col" data-testid="table-chart">
      {/* Search bar */}
      <div className="flex-shrink-0 py-1 mb-2">
        <TableSearchBar
          query={search.query}
          onQueryChange={search.setQuery}
          totalMatches={search.totalMatches}
          onClear={search.clear}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-20" style={{ backgroundColor: theme.header }}>
            <TableRow>
              {columns.map((column) => {
                const sortDirection = getSortDirection(column);
                const canSort = !!onSort;

                return (
                  <TableHead
                    key={column}
                    title={isNarrow ? column : undefined}
                    className={`font-semibold py-2 px-2 ${getAlignmentClass(column, data[0]?.[column])} ${
                      freezeFirstColumn && columns.indexOf(column) === 0
                        ? 'sticky left-0 z-10 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]'
                        : ''
                    }`}
                    style={{
                      color: theme.headerText,
                      backgroundColor: theme.header,
                      borderColor: theme.border,
                    }}
                  >
                    <NarrowCellClamp isNarrow={isNarrow}>
                      {canSort ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`font-semibold hover:bg-transparent ${
                            isNarrow ? 'h-auto min-h-10 max-w-full p-0' : 'h-auto p-0'
                          }`}
                          onClick={() => handleSort(column)}
                        >
                          <span className={`mr-1 ${isNarrow ? 'truncate' : ''}`}>{column}</span>
                          {sortDirection === 'asc' ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : sortDirection === 'desc' ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <div className="h-3 w-3" />
                          )}
                        </Button>
                      ) : (
                        column
                      )}
                    </NarrowCellClamp>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row, index) => {
              const rowBg = config.zebraRows && index % 2 === 1 ? theme.zebraRow : theme.row;
              return (
                <TableRow
                  key={index}
                  className={`hover:bg-transparent ${
                    drillDownEnabled && currentDimensionColumn ? 'cursor-pointer' : ''
                  }`}
                  style={{ backgroundColor: rowBg }}
                >
                  {columns.map((column) => {
                    const isDrillDownClickable =
                      drillDownEnabled && currentDimensionColumn === column && onRowClick;
                    const rawValue = row[column];
                    const isLink = !isDrillDownClickable && isValidUrl(rawValue);

                    // Render as clickable link if value is a URL (and not a drill-down cell)
                    if (isLink) {
                      const href = normalizeUrl(rawValue);
                      const linkAlignClass = getAlignmentClass(column, rawValue);
                      const isLinkFrozen = freezeFirstColumn && columns.indexOf(column) === 0;
                      const linkColIdx = columns.indexOf(column);

                      return (
                        <TableCell
                          key={column}
                          data-search-cell={`${index}-${linkColIdx}`}
                          className={`px-2 ${isNarrow ? 'py-2.5' : 'py-1.5'} ${linkAlignClass} ${
                            isLinkFrozen
                              ? 'sticky left-0 z-10 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]'
                              : ''
                          }`}
                          style={{
                            borderColor: theme.border,
                            ...(isLinkFrozen ? { backgroundColor: rowBg } : {}),
                          }}
                        >
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Link
                          </a>
                        </TableCell>
                      );
                    }

                    // Existing logic for non-link cells
                    const cellValue = formatCellValue(rawValue, column);
                    const conditionalColor = getConditionalColor(rawValue, column);
                    const alignClass = getAlignmentClass(column, rawValue);
                    const isFrozen = freezeFirstColumn && columns.indexOf(column) === 0;
                    const colIdx = columns.indexOf(column);
                    const matchHighlight = isSearchMatch(index, colIdx);

                    const cellStyle: React.CSSProperties = {
                      borderColor: theme.border,
                    };
                    if (matchHighlight) {
                      cellStyle.backgroundColor = '#fde68a'; // amber-200 for search matches
                    } else if (conditionalColor) {
                      cellStyle.backgroundColor = conditionalColor;
                    } else if (isFrozen) {
                      cellStyle.backgroundColor = rowBg;
                    }

                    return (
                      <TableCell
                        key={column}
                        data-search-cell={`${index}-${colIdx}`}
                        // Full value stays reachable when the cell is truncated
                        title={isNarrow ? String(cellValue) : undefined}
                        className={`px-2 ${isNarrow ? 'py-2.5' : 'py-1.5'} ${alignClass} ${
                          isDrillDownClickable
                            ? 'text-blue-600 hover:text-blue-800 hover:underline cursor-pointer'
                            : ''
                        } ${
                          isFrozen
                            ? 'sticky left-0 z-10 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]'
                            : ''
                        }`}
                        style={cellStyle}
                        onClick={
                          isDrillDownClickable
                            ? () => {
                                onRowClick(row, column);
                              }
                            : undefined
                        }
                      >
                        <NarrowCellClamp isNarrow={isNarrow}>{cellValue}</NarrowCellClamp>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </table>
      </div>

      {/* Pagination Controls */}
      {(isServerSidePagination ? (pagination?.total || 0) > 0 : data.length > 0) && (
        <div
          className={`flex flex-wrap items-center gap-2 border-t ${
            isNarrow ? 'justify-center px-2 py-2' : 'justify-between px-4 py-3'
          }`}
          data-testid="table-pagination-footer"
        >
          {/* Row-count text and page-size picker need ~300px; they are dropped in narrow
              layout so the prev/next controls stay usable instead of overflowing. */}
          {!isNarrow && (
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {isServerSidePagination ? (
                    <>
                      Showing {(pagination!.page - 1) * pagination!.pageSize + 1} to{' '}
                      {Math.min(pagination!.page * pagination!.pageSize, pagination!.total)} of{' '}
                      {pagination!.total.toLocaleString()} rows
                    </>
                  ) : (
                    <>
                      Showing {(currentPage - 1) * pageSize + 1} to{' '}
                      {Math.min(currentPage * pageSize, data.length)} of{' '}
                      {data.length.toLocaleString()} rows
                    </>
                  )}
                </span>
                {(isServerSidePagination ? pagination?.onPageSizeChange : true) && (
                  <Select
                    value={
                      isServerSidePagination ? pagination!.pageSize.toString() : pageSize.toString()
                    }
                    onValueChange={(value) => {
                      const newPageSize = parseInt(value);
                      if (isServerSidePagination) {
                        pagination?.onPageSizeChange?.(newPageSize);
                      } else {
                        setPageSize(newPageSize);
                        setCurrentPage(1);
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 w-[70px]" data-testid="table-page-size-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {/* First/last jumps are dropped in narrow layout — prev/next cover the
                  common case and every button here has to fit on one row. */}
              {!isNarrow && (
                <Button
                  variant="outline"
                  size="icon"
                  className={paginationButtonClass}
                  data-testid="table-pagination-first-btn"
                  onClick={() => {
                    if (isServerSidePagination) {
                      pagination?.onPageChange(1);
                    } else {
                      setCurrentPage(1);
                    }
                  }}
                  disabled={isServerSidePagination ? pagination!.page === 1 : currentPage === 1}
                >
                  <ChevronFirst className="h-4 w-4" />
                  <span className="sr-only">First page</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                className={paginationButtonClass}
                data-testid="table-pagination-prev-btn"
                onClick={() => {
                  if (isServerSidePagination) {
                    pagination?.onPageChange(pagination.page - 1);
                  } else {
                    setCurrentPage(currentPage - 1);
                  }
                }}
                disabled={isServerSidePagination ? pagination!.page === 1 : currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Previous page</span>
              </Button>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-sm font-medium" data-testid="table-pagination-page-indicator">
                Page {isServerSidePagination ? pagination!.page : currentPage} of {totalPages}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className={paginationButtonClass}
                data-testid="table-pagination-next-btn"
                onClick={() => {
                  if (isServerSidePagination) {
                    pagination?.onPageChange(pagination.page + 1);
                  } else {
                    setCurrentPage(currentPage + 1);
                  }
                }}
                disabled={
                  isServerSidePagination
                    ? pagination!.page * pagination!.pageSize >= pagination!.total
                    : currentPage === totalPages
                }
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Next page</span>
              </Button>
              {!isNarrow && (
                <Button
                  variant="outline"
                  size="icon"
                  className={paginationButtonClass}
                  data-testid="table-pagination-last-btn"
                  onClick={() => {
                    if (isServerSidePagination) {
                      pagination?.onPageChange(Math.ceil(pagination.total / pagination.pageSize));
                    } else {
                      setCurrentPage(totalPages);
                    }
                  }}
                  disabled={
                    isServerSidePagination
                      ? pagination!.page * pagination!.pageSize >= pagination!.total
                      : currentPage === totalPages
                  }
                >
                  <ChevronLast className="h-4 w-4" />
                  <span className="sr-only">Last page</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
