// components/transform/canvas/forms/DropColumnOpForm.tsx
'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Search } from 'lucide-react';
import { useOperationForm } from '../shared/useOperationForm';
import { cn } from '@/lib/utils';
import { DROP_COLUMNS_OP } from '@/constants/transform';
import { getTypedConfig } from '@/types/transform';
import type { OperationFormProps } from '@/types/transform';

/**
 * Form for dropping (removing) columns from a table.
 * Features search, select all/clear, and checkbox selection.
 */
export function DropColumnOpForm({
  node,
  operation,
  continueOperationChain,
  action,
  setLoading,
}: OperationFormProps) {
  const { isViewMode, isEditMode, srcColumns, isSubmitting, submitOperation } = useOperationForm({
    node,
    action,
    operation,
    opType: DROP_COLUMNS_OP,
    continueOperationChain,
    setLoading,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => {
    if ((isEditMode || isViewMode) && node?.data?.operation_config?.config) {
      const config = getTypedConfig(DROP_COLUMNS_OP, node.data.operation_config);
      if (config?.columns) return config.columns;
    }
    return [];
  });

  // Filter columns based on search
  const filteredColumns = useMemo(() => {
    if (!searchTerm.trim()) return srcColumns;
    const search = searchTerm.toLowerCase();
    return srcColumns.filter((col) => col.toLowerCase().includes(search));
  }, [srcColumns, searchTerm]);

  const handleToggleColumn = (column: string) => {
    if (isViewMode) return;
    setSelectedColumns((prev) =>
      prev.includes(column) ? prev.filter((c) => c !== column) : [...prev, column]
    );
  };

  const handleSelectAll = () => {
    if (isViewMode) return;
    setSelectedColumns(filteredColumns);
  };

  const handleClearAll = () => {
    if (isViewMode) return;
    // Only clear filtered columns
    setSelectedColumns((prev) => prev.filter((col) => !filteredColumns.includes(col)));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedColumns.length === 0) {
      setFormError('Select at least one column to drop');
      return;
    }

    setFormError(null);

    await submitOperation(
      {
        op_type: DROP_COLUMNS_OP,
        config: { columns: selectedColumns },
        source_columns: srcColumns,
      },
      `${selectedColumns.length} column${selectedColumns.length > 1 ? 's' : ''} will be dropped`
    );
  };

  return (
    <form onSubmit={onSubmit} className="p-6 space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search columns..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          disabled={isViewMode}
          data-testid="drop-search"
        />
      </div>

      {/* Select All / Clear */}
      {!isViewMode && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            data-testid="drop-select-all"
          >
            Select All
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            data-testid="drop-clear-all"
          >
            Clear
          </Button>
          <span className="ml-auto text-sm text-muted-foreground self-center">
            {selectedColumns.length} selected
          </span>
        </div>
      )}

      {/* Column List */}
      <div className="border rounded-md overflow-y-auto" data-testid="drop-column-list">
        {filteredColumns.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {searchTerm ? 'No matching columns' : 'No columns available'}
          </div>
        ) : (
          <div className="divide-y">
            {filteredColumns.map((column) => {
              const isSelected = selectedColumns.includes(column);
              return (
                <label
                  key={column}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
                    isSelected && 'bg-teal-50',
                    !isViewMode && 'hover:bg-muted/50',
                    isViewMode && 'cursor-default'
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggleColumn(column)}
                    disabled={isViewMode}
                    data-testid={`drop-checkbox-${column}`}
                  />
                  <span className="text-sm">{column}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      {/* Actions */}
      {!isViewMode && (
        <div className="sticky bottom-0 bg-white pt-2 pb-2">
          <Button
            type="submit"
            variant="ghost"
            disabled={isSubmitting}
            className="w-full text-white hover:opacity-90"
            style={{ backgroundColor: 'var(--primary)' }}
            data-testid="savebutton"
          >
            Save
          </Button>
        </div>
      )}
    </form>
  );
}
