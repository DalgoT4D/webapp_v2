// components/transform/canvas/forms/ReplaceValueOpForm.tsx
'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { ColumnSelect } from '../shared/ColumnSelect';
import { FormActions } from '../shared/FormActions';
import { useOperationForm } from '../shared/useOperationForm';
import { parseStringForNull } from '../shared/utils';
import { REPLACE_COLUMN_VALUE_OP } from '@/constants/transform';
import { getTypedConfig } from '@/types/transform';
import type { OperationFormProps } from '@/types/transform';

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
  const { isViewMode, isEditMode, srcColumns, isSubmitting, submitOperation } = useOperationForm({
    node,
    action,
    operation,
    opType: REPLACE_COLUMN_VALUE_OP,
    continueOperationChain,
    setLoading,
  });

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    register,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<FormValues>({
    defaultValues: (() => {
      if ((isEditMode || isViewMode) && node?.data?.operation_config?.config) {
        const config = getTypedConfig(REPLACE_COLUMN_VALUE_OP, node.data.operation_config);
        if (config?.columns && config.columns.length > 0) {
          const col = config.columns[0];
          const replacements = col.replace_ops.map((op) => ({
            find: op.find || '',
            replace: op.replace || '',
          }));
          replacements.push({ find: '', replace: '' });
          return { column: col.col_name, replacements };
        }
      }
      return { column: '', replacements: [{ find: '', replace: '' }] };
    })(),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'replacements',
  });

  const selectedColumn = watch('column');
  const watchedReplacements = watch('replacements');

  const handleAddRow = () => {
    append({ find: '', replace: '' });
  };

  const handleRemoveRow = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  const onSubmit = async (data: FormValues) => {
    let hasErrors = false;

    if (!data.column) {
      setError('column', { message: 'Please select a column' });
      hasErrors = true;
    }

    // Filter out empty rows
    const validReplacements = data.replacements.filter((r) => r.find !== '' || r.replace !== '');

    if (validReplacements.length === 0) {
      setError('replacements', { message: 'At least one replacement is required' });
      hasErrors = true;
    }

    if (hasErrors) return;

    const replaceOps = validReplacements.map((r) => ({
      find: parseStringForNull(r.find),
      replace: parseStringForNull(r.replace),
    }));

    await submitOperation(
      {
        op_type: REPLACE_COLUMN_VALUE_OP,
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
      },
      'Replace operation saved successfully'
    );
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
          onChange={(value) => {
            setValue('column', value);
            clearErrors('column');
          }}
          columns={srcColumns}
          placeholder="Select column"
          disabled={isViewMode}
          testId="replace-column-select"
        />
        {errors.column && <p className="text-sm text-destructive">{errors.column.message}</p>}
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
              aria-label="Remove row"
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

      {errors.replacements && (
        <p className="text-sm text-destructive">{errors.replacements.message}</p>
      )}

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
        isSubmitting={isSubmitting}
        onCancel={clearAndClosePanel}
      />
    </form>
  );
}
