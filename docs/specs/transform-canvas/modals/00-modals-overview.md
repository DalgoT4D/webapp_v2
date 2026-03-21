# Transform Canvas Modals - Overview

## Summary

The Transform Canvas uses 3 modal dialogs for user interactions that require confirmation or additional input.

---

## Modal Components

| Modal | Purpose | Trigger | Complexity |
|-------|---------|---------|------------|
| PatRequiredModal | GitHub PAT authentication | Edit/publish without token | Low |
| PublishModal | Publish changes to git | Toolbar publish button | Medium |
| DiscardChangesDialog | Confirm discard unsaved changes | Back button in create mode | Low |

---

## Modal Flow Diagram

```
                    ┌─────────────────┐
                    │  User Action    │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌───────────────┐ ┌───────────────┐ ┌─────────────────┐
    │ Edit without  │ │ Click Publish │ │ Back button in  │
    │ PAT connected │ │ in toolbar    │ │ create mode     │
    └───────┬───────┘ └───────┬───────┘ └────────┬────────┘
            │                 │                   │
            ▼                 ▼                   ▼
    ┌───────────────┐ ┌───────────────┐ ┌─────────────────┐
    │PatRequiredModal│ │ PublishModal  │ │DiscardChanges  │
    │               │ │               │ │Dialog           │
    └───────┬───────┘ └───────┬───────┘ └────────┬────────┘
            │                 │                   │
      ┌─────┴─────┐     ┌─────┴─────┐       ┌────┴────┐
      │           │     │           │       │         │
   Connect    View Only Publish   Cancel  Confirm  Cancel
      │           │     │           │       │         │
      ▼           ▼     ▼           ▼       ▼         ▼
   Acquire    View    Commit     Close   Delete    Close
    lock      mode    to git    modal   dummy    dialog
                                        nodes
```

---

## State Management

Modals are controlled via the canvas store:

```typescript
// canvasStore.ts
interface CanvasStore {
  // Modal states
  patModalOpen: boolean;
  publishModalOpen: boolean;
  discardDialogOpen: boolean;

  // Actions
  setPatModalOpen: (open: boolean) => void;
  setPublishModalOpen: (open: boolean) => void;
  setDiscardDialogOpen: (open: boolean) => void;
}
```

---

## Shared Patterns

### Dialog Base
All modals use Radix UI Dialog primitives via shadcn/ui:
- `Dialog` - for PatRequiredModal and PublishModal
- `AlertDialog` - for DiscardChangesDialog (confirmation pattern)

### Loading States
Both PatRequiredModal and PublishModal handle:
- Loading spinner during API calls
- Disabled inputs during submission
- Error handling with toast notifications

### Form Handling
- PatRequiredModal: react-hook-form for PAT input
- PublishModal: controlled input for commit message
- DiscardChangesDialog: no form, just buttons

---

## API Dependencies

| Modal | Endpoint | Method |
|-------|----------|--------|
| PatRequiredModal | `dbt/connect_git_remote/` | PUT |
| PublishModal | `dbt/git_status/` | GET |
| PublishModal | `dbt/publish_changes/` | POST |
| DiscardChangesDialog | None | - |

---

## Implementation Order

1. **DiscardChangesDialog** (simplest, no API)
2. **PatRequiredModal** (single API call)
3. **PublishModal** (fetches status, then publishes)

---

## Spec Files

- [PatRequiredModal.md](./PatRequiredModal.md)
- [PublishModal.md](./PublishModal.md)
- [DiscardChangesDialog.md](./DiscardChangesDialog.md)
