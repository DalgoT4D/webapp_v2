# WhereFilterOpForm Specification

## Overview

Form for filtering rows based on a WHERE condition.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationPanel/Forms/WhereFilterOpForm.tsx` (~403 lines)

**v2 Target:** `webapp_v2/src/components/transform/forms/WhereFilterOpForm.tsx`

**Complexity:** High

---

## Visual Design

```
┌─────────────────────────────────────┐
│ Select column*                      │
│ [status                         ▼]  │
│                                     │
│ Select operation*                   │
│ [Equal To =                     ▼]  │
│                                     │
│ ○ Column  ● Value                   │
│ [active                           ] │
│                                     │
│ Advance Filter  [Toggle]  ℹ         │
│ (SQL input if enabled)              │
├─────────────────────────────────────┤
│              [Save]                 │
└─────────────────────────────────────┘
```

---

## Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| filterCol | Autocomplete | Yes* | Column to filter on |
| logicalOp | Autocomplete | Yes* | Comparison operator |
| operand.type | Radio | - | 'col' or 'val' |
| operand.col_val | Autocomplete | Conditional | Column if type='col' |
| operand.const_val | Input | Conditional | Value if type='val' |
| advanceFilter | Toggle | - | Enable SQL mode |
| sql_snippet | Textarea | Yes if advance | Raw SQL WHERE clause |

*Required only if advanceFilter is 'no'

---

## API Payload

### Create (Simple Mode)
```typescript
POST transform/v2/dbt_project/operations/nodes/
{
  "op_type": "where",
  "config": {
    "where_type": "and",
    "clauses": [{
      "column": "status",
      "operator": "=",
      "operand": { "value": "active", "is_col": false }
    }],
    "sql_snippet": ""
  },
  "input_node_uuid": "uuid-of-source-node",
  "source_columns": ["col1", "col2", "..."],
  "other_inputs": []
}
```

### Create (Advance Mode)
```typescript
{
  "config": {
    "where_type": "sql",
    "clauses": [],
    "sql_snippet": "status = 'active' AND amount > 100"
  }
}
```

---

## Implementation

```typescript
import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Autocomplete } from '@/components/ui/autocomplete';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { LogicalOperators } from './CaseWhenOpForm';
import { parseStringForNull } from '@/utils/common';
import type { OperationFormProps, WherefilterDataConfig } from '@/types/transform.types';

interface FormProps {
  filterCol: string;
  logicalOp: { id: string; label: string };
  operand: { type: string; col_val: string; const_val: string };
  advanceFilter: string;
  sql_snippet: string;
}

export default function WhereFilterOpForm({
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
      filterCol: '',
      logicalOp: { id: '', label: '' },
      operand: { type: 'col', col_val: '', const_val: '' },
      advanceFilter: 'no',
      sql_snippet: '',
    },
  });

  const radioValue = watch('operand.type');
  const advanceFilter = watch('advanceFilter');

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

      const { source_columns, clauses, sql_snippet, where_type }: WherefilterDataConfig =
        operation_config.config;
      setSrcColumns(source_columns);

      let clauseFields = {};
      if (clauses.length === 1) {
        const { column, operator, operand } = clauses[0];
        clauseFields = {
          filterCol: column,
          logicalOp: LogicalOperators.find((op) => op.id === operator),
          operand: operand
            ? {
                type: operand.is_col ? 'col' : 'val',
                col_val: operand.is_col ? operand.value : '',
                const_val: !operand.is_col ? operand.value : '',
              }
            : { type: 'col', col_val: '', const_val: '' },
        };
      }

      reset({
        ...clauseFields,
        advanceFilter: where_type === 'sql' ? 'yes' : 'no',
        sql_snippet: sql_snippet,
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
          where_type: data.advanceFilter === 'yes' ? 'sql' : 'and',
          clauses: [{
            column: data.filterCol,
            operator: data.logicalOp.id,
            operand: {
              value: data.operand.type === 'col'
                ? data.operand.col_val
                : parseStringForNull(data.operand.const_val),
              is_col: data.operand.type === 'col',
            },
          }],
          sql_snippet: data.sql_snippet,
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
      console.error('Failed to save where filter operation:', error);
    } finally {
      setLoading(false);
    }
  };

  const isNonAdvancedFieldsDisabled = advanceFilter === 'yes' || action === 'view';
  const isAdvanceFieldsDisabled = action === 'view';

  // Filter out 'between' for where filter (only used in case when)
  const filteredOperators = LogicalOperators.filter((op) => op.id !== 'between');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 pt-8 space-y-4">
      {/* Column Select */}
      <Controller
        control={control}
        name="filterCol"
        rules={{ required: advanceFilter === 'no' && 'Column is required' }}
        render={({ field, fieldState }) => (
          <Autocomplete
            {...field}
            data-testid="columnToCheck"
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
            options={srcColumns}
            disabled={isNonAdvancedFieldsDisabled}
            label="Select column*"
          />
        )}
      />

      {/* Operation Select */}
      <Controller
        control={control}
        name="logicalOp"
        rules={{
          validate: (value) =>
            advanceFilter !== 'no' || value.id !== '' || 'Operation is required',
        }}
        render={({ field, fieldState }) => (
          <Autocomplete
            {...field}
            data-testid="operation"
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
            options={filteredOperators}
            getOptionLabel={(opt) => opt.label}
            isOptionEqualToValue={(option, value) => option?.id === value?.id}
            disabled={isNonAdvancedFieldsDisabled}
            label="Select operation*"
          />
        )}
      />

      {/* Operand Type Radio */}
      <Controller
        name="operand.type"
        control={control}
        render={({ field }) => (
          <RadioGroup
            value={field.value}
            onValueChange={field.onChange}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="col" id="operand-col" disabled={isNonAdvancedFieldsDisabled} />
              <Label htmlFor="operand-col">Column</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="val" id="operand-val" disabled={isNonAdvancedFieldsDisabled} />
              <Label htmlFor="operand-val">Value</Label>
            </div>
          </RadioGroup>
        )}
      />

      {/* Operand Value */}
      {radioValue === 'col' ? (
        <Controller
          control={control}
          rules={{ required: advanceFilter === 'no' && 'Column is required' }}
          name="operand.col_val"
          render={({ field, fieldState }) => (
            <Autocomplete
              {...field}
              data-testid="checkAgainstColumn"
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              options={srcColumns}
              disabled={isNonAdvancedFieldsDisabled}
              placeholder="Select column*"
            />
          )}
        />
      ) : (
        <Controller
          control={control}
          name="operand.const_val"
          render={({ field, fieldState }) => (
            <Input
              {...field}
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              placeholder="Enter the value"
              disabled={isNonAdvancedFieldsDisabled}
            />
          )}
        />
      )}

      {/* Advance Filter Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Advance Filter</span>
          <Tooltip>
            <TooltipTrigger><Info className="w-4 h-4" /></TooltipTrigger>
            <TooltipContent>Enter the SQL WHERE clause directly</TooltipContent>
          </Tooltip>
        </div>
        <Controller
          name="advanceFilter"
          control={control}
          render={({ field }) => (
            <Switch
              disabled={isAdvanceFieldsDisabled}
              checked={field.value === 'yes'}
              onCheckedChange={(checked) => field.onChange(checked ? 'yes' : 'no')}
            />
          )}
        />
      </div>

      {/* SQL Snippet */}
      {advanceFilter === 'yes' && (
        <Controller
          control={control}
          name="sql_snippet"
          rules={{ required: 'Value is required' }}
          render={({ field, fieldState }) => (
            <Textarea
              {...field}
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              placeholder="Enter the WHERE clause (without WHERE keyword)"
              rows={4}
              disabled={isAdvanceFieldsDisabled}
            />
          )}
        />
      )}

      {/* Submit */}
      {!isAdvanceFieldsDisabled && (
        <div className="sticky bottom-0 bg-white pb-4">
          <Button
            type="submit"
            data-testid="savebutton"
            className="w-full"
            disabled={isAdvanceFieldsDisabled}
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

1. **Single clause**: Simpler than CaseWhen - only one condition
2. **No 'between'**: Filters out 'between' operator from options
3. **Advance mode**: Toggle to enter raw SQL WHERE clause
4. **Col vs Val**: Comparison value can be column or constant

---

## Implementation Checklist

- [ ] Create form component
- [ ] Implement column selector
- [ ] Implement operation selector (without 'between')
- [ ] Implement col/val radio toggle
- [ ] Implement advance filter toggle
- [ ] Build payload with clauses array
- [ ] Handle edit mode initialization
- [ ] Handle view mode
- [ ] Add validation
- [ ] Style with Tailwind
