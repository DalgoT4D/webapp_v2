# JoinOpForm Specification

## Overview

Form for joining two tables based on matching columns.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationPanel/Forms/JoinOpForm.tsx` (~350 lines)

**v2 Target:** `webapp_v2/src/components/transform/forms/JoinOpForm.tsx`

**Complexity:** Very High - Multi-input operation with dummy node handling

---

## Visual Design

```
┌───────────────────────────────────────────────┐
│ JOIN TYPE                                     │
│ [Left Join                              ▼]    │
├───────────────────────────────────────────────┤
│ TABLE 1 (Current Node)                        │
│ ┌───────────────────────────────────────────┐ │
│ │ [current_table]              (readonly)   │ │
│ └───────────────────────────────────────────┘ │
│ KEY                                           │
│ [Select column                           ▼]   │
├───────────────────────────────────────────────┤
│ TABLE 2                                       │
│ ┌───────────────────────────────────────────┐ │
│ │ [Select table                          ▼] │ │
│ └───────────────────────────────────────────┘ │
│ KEY                                           │
│ [Select column                           ▼]   │
├───────────────────────────────────────────────┤
│                    [Save]                     │
└───────────────────────────────────────────────┘
```

---

## Form Fields

| Field | Type | Required | Options |
|-------|------|----------|---------|
| join_type | Select | Yes | left, inner, full outer |
| table1 | Display | - | Current node (readonly) |
| table1_key | Autocomplete | Yes | Columns from current node |
| table2 | Autocomplete | Yes | Available sources/models |
| table2_key | Autocomplete | Yes | Columns from selected table |

---

## Join Types

```typescript
const JoinTypes = [
  { id: 'left', label: 'Left Join' },
  { id: 'inner', label: 'Inner Join' },
  { id: 'full outer', label: 'Full Outer Join' },
];
```

---

## API Payload

### Create
```typescript
POST transform/v2/dbt_project/nodes/{input_node_uuid}/operations/
{
  "op_type": "join",
  "config": {
    "join_type": "left",
    "join_on": {
      "key1": "column_from_table1",
      "key2": "column_from_table2",
      "compare_with": "="
    }
  },
  "input_node_uuid": "uuid-of-table1",
  "source_columns": ["col1", "col2", "..."],
  "other_inputs": [
    {
      "input_model_uuid": "uuid-of-table2",
      "columns": ["col1", "col2", "..."],
      "seq": 1
    }
  ]
}
```

---

## Dummy Node Handling

When user selects Table 2:
1. Create a dummy source/model node on canvas
2. Connect it to the operation dummy node
3. On cancel, remove all dummy nodes
4. On save, backend handles proper edge creation

```typescript
const handleSelectTable2 = (model: DbtModelResponse) => {
  // Create dummy node for table2
  const dummyNode = generateDummySrcModelNode(model, getNextNodePosition(nodes));

  // Store reference for cleanup
  modelDummyNodeIds.current.push(dummyNode.id);

  // Add to canvas
  addNodes([dummyNode]);

  // Connect to current operation dummy node
  addEdges([{
    id: `${dummyNode.id}_${dummyNodeId}`,
    source: dummyNode.id,
    target: dummyNodeId,
  }]);

  // Fetch columns for table2
  setTable2Columns(model.output_cols);
};
```

---

## Implementation

```typescript
import { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Autocomplete } from '@/components/ui/autocomplete';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useColumnData } from '@/hooks/api/useColumnData';
import { useCanvasSources } from '@/hooks/api/useCanvasSources';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { generateDummySrcModelNode } from '../utils/dummynodes';
import type {
  OperationFormProps,
  JoinDataConfig,
  DbtModelResponse,
  SecondaryInput,
} from '@/types/transform.types';

const JoinTypes = [
  { id: 'left', label: 'Left Join' },
  { id: 'inner', label: 'Inner Join' },
  { id: 'full outer', label: 'Full Outer Join' },
];

interface FormData {
  table1: { id: string; label: string };
  table1_key: string;
  table2: { id: string; label: string } | null;
  table2_key: string;
  join_type: string;
}

export default function JoinOpForm({
  node,
  operation,
  action,
  dummyNodeId,
  continueOperationChain,
  setLoading,
}: OperationFormProps) {
  const { addNodes, addEdges, deleteElements, getNodes } = useReactFlow();

  // Refs for dummy node cleanup
  const modelDummyNodeIds = useRef<string[]>([]);

  // Column data for table 1 (current node)
  const { columns: table1Columns } = useColumnData({ nodeUuid: node?.id });

  // Column data for table 2 (dynamically set)
  const [table2Columns, setTable2Columns] = useState<string[]>([]);

  // Available sources/models
  const { sourcesModels } = useCanvasSources();

  const { createOperation, editOperation } = useCanvasOperations();

  const { control, handleSubmit, reset, watch, setValue } = useForm<FormData>({
    defaultValues: {
      table1: { id: node?.id || '', label: node?.data?.name || '' },
      table1_key: '',
      table2: null,
      table2_key: '',
      join_type: '',
    },
  });

  const selectedTable2 = watch('table2');

  // Build table options for autocomplete
  const tableOptions = sourcesModels.map((model) => ({
    id: model.uuid,
    label: model.display_name || model.name,
  }));

  // Handle table 2 selection
  const handleTable2Select = (option: { id: string; label: string } | null) => {
    if (!option) return;

    const model = sourcesModels.find((m) => m.uuid === option.id);
    if (!model) return;

    // Create dummy node on canvas
    const dummyNode = generateDummySrcModelNode(model);
    modelDummyNodeIds.current.push(dummyNode.id);

    addNodes([dummyNode]);

    // Connect to operation dummy node
    if (dummyNodeId) {
      addEdges([{
        id: `${dummyNode.id}_${dummyNodeId}`,
        source: dummyNode.id,
        target: dummyNodeId,
      }]);
    }

    // Set table 2 columns
    setTable2Columns(model.output_cols || []);
    setValue('table2', option);
    setValue('table2_key', ''); // Reset key when table changes
  };

  // Load existing config in edit mode
  useEffect(() => {
    if (action === 'edit' && node?.data?.operation_config?.config) {
      const config: JoinDataConfig = node.data.operation_config.config;

      reset({
        table1: { id: node.id, label: node.data.name },
        table1_key: config.join_on.key1,
        join_type: config.join_type,
        table2_key: config.join_on.key2,
      });

      // Load table 2 info from input_nodes
      if (node.data.input_nodes && node.data.input_nodes.length > 1) {
        const table2Node = node.data.input_nodes[1];
        setValue('table2', {
          id: table2Node.uuid,
          label: table2Node.name,
        });
        setTable2Columns(table2Node.output_columns || []);
      }
    }
  }, [action, node, reset, setValue]);

  // Cleanup dummy nodes on unmount
  useEffect(() => {
    return () => {
      if (modelDummyNodeIds.current.length > 0) {
        deleteElements({
          nodes: modelDummyNodeIds.current.map((id) => ({ id })),
        });
      }
    };
  }, [deleteElements]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const model = sourcesModels.find((m) => m.uuid === data.table2?.id);

      const payload = {
        op_type: operation.slug,
        config: {
          join_type: data.join_type,
          join_on: {
            key1: data.table1_key,
            key2: data.table2_key,
            compare_with: '=',
          },
        },
        source_columns: table1Columns,
        other_inputs: model ? [{
          input_model_uuid: model.uuid,
          columns: model.output_cols || [],
          seq: 1,
        }] : [],
      };

      if (action === 'create') {
        await createOperation(node!.id, {
          ...payload,
          input_node_uuid: node!.id,
        });
      } else {
        await editOperation(node!.id, payload);
      }

      // Clear dummy node refs so they don't get deleted
      modelDummyNodeIds.current = [];

      continueOperationChain();
    } catch (error) {
      console.error('Failed to save join operation:', error);
    } finally {
      setLoading(false);
    }
  };

  const isViewOnly = action === 'view';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-6">
      {/* Join Type */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Join Type</label>
        <Controller
          control={control}
          name="join_type"
          rules={{ required: 'Select a join type' }}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={isViewOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select join type" />
              </SelectTrigger>
              <SelectContent>
                {JoinTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Table 1 */}
      <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
        <h3 className="font-medium">Table 1</h3>
        <div className="space-y-2">
          <label className="text-sm text-gray-600">Table</label>
          <div className="p-2 bg-white border rounded text-sm">
            {node?.data?.name || 'Current Node'}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-gray-600">Key</label>
          <Controller
            control={control}
            name="table1_key"
            rules={{ required: 'Select a key column' }}
            render={({ field }) => (
              <Autocomplete
                {...field}
                options={table1Columns}
                placeholder="Select key column"
                disabled={isViewOnly}
              />
            )}
          />
        </div>
      </div>

      {/* Table 2 */}
      <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
        <h3 className="font-medium">Table 2</h3>
        <div className="space-y-2">
          <label className="text-sm text-gray-600">Table</label>
          <Controller
            control={control}
            name="table2"
            rules={{ required: 'Select a table' }}
            render={({ field }) => (
              <Autocomplete
                value={field.value}
                onChange={(val) => handleTable2Select(val)}
                options={tableOptions}
                placeholder="Select table to join"
                disabled={isViewOnly}
                getOptionLabel={(opt) => opt.label}
              />
            )}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-gray-600">Key</label>
          <Controller
            control={control}
            name="table2_key"
            rules={{ required: 'Select a key column' }}
            render={({ field }) => (
              <Autocomplete
                {...field}
                options={table2Columns}
                placeholder="Select key column"
                disabled={isViewOnly || !selectedTable2}
              />
            )}
          />
        </div>
      </div>

      {/* Submit */}
      {!isViewOnly && (
        <div className="pt-4 sticky bottom-0 bg-white">
          <Button type="submit" className="w-full">
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
    "type": "join",
    "config": {
      "join_type": "left",
      "join_on": {
        "key1": "customer_id",
        "key2": "id",
        "compare_with": "="
      },
      "other_inputs": [...],
      "source_columns": [...]
    }
  },
  "input_nodes": [
    { "uuid": "table1-uuid", "name": "orders", ... },
    { "uuid": "table2-uuid", "name": "customers", ... }
  ]
}
```

---

## SecondaryInput Structure

```typescript
interface SecondaryInput {
  input: {
    input_name: string;
    input_type: string;
    source_name: string;
  };
  seq: number;
  source_columns: string[];
}
```

---

## Dummy Node Cleanup

Critical: Dummy nodes must be cleaned up on:
1. Cancel/close panel
2. Selecting a different table
3. Component unmount (if operation not saved)

Do NOT clean up on successful save - backend creates real nodes.

---

## Implementation Checklist

- [ ] Create form component
- [ ] Implement join type selector
- [ ] Implement table 1 key selector
- [ ] Implement table 2 selector with dummy node creation
- [ ] Implement table 2 key selector
- [ ] Handle dummy node creation/cleanup
- [ ] Build payload with other_inputs
- [ ] Handle edit mode initialization
- [ ] Handle view mode
- [ ] Style with Tailwind
- [ ] Test dummy node cleanup
