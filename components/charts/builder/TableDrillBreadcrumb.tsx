'use client';

import { Button } from '@/components/ui/button';
import type { TableDrillDownState } from '@/components/charts/logic/payload';

/** "← Back" plus the applied drill path, above a drilled table chart. */
export function TableDrillBreadcrumb({
  state,
  onBack,
}: {
  state: TableDrillDownState | null;
  onBack: () => void;
}) {
  if (!state) return null;
  return (
    <div className="px-4 py-2 border-b bg-gray-50 flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="h-8"
        data-testid="chart-table-drill-back-btn"
      >
        ← Back
      </Button>
      <span className="text-sm text-muted-foreground">
        {Object.entries(state.appliedFilters)
          .map(([col, val]) => `${col}: ${val}`)
          .join(' → ')}
      </span>
    </div>
  );
}
