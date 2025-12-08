'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  totalRows: number;
  pageSizeOptions?: number[];
  idPrefix?: string;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function DataTablePagination<TData>({
  table,
  totalRows,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  idPrefix = 'table',
}: DataTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();

  // Calculate display values
  const currentPage = pageIndex + 1; // TanStack uses 0-based index
  const startItem = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const endItem = Math.min((pageIndex + 1) * pageSize, totalRows);

  return (
    <div
      id={`${idPrefix}-pagination-footer`}
      className="flex-shrink-0 border-t border-gray-100 bg-gray-50/30 py-3 px-6"
    >
      <div id={`${idPrefix}-pagination-wrapper`} className="flex items-center justify-between">
        {/* Left: Item Count */}
        <div id={`${idPrefix}-pagination-info`} className="text-sm text-gray-600">
          {totalRows === 0 ? '0–0 of 0' : `${startItem}–${endItem} of ${totalRows}`}
        </div>

        {/* Right: Controls */}
        <div id={`${idPrefix}-pagination-controls`} className="flex items-center gap-4">
          {/* Page Size Selector */}
          <div id={`${idPrefix}-page-size-wrapper`} className="flex items-center gap-2">
            <span id={`${idPrefix}-page-size-label`} className="text-sm text-gray-500">
              Show
            </span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger
                id={`${idPrefix}-page-size-trigger`}
                className="h-7 text-sm border-gray-200 bg-white"
                style={{ width: '70px' }}
              >
                <SelectValue id={`${idPrefix}-page-size-value`} />
              </SelectTrigger>
              <SelectContent id={`${idPrefix}-page-size-content`}>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button
              id={`${idPrefix}-prev-page-button`}
              variant="ghost"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-7 px-2 hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronLeft id={`${idPrefix}-prev-icon`} className="h-4 w-4" />
            </Button>

            <span id={`${idPrefix}-page-info`} className="text-sm text-gray-600 px-3 py-1">
              {currentPage} of {pageCount || 1}
            </span>

            <Button
              id={`${idPrefix}-next-page-button`}
              variant="ghost"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-7 px-2 hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronRight id={`${idPrefix}-next-icon`} className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
