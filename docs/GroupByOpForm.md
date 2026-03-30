# GroupByOpForm Specification

## Overview

Form for grouping data by dimension columns and applying aggregations.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationPanel/Forms/GroupByOpForm.tsx` (~405 lines)

**v2 Target:** `webapp_v2/src/components/transform/forms/GroupByOpForm.tsx`

**Complexity:** High

---

## Visual Design

```
┌─────────────────────────────────────┐
│ Select dimensions                   │  (header)
├─────────────────────────────────────┤
│ 1 │ [customer_id                ▼]  │
│ 2 │ [region                     ▼]  │
│ 3 │ [                           ▼]  │  (auto-adds on select)
├─────────────────────────────────────┤
│ ADD AGGREGATION 01                  │
│ Select metric*                      │
│ [order_amount                   ▼]  │
│                                     │
│ Select aggregation*                 │
│ [Sum                            ▼]  │
│                                     │
│ Output Column Name*                 │
│ [total_amount                     ] │
│                                     │
│ [+ Add aggregation]                 │
├─────────────────────────────────────┤
│              [Save]                 │
└─────────────────────────────────────┘
```

---

## Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| columns[].col | Autocomplete | Yes (at least 1) | Dimension columns |
| aggregate_on[].metric | Autocomplete | Yes | Column to aggregate |
| aggregate_on[].aggregate_func | Autocomplete | Yes | Aggregation function |
| aggregate_on[].output_column_name | Input | Yes | Result column name |

---

## API Payload

### Create
```typescript
POST transform/v2/dbt_project/operations/nodes/
{
  "op_type": "groupby",
  "config": {
    "dimension_columns": ["customer_id", "region"],
    "aggregate_on": [
      {
        "column": "order_amount",
        "operation": "sum",
        "output_column_name": "total_amount"
      },
      {
        "column": "order_id",
        "operation": "count",
        "output_column_name": "order_count"
      }
    ]
  },
  "input_node_uuid": "uuid-of-source-node",
  "source_columns": ["col1", "col2", "..."],
  "other_inputs": []
}
```

---

## Implementation

```typescript
import { useEffect, useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Autocomplete } from '@/components/ui/autocomplete';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { AggregateOperations } from './AggregationOpForm';
import type { OperationFormProps, GroupbyDataConfig, AggregateOn } from '@/types/transform.types';

interface FormProps {
  columns: { col: string }[];
  aggregate_on: {
    metric: string;
    aggregate_func: { id: string; label: string };
    output_column_name: string;
  }[];
}

export default function GroupByOpForm({
  node,
  operation,
  action,
  continueOperationChain,
  setLoading,
}: OperationFormProps) {
  const [srcColumns, setSrcColumns] = useState<string[]>([]);
  const { createOperation, editOperation } = useCanvasOperations();

  const { control, handleSubmit, reset, watch, formState } = useForm<FormProps>({
    defaultValues: {
      columns: [{ col: '' }],
      aggregate_on: [{
        metric: '',
        aggregate_func: { id: '', label: '' },
        output_column_name: '',
      }],
    },
  });

  const {
    fields: dimensionFields,
    append: appendDimension,
    remove: removeDimension,
  } = useFieldArray({
    control,
    name: 'columns',
    rules: {
      minLength: { value: 2, message: 'At least 1 column is required' },
    },
  });

  const {
    fields: aggregateFields,
    append: appendAggregate,
    remove: removeAggregate,
  } = useFieldArray({
    control,
    name: 'aggregate_on',
  });

  const dimCols = watch('columns');

  const fetchAndSetSourceColumns = () => {
    if (node) {
      setSrcColumns(node.data.output_columns.sort((a, b) => a.localeCompare(b)));
    }
  };

  const fetchAndSetConfigForEdit = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/transform/v2/dbt_project/nodes/${node?.id}/`);
      const { operation_config } = await response.json();

      const { source_columns, aggregate_on, dimension_columns }: GroupbyDataConfig =
        operation_config.config;
      setSrcColumns(source_columns);

      const dimensionCols = dimension_columns.map((col) => ({ col }));
      dimensionCols.push({ col: '' });

      reset({
        columns: dimensionCols,
        aggregate_on: aggregate_on.map((item: AggregateOn) => ({
          metric: item.column,
          aggregate_func: AggregateOperations.find((op) => op.id === item.operation) || { id: '', label: '' },
          output_column_name: item.output_column_name,
        })),
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (node?.data.isDummy) return;
    if (['edit', 'view'].includes(action)) {
      fetchAndSetConfigForEdit();
    } else {
      fetchAndSetSourceColumns();
    }
  }, [node]);

  const onSubmit = async (data: FormProps) => {
    setLoading(true);
    try {
      const dimensionColumns = data.columns
        .filter((col) => col.col)
        .map((col) => col.col);

      const payload = {
        op_type: operation.slug,
        config: {
          aggregate_on: data.aggregate_on
            .filter((item) => item.metric && item.aggregate_func.id && item.output_column_name)
            .map((item) => ({
              column: item.metric,
              operation: item.aggregate_func.id,
              output_column_name: item.output_column_name,
            })),
          dimension_columns: dimensionColumns,
        },
        source_columns: srcColumns,
        other_inputs: [],
      };

      const finalAction = node?.data.isDummy ? 'create' : action;
      if (finalAction === 'create') {
        await createOperation(node!.id, {
          ...payload,
          input_node_uuid: node!.id,
        });
      } else {
        await editOperation(node!.id, payload);
      }

      continueOperationChain();
      reset();
    } catch (error) {
      console.error('Failed to save groupby operation:', error);
    } finally {
      setLoading(false);
    }
  };

  const isViewOnly = action === 'view';

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Dimension Columns Grid */}
      <div className="border border-gray-200">
        <div className="bg-gray-100 px-4 py-3">
          <span className="font-semibold text-sm">Select dimensions</span>
        </div>
        {dimensionFields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-[auto_1fr] items-center border-t">
            <div className="bg-gray-100 px-4 py-3 w-12 text-center font-semibold text-sm">
              {index + 1}
            </div>
            <div className="px-4 py-2">
              <Controller
                control={control}
                name={`columns.${index}.col`}
                render={({ field }) => (
                  <Autocomplete
                    {...field}
                    data-testid={`columns${index}`}
                    disabled={isViewOnly}
                    options={srcColumns.filter(
                      (option) => !dimCols.map((col) => col.col).includes(option)
                    )}
                    onChange={(data) => {
                      field.onChange(data);
                      if (data) appendDimension({ col: '' });
                      else removeDimension(index + 1);
                    }}
                    placeholder="Select dimension column"
                  />
                )}
              />
            </div>
          </div>
        ))}
      </div>

      {formState.errors.columns?.root && (
        <p className="text-red-500 text-sm px-4 py-2">
          {formState.errors.columns.root.message}
        </p>
      )}

      {/* Aggregations */}
      <div className="p-4 pt-8 space-y-6">
        {aggregateFields.map((field, index) => (
          <div key={field.id} className="space-y-4">
            <div className="font-semibold text-gray-500">
              ADD AGGREGATION {(index + 1).toString().padStart(2, '0')}
            </div>

            <Controller
              control={control}
              rules={{ required: 'Metric is required' }}
              name={`aggregate_on.${index}.metric`}
              render={({ field, fieldState }) => (
                <Autocomplete
                  {...field}
                  data-testid="metric"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  disabled={isViewOnly}
                  options={srcColumns}
                  label="Select metric*"
                />
              )}
            />

            <Controller
              control={control}
              rules={{
                validate: (value) => value.id !== '' || 'Aggregate function is required',
              }}
              name={`aggregate_on.${index}.aggregate_func`}
              render={({ field, fieldState }) => (
                <Autocomplete
                  {...field}
                  data-testid="aggregation"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  disabled={isViewOnly}
                  options={AggregateOperations}
                  getOptionLabel={(opt) => opt.label}
                  isOptionEqualToValue={(option, value) => option?.id === value?.id}
                  label="Select aggregation*"
                />
              )}
            />

            <Controller
              control={control}
              rules={{ required: 'Output column name is required' }}
              name={`aggregate_on.${index}.output_column_name`}
              render={({ field, fieldState }) => (
                <Input
                  {...field}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  label="Output Column Name*"
                  disabled={isViewOnly}
                />
              )}
            />

            {/* Add/Remove Aggregation Buttons */}
            {index === aggregateFields.length - 1 ? (
              <Button
                variant="outline"
                type="button"
                data-testid="addoperand"
                disabled={isViewOnly}
                onClick={() =>
                  appendAggregate({
                    metric: '',
                    aggregate_func: { id: '', label: '' },
                    output_column_name: '',
                  })
                }
              >
                <Plus className="w-4 h-4 mr-2" />
                Add aggregation
              </Button>
            ) : (
              <Button
                variant="destructive"
                type="button"
                data-testid="removeoperand"
                onClick={() => removeAggregate(index)}
                disabled={isViewOnly}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove aggregation
              </Button>
            )}
          </div>
        ))}

        {/* Submit */}
        {!isViewOnly && (
          <div className="sticky bottom-0 bg-white pb-4">
            <Button
              variant="outline"
              type="submit"
              data-testid="savebutton"
              className="w-full"
              disabled={isViewOnly}
            >
              Save
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
```

---

## Edit Mode Config Mapping

From API response:
```typescript
{
  "operation_config": {
    "type": "groupby",
    "config": {
      "dimension_columns": ["customer_id", "region"],
      "aggregate_on": [
        { "column": "amount", "operation": "sum", "output_column_name": "total" }
      ],
      "source_columns": ["customer_id", "region", "amount", "date"]
    }
  }
}
```

---

## Key Features

1. **Auto-append dimensions**: Selecting a column auto-adds empty row
2. **Multiple aggregations**: Can add multiple aggregate functions
3. **Column filtering**: Used dimension columns filtered from options
4. **Numbered rows**: Dimension columns show row numbers

---

## Implementation Checklist

- [ ] Create form component
- [ ] Implement dimension column grid with auto-append
- [ ] Implement multiple aggregation sections
- [ ] Filter used columns from dimension options
- [ ] Build payload with dimension_columns and aggregate_on
- [ ] Handle edit mode initialization
- [ ] Handle view mode
- [ ] Add validation
- [ ] Style with Tailwind
