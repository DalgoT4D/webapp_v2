# CoalesceOpForm Specification

## Overview

Form for coalescing (returning first non-null value from) multiple columns.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationPanel/Forms/CoalesceOpForm.tsx` (~331 lines)

**v2 Target:** `webapp_v2/src/components/transform/forms/CoalesceOpForm.tsx`

**Complexity:** High

---

## Visual Design

```
┌─────────────────────────────────────┐
│ Columns                             │  (header)
├─────────────────────────────────────┤
│ 1 │ [first_name                 ▼]  │
│ 2 │ [nickname                   ▼]  │
│ 3 │ [username                   ▼]  │
│ 4 │ [                           ▼]  │  (auto-adds on select)
├─────────────────────────────────────┤
│ Default Value* ℹ                    │
│ [Unknown                          ] │
│                                     │
│ Output Column Name*                 │
│ [display_name                     ] │
├─────────────────────────────────────┤
│              [Save]                 │
└─────────────────────────────────────┘
```

---

## Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| columns[].col | Autocomplete | Yes (at least 1) | Columns to coalesce in order |
| default_value | Input | Yes | Default if all values null |
| output_column_name | Input | Yes | Result column name |

---

## API Payload

### Create
```typescript
POST transform/v2/dbt_project/operations/nodes/
{
  "op_type": "coalesce",
  "config": {
    "columns": ["first_name", "nickname", "username"],
    "default_value": "Unknown",
    "output_column_name": "display_name"
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
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Autocomplete } from '@/components/ui/autocomplete';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useColumnData } from '@/hooks/api/useColumnData';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import type { OperationFormProps, CoalesceDataConfig } from '@/types/transform.types';

interface FormData {
  columns: Array<{ col: string | null }>;
  default_value: string;
  output_column_name: string;
}

export default function CoalesceOpForm({
  node,
  operation,
  action,
  continueOperationChain,
  setLoading,
}: OperationFormProps) {
  const [srcColumns, setSrcColumns] = useState<string[]>([]);
  const { createOperation, editOperation } = useCanvasOperations();

  const { control, handleSubmit, reset, getValues, formState } = useForm<FormData>({
    defaultValues: {
      columns: [{ col: null }],
      default_value: '',
      output_column_name: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'columns',
    rules: {
      minLength: { value: 2, message: 'At least 1 column is required' },
    },
  });

  const columns = getValues().columns;

  const fetchAndSetSourceColumns = async () => {
    if (node) {
      if (['model', 'source'].includes(node.type || '')) {
        if (node.data.dbtmodel) {
          const response = await fetch(
            `/api/warehouse/table_columns/${node.data.dbtmodel.schema}/${node.data.dbtmodel.name}`
          );
          const data = await response.json();
          setSrcColumns(data.map((col: any) => col.name));
        }
      }
      if (node.type === 'operation') {
        setSrcColumns(node.data.output_columns);
      }
    }
  };

  const fetchAndSetConfigForEdit = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/transform/v2/dbt_project/nodes/${node?.id}/`);
      const { operation_config } = await response.json();

      const { source_columns, columns, output_column_name, default_value }: CoalesceDataConfig =
        operation_config.config;
      setSrcColumns(source_columns);

      const coalesceColumns = columns.map((col) => ({ col }));
      coalesceColumns.push({ col: null });

      reset({
        columns: coalesceColumns,
        default_value: default_value,
        output_column_name: output_column_name,
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

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const payload = {
        op_type: operation.slug,
        config: {
          columns: data.columns.map((c) => c.col).filter((col) => col),
          default_value: data.default_value,
          output_column_name: data.output_column_name,
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
      console.error('Failed to save coalesce operation:', error);
    } finally {
      setLoading(false);
    }
  };

  const isViewOnly = action === 'view';

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Columns Grid */}
      <div className="border border-gray-200">
        <div className="bg-gray-100 px-4 py-3">
          <span className="font-semibold text-sm">Columns</span>
        </div>
        {fields.map((field, index) => (
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
                    data-testid={`column${index}`}
                    disabled={isViewOnly}
                    options={srcColumns
                      .filter((option) => !columns.map((c) => c.col).includes(option))
                      .sort((a, b) => a.localeCompare(b))}
                    onChange={(data) => {
                      field.onChange(data);
                      if (data) append({ col: null });
                      else remove(index + 1);
                    }}
                    placeholder="Select column"
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

      {/* Additional Fields */}
      <div className="p-4 pt-8 space-y-4">
        {/* Default Value */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">Default Value*</span>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                Output if all values in a row are null
              </TooltipContent>
            </Tooltip>
          </div>
          <Controller
            control={control}
            rules={{ required: 'Default value is required' }}
            name="default_value"
            render={({ field, fieldState }) => (
              <Input
                {...field}
                data-testid="defaultValue"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                disabled={isViewOnly}
                placeholder="Enter default value"
              />
            )}
          />
        </div>

        {/* Output Column Name */}
        <Controller
          control={control}
          rules={{ required: 'Output column name is required' }}
          name="output_column_name"
          render={({ field, fieldState }) => (
            <Input
              {...field}
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              disabled={isViewOnly}
              label="Output Column Name*"
            />
          )}
        />

        {/* Submit */}
        {!isViewOnly && (
          <div className="sticky bottom-0 bg-white pb-4">
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
    "type": "coalesce",
    "config": {
      "columns": ["first_name", "nickname", "username"],
      "default_value": "Unknown",
      "output_column_name": "display_name",
      "source_columns": ["id", "first_name", "nickname", "username"]
    }
  }
}
```

---

## Key Features

1. **Auto-append columns**: Selecting a column auto-adds empty row
2. **Numbered priority**: Numbers indicate coalesce priority order
3. **Filter used columns**: Already selected columns filtered from options
4. **Default value tooltip**: Explains purpose of default value

---

## Implementation Checklist

- [ ] Create form component
- [ ] Implement column grid with auto-append
- [ ] Filter already selected columns
- [ ] Add default value with tooltip
- [ ] Add output column name
- [ ] Build payload with columns array
- [ ] Handle edit mode initialization
- [ ] Handle view mode
- [ ] Add validation
- [ ] Style with Tailwind
