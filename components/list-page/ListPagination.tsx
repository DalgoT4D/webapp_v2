'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PAGE_SIZE_OPTIONS, formatItemRange } from './list-logic';

export interface ListPaginationTestIds {
  pageSizeTrigger: string;
  /** Options are `${prefix}-${size}`. */
  pageSizeOptionPrefix: string;
  prev: string;
  next: string;
  /** LIST-DRIFT: only reports show an item-count testid. */
  itemCount?: string;
  /** LIST-DRIFT: only reports show a page-counter testid. */
  pageCounter?: string;
}

interface ListPaginationProps {
  currentPage: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** LIST-DRIFT: charts ("charts") and dashboards ("dashboard") id every element as `${idPrefix}-…`; reports have no ids. */
  idPrefix?: string;
  testIds: ListPaginationTestIds;
}

/**
 * List footer: "1–10 of 45", page-size select, Prev / "1 of 5" / Next.
 * Purely presentational — each page computes currentPage/total/totalPages with its own model.
 */
export function ListPagination({
  currentPage,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  idPrefix,
  testIds,
}: ListPaginationProps) {
  const idFor = (suffix: string) => (idPrefix ? `${idPrefix}-${suffix}` : undefined);

  return (
    <div
      id={idFor('pagination-footer')}
      className="flex-shrink-0 border-t border-gray-100 bg-gray-50/30 py-3 px-6"
    >
      <div id={idFor('pagination-wrapper')} className="flex items-center justify-between">
        <div
          id={idFor('pagination-info')}
          className="text-sm text-gray-600"
          data-testid={testIds.itemCount}
        >
          {formatItemRange(currentPage, pageSize, total)}
        </div>

        <div id={idFor('pagination-controls')} className="flex items-center gap-4">
          <div id={idFor('page-size-wrapper')} className="flex items-center gap-2">
            <span id={idFor('page-size-label')} className="text-sm text-gray-500">
              Show
            </span>
            <Select
              id={idFor('page-size-select')}
              value={pageSize.toString()}
              onValueChange={(value) => {
                onPageSizeChange(parseInt(value));
                onPageChange(1); // Reset to first page when page size changes
              }}
            >
              <SelectTrigger
                id={idFor('page-size-trigger')}
                data-testid={testIds.pageSizeTrigger}
                className="h-7 text-sm border-gray-200 bg-white"
                style={{ width: '70px' }}
              >
                <SelectValue id={idFor('page-size-value')} />
              </SelectTrigger>
              <SelectContent id={idFor('page-size-content')}>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem
                    key={size}
                    id={idFor(`page-size-${size}`)}
                    value={size.toString()}
                    data-testid={`${testIds.pageSizeOptionPrefix}-${size}`}
                  >
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              id={idFor('prev-page-button')}
              data-testid={testIds.prev}
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-7 px-2 hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronLeft id={idFor('prev-icon')} className="h-4 w-4" />
            </Button>

            <span
              id={idFor('page-info')}
              className="text-sm text-gray-600 px-3 py-1"
              data-testid={testIds.pageCounter}
            >
              {currentPage} of {totalPages}
            </span>

            <Button
              id={idFor('next-page-button')}
              data-testid={testIds.next}
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="h-7 px-2 hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronRight id={idFor('next-icon')} className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
