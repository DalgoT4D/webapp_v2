'use client';

import { Trash, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChartSelectionBarProps {
  selectedCount: number;
  visibleCount: number;
  canDelete: boolean;
  isBulkDeleting: boolean;
  onExit: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkDelete: () => void;
}

/** Blue "N of M charts selected" bar shown in selection mode. */
export function ChartSelectionBar({
  selectedCount,
  visibleCount,
  canDelete,
  isBulkDeleting,
  onExit,
  onSelectAll,
  onDeselectAll,
  onBulkDelete,
}: ChartSelectionBarProps) {
  return (
    <div
      id="charts-selection-bar"
      className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between"
    >
      <div id="charts-selection-controls" className="flex items-center gap-4">
        <div id="charts-selection-info" className="flex items-center gap-2">
          <button
            id="charts-exit-selection-button"
            data-testid="chart-list-exit-selection-btn"
            onClick={onExit}
            className="p-1 hover:bg-blue-100 rounded"
            title="Exit selection mode"
          >
            <X id="charts-exit-selection-icon" className="w-4 h-4 text-blue-600" />
          </button>
          <span className="text-sm font-medium text-blue-900">
            {selectedCount} of {visibleCount} charts selected
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectAll}
            data-testid="chart-list-select-all-btn"
            disabled={selectedCount === visibleCount}
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDeselectAll}
            data-testid="chart-list-deselect-all-btn"
            disabled={selectedCount === 0}
          >
            Deselect All
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {canDelete && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onBulkDelete}
            data-testid="chart-list-bulk-delete-btn"
            disabled={selectedCount === 0 || isBulkDeleting}
          >
            {isBulkDeleting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : (
              <Trash className="w-4 h-4 mr-2" />
            )}
            Delete {selectedCount > 0 ? `(${selectedCount})` : ''}
          </Button>
        )}
      </div>
    </div>
  );
}
