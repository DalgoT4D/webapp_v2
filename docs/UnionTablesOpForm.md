# UnionTablesOpForm Specification

## Overview

Form for unioning (combining rows from) multiple tables.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationPanel/Forms/UnionTablesOpForm.tsx` (~389 lines)

**v2 Target:** `webapp_v2/src/components/transform/forms/UnionTablesOpForm.tsx`

**Complexity:** Very High - Multi-input operation with dummy node handling

---

## Visual Design

```
┌─────────────────────────────────────┐
│ Select the table no 1*              │
│ [schema.current_table          ▼]   │  (disabled - current node)
│                                     │
│ Select the table no 2*              │
│ [schema.customers              ▼]   │
│ [+ Add Table]                       │
│                                     │
│ Select the table no 3*              │
│ [schema.vendors                ▼]   │
│ [Remove]                            │
│                                     │
│ ℹ Columns not belonging to both     │
│   tables will yield NULLs           │
├─────────────────────────────────────┤
│              [Save]                 │
└─────────────────────────────────────┘
```

---

## Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tables[0] | Autocomplete | Read-only | Current node (disabled) |
| tables[1+] | Autocomplete | Yes | Additional tables to union |

---

## API Payload

### Create
```typescript
POST transform/v2/dbt_project/operations/nodes/
{
  "op_type": "union",
  "config": {},
  "input_node_uuid": "uuid-of-table1",
  "source_columns": ["col1", "col2", "..."],
  "other_inputs": [
    {
      "input_model_uuid": "uuid-of-table2",
      "columns": ["col1", "col2", "..."],
      "seq": 2
    },
    {
      "input_model_uuid": "uuid-of-table3",
      "columns": ["col1", "col2", "..."],
      "seq": 3
    }
  ]
}
```

---

## Dummy Node Handling

When user selects additional tables:
1. Find or create dummy source/model node on canvas
2. Connect it to the operation dummy node
3. Track dummy node IDs for cleanup on cancel
4. On save, clear refs so nodes aren't deleted

```typescript
const clearAndAddDummyModelNode = (model: DbtModelResponse | null, index: number) => {
  // Remove existing edge if changing selection
  if (currentDummyNodeIds[index]) {
    deleteElements({
      edges: edgesToThisDummy,
      nodes: removeNodeIfOnlyEdge ? [nodeId] : [],
    });
  }

  // Add new dummy node if model selected
  if (model) {
    let dummyNode = getNodes().find((n) => n.id === model.uuid);
    if (!dummyNode) {
      dummyNode = generateDummySrcModelNode(node, model, yPosition);
      addNodes([dummyNode]);
    }
    addEdges([{ source: dummyNode.id, target: dummyNodeId }]);
    currentDummyNodeIds[index] = dummyNode.id;
  }
};
```

---

## Implementation

```typescript
import { useEffect, useRef, useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { useReactFlow } from '@xyflow/react';
import { Plus, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Autocomplete } from '@/components/ui/autocomplete';
import { useCanvasSources } from '@/hooks/api/useCanvasSources';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { generateDummySrcModelNode } from '../utils/dummynodes';
import type { OperationFormProps, DbtModelResponse, UnionDataConfig } from '@/types/transform.types';

interface FormData {
  tables: Array<{ id: string; label: string }>;
}

export default function UnionTablesOpForm({
  node,
  operation,
  dummyNodeId,
  action,
  continueOperationChain,
  setLoading,
}: OperationFormProps) {
  const { deleteElements, addEdges, addNodes, getEdges, getNodes } = useReactFlow();
  const [nodeSrcColumns, setNodeSrcColumns] = useState<string[]>([]);
  const modelDummyNodeIds = useRef<(string | null)[]>([]);

  const { sourcesModels } = useCanvasSources();
  const { createOperation, editOperation } = useCanvasOperations();

  const { control, handleSubmit, reset, setValue } = useForm<FormData>({
    defaultValues: {
      tables: [
        { id: '', label: '' },
        { id: '', label: '' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'tables',
  });

  const clearAndAddDummyModelNode = (model: DbtModelResponse | null, index: number) => {
    const adjustedIndex = index - 1; // Table 2 is index 1, maps to array index 0
    const edges = getEdges();
    let currentIds = modelDummyNodeIds.current;

    // Ensure array is long enough
    if (currentIds.length < adjustedIndex + 1) {
      currentIds = currentIds.concat(Array(adjustedIndex + 1 - currentIds.length).fill(null));
    }

    // Remove existing edge/node if present
    if (currentIds[adjustedIndex]) {
      const edgesToRemove = edges.filter(
        (e) => e.source === currentIds[adjustedIndex] && e.target === dummyNodeId
      );
      const nodeEdgeCount = edges.filter(
        (e) => e.source === currentIds[adjustedIndex] || e.target === currentIds[adjustedIndex]
      ).length;

      deleteElements({
        nodes: nodeEdgeCount === 1 ? [{ id: currentIds[adjustedIndex]! }] : [],
        edges: edgesToRemove.map((e) => ({ id: e.id })),
      });
      currentIds[adjustedIndex] = null;
    }

    // Add new node/edge if model selected
    if (model) {
      let dummySourceNode = getNodes().find((n) => n.id === model.uuid);
      if (!dummySourceNode) {
        dummySourceNode = generateDummySrcModelNode(node, model, 400 * (adjustedIndex + 1));
        addNodes([dummySourceNode]);
      }
      addEdges([{
        id: `${dummySourceNode.id}_${dummyNodeId}`,
        source: dummySourceNode.id,
        target: dummyNodeId!,
      }]);
      currentIds[adjustedIndex] = dummySourceNode.id;
    }

    modelDummyNodeIds.current = currentIds;
  };

  const fetchAndSetSourceColumns = () => {
    if (node) {
      setNodeSrcColumns(node.data.output_columns);
      setValue('tables.0', {
        id: node.data.dbtmodel?.uuid || '',
        label: `${node.data.dbtmodel?.schema || ''}.${node.data.dbtmodel?.name || ''}`,
      });
    }
  };

  const fetchAndSetConfigForEdit = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/transform/v2/dbt_project/nodes/${node?.id}/`);
      const { operation_config, input_nodes } = await response.json();

      const { source_columns }: UnionDataConfig = operation_config.config;
      setNodeSrcColumns(source_columns);

      const sortedInputNodes = input_nodes?.sort((a: any, b: any) => (a.seq || 0) - (b.seq || 0)) || [];
      const tablesData = sortedInputNodes
        .filter((n: any) => n.dbtmodel)
        .map((n: any) => ({
          id: n.dbtmodel.uuid,
          label: `${n.dbtmodel.schema}.${n.dbtmodel.name}`,
        }));

      reset({ tables: tablesData });
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

  const onSubmit = async (data: FormData) => {
    if (data.tables.filter((t) => t.id).length < 2) {
      // Show error toast
      return;
    }

    setLoading(true);
    try {
      // Fetch columns for each table
      const otherInputs = await Promise.all(
        data.tables
          .filter((t) => t.id)
          .map(async (table, index) => {
            const model = sourcesModels.find((m) => m.uuid === table.id);
            const columnsResponse = await fetch(
              `/api/warehouse/table_columns/${model?.schema}/${model?.name}`
            );
            const columns = await columnsResponse.json();
            return {
              input_model_uuid: table.id,
              columns: columns.map((c: any) => c.name),
              seq: index + 1,
            };
          })
      );

      // For create, exclude first item (it's the input_node)
      const finalOtherInputs = action === 'create'
        ? otherInputs.slice(1).map((input, idx) => ({ ...input, seq: idx + 2 }))
        : otherInputs;

      const payload = {
        op_type: operation.slug,
        config: {},
        source_columns: nodeSrcColumns,
        other_inputs: finalOtherInputs,
      };

      if (action === 'create') {
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
      console.error('Failed to save union operation:', error);
    } finally {
      setLoading(false);
    }
  };

  const tableOptions = sourcesModels
    .map((model) => ({
      id: model.uuid,
      label: `${model.schema}.${model.name}`,
      schema: model.schema,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="px-4 space-y-4">
      {fields.map((field, index) => (
        <div key={field.id} className="mt-4">
          <Controller
            control={control}
            rules={{
              validate: (value) => (value && value.id !== '') || `Table ${index + 1} is required`,
            }}
            name={`tables.${index}`}
            render={({ field, fieldState }) => (
              <Autocomplete
                {...field}
                data-testid={`table${index}`}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                disabled={index === 0} // First table is current node
                options={tableOptions}
                groupBy={(option) => option.schema}
                getOptionLabel={(opt) => opt.label}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                onChange={(data) => {
                  field.onChange(data);
                  if (index > 0) {
                    const model = sourcesModels.find((m) => m.uuid === data?.id);
                    clearAndAddDummyModelNode(model || null, index);
                  }
                }}
                label={`Select the table no ${index + 1}*`}
              />
            )}
          />

          {/* Add/Remove Buttons */}
          {index === fields.length - 1 ? (
            <Button
              variant="outline"
              type="button"
              data-testid="addoperand"
              className="mt-4"
              onClick={() => append({ id: '', label: '' })}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Table
            </Button>
          ) : index > 0 && (
            <Button
              variant="outline"
              type="button"
              data-testid="removeoperand"
              className="mt-4"
              onClick={() => {
                remove(index);
                clearAndAddDummyModelNode(null, index);
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove
            </Button>
          )}
        </div>
      ))}

      {/* Info Box */}
      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-md text-sm text-blue-700">
        <Info className="w-4 h-4" />
        Columns not belonging to both tables will yield NULLs in the union
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

1. **Multi-table input**: Can union 2+ tables
2. **Dummy nodes**: Creates visual nodes on canvas for selected tables
3. **First table locked**: Current node is first table, cannot change
4. **Group by schema**: Options grouped by database schema
5. **Column fetching**: Fetches columns for each table for payload

---

## Implementation Checklist

- [ ] Create form component
- [ ] Implement table selection with dummy node handling
- [ ] Implement add/remove table functionality
- [ ] Group options by schema
- [ ] Fetch columns for each table
- [ ] Build payload with other_inputs
- [ ] Handle edit mode initialization
- [ ] Handle view mode
- [ ] Add validation (min 2 tables)
- [ ] Style with Tailwind
