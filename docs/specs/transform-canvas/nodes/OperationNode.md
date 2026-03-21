# OperationNode Component Specification

## Overview

React Flow custom node component for displaying operation nodes (transformations) on the canvas.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/Nodes/OperationNode.tsx` (~147 lines)

**v2 Target:** `webapp_v2/src/components/transform/nodes/OperationNode.tsx`

---

## Props Interface

```typescript
interface OperationNodeProps extends NodeProps<CanvasNodeRenderData> {
  // Inherited from React Flow NodeProps:
  // - id: string
  // - type: 'operation'
  // - data: CanvasNodeRenderData
  // - selected: boolean
  // - dragging: boolean
  // - position: { x: number; y: number }
}
```

---

## Visual Design

```
┌─────────────────────┐
│ ○ Target Handle     │
│                     │
│  ┌───────────────┐  │
│  │  [X] Delete   │  │  ← Delete button (top-right, outside box)
│  │               │  │
│  │    [ICON]     │  │  ← Operation icon (centered)
│  │               │  │
│  │               │  │
│  └───────────────┘  │
│  ─────────────────  │  ← Divider
│  │   [LABEL]     │  │  ← Operation label (centered)
│  └───────────────┘  │
│                     │
│     Source Handle ○ │
└─────────────────────┘

Width: 90px
Height: 100px
```

### Color Scheme
- Background: `white`
- Icon background: `#F5FAFA` (light teal)
- Shadow: `0px 2px 4px rgba(0, 0, 0, 0.16)`
- Border when selected/dummy: `2px dotted black`

---

## Component Behavior

### Selection
- Click to select node
- Opens operation panel in 'edit' or 'view' mode based on permissions
- Clears preview pane (operations don't have direct table preview)

### Delete
- Only deletable if:
  - User has `can_delete_dbt_operation` permission
  - No edges emanating from node (leaf node)
- Dispatches `delete-node` action to canvas

### Update Canvas Node
- Listens for `update-canvas-node` action to update selection state

---

## Implementation

```typescript
import { memo, useEffect } from 'react';
import { Handle, Position, useNodeId, useEdges } from '@xyflow/react';
import type { NodeProps, Edge } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useTransformStore } from '@/stores/transformStore';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { operations, operationIconMapping } from '@/constants/transform.constants';
import type { CanvasNodeRenderData, CanvasNodeTypeEnum } from '@/types/transform.types';
import { cn } from '@/lib/utils';

interface OperationNodeProps extends NodeProps<CanvasNodeRenderData> {}

function OperationNode({ id, type, data, selected }: OperationNodeProps) {
  const edges = useEdges();
  const nodeId = useNodeId();

  const selectedNode = useTransformStore((s) => s.selectedNode);
  const setSelectedNode = useTransformStore((s) => s.setSelectedNode);
  const dispatchCanvasAction = useTransformStore((s) => s.dispatchCanvasAction);
  const canvasAction = useTransformStore((s) => s.canvasAction);
  const clearCanvasAction = useTransformStore((s) => s.clearCanvasAction);
  const setPreviewData = useTransformStore((s) => s.setPreviewData);
  const openOperationPanel = useTransformStore((s) => s.openOperationPanel);

  const { hasPermission } = useUserPermissions();

  // Calculate if deletable
  const edgesEmanating = edges.filter((e: Edge) => e.source === nodeId);
  const edgesIncoming = edges.filter((e: Edge) => e.target === nodeId);
  const isDeletable =
    hasPermission('can_delete_dbt_operation') && edgesEmanating.length === 0;

  // Get operation label from config
  const operationType = data.operation_config?.type || '';
  const operationLabel =
    operations.find((op) => op.slug === operationType)?.label || 'Unknown';
  const operationIcon = operationIconMapping[operationType] || '/icons/transform/generic.svg';

  // Check if this node is the selected one
  const isSelected = id === selectedNode?.id || data.isDummy;

  // Handle update-canvas-node action
  useEffect(() => {
    if (
      canvasAction.type === 'update-canvas-node' &&
      canvasAction.data?.type === 'operation' &&
      canvasAction.data?.id === id
    ) {
      setSelectedNode({ id, type, data, selected } as any);
      clearCanvasAction();
    }
  }, [canvasAction, id, data, selected, setSelectedNode, clearCanvasAction]);

  const handleClick = () => {
    setSelectedNode({ id, type, data, selected } as any);
    setPreviewData(null); // Clear preview for operation nodes

    if (hasPermission('can_edit_dbt_operation')) {
      openOperationPanel();
      dispatchCanvasAction({ type: 'open-opconfig-panel', data: 'edit' });
    } else if (hasPermission('can_view_dbt_operation')) {
      openOperationPanel();
      dispatchCanvasAction({ type: 'open-opconfig-panel', data: 'view' });
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatchCanvasAction({
      type: 'delete-node',
      data: {
        nodeId,
        nodeType: type,
        shouldRefreshGraph: edgesIncoming.length + edgesEmanating.length > 0,
        isDummy: data.isDummy,
      },
    });
  };

  return (
    <div
      onClick={handleClick}
      data-testid="operation-node"
      className={cn(
        'rounded-md',
        isSelected && 'border-2 border-dashed border-black'
      )}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      <div className="w-[90px] h-[100px] bg-white shadow rounded-md">
        {/* Icon Section */}
        <div className="p-2 relative">
          <div className="h-12 bg-teal-50 rounded flex items-center justify-center">
            <Image
              src={operationIcon}
              alt={operationLabel}
              width={24}
              height={24}
            />
          </div>

          {/* Delete Button */}
          {isDeletable && (
            <button
              onClick={handleDelete}
              className="absolute -top-2 -right-2 p-1 hover:bg-gray-100 rounded-full"
              data-testid="delete-operation-btn"
            >
              <Trash2 className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200" />

        {/* Label */}
        <div className="p-2">
          <p className="text-xs font-semibold text-center truncate">
            {operationLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

export default memo(OperationNode);
```

---

## Operation Icons

Icons are mapped from `operationIconMapping` constant:

| Operation | Icon File |
|-----------|-----------|
| renamecolumns | rename.svg |
| flattenjson | flatten.svg |
| castdatatypes | cast.svg |
| coalescecolumns | coalesce.svg |
| arithmetic | arithmetic.svg |
| concat | concat.svg |
| dropcolumns | drop.svg |
| replace | replace.svg |
| join | join.svg |
| where | filter.svg |
| groupby | groupby.svg |
| aggregate | aggregate.svg |
| casewhen | case.svg |
| unionall | union.svg |
| pivot | pivot.svg |
| unpivot | unpivot.svg |
| generic | generic.svg |
| rawsql | generic.svg |

---

## Edge Cases

1. **Unknown operation type**: Show "Unknown" label and generic icon
2. **Missing icon**: Fallback to generic icon
3. **Dummy node**: Show dotted border, same as selected
4. **No edit permission**: Open in view mode only
5. **No view permission**: Don't open panel at all

---

## Testing Considerations

- Test operation label display for all 17 operations
- Test icon display for all operations
- Test delete button visibility based on permissions
- Test delete button visibility based on edges
- Test selection behavior and panel mode
- Test update-canvas-node action handling

---

## Implementation Checklist

- [ ] Create component file
- [ ] Copy operation icons to public folder
- [ ] Add React Flow Handle components
- [ ] Implement icon display from mapping
- [ ] Implement label display from operations array
- [ ] Add delete functionality with permission check
- [ ] Add selection handler with panel mode logic
- [ ] Handle update-canvas-node action
- [ ] Add proper Tailwind styling
- [ ] Memoize component for performance
- [ ] Add data-testid attributes for testing
