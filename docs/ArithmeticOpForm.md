# ArithmeticOpForm Specification

## Overview

Form for performing arithmetic operations (add, subtract, multiply, divide) on columns/values.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationPanel/Forms/ArithmeticOpForm.tsx` (~370 lines)

**v2 Target:** `webapp_v2/src/components/transform/forms/ArithmeticOpForm.tsx`

**Complexity:** High

---

## Visual Design

```
┌─────────────────────────────────────┐
│ Operation*                          │
│ [Addition +                     ▼]  │
│                                     │
│ ○ Column  ○ Value                   │
│ [price                          ▼]  │
│                                     │
│ ○ Column  ○ Value                   │
│ [tax_rate                       ▼]  │
│                                     │
│ [+ Add operand]                     │
│                                     │
│ Output Column Name*                 │
│ [total_price                      ] │
│                                     │
│ ℹ Please select only numeric columns│
├─────────────────────────────────────┤
│              [Save]                 │
└─────────────────────────────────────┘
```

---

## Arithmetic Operations

```typescript
const ArithmeticOperations = [
  { id: 'add', label: 'Addition +' },
  { id: 'div', label: 'Division /' },
  { id: 'sub', label: 'Subtraction -' },
  { id: 'mul', label: 'Multiplication *' },
];
```

---

## Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| arithmeticOp | Autocomplete | Yes | Operation type |
| operands[].type | Radio | - | 'col' or 'val' |
| operands[].col_val | Autocomplete | Conditional | Column name if type='col' |
| operands[].const_val | Input | Conditional | Numeric value if type='val' |
| output_column_name | Input | Yes | Result column name |

---

## API Payload

### Create
```typescript
POST transform/v2/dbt_project/operations/nodes/
{
  "op_type": "arithmetic",
  "config": {
    "operator": "add",
    "operands": [
      { "is_col": true, "value": "price" },
      { "is_col": false, "value": 10 }
    ],
    "output_column_name": "price_with_fee"
  },
  "input_node_uuid": "uuid-of-source-node",
  "source_columns": ["col1", "col2", "..."],
  "other_inputs": []
}
```

---

## Implementation

```typescript
import { useEffect, useState, useRef } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { Plus, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Autocomplete } from '@/components/ui/autocomplete';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import type { OperationFormProps, ArithmeticDataConfig } from '@/types/transform.types';

const ArithmeticOperations = [
  { id: 'add', label: 'Addition +' },
  { id: 'div', label: 'Division /' },
  { id: 'sub', label: 'Subtraction -' },
  { id: 'mul', label: 'Multiplication *' },
].sort((a, b) => a.label.localeCompare(b.label));

interface FormProps {
  arithmeticOp: { id: string; label: string } | null;
  operands: {
    type: string;
    col_val: string;
    const_val: number | undefined;
  }[];
  output_column_name: string;
}

export default function ArithmeticOpForm({
  node,
  operation,
  action,
  continueOperationChain,
  setLoading,
}: OperationFormProps) {
  const [srcColumns, setSrcColumns] = useState<string[]>([]);
  const { createOperation, editOperation } = useCanvasOperations();
  const skipEffectRef = useRef(false);

  const { control, handleSubmit, reset, watch, formState } = useForm<FormProps>({
    defaultValues: {
      arithmeticOp: null,
      operands: [
        { type: 'col', col_val: '', const_val: 0 },
        { type: 'col', col_val: '', const_val: 0 },
      ],
      output_column_name: '',
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'operands',
    rules: {
      minLength: { value: 2, message: 'At least two operands are required' },
    },
  });

  const arithmeticOp = watch('arithmeticOp');

  // Reset operands when operation changes (except during edit load)
  useEffect(() => {
    if (skipEffectRef.current) {
      skipEffectRef.current = false;
      return;
    }
    replace([
      { type: 'col', col_val: '', const_val: 0 },
      { type: 'col', col_val: '', const_val: 0 },
    ]);
  }, [arithmeticOp, replace]);

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

      const { operands, source_columns, operator, output_column_name }: ArithmeticDataConfig =
        operation_config.config;
      setSrcColumns(source_columns);

      skipEffectRef.current = true;
      reset({
        arithmeticOp: ArithmeticOperations.find((op) => op.id === operator),
        output_column_name: output_column_name,
        operands: operands.map((op) => ({
          type: op.is_col ? 'col' : 'val',
          col_val: op.is_col ? op.value : '',
          const_val: op.is_col ? undefined : op.value,
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
          operator: data.arithmeticOp?.id,
          operands: data.operands.map((op) => ({
            is_col: op.type === 'col',
            value: op.type === 'col' ? op.col_val : op.const_val,
          })),
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
      console.error('Failed to save arithmetic operation:', error);
    } finally {
      setLoading(false);
    }
  };

  const isViewOnly = action === 'view';

  // Can add operand logic: sub/div only allow 2 operands
  const canAddOperand =
    arithmeticOp &&
    ((['sub', 'div'].includes(arithmeticOp.id) && fields.length < 2) ||
      ['add', 'mul'].includes(arithmeticOp.id));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 pt-8 space-y-4">
      {/* Operation Select */}
      <Controller
        control={control}
        name="arithmeticOp"
        rules={{
          validate: (value) => (value && value?.id !== '') || 'Operation is required',
        }}
        render={({ field, fieldState }) => (
          <Autocomplete
            data-testid="operation"
            {...field}
            disabled={isViewOnly}
            placeholder="Select the operation*"
            options={ArithmeticOperations}
            getOptionLabel={(opt) => opt.label}
            isOptionEqualToValue={(option, value) => option?.id === value?.id}
            label="Operation*"
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
          />
        )}
      />

      {/* Operands */}
      {fields.map((field, index) => {
        const radioValue = watch(`operands.${index}.type`);
        return (
          <div key={field.id} className="space-y-4 pt-4">
            <Controller
              name={`operands.${index}.type`}
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
                name={`operands.${index}.col_val`}
                render={({ field, fieldState }) => (
                  <Autocomplete
                    data-testid={`column${index}`}
                    {...field}
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
                rules={{ required: 'Value is required' }}
                name={`operands.${index}.const_val`}
                render={({ field, fieldState }) => (
                  <Input
                    {...field}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    placeholder="Enter a numeric value"
                    type="number"
                    disabled={isViewOnly}
                  />
                )}
              />
            )}

            {/* Add/Remove Operand Buttons */}
            {canAddOperand && index === fields.length - 1 && (
              <Button
                disabled={isViewOnly}
                variant="outline"
                type="button"
                data-testid="addoperand"
                onClick={() => append({ type: 'col', col_val: '', const_val: undefined })}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add operand
              </Button>
            )}

            {index < fields.length - 1 && fields.length > 2 && (
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
            )}
          </div>
        );
      })}

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

      {/* Validation Error */}
      {formState.errors.operands?.root && (
        <p className="text-red-500 text-sm">
          {formState.errors.operands.root.message}
        </p>
      )}

      {/* Info Box */}
      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-md text-sm text-blue-700">
        <Info className="w-4 h-4" />
        Please select only numeric columns
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

1. **Operation-based limits**: Sub/div allow only 2 operands, add/mul allow unlimited
2. **Column or Value**: Each operand can be a column reference or constant
3. **Reset on operation change**: Operands reset when operation changes (except edit)
4. **Numeric validation**: Info box reminds to use numeric columns

---

## Implementation Checklist

- [ ] Create form component
- [ ] Implement operation selector
- [ ] Implement dynamic operands with col/val toggle
- [ ] Implement add/remove operand logic per operation type
- [ ] Handle reset on operation change
- [ ] Build payload with operands array
- [ ] Handle edit mode initialization
- [ ] Handle view mode
- [ ] Add validation
- [ ] Style with Tailwind
