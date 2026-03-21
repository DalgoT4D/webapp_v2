# CreateTableForm Specification

## Overview

Form for terminating an operation chain and creating a dbt model (table).

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationPanel/Forms/CreateTableForm.tsx` (~198 lines)

**v2 Target:** `webapp_v2/src/components/transform/forms/CreateTableForm.tsx`

**Complexity:** Medium

---

## Visual Design

```
┌─────────────────────────────────────┐
│ Output Name                         │
│ [customer_summary                 ] │
│                                     │
│ Output Schema Name*                 │
│ Choose from existing schemas or     │
│ type a name to create a new one     │
│ [production                     ▼]  │
│                                     │
│ Directory under models*             │
│ Choose from existing directories    │
│ or type a path to create new        │
│ folders (e.g., staging/orders)      │
│ [intermediate/                  ▼]  │
├─────────────────────────────────────┤
│              [Save]                 │
└─────────────────────────────────────┘
```

---

## API Endpoints

### Fetch Model Directories
```typescript
GET transform/v2/dbt_project/models_directories/
// Response: { "directories": ["", "intermediate", "production", "staging/orders"] }
```

### Terminate Chain
```typescript
POST transform/v2/dbt_project/operations/nodes/{node_id}/terminate/
{
  "name": "customer_summary",
  "display_name": "customer_summary",
  "dest_schema": "production",
  "rel_dir_to_models": "intermediate"
}
```

---

## Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| output_name | Input | Yes | Model/table name |
| dest_schema | Autocomplete (freeSolo) | Yes | Destination schema (can create new) |
| rel_dir_to_models | Autocomplete (freeSolo) | Yes | Directory path under models/ |

---

## Implementation

```typescript
import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Autocomplete } from '@/components/ui/autocomplete';
import { useCanvasStore } from '@/stores/canvasStore';
import { useModelDirectories } from '@/hooks/api/useColumnData';
import { toast } from 'sonner';
import type { OperationFormProps } from '@/types/transform.types';

interface FormData {
  output_name: string;
  dest_schema: string;
  rel_dir_to_models: string | { value: string; label: string };
}

export default function CreateTableForm({
  node,
  clearAndClosePanel,
  setLoading,
}: Omit<OperationFormProps, 'operation' | 'action' | 'continueOperationChain'>) {
  const { setCanvasAction } = useCanvasStore();
  const { directories, isLoading: loadingDirectories } = useModelDirectories();

  // Default values from existing node if is_last_in_chain
  const defaultValues = node?.data.is_last_in_chain
    ? {
        output_name: node?.data?.dbtmodel?.name || '',
        dest_schema: node?.data?.dbtmodel?.schema || '',
        rel_dir_to_models: '',
      }
    : { output_name: '', dest_schema: '', rel_dir_to_models: '' };

  const { control, register, handleSubmit, reset, formState } = useForm<FormData>({
    defaultValues,
  });

  const handleCreateTableAndRun = async (data: FormData) => {
    if (node?.type !== 'operation') return;

    try {
      const relDir = typeof data.rel_dir_to_models === 'string'
        ? data.rel_dir_to_models
        : data.rel_dir_to_models?.value || '';

      const response = await fetch(
        `/api/transform/v2/dbt_project/operations/nodes/${node.id}/terminate/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.output_name,
            display_name: data.output_name,
            dest_schema: data.dest_schema,
            rel_dir_to_models: relDir,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create table');
      }

      reset();
      setCanvasAction({ type: 'run-workflow', data: null });
      if (clearAndClosePanel) {
        clearAndClosePanel();
      }
    } catch (error: any) {
      console.error(error.message);
      toast.error(error.message);
    }
  };

  // Format directories for display
  const directoryOptions = directories.map((dir) => ({
    value: dir,
    label: dir === '' ? '/' : `${dir}/`,
  }));

  const schemaOptions = ['intermediate', 'production'];

  return (
    <form onSubmit={handleSubmit(handleCreateTableAndRun)} className="p-4 pt-8 space-y-4">
      {/* Output Name */}
      <div className="space-y-2">
        <Input
          {...register('output_name', { required: true })}
          label="Output Name"
          placeholder="Enter model name"
        />
        {formState.errors.output_name && (
          <p className="text-red-500 text-sm">Output name is required</p>
        )}
      </div>

      {/* Destination Schema */}
      <div className="space-y-2">
        <Controller
          control={control}
          name="dest_schema"
          rules={{ required: true }}
          render={({ field }) => (
            <Autocomplete
              {...field}
              freeSolo
              autoSelect
              options={schemaOptions}
              label={
                <div className="space-y-1">
                  <span>Output Schema Name*</span>
                  <p className="text-xs text-muted-foreground">
                    Choose from existing schemas or type a name to create a new one
                  </p>
                </div>
              }
              placeholder="Select existing or type to create new schema"
            />
          )}
        />
        {formState.errors.dest_schema && (
          <p className="text-red-500 text-sm">Output schema is required</p>
        )}
      </div>

      {/* Directory */}
      <div className="space-y-2">
        <Controller
          control={control}
          name="rel_dir_to_models"
          rules={{ required: true }}
          render={({ field }) => (
            <Autocomplete
              {...field}
              freeSolo
              autoSelect
              options={directoryOptions}
              loading={loadingDirectories}
              label={
                <div className="space-y-1">
                  <span>Directory under models*</span>
                  <p className="text-xs text-muted-foreground">
                    Choose from existing directories or type a path to create new folders
                    (e.g., staging/orders)
                  </p>
                </div>
              }
              placeholder="Select existing or type to create new directory"
              getOptionLabel={(option) =>
                typeof option === 'string' ? option : option.label
              }
            />
          )}
        />
        {formState.errors.rel_dir_to_models && (
          <p className="text-red-500 text-sm">Model directory is required</p>
        )}
      </div>

      {/* Submit */}
      <div className="sticky bottom-0 bg-white pb-4">
        <Button type="submit" data-testid="savebutton" className="w-full">
          Save
        </Button>
      </div>
    </form>
  );
}
```

---

## Key Features

1. **FreeSolo autocomplete**: Both schema and directory allow custom values
2. **Directory fetching**: Loads available directories from API
3. **Fallback directories**: Uses defaults if API fails
4. **Triggers workflow**: After save, triggers 'run-workflow' canvas action
5. **Pre-fill for edit**: If node is_last_in_chain, pre-fills with existing values

---

## API Response Handling

On success, the API creates the dbt model file and returns:
- The model is placed in `models/{rel_dir_to_models}/{name}.sql`
- The model writes to schema `{dest_schema}`
- The operation chain is terminated

---

## Implementation Checklist

- [ ] Create form component
- [ ] Implement output name input
- [ ] Implement dest_schema with freeSolo autocomplete
- [ ] Implement rel_dir_to_models with freeSolo autocomplete
- [ ] Fetch directories from API
- [ ] Handle fallback directories
- [ ] Call terminate endpoint
- [ ] Trigger run-workflow action on success
- [ ] Handle view mode (if needed)
- [ ] Add validation
- [ ] Style with Tailwind
