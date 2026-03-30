# RenameColumnOpForm Specification

## Overview

Form for renaming one or more columns in a table.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationPanel/Forms/RenameColumnOpForm.tsx` (~180 lines)

**v2 Target:** `webapp_v2/src/components/transform/forms/RenameColumnOpForm.tsx`

**Complexity:** Medium

---

## Visual Design

```
┌─────────────────────────────────────┐
│ OLD NAME           │  NEW NAME      │
├────────────────────┼────────────────┤
│ [Select column ▼]  │ [new_name    ] │  ← Row 1
│                    │                │
│ [Select column ▼]  │ [new_name    ] │  ← Row 2
│                    │                │
│        [+ Add Row]                  │
├─────────────────────────────────────┤
│              [Save]                 │
└─────────────────────────────────────┘
```

---

## Form Fields

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| rows[].old | Autocomplete | Yes | Must be existing column |
| rows[].new | Input | Yes | Non-empty, valid identifier |

---

## API Payload

### Create
```typescript
POST transform/v2/dbt_project/nodes/{input_node_uuid}/operations/
{
  "op_type": "renamecolumns",
  "config": {
    "columns": {
      "old_col_1": "new_col_1",
      "old_col_2": "new_col_2"
    }
  },
  "input_node_uuid": "uuid-of-source-node",
  "source_columns": ["col1", "col2", "..."],
  "other_inputs": []
}
```

### Edit
```typescript
PUT transform/v2/dbt_project/nodes/{node_uuid}/
{
  "op_type": "renamecolumns",
  "config": {
    "columns": {
      "old_col_1": "new_col_1"
    }
  },
  "source_columns": ["col1", "col2", "..."],
  "other_inputs": []
}
```

---

## Implementation

```typescript
import { useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Autocomplete } from '@/components/ui/autocomplete';
import { useColumnData } from '@/hooks/api/useColumnData';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import type { OperationFormProps, RenameDataConfig } from '@/types/transform.types';

interface FormRow {
  old: string;
  new: string;
}

interface FormData {
  rows: FormRow[];
}

export default function RenameColumnOpForm({
  node,
  operation,
  action,
  continueOperationChain,
  setLoading,
}: OperationFormProps) {
  const { columns, isLoading: columnsLoading } = useColumnData({
    nodeUuid: node?.id,
  });

  const { createOperation, editOperation } = useCanvasOperations();

  const { control, handleSubmit, reset, formState } = useForm<FormData>({
    defaultValues: {
      rows: [{ old: '', new: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'rows',
    rules: {
      validate: {
        notAllEmpty: (rows) =>
          rows.some((r) => r.old && r.new) || 'At least one rename is required',
      },
    },
  });

  // Load existing config in edit mode
  useEffect(() => {
    if (action === 'edit' && node?.data?.operation_config?.config) {
      const config: RenameDataConfig = node.data.operation_config.config;
      const columnsMap = config.columns;

      // Convert { old: new } map to rows array
      const rows = Object.entries(columnsMap).map(([old, newName]) => ({
        old,
        new: newName,
      }));

      reset({ rows: rows.length > 0 ? rows : [{ old: '', new: '' }] });
    }
  }, [action, node, reset]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      // Build columns map: { old_name: new_name }
      const columnsMap: Record<string, string> = {};
      data.rows
        .filter((r) => r.old && r.new)
        .forEach((r) => {
          columnsMap[r.old] = r.new;
        });

      const payload = {
        op_type: operation.slug,
        config: { columns: columnsMap },
        source_columns: columns,
        other_inputs: [],
      };

      if (action === 'create') {
        await createOperation(node!.id, {
          ...payload,
          input_node_uuid: node!.id,
        });
      } else {
        await editOperation(node!.id, payload);
      }

      continueOperationChain();
    } catch (error) {
      console.error('Failed to save rename operation:', error);
    } finally {
      setLoading(false);
    }
  };

  const isViewOnly = action === 'view';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
      {/* Header */}
      <div className="grid grid-cols-2 gap-4 font-semibold text-sm bg-gray-100 p-2 rounded">
        <span>OLD NAME</span>
        <span>NEW NAME</span>
      </div>

      {/* Rows */}
      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-2 gap-4 items-start">
            <Controller
              control={control}
              name={`rows.${index}.old`}
              rules={{ required: 'Select a column' }}
              render={({ field: f }) => (
                <Autocomplete
                  {...f}
                  options={columns}
                  placeholder="Select column"
                  disabled={isViewOnly}
                  loading={columnsLoading}
                />
              )}
            />

            <div className="flex gap-2">
              <Controller
                control={control}
                name={`rows.${index}.new`}
                rules={{ required: 'Enter new name' }}
                render={({ field: f }) => (
                  <Input
                    {...f}
                    placeholder="New column name"
                    disabled={isViewOnly}
                    className="flex-1"
                  />
                )}
              />

              {fields.length > 1 && !isViewOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Row */}
      {!isViewOnly && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ old: '', new: '' })}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Row
        </Button>
      )}

      {/* Error message */}
      {formState.errors.rows?.root && (
        <p className="text-red-500 text-sm">
          {formState.errors.rows.root.message}
        </p>
      )}

      {/* Submit */}
      {!isViewOnly && (
        <div className="pt-4 sticky bottom-0 bg-white">
          <Button type="submit" className="w-full">
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
    "type": "renamecolumns",
    "config": {
      "columns": {
        "old_name_1": "new_name_1",
        "old_name_2": "new_name_2"
      },
      "source_columns": ["col1", "col2", "..."]
    }
  }
}
```

To form data:
```typescript
{
  rows: [
    { old: "old_name_1", new: "new_name_1" },
    { old: "old_name_2", new: "new_name_2" },
  ]
}
```

---

## Validation

1. At least one valid rename (old + new both filled)
2. Old column must exist in source columns
3. New column name should be valid identifier (no spaces, special chars)

---

## Implementation Checklist

- [ ] Create form component
- [ ] Fetch columns from node
- [ ] Implement field array for dynamic rows
- [ ] Build payload with columns map
- [ ] Handle edit mode initialization
- [ ] Handle view mode (disabled fields)
- [ ] Add validation
- [ ] Style with Tailwind
