// components/transform/canvas/forms/ArithmeticOpForm.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
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
import { toastSuccess, toastError } from '@/lib/toast';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { ColumnSelect } from './shared/ColumnSelect';
import { FormActions } from './shared/FormActions';
import { ArithmeticOperations } from '@/constants/transform';
import type {
  OperationFormProps,
  ArithmeticDataConfig,
  ModelSrcOtherInputPayload,
} from '@/types/transform';

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
  const isViewMode = action === 'view';
  const isEditMode = action === 'edit';

  const [srcColumns, setSrcColumns] = useState<string[]>([]);
  const skipResetRef = useRef(false);
  const { createOperation, editOperation, isCreating, isEditing } = useCanvasOperations();

  const { control, handleSubmit, reset, watch, setValue, register } = useForm<FormValues>({
    defaultValues: {
      operator: '',
      operands: [
        { type: 'col', col_val: '', const_val: '' },
        { type: 'col', col_val: '', const_val: '' },
      ],
      output_column_name: '',
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'operands',
  });

  const selectedOperator = watch('operator');
  const watchedOperands = watch('operands');

  // Fetch source columns from node
  useEffect(() => {
    if (node?.data?.output_columns) {
      setSrcColumns(node.data.output_columns);
    }
  }, [node]);

  // Load existing config in edit mode
  useEffect(() => {
    if ((isEditMode || isViewMode) && node?.data?.operation_config) {
      const config = node.data.operation_config.config as unknown as ArithmeticDataConfig;
      if (config) {
        skipResetRef.current = true;
        reset({
          operator: config.operator,
          output_column_name: config.output_column_name,
          operands: (config.operands ?? []).map((op) => ({
            type: op.is_col ? 'col' : 'val',
            col_val: op.is_col ? String(op.value) : '',
            const_val: op.is_col ? '' : String(op.value),
          })),
        });
      }
      if (config?.source_columns) {
        setSrcColumns(config.source_columns);
      }
    }
  }, [isEditMode, isViewMode, node, reset]);

  // Reset operands when operation changes (except during edit load)
  useEffect(() => {
    if (skipResetRef.current) {
      skipResetRef.current = false;
      return;
    }
    if (selectedOperator) {
      replace([
        { type: 'col', col_val: '', const_val: '' },
        { type: 'col', col_val: '', const_val: '' },
      ]);
    }
  }, [selectedOperator, replace]);

  // Sub/div only allow 2 operands
  const canAddOperand =
    selectedOperator &&
    ((['sub', 'div'].includes(selectedOperator) && fields.length < 2) ||
      ['add', 'mul'].includes(selectedOperator));

  const onSubmit = async (data: FormValues) => {
    if (!node?.id) {
      toastError.api('No node selected');
      return;
    }

    if (!data.operator) {
      toastError.api('Please select an operation');
      return;
    }

    if (!data.output_column_name) {
      toastError.api('Output column name is required');
      return;
    }

    // Validate operands
    const validOperands = data.operands.filter((op) =>
      op.type === 'col' ? op.col_val : op.const_val
    );

    if (validOperands.length < 2) {
      toastError.api('At least two operands are required');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        op_type: operation.slug,
        config: {
          operator: data.operator,
          operands: data.operands.map((op) => ({
            is_col: op.type === 'col',
            value: op.type === 'col' ? op.col_val : parseFloat(op.const_val) || op.const_val,
          })),
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

      toastSuccess.generic('Arithmetic operation saved successfully');
      continueOperationChain(createdNodeUuid);
    } catch (error) {
      console.error('Failed to save arithmetic operation:', error);
      toastError.save(error, 'operation');
    } finally {
      setLoading(false);
    }
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
            <Select value={field.value} onValueChange={field.onChange} disabled={isViewMode}>
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
              <ColumnSelect
                value={watchedOperands[index]?.col_val || ''}
                onChange={(value) => setValue(`operands.${index}.col_val`, value)}
                columns={srcColumns}
                placeholder="Select column"
                disabled={isViewMode}
                testId={`arithmetic-col-${index}`}
              />
            ) : (
              <Input
                {...register(`operands.${index}.const_val`)}
                type="number"
                step="any"
                placeholder="Enter numeric value"
                disabled={isViewMode}
                data-testid={`arithmetic-val-${index}`}
              />
            )}
          </div>
        ))}
      </div>

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
          {...register('output_column_name', { required: true })}
          placeholder="Enter output column name"
          disabled={isViewMode}
          data-testid="arithmetic-output-name"
        />
      </div>

      {/* Info */}
      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-md text-sm text-blue-700">
        <Info className="h-4 w-4 flex-shrink-0" />
        <span>Please select only numeric columns for arithmetic operations.</span>
      </div>

      {/* Actions */}
      <FormActions
        isViewMode={isViewMode}
        isSubmitting={isCreating || isEditing}
        onCancel={clearAndClosePanel}
      />
    </form>
  );
}
