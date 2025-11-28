'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DataTableFilterSummaryProps {
  activeFilterCount: number;
  onClearAll: () => void;
  idPrefix?: string;
}

export function DataTableFilterSummary({
  activeFilterCount,
  onClearAll,
  idPrefix = 'table',
}: DataTableFilterSummaryProps) {
  if (activeFilterCount === 0) return null;

  return (
    <div id={`${idPrefix}-filters-section`} className="flex items-center gap-2 px-6 pb-0">
      <span className="text-sm text-gray-600">
        {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-8 px-2 text-xs text-gray-500 hover:text-gray-700"
      >
        <X className="w-3 h-3 mr-1" />
        Clear all
      </Button>
    </div>
  );
}
