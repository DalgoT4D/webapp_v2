# UnpivotOpForm Specification

## Overview

Form for unpivoting (melting) data - converting columns into row values.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationPanel/Forms/UnpivotOpForm.tsx` (~456 lines)

**v2 Target:** `webapp_v2/src/components/transform/forms/UnpivotOpForm.tsx`

**Complexity:** High

---

## Visual Design

```
┌─────────────────────────────────────┐
│ [🔍 Search by column name         ] │
├─────────────────────────────────────┤
│ Columns to unpivot                  │  (header)
├─────────────────────────────────────┤
│ ☑ Select all                        │
│ ☑ jan_sales                         │
│ ☑ feb_sales                         │
│ ☑ mar_sales                         │
│ ☐ customer_id                       │
├─────────────────────────────────────┤
│ [🔍 Search by column name         ] │
├─────────────────────────────────────┤
│ Columns to keep in output table     │  (header)
├─────────────────────────────────────┤
│ ☐ Select all                        │
│ ☐ jan_sales                         │
│ ☐ feb_sales                         │
│ ☐ mar_sales                         │
│ ☑ customer_id                       │
├─────────────────────────────────────┤
│              [Save]                 │
└─────────────────────────────────────┘
```

---

## Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| unpivot_columns[].col | Display | - | Column name |
| unpivot_columns[].is_unpivot_checked | Checkbox | - | Include in unpivot |
| unpivot_columns[].is_exclude_checked | Checkbox | - | Keep in output (exclude) |
| unpivot_field_name | Input | - | Name for the column name field (default: 'col_name') |
| unpivot_value_name | Input | - | Name for the value field (default: 'value') |

---

## API Payload

### Create
```typescript
POST transform/v2/dbt_project/operations/nodes/
{
  "op_type": "unpivot",
  "config": {
    "unpivot_columns": ["jan_sales", "feb_sales", "mar_sales"],
    "exclude_columns": ["customer_id"],
    "unpivot_field_name": "col_name",
    "unpivot_value_name": "value"
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
import { useForm, useFieldArray } from 'react-hook-form';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import type { OperationFormProps, UnpivotDataConfig } from '@/types/transform.types';

interface FormProps {
  unpivot_field_name: string;
  unpivot_value_name: string;
  unpivot_columns: {
    col: string;
    is_unpivot_checked: boolean;
    is_exclude_checked: boolean;
  }[];
}

export default function UnpivotOpForm({
  node,
  operation,
  action,
  continueOperationChain,
  setLoading,
}: OperationFormProps) {
  const [srcColumns, setSrcColumns] = useState<string[]>([]);
  const [searchUnpivot, setSearchUnpivot] = useState('');
  const [searchExclude, setSearchExclude] = useState('');
  const [selectAllCheckbox, setSelectAllCheckbox] = useState({
    is_unpivot: false,
    is_exclude: false,
  });

  const { createOperation, editOperation } = useCanvasOperations();

  const { control, handleSubmit, reset, setValue, formState, setError } = useForm<FormProps>({
    defaultValues: {
      unpivot_field_name: 'col_name',
      unpivot_value_name: 'value',
      unpivot_columns: [],
    },
  });

  const { fields: unpivotColFields, replace: unpivotColReplace } = useFieldArray({
    control,
    name: 'unpivot_columns',
  });

  const fetchAndSetSourceColumns = () => {
    if (node) {
      setSrcColumns(node.data.output_columns);
      const colFields = node.data.output_columns
        .sort((a, b) => a.localeCompare(b))
        .map((col: string) => ({
          col,
          is_unpivot_checked: false,
          is_exclude_checked: false,
        }));
      setValue('unpivot_columns', colFields);
    }
  };

  const fetchAndSetConfigForEdit = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/transform/v2/dbt_project/nodes/${node?.id}/`);
      const { operation_config } = await response.json();

      const {
        source_columns,
        exclude_columns,
        unpivot_columns,
        unpivot_field_name,
        unpivot_value_name,
      }: UnpivotDataConfig = operation_config.config;

      setSrcColumns(source_columns);
      const sorted = source_columns.sort((a, b) => a.localeCompare(b));
      const colFields = sorted.map((col) => ({
        col,
        is_unpivot_checked: unpivot_columns.includes(col),
        is_exclude_checked: exclude_columns.includes(col),
      }));

      reset({
        unpivot_field_name,
        unpivot_value_name,
        unpivot_columns: colFields,
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

  // Filtered columns based on search
  const filteredUnpivotColumns = unpivotColFields.filter((c) =>
    c.col.toLowerCase().includes(searchUnpivot.toLowerCase())
  );
  const filteredExcludeColumns = unpivotColFields.filter((c) =>
    c.col.toLowerCase().includes(searchExclude.toLowerCase())
  );

  // Handle checkbox update - mutually exclusive
  const handleUnpivotColUpdate = (checked: boolean, columnName: string, isExclude: boolean) => {
    const updatedFields = unpivotColFields.map((field) => {
      if (field.col === columnName) {
        return {
          ...field,
          is_unpivot_checked: isExclude ? (checked ? false : field.is_unpivot_checked) : checked,
          is_exclude_checked: isExclude ? checked : (checked ? false : field.is_exclude_checked),
        };
      }
      return field;
    });
    unpivotColReplace(updatedFields);
  };

  // Select all handler
  const handleSelectAll = (checked: boolean, isExclude: boolean) => {
    const updatedFields = unpivotColFields.map((field) => ({
      col: field.col,
      is_unpivot_checked: isExclude ? false : checked,
      is_exclude_checked: isExclude ? checked : false,
    }));
    unpivotColReplace(updatedFields);
  };

  // Update select all checkbox state
  useEffect(() => {
    if (unpivotColFields.length > 0) {
      const allUnpivot = unpivotColFields.every((f) => f.is_unpivot_checked);
      const allExclude = unpivotColFields.every((f) => f.is_exclude_checked);
      setSelectAllCheckbox({ is_unpivot: allUnpivot, is_exclude: allExclude });
    }
  }, [unpivotColFields]);

  const onSubmit = async (data: FormProps) => {
    const unpivotCols = data.unpivot_columns.filter((c) => c.is_unpivot_checked).map((c) => c.col);

    if (unpivotCols.length === 0) {
      setError('unpivot_columns', { type: 'manual', message: 'At least one column required to unpivot' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        op_type: operation.slug,
        config: {
          unpivot_columns: unpivotCols,
          unpivot_field_name: data.unpivot_field_name,
          unpivot_value_name: data.unpivot_value_name,
          exclude_columns: data.unpivot_columns.filter((c) => c.is_exclude_checked).map((c) => c.col),
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
      console.error('Failed to save unpivot operation:', error);
    } finally {
      setLoading(false);
    }
  };

  const isViewOnly = action === 'view';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 pt-8 space-y-4">
      {/* Search Unpivot */}
      <div className="relative">
        <Input
          placeholder="Search by column name for unpivot"
          onChange={(e) => setSearchUnpivot(e.target.value)}
          className="pr-10"
        />
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      </div>

      {/* Unpivot Columns Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-4 py-3 font-semibold text-sm">
          Columns to unpivot
        </div>
        <div className="flex items-center gap-2 px-4 py-2 border-t">
          <Checkbox
            checked={selectAllCheckbox.is_unpivot}
            onCheckedChange={(checked) => {
              handleSelectAll(!!checked, false);
              setSelectAllCheckbox({
                is_unpivot: !!checked,
                is_exclude: checked ? false : selectAllCheckbox.is_exclude,
              });
            }}
            disabled={isViewOnly}
          />
          <span className="font-semibold text-sm">Select all</span>
        </div>
        {filteredUnpivotColumns.map((field, idx) => (
          <div key={field.col} className="flex items-center gap-2 px-4 py-2 border-t">
            <Checkbox
              data-testid={`unpivotColumn${idx}`}
              disabled={isViewOnly}
              checked={field.is_unpivot_checked}
              onCheckedChange={(checked) => handleUnpivotColUpdate(!!checked, field.col, false)}
            />
            <span className="text-sm font-medium">{field.col}</span>
          </div>
        ))}
      </div>

      {formState.errors.unpivot_columns?.message && (
        <p className="text-red-500 text-sm">
          {formState.errors.unpivot_columns.message}
        </p>
      )}

      {/* Search Exclude */}
      <div className="relative">
        <Input
          placeholder="Search by column name in output"
          onChange={(e) => setSearchExclude(e.target.value)}
          className="pr-10"
        />
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      </div>

      {/* Exclude Columns Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-4 py-3 font-semibold text-sm">
          Columns to keep in output table
        </div>
        <div className="flex items-center gap-2 px-4 py-2 border-t">
          <Checkbox
            checked={selectAllCheckbox.is_exclude}
            onCheckedChange={(checked) => {
              setSelectAllCheckbox({
                is_unpivot: checked ? false : selectAllCheckbox.is_unpivot,
                is_exclude: !!checked,
              });
              handleSelectAll(!!checked, true);
            }}
            disabled={isViewOnly}
          />
          <span className="font-semibold text-sm">Select all</span>
        </div>
        {filteredExcludeColumns.map((field, idx) => (
          <div key={field.col} className="flex items-center gap-2 px-4 py-2 border-t">
            <Checkbox
              disabled={isViewOnly}
              checked={field.is_exclude_checked}
              onCheckedChange={(checked) => handleUnpivotColUpdate(!!checked, field.col, true)}
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

1. **Two checkbox lists**: Unpivot columns and exclude (keep) columns
2. **Mutually exclusive**: A column can only be in one list
3. **Separate searches**: Each list has its own search filter
4. **Select all per list**: Separate select all for each category
5. **Default output names**: 'col_name' and 'value' used by default

---

## Implementation Checklist

- [ ] Create form component
- [ ] Implement two checkbox column lists
- [ ] Implement mutually exclusive selection logic
- [ ] Implement separate search filters
- [ ] Implement select all for each list
- [ ] Build payload with unpivot_columns and exclude_columns
- [ ] Handle edit mode initialization
- [ ] Handle view mode
- [ ] Add validation (at least 1 unpivot column)
- [ ] Style with Tailwind
