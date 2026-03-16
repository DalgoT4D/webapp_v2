// components/transform/canvas/forms/ReplaceValueOpForm.tsx
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
import { parseStringForNull } from './shared/OperandInput';
import type {
  OperationFormProps,
  ReplaceDataConfig,
  ModelSrcOtherInputPayload,
} from '@/types/transform';

interface ReplaceRow {
  find: string;
  replace: string;
}

interface FormValues {
  column: string;
  replacements: ReplaceRow[];
}

/**
 * Form for replacing values in a column.
 * Supports multiple find/replace pairs.
 */
export function ReplaceValueOpForm({
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

  const { control, handleSubmit, reset, watch, setValue, register } = useForm<FormValues>({
    defaultValues: {
      column: '',
      replacements: [{ find: '', replace: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'replacements',
  });

  const selectedColumn = watch('column');
  const watchedReplacements = watch('replacements');

  // Fetch source columns from node
  useEffect(() => {
    if (node?.data?.output_columns) {
      setSrcColumns(node.data.output_columns.sort((a: string, b: string) => a.localeCompare(b)));
    }
  }, [node]);

  // Load existing config in edit mode
  useEffect(() => {
    if ((isEditMode || isViewMode) && node?.data?.operation_config) {
      const config = node.data.operation_config.config as unknown as ReplaceDataConfig;
      if (config?.columns && config.columns.length > 0) {
        const col = config.columns[0];
        const replacements = col.replace_ops.map((op) => ({
          find: op.find || '',
          replace: op.replace || '',
        }));
        // Add an empty row at the end for convenience
        replacements.push({ find: '', replace: '' });
        reset({
          column: col.col_name,
          replacements,
        });
      }
      if (config?.source_columns) {
        setSrcColumns(config.source_columns);
      }
    }
  }, [isEditMode, isViewMode, node, reset]);

  const handleAddRow = () => {
    append({ find: '', replace: '' });
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

    if (!data.column) {
      toastError.api('Please select a column');
      return;
    }

    // Filter out empty rows
    const validReplacements = data.replacements.filter((r) => r.find !== '' || r.replace !== '');

    if (validReplacements.length === 0) {
      toastError.api('At least one replacement is required');
      return;
    }

    setLoading(true);

    try {
      const replaceOps = validReplacements.map((r) => ({
        find: parseStringForNull(r.find),
        replace: parseStringForNull(r.replace),
      }));

      const payload = {
        op_type: operation.slug,
        config: {
          columns: [
            {
              col_name: data.column,
              output_column_name: data.column,
              replace_ops: replaceOps,
            },
          ],
        },
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

      toastSuccess.generic('Replace operation saved successfully');
      continueOperationChain(createdNodeUuid);
    } catch (error) {
      console.error('Failed to save replace operation:', error);
      toastError.save(error, 'operation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.preventDefault();
      }}
      className="p-6 space-y-4"
    >
      {/* Column Select */}
      <div className="space-y-2">
        <Label>Select Column *</Label>
        <ColumnSelect
          value={selectedColumn}
          onChange={(value) => setValue('column', value)}
          columns={srcColumns}
          placeholder="Select column"
          disabled={isViewMode}
          testId="replace-column-select"
        />
      </div>

      {/* Header */}
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase">Find</Label>
        <Label className="text-xs font-medium text-muted-foreground uppercase">Replace With</Label>
        <span className="w-9"></span>
      </div>

      {/* Replacement Rows */}
      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
            <Input
              {...register(`replacements.${index}.find`)}
              placeholder="Find value"
              disabled={isViewMode}
              data-testid={`replace-find-${index}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && index === fields.length - 1) {
                  e.preventDefault();
                  handleAddRow();
                }
              }}
            />

            <Input
              {...register(`replacements.${index}.replace`)}
              placeholder="Replace with"
              disabled={isViewMode}
              data-testid={`replace-replace-${index}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && index === fields.length - 1) {
                  e.preventDefault();
                  handleAddRow();
                }
              }}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveRow(index)}
              disabled={isViewMode || fields.length <= 1}
              className="h-9 w-9"
              data-testid={`replace-remove-${index}`}
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
          data-testid="replace-add-row"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Replacement
        </Button>
      )}

      {/* Info */}
      <p className="text-xs text-muted-foreground">
        Use empty or &quot;null&quot; to match/replace null values.
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
