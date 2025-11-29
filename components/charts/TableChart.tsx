'use client';

import { useMemo, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, TableIcon } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { usePagination } from '@/hooks/usePagination';
import {
  formatCellValue,
  getSortDirection,
  toggleSortDirection,
  extractDisplayColumns,
  type ColumnFormattingConfig,
} from '@/lib/column-formatters';
import { ChartLoadingState, ChartErrorState, ChartEmptyState } from './common/ChartStateRenderers';
import { PaginationControls } from './common/PaginationControls';

interface TableChartProps {
  data?: Record<string, any>[];
  config?: {
    table_columns?: string[];
    column_formatting?: ColumnFormattingConfig;
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
}

export function TableChart({
  data = [],
  config = {},
  onSort,
  isLoading,
  error,
  pagination: serverPagination,
}: TableChartProps) {
  const { table_columns, column_formatting = {}, sort = [], pagination: configPagination } = config;

  // Use the reusable pagination hook for client-side fallback
  const clientPagination = usePagination(1, configPagination?.page_size || 10);

  // Determine if we're using server-side pagination
  const isServerSidePagination = !!serverPagination;

  // Get columns to display
  const columns = useMemo(() => extractDisplayColumns(data, table_columns), [data, table_columns]);

  // Calculate paginated data
  const paginatedData = useMemo(() => {
    if (isServerSidePagination) {
      return data;
    }
    // Client-side pagination
    const startIndex = (clientPagination.page - 1) * clientPagination.pageSize;
    return data.slice(startIndex, startIndex + clientPagination.pageSize);
  }, [data, clientPagination.page, clientPagination.pageSize, isServerSidePagination]);

  // Calculate total pages
  const totalPages = useMemo(() => {
    if (isServerSidePagination) {
      return Math.ceil((serverPagination?.total || 0) / (serverPagination?.pageSize || 10));
    }
    if (data.length === 0) return 1;
    return Math.ceil(data.length / clientPagination.pageSize);
  }, [data.length, clientPagination.pageSize, isServerSidePagination, serverPagination]);

  // Reset client-side page when data changes
  const prevDataRef = useRef(data);
  useEffect(() => {
    if (!isServerSidePagination && prevDataRef.current !== data) {
      clientPagination.resetPage();
      prevDataRef.current = data;
    }
  }, [data, isServerSidePagination, clientPagination]);

  // Handle column header click for sorting
  const handleSort = (column: string) => {
    if (!onSort) return;
    const currentDirection = getSortDirection(column, sort);
    const newDirection = toggleSortDirection(currentDirection);
    onSort(column, newDirection);
  };

  // Pagination values (server-side or client-side)
  const currentPage = isServerSidePagination ? serverPagination!.page : clientPagination.page;
  const pageSize = isServerSidePagination ? serverPagination!.pageSize : clientPagination.pageSize;
  const totalRows = isServerSidePagination ? serverPagination!.total : data.length;

  // State rendering
  if (isLoading) {
    return <ChartLoadingState message="Loading table data..." />;
  }

  if (error) {
    return (
      <ChartErrorState message="Table configuration needs a small adjustment. Please review your settings and try again." />
    );
  }

  if (!data || data.length === 0) {
    return (
      <ChartEmptyState
        icon={TableIcon}
        title="No data available"
        subtitle="Configure your table to display data"
      />
    );
  }

  if (columns.length === 0) {
    return (
      <ChartEmptyState
        icon={TableIcon}
        title="No columns configured"
        subtitle="Select columns to display in the table"
      />
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <Table className="h-auto">
          <TableHeader>
            <TableRow>
              {columns.map((column) => {
                const sortDirection = getSortDirection(column, sort);
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
              <TableRow key={index}>
                {columns.map((column) => (
                  <TableCell key={column} className="py-1.5 px-2">
                    {formatCellValue(row[column], column, column_formatting)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalRows > 0 && (
        <PaginationControls
          currentPage={currentPage}
          pageSize={pageSize}
          totalRows={totalRows}
          totalPages={totalPages}
          onPageChange={
            isServerSidePagination ? serverPagination!.onPageChange : clientPagination.setPage
          }
          onPageSizeChange={
            isServerSidePagination
              ? serverPagination?.onPageSizeChange
              : clientPagination.handlePageSizeChange
          }
        />
      )}
    </div>
  );
}
