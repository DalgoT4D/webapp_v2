// components/transform/canvas/forms/CoalesceOpForm.tsx
'use client';

import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Info, Trash2 } from 'lucide-react';
import { toastError } from '@/lib/toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ColumnSelect } from '../shared/ColumnSelect';
import { FormActions } from '../shared/FormActions';
import { useOperationForm } from '../shared/useOperationForm';
import { COALESCE_COLUMNS_OP } from '@/constants/transform';
import { getTypedConfig } from '@/types/transform';
import type { OperationFormProps } from '@/types/transform';

interface FormValues {
  columns: { col: string }[];
  default_value: string;
  output_column_name: string;
}

/**
 * Form for coalescing multiple columns.
 * Returns the first non-null value from the selected columns.
 */
export function CoalesceOpForm({
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
    opType: COALESCE_COLUMNS_OP,
    continueOperationChain,
    setLoading,
    sortColumns: true,
  });

  const { control, handleSubmit, watch, register } = useForm<FormValues>({
    defaultValues: (() => {
      if ((isEditMode || isViewMode) && node?.data?.operation_config?.config) {
        const config = getTypedConfig(COALESCE_COLUMNS_OP, node.data.operation_config);
        if (config) {
          const columns = config.columns.map((col) => ({ col }));
          columns.push({ col: '' });
          return {
            columns,
            default_value: config.default_value || '',
            output_column_name: config.output_column_name || '',
          };
        }
      }
      return {
        columns: [{ col: '' }],
        default_value: '',
        output_column_name: '',
      };
    })(),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'columns',
  });

  const watchedColumns = watch('columns');

  // Get selected columns to filter from options
  const selectedCols = watchedColumns.map((c) => c.col).filter(Boolean);

  const handleColumnSelect = (index: number, value: string) => {
    // Auto-append empty row when selecting in last row
    if (value && index === fields.length - 1) {
      append({ col: '' });
    }
  };

  const onSubmit = async (data: FormValues) => {
    // Filter valid columns
    const validColumns = data.columns.map((c) => c.col).filter(Boolean);

    if (validColumns.length < 1) {
      toastError.api('At least one column is required');
      return;
    }

    if (!data.default_value) {
      toastError.api('Default value is required');
      return;
    }

    if (!data.output_column_name) {
      toastError.api('Output column name is required');
      return;
    }

    await submitOperation(
      {
        op_type: COALESCE_COLUMNS_OP,
        config: {
          columns: validColumns,
          default_value: data.default_value,
          output_column_name: data.output_column_name,
        },
        source_columns: srcColumns,
      },
      'Coalesce operation saved successfully'
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Columns Grid */}
      <div className="border rounded-md">
        <div className="bg-muted px-4 py-3 rounded-t-md">
          <Label className="text-xs font-medium text-muted-foreground uppercase">
            Columns (in priority order)
          </Label>
        </div>
        <div className="divide-y max-h-60 overflow-y-auto">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-8 text-center text-sm font-medium text-muted-foreground">
                {index + 1}
              </span>
              <div className="flex-1">
                <Controller
                  control={control}
                  name={`columns.${index}.col`}
                  render={({ field: colField }) => (
                    <ColumnSelect
                      value={colField.value}
                      onChange={(value) => {
                        colField.onChange(value);
                        handleColumnSelect(index, value);
                      }}
                      columns={srcColumns.filter(
                        (col) => !selectedCols.includes(col) || col === colField.value
                      )}
                      placeholder="Select column"
                      disabled={isViewMode}
                      testId={`coalesce-col-${index}`}
                    />
                  )}
                />
              </div>
              {fields.length > 1 && watchedColumns[index]?.col && !isViewMode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove column"
                  onClick={() => remove(index)}
                  className="h-9 w-9"
                  data-testid={`coalesce-remove-${index}`}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Default Value */}
      <div className="px-6 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>Default Value *</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Output if all values in a row are null</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            {...register('default_value', { required: true })}
            placeholder="Enter default value"
            disabled={isViewMode}
            data-testid="coalesce-default-value"
          />
        </div>

        {/* Output Column Name */}
        <div className="space-y-2">
          <Label>Output Column Name *</Label>
          <Input
            {...register('output_column_name', { required: true })}
            placeholder="Enter output column name"
            disabled={isViewMode}
            data-testid="coalesce-output-name"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="px-6">
        <FormActions
          isViewMode={isViewMode}
          isSubmitting={isSubmitting}
          onCancel={clearAndClosePanel}
        />
      </div>
    </form>
  );
}
