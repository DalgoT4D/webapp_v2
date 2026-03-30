# CreateTableOrAddFunction Component Specification

## Overview

Simple choice panel shown after saving an operation - allows user to either create a table (terminate chain) or add another function (continue chain).

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationPanel/CreateTableOrAddFunction.tsx` (~39 lines)

**v2 Target:** `webapp_v2/src/components/transform/panels/CreateTableOrAddFunction.tsx`

---

## Props Interface

```typescript
interface CreateTableOrAddFunctionProps {
  onCreateTable: () => void;
  onAddFunction: () => void;
  showAddFunction?: boolean;
}
```

---

## Visual Design

```
┌─────────────────────────────────┐
│                                 │
│    ┌─────────────────────┐     │
│    │   Create a table    │     │
│    └─────────────────────┘     │
│                                 │
│    ┌─────────────────────┐     │
│    │   Add function      │     │
│    └─────────────────────┘     │
│                                 │
└─────────────────────────────────┘

Buttons: Outlined variant
Gap: 24px between buttons
Padding: 32px top, 16px sides
```

---

## Implementation

```typescript
import { Button } from '@/components/ui/button';
import { Table, Plus } from 'lucide-react';

interface CreateTableOrAddFunctionProps {
  onCreateTable: () => void;
  onAddFunction: () => void;
  showAddFunction?: boolean;
}

export default function CreateTableOrAddFunction({
  onCreateTable,
  onAddFunction,
  showAddFunction = true,
}: CreateTableOrAddFunctionProps) {
  return (
    <div className="flex flex-col gap-6 p-8 pt-8">
      <Button
        variant="outline"
        size="lg"
        onClick={onCreateTable}
        className="w-full justify-start gap-2"
      >
        <Table className="w-5 h-5" />
        Create a table
      </Button>

      {showAddFunction && (
        <Button
          variant="outline"
          size="lg"
          onClick={onAddFunction}
          className="w-full justify-start gap-2"
        >
          <Plus className="w-5 h-5" />
          Add function
        </Button>
      )}
    </div>
  );
}
```

---

## Usage

```typescript
// In OperationConfigLayout
case 'create-table-or-add-function':
  return (
    <CreateTableOrAddFunction
      onCreateTable={() => {
        setSelectedOp({ slug: 'create-table', label: 'Create Table' });
        setPanelState('op-form');
      }}
      onAddFunction={() => {
        setPanelState('op-list');
      }}
      showAddFunction={true}
    />
  );
```

---

## When to Hide "Add Function"

The `showAddFunction` prop can be set to `false` when:
- The operation chain should be terminated
- No more operations can be added

In v1, this is always shown as `true`, but the prop exists for flexibility.

---

## Implementation Checklist

- [ ] Create component file
- [ ] Add two buttons with icons
- [ ] Style with Tailwind
- [ ] Handle showAddFunction conditional
