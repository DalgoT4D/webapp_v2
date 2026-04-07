// components/transform/canvas/forms/ArithmeticOpForm.tsx
'use client';

import { useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Info } from 'lucide-react';
import { ColumnSelect } from '../shared/ColumnSelect';
import { FormActions } from '../shared/FormActions';
import { useOperationForm } from '../shared/useOperationForm';
import { ArithmeticOperations, ARITHMETIC_OP } from '@/constants/transform';
import { getTypedConfig } from '@/types/transform';
import type { OperationFormProps, ArithmeticDataConfig } from '@/types/transform';

interface Operand {
  type: 'col' | 'val';
  col_val: string;
  const_val: string;
}

interface FormValues {
  operator: string;
  operands: Operand[];
  output_column_name: string;
}

/**
 * Form for performing arithmetic operations.
 * Supports add, subtract, multiply, divide on columns/values.
 */
export function ArithmeticOpForm({
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
    opType: ARITHMETIC_OP,
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
        const config = getTypedConfig(ARITHMETIC_OP, node.data.operation_config);
        if (config) {
          return {
            operator: config.operator || '',
            output_column_name: config.output_column_name || '',
            operands: (config.operands ?? []).map((op) => ({
              type: (op.is_col ? 'col' : 'val') as 'col' | 'val',
              col_val: op.is_col ? String(op.value) : '',
              const_val: op.is_col ? '' : String(op.value),
            })),
          };
        }
      }
      return {
        operator: '',
        operands: [
          { type: 'col' as const, col_val: '', const_val: '' },
          { type: 'col' as const, col_val: '', const_val: '' },
        ],
        output_column_name: '',
      };
    })(),
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'operands',
  });

  const selectedOperator = watch('operator');
  const watchedOperands = watch('operands');

  // Reset operands when operation changes (only in create mode)
  useEffect(() => {
    if (isEditMode || isViewMode) return;
    if (selectedOperator) {
      replace([
        { type: 'col', col_val: '', const_val: '' },
        { type: 'col', col_val: '', const_val: '' },
      ]);
    }
  }, [selectedOperator, replace, isEditMode, isViewMode]);

  // Sub/div only allow 2 operands
  const canAddOperand =
    selectedOperator &&
    ((['sub', 'div'].includes(selectedOperator) && fields.length < 2) ||
      ['add', 'mul'].includes(selectedOperator));

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
      if (op.type === 'val' && !op.const_val) {
        setError(`operands.${index}.const_val` as `operands.${number}.const_val`, {
          message: 'Value is required',
        });
        hasErrors = true;
      }
    });

    // Validate minimum operand count
    const validOperands = data.operands.filter((op) =>
      op.type === 'col' ? op.col_val : op.const_val
    );

    if (validOperands.length < 2) {
      setError('operands', { message: 'At least two operands are required' });
      hasErrors = true;
    }

    if (hasErrors) return;

    await submitOperation(
      {
        op_type: ARITHMETIC_OP,
        config: {
          operator: data.operator as ArithmeticDataConfig['operator'],
          operands: data.operands.map((op) => ({
            is_col: op.type === 'col',
            value: op.type === 'col' ? op.col_val : parseFloat(op.const_val) || op.const_val,
          })),
          output_column_name: data.output_column_name,
        },
        source_columns: srcColumns,
      },
      'Arithmetic operation saved successfully'
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      {/* Operation Select */}
      <div className="space-y-2">
        <Label>Operation *</Label>
        <Controller
          control={control}
          name="operator"
          rules={{ required: 'Operation is required' }}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(val) => {
                field.onChange(val);
                clearErrors('operator');
              }}
              disabled={isViewMode}
            >
              <SelectTrigger data-testid="arithmetic-operation-select">
                <SelectValue placeholder="Select operation" />
              </SelectTrigger>
              <SelectContent>
                {ArithmeticOperations.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.operator && <p className="text-sm text-destructive">{errors.operator.message}</p>}
      </div>

      {/* Operands */}
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="space-y-3 p-4 border rounded-md">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Operand {index + 1}</Label>
              {fields.length > 2 && !isViewMode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  data-testid={`arithmetic-remove-${index}`}
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
                  testId={`arithmetic-col-${index}`}
                />
                {errors.operands?.[index]?.col_val && (
                  <p className="text-sm text-destructive">
                    {errors.operands[index].col_val.message}
                  </p>
                )}
              </>
            ) : (
              <>
                <Input
                  {...register(`operands.${index}.const_val`)}
                  type="number"
                  step="any"
                  placeholder="Enter numeric value"
                  disabled={isViewMode}
                  data-testid={`arithmetic-val-${index}`}
                />
                {errors.operands?.[index]?.const_val && (
                  <p className="text-sm text-destructive">
                    {errors.operands[index].const_val.message}
                  </p>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {errors.operands && <p className="text-sm text-destructive">{errors.operands.message}</p>}

      {/* Add Operand Button */}
      {!isViewMode && canAddOperand && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ type: 'col', col_val: '', const_val: '' })}
          className="w-full"
          data-testid="arithmetic-add-operand"
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
          data-testid="arithmetic-output-name"
        />
        {errors.output_column_name && (
          <p className="text-sm text-destructive">{errors.output_column_name.message}</p>
        )}
      </div>

      {/* Info */}
      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-md text-sm text-blue-700">
        <Info className="h-4 w-4 flex-shrink-0" />
        <span>Please select only numeric columns for arithmetic operations.</span>
      </div>

      {/* Actions */}
      <FormActions
        isViewMode={isViewMode}
        isSubmitting={isSubmitting}
        onCancel={clearAndClosePanel}
      />
    </form>
  );
}
