# DbtSourceModelNode Component Specification

## Overview

React Flow custom node component for displaying DBT source and model nodes on the canvas.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/Nodes/DbtSourceModelNode.tsx` (~259 lines)

**v2 Target:** `webapp_v2/src/components/transform/nodes/DbtSourceModelNode.tsx`

---

## Props Interface

```typescript
interface DbtSourceModelNodeProps extends NodeProps<CanvasNodeRenderData> {
  // Inherited from React Flow NodeProps:
  // - id: string
  // - type: string
  // - data: CanvasNodeRenderData
  // - selected: boolean
  // - dragging: boolean
  // - position: { x: number; y: number }
}

interface CanvasNodeRenderData extends CanvasNodeDataResponse {
  isDummy: boolean;
}
```

---

## State Variables

| State | Type | Initial | Purpose |
|-------|------|---------|---------|
| columns | ColumnData[] | [] | Table columns with types |

---

## API Endpoints Used

| Endpoint | Method | When Called | Response |
|----------|--------|-------------|----------|
| `warehouse/table_columns/{schema}/{table}` | GET | On mount/edges change | ColumnData[] |

---

## Visual Design

```
┌──────────────────────────────────────┐
│ ○ Target Handle (left)               │
│                                      │
│ ┌────────────────────────────────┐   │
│ │ [Name]              [Delete X] │   │  ← Header (green background)
│ └────────────────────────────────┘   │
│ ┌────────────────────────────────┐   │
│ │ NAME           │ TYPE          │   │  ← Column table header
│ │────────────────│───────────────│   │
│ │ column_1       │ VARCHAR       │   │  ← Scrollable body
│ │ column_2       │ INTEGER       │   │
│ │ column_3       │ TIMESTAMP     │   │
│ └────────────────────────────────┘   │
│                                      │
│                     Source Handle ○  │
└──────────────────────────────────────┘

Width: 250px
Max table height: 120px (scrollable)
```

### Color Scheme
- Header background (published model/source): `#00897B` (teal)
- Header background (unpublished model): `#50A85C` (lighter green)
- Table header background: `#EEF3F3`
- Table odd row background: `#F7F7F7`
- Border when selected/dummy: `2px dotted black`

---

## Component Behavior

### Selection
- Click anywhere on node to select
- Sets `canvasNode` in store (for operation panel)
- Triggers preview pane update with table data
- Opens operation panel in 'create' mode

### Delete
- Only deletable if:
  - User has `can_delete_dbt_model` permission
  - No edges emanating from node (leaf node)
- Dispatches `delete-node` action to canvas

### Column Caching
- Columns are cached by `{schema}/{table}-{nodeId}` key
- Cache cleared on `refresh-canvas` action

---

## Implementation

```typescript
import { memo, useEffect, useMemo, useState, useRef } from 'react';
import { Handle, Position, useNodeId, useEdges } from '@xyflow/react';
import type { NodeProps, Edge } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { useTransformStore } from '@/stores/transformStore';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { trimString } from '@/lib/utils';
import type { CanvasNodeRenderData, ColumnData } from '@/types/transform.types';
import { cn } from '@/lib/utils';

interface DbtSourceModelNodeProps extends NodeProps<CanvasNodeRenderData> {}

function DbtSourceModelNode({ id, type, data, selected }: DbtSourceModelNodeProps) {
  const [columns, setColumns] = useState<ColumnData[]>([]);
  const cacheRef = useRef<Record<string, ColumnData[]>>({});

  const edges = useEdges();
  const nodeId = useNodeId();

  const setSelectedNode = useTransformStore((s) => s.setSelectedNode);
  const dispatchCanvasAction = useTransformStore((s) => s.dispatchCanvasAction);
  const canvasAction = useTransformStore((s) => s.canvasAction);
  const setPreviewData = useTransformStore((s) => s.setPreviewData);
  const openOperationPanel = useTransformStore((s) => s.openOperationPanel);

  const { hasPermission } = useUserPermissions();

  // Calculate if deletable
  const edgesEmanating = edges.filter((e: Edge) => e.source === nodeId);
  const edgesIncoming = edges.filter((e: Edge) => e.target === nodeId);
  const isDeletable = hasPermission('can_delete_dbt_model') && edgesEmanating.length === 0;

  // Determine background color
  const headerBgColor = type === 'model' && data.isPublished === false
    ? 'bg-green-500'  // Unpublished model
    : 'bg-teal-600';  // Published or source

  // Fetch columns
  useEffect(() => {
    if (!data.dbtmodel?.schema || !data.dbtmodel?.name) return;

    const cacheKey = `${data.dbtmodel.schema}/${data.dbtmodel.name}-${nodeId}`;

    if (cacheRef.current[cacheKey]) {
      setColumns(cacheRef.current[cacheKey]);
      return;
    }

    const fetchColumns = async () => {
      try {
        const response = await apiGet<ColumnData[]>(
          `warehouse/table_columns/${data.dbtmodel!.schema}/${data.dbtmodel!.name}`
        );
        cacheRef.current[cacheKey] = response;
        setColumns(response);
      } catch (error) {
        console.error('Failed to fetch columns:', error);
      }
    };

    fetchColumns();
  }, [data.dbtmodel?.schema, data.dbtmodel?.name, nodeId, edges]);

  // Clear cache on refresh
  useEffect(() => {
    if (canvasAction.type === 'refresh-canvas') {
      cacheRef.current = {};
    }
  }, [canvasAction]);

  const handleClick = () => {
    setSelectedNode({ id, type, data, selected } as any);
    setPreviewData({
      schema: data.dbtmodel?.schema || '',
      table: data.dbtmodel?.name || '',
    });

    if (hasPermission('can_create_dbt_model')) {
      openOperationPanel();
      dispatchCanvasAction({ type: 'open-opconfig-panel', data: 'create' });
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
      className={cn(
        'flex rounded-md',
        (selected || data.isDummy) && 'border-2 border-dashed border-black'
      )}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      <div className="w-[250px] rounded-md flex flex-col">
        {/* Header */}
        <div
          className={cn(
            'flex items-center justify-between px-3 py-2 rounded-t-md',
            headerBgColor
          )}
        >
          <span className="text-white font-bold text-sm">
            {trimString(data.name || '', 25)}
          </span>
          {isDeletable && (
            <button
              onClick={handleDelete}
              className="text-white hover:text-red-200"
              data-testid="delete-node-btn"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Column Table */}
        <div
          className="bg-gray-50 rounded-b-md max-h-[120px] overflow-auto shadow"
          onWheelCapture={(e) => e.stopPropagation()}
        >
          {columns.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-2 py-1 text-left font-semibold border-r border-gray-200">
                    NAME
                  </th>
                  <th className="px-2 py-1 text-left font-semibold">TYPE</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col) => (
                  <tr key={col.name} className="odd:bg-gray-100/50">
                    <td className="px-2 py-1 border-r border-gray-200">
                      {col.name}
                    </td>
                    <td className="px-2 py-1">{col.data_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-[120px] flex items-center justify-center text-gray-500">
              Please check logs
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(DbtSourceModelNode);
```

---

## Edge Cases

1. **No dbtmodel data**: Show placeholder or "Unknown" name
2. **Column fetch fails**: Show "Please check logs" message
3. **Empty columns**: Show same "Please check logs" message
4. **Long node names**: Truncate to 25 characters with `...`
5. **Dummy node**: Show dotted border, prevent API calls
6. **Permission denied**: Hide delete button

---

## Testing Considerations

- Test column display with various data types
- Test delete button visibility based on permissions
- Test delete button visibility based on edges
- Test selection behavior
- Test cache clearing on refresh

---

## Implementation Checklist

- [ ] Create component file
- [ ] Add React Flow Handle components
- [ ] Implement column table display
- [ ] Add delete functionality with permission check
- [ ] Add selection handler with store updates
- [ ] Implement column caching
- [ ] Add proper Tailwind styling
- [ ] Memoize component for performance
- [ ] Add data-testid attributes for testing
