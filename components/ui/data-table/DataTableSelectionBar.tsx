'use client';

import { X, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectionConfig } from './types';

interface DataTableSelectionBarProps<TData> {
  selection: SelectionConfig<TData>;
  idPrefix?: string;
}

export function DataTableSelectionBar<TData>({
  selection,
  idPrefix = 'table',
}: DataTableSelectionBarProps<TData>) {
  const { selectedIds, onSelectAll, onDeselectAll, onExitSelection, totalCount, bulkAction } =
    selection;

  return (
    <div
      id={`${idPrefix}-selection-bar`}
      className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between mx-6 mb-4"
    >
      <div id={`${idPrefix}-selection-controls`} className="flex items-center gap-4">
        <div id={`${idPrefix}-selection-info`} className="flex items-center gap-2">
          <button
            id={`${idPrefix}-exit-selection-button`}
            onClick={onExitSelection}
            className="p-1 hover:bg-blue-100 rounded"
            title="Exit selection mode"
          >
            <X id={`${idPrefix}-exit-selection-icon`} className="w-4 h-4 text-blue-600" />
          </button>
          <span className="text-sm font-medium text-blue-900">
            {selectedIds.size} of {totalCount} selected
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectAll}
            disabled={selectedIds.size === totalCount}
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDeselectAll}
            disabled={selectedIds.size === 0}
          >
            Deselect All
          </Button>
        </div>
      </div>

      {bulkAction && bulkAction.visible !== false && (
        <Button
          variant="destructive"
          size="sm"
          onClick={bulkAction.onClick}
          disabled={selectedIds.size === 0 || bulkAction.disabled || bulkAction.isLoading}
        >
          {bulkAction.isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
          ) : bulkAction.icon ? (
            <span className="mr-2">{bulkAction.icon}</span>
          ) : (
            <Trash className="w-4 h-4 mr-2" />
          )}
          {bulkAction.label} {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
        </Button>
      )}
    </div>
  );
}
