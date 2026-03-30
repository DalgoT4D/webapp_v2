# CaseWhenOpForm Specification

## Overview

Form for creating CASE WHEN conditional logic with multiple when/then clauses.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationPanel/Forms/CaseWhenOpForm.tsx` (~822 lines)

**v2 Target:** `webapp_v2/src/components/transform/forms/CaseWhenOpForm.tsx`

**Complexity:** Very High - Most complex form

---

## Visual Design

```
┌─────────────────────────────────────┐
│ CASE 01                             │
│ When ℹ                              │
│ [status                         ▼]  │
│                                     │
│ [Equal To =                     ▼]  │
│                                     │
│ ○ Column  ● Value                   │
│ [active                           ] │
│                                     │
│ Then ℹ                              │
│ ○ Column  ● Value                   │
│ [Active Status                    ] │
│                                     │
│ [Remove case 1]                     │
├─────────────────────────────────────┤
│ [+ Add case 2]                      │
├─────────────────────────────────────┤
│ Else ℹ                              │
│ ○ Column  ● Value                   │
│ [Unknown                          ] │
│                                     │
│ Output Column Name*                 │
│ [status_label                     ] │
│                                     │
│ Advance Filter  [Toggle]            │
│ (SQL input if enabled)              │
├─────────────────────────────────────┤
│              [Save]                 │
└─────────────────────────────────────┘
```

---

## Logical Operators

```typescript
export const LogicalOperators = [
  { id: 'between', label: 'Between' },
  { id: '=', label: 'Equal To =' },
  { id: '>=', label: 'Greater Than or Equal To >=' },
  { id: '>', label: 'Greater Than >' },
  { id: '<', label: 'Less Than <' },
  { id: '<=', label: 'Less Than or Equal To <=' },
  { id: '!=', label: 'Not Equal To !=' },
];
```

---

## Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| clauses[].filterCol | Autocomplete | Yes* | Column to check |
| clauses[].logicalOp | Autocomplete | Yes* | Comparison operator |
| clauses[].operands[].type | Radio | - | 'col' or 'val' |
| clauses[].operands[].col_val | Autocomplete | Conditional | Column if type='col' |
| clauses[].operands[].const_val | Input | Conditional | Value if type='val' |
| clauses[].then.type | Radio | - | 'col' or 'val' |
| clauses[].then.col_val | Autocomplete | Conditional | Column if type='col' |
| clauses[].then.const_val | Input | Conditional | Value if type='val' |
| else.type | Radio | - | 'col' or 'val' |
| else.col_val | Autocomplete | Conditional | Column |
| else.const_val | Input | Conditional | Value |
| output_column_name | Input | Yes | Result column name |
| advanceFilter | Toggle | - | Enable SQL mode |
| sql_snippet | Textarea | Yes if advance | Raw SQL |

*Required only if advanceFilter is 'no'

---

## API Payload

### Create (Simple Mode)
```typescript
POST transform/v2/dbt_project/operations/nodes/
{
  "op_type": "casewhen",
  "config": {
    "case_type": "simple",
    "when_clauses": [
      {
        "column": "status",
        "operator": "=",
        "operands": [{ "value": "A", "is_col": false }],
        "then": { "value": "Active", "is_col": false }
      },
      {
        "column": "status",
        "operator": "=",
        "operands": [{ "value": "I", "is_col": false }],
        "then": { "value": "Inactive", "is_col": false }
      }
    ],
    "else_clause": { "value": "Unknown", "is_col": false },
    "sql_snippet": "",
    "output_column_name": "status_label"
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
    "case_type": "advance",
    "when_clauses": [],
    "else_clause": { "value": "", "is_col": false },
    "sql_snippet": "CASE WHEN status = 'A' THEN 'Active' ELSE 'Unknown' END",
    "output_column_name": "status_label"
  }
}
```

---

## Implementation

```typescript
import { useEffect, useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { Plus, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Autocomplete } from '@/components/ui/autocomplete';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { parseStringForNull } from '@/utils/common';
import type { OperationFormProps, CasewhenDataConfig, WhenClause, GenericOperand } from '@/types/transform.types';

export const LogicalOperators = [
  { id: 'between', label: 'Between' },
  { id: '=', label: 'Equal To =' },
  { id: '>=', label: 'Greater Than or Equal To >=' },
  { id: '>', label: 'Greater Than >' },
  { id: '<', label: 'Less Than <' },
  { id: '<=', label: 'Less Than or Equal To <=' },
  { id: '!=', label: 'Not Equal To !=' },
].sort((a, b) => a.label.localeCompare(b.label));

interface ClauseType {
  filterCol: string;
  logicalOp: { id: string; label: string } | null;
  operands: { type: string; col_val: string; const_val: string }[];
  then: { type: string; col_val: string; const_val: string };
}

interface FormProps {
  clauses: ClauseType[];
  else: { type: string; col_val: string; const_val: string };
  output_column_name: string;
  advanceFilter: string;
  sql_snippet: string;
}

export default function CaseWhenOpForm({
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
      clauses: [{
        filterCol: '',
        logicalOp: null,
        operands: [
          { type: 'val', col_val: '', const_val: '' },
          { type: 'val', col_val: '', const_val: '' },
        ],
        then: { type: 'val', col_val: '', const_val: '' },
      }],
      else: { type: 'val', col_val: '', const_val: '' },
      output_column_name: '',
      advanceFilter: 'no',
      sql_snippet: '',
    },
  });

  const { fields: clauseFields, append: appendClause, remove: removeClause } = useFieldArray({
    control,
    name: 'clauses',
  });

  const advanceFilter = watch('advanceFilter');
  const elseRadioValue = watch('else.type');

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

      const {
        source_columns,
        when_clauses,
        else_clause,
        sql_snippet,
        case_type,
        output_column_name,
      }: CasewhenDataConfig = operation_config.config;
      setSrcColumns(source_columns);

      const clauses = when_clauses.map((clause: WhenClause) => ({
        filterCol: clause.column,
        logicalOp: LogicalOperators.find((op) => op.id === clause.operator) || { id: '', label: '' },
        operands: clause.operands.map((op: GenericOperand) => ({
          type: op.is_col ? 'col' : 'val',
          col_val: op.is_col ? op.value : '',
          const_val: !op.is_col ? op.value : '',
        })),
        then: {
          type: clause.then.is_col ? 'col' : 'val',
          col_val: clause.then.is_col ? clause.then.value : '',
          const_val: !clause.then.is_col ? clause.then.value : '',
        },
      }));

      reset({
        clauses,
        else: {
          type: else_clause.is_col ? 'col' : 'val',
          col_val: else_clause.value,
          const_val: else_clause.value,
        },
        output_column_name,
        advanceFilter: case_type === 'advance' ? 'yes' : 'no',
        sql_snippet,
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
          case_type: data.advanceFilter === 'yes' ? 'advance' : 'simple',
          when_clauses: data.clauses.map((clause) => ({
            column: clause.filterCol,
            operands: clause.operands
              .map((op) => ({
                value: op.type === 'col' ? op.col_val : parseStringForNull(op.const_val),
                is_col: op.type === 'col',
              }))
              .slice(0, clause.logicalOp?.id === 'between' ? 2 : 1),
            then: {
              value: clause.then.type === 'col'
                ? clause.then.col_val
                : parseStringForNull(clause.then.const_val),
              is_col: clause.then.type === 'col',
            },
            operator: clause.logicalOp?.id,
          })),
          else_clause: {
            value: data.else.type === 'col'
              ? data.else.col_val
              : parseStringForNull(data.else.const_val),
            is_col: data.else.type === 'col',
          },
          sql_snippet: data.sql_snippet,
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
      console.error('Failed to save case when operation:', error);
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = advanceFilter === 'yes' || action === 'view';
  const isAdvanceFieldsDisabled = action === 'view';

  // Note: Full implementation would include ClauseOperands component
  // for handling the operand inputs within each clause
  // See v1 source for complete nested field array pattern

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="px-4 space-y-4">
      {/* Clauses */}
      {clauseFields.map((clauseField, clauseIndex) => {
        const thenRadioValue = watch(`clauses.${clauseIndex}.then.type`);
        const logicalOpVal = watch(`clauses.${clauseIndex}.logicalOp`);

        return (
          <div key={clauseField.id} className="space-y-4 pt-4 border-b pb-4">
            <div className="font-semibold text-gray-500">
              CASE {(clauseIndex + 1).toString().padStart(2, '0')}
            </div>

            {/* When Section */}
            <div className="flex items-center gap-2">
              <span>When</span>
              <Tooltip>
                <TooltipTrigger><Info className="w-4 h-4" /></TooltipTrigger>
                <TooltipContent>Select column, operation, and comparison value</TooltipContent>
              </Tooltip>
            </div>

            <Controller
              control={control}
              rules={{ required: advanceFilter === 'no' && 'Column is required' }}
              name={`clauses.${clauseIndex}.filterCol`}
              render={({ field, fieldState }) => (
                <Autocomplete
                  {...field}
                  data-testid="column"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  options={srcColumns}
                  disabled={isDisabled}
                  placeholder="Select column to condition on"
                />
              )}
            />

            <Controller
              control={control}
              rules={{
                validate: (value) =>
                  advanceFilter !== 'no' || value !== null || 'Operation is required',
              }}
              name={`clauses.${clauseIndex}.logicalOp`}
              render={({ field, fieldState }) => (
                <Autocomplete
                  {...field}
                  data-testid="operation"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  options={LogicalOperators}
                  getOptionLabel={(opt) => opt.label}
                  isOptionEqualToValue={(option, value) => option?.id === value?.id}
                  disabled={isDisabled}
                  placeholder="Select operation*"
                />
              )}
            />

            {/* Operand inputs would go here - simplified for spec */}
            {/* See ClauseOperands component in v1 for full implementation */}

            {/* Then Section */}
            <div className="flex items-center gap-2">
              <span>Then</span>
              <Tooltip>
                <TooltipTrigger><Info className="w-4 h-4" /></TooltipTrigger>
                <TooltipContent>The output when the case criterion is fulfilled</TooltipContent>
              </Tooltip>
            </div>

            <Controller
              name={`clauses.${clauseIndex}.then.type`}
              control={control}
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="col" id={`then-col-${clauseIndex}`} disabled={isDisabled} />
                    <Label htmlFor={`then-col-${clauseIndex}`}>Column</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="val" id={`then-val-${clauseIndex}`} disabled={isDisabled} />
                    <Label htmlFor={`then-val-${clauseIndex}`}>Value</Label>
                  </div>
                </RadioGroup>
              )}
            />

            {/* Then value input based on type */}
            {thenRadioValue === 'col' ? (
              <Controller
                control={control}
                name={`clauses.${clauseIndex}.then.col_val`}
                render={({ field }) => (
                  <Autocomplete {...field} options={srcColumns} disabled={isDisabled} placeholder="Select column" />
                )}
              />
            ) : (
              <Controller
                control={control}
                name={`clauses.${clauseIndex}.then.const_val`}
                render={({ field }) => (
                  <Input {...field} data-testid="thenInput" placeholder="Enter the value" disabled={isDisabled} />
                )}
              />
            )}

            {clauseFields.length > 1 && (
              <Button
                variant="destructive"
                type="button"
                data-testid="removecase"
                disabled={isDisabled}
                onClick={() => removeClause(clauseIndex)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove case {clauseIndex + 1}
              </Button>
            )}

            {clauseIndex === clauseFields.length - 1 && (
              <Button
                variant="outline"
                type="button"
                data-testid="addcase"
                disabled={isDisabled}
                onClick={() => appendClause({
                  filterCol: '',
                  logicalOp: { id: '', label: '' },
                  operands: [{ type: 'val', col_val: '', const_val: '' }],
                  then: { type: 'val', col_val: '', const_val: '' },
                })}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add case {clauseIndex + 2}
              </Button>
            )}
          </div>
        );
      })}

      {/* Else Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span>Else</span>
          <Tooltip>
            <TooltipTrigger><Info className="w-4 h-4" /></TooltipTrigger>
            <TooltipContent>Output if none of the cases are fulfilled</TooltipContent>
          </Tooltip>
        </div>

        <Controller
          name="else.type"
          control={control}
          render={({ field }) => (
            <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="col" id="else-col" disabled={isDisabled} />
                <Label htmlFor="else-col">Column</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="val" id="else-val" disabled={isDisabled} />
                <Label htmlFor="else-val">Value</Label>
              </div>
            </RadioGroup>
          )}
        />

        {elseRadioValue === 'col' ? (
          <Controller
            control={control}
            name="else.col_val"
            render={({ field }) => (
              <Autocomplete {...field} options={srcColumns} disabled={isDisabled} placeholder="Select column" />
            )}
          />
        ) : (
          <Controller
            control={control}
            name="else.const_val"
            render={({ field }) => (
              <Input {...field} placeholder="Enter the value" disabled={isDisabled} />
            )}
          />
        )}
      </div>

      {/* Output Column Name */}
      <Controller
        rules={{ required: 'Column name is required' }}
        control={control}
        name="output_column_name"
        render={({ field, fieldState }) => (
          <Input
            {...field}
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
            disabled={action === 'view'}
            label="Output Column Name*"
            placeholder="Enter column name"
          />
        )}
      />

      {/* Advance Filter Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Advance Filter</span>
          <Tooltip>
            <TooltipTrigger><Info className="w-4 h-4" /></TooltipTrigger>
            <TooltipContent>Enter the SQL statement directly</TooltipContent>
          </Tooltip>
        </div>
        <Controller
          name="advanceFilter"
          control={control}
          render={({ field }) => (
            <Switch
              disabled={action === 'view'}
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
              placeholder="Enter the SQL CASE WHEN statement"
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
            disabled={isAdvanceFieldsDisabled}
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

1. **Multiple cases**: Can add multiple when/then clauses
2. **Between operator**: Shows 2 operand inputs when 'between' selected
3. **Col vs Val toggle**: Each value can be column reference or constant
4. **Advance mode**: Toggle to enter raw SQL instead
5. **Else clause**: Default value when no cases match

---

## Implementation Checklist

- [ ] Create form component
- [ ] Implement clauses field array with add/remove
- [ ] Create ClauseOperands sub-component for nested operands
- [ ] Implement col/val radio toggles throughout
- [ ] Implement advance filter toggle
- [ ] Handle 'between' operator with 2 operands
- [ ] Build payload with when_clauses array
- [ ] Handle edit mode initialization
- [ ] Handle view mode
- [ ] Add validation
- [ ] Style with Tailwind
