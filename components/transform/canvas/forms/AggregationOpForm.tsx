// components/transform/canvas/forms/AggregationOpForm.tsx
'use client';

import { useEffect, useState } from 'react';
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
import { toastSuccess, toastError } from '@/lib/toast';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { ColumnSelect } from './shared/ColumnSelect';
import { FormActions } from './shared/FormActions';
import { AggregateOperations } from '@/constants/transform';
import type { OperationFormProps, AggregateDataConfig } from '@/types/transform';

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
  const isViewMode = action === 'view';
  const isEditMode = action === 'edit';

  const [srcColumns, setSrcColumns] = useState<string[]>([]);
  const { createOperation, editOperation, isCreating, isEditing } = useCanvasOperations();

  const { register, handleSubmit, setValue, watch, reset } = useForm<FormValues>({
    defaultValues: {
      column: '',
      operation: '',
      outputColumnName: '',
    },
  });

  const selectedColumn = watch('column');
  const selectedOperation = watch('operation');

  // Fetch source columns from node
  useEffect(() => {
    if (node?.data?.output_columns) {
      setSrcColumns(node.data.output_columns);
    }
  }, [node]);

  // Load existing config in edit mode
  useEffect(() => {
    if ((isEditMode || isViewMode) && node?.data?.operation_config) {
      const config = node.data.operation_config.config as AggregateDataConfig;
      if (config?.aggregate_on && config.aggregate_on.length > 0) {
        const agg = config.aggregate_on[0];
        reset({
          column: agg.column,
          operation: agg.operation,
          outputColumnName: agg.output_column_name,
        });
      }
      if (config?.source_columns) {
        setSrcColumns(config.source_columns);
      }
    }
  }, [isEditMode, isViewMode, node, reset]);

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
    if (!node?.id) {
      toastError.api('No node selected');
      return;
    }

    if (!data.column || !data.operation || !data.outputColumnName) {
      toastError.api('All fields are required');
      return;
    }

    setLoading(true);

    try {
      const payload = {
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

      toastSuccess.generic('Aggregation saved successfully');
      continueOperationChain();
    } catch (error) {
      console.error('Failed to save aggregation operation:', error);
      toastError.save(error, 'operation');
    } finally {
      setLoading(false);
    }
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
        isSubmitting={isCreating || isEditing}
        onCancel={clearAndClosePanel}
      />
    </form>
  );
}
