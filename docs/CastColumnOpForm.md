# CastColumnOpForm Specification

## Overview

Form for casting (changing data type of) one or more columns in a table.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationPanel/Forms/CastColumnOpForm.tsx` (~286 lines)

**v2 Target:** `webapp_v2/src/components/transform/forms/CastColumnOpForm.tsx`

**Complexity:** High

---

## Visual Design

```
┌─────────────────────────────────────┐
│ [🔍 Search Here                   ] │
├──────────────────┬──────────────────┤
│ Column name      │ Type             │  (header)
├──────────────────┼──────────────────┤
│ customer_id      │ [VARCHAR    ▼]   │
│ order_date       │ [DATE       ▼]   │
│ amount           │ [DECIMAL    ▼]   │
│ ...              │ ...              │
├──────────────────┴──────────────────┤
│              [Save]                 │
└─────────────────────────────────────┘
```

---

## Form Fields

| Field | Type | Required | Options |
|-------|------|----------|---------|
| config[].name | Input | Read-only | Column name |
| config[].data_type | Autocomplete | No | Data types from API |

---

## API Endpoints

### Fetch Data Types
```typescript
GET transform/dbt_project/data_type/
// Response: ["VARCHAR", "INTEGER", "DECIMAL", "DATE", "TIMESTAMP", ...]
```

### Create
```typescript
POST transform/v2/dbt_project/operations/nodes/
{
  "op_type": "castdatatypes",
  "config": {
    "columns": [
      { "columnname": "col1", "columntype": "VARCHAR" },
      { "columnname": "col2", "columntype": "INTEGER" }
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
import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Autocomplete } from '@/components/ui/autocomplete';
import { useDataTypes, useColumnData } from '@/hooks/api/useColumnData';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import type { OperationFormProps, CastDataConfig } from '@/types/transform.types';

interface FormData {
  config: { name: string; data_type: string | null }[];
}

export default function CastColumnOpForm({
  node,
  operation,
  action,
  continueOperationChain,
  setLoading,
}: OperationFormProps) {
  const [configData, setConfigData] = useState<any[]>([]);
  const { dataTypes } = useDataTypes();
  const { createOperation, editOperation } = useCanvasOperations();

  const { control, handleSubmit, reset, getValues, setValue, register } = useForm<FormData>({
    defaultValues: {
      config: [{ name: '', data_type: null }],
    },
  });

  const config = getValues().config;

  const fetchAndSetSourceColumns = async () => {
    if (node) {
      // For source/model nodes, fetch column data with types
      if (['source', 'model'].includes(node.type || '')) {
        if (node.data.dbtmodel) {
          const response = await fetch(
            `/api/warehouse/table_columns/${node.data.dbtmodel.schema}/${node.data.dbtmodel.name}`
          );
          const columnData = await response.json();
          setValue('config', columnData);
        }
      }

      // For operation nodes, use output_columns
      if (node.type === 'operation') {
        setValue(
          'config',
          node.data.output_columns.map((col: string) => ({ name: col, data_type: null }))
        );
      }
    }
  };

  const fetchAndSetConfigForEdit = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/transform/v2/dbt_project/nodes/${node?.id}/`);
      const { operation_config } = await response.json();

      const { columns }: CastDataConfig = operation_config.config;

      reset({
        config: columns.map((col) => ({
          name: col.columnname,
          data_type: col.columntype,
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

  useEffect(() => {
    setConfigData(config);
  }, [config]);

  const handleSearch = (value: string) => {
    const trimmed = value?.toLowerCase();
    const filtered = config?.filter((ele) =>
      ele?.name?.toLowerCase().includes(trimmed)
    );
    setConfigData(filtered);
  };

  const findColumnIndex = (columnName: string) => {
    const index = config?.findIndex((column) => column.name === columnName);
    return index === -1 ? 0 : index;
  };

  const onSubmit = async (formData: FormData) => {
    const sourceColumnNames = config.map((column) => column.name);
    const columnsTocast = formData.config
      .filter((data) => data.name && data.data_type)
      .map((data) => ({
        columnname: data.name,
        columntype: data.data_type,
      }));

    if (columnsTocast.length === 0) {
      // Show error toast
      return;
    }

    setLoading(true);
    try {
      const payload = {
        op_type: operation.slug,
        config: { columns: columnsTocast },
        source_columns: sourceColumnNames,
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
      console.error('Failed to save cast operation:', error);
    } finally {
      setLoading(false);
    }
  };

  const isViewOnly = action === 'view';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
      {/* Search */}
      <div className="px-3 pb-3">
        <Input
          placeholder="Search Here"
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-2 gap-4 bg-gray-100 px-4 py-3">
        <span className="font-semibold text-sm">Column name</span>
        <span className="font-semibold text-sm">Type</span>
      </div>

      {/* Table Body */}
      <div className="max-h-96 overflow-y-auto">
        {configData?.map((column, index) => {
          const colIndex = findColumnIndex(column.name);
          return (
            <div key={column.name} className="grid grid-cols-2 gap-4 px-4 py-2 border-b">
              <Input
                data-testid={`columnName${colIndex}`}
                value={column.name}
                disabled
                className="bg-transparent border-none"
              />
              <Controller
                control={control}
                name={`config.${colIndex}.data_type`}
                render={({ field }) => (
                  <Autocomplete
                    {...field}
                    data-testid={`type${colIndex}`}
                    disabled={isViewOnly}
                    options={dataTypes}
                    placeholder="Select type"
                  />
                )}
              />
            </div>
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
    "type": "castdatatypes",
    "config": {
      "columns": [
        { "columnname": "customer_id", "columntype": "VARCHAR" },
        { "columnname": "amount", "columntype": "DECIMAL" }
      ],
      "source_columns": ["customer_id", "order_date", "amount"]
    }
  }
}
```

---

## Key Features

1. **Fetch data types from API**: Warehouse-specific types
2. **Search filter**: Filter columns by name
3. **Only cast selected**: Only columns with data_type set are included in payload
4. **Source/Model vs Operation**: Different column fetching logic

---

## Implementation Checklist

- [ ] Create form component
- [ ] Fetch data types from API
- [ ] Implement search filter
- [ ] Implement grid table with autocomplete
- [ ] Build payload with columns array
- [ ] Handle edit mode initialization
- [ ] Handle view mode
- [ ] Add validation (at least 1 cast)
- [ ] Style with Tailwind
