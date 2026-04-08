// components/transform/canvas/forms/GenericColumnOpForm.tsx
'use client';

import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Trash2 } from 'lucide-react';
import { ColumnSelect } from '../shared/ColumnSelect';
import { FormActions } from '../shared/FormActions';
import { useOperationForm } from '../shared/useOperationForm';
import { parseStringForNull } from '../shared/utils';
import { GENERIC_COL_OP } from '@/constants/transform';
import { getTypedConfig } from '@/types/transform';
import type { OperationFormProps } from '@/types/transform';

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
  const { isViewMode, isEditMode, srcColumns, isSubmitting, submitOperation } = useOperationForm({
    node,
    action,
    operation,
    opType: GENERIC_COL_OP,
    continueOperationChain,
    setLoading,
    sortColumns: true,
  });

  const {
    control,
    handleSubmit,
    watch,
    register,
    setValue,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<FormValues>({
    defaultValues: (() => {
      if ((isEditMode || isViewMode) && node?.data?.operation_config?.config) {
        const config = getTypedConfig(GENERIC_COL_OP, node.data.operation_config);
        if (config?.computed_columns && config.computed_columns.length > 0) {
          const computed = config.computed_columns[0];
          return {
            function_name: computed.function_name,
            operands: computed.operands.map((op) => ({
              type: (op.is_col ? 'col' : 'val') as 'col' | 'val',
              col_val: op.is_col ? String(op.value) : '',
              const_val: op.is_col ? '' : String(op.value),
            })),
            output_column_name: computed.output_column_name,
          };
        }
      }
      return {
        function_name: '',
        operands: [{ type: 'col' as const, col_val: '', const_val: '' }],
        output_column_name: '',
      };
    })(),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'operands',
  });

  const watchedOperands = watch('operands');

  const onSubmit = async (data: FormValues) => {
    let hasErrors = false;

    // Validate individual operand fields (cross-field: depends on type)
    data.operands.forEach((op, index) => {
      if (op.type === 'col' && !op.col_val) {
        setError(`operands.${index}.col_val` as `operands.${number}.col_val`, {
          message: 'Column is required',
        });
        hasErrors = true;
      }
    });

    // Validate minimum operand count
    const validOperands = data.operands.filter((op) =>
      op.type === 'col' ? op.col_val : op.const_val
    );
    if (validOperands.length < 1) {
      setError('operands', { message: 'At least one operand is required' });
      hasErrors = true;
    }

    if (hasErrors) return;

    await submitOperation(
      {
        op_type: GENERIC_COL_OP,
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
      },
      'Generic column operation saved successfully'
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      {/* Function Name */}
      <div className="space-y-2">
        <Label>Function *</Label>
        <Input
          {...register('function_name', { required: 'Function name is required' })}
          placeholder="Enter SQL function name (e.g., CONCAT, UPPER, LOWER)"
          disabled={isViewMode}
          data-testid="generic-function-name"
        />
        {errors.function_name && (
          <p className="text-sm text-destructive">{errors.function_name.message}</p>
        )}
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
              <>
                <ColumnSelect
                  value={watchedOperands[index]?.col_val || ''}
                  onChange={(value) => {
                    setValue(`operands.${index}.col_val`, value);
                    clearErrors(`operands.${index}.col_val` as `operands.${number}.col_val`);
                  }}
                  columns={srcColumns}
                  placeholder="Select column"
                  disabled={isViewMode}
                  testId={`generic-col-${index}`}
                />
                {errors.operands?.[index]?.col_val && (
                  <p className="text-sm text-destructive">
                    {errors.operands[index].col_val.message}
                  </p>
                )}
              </>
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

      {errors.operands && !Array.isArray(errors.operands) && errors.operands.message && (
        <p className="text-sm text-destructive">{errors.operands.message}</p>
      )}

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
          {...register('output_column_name', { required: 'Output column name is required' })}
          placeholder="Enter output column name"
          disabled={isViewMode}
          data-testid="generic-output-name"
        />
        {errors.output_column_name && (
          <p className="text-sm text-destructive">{errors.output_column_name.message}</p>
        )}
      </div>

      {/* Info */}
      <p className="text-xs text-muted-foreground">
        Operands are passed to the function in order. Example: CONCAT(col1, col2) or UPPER(name).
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
