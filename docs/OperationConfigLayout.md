# OperationConfigLayout Component Specification

## Overview

Right-side panel for configuring operations. Manages panel states, displays operation list, renders operation forms, and handles dummy node creation.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationConfigLayout.tsx` (~600 lines)

**v2 Target:** `webapp_v2/src/components/transform/panels/OperationConfigLayout.tsx`

**Complexity:** Very High - orchestrates form rendering, state management, and dummy node handling.

---

## Panel States

```typescript
type PanelState =
  | 'op-list'                    // Show list of operations
  | 'op-form'                    // Show operation form
  | 'create-table-or-add-function'; // Show choice panel
```

### State Transitions

```
                 ┌──────────────────┐
                 │  op-list         │
                 │  (Functions)     │
                 └────────┬─────────┘
                          │ Select operation
                          ▼
                 ┌──────────────────┐
                 │  op-form         │
                 │  (Operation Form)│
                 └────────┬─────────┘
                          │ Save operation
                          ▼
           ┌──────────────────────────────┐
           │ create-table-or-add-function │
           │ (Choice: Table or Function)  │
           └──────────────┬───────────────┘
                          │
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
     Create Table    Add Function    Close Panel
     (op-form)       (op-list)
```

---

## Props Interface

```typescript
interface OperationConfigLayoutProps {
  open: boolean;
  onClose: () => void;
}
```

---

## State Variables

| State | Type | Initial | Purpose |
|-------|------|---------|---------|
| selectedOp | UIOperationType \| null | null | Currently selected operation |
| showFunctionsList | boolean | false | Show operation list |
| isPanelLoading | boolean | false | Loading state for form |
| showDiscardDialog | boolean | false | Discard changes confirmation |
| showAddFunction | boolean | true | Show "Add function" button |
| panelOpFormState | 'create' \| 'view' \| 'edit' | 'view' | Form mode |

---

## Operation Form Mapping

```typescript
const operationComponentMapping: Record<string, React.ComponentType<OperationFormProps>> = {
  [RENAME_COLUMNS_OP]: RenameColumnOpForm,
  [JOIN_OP]: JoinOpForm,
  [REPLACE_COLUMN_VALUE_OP]: ReplaceValueOpForm,
  [COALESCE_COLUMNS_OP]: CoalesceOpForm,
  [ARITHMETIC_OP]: ArithmeticOpForm,
  [DROP_COLUMNS_OP]: DropColumnOpForm,
  [CAST_DATA_TYPES_OP]: CastColumnOpForm,
  [AGGREGATE_OP]: AggregationOpForm,
  [GROUPBY_OP]: GroupByOpForm,
  [WHERE_OP]: WhereFilterOpForm,
  [CASEWHEN_OP]: CaseWhenOpForm,
  [UNION_OP]: UnionTablesOpForm,
  [FLATTEN_JSON_OP]: FlattenJsonOpForm,
  [PIVOT_OP]: PivotOpForm,
  [UNPIVOT_OP]: UnpivotOpForm,
  [GENERIC_COL_OP]: GenericColumnOpForm,
  [GENERIC_SQL_OP]: GenericSqlOpForm,
};
```

---

## Operations That Can't Chain in Middle

Some operations can only be applied to source/model nodes, not operation nodes:

```typescript
const cantChainOperationsInMiddle = [
  UNION_OP,
  CAST_DATA_TYPES_OP,
  FLATTEN_JSON_OP,
  UNPIVOT_OP,
];
```

---

## Visual Design

```
┌─────────────────────────────────┐
│ [←]  Functions           [X]   │  ← Header with back/close
├─────────────────────────────────┤
│                                 │
│  Operation List / Form          │
│                                 │
│  - Aggregate                    │
│  - Arithmetic                   │
│  - Case                         │
│  - Cast                         │
│  - ...                          │
│                                 │
│                                 │
│                                 │
└─────────────────────────────────┘

Width: Fixed (e.g., 400px)
Position: Right side of canvas
```

---

## Dummy Node Handling

When an operation is selected:
1. Create a dummy operation node on canvas
2. Connect it to the source node with a dummy edge
3. Show dotted border on dummy node
4. Remove dummy nodes on cancel/close

```typescript
const handleSelectOp = (op: UIOperationType) => {
  // Create dummy node
  const dummyNode = generateDummyOperationlNode(canvasNode, op);
  const dummyEdge = {
    id: `${canvasNode.id}_${dummyNode.id}`,
    source: canvasNode.id,
    target: dummyNode.id,
  };

  // Add to canvas
  addNodes([dummyNode]);
  addEdges([dummyEdge]);

  setSelectedOp(op);
};
```

---

## Implementation Structure

```typescript
import { useState, useRef, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { X, ChevronLeft, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useTransformStore } from '@/stores/transformStore';
import { operations, operationComponentMapping } from '@/constants/transform.constants';
import { generateDummyOperationlNode } from '../utils/dummynodes';
import CreateTableOrAddFunction from './CreateTableOrAddFunction';
import CreateTableForm from '../forms/CreateTableForm';

export default function OperationConfigLayout() {
  const { addNodes, addEdges, deleteElements, getNodes, setNodes } = useReactFlow();

  // Store state
  const selectedNode = useTransformStore((s) => s.selectedNode);
  const canvasAction = useTransformStore((s) => s.canvasAction);
  const closeOperationPanel = useTransformStore((s) => s.closeOperationPanel);

  // Local state
  const [selectedOp, setSelectedOp] = useState<UIOperationType | null>(null);
  const [isPanelLoading, setIsPanelLoading] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [panelState, setPanelState] = useState<PanelState>('op-list');
  const [formMode, setFormMode] = useState<'create' | 'view' | 'edit'>('view');

  const dummyNodeIdRef = useRef<string | null>(null);

  // Handle panel open action
  useEffect(() => {
    if (canvasAction.type === 'open-opconfig-panel') {
      setFormMode(canvasAction.data || 'view');

      if (['view', 'edit'].includes(canvasAction.data)) {
        // Edit/view existing operation
        const opType = selectedNode?.data?.operation_config?.type;
        const op = operations.find((o) => o.slug === opType);
        if (op) {
          setSelectedOp(op);
          setPanelState('op-form');
        }
      } else {
        // Create new operation
        setPanelState('op-list');
      }
    }
  }, [canvasAction]);

  const handleSelectOperation = (op: UIOperationType) => {
    // Create dummy node on canvas
    const dummyNode = generateDummyOperationlNode(selectedNode, op);
    const dummyEdge = {
      id: `${selectedNode?.id}_${dummyNode.id}`,
      source: selectedNode?.id || '',
      target: dummyNode.id,
    };

    dummyNodeIdRef.current = dummyNode.id;

    // Unselect all nodes
    setNodes(getNodes().map((n) => ({ ...n, selected: false })));

    addNodes([dummyNode]);
    addEdges([dummyEdge]);

    setSelectedOp(op);
    setPanelState('op-form');
  };

  const handleClose = () => {
    // Clean up dummy nodes
    const dummyNodes = getNodes()
      .filter((n) => n.data.isDummy)
      .map((n) => ({ id: n.id }));

    if (dummyNodeIdRef.current) {
      dummyNodes.push({ id: dummyNodeIdRef.current });
    }

    deleteElements({ nodes: dummyNodes });

    setSelectedOp(null);
    setPanelState('op-list');
    closeOperationPanel();
  };

  const handleContinueChain = () => {
    // After saving operation, show create table or add function choice
    setPanelState('create-table-or-add-function');
  };

  const handleCreateTable = () => {
    setSelectedOp({ slug: 'create-table', label: 'Create Table' });
    setPanelState('op-form');
  };

  const handleAddFunction = () => {
    setPanelState('op-list');
  };

  // Render panel content based on state
  const renderContent = () => {
    switch (panelState) {
      case 'op-list':
        return (
          <OperationList
            onSelect={handleSelectOperation}
            canChainInMiddle={selectedNode?.type !== 'operation'}
          />
        );

      case 'op-form':
        if (!selectedOp) return null;
        const FormComponent = operationComponentMapping[selectedOp.slug];
        if (!FormComponent) {
          return <div>Operation not supported</div>;
        }
        return (
          <FormComponent
            node={selectedNode}
            operation={selectedOp}
            action={formMode}
            continueOperationChain={handleContinueChain}
            clearAndClosePanel={handleClose}
            dummyNodeId={dummyNodeIdRef.current}
            setLoading={setIsPanelLoading}
          />
        );

      case 'create-table-or-add-function':
        return (
          <CreateTableOrAddFunction
            onCreateTable={handleCreateTable}
            onAddFunction={handleAddFunction}
            showAddFunction={true}
          />
        );
    }
  };

  return (
    <div className="absolute right-0 top-12 bottom-0 w-[400px] bg-white border-l shadow-lg z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        {(selectedOp && formMode === 'create') || panelState === 'create-table-or-add-function' ? (
          <button onClick={() => setShowDiscardDialog(true)}>
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-5" />
        )}

        <span className="font-semibold">
          {selectedOp?.label || (panelState === 'op-list' ? 'Functions' : '')}
        </span>

        <button onClick={handleClose}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Loading indicator */}
      {isPanelLoading && (
        <div className="h-1 bg-teal-600 animate-pulse" />
      )}

      {/* Content */}
      <ScrollArea className="h-full">
        {renderContent()}
      </ScrollArea>

      {/* Discard Dialog */}
      <DiscardChangesDialog
        open={showDiscardDialog}
        onClose={() => setShowDiscardDialog(false)}
        onConfirm={() => {
          handleClose();
          setShowDiscardDialog(false);
        }}
      />
    </div>
  );
}
```

---

## OperationList Sub-Component

```typescript
interface OperationListProps {
  onSelect: (op: UIOperationType) => void;
  canChainInMiddle: boolean;
}

function OperationList({ onSelect, canChainInMiddle }: OperationListProps) {
  const cantChainInMiddle = [UNION_OP, CAST_DATA_TYPES_OP, FLATTEN_JSON_OP, UNPIVOT_OP];

  return (
    <div className="py-2">
      {operations.map((op) => {
        const disabled = !canChainInMiddle && cantChainInMiddle.includes(op.slug);

        return (
          <button
            key={op.slug}
            onClick={() => !disabled && onSelect(op)}
            disabled={disabled}
            className={cn(
              'w-full px-5 py-2.5 text-left hover:bg-teal-50 flex items-center justify-between',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span className="font-medium">{op.label}</span>
            <Tooltip content={op.infoToolTip}>
              <Info className="w-4 h-4 text-gray-400" />
            </Tooltip>
          </button>
        );
      })}
    </div>
  );
}
```

---

## Implementation Checklist

- [ ] Create main component with panel states
- [ ] Create OperationList sub-component
- [ ] Integrate all 17 operation form components
- [ ] Implement dummy node creation/cleanup
- [ ] Add discard changes dialog
- [ ] Handle panel open/close actions
- [ ] Add loading indicator
- [ ] Style with Tailwind
- [ ] Test state transitions
- [ ] Test form rendering for all operations
