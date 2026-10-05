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
import { type NumberFormat, type DateFormat } from '@/lib/formatters';
import { getTableTheme } from '@/components/charts/styling/table-themes';
import { useTableSearch } from '../../hooks/useTableSearch';
import { TableSearchBar } from '@/components/charts/styling/TableSearchBar';
import type { ConditionalFormattingRule } from '@/components/charts/styling/conditional-formatting';
import {
  formatTableCell,
  getConditionalCellColor,
  getAlignmentClass,
  isValidUrl,
  normalizeUrl,
} from './table-cells';

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

  // --- Search integration ---

  // Build flat cell list from visible (paginated) data for search
  const searchCells = useMemo(() => {
    const cells: { rowIndex: number; colIndex: number; displayValue: string }[] = [];
    paginatedData.forEach((row, rowIdx) => {
      columns.forEach((column, colIdx) => {
        const rawValue = row[column];
        const displayValue = formatTableCell(rawValue, column_formatting[column]);
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

  // Handle loading state
  if (isLoading) {
    return (
      <div className="relative w-full h-full min-h-[300px]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-sm text-muted-foreground">Loading table data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
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
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-muted-foreground">
          <p>No data available</p>
          <p className="text-sm mt-2">Configure your table to display data</p>
        </div>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-muted-foreground">
          <p>No columns configured</p>
          <p className="text-sm mt-2">Select columns to display in the table</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
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
                    className={`font-semibold py-2 px-2 ${getAlignmentClass(config.columnAlignment?.[column], columns, column, data[0]?.[column])} ${
                      config.freezeFirstColumn && columns.indexOf(column) === 0
                        ? 'sticky left-0 z-10 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]'
                        : ''
                    }`}
                    style={{
                      color: theme.headerText,
                      backgroundColor: theme.header,
                      borderColor: theme.border,
                    }}
                  >
                    {canSort ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => handleSort(column)}
                        data-testid={`chart-table-sort-${column}`}
                      >
                        <span className="mr-1">{column}</span>
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
                      const linkAlignClass = getAlignmentClass(
                        config.columnAlignment?.[column],
                        columns,
                        column,
                        rawValue
                      );
                      const isLinkFrozen =
                        config.freezeFirstColumn && columns.indexOf(column) === 0;
                      const linkColIdx = columns.indexOf(column);

                      return (
                        <TableCell
                          key={column}
                          data-search-cell={`${index}-${linkColIdx}`}
                          className={`py-1.5 px-2 ${linkAlignClass} ${
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
                            data-testid={`chart-table-link-${index}-${column}`}
                          >
                            Link
                          </a>
                        </TableCell>
                      );
                    }

                    // Existing logic for non-link cells
                    const cellValue = formatTableCell(rawValue, column_formatting[column]);
                    const conditionalColor = getConditionalCellColor(
                      config.conditionalFormatting,
                      rawValue,
                      column,
                      currentDimensionColumn
                    );
                    const alignClass = getAlignmentClass(
                      config.columnAlignment?.[column],
                      columns,
                      column,
                      rawValue
                    );
                    const isFrozen = config.freezeFirstColumn && columns.indexOf(column) === 0;
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
                        data-testid={
                          isDrillDownClickable
                            ? `chart-table-drill-cell-${index}-${column}`
                            : undefined
                        }
                        className={`py-1.5 px-2 ${alignClass} ${
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
                        {cellValue}
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
        <div className="flex items-center justify-between border-t px-4 py-3">
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
                  <SelectTrigger className="h-8 w-[70px]" data-testid="chart-table-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10" data-testid="chart-table-page-size-option-10">
                      10
                    </SelectItem>
                    <SelectItem value="20" data-testid="chart-table-page-size-option-20">
                      20
                    </SelectItem>
                    <SelectItem value="50" data-testid="chart-table-page-size-option-50">
                      50
                    </SelectItem>
                    <SelectItem value="100" data-testid="chart-table-page-size-option-100">
                      100
                    </SelectItem>
                    <SelectItem value="200" data-testid="chart-table-page-size-option-200">
                      200
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  if (isServerSidePagination) {
                    pagination?.onPageChange(1);
                  } else {
                    setCurrentPage(1);
                  }
                }}
                disabled={isServerSidePagination ? pagination!.page === 1 : currentPage === 1}
                data-testid="chart-table-first-page-btn"
              >
                <ChevronFirst className="h-4 w-4" />
                <span className="sr-only">First page</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  if (isServerSidePagination) {
                    pagination?.onPageChange(pagination.page - 1);
                  } else {
                    setCurrentPage(currentPage - 1);
                  }
                }}
                disabled={isServerSidePagination ? pagination!.page === 1 : currentPage === 1}
                data-testid="chart-table-prev-page-btn"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Previous page</span>
              </Button>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-sm font-medium" data-testid="chart-table-page-info">
                Page {isServerSidePagination ? pagination!.page : currentPage} of {totalPages}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
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
                data-testid="chart-table-next-page-btn"
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Next page</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
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
                data-testid="chart-table-last-page-btn"
              >
                <ChevronLast className="h-4 w-4" />
                <span className="sr-only">Last page</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
