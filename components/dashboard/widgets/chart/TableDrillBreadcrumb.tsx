'use client';

import { Button } from '@/components/ui/button';

interface TableDrillBreadcrumbProps {
  chartId: number;
  appliedFilters: Record<string, string>;
  onBack: () => void;
}

/** "← Back" and the drill selections above a drilled table widget. */
export function TableDrillBreadcrumb({
  chartId,
  appliedFilters,
  onBack,
}: TableDrillBreadcrumbProps) {
  return (
    <div className="px-4 py-2 border-b bg-gray-50 flex items-center gap-2 flex-shrink-0">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="h-8"
        data-testid={`dashboard-chart-table-back-${chartId}`}
      >
        ← Back
      </Button>
      <span className="text-sm text-muted-foreground">
        {Object.entries(appliedFilters)
          .map(([col, val]) => `${col}: ${val}`)
          .join(' → ')}
      </span>
    </div>
  );
}
