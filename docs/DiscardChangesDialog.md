# DiscardChangesDialog Specification

## Overview

Confirmation dialog for discarding unsaved changes when closing the operation panel.

**v1 Source:** Inline component in `webapp/src/components/TransformWorkflow/FlowEditor/Components/OperationConfigLayout.tsx` (lines 256-274)

**v2 Target:** `webapp_v2/src/components/transform/modals/DiscardChangesDialog.tsx`

**Complexity:** Low

---

## Visual Design

```
┌─────────────────────────────────────────────────────┐
│ Discard Changes?                                    │
├─────────────────────────────────────────────────────┤
│ All your changes will be discarded. Are you sure   │
│ you want to continue?                              │
├─────────────────────────────────────────────────────┤
│                           [Cancel]  [Confirm]       │
└─────────────────────────────────────────────────────┘
```

---

## Props Interface

```typescript
interface DiscardChangesDialogProps {
  open: boolean;
  onClose: () => void;        // Called when Cancel clicked
  onConfirm: () => void;      // Called when Confirm clicked
}
```

---

## Implementation

```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DiscardChangesDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DiscardChangesDialog({
  open,
  onClose,
  onConfirm,
}: DiscardChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
          <AlertDialogDescription>
            All your changes will be discarded. Are you sure you want to continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onClose}
            data-testid="cancel-discard-btn"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            data-testid="confirm-discard-btn"
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

---

## Usage Context

The dialog is shown when:
1. User is in "create" mode for an operation
2. User clicks the back button in the operation panel header
3. User has unsaved changes that would be lost

---

## Behavior on Confirm

When user confirms discard:
1. Delete any dummy nodes created for the operation
2. Clear the selected operation
3. Close the discard dialog
4. Return to operation list

From v1 implementation:
```typescript
const handleBackbuttonAction = () => {
  // Dummy nodes are generated only while creating & not updating
  if (panelOpFormState.current === 'create') {
    const dummyNodeIds: string[] = [dummyNodeIdRef.current];
    getNodes().forEach((node) => {
      if (node.data.isDummy) {
        dummyNodeIds.push(node.id);
      }
    });
    deleteElements({
      nodes: dummyNodeIds.map((nodeId) => ({ id: nodeId })),
    });
    setSelectedOp(null);
  }
  setShowDiscardDialog(false);
};
```

---

## Integration Points

Used in OperationPanel component:
- Tracks `showDiscardDialog` state
- Back button triggers dialog when in create mode
- Confirm triggers cleanup and panel close

---

## Key Features

1. **Simple confirmation**: Two-button dialog (Cancel/Confirm)
2. **Destructive action**: Uses AlertDialog for proper a11y
3. **Cleanup on confirm**: Removes dummy nodes from canvas
4. **State reset**: Clears selected operation

---

## Implementation Checklist

- [ ] Create AlertDialog component
- [ ] Add title and description
- [ ] Add Cancel button with close handler
- [ ] Add Confirm button with confirm handler
- [ ] Style with Tailwind (uses shadcn AlertDialog)
- [ ] Add data-testid attributes
