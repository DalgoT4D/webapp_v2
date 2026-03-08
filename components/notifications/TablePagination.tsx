import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PAGE_SIZE_OPTIONS } from '@/constants/notifications';

interface TablePaginationProps {
  count: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function TablePagination({
  count,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const totalPages = Math.ceil(count / pageSize) || 1;
  // Clamp page to valid bounds for display calculations
  const clampedPage = Math.max(1, Math.min(page, totalPages));
  const startItem = count === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const endItem = Math.min(clampedPage * pageSize, count);

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-gray-50/30 border-t border-gray-100">
      {/* Left: Compact Item Count */}
      <div className="text-sm text-gray-600">
        {count === 0 ? '0–0 of 0' : `${startItem}–${endItem} of ${count}`}
      </div>

      {/* Right: Streamlined Controls */}
      <div className="flex items-center gap-4">
        {/* Compact Page Size Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Show</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger
              data-testid="page-size-select"
              className="h-7 text-sm border-gray-200 bg-white"
              style={{ width: '70px' }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Simplified Navigation */}
        <div className="flex items-center gap-1">
          <Button
            data-testid="prev-page-btn"
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(clampedPage - 1)}
            disabled={clampedPage === 1}
            className="h-7 px-2 hover:bg-gray-100 disabled:opacity-50"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-sm text-gray-600 px-3 py-1">
            {clampedPage} of {totalPages}
          </span>

          <Button
            data-testid="next-page-btn"
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(clampedPage + 1)}
            disabled={clampedPage >= totalPages}
            className="h-7 px-2 hover:bg-gray-100 disabled:opacity-50"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
