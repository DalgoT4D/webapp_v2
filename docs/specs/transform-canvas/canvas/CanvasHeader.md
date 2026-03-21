# CanvasHeader Component Specification

## Overview

Toolbar component at the top of the canvas with Run and Publish buttons.

**v1 Source:** Extracted from `Canvas.tsx` (CanvasHeader component, lines 99-311)

**v2 Target:** `webapp_v2/src/components/transform/CanvasHeader.tsx`

---

## Props Interface

```typescript
interface CanvasHeaderProps {
  /** Whether user can interact with canvas */
  canInteract: boolean;
  /** Whether canvas is locked by another user */
  isLocked: boolean;
}
```

---

## Visual Design

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Workflow                    [Run ▼] [Publish] │
└────────────────────────────────────────────────────────────────────────┘

Run Dropdown Menu:
┌────────────────────┐
│ Run workflow       │
│ Run to node        │  ← Disabled if no source/model node selected
│ Run from node      │  ← Disabled if no source/model node selected
└────────────────────┘
```

---

## Run Options

| Option | Description | API Payload |
|--------|-------------|-------------|
| Run workflow | Run entire workflow | `{}` |
| Run to node | Run from start to selected node | `{ options: { select: '+nodeName' } }` |
| Run from node | Run from selected node to end | `{ options: { select: 'nodeName+' } }` |

---

## Implementation

```typescript
import { useState } from 'react';
import { ChevronDown, Play, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTransformStore } from '@/stores/transformStore';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { CanvasNodeTypeEnum } from '@/types/transform.types';

interface CanvasHeaderProps {
  canInteract: boolean;
  isLocked: boolean;
}

export default function CanvasHeader({ canInteract, isLocked }: CanvasHeaderProps) {
  const [runMenuOpen, setRunMenuOpen] = useState(false);

  const selectedNode = useTransformStore((s) => s.selectedNode);
  const dispatchCanvasAction = useTransformStore((s) => s.dispatchCanvasAction);
  const openPublishModal = useTransformStore((s) => s.openPublishModal);

  const { hasPermission } = useUserPermissions();
  const canRun = hasPermission('can_run_pipeline');

  // Can only run to/from node if a source or model is selected
  const canRunToFromNode = selectedNode &&
    [CanvasNodeTypeEnum.Source, CanvasNodeTypeEnum.Model].includes(
      selectedNode.type as CanvasNodeTypeEnum
    );

  const handleRun = (type: 'run' | 'run-to-node' | 'run-from-node') => {
    const nodeName = selectedNode?.data?.dbtmodel?.name;

    let data = null;
    if (type === 'run-to-node' && nodeName) {
      data = { options: { select: `+${nodeName}` } };
    } else if (type === 'run-from-node' && nodeName) {
      data = { options: { select: `${nodeName}+` } };
    }

    dispatchCanvasAction({ type: 'run-workflow', data });
    setRunMenuOpen(false);
  };

  const handlePublish = () => {
    openPublishModal();
  };

  return (
    <div className="flex items-center justify-between h-full px-5">
      <span className="text-lg font-semibold ml-auto">Workflow</span>

      <div className="flex gap-2 ml-auto">
        {/* Run Button with Dropdown */}
        <DropdownMenu open={runMenuOpen} onOpenChange={setRunMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              size="sm"
              disabled={!canRun || !canInteract}
              className="bg-teal-600 hover:bg-teal-700"
            >
              <Play className="w-4 h-4 mr-1" />
              Run
              <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleRun('run')}>
              Run workflow
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleRun('run-to-node')}
              disabled={!canRunToFromNode}
            >
              Run to node
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleRun('run-from-node')}
              disabled={!canRunToFromNode}
            >
              Run from node
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Publish Button */}
        <Button
          variant="default"
          size="sm"
          disabled={!canInteract}
          onClick={handlePublish}
          className="bg-teal-600 hover:bg-teal-700"
        >
          <Upload className="w-4 h-4 mr-1" />
          Publish
        </Button>
      </div>
    </div>
  );
}
```

---

## Permissions Required

| Button | Permission |
|--------|------------|
| Run | `can_run_pipeline` |
| Publish | (no specific permission, but requires `canInteract`) |

---

## Edge Cases

1. **No node selected**: Disable "Run to node" and "Run from node"
2. **Operation node selected**: Disable "Run to node" and "Run from node"
3. **Locked by other**: All buttons disabled
4. **No run permission**: Run button disabled, Publish still available

---

## Implementation Checklist

- [ ] Create component file
- [ ] Add Run dropdown menu with 3 options
- [ ] Add Publish button
- [ ] Integrate permission checks
- [ ] Handle run action dispatch
- [ ] Style with Tailwind (teal theme)
- [ ] Add proper disabled states
