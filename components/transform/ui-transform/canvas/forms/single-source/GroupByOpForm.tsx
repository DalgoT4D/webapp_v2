// components/transform/canvas/forms/GroupByOpForm.tsx
'use client';

import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toastError } from '@/lib/toast';
import { ColumnSelect } from '../shared/ColumnSelect';
import { FormActions } from '../shared/FormActions';
import { useOperationForm } from '../shared/useOperationForm';
import { AggregateOperations, GROUPBY_OP } from '@/constants/transform';
import { getTypedConfig } from '@/types/transform';
import type { OperationFormProps, AggregateOn } from '@/types/transform';

interface DimensionCol {
  col: string;
}

interface AggregateItem {
  metric: string;
  aggregate_func: string;
  output_column_name: string;
}

interface FormValues {
  dimensions: DimensionCol[];
  aggregations: AggregateItem[];
}

/**
 * Form for grouping data by dimensions and applying aggregations.
 * Supports multiple dimension columns and multiple aggregations.
 */
export function GroupByOpForm({
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
    opType: GROUPBY_OP,
    continueOperationChain,
    setLoading,
    sortColumns: true,
  });

  const { control, handleSubmit, watch, setValue, register } = useForm<FormValues>({
    defaultValues: (() => {
      if ((isEditMode || isViewMode) && node?.data?.operation_config?.config) {
        const config = getTypedConfig(GROUPBY_OP, node.data.operation_config);
        if (config) {
          const dimensions = config.dimension_columns?.map((col) => ({ col })) || [];
          dimensions.push({ col: '' });
          const aggregations = config.aggregate_on?.map((agg) => ({
            metric: agg.column,
            aggregate_func: agg.operation,
            output_column_name: agg.output_column_name,
          })) || [{ metric: '', aggregate_func: '', output_column_name: '' }];
          return { dimensions, aggregations };
        }
      }
      return {
        dimensions: [{ col: '' }],
        aggregations: [{ metric: '', aggregate_func: '', output_column_name: '' }],
      };
    })(),
  });

  const {
    fields: dimFields,
    append: appendDim,
    remove: removeDim,
  } = useFieldArray({
    control,
    name: 'dimensions',
  });

  const {
    fields: aggFields,
    append: appendAgg,
    remove: removeAgg,
  } = useFieldArray({
    control,
    name: 'aggregations',
  });

  const watchedDimensions = watch('dimensions');
  const watchedAggregations = watch('aggregations');

  // Get selected dimension columns to filter from options
  const selectedDimCols = watchedDimensions.map((d) => d.col).filter(Boolean);

  const handleDimensionSelect = (index: number, value: string) => {
    if (value && index === dimFields.length - 1) {
      // Auto-append empty row when selecting in last row
      appendDim({ col: '' });
    } else if (!value && index < dimFields.length - 1) {
      // Remove the next empty row when a dimension is cleared
      const nextRow = watchedDimensions[index + 1];
      if (nextRow && !nextRow.col) {
        removeDim(index + 1);
      }
    }
  };

  const onSubmit = async (data: FormValues) => {
    const validDimensions = data.dimensions.map((d) => d.col).filter(Boolean);
    const validAggregations = data.aggregations.filter(
      (a) => a.metric && a.aggregate_func && a.output_column_name
    );

    if (validDimensions.length === 0) {
      toastError.api('At least one dimension column is required');
      return;
    }

    if (validAggregations.length === 0) {
      toastError.api('At least one aggregation is required');
      return;
    }

    await submitOperation(
      {
        op_type: GROUPBY_OP,
        config: {
          dimension_columns: validDimensions,
          aggregate_on: validAggregations.map((a) => ({
            column: a.metric,
            operation: a.aggregate_func as AggregateOn['operation'],
            output_column_name: a.output_column_name,
          })),
        },
        source_columns: srcColumns,
      },
      'Group by operation saved successfully'
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Dimension Columns */}
      <div className="border rounded-md">
        <div className="bg-muted px-4 py-3 rounded-t-md">
          <Label className="text-xs font-medium text-muted-foreground uppercase">
            Select Dimensions
          </Label>
        </div>
        <div className="divide-y max-h-48 overflow-y-auto">
          {dimFields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-8 text-center text-sm font-medium text-muted-foreground">
                {index + 1}
              </span>
              <div className="flex-1">
                <Controller
                  control={control}
                  name={`dimensions.${index}.col`}
                  render={({ field: colField }) => (
                    <ColumnSelect
                      value={colField.value}
                      onChange={(value) => {
                        colField.onChange(value);
                        handleDimensionSelect(index, value);
                      }}
                      columns={srcColumns.filter(
                        (col) => !selectedDimCols.includes(col) || col === colField.value
                      )}
                      placeholder="Select dimension column"
                      disabled={isViewMode}
                      testId={`groupby-dim-${index}`}
                    />
                  )}
                />
              </div>
              {dimFields.length > 1 && watchedDimensions[index]?.col && !isViewMode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove dimension"
                  onClick={() => removeDim(index)}
                  className="h-9 w-9"
                  data-testid={`groupby-dim-remove-${index}`}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Aggregations */}
      <div className="px-6 space-y-6">
        {aggFields.map((field, index) => (
          <div key={field.id} className="space-y-4 p-4 border rounded-md">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-muted-foreground">
                AGGREGATION {String(index + 1).padStart(2, '0')}
              </Label>
              {aggFields.length > 1 && !isViewMode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAgg(index)}
                  data-testid={`groupby-agg-remove-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label>Select Metric *</Label>
              <ColumnSelect
                value={watchedAggregations[index]?.metric || ''}
                onChange={(value) => setValue(`aggregations.${index}.metric`, value)}
                columns={srcColumns}
                placeholder="Select metric column"
                disabled={isViewMode}
                testId={`groupby-metric-${index}`}
              />
            </div>

            <div className="space-y-2">
              <Label>Select Aggregation *</Label>
              <Controller
                control={control}
                name={`aggregations.${index}.aggregate_func`}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isViewMode}>
                    <SelectTrigger data-testid={`groupby-agg-func-${index}`}>
                      <SelectValue placeholder="Select aggregation" />
                    </SelectTrigger>
                    <SelectContent>
                      {AggregateOperations.map((op) => (
                        <SelectItem key={op.id} value={op.id}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Output Column Name *</Label>
              <Input
                {...register(`aggregations.${index}.output_column_name`)}
                placeholder="Enter output column name"
                disabled={isViewMode}
                data-testid={`groupby-output-${index}`}
              />
            </div>
          </div>
        ))}

        {/* Add Aggregation Button */}
        {!isViewMode && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendAgg({ metric: '', aggregate_func: '', output_column_name: '' })}
            className="w-full"
            data-testid="groupby-add-agg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Aggregation
          </Button>
        )}
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
