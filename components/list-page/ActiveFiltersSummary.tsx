'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ActiveFiltersSummaryProps {
  count: number;
  onClearAll: () => void;
  clearTestId: string;
  /** LIST-DRIFT: charts and dashboards give the bar an id; reports don't. */
  id?: string;
  /** LIST-DRIFT: only reports put a testid on the count text. */
  countTestId?: string;
}

/** "2 filters active · Clear all" under the page title; hidden when no filter is set. */
export function ActiveFiltersSummary({
  count,
  onClearAll,
  clearTestId,
  id,
  countTestId,
}: ActiveFiltersSummaryProps) {
  if (count === 0) return null;
  return (
    <div id={id} className="flex items-center gap-2 px-6 pb-0">
      <span className="text-sm text-gray-600" data-testid={countTestId}>
        {count} filter{count > 1 ? 's' : ''} active
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        data-testid={clearTestId}
        className="h-8 px-2 text-xs text-gray-500 hover:text-gray-700"
      >
        <X className="w-3 h-3 mr-1" />
        Clear all
      </Button>
    </div>
  );
}
