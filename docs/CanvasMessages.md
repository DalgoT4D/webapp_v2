# CanvasMessages Component Specification

## Overview

Overlay component displaying status messages on the canvas (lock status, unpublished changes, PAT required).

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/CanvasMessages.tsx` (~63 lines)

**v2 Target:** `webapp_v2/src/components/transform/CanvasMessages.tsx`

---

## Props Interface

```typescript
interface CanvasMessage {
  id: string;
  content: React.ReactNode;
  show: boolean;
}

interface CanvasMessagesProps {
  messages: CanvasMessage[];
}
```

---

## Visual Design

```
                                          ┌─────────────────────────────┐
                                          │ 🔒 Locked. In use by user@  │
                                          └─────────────────────────────┘
                                          ┌─────────────────────────────┐
                                          │ Unpublished Changes         │
                                          └─────────────────────────────┘
                                          ┌─────────────────────────────┐
                                          │ Update key to make changes. │
                                          │ Add key here                │
                                          └─────────────────────────────┘

Position: absolute, top-right corner
Gap between messages: 8px
```

### Styling
- Background: `#E0F2F1` (light teal)
- Border: `1px solid #00897B` (teal)
- Border radius: 8px
- Padding: 8px 12px
- Font size: 12px
- Font color: `#00897B` (teal)
- Max width: 300px
- Box shadow: subtle

---

## Message Types

| ID | Content | Shown When |
|----|---------|------------|
| `lock-status` | "Locked. In use by {email}" | Canvas locked by another user |
| `unpublished-changes` | "Unpublished Changes" | Any node has `isPublished === false` |
| `pat-required` | "Update key to make changes. Add key here" | PAT required and in view-only mode |

---

## Implementation

```typescript
import { Lock } from 'lucide-react';
import { useTransformStore } from '@/stores/transformStore';
import { cn } from '@/lib/utils';

interface CanvasMessage {
  id: string;
  content: React.ReactNode;
  show: boolean;
}

export default function CanvasMessages() {
  const lockStatus = useTransformStore((s) => s.canvasLockStatus);
  const isViewOnlyMode = useTransformStore((s) => s.isViewOnlyMode);
  const patRequired = useTransformStore((s) => s.patRequired);
  const openPatModal = useTransformStore((s) => s.openPatModal);

  // Build messages array
  const messages: CanvasMessage[] = [];

  // Lock status message
  if (lockStatus?.is_locked && !lockStatus?.locked_by_current_user) {
    messages.push({
      id: 'lock-status',
      content: (
        <>
          <Lock className="w-4 h-4 mr-1.5 text-teal-600" />
          <span>Locked. In use by {lockStatus.locked_by}</span>
        </>
      ),
      show: true,
    });
  }

  // Check for unpublished nodes (this would need nodes from store or props)
  // For now, we'll get this from the canvas via a separate mechanism

  // PAT required message
  if (patRequired && isViewOnlyMode) {
    messages.push({
      id: 'pat-required',
      content: (
        <span>
          Update key to make changes.{' '}
          <button
            onClick={openPatModal}
            className="underline font-semibold cursor-pointer"
          >
            Add key here
          </button>
        </span>
      ),
      show: true,
    });
  }

  const visibleMessages = messages.filter((m) => m.show);

  if (visibleMessages.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-16 right-4 z-50 flex flex-col gap-2">
      {visibleMessages.map((message) => (
        <div
          key={message.id}
          className={cn(
            'bg-teal-50 border border-teal-600 rounded-lg',
            'px-3 py-2 flex items-center',
            'shadow-sm max-w-[300px] min-w-fit',
            'text-xs text-teal-600 font-medium'
          )}
        >
          {message.content}
        </div>
      ))}
    </div>
  );
}
```

---

## Alternative: Receiving Messages as Props

If messages are computed in the Canvas component:

```typescript
interface CanvasMessagesProps {
  messages: CanvasMessage[];
}

export default function CanvasMessages({ messages }: CanvasMessagesProps) {
  const visibleMessages = messages.filter((m) => m.show);

  if (visibleMessages.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-16 right-4 z-50 flex flex-col gap-2">
      {visibleMessages.map((message) => (
        <div
          key={message.id}
          className="bg-teal-50 border border-teal-600 rounded-lg px-3 py-2 flex items-center shadow-sm max-w-[300px] text-xs text-teal-600 font-medium"
        >
          {message.content}
        </div>
      ))}
    </div>
  );
}
```

---

## Unpublished Changes Detection

In the Canvas component:

```typescript
const hasUnpublishedNodes = nodes.some((node) => node.data.isPublished === false);

if (hasUnpublishedNodes) {
  messages.push({
    id: 'unpublished-changes',
    content: <span>Unpublished Changes</span>,
    show: true,
  });
}
```

---

## Implementation Checklist

- [ ] Create component file
- [ ] Build messages from store state
- [ ] Style with Tailwind (teal theme)
- [ ] Add lock icon for lock status
- [ ] Add clickable link for PAT modal
- [ ] Position absolutely in top-right
- [ ] Handle empty state (return null)
