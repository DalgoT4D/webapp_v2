# FlattenJsonOpForm Specification

## Overview

Form for flattening a JSON column into separate columns.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationPanel/Forms/FlattenJsonOpForm.tsx` (~299 lines)

**v2 Target:** `webapp_v2/src/components/transform/forms/FlattenJsonOpForm.tsx`

**Complexity:** High

---

## Visual Design

```
┌─────────────────────────────────────┐
│ Select JSON Column                  │  (header)
├─────────────────────────────────────┤
│ [metadata                       ▼]  │
├─────────────────────────────────────┤
│ JSON Columns                        │  (header)
├─────────────────────────────────────┤
│ metadata.name                       │
│ metadata.email                      │
│ metadata.address.city               │
│ metadata.address.zip                │
├─────────────────────────────────────┤
│              [Save]                 │
└─────────────────────────────────────┘

(If no JSON columns found):
├─────────────────────────────────────┤
│ No JSON Columns found               │
└─────────────────────────────────────┘
```

---

## API Endpoints

### Fetch JSON Column Spec
```typescript
GET warehouse/dbt_project/json_columnspec/?source_schema={schema}&input_name={table}&json_column={column}
// Response: ["metadata.name", "metadata.email", "metadata.address.city", ...]
```

---

## Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| json_column | Autocomplete | Yes | Column containing JSON data |

The JSON columns to flatten are auto-detected and displayed.

---

## API Payload

### Create
```typescript
POST transform/v2/dbt_project/operations/nodes/
{
  "op_type": "flattenjson",
  "config": {
    "json_column": "metadata",
    "source_schema": "raw_data",
    "json_columns_to_copy": ["metadata.name", "metadata.email", "metadata.address.city"]
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
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Autocomplete } from '@/components/ui/autocomplete';
import { useColumnData } from '@/hooks/api/useColumnData';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import type { OperationFormProps, FlattenJsonDataConfig, DbtModelResponse } from '@/types/transform.types';

interface FormData {
  json_column: string;
}

export default function FlattenJsonOpForm({
  node,
  operation,
  action,
  continueOperationChain,
  setLoading,
}: OperationFormProps) {
  const [srcColumns, setSrcColumns] = useState<string[]>([]);
  const [jsonColumns, setJsonColumns] = useState<string[]>([]);
  const [inputModels, setInputModels] = useState<DbtModelResponse[]>([]);

  const { createOperation, editOperation } = useCanvasOperations();

  const { control, handleSubmit, reset } = useForm<FormData>({
    defaultValues: {
      json_column: '',
    },
  });

  const fetchAndSetSourceColumns = async () => {
    if (node) {
      if (['model', 'source'].includes(node.type || '')) {
        if (node.data.dbtmodel) {
          const response = await fetch(
            `/api/warehouse/table_columns/${node.data.dbtmodel.schema}/${node.data.dbtmodel.name}`
          );
          const data = await response.json();
          setSrcColumns(data.map((col: any) => col.name).sort((a, b) => a.localeCompare(b)));
        }
      }

      if (node.type === 'operation') {
        setSrcColumns(node.data.output_columns.sort((a, b) => a.localeCompare(b)));
      }
    }
  };

  const fetchJsonColumns = async (selectedColumn: string) => {
    try {
      const schema = action !== 'edit'
        ? node?.data?.dbtmodel?.schema
        : inputModels[0]?.schema;
      const table = action !== 'edit'
        ? node?.data?.dbtmodel?.name
        : inputModels[0]?.name;

      const response = await fetch(
        `/api/warehouse/dbt_project/json_columnspec/?source_schema=${schema}&input_name=${table}&json_column=${selectedColumn}`
      );
      const data = await response.json();
      setJsonColumns(data);
    } catch (error) {
      setJsonColumns([]);
      console.error(error);
    }
  };

  const fetchAndSetConfigForEdit = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/transform/v2/dbt_project/nodes/${node?.id}/`);
      const { operation_config, input_nodes } = await response.json();

      setInputModels(
        input_nodes
          ?.map((input: any) => input.dbtmodel)
          .filter((model: any): model is DbtModelResponse => model !== undefined) || []
      );

      const { source_columns, json_column, json_columns_to_copy }: FlattenJsonDataConfig =
        operation_config.config;

      setSrcColumns(source_columns);
      setJsonColumns(json_columns_to_copy);

      reset({ json_column });
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

  const onSubmit = async (formData: FormData) => {
    setLoading(true);
    try {
      const payload = {
        op_type: operation.slug,
        config: {
          json_column: formData.json_column,
          source_schema: node?.data?.dbtmodel?.schema,
          json_columns_to_copy: jsonColumns,
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
      console.error('Failed to save flatten JSON operation:', error);
    } finally {
      setLoading(false);
    }
  };

  const isViewOnly = action === 'view';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
      {/* JSON Column Header */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-4 py-3">
          <span className="font-semibold text-sm">Select JSON Column</span>
        </div>

        <div className="p-4">
          <Controller
            control={control}
            name="json_column"
            rules={{ required: 'JSON column is required' }}
            render={({ field, fieldState }) => (
              <Autocomplete
                {...field}
                data-testid="jsonColumn"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                disabled={isViewOnly}
                options={srcColumns}
                onChange={(value) => {
                  field.onChange(value);
                  if (value) {
                    fetchJsonColumns(value);
                  }
                }}
                placeholder="Select column containing JSON"
              />
            )}
          />
        </div>

        {/* JSON Columns Display */}
        {jsonColumns.length > 0 && (
          <>
            <div className="bg-gray-100 px-4 py-3 border-t">
              <span className="font-semibold text-sm">JSON Columns</span>
            </div>
            {jsonColumns.map((column, index) => (
              <div key={index} className="px-4 py-2 border-t text-sm">
                {column}
              </div>
            ))}
          </>
        )}

        {/* No JSON Columns Found */}
        {jsonColumns.length === 0 && (
          <div className="px-4 py-3 border-t">
            <span className="font-semibold text-sm text-muted-foreground">
              No JSON Columns found
            </span>
          </div>
        )}
      </div>

      {/* Submit */}
      {!isViewOnly && (
        <div className="p-4">
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
    "type": "flattenjson",
    "config": {
      "json_column": "metadata",
      "source_schema": "raw_data",
      "json_columns_to_copy": ["metadata.name", "metadata.email"],
      "source_columns": ["id", "metadata", "created_at"]
    }
  }
}
```

---

## Key Features

1. **Auto-detect JSON structure**: Fetches available JSON paths from API
2. **Display-only columns**: JSON columns shown but not editable
3. **Schema tracking**: Stores source_schema for proper resolution
4. **Empty state**: Shows message when no JSON structure found

---

## Implementation Checklist

- [ ] Create form component
- [ ] Implement JSON column selector
- [ ] Fetch JSON column spec on selection
- [ ] Display discovered JSON paths
- [ ] Handle empty JSON structure
- [ ] Build payload with json_columns_to_copy
- [ ] Handle edit mode initialization
- [ ] Handle view mode
- [ ] Add validation
- [ ] Style with Tailwind
