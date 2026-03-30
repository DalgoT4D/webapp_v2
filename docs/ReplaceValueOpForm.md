# ReplaceValueOpForm Specification

## Overview

Form for replacing values in a specific column.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationPanel/Forms/ReplaceValueOpForm.tsx` (~270 lines)

**v2 Target:** `webapp_v2/src/components/transform/forms/ReplaceValueOpForm.tsx`

**Complexity:** Medium

---

## Visual Design

```
┌─────────────────────────────────────┐
│ Select a column*                    │
│ [customer_type                  ▼]  │
├──────────────────┬──────────────────┤
│ Column value     │ Replace with     │  (header)
├──────────────────┼──────────────────┤
│ [old_value_1   ] │ [new_value_1   ] │  [×]
│ [old_value_2   ] │ [new_value_2   ] │  [×]
│ [              ] │ [              ] │  [×]
├──────────────────┴──────────────────┤
│          [+ Add row]                │
├─────────────────────────────────────┤
│              [Save]                 │
└─────────────────────────────────────┘
```

---

## Form Fields

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| column_name | Autocomplete | Yes | Must select a column |
| config[].old | Input | Yes* | At least one row required |
| config[].new | Input | Yes* | At least one row required |

---

## API Payload

### Create
```typescript
POST transform/v2/dbt_project/operations/nodes/
{
  "op_type": "replace",
  "config": {
    "columns": [{
      "col_name": "customer_type",
      "output_column_name": "customer_type",
      "replace_ops": [
        { "find": "old_value_1", "replace": "new_value_1" },
        { "find": "old_value_2", "replace": "new_value_2" }
      ]
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
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Autocomplete } from '@/components/ui/autocomplete';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import type { OperationFormProps, ReplaceDataConfig } from '@/types/transform.types';

const parseStringForNull = (value: string | undefined): string | null => {
  if (value === '' || value === 'null' || value === 'NULL') return null;
  return value || null;
};

interface FormData {
  column_name: string;
  config: Array<{ old: string; new: string }>;
}

export default function ReplaceValueOpForm({
  node,
  operation,
  action,
  continueOperationChain,
  setLoading,
}: OperationFormProps) {
  const [srcColumns, setSrcColumns] = useState<string[]>([]);
  const { createOperation, editOperation } = useCanvasOperations();

  const { control, register, handleSubmit, reset, formState } = useForm<FormData>({
    defaultValues: {
      column_name: '',
      config: [{ old: '', new: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'config',
    rules: {
      validate: {
        notAllEmpty: (value) =>
          value.some((item) => item.old !== '' || item.new !== '') ||
          'At least one value is required',
      },
    },
  });

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

      const { source_columns, columns }: ReplaceDataConfig = operation_config.config;
      setSrcColumns(source_columns);

      if (columns.length === 1) {
        const replaceValArray = columns[0].replace_ops.map((item) => ({
          old: item.find,
          new: item.replace,
        }));
        replaceValArray.push({ old: '', new: '' });
        reset({
          column_name: columns[0].col_name,
          config: replaceValArray,
        });
      }
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
      const replaceOps = data.config
        .filter((item) => item.old || item.new)
        .map((item) => ({
          find: parseStringForNull(item.old),
          replace: parseStringForNull(item.new),
        }));

      const payload = {
        op_type: operation.slug,
        config: {
          columns: [{
            col_name: data.column_name,
            output_column_name: data.column_name,
            replace_ops: replaceOps,
          }],
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
      console.error('Failed to save replace operation:', error);
    } finally {
      setLoading(false);
    }
  };

  const isViewOnly = action === 'view';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.preventDefault();
      }}
    >
      {/* Column Select */}
      <div className="p-4 pt-8">
        <Controller
          control={control}
          name="column_name"
          rules={{ required: 'Column is required' }}
          render={({ field, fieldState }) => (
            <Autocomplete
              {...field}
              data-testid="column"
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              disabled={isViewOnly}
              options={srcColumns}
              label="Select a column*"
            />
          )}
        />
      </div>

      {/* Replace Table Header */}
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 bg-gray-100 px-4 py-3">
        <span className="font-semibold text-sm">Column value</span>
        <span className="font-semibold text-sm">Replace with</span>
        <span className="w-8"></span>
      </div>

      {/* Replace Rows */}
      <div className="px-4 py-2 space-y-2">
        {fields.map((field, idx) => (
          <div key={field.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
            <Input
              data-testid={`columnValue${idx}`}
              disabled={isViewOnly}
              {...register(`config.${idx}.old`)}
              placeholder="Find value"
            />
            <Input
              data-testid={`replacedValue${idx}`}
              disabled={isViewOnly}
              {...register(`config.${idx}.new`)}
              placeholder="Replace with"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  append({ old: '', new: '' });
                }
              }}
            />
            {fields.length > 1 && !isViewOnly && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(idx)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Error Message */}
      {formState.errors.config?.root && (
        <p className="text-red-500 text-sm px-4">
          {formState.errors.config.root.message}
        </p>
      )}

      {/* Add Row */}
      {!isViewOnly && (
        <div className="px-4">
          <Button
            type="button"
            variant="outline"
            data-testid="addcase"
            onClick={() => append({ old: '', new: '' })}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add row
          </Button>
        </div>
      )}

      {/* Submit */}
      {!isViewOnly && (
        <div className="p-4 sticky bottom-0 bg-white">
          <Button type="submit" data-testid="savebutton" className="w-full">
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
    "type": "replace",
    "config": {
      "columns": [{
        "col_name": "status",
        "output_column_name": "status",
        "replace_ops": [
          { "find": "A", "replace": "Active" },
          { "find": "I", "replace": "Inactive" }
        ]
      }],
      "source_columns": ["id", "status", "name"]
    }
  }
}
```

---

## Key Features

1. **Null handling**: Empty strings or "null" convert to actual null
2. **Dynamic rows**: Add/remove replace pairs
3. **Enter to add**: Press Enter in last input to add new row
4. **Single column focus**: Replaces values in one selected column

---

## Implementation Checklist

- [ ] Create form component
- [ ] Implement column selector
- [ ] Implement field array for replace pairs
- [ ] Handle null value parsing
- [ ] Build payload with replace_ops
- [ ] Handle edit mode initialization
- [ ] Handle view mode
- [ ] Add validation
- [ ] Style with Tailwind
