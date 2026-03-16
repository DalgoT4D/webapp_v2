// components/transform/canvas/forms/RenameColumnOpForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { ColumnSelect } from './shared/ColumnSelect';
import { FormActions } from './shared/FormActions';
import type {
  OperationFormProps,
  RenameDataConfig,
  ModelSrcOtherInputPayload,
} from '@/types/transform';

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
  const isViewMode = action === 'view';
  const isEditMode = action === 'edit';

  const [srcColumns, setSrcColumns] = useState<string[]>([]);
  const { createOperation, editOperation, isCreating, isEditing } = useCanvasOperations();

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      renames: [{ oldName: '', newName: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'renames',
  });

  const watchedRenames = watch('renames');

  // Fetch source columns from node
  useEffect(() => {
    if (node?.data?.output_columns) {
      setSrcColumns(node.data.output_columns);
    }
  }, [node]);

  // Load existing config in edit mode
  useEffect(() => {
    if ((isEditMode || isViewMode) && node?.data?.operation_config) {
      const config = node.data.operation_config.config as unknown as RenameDataConfig;
      if (config?.columns) {
        const renames = Object.entries(config.columns).map(([oldName, newName]) => ({
          oldName,
          newName: newName as string,
        }));
        reset({ renames: renames.length > 0 ? renames : [{ oldName: '', newName: '' }] });
      }
      if (config?.source_columns) {
        setSrcColumns(config.source_columns);
      }
    }
  }, [isEditMode, isViewMode, node, reset]);

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
    if (!node?.id) {
      toastError.api('No node selected');
      return;
    }

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

    setLoading(true);

    try {
      const payload = {
        op_type: operation.slug,
        config: { columns: columnsMap },
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

      toastSuccess.generic(`Column${validRenames.length > 1 ? 's' : ''} renamed successfully`);
      continueOperationChain(createdNodeUuid);
    } catch (error) {
      console.error('Failed to save rename operation:', error);
      toastError.save(error, 'operation');
    } finally {
      setLoading(false);
    }
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
        isSubmitting={isCreating || isEditing}
        onCancel={clearAndClosePanel}
      />
    </form>
  );
}
