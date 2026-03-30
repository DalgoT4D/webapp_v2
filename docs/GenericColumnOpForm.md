# GenericColumnOpForm Specification

## Overview

Form for applying a custom SQL function to create a computed column.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationPanel/Forms/GenericColumnOpForm.tsx` (~374 lines)

**v2 Target:** `webapp_v2/src/components/transform/forms/GenericColumnOpForm.tsx`

**Complexity:** Medium

---

## Visual Design

```
┌─────────────────────────────────────┐
│ Function*                           │
│ [CONCAT                           ] │
│                                     │
│ ○ Column  ● Value                   │
│ [first_name                     ▼]  │
│ [+ Add operand]  [Remove]           │
│                                     │
│ ○ Column  ● Value                   │
│ [' '                              ] │
│ [+ Add operand]  [Remove]           │
│                                     │
│ ○ Column  ● Value                   │
│ [last_name                      ▼]  │
│ [+ Add operand]  [Remove]           │
│                                     │
│ Output Column Name*                 │
│ [full_name                        ] │
├─────────────────────────────────────┤
│              [Save]                 │
└─────────────────────────────────────┘
```

---

## Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| computed_columns[0].function_name | Input | Yes | SQL function name |
| computed_columns[0].operands[].type | Radio | - | 'col' or 'val' |
| computed_columns[0].operands[].col_val | Autocomplete | Conditional | Column if type='col' |
| computed_columns[0].operands[].const_val | Input | Conditional | Value if type='val' |
| computed_columns[0].output_column_name | Input | Yes | Result column name |

---

## API Payload

### Create
```typescript
POST transform/v2/dbt_project/operations/nodes/
{
  "op_type": "generic",
  "config": {
    "computed_columns": [{
      "function_name": "CONCAT",
      "operands": [
        { "is_col": true, "value": "first_name" },
        { "is_col": false, "value": " " },
        { "is_col": true, "value": "last_name" }
      ],
      "output_column_name": "full_name"
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { parseStringForNull } from '@/utils/common';
import type { OperationFormProps, GenericColDataConfig, GenericCol } from '@/types/transform.types';

interface FormProps {
  computed_columns: {
    function_name: string;
    operands: {
      type: string;
      col_val: string;
      const_val: string | undefined;
    }[];
    output_column_name: string;
  }[];
}

export default function GenericColumnOpForm({
  node,
  operation,
  action,
  continueOperationChain,
  setLoading,
}: OperationFormProps) {
  const [srcColumns, setSrcColumns] = useState<string[]>([]);
  const { createOperation, editOperation } = useCanvasOperations();

  const { control, handleSubmit, reset, watch } = useForm<FormProps>({
    defaultValues: {
      computed_columns: [{
        function_name: '',
        operands: [{ type: 'col', col_val: '', const_val: '' }],
        output_column_name: '',
      }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'computed_columns.0.operands',
    rules: {
      minLength: { value: 1, message: 'At least one operand is required' },
    },
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

      const { source_columns, computed_columns }: GenericColDataConfig =
        operation_config.config;
      setSrcColumns(source_columns);

      reset({
        computed_columns: computed_columns.map((item: GenericCol) => ({
          function_name: item.function_name,
          operands: item.operands.map((op) => ({
            type: op.is_col ? 'col' : 'val',
            col_val: op.is_col ? op.value : '',
            const_val: op.is_col ? undefined : op.value,
          })),
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
          computed_columns: data.computed_columns.map((item) => ({
            function_name: item.function_name,
            operands: item.operands.map((op) => ({
              is_col: op.type === 'col',
              value: op.type === 'col' ? op.col_val : parseStringForNull(op.const_val),
            })),
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
      console.error('Failed to save generic column operation:', error);
    } finally {
      setLoading(false);
    }
  };

  const isViewOnly = action === 'view';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 pt-8 space-y-4">
      {/* Function Name */}
      <Controller
        control={control}
        rules={{ required: 'Function name is required' }}
        name="computed_columns.0.function_name"
        render={({ field, fieldState }) => (
          <Input
            data-testid="function"
            {...field}
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
            disabled={isViewOnly}
            label="Function*"
            placeholder="Enter SQL function name (e.g., CONCAT, UPPER, LOWER)"
          />
        )}
      />

      {/* Add First Operand Button */}
      {fields.length === 0 && (
        <Button
          disabled={isViewOnly}
          variant="outline"
          type="button"
          data-testid="addoperand"
          onClick={() => append({ type: 'col', col_val: '', const_val: '' })}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add operand
        </Button>
      )}

      {/* Operands */}
      {fields.map((field, index) => {
        const radioValue = watch(`computed_columns.0.operands.${index}.type`);
        return (
          <div key={field.id} className="space-y-4 pt-4 border-t">
            <Controller
              name={`computed_columns.0.operands.${index}.type`}
              control={control}
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="col" id={`col-${index}`} disabled={isViewOnly} />
                    <Label htmlFor={`col-${index}`}>Column</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="val" id={`val-${index}`} disabled={isViewOnly} />
                    <Label htmlFor={`val-${index}`}>Value</Label>
                  </div>
                </RadioGroup>
              )}
            />

            {radioValue === 'col' ? (
              <Controller
                control={control}
                rules={{ required: 'Column is required' }}
                name={`computed_columns.0.operands.${index}.col_val`}
                render={({ field, fieldState }) => (
                  <Autocomplete
                    {...field}
                    data-testid={`column${index}`}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    disabled={isViewOnly}
                    placeholder="Select column"
                    options={srcColumns}
                  />
                )}
              />
            ) : (
              <Controller
                control={control}
                name={`computed_columns.0.operands.${index}.const_val`}
                render={({ field, fieldState }) => (
                  <Input
                    {...field}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    placeholder="Enter a numeric or string value"
                    disabled={isViewOnly}
                  />
                )}
              />
            )}

            {/* Add/Remove Buttons */}
            <div className="flex gap-2">
              {index === fields.length - 1 && (
                <Button
                  disabled={isViewOnly}
                  variant="outline"
                  type="button"
                  data-testid="addoperand"
                  onClick={() => append({ type: 'col', col_val: '', const_val: '' })}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add operand
                </Button>
              )}
              <Button
                disabled={isViewOnly}
                variant="outline"
                type="button"
                data-testid="removeoperand"
                onClick={() => remove(index)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove
              </Button>
            </div>
          </div>
        );
      })}

      {/* Output Column Name */}
      <Controller
        control={control}
        rules={{ required: 'Output column name is required' }}
        name="computed_columns.0.output_column_name"
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
    </form>
  );
}
```

---

## Key Features

1. **Custom function**: User enters any SQL function name
2. **Flexible operands**: Add any number of column or constant operands
3. **Order matters**: Operands are passed in order to the function
4. **Single computed column**: Currently supports one computed column per operation

---

## Implementation Checklist

- [ ] Create form component
- [ ] Implement function name input
- [ ] Implement dynamic operands with col/val toggle
- [ ] Implement add/remove operand functionality
- [ ] Implement output column name
- [ ] Build payload with computed_columns array
- [ ] Handle edit mode initialization
- [ ] Handle view mode
- [ ] Add validation
- [ ] Style with Tailwind
