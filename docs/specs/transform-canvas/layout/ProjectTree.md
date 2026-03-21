# ProjectTree Specification

## Overview

Tree view component for browsing database schemas and tables (sources/models) with search, sync, and add-to-canvas functionality.

**v1 Source:** `webapp/src/components/TransformWorkflow/FlowEditor/Components/ProjectTree.tsx` (~405 lines)

**v2 Target:** `webapp_v2/src/components/transform/layout/ProjectTree.tsx`

**Complexity:** Medium

---

## Visual Design

```
┌─────────────────────────────────────────┐
│ [✕]                                     │  ← Close button (embedded mode)
├─────────────────────────────────────────┤
│ [🔍 Search schemas and tables...      ] │
├─────────────────────────────────────────┤
│ 📁 Data                           [↻]   │  ← Sync button
│   └─📁 raw_data                         │
│      └─📄 customers           [🗑] [+]  │  ← Delete/Add icons
│      └─📄 orders              [🗑] [+]  │
│      └─📄 products            [🗑] [+]  │
│   └─📁 staging                          │
│      └─📄 stg_customers       [🗑] [+]  │
│      └─📄 stg_orders          [🗑] [+]  │
└─────────────────────────────────────────┘
```

---

## Props Interface

```typescript
interface ProjectTreeProps {
  sourcesModels: DbtModelResponse[];
  handleNodeClick: (nodes: NodeApi[]) => void;
  handleSyncClick: () => void;
  isSyncing?: boolean;
  onClose?: () => void;
}

interface DbtModelResponse {
  uuid: string;
  name: string;
  schema: string;
  type: 'source' | 'model';
  // ... other fields
}
```

---

## Implementation

```typescript
'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { Tree, NodeApi } from 'react-arborist';
import useResizeObserver from 'use-resize-observer';
import {
  Folder,
  FolderOpen,
  Table2,
  Trash2,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvasStore';
import type { DbtModelResponse } from '@/types/transform.types';

interface ProjectTreeProps {
  sourcesModels: DbtModelResponse[];
  handleNodeClick: (nodes: NodeApi<TreeNode>[]) => void;
  handleSyncClick: () => void;
  isSyncing?: boolean;
  onClose?: () => void;
}

interface TreeNode {
  id: string;
  schema: string;
  name?: string;
  type?: string;
  uuid?: string;
  children?: TreeNode[];
}

// Tree Node Component
function TreeNodeRenderer({
  node,
  style,
  dragHandle,
  handleSyncClick,
  isSyncing,
}: {
  node: NodeApi<TreeNode>;
  style: React.CSSProperties;
  dragHandle?: any;
  handleSyncClick: () => void;
  isSyncing: boolean;
}) {
  const { setCanvasAction } = useCanvasStore();
  const data = node.data;
  const name = !node.isLeaf ? data.schema : data.name;

  // Auto-expand root folder
  useEffect(() => {
    if (!node.isLeaf && node.level === 0 && !node.isOpen) {
      node.toggle();
    }
  }, [node]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCanvasAction({
      type: 'delete-source-tree-node',
      data: {
        nodeId: node.id,
        nodeType: data.type,
        shouldRefreshGraph: true,
      },
    });
  };

  return (
    <div
      style={style}
      ref={dragHandle}
      className={cn(
        'flex items-center gap-2 pr-2 cursor-pointer hover:bg-muted/50 rounded',
        'text-sm'
      )}
      onClick={() => (!node.isLeaf && node.level !== 0 ? node.toggle() : undefined)}
    >
      {/* Icon */}
      <div className="flex items-center justify-center w-5 h-5">
        {node.isLeaf ? (
          <Table2 className="w-4 h-4 text-muted-foreground" />
        ) : node.isOpen ? (
          <FolderOpen className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Folder className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {/* Name */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex-1 font-medium truncate min-w-0">
            {name}
          </span>
        </TooltipTrigger>
        <TooltipContent>{name}</TooltipContent>
      </Tooltip>

      {/* Leaf node actions */}
      {node.isLeaf && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleDelete}
                className="p-1 hover:bg-muted rounded"
                data-testid={`delete-source-${node.id}`}
              >
                <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Delete source</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="p-1 hover:bg-muted rounded">
                <Plus className="w-4 h-4 text-muted-foreground hover:text-primary" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Add to canvas</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Root folder sync button */}
      {!node.isLeaf && node.level === 0 && (
        <div className="ml-auto flex-shrink-0">
          {!isSyncing ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSyncClick();
                  }}
                  className="p-1 hover:bg-muted rounded"
                  data-testid="sync-sources-btn"
                >
                  <RefreshCw className="w-4 h-4 text-muted-foreground hover:text-primary" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Sync sources</TooltipContent>
            </Tooltip>
          ) : (
            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
          )}
        </div>
      )}
    </div>
  );
}

export default function ProjectTree({
  sourcesModels,
  handleNodeClick,
  handleSyncClick,
  isSyncing = false,
  onClose,
}: ProjectTreeProps) {
  const { ref, width, height } = useResizeObserver<HTMLDivElement>();
  const [searchTerm, setSearchTerm] = useState('');
  const searchTermRef = useRef('');

  // Build tree data from sources/models
  const treeData = useMemo(() => {
    let filteredModels = sourcesModels;

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filteredModels = sourcesModels.filter(
        (model) =>
          model.schema.toLowerCase().includes(searchLower) ||
          model.name.toLowerCase().includes(searchLower)
      );
    }

    // Group by schema
    const bySchema = filteredModels.reduce(
      (acc, model) => {
        if (!acc[model.schema]) {
          acc[model.schema] = [];
        }
        acc[model.schema].push(model);
        return acc;
      },
      {} as Record<string, DbtModelResponse[]>
    );

    // Build tree structure
    const schemaNodes = Object.entries(bySchema).map(([schema, models], idx) => ({
      id: String(idx + 1),
      schema,
      children: models.map((model) => ({
        id: model.uuid,
        schema: model.schema,
        name: model.name,
        type: model.type,
        uuid: model.uuid,
      })),
    }));

    // Wrap in root "Data" folder
    return [
      {
        id: '0',
        schema: 'Data',
        children: schemaNodes,
      },
    ];
  }, [sourcesModels, searchTerm]);

  // Calculate tree height
  const SEARCH_HEIGHT = 70;
  const PADDING = 16;
  const treeHeight = height ? Math.max(200, height - SEARCH_HEIGHT - PADDING) : 400;

  return (
    <div className="h-full bg-muted/30">
      {/* Header */}
      <div className="h-11 bg-muted/50 border-b flex items-center px-2">
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
            data-testid="close-tree-btn"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div
        ref={ref}
        className="h-[calc(100%-44px)] p-2 relative"
      >
        {/* Syncing overlay */}
        {isSyncing && (
          <div className="absolute inset-0 bg-background/80 z-10 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Fetching latest schemas and tables...
            </p>
          </div>
        )}

        {/* Search */}
        <div className={cn('px-2 py-1', isSyncing && 'opacity-50 pointer-events-none')}>
          <Input
            placeholder="Search schemas and tables..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              searchTermRef.current = e.target.value;
            }}
            disabled={isSyncing}
            className="h-9"
            data-testid="tree-search-input"
          />
        </div>

        {/* Tree */}
        <div className={cn('pb-2', isSyncing && 'opacity-50 pointer-events-none')}>
          {treeData.length > 0 && (
            <Tree
              data={treeData}
              openByDefault
              indent={12}
              height={treeHeight}
              width={width}
              rowHeight={32}
              onSelect={handleNodeClick}
              childrenAccessor={(d) => d.children}
            >
              {(props) => (
                <TreeNodeRenderer
                  {...props}
                  handleSyncClick={handleSyncClick}
                  isSyncing={isSyncing}
                />
              )}
            </Tree>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Tree Data Structure

```typescript
// Input: DbtModelResponse[]
[
  { uuid: '1', name: 'customers', schema: 'raw_data', type: 'source' },
  { uuid: '2', name: 'orders', schema: 'raw_data', type: 'source' },
  { uuid: '3', name: 'stg_customers', schema: 'staging', type: 'model' },
]

// Output: TreeNode[]
[
  {
    id: '0',
    schema: 'Data',
    children: [
      {
        id: '1',
        schema: 'raw_data',
        children: [
          { id: '1', name: 'customers', schema: 'raw_data', type: 'source' },
          { id: '2', name: 'orders', schema: 'raw_data', type: 'source' },
        ]
      },
      {
        id: '2',
        schema: 'staging',
        children: [
          { id: '3', name: 'stg_customers', schema: 'staging', type: 'model' },
        ]
      }
    ]
  }
]
```

---

## Key Features

1. **Hierarchical tree view**: Data > Schema > Table structure
2. **Search filtering**: Filters across schemas and table names
3. **Sync button**: Refreshes sources from warehouse
4. **Delete source**: Remove source from tree/canvas
5. **Add to canvas**: Click leaf node to add to canvas
6. **Auto-expand**: Root folder expanded by default
7. **Syncing overlay**: Shows loading state during sync

---

## Dependencies

- **react-arborist**: Tree component library
- **use-resize-observer**: For responsive tree height

---

## Implementation Checklist

- [ ] Create ProjectTree component
- [ ] Implement tree data transformation
- [ ] Implement TreeNodeRenderer with icons
- [ ] Add search filtering
- [ ] Add sync button with loading state
- [ ] Add delete/add actions on leaf nodes
- [ ] Implement syncing overlay
- [ ] Add close button for embedded mode
- [ ] Style with Tailwind
- [ ] Add data-testid attributes
