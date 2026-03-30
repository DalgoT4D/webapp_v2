# Operation Forms Overview

## Common Structure

All operation forms share a common structure and props interface:

### OperationFormProps

```typescript
interface OperationFormProps {
  /** Current node (source/model/operation) */
  node: GenericNodeProps | null | undefined;
  /** Selected operation */
  operation: UIOperationType;
  /** Callback after saving */
  continueOperationChain: () => void;
  /** Callback to close panel */
  clearAndClosePanel?: () => void;
  /** Dummy node ID if in create mode */
  dummyNodeId?: string;
  /** Form mode */
  action: 'create' | 'view' | 'edit';
  /** Loading state setter */
  setLoading: (loading: boolean) => void;
}
```

---

## Form Categories

### Simple Column Operations
| Form | Complexity | Key Features |
|------|------------|--------------|
| RenameColumnOpForm | Medium | Multi-row old→new mapping |
| DropColumnOpForm | Medium | Checkbox list, search filter |
| CastColumnOpForm | High | Column→type mapping, fetches types |
| ReplaceValueOpForm | Medium | Multi-row find/replace |

### Aggregation Operations
| Form | Complexity | Key Features |
|------|------------|--------------|
| AggregationOpForm | Medium | Column + operation selection |
| GroupByOpForm | High | Dimension columns + aggregates |
| ArithmeticOpForm | High | Multi-operand math operations |

### Multi-Table Operations
| Form | Complexity | Key Features |
|------|------------|--------------|
| JoinOpForm | Very High | Second table selection, join keys |
| UnionTablesOpForm | Very High | Multiple table selection |
| CoalesceOpForm | High | Column ordering, default value |

### Conditional Operations
| Form | Complexity | Key Features |
|------|------------|--------------|
| CaseWhenOpForm | Very High | Multiple when/then clauses |
| WhereFilterOpForm | High | Condition builder, SQL snippet |

### Transform Operations
| Form | Complexity | Key Features |
|------|------------|--------------|
| PivotOpForm | High | Groupby + pivot column selection |
| UnpivotOpForm | High | Column selection with checkboxes |
| FlattenJsonOpForm | High | JSON column selection |
| CreateTableForm | Medium | Name, schema, directory |

### Generic Operations
| Form | Complexity | Key Features |
|------|------------|--------------|
| GenericColumnOpForm | Medium | Custom function + operands |
| GenericSqlOpForm | Medium | Raw SQL input |

---

## Common Patterns

### 1. Column Fetching
```typescript
const { columns, isLoading } = useColumnData({
  nodeUuid: node?.id,
  enabled: !!node,
});
```

### 2. Form with React Hook Form
```typescript
const { control, handleSubmit, reset, watch } = useForm({
  defaultValues: {
    // form defaults
  },
});
```

### 3. Edit Mode Initialization
```typescript
useEffect(() => {
  if (action === 'edit' && node?.data?.operation_config) {
    const config = node.data.operation_config.config;
    reset({
      // map config to form values
    });
  }
}, [action, node]);
```

### 4. Payload Building
```typescript
const buildPayload = (formData: FormData): CreateOperationNodePayload => {
  return {
    op_type: operation.slug,
    config: {
      // operation-specific config
    },
    input_node_uuid: node?.id || '',
    source_columns: columns,
    other_inputs: [],
  };
};
```

### 5. Save Handler
```typescript
const handleSave = async (formData: FormData) => {
  setLoading(true);
  try {
    const payload = buildPayload(formData);

    if (action === 'create') {
      await createOperation(node.id, payload);
    } else {
      await editOperation(node.id, payload);
    }

    continueOperationChain();
  } catch (error) {
    toast.error('Failed to save operation');
  } finally {
    setLoading(false);
  }
};
```

---

## Multi-Input Operations

Join and Union operations require selecting additional tables:

```typescript
// Fetch available sources/models
const { sourcesModels } = useCanvasSources();

// Track secondary inputs
const [secondaryInputs, setSecondaryInputs] = useState<SecondaryInput[]>([]);

// Add dummy nodes for secondary inputs
const addSecondaryInput = (model: DbtModelResponse) => {
  const dummyNode = generateDummySrcModelNode(model);
  addNodes([dummyNode]);
  addEdges([{ source: dummyNode.id, target: node.id }]);

  setSecondaryInputs([
    ...secondaryInputs,
    {
      input: { input_name: model.name, input_type: model.type, source_name: model.source_name },
      seq: secondaryInputs.length + 1,
      source_columns: model.output_cols,
    },
  ]);
};
```

---

## View Mode

When `action === 'view'`:
- All form fields are disabled
- No save button
- Only close button available

```typescript
const isViewOnly = action === 'view';

<Input disabled={isViewOnly} />
<Button type="submit" disabled={isViewOnly}>Save</Button>
```

---

## Field Array Pattern

For forms with dynamic rows (Rename, Replace, etc.):

```typescript
const { fields, append, remove } = useFieldArray({
  control,
  name: 'rows',
  rules: {
    minLength: { value: 1, message: 'At least one row required' },
  },
});

// Add row
<Button onClick={() => append({ old: '', new: '' })}>Add Row</Button>

// Remove row
<Button onClick={() => remove(index)}>Remove</Button>
```

---

## File Structure

```
webapp_v2/src/components/transform/forms/
├── RenameColumnOpForm.tsx
├── DropColumnOpForm.tsx
├── CastColumnOpForm.tsx
├── ReplaceValueOpForm.tsx
├── AggregationOpForm.tsx
├── GroupByOpForm.tsx
├── ArithmeticOpForm.tsx
├── JoinOpForm.tsx
├── UnionTablesOpForm.tsx
├── CoalesceOpForm.tsx
├── CaseWhenOpForm.tsx
├── WhereFilterOpForm.tsx
├── PivotOpForm.tsx
├── UnpivotOpForm.tsx
├── FlattenJsonOpForm.tsx
├── CreateTableForm.tsx
├── GenericColumnOpForm.tsx
├── GenericSqlOpForm.tsx
└── shared/
    ├── OperandInput.tsx       # Column vs constant input
    ├── ColumnSelect.tsx       # Column dropdown
    └── FormActions.tsx        # Save/Cancel buttons
```

---

## Implementation Priority

1. **Simple forms first**: Rename, Drop, Cast
2. **Aggregation forms**: Aggregate, GroupBy
3. **Complex multi-table**: Join, Union
4. **Conditional forms**: CaseWhen, Where
5. **Transform forms**: Pivot, Unpivot, Flatten
6. **Generic forms**: GenericColumn, GenericSql
7. **Create Table**: Last (depends on workflow completion)
