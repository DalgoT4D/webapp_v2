'use client';

import { useMemo, useState } from 'react';
import {
  Triangle,
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
import { TableSearchBar } from './TableSearchBar';
import type { ConditionalFormattingRule } from './types/table/types';

// URL detection pattern - matches http://, https://, and www. prefixed URLs
const URL_PATTERN = /^(https?:\/\/|www\.)/i;

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
  // Reports a header click only — the parent owns the entire asc/desc/clear cycle
  // decision (it's the only one who knows whether the shown direction is a session
  // override or the chart's saved default; this component can't tell them apart).
  // It re-fetches with the new sort applied server-side and passes the
  // already-sorted `data` + updated `config.sort` back down.
  onSort?: (column: string) => void;
  isLoading?: boolean;
  error?: any;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
  };
  // The parent owns the search term — it re-fetches server-side with the term applied,
  // so `data` arrives already filtered to matching rows. No search bar renders unless
  // the parent wires this up (same gating pattern as onSort).
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
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
  searchQuery,
  onSearchChange,
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

  // Sorting is applied server-side (the parent re-fetches with `sort` included in the
  // query, so `data` arrives already sorted) — this just paginates whatever it's given.
  const paginatedData = useMemo(() => {
    if (isServerSidePagination) {
      // For server-side pagination, data is already paginated (and sorted)
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

  // `sort` is fully controlled by the parent (it reflects whatever was actually
  // applied server-side), so the arrow just mirrors it — no local sort state here.
  const getSortDirection = (column: string) => sort.find((s) => s.column === column)?.direction;

  // Just relay the click — the parent decides asc/desc/clear (see the onSort prop
  // comment above for why that decision can't be made from `sort` here).
  const handleSort = (column: string) => {
    onSort?.(column);
  };

  // Search bar — only when the parent wires onSearchChange (it owns re-fetching
  // matching rows server-side, same gating pattern as onSort). Rendered from a
  // shared variable so it also shows up on the "no rows match" empty state below —
  // otherwise a search with zero results hides the only way back to an unfiltered view.
  const searchBar = onSearchChange && (
    <div className="flex-shrink-0 py-1 mb-2">
      <TableSearchBar
        query={searchQuery || ''}
        onQueryChange={onSearchChange}
        totalMatches={pagination?.total ?? paginatedData.length}
        onClear={() => onSearchChange('')}
      />
    </div>
  );

  // Each branch below only computes the inner content — the search bar (searchBar,
  // above) stays constant in the wrapper regardless of loading/error/empty/data state,
  // so it's never hidden (e.g. a search with zero results still lets you clear it).
  let content: React.ReactNode;
  if (isLoading) {
    content = (
      <div className="relative flex-1 min-h-[300px]">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-sm text-muted-foreground">Loading table data...</p>
          </div>
        </div>
      </div>
    );
  } else if (error) {
    content = (
      <div className="relative flex-1">
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
    const isEmptyFromSearch = !!searchQuery?.trim();
    content = (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-muted-foreground">
          {isEmptyFromSearch ? (
            <>
              <p>No rows match your search</p>
              <p className="text-sm mt-2">Try a different term, or clear the search above.</p>
            </>
          ) : (
            <>
              <p>No data available</p>
              <p className="text-sm mt-2">Configure your table to display data</p>
            </>
          )}
        </div>
      </div>
    );
  } else if (columns.length === 0) {
    content = (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-muted-foreground">
          <p>No columns configured</p>
          <p className="text-sm mt-2">Select columns to display in the table</p>
        </div>
      </div>
    );
  } else {
    content = (
      <>
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <TableHeader className="sticky top-0 z-20" style={{ backgroundColor: theme.header }}>
              <TableRow>
                {columns.map((column) => {
                  const sortDirection = getSortDirection(column);
                  // Sortable only when the parent actually wires up onSort (it re-fetches
                  // server-side with the new sort applied — no-op otherwise).
                  const canSort = !!onSort;

                  return (
                    <TableHead
                      key={column}
                      className={`font-semibold py-2 px-2 ${getAlignmentClass(column, data[0]?.[column])} ${
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
                          data-testid={`table-column-sort-${column}`}
                        >
                          <span>{column}</span>
                          <span className="flex flex-col gap-0.5">
                            <Triangle
                              className={
                                sortDirection === 'asc'
                                  ? 'size-1.5 text-foreground'
                                  : 'size-1.5 text-muted-foreground'
                              }
                              fill={sortDirection === 'asc' ? 'currentColor' : 'none'}
                            />
                            <Triangle
                              className={
                                sortDirection === 'desc'
                                  ? 'size-1.5 rotate-180 text-foreground'
                                  : 'size-1.5 rotate-180 text-muted-foreground'
                              }
                              fill={sortDirection === 'desc' ? 'currentColor' : 'none'}
                            />
                          </span>
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
                        const linkAlignClass = getAlignmentClass(column, rawValue);
                        const isLinkFrozen =
                          config.freezeFirstColumn && columns.indexOf(column) === 0;

                        return (
                          <TableCell
                            key={column}
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
                      const isFrozen = config.freezeFirstColumn && columns.indexOf(column) === 0;

                      const cellStyle: React.CSSProperties = {
                        borderColor: theme.border,
                      };
                      if (conditionalColor) {
                        cellStyle.backgroundColor = conditionalColor;
                      } else if (isFrozen) {
                        cellStyle.backgroundColor = rowBg;
                      }

                      return (
                        <TableCell
                          key={column}
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
                    <SelectTrigger className="h-8 w-[70px]">
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
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Previous page</span>
                </Button>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-sm font-medium">
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
                >
                  <ChevronLast className="h-4 w-4" />
                  <span className="sr-only">Last page</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {searchBar}
      {content}
    </div>
  );
}
