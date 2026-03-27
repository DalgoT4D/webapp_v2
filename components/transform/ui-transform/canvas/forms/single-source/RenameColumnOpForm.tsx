// components/transform/canvas/forms/RenameColumnOpForm.tsx
'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { toastError } from '@/lib/toast';
import { ColumnSelect } from '../shared/ColumnSelect';
import { FormActions } from '../shared/FormActions';
import { useOperationForm } from '../shared/useOperationForm';
import type { OperationFormProps, RenameDataConfig } from '@/types/transform';

interface RenameRow {
  oldName: string;
  newName: string;
}

interface FormValues {
  renames: RenameRow[];
}

/**
 * Form for renaming columns.
 * Allows multiple column renames in a single operation.
 */
export function RenameColumnOpForm({
  node,
  operation,
  continueOperationChain,
  clearAndClosePanel,
  action,
  setLoading,
}: OperationFormProps) {
  const { isViewMode, isEditMode, srcColumns, isSubmitting, submitOperation } = useOperationForm({
    node,
    action,
    operation,
    continueOperationChain,
    setLoading,
  });

  const { control, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: (() => {
      if ((isEditMode || isViewMode) && node?.data?.operation_config?.config) {
        const config = node.data.operation_config.config as unknown as RenameDataConfig;
        if (config?.columns) {
          const renames = Object.entries(config.columns).map(([oldName, newName]) => ({
            oldName,
            newName: newName as string,
          }));
          return { renames: renames.length > 0 ? renames : [{ oldName: '', newName: '' }] };
        }
      }
      return { renames: [{ oldName: '', newName: '' }] };
    })(),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'renames',
  });

  const watchedRenames = watch('renames');

  // Get used columns to filter from options
  const usedColumns = watchedRenames.map((r) => r.oldName).filter(Boolean);

  const handleAddRow = () => {
    append({ oldName: '', newName: '' });
  };

  const handleRemoveRow = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  const onSubmit = async (data: FormValues) => {
    // Filter out empty rows and build columns map
    const validRenames = data.renames.filter((r) => r.oldName && r.newName);
    if (validRenames.length === 0) {
      toastError.api('At least one valid rename is required');
      return;
    }

    const columnsMap: Record<string, string> = {};
    validRenames.forEach((r) => {
      columnsMap[r.oldName] = r.newName;
    });

    await submitOperation(
      {
        op_type: operation.slug,
        config: { columns: columnsMap },
        source_columns: srcColumns,
      },
      `Column${validRenames.length > 1 ? 's' : ''} renamed successfully`
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      {/* Header */}
      <div className="grid grid-cols-2 gap-3 mb-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase">Old Name</Label>
        <Label className="text-xs font-medium text-muted-foreground uppercase">New Name</Label>
      </div>

      {/* Rename Rows */}
      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-center">
            <ColumnSelect
              value={watchedRenames[index]?.oldName || ''}
              onChange={(value) => {
                setValue(`renames.${index}.oldName`, value);
              }}
              columns={srcColumns}
              excludeColumns={usedColumns.filter((c) => c !== watchedRenames[index]?.oldName)}
              placeholder="Select column"
              disabled={isViewMode}
              testId={`rename-old-${index}`}
            />

            <Input
              value={watchedRenames[index]?.newName || ''}
              onChange={(e) => {
                setValue(`renames.${index}.newName`, e.target.value);
              }}
              placeholder="New column name"
              disabled={isViewMode}
              data-testid={`rename-new-${index}`}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove row"
              onClick={() => handleRemoveRow(index)}
              disabled={isViewMode || fields.length <= 1}
              className="h-9 w-9"
              data-testid={`rename-remove-${index}`}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add Row Button */}
      {!isViewMode && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddRow}
          disabled={(() => {
            const lastRow = watchedRenames[watchedRenames.length - 1];
            return !lastRow?.oldName || !lastRow?.newName;
          })()}
          className="w-full"
          data-testid="rename-add-row"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Column
        </Button>
      )}

      {/* Actions */}
      <FormActions
        isViewMode={isViewMode}
        isSubmitting={isSubmitting}
        onCancel={clearAndClosePanel}
      />
    </form>
  );
}
