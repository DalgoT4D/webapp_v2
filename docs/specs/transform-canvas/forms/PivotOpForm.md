# PivotOpForm Specification

## Overview

Form for pivoting (transposing) data - converting row values into columns.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationPanel/Forms/PivotOpForm.tsx` (~442 lines)

**v2 Target:** `webapp_v2/src/components/transform/forms/PivotOpForm.tsx`

**Complexity:** High

---

## Visual Design

```
┌─────────────────────────────────────┐
│ Select Column to pivot on*          │
│ [category                       ▼]  │
├─────────────────────────────────────┤
│ Column values to pivot on           │  (header)
├─────────────────────────────────────┤
│ [Electronics                      ] │  [×]
│ [Furniture                        ] │  [×]
│ [Clothing                         ] │  [×]
│ [+ Add row]                         │
├─────────────────────────────────────┤
│ [🔍 Search by column name         ] │
├─────────────────────────────────────┤
│ Columns to groupby                  │  (header)
├─────────────────────────────────────┤
│ ☑ Select all                        │
│ ☐ customer_id                       │
│ ☑ region                            │
│ ☐ category (disabled - pivot col)   │
├─────────────────────────────────────┤
│              [Save]                 │
└─────────────────────────────────────┘
```

---

## Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| pivot_column_name | Autocomplete | Yes | Column whose values become columns |
| pivot_column_values[].col | Input | Yes (at least 1) | Values to pivot on |
| groupby_columns[].col | Display | - | Column name |
| groupby_columns[].is_checked | Checkbox | - | Include in groupby |

---

## API Payload

### Create
```typescript
POST transform/v2/dbt_project/operations/nodes/
{
  "op_type": "pivot",
  "config": {
    "pivot_column_name": "category",
    "pivot_column_values": ["Electronics", "Furniture", "Clothing"],
    "groupby_columns": ["customer_id", "region"]
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
import { Plus, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Autocomplete } from '@/components/ui/autocomplete';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import type { OperationFormProps, PivotDataConfig } from '@/types/transform.types';

interface FormProps {
  pivot_column_name: string;
  pivot_column_values: { col: string }[];
  groupby_columns: { col: string; is_checked: boolean }[];
}

export default function PivotOpForm({
  node,
  operation,
  action,
  continueOperationChain,
  setLoading,
}: OperationFormProps) {
  const [srcColumns, setSrcColumns] = useState<string[]>([]);
  const [colFieldData, setColFieldData] = useState<{ col: string; is_checked: boolean }[]>([]);
  const [selectAllCheckbox, setSelectAllCheckbox] = useState(false);

  const { createOperation, editOperation } = useCanvasOperations();

  const { control, register, handleSubmit, reset, watch, formState, setValue } = useForm<FormProps>({
    defaultValues: {
      pivot_column_name: '',
      pivot_column_values: [{ col: '' }],
      groupby_columns: [],
    },
  });

  const pivotColumn = watch('pivot_column_name');

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'pivot_column_values',
    rules: { minLength: { value: 2, message: 'At least one value is required' } },
  });

  const {
    fields: srcColFields,
    replace,
    update,
  } = useFieldArray({
    control,
    name: 'groupby_columns',
  });

  const fetchAndSetSourceColumns = () => {
    if (node) {
      const sorted = node.data.output_columns.sort((a: string, b: string) => a.localeCompare(b));
      setSrcColumns(sorted);
      const colData = sorted.map((col: string) => ({ col, is_checked: false }));
      setValue('groupby_columns', colData);
      setColFieldData(colData);
    }
  };

  const fetchAndSetConfigForEdit = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/transform/v2/dbt_project/nodes/${node?.id}/`);
      const { operation_config } = await response.json();

      const { groupby_columns, pivot_column_name, pivot_column_values, source_columns }: PivotDataConfig =
        operation_config.config;

      const sorted = source_columns.sort((a, b) => a.localeCompare(b));
      setSrcColumns(sorted);

      const groupbySourceColumns = sorted.map((col) => ({
        col,
        is_checked: groupby_columns.includes(col),
      }));

      reset({
        pivot_column_name,
        pivot_column_values: pivot_column_values.map((col) => ({ col })).concat([{ col: '' }]),
        groupby_columns: groupbySourceColumns,
      });
      setColFieldData(groupbySourceColumns);
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

  // Search handler
  const handleSearch = (value: string) => {
    const trimmed = value.toLowerCase();
    const filtered = srcColFields.filter((f) => f.col.toLowerCase().includes(trimmed));
    setColFieldData(filtered);
  };

  // Select all handler
  const handleSelectAll = (checked: boolean) => {
    const updatedFields = colFieldData.map((field) => ({
      col: field.col,
      is_checked: checked,
    }));
    setColFieldData(updatedFields);

    const mergedFields = srcColFields.map(
      (field) => updatedFields.find((u) => u.col === field.col) || field
    );
    replace(mergedFields);
  };

  // Single checkbox handler
  const handleUpdate = (checked: boolean, index: number) => {
    const field = colFieldData[index];
    const updated = colFieldData.map((f) =>
      f.col === field.col ? { ...f, is_checked: checked } : f
    );
    setColFieldData(updated);

    const originalIndex = srcColFields.findIndex((f) => f.col === field.col);
    update(originalIndex, { col: field.col, is_checked: checked });
  };

  // Update select all checkbox state
  useEffect(() => {
    if (colFieldData.length > 0) {
      const allChecked = colFieldData.every((f) => f.is_checked);
      setSelectAllCheckbox(allChecked);
    }
  }, [colFieldData]);

  const onSubmit = async (data: FormProps) => {
    setLoading(true);
    try {
      const groupbyColumns = data.groupby_columns
        .filter((c) => c.is_checked)
        .map((c) => c.col);

      const payload = {
        op_type: operation.slug,
        config: {
          pivot_column_name: data.pivot_column_name,
          pivot_column_values: data.pivot_column_values
            .filter((v) => v.col)
            .map((v) => v.col),
          groupby_columns: groupbyColumns,
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
      console.error('Failed to save pivot operation:', error);
    } finally {
      setLoading(false);
    }
  };

  const isViewOnly = action === 'view';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
      className="p-4 pt-8 space-y-4"
    >
      {/* Pivot Column Select */}
      <Controller
        control={control}
        name="pivot_column_name"
        rules={{ required: 'Pivot Column is required' }}
        render={({ field, fieldState }) => (
          <Autocomplete
            {...field}
            data-testid="pivot"
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
            disabled={isViewOnly}
            options={srcColumns}
            label="Select Column to pivot on*"
            onChange={(data) => {
              field.onChange(data);
              // Uncheck pivot column from groupby
              if (data) {
                const idx = srcColFields.findIndex((f) => f.col === data);
                if (idx >= 0) {
                  update(idx, { col: srcColFields[idx].col, is_checked: false });
                }
              }
            }}
          />
        )}
      />

      {/* Pivot Values Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-4 py-3 font-semibold text-sm">
          Column values to pivot on
        </div>
        {fields.map((field, idx) => (
          <div key={field.id} className="flex items-center gap-2 px-4 py-2 border-t">
            <Input
              data-testid={`columnValue${idx}`}
              disabled={isViewOnly}
              {...register(`pivot_column_values.${idx}.col`)}
              placeholder="Enter value"
              onKeyDown={(e) => {
                if (e.key === 'Enter') append({ col: '' });
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

      {formState.errors.pivot_column_values?.root && (
        <p className="text-red-500 text-sm">
          {formState.errors.pivot_column_values.root.message}
        </p>
      )}

      {!isViewOnly && (
        <Button
          variant="outline"
          type="button"
          data-testid="addcase"
          onClick={() => append({ col: '' })}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add row
        </Button>
      )}

      {/* Search */}
      <div className="relative">
        <Input
          placeholder="Search by column name"
          onChange={(e) => handleSearch(e.target.value)}
          className="pr-10"
        />
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      </div>

      {/* Groupby Columns Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-4 py-3 font-semibold text-sm">
          Columns to groupby
        </div>
        {/* Select All */}
        <div className="flex items-center gap-2 px-4 py-2 border-t">
          <Checkbox
            checked={selectAllCheckbox}
            onCheckedChange={(checked) => handleSelectAll(!!checked)}
            disabled={isViewOnly}
          />
          <span className="font-semibold text-sm">Select all</span>
        </div>
        {/* Column List */}
        {colFieldData.map((field, idx) => (
          <div key={field.col} className="flex items-center gap-2 px-4 py-2 border-t">
            <Checkbox
              disabled={field.col === pivotColumn || isViewOnly}
              checked={field.is_checked}
              onCheckedChange={(checked) => handleUpdate(!!checked, idx)}
            />
            <span className="text-sm font-medium">{field.col}</span>
          </div>
        ))}
      </div>

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
    </form>
  );
}
```

---

## Key Features

1. **Pivot column**: Select which column's values become new columns
2. **Pivot values**: Specify which values to pivot on
3. **Groupby columns**: Select dimensions to group by
4. **Search filter**: Filter groupby column list
5. **Pivot column disabled**: Can't select pivot column in groupby

---

## Implementation Checklist

- [ ] Create form component
- [ ] Implement pivot column selector
- [ ] Implement pivot values input with add/remove
- [ ] Implement groupby column checkboxes with search
- [ ] Implement select all functionality
- [ ] Disable pivot column in groupby list
- [ ] Build payload with all three arrays
- [ ] Handle edit mode initialization
- [ ] Handle view mode
- [ ] Add validation
- [ ] Style with Tailwind
