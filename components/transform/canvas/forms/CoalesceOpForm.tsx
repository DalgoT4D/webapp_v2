// components/transform/canvas/forms/CoalesceOpForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Info, Trash2 } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { ColumnSelect } from './shared/ColumnSelect';
import { FormActions } from './shared/FormActions';
import type {
  OperationFormProps,
  CoalesceDataConfig,
  ModelSrcOtherInputPayload,
} from '@/types/transform';

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
  const isViewMode = action === 'view';
  const isEditMode = action === 'edit';

  const [srcColumns, setSrcColumns] = useState<string[]>([]);
  const { createOperation, editOperation, isCreating, isEditing } = useCanvasOperations();

  const { control, handleSubmit, reset, watch, register } = useForm<FormValues>({
    defaultValues: {
      columns: [{ col: '' }],
      default_value: '',
      output_column_name: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'columns',
  });

  const watchedColumns = watch('columns');

  // Get selected columns to filter from options
  const selectedCols = watchedColumns.map((c) => c.col).filter(Boolean);

  // Fetch source columns from node
  useEffect(() => {
    if (node?.data?.output_columns) {
      setSrcColumns(node.data.output_columns.sort((a: string, b: string) => a.localeCompare(b)));
    }
  }, [node]);

  // Load existing config in edit mode
  useEffect(() => {
    if ((isEditMode || isViewMode) && node?.data?.operation_config) {
      const config = node.data.operation_config.config as unknown as CoalesceDataConfig;
      if (config) {
        const columns = config.columns.map((col) => ({ col }));
        // Add an empty row at the end for convenience
        columns.push({ col: '' });
        reset({
          columns,
          default_value: config.default_value || '',
          output_column_name: config.output_column_name || '',
        });
      }
      if (config?.source_columns) {
        setSrcColumns(config.source_columns.sort((a, b) => a.localeCompare(b)));
      }
    }
  }, [isEditMode, isViewMode, node, reset]);

  const handleColumnSelect = (index: number, value: string) => {
    // Auto-append empty row when selecting in last row
    if (value && index === fields.length - 1) {
      append({ col: '' });
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (!node?.id) {
      toastError.api('No node selected');
      return;
    }

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

    setLoading(true);

    try {
      const payload = {
        op_type: operation.slug,
        config: {
          columns: validColumns,
          default_value: data.default_value,
          output_column_name: data.output_column_name,
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

      toastSuccess.generic('Coalesce operation saved successfully');
      continueOperationChain(createdNodeUuid);
    } catch (error) {
      console.error('Failed to save coalesce operation:', error);
      toastError.save(error, 'operation');
    } finally {
      setLoading(false);
    }
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
          isSubmitting={isCreating || isEditing}
          onCancel={clearAndClosePanel}
        />
      </div>
    </form>
  );
}
