# AggregationOpForm Specification

## Overview

Form for applying a single aggregation function to a column.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationPanel/Forms/AggregationOpForm.tsx` (~254 lines)

**v2 Target:** `webapp_v2/src/components/transform/forms/AggregationOpForm.tsx`

**Complexity:** Medium

---

## Visual Design

```
┌─────────────────────────────────────┐
│ Select Column to Aggregate*         │
│ [order_amount                   ▼]  │
│                                     │
│ Aggregate*                          │
│ [Sum                            ▼]  │
│                                     │
│ Output Column Name*                 │
│ [total_amount                     ] │
├─────────────────────────────────────┤
│              [Save]                 │
└─────────────────────────────────────┘
```

---

## Aggregate Operations

```typescript
export const AggregateOperations = [
  { id: 'avg', label: 'Average' },
  { id: 'count', label: 'Count' },
  { id: 'countdistinct', label: 'Count Distinct' },
  { id: 'max', label: 'Maximum' },
  { id: 'min', label: 'Minimum' },
  { id: 'sum', label: 'Sum' },
];
```

---

## Form Fields

| Field | Type | Required | Options |
|-------|------|----------|---------|
| aggregate_on[0].column | Autocomplete | Yes | Source columns |
| aggregate_on[0].operation | Autocomplete | Yes | AggregateOperations |
| aggregate_on[0].output_column_name | Input | Yes | - |

---

## API Payload

### Create
```typescript
POST transform/v2/dbt_project/operations/nodes/
{
  "op_type": "aggregate",
  "config": {
    "aggregate_on": [{
      "column": "order_amount",
      "operation": "sum",
      "output_column_name": "total_amount"
    }]
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Autocomplete } from '@/components/ui/autocomplete';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import type { OperationFormProps, AggregateDataConfig, AggregateOn } from '@/types/transform.types';

export const AggregateOperations = [
  { id: 'avg', label: 'Average' },
  { id: 'count', label: 'Count' },
  { id: 'countdistinct', label: 'Count Distinct' },
  { id: 'max', label: 'Maximum' },
  { id: 'min', label: 'Minimum' },
  { id: 'sum', label: 'Sum' },
].sort((a, b) => a.label.localeCompare(b.label));

interface FormProps {
  aggregate_on: {
    column: string | null;
    operation: { id: string; label: string } | null;
    output_column_name: string;
  }[];
}

export default function AggregationOpForm({
  node,
  operation,
  action,
  continueOperationChain,
  setLoading,
}: OperationFormProps) {
  const [srcColumns, setSrcColumns] = useState<string[]>([]);
  const { createOperation, editOperation } = useCanvasOperations();

  const { control, handleSubmit, reset } = useForm<FormProps>({
    defaultValues: {
      aggregate_on: [{
        column: null,
        operation: null,
        output_column_name: '',
      }],
    },
  });

  const { fields } = useFieldArray({
    control,
    name: 'aggregate_on',
  });

  const fetchAndSetSourceColumns = () => {
    if (node) {
      setSrcColumns(node.data.output_columns);
    }
  };

  const fetchAndSetConfigForEdit = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/transform/v2/dbt_project/nodes/${node?.id}/`);
      const { operation_config } = await response.json();

      const { source_columns, aggregate_on }: AggregateDataConfig = operation_config.config;
      setSrcColumns(source_columns);

      reset({
        aggregate_on: aggregate_on.map((item: AggregateOn) => ({
          column: item.column,
          operation: AggregateOperations.find((op) => op.id === item.operation),
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
      const payload = {
        op_type: operation.slug,
        config: {
          aggregate_on: data.aggregate_on.map((item) => ({
            operation: item.operation?.id,
            column: item.column,
            output_column_name: item.output_column_name,
          })),
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
      console.error('Failed to save aggregation operation:', error);
    } finally {
      setLoading(false);
    }
  };

  const isViewOnly = action === 'view';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 pt-8 space-y-4">
      {fields.map((field, index) => (
        <div key={field.id} className="space-y-4">
          {/* Column Select */}
          <Controller
            control={control}
            rules={{ required: 'Column to aggregate is required' }}
            name={`aggregate_on.${index}.column`}
            render={({ field, fieldState }) => (
              <Autocomplete
                {...field}
                data-testid="aggregateColumn"
                disabled={isViewOnly}
                options={srcColumns.sort((a, b) => a.localeCompare(b))}
                label="Select Column to Aggregate*"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          {/* Operation Select */}
          <Controller
            control={control}
            rules={{
              validate: (value) => (value && value?.id !== '') || 'Operation is required',
            }}
            name={`aggregate_on.${index}.operation`}
            render={({ field, fieldState }) => (
              <Autocomplete
                disabled={isViewOnly}
                data-testid="operation"
                options={AggregateOperations}
                getOptionLabel={(opt) => opt.label}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                {...field}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                label="Aggregate*"
              />
            )}
          />

          {/* Output Column Name */}
          <Controller
            control={control}
            rules={{ required: 'Output column name is required' }}
            name={`aggregate_on.${index}.output_column_name`}
            render={({ field, fieldState }) => (
              <Input
                {...field}
                label="Output Column Name*"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                disabled={isViewOnly}
              />
            )}
          />
        </div>
      ))}

      {/* Submit */}
      {!isViewOnly && (
        <div className="pt-4 sticky bottom-0 bg-white pb-4">
          <Button
            disabled={isViewOnly}
            type="submit"
            data-testid="savebutton"
            className="w-full"
          >
            Save
          </Button>
        </div>
      )}
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
    "type": "aggregate",
    "config": {
      "aggregate_on": [{
        "column": "amount",
        "operation": "sum",
        "output_column_name": "total_amount"
      }],
      "source_columns": ["id", "amount", "date"]
    }
  }
}
```

---

## Key Features

1. **Single aggregation**: Only one aggregate_on entry (vs GroupBy which has multiple)
2. **Sorted columns**: Column options sorted alphabetically
3. **All fields required**: Column, operation, and output name all mandatory

---

## Implementation Checklist

- [ ] Create form component
- [ ] Implement column selector
- [ ] Implement operation selector with options
- [ ] Implement output column name input
- [ ] Build payload with aggregate_on array
- [ ] Handle edit mode initialization
- [ ] Handle view mode
- [ ] Add validation
- [ ] Style with Tailwind
