'use client';

import type { Dispatch, SetStateAction } from 'react';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TableChartProps } from './TableChart';

interface TableChartPaginationProps {
  isServerSidePagination: boolean;
  pagination: TableChartProps['pagination'];
  data: readonly unknown[];
  currentPage: number;
  pageSize: number;
  totalPages: number;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  setPageSize: Dispatch<SetStateAction<number>>;
}

/** "Showing x to y of N rows", page size, first / prev / "Page p of P" / next / last — server or client paging. */
export function TableChartPagination({
  isServerSidePagination,
  pagination,
  data,
  currentPage,
  pageSize,
  totalPages,
  setCurrentPage,
  setPageSize,
}: TableChartPaginationProps) {
  if (!(isServerSidePagination ? (pagination?.total || 0) > 0 : data.length > 0)) return null;

  return (
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
                {Math.min(currentPage * pageSize, data.length)} of {data.length.toLocaleString()}{' '}
                rows
              </>
            )}
          </span>
          {(isServerSidePagination ? pagination?.onPageSizeChange : true) && (
            <Select
              value={isServerSidePagination ? pagination!.pageSize.toString() : pageSize.toString()}
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
  );
}
