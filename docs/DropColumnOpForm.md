# DropColumnOpForm Specification

## Overview

Form for dropping (removing) one or more columns from a table.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationPanel/Forms/DropColumnOpForm.tsx` (~347 lines)

**v2 Target:** `webapp_v2/src/components/transform/forms/DropColumnOpForm.tsx`

**Complexity:** Medium-High

---

## Visual Design

```
┌─────────────────────────────────────┐
│ [🔍 Search Here                   ] │
├─────────────────────────────────────┤
│ Column Name                         │  (header)
├─────────────────────────────────────┤
│ SELECT ALL              CLEAR       │
├─────────────────────────────────────┤
│ ☐ column_a                          │
│ ☐ column_b                          │
│ ☑ column_c  (highlighted bg)        │
│ ☐ column_d                          │
│ ...                                 │
├─────────────────────────────────────┤
│              [Save]                 │
└─────────────────────────────────────┘
```

---

## Form Fields

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| config[].col_name | string | - | Read-only column name |
| config[].drop_col | boolean | - | Whether to drop this column |

---

## API Payload

### Create
```typescript
POST transform/v2/dbt_project/operations/nodes/
{
  "op_type": "dropcolumns",
  "config": {
    "columns": ["col_to_drop_1", "col_to_drop_2"]
  },
  "input_node_uuid": "uuid-of-source-node",
  "source_columns": ["col1", "col2", "..."],
  "other_inputs": []
}
```

### Edit
```typescript
PUT transform/v2/dbt_project/operations/nodes/{node_uuid}/
{
  "op_type": "dropcolumns",
  "config": {
    "columns": ["col_to_drop_1"]
  },
  "source_columns": ["col1", "col2", "..."],
  "other_inputs": []
}
```

---

## Implementation

```typescript
import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useColumnData } from '@/hooks/api/useColumnData';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import type { OperationFormProps, DropDataConfig } from '@/types/transform.types';

interface FormColumnData {
  col_name: string;
  drop_col: boolean;
}

interface FormData {
  config: FormColumnData[];
}

export default function DropColumnOpForm({
  node,
  operation,
  action,
  continueOperationChain,
  setLoading,
}: OperationFormProps) {
  const [srcColumns, setSrcColumns] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [valid, setValid] = useState(true);

  const { createOperation, editOperation } = useCanvasOperations();

  const { control, handleSubmit, reset, getValues, setValue } = useForm<FormData>({
    defaultValues: {
      config: [],
    },
  });

  const { fields } = useFieldArray({
    control,
    name: 'config',
  });

  const config = getValues().config;

  const findColumnIndex = (columnName: string) => {
    const index = config?.findIndex((column) => column.col_name === columnName);
    return index === -1 ? 0 : index;
  };

  const fetchAndSetSourceColumns = () => {
    if (node) {
      setSrcColumns(node.data.output_columns);
      setValue(
        'config',
        node.data.output_columns.map((col: string) => ({
          col_name: col,
          drop_col: false,
        }))
      );
    }
  };

  const fetchAndSetConfigForEdit = async () => {
    try {
      setLoading(true);
      // Fetch node details for edit mode
      const nodeData = await fetch(`/api/transform/v2/dbt_project/nodes/${node?.id}/`);
      const { operation_config } = await nodeData.json();

      const { source_columns, columns }: DropDataConfig = operation_config.config;
      setSrcColumns(source_columns);

      const dropCols = source_columns.map((col) => ({
        col_name: col,
        drop_col: columns.includes(col),
      }));
      reset({ config: dropCols });
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

  const filteredFields = useMemo(() => {
    return fields.filter((field) =>
      field.col_name.toLowerCase().includes(search.toLowerCase())
    );
  }, [fields, search]);

  const handleSelectAll = () => {
    filteredFields.forEach((field) => {
      setValue(`config.${findColumnIndex(field.col_name)}.drop_col`, true);
    });
  };

  const handleClear = () => {
    filteredFields.forEach((field) => {
      setValue(`config.${findColumnIndex(field.col_name)}.drop_col`, false);
    });
  };

  const onSubmit = async (formData: FormData) => {
    const selectedColumns = formData.config
      .filter((column) => column.drop_col)
      .map((column) => column.col_name);

    if (selectedColumns.length < 1) {
      setValid(false);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        op_type: operation.slug,
        config: { columns: selectedColumns },
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
    } catch (error) {
      console.error('Failed to save drop operation:', error);
    } finally {
      setLoading(false);
    }
  };

  const isViewOnly = action === 'view';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
      {/* Search */}
      <div className="px-3 pb-3">
        <div className="relative">
          <Input
            placeholder="Search Here"
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
            data-testid="searchDropColBar"
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {/* Header */}
      <div className="bg-gray-100 px-4 py-3 font-semibold text-sm">
        Column Name
      </div>

      {/* Validation Error */}
      {!valid && (
        <p className="text-red-500 text-sm px-3 py-2">
          Please select at least 1 column
        </p>
      )}

      {/* Select All / Clear */}
      <div className="flex justify-between px-3 py-3">
        <button
          type="button"
          onClick={handleSelectAll}
          className="text-sm font-semibold hover:underline"
          data-testid="selectAllDropColClick"
        >
          SELECT ALL
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="text-sm font-semibold hover:underline"
          data-testid="clearAllDropColClick"
        >
          CLEAR
        </button>
      </div>

      <hr className="mx-3" />

      {/* Column List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredFields.map((column, index) => {
          const colIndex = findColumnIndex(column.col_name);
          return (
            <Controller
              key={column.col_name}
              name={`config.${colIndex}.drop_col`}
              control={control}
              render={({ field }) => (
                <div
                  className={`flex items-center gap-2 px-3 py-2 ${
                    field.value ? 'bg-teal-50' : ''
                  }`}
                >
                  <Checkbox
                    data-testid={`checkBoxInputContainer${colIndex}`}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isViewOnly}
                  />
                  <span className="text-sm font-medium">{column.col_name}</span>
                </div>
              )}
            />
          );
        })}
      </div>

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
    "type": "dropcolumns",
    "config": {
      "columns": ["dropped_col_1", "dropped_col_2"],
      "source_columns": ["col1", "col2", "dropped_col_1", "dropped_col_2"]
    }
  }
}
```

To form data:
```typescript
{
  config: [
    { col_name: "col1", drop_col: false },
    { col_name: "col2", drop_col: false },
    { col_name: "dropped_col_1", drop_col: true },
    { col_name: "dropped_col_2", drop_col: true },
  ]
}
```

---

## Key Features

1. **Search filter**: Filters displayed columns by name
2. **Select All / Clear**: Bulk actions for filtered columns only
3. **Highlight selected**: Background color change for selected columns
4. **Validation**: At least one column must be selected

---

## Implementation Checklist

- [ ] Create form component
- [ ] Implement search filter
- [ ] Implement checkbox list with field array
- [ ] Implement Select All / Clear actions
- [ ] Build payload with columns array
- [ ] Handle edit mode initialization
- [ ] Handle view mode
- [ ] Add validation (at least 1 column)
- [ ] Style with Tailwind
