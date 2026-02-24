'use client';

import { useMemo, useState } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatNumber, type NumberFormat } from '@/lib/formatters';

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
}: TableChartProps) {
  const { table_columns, column_formatting = {}, sort = [], pagination: configPagination } = config;

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

  // Format cell value based on column formatting config
  const formatCellValue = (value: any, column: string) => {
    const formatting = column_formatting[column];

    if (!formatting || value == null) {
      return value?.toString() || '';
    }

    const { type, numberFormat, precision, prefix = '', suffix = '' } = formatting;

    // Use formatNumber path when:
    // - numberFormat is explicitly specified, OR
    // - precision is specified AND no type is specified (for pure decimal formatting)
    // Only format actual numeric values (typeof === 'number'), don't parse strings
    if (numberFormat || (precision !== undefined && !type)) {
      if (typeof value === 'number' && !isNaN(value)) {
        const formatted = formatNumber(value, {
          format: numberFormat || 'default',
          decimalPlaces: precision,
        });
        return `${prefix}${formatted}${suffix}`;
      }
      return value?.toString() || '';
    }

    // For type-based formatting, only format actual numeric values (typeof === 'number')
    switch (type) {
      case 'currency':
        if (typeof value !== 'number') return value?.toString() || '';
        return `${prefix}$${value.toFixed(precision ?? 2)}${suffix}`;

      case 'percentage':
        if (typeof value !== 'number') return value?.toString() || '';
        return `${prefix}${(value * 100).toFixed(precision ?? 2)}%${suffix}`;

      case 'number':
        if (typeof value !== 'number') return value?.toString() || '';
        return `${prefix}${value.toFixed(precision ?? 0)}${suffix}`;

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
      <div className="flex-1 overflow-auto">
        <Table className="h-auto">
          <TableHeader>
            <TableRow>
              {columns.map((column) => {
                const sortDirection = getSortDirection(column);
                const canSort = !!onSort;

                return (
                  <TableHead key={column} className="font-semibold py-2 px-2">
                    {canSort ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => handleSort(column)}
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
            {paginatedData.map((row, index) => (
              <TableRow
                key={index}
                className={
                  drillDownEnabled && currentDimensionColumn
                    ? 'hover:bg-gray-50 cursor-pointer'
                    : ''
                }
              >
                {columns.map((column) => {
                  const isDrillDownClickable =
                    drillDownEnabled && currentDimensionColumn === column && onRowClick;
                  const rawValue = row[column];
                  const isLink = !isDrillDownClickable && isValidUrl(rawValue);

                  // Render as clickable link if value is a URL (and not a drill-down cell)
                  if (isLink) {
                    const href = normalizeUrl(rawValue);
                    return (
                      <TableCell key={column} className="py-1.5 px-2">
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

                  return (
                    <TableCell
                      key={column}
                      className={`py-1.5 px-2 ${
                        isDrillDownClickable
                          ? 'text-blue-600 hover:text-blue-800 hover:underline cursor-pointer'
                          : ''
                      }`}
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
            ))}
          </TableBody>
        </Table>
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
    </div>
  );
}
