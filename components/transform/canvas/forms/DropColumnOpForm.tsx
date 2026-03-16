// components/transform/canvas/forms/DropColumnOpForm.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Search } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { FormActions } from './shared/FormActions';
import { cn } from '@/lib/utils';
import type { OperationFormProps, DropDataConfig, ModelSrcOtherInputPayload } from '@/types/transform';

/**
 * Form for dropping (removing) columns from a table.
 * Features search, select all/clear, and checkbox selection.
 */
export function DropColumnOpForm({
  node,
  operation,
  continueOperationChain,
  clearAndClosePanel,
  action,
  setLoading,
}: OperationFormProps) {
  const isViewMode = action === 'view';
  const isEditMode = action === 'edit';

  const [searchTerm, setSearchTerm] = useState('');
  const [srcColumns, setSrcColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  const { createOperation, editOperation, isCreating, isEditing } = useCanvasOperations();

  // Fetch source columns from node
  useEffect(() => {
    if (node?.data?.output_columns) {
      setSrcColumns(node.data.output_columns);
    }
  }, [node]);

  // Load existing config in edit mode
  useEffect(() => {
    if ((isEditMode || isViewMode) && node?.data?.operation_config) {
      const config = node.data.operation_config.config as unknown as DropDataConfig;
      if (config?.columns) {
        setSelectedColumns(config.columns);
      }
      if (config?.source_columns) {
        setSrcColumns(config.source_columns);
      }
    }
  }, [isEditMode, isViewMode, node]);

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

    if (!node?.id) {
      toastError.api('No node selected');
      return;
    }

    if (selectedColumns.length === 0) {
      toastError.api('Select at least one column to drop');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        op_type: operation.slug,
        config: { columns: selectedColumns },
        source_columns: srcColumns,
        other_inputs: [] as ModelSrcOtherInputPayload[],
      };

      const finalAction = node.data?.isDummy ? 'create' : action;
      let createdNodeUuid: string | undefined;
      if (finalAction === 'edit') {
        await editOperation(node.id, payload);
      } else {
        const response = await createOperation(node.id, {
          ...payload,
          input_node_uuid: node.id,
        });
        createdNodeUuid = response?.uuid;
      }

      toastSuccess.generic(
        `${selectedColumns.length} column${selectedColumns.length > 1 ? 's' : ''} will be dropped`
      );
      continueOperationChain(createdNodeUuid);
    } catch (error) {
      console.error('Failed to save drop operation:', error);
      toastError.save(error, 'operation');
    } finally {
      setLoading(false);
    }
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
      <div className="border rounded-md max-h-80 overflow-y-auto" data-testid="drop-column-list">
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

      {/* Warning */}
      <p className="text-xs text-muted-foreground">
        Selected columns will be removed from the output table.
      </p>

      {/* Actions */}
      <FormActions
        isViewMode={isViewMode}
        isSubmitting={isCreating || isEditing}
        onCancel={clearAndClosePanel}
      />
    </form>
  );
}
