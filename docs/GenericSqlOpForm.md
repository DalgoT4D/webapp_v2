# GenericSqlOpForm Specification

## Overview

Form for writing custom SQL SELECT statements.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationPanel/Forms/GenericSqlOpForm.tsx` (~198 lines)

**v2 Target:** `webapp_v2/src/components/transform/forms/GenericSqlOpForm.tsx`

**Complexity:** Medium

---

## Visual Design

```
┌─────────────────────────────────────┐
│ SELECT ℹ                            │
│ ┌─────────────────────────────────┐ │
│ │ column_a,                       │ │
│ │ column_b,                       │ │
│ │ column_a + column_b AS total    │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ FROM {input_table}                  │
│ ┌─────────────────────────────────┐ │
│ │ WHERE active = true             │ │
│ │ ORDER BY created_at DESC        │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│              [Save]                 │
└─────────────────────────────────────┘
```

---

## Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sql_statement_1 | Textarea | Yes | SELECT clause columns |
| sql_statement_2 | Textarea | No | Additional clauses (WHERE, ORDER BY, etc.) |

---

## API Payload

### Create
```typescript
POST transform/v2/dbt_project/operations/nodes/
{
  "op_type": "rawsql",
  "config": {
    "sql_statement_1": "column_a, column_b, column_a + column_b AS total",
    "sql_statement_2": "WHERE active = true ORDER BY created_at DESC"
  },
  "input_node_uuid": "uuid-of-source-node",
  "source_columns": [],
  "other_inputs": []
}
```

---

## Implementation

```typescript
import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import type { OperationFormProps, GenericDataConfig, DbtModelResponse } from '@/types/transform.types';

interface FormData {
  sql_statement_1: string;
  sql_statement_2: string;
}

export default function GenericSqlOpForm({
  node,
  operation,
  action,
  continueOperationChain,
  setLoading,
}: OperationFormProps) {
  const [inputModels, setInputModels] = useState<DbtModelResponse[]>([]);
  const { createOperation, editOperation } = useCanvasOperations();

  const { control, handleSubmit, reset } = useForm<FormData>({
    defaultValues: {
      sql_statement_1: '',
      sql_statement_2: '',
    },
  });

  // Determine input table name for display
  let inputName = '';
  if (inputModels.length > 0) {
    inputName = inputModels[0].name;
  } else {
    inputName = 'chained'; // Operations chained from previous operation
  }

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

      const { sql_statement_1, sql_statement_2 }: GenericDataConfig =
        operation_config.config;

      reset({
        sql_statement_1,
        sql_statement_2,
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
    }
  }, [node]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const payload = {
        op_type: operation.slug,
        config: {
          sql_statement_1: data.sql_statement_1,
          sql_statement_2: data.sql_statement_2,
        },
        source_columns: [],
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
      console.error('Failed to save raw SQL operation:', error);
    } finally {
      setLoading(false);
    }
  };

  const isViewOnly = action === 'view';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 pt-8 space-y-4">
      {/* SELECT Statement */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>SELECT</Label>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-4 h-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              Enter the columns to select. Do not include the SELECT keyword.
            </TooltipContent>
          </Tooltip>
        </div>
        <Controller
          control={control}
          rules={{ required: 'SQL statement is required' }}
          name="sql_statement_1"
          render={({ field, fieldState }) => (
            <Textarea
              {...field}
              rows={4}
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              disabled={isViewOnly}
              placeholder="column_a, column_b, column_a + column_b AS total"
            />
          )}
        />
      </div>

      {/* FROM + Additional Clauses */}
      <div className="space-y-2">
        <Label>FROM {inputName}</Label>
        <Controller
          control={control}
          name="sql_statement_2"
          render={({ field, fieldState }) => (
            <Textarea
              {...field}
              rows={4}
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              disabled={isViewOnly}
              placeholder="WHERE active = true ORDER BY created_at DESC"
            />
          )}
        />
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

## Edit Mode Config Mapping

From API response:
```typescript
{
  "operation_config": {
    "type": "rawsql",
    "config": {
      "sql_statement_1": "col_a, col_b",
      "sql_statement_2": "WHERE status = 'active'"
    }
  }
}
```

---

## Key Features

1. **Two-part SQL**: SELECT columns separate from WHERE/ORDER BY
2. **Dynamic FROM**: Shows input table name from previous node
3. **No source_columns**: Raw SQL doesn't use source_columns tracking
4. **Flexible queries**: Support any valid SQL SELECT

---

## Implementation Checklist

- [ ] Create form component
- [ ] Implement SELECT textarea with tooltip
- [ ] Implement FROM label with dynamic input name
- [ ] Implement additional clauses textarea
- [ ] Build payload with sql_statement_1/2
- [ ] Handle edit mode initialization
- [ ] Handle view mode
- [ ] Add validation
- [ ] Style with Tailwind
