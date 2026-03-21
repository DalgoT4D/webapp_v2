# CanvasPreview Component Specification

## Overview

Read-only canvas wrapper for preview mode - displays the transformation graph without editing capabilities.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/CanvasPreview.tsx` (~20 lines)

**v2 Target:** `webapp_v2/src/components/transform/CanvasPreview.tsx`

---

## Purpose

- Used for preview/read-only display of transformation workflows
- No lock acquisition
- No editing capabilities
- Simpler header (no Run/Publish buttons)

---

## Implementation

```typescript
import { ReactFlowProvider } from '@xyflow/react';
import Canvas from './Canvas';

export default function CanvasPreview() {
  return (
    <ReactFlowProvider>
      <Canvas isPreviewMode={true} />
    </ReactFlowProvider>
  );
}
```

---

## Preview Mode Behavior

When `isPreviewMode={true}`:

1. **No lock acquisition** - Doesn't try to acquire canvas lock
2. **Read-only** - No node editing or deletion
3. **No PAT check** - Skips PAT status verification
4. **No sync** - Doesn't sync with remote on load
5. **Simplified header** - No Run/Publish buttons

---

## Canvas Props in Preview Mode

```typescript
<Canvas
  isPreviewMode={true}
  // These are effectively ignored in preview mode:
  // - Lock acquisition skipped
  // - Sync skipped
  // - PAT check skipped
/>
```

---

## Usage

```typescript
// In a preview page or modal
import CanvasPreview from '@/components/transform/CanvasPreview';

function WorkflowPreviewPage() {
  return (
    <div className="h-screen">
      <CanvasPreview />
    </div>
  );
}
```

---

## Implementation Checklist

- [ ] Create wrapper component
- [ ] Wrap Canvas in ReactFlowProvider
- [ ] Pass isPreviewMode={true}
- [ ] Verify preview mode behavior in Canvas
