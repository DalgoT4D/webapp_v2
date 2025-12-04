'use client';

import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface PaginationControlsProps {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Current page size */
  pageSize: number;
  /** Total number of rows */
  totalRows: number;
  /** Total number of pages */
  totalPages: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Callback when page size changes (optional - hides selector if not provided) */
  onPageSizeChange?: (pageSize: number) => void;
  /** Available page size options */
  pageSizeOptions?: number[];
  /** Whether to show the row count info */
  showRowInfo?: boolean;
}

/**
 * Reusable pagination controls for table-based components
 *
 * Features:
 * - First/Previous/Next/Last navigation buttons
 * - Page size selector (optional)
 * - Row count display
 * - Disabled states at boundaries
 *
 * @example
 * ```tsx
 * <PaginationControls
 *   currentPage={pagination.page}
 *   pageSize={pagination.pageSize}
 *   totalRows={100}
 *   totalPages={10}
 *   onPageChange={pagination.setPage}
 *   onPageSizeChange={pagination.handlePageSizeChange}
 * />
 * ```
 */
export function PaginationControls({
  currentPage,
  pageSize,
  totalRows,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100, 200],
  showRowInfo = true,
}: PaginationControlsProps) {
  const startRow = (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, totalRows);

  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage >= totalPages;

  return (
    <div className="flex items-center justify-between border-t px-4 py-3">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          {showRowInfo && (
            <span className="text-sm text-muted-foreground">
              Showing {startRow} to {endRow} of {totalRows.toLocaleString()} rows
            </span>
          )}

          {onPageSizeChange && (
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => onPageSizeChange(parseInt(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* First & Previous */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(1)}
            disabled={isFirstPage}
          >
            <ChevronFirst className="h-4 w-4" />
            <span className="sr-only">First page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={isFirstPage}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous page</span>
          </Button>
        </div>

        {/* Page indicator */}
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium">
            Page {currentPage} of {totalPages}
          </span>
        </div>

        {/* Next & Last */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={isLastPage}
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(totalPages)}
            disabled={isLastPage}
          >
            <ChevronLast className="h-4 w-4" />
            <span className="sr-only">Last page</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
