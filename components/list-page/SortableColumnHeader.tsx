'use client';

import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SortOrder } from './list-logic';

interface SortableColumnHeaderProps<C extends string> {
  label: string;
  column: C;
  sortBy: C;
  sortOrder: SortOrder;
  onSort: (column: C) => void;
  testId: string;
  /** LIST-DRIFT: most headers left-align; charts' Data Source/Type/Last Modified and reports' Created on never did. */
  justifyStart?: boolean;
}

function SortIcon({ isSorted, sortOrder }: { isSorted: boolean; sortOrder: SortOrder }) {
  if (!isSorted) {
    return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
  }
  return sortOrder === 'asc' ? (
    <ChevronUp className="w-4 h-4 text-gray-600" />
  ) : (
    <ChevronDown className="w-4 h-4 text-gray-600" />
  );
}

/** The clickable "Name ⇅" button in a list table header. */
export function SortableColumnHeader<C extends string>({
  label,
  column,
  sortBy,
  sortOrder,
  onSort,
  testId,
  justifyStart = false,
}: SortableColumnHeaderProps<C>) {
  return (
    <Button
      variant="ghost"
      className={
        justifyStart
          ? 'h-auto p-0 font-medium text-base hover:bg-transparent justify-start'
          : 'h-auto p-0 font-medium text-base hover:bg-transparent'
      }
      onClick={() => onSort(column)}
      data-testid={testId}
    >
      <div className="flex items-center gap-2">
        {label}
        <SortIcon isSorted={sortBy === column} sortOrder={sortOrder} />
      </div>
    </Button>
  );
}
