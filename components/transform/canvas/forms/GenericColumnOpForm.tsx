// components/transform/canvas/forms/GenericColumnOpForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Trash2 } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { ColumnSelect } from './shared/ColumnSelect';
import { FormActions } from './shared/FormActions';
import { parseStringForNull } from './shared/OperandInput';
import type { OperationFormProps, GenericColDataConfig, GenericCol } from '@/types/transform';

interface Operand {
  type: 'col' | 'val';
  col_val: string;
  const_val: string;
}

interface FormValues {
  function_name: string;
  operands: Operand[];
  output_column_name: string;
}

/**
 * Form for applying custom SQL functions to create computed columns.
 * Supports any SQL function with column or constant operands.
 */
export function GenericColumnOpForm({
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

  const { control, handleSubmit, reset, watch, register, setValue } = useForm<FormValues>({
    defaultValues: {
      function_name: '',
      operands: [{ type: 'col', col_val: '', const_val: '' }],
      output_column_name: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'operands',
  });

  const watchedOperands = watch('operands');

  // Fetch source columns from node
  useEffect(() => {
    if (node?.data?.output_columns) {
      setSrcColumns(node.data.output_columns.sort((a: string, b: string) => a.localeCompare(b)));
    }
  }, [node]);

  // Load existing config in edit mode
  useEffect(() => {
    if ((isEditMode || isViewMode) && node?.data?.operation_config) {
      const config = node.data.operation_config.config as GenericColDataConfig;
      if (config?.computed_columns && config.computed_columns.length > 0) {
        const computed = config.computed_columns[0];
        reset({
          function_name: computed.function_name,
          operands: computed.operands.map((op) => ({
            type: op.is_col ? 'col' : 'val',
            col_val: op.is_col ? String(op.value) : '',
            const_val: op.is_col ? '' : String(op.value),
          })),
          output_column_name: computed.output_column_name,
        });
      }
      if (config?.source_columns) {
        setSrcColumns(config.source_columns.sort((a, b) => a.localeCompare(b)));
      }
    }
  }, [isEditMode, isViewMode, node, reset]);

  const onSubmit = async (data: FormValues) => {
    if (!node?.id) {
      toastError.api('No node selected');
      return;
    }

    if (!data.function_name) {
      toastError.api('Function name is required');
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
          computed_columns: [
            {
              function_name: data.function_name,
              operands: data.operands.map((op) => ({
                is_col: op.type === 'col',
                value: op.type === 'col' ? op.col_val : parseStringForNull(op.const_val),
              })),
              output_column_name: data.output_column_name,
            },
          ],
        },
        source_columns: srcColumns,
        other_inputs: [],
      };

      const finalAction = node.data?.isDummy ? 'create' : action;
      if (finalAction === 'edit') {
        await editOperation(node.id, payload);
      } else {
        await createOperation(node.id, {
          ...payload,
          input_node_uuid: node.id,
        });
      }

      toastSuccess.generic('Generic column operation saved successfully');
      continueOperationChain();
    } catch (error) {
      console.error('Failed to save generic column operation:', error);
      toastError.save(error, 'operation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      {/* Function Name */}
      <div className="space-y-2">
        <Label>Function *</Label>
        <Input
          {...register('function_name', { required: true })}
          placeholder="Enter SQL function name (e.g., CONCAT, UPPER, LOWER)"
          disabled={isViewMode}
          data-testid="generic-function-name"
        />
      </div>

      {/* Operands */}
      <div className="space-y-4">
        <Label>Operands</Label>
        {fields.map((field, index) => (
          <div key={field.id} className="space-y-3 p-4 border rounded-md">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Operand {index + 1}</Label>
              {!isViewMode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  data-testid={`generic-remove-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <Controller
              control={control}
              name={`operands.${index}.type`}
              render={({ field: typeField }) => (
                <RadioGroup
                  value={typeField.value}
                  onValueChange={typeField.onChange}
                  className="flex gap-4"
                  disabled={isViewMode}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="col" id={`col-${index}`} />
                    <Label htmlFor={`col-${index}`} className="text-sm">
                      Column
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="val" id={`val-${index}`} />
                    <Label htmlFor={`val-${index}`} className="text-sm">
                      Value
                    </Label>
                  </div>
                </RadioGroup>
              )}
            />

            {watchedOperands[index]?.type === 'col' ? (
              <ColumnSelect
                value={watchedOperands[index]?.col_val || ''}
                onChange={(value) => setValue(`operands.${index}.col_val`, value)}
                columns={srcColumns}
                placeholder="Select column"
                disabled={isViewMode}
                testId={`generic-col-${index}`}
              />
            ) : (
              <Input
                {...register(`operands.${index}.const_val`)}
                placeholder="Enter value (string or number)"
                disabled={isViewMode}
                data-testid={`generic-val-${index}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Add Operand Button */}
      {!isViewMode && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ type: 'col', col_val: '', const_val: '' })}
          className="w-full"
          data-testid="generic-add-operand"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Operand
        </Button>
      )}

      {/* Output Column Name */}
      <div className="space-y-2">
        <Label>Output Column Name *</Label>
        <Input
          {...register('output_column_name', { required: true })}
          placeholder="Enter output column name"
          disabled={isViewMode}
          data-testid="generic-output-name"
        />
      </div>

      {/* Info */}
      <p className="text-xs text-muted-foreground">
        Operands are passed to the function in order. Example: CONCAT(col1, col2) or UPPER(name).
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
