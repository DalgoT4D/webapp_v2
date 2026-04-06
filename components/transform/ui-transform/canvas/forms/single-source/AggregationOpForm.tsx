// components/transform/canvas/forms/AggregationOpForm.tsx
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toastError } from '@/lib/toast';
import { ColumnSelect } from '../shared/ColumnSelect';
import { FormActions } from '../shared/FormActions';
import { useOperationForm } from '../shared/useOperationForm';
import { AggregateOperations, AGGREGATE_OP } from '@/constants/transform';
import { getTypedConfig } from '@/types/transform';
import type { OperationFormProps } from '@/types/transform';

interface FormValues {
  column: string;
  operation: string;
  outputColumnName: string;
}

/**
 * Form for single aggregation operations.
 * Applies one aggregation function to a column.
 */
export function AggregationOpForm({
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

  const { register, handleSubmit, setValue, watch } = useForm<FormValues>({
    defaultValues: (() => {
      if ((isEditMode || isViewMode) && node?.data?.operation_config?.config) {
        const config = getTypedConfig(AGGREGATE_OP, node.data.operation_config);
        if (config?.aggregate_on && config.aggregate_on.length > 0) {
          const agg = config.aggregate_on[0];
          return {
            column: agg.column,
            operation: agg.operation,
            outputColumnName: agg.output_column_name,
          };
        }
      }
      return { column: '', operation: '', outputColumnName: '' };
    })(),
  });

  const selectedColumn = watch('column');
  const selectedOperation = watch('operation');

  // Auto-generate output column name
  useEffect(() => {
    if (selectedColumn && selectedOperation && !isEditMode && !isViewMode) {
      const opLabel =
        AggregateOperations.find((op) => op.id === selectedOperation)?.label || selectedOperation;
      setValue(
        'outputColumnName',
        `${selectedColumn}_${opLabel.toLowerCase().replace(/\s+/g, '_')}`
      );
    }
  }, [selectedColumn, selectedOperation, setValue, isEditMode, isViewMode]);

  const onSubmit = async (data: FormValues) => {
    if (!data.column || !data.operation || !data.outputColumnName) {
      toastError.api('All fields are required');
      return;
    }

    await submitOperation(
      {
        op_type: operation.slug,
        config: {
          aggregate_on: [
            {
              column: data.column,
              operation: data.operation,
              output_column_name: data.outputColumnName,
            },
          ],
        },
        source_columns: srcColumns,
      },
      'Aggregation saved successfully'
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      {/* Column */}
      <div className="space-y-2">
        <Label>Column *</Label>
        <ColumnSelect
          value={selectedColumn}
          onChange={(value) => setValue('column', value)}
          columns={srcColumns}
          placeholder="Select column"
          disabled={isViewMode}
          testId="agg-column-select"
        />
      </div>

      {/* Operation */}
      <div className="space-y-2">
        <Label>Aggregation Function *</Label>
        <Select
          value={selectedOperation}
          onValueChange={(value) => setValue('operation', value)}
          disabled={isViewMode}
        >
          <SelectTrigger data-testid="agg-operation-select">
            <SelectValue placeholder="Select function" />
          </SelectTrigger>
          <SelectContent>
            {AggregateOperations.map((op) => (
              <SelectItem key={op.id} value={op.id}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Output Column Name */}
      <div className="space-y-2">
        <Label>Output Column Name *</Label>
        <Input
          {...register('outputColumnName', { required: true })}
          placeholder="Enter output column name"
          disabled={isViewMode}
          data-testid="agg-output-name"
        />
      </div>

      {/* Info */}
      <p className="text-xs text-muted-foreground">
        The aggregation will compute a single value across all rows.
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
