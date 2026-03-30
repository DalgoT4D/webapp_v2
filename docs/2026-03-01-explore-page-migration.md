# Explore Page Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the Explore page from webapp (legacy Next.js 14) to webapp_v2 (Next.js 15 + React 19), replacing iframe embedding with native implementation.

**Architecture:** Full-page layout with resizable left sidebar (ProjectTree with schema/table hierarchy) and right content panel (tabbed Preview + Statistics views). Uses SWR for data fetching, Zustand for local state, and ECharts for all visualizations. Statistics use async task polling with 5-second intervals.

**Tech Stack:** Next.js 15, React 19, TypeScript, SWR, Zustand, ECharts, react-arborist, Tailwind CSS, Radix UI

---

## Pre-Implementation Setup

### Task 0: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install required packages**

Run:
```bash
npm install react-arborist use-resize-observer
```

Expected: Packages installed successfully

**Step 2: Verify installation**

Run:
```bash
npm list react-arborist use-resize-observer
```

Expected: Both packages listed with versions

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-arborist and use-resize-observer for explore page"
```

---

## Phase 1: Foundation

### Task 1: Create Type Definitions

**Files:**
- Create: `types/explore.ts`

**Step 1: Write type definitions**

```typescript
// types/explore.ts

export interface WarehouseTable {
  id: string;
  name: string;
  schema: string;
  type: 'source' | 'model';
}

export interface TableColumn {
  name: string;
  data_type: string;
}

export interface TableColumnWithType {
  name: string;
  translated_type: 'Numeric' | 'String' | 'Boolean' | 'Datetime' | 'Json';
}

export interface PreviewTableData {
  schema: string;
  table: string;
}

export interface TaskProgress {
  status: 'pending' | 'completed' | 'failed' | 'error';
  results?: NumericStats | StringStats | BooleanStats | DatetimeStats;
}

export interface NumericStats {
  minVal: number;
  maxVal: number;
  mean: number;
  median: number;
  mode: number;
  other_modes?: number[];
}

export interface StringStats {
  charts: Array<{ data: Array<{ category: string; count: number }> }>;
  count: number;
  countNull: number;
  countDistinct: number;
  minVal?: string;
  maxVal?: string;
  mode?: string;
}

export interface BooleanStats {
  count: number;
  countTrue: number;
  countFalse: number;
}

export interface DatetimeStats {
  charts: Array<{ data: Array<{ year?: number; month?: number; day?: number; frequency: number }> }>;
  minVal: string;
  maxVal: string;
}

export interface MetricsRequest {
  db_schema: string;
  db_table: string;
  column_name: string;
  filter?: {
    range: 'year' | 'month' | 'day';
    limit: number;
    offset: number;
  };
}

export interface DbtModelResponse {
  id: string;
  name: string;
  schema: string;
  type: 'source' | 'model';
  display_name: string;
  source_name: string;
  sql_path: string;
  output_cols: string[];
  uuid: string;
}

export interface TreeNode {
  id: string;
  schema: string;
  name?: string;
  type?: 'source' | 'model';
  display_name?: string;
  source_name?: string;
  children?: TreeNode[];
}

export interface SortConfig {
  column: string | null;
  order: 1 | -1;
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
}
```

**Step 2: Commit**

```bash
git add types/explore.ts
git commit -m "feat(explore): add type definitions for explore page"
```

---

### Task 2: Create Zustand Store

**Files:**
- Create: `stores/exploreStore.ts`

**Step 1: Write the store**

```typescript
// stores/exploreStore.ts
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SelectedTable {
  schema: string;
  table: string;
}

interface ExploreState {
  // Selected table
  selectedTable: SelectedTable | null;
  setSelectedTable: (table: SelectedTable | null) => void;

  // Active tab
  activeTab: 'preview' | 'statistics';
  setActiveTab: (tab: 'preview' | 'statistics') => void;

  // Sidebar width (for persistence)
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;

  // Search term for tree
  searchTerm: string;
  setSearchTerm: (term: string) => void;

  // Reset state
  reset: () => void;
}

const initialState = {
  selectedTable: null,
  activeTab: 'preview' as const,
  sidebarWidth: 280,
  searchTerm: '',
};

export const useExploreStore = create<ExploreState>()(
  persist(
    (set) => ({
      ...initialState,

      setSelectedTable: (table) => set({ selectedTable: table }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      setSidebarWidth: (width) => set({ sidebarWidth: width }),

      setSearchTerm: (term) => set({ searchTerm: term }),

      reset: () => set(initialState),
    }),
    {
      name: 'explore-storage',
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
      }),
    }
  )
);
```

**Step 2: Commit**

```bash
git add stores/exploreStore.ts
git commit -m "feat(explore): add Zustand store for explore state management"
```

---

### Task 3: Create Warehouse API Hooks

**Files:**
- Create: `hooks/api/useWarehouse.ts`

**Step 1: Write the API hooks**

```typescript
// hooks/api/useWarehouse.ts
'use client';

import useSWR from 'swr';
import { apiGet, apiPost, apiPostBinary } from '@/lib/api';
import type {
  WarehouseTable,
  TableColumn,
  TableColumnWithType,
  MetricsRequest,
} from '@/types/explore';

// Fetch all warehouse tables
export function useWarehouseTables(fresh?: boolean) {
  const url = fresh ? '/api/warehouse/sync_tables?fresh=1' : '/api/warehouse/sync_tables';

  return useSWR<WarehouseTable[]>(url, apiGet, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });
}

// Fetch table columns
export function useTableColumns(schema: string | null, table: string | null) {
  const url = schema && table
    ? `/api/warehouse/table_columns/${schema}/${table}`
    : null;

  return useSWR<TableColumn[]>(url, apiGet, {
    revalidateOnFocus: false,
  });
}

// Fetch table column types (for statistics)
export function useTableColumnTypes(schema: string | null, table: string | null) {
  const url = schema && table
    ? `/api/warehouse/v1/table_data/${schema}/${table}`
    : null;

  return useSWR<TableColumnWithType[]>(url, apiGet, {
    revalidateOnFocus: false,
  });
}

// Fetch table data (paginated)
export function useTableData(
  schema: string | null,
  table: string | null,
  params: {
    page: number;
    limit: number;
    order_by?: string;
    order?: 1 | -1;
  }
) {
  const searchParams = new URLSearchParams({
    page: params.page.toString(),
    limit: params.limit.toString(),
  });

  if (params.order_by) {
    searchParams.set('order_by', params.order_by);
    searchParams.set('order', (params.order ?? 1).toString());
  }

  const url = schema && table
    ? `/api/warehouse/table_data/${schema}/${table}?${searchParams.toString()}`
    : null;

  return useSWR<Record<string, unknown>[]>(url, apiGet, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
}

// Fetch row count
export function useTableCount(schema: string | null, table: string | null) {
  const url = schema && table
    ? `/api/warehouse/table_count/${schema}/${table}`
    : null;

  return useSWR<{ total_rows: number }>(url, apiGet, {
    revalidateOnFocus: false,
  });
}

// Download table as CSV (imperative, not hook)
export async function downloadTableCSV(schema: string, table: string): Promise<void> {
  const blob = await apiPostBinary(`/api/warehouse/download/${schema}/${table}`, {});

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${schema}_${table}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// Request statistics calculation (returns task_id)
export async function requestTableMetrics(params: MetricsRequest): Promise<{ task_id: string }> {
  return apiPost('/api/warehouse/insights/metrics/', params);
}

// Poll task status
export function useTaskStatus(taskId: string | null, options?: { refreshInterval?: number }) {
  const url = taskId ? `/api/tasks/${taskId}?hashkey=data-insights` : null;

  return useSWR<{ progress: Array<{ status: string; results?: unknown }> }>(
    url,
    apiGet,
    {
      refreshInterval: (data) => {
        if (!data) return options?.refreshInterval ?? 5000;
        const latest = data.progress?.[data.progress.length - 1];
        if (latest?.status === 'completed' || latest?.status === 'failed' || latest?.status === 'error') {
          return 0; // Stop polling
        }
        return options?.refreshInterval ?? 5000;
      },
      revalidateOnFocus: false,
    }
  );
}

// Sync warehouse tables (trigger refresh)
export async function syncWarehouseTables(): Promise<WarehouseTable[]> {
  return apiGet('/api/warehouse/sync_tables?fresh=1');
}
```

**Step 2: Commit**

```bash
git add hooks/api/useWarehouse.ts
git commit -m "feat(explore): add SWR hooks for warehouse API"
```

---

### Task 4: Add Explore Constants

**Files:**
- Create: `constants/explore.ts`

**Step 1: Write constants**

```typescript
// constants/explore.ts

export const EXPLORE_COLORS = {
  PRIMARY_TEAL: '#00897b',
  TEAL_PALETTE: ['#00897b', '#33a195', '#66b8b0', '#98d0c9', '#cce7e4', '#c7d8d7'],
  STAT_BOX_BG: '#F5FAFA',
  LABEL_COLOR: 'rgba(15, 36, 64, 0.57)',
} as const;

export const EXPLORE_DIMENSIONS = {
  CHART_WIDTH: 700,
  CHART_HEIGHT: 100,
  TREE_ROW_HEIGHT: 30,
  TREE_INDENT: 8,
  SIDEBAR_MIN_WIDTH: 280,
  SIDEBAR_MAX_WIDTH: 550,
  SIDEBAR_DEFAULT_WIDTH: 280,
  STATISTICS_ROW_HEIGHT: 180,
  BAR_HEIGHT: 16,
} as const;

export const PAGE_SIZE_OPTIONS = [5, 10, 25, 100] as const;

export const DEFAULT_PAGE_SIZE = 10;

export const POLLING_INTERVAL = 5000; // 5 seconds

export const POLLING_INITIAL_DELAY = 1000; // 1 second before first poll

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;
```

**Step 2: Commit**

```bash
git add constants/explore.ts
git commit -m "feat(explore): add explore page constants"
```

---

## Phase 2: Layout & Tree

### Task 5: Create Main Explore Component

**Files:**
- Create: `components/explore/Explore.tsx`
- Modify: `app/explore/page.tsx`

**Step 1: Write the main Explore component**

```typescript
// components/explore/Explore.tsx
'use client';

import { useCallback, useEffect } from 'react';
import { Resizable } from 'react-resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useExploreStore } from '@/stores/exploreStore';
import { useWarehouseTables, syncWarehouseTables } from '@/hooks/api/useWarehouse';
import { useFeatureFlags, FeatureFlagKeys } from '@/hooks/api/useFeatureFlags';
import { ProjectTree } from './ProjectTree';
import { PreviewPane } from './PreviewPane';
import { StatisticsPane } from './StatisticsPane';
import { toast } from 'sonner';
import { EXPLORE_DIMENSIONS } from '@/constants/explore';

import 'react-resizable/css/styles.css';

export function Explore() {
  const {
    selectedTable,
    setSelectedTable,
    activeTab,
    setActiveTab,
    sidebarWidth,
    setSidebarWidth,
    reset,
  } = useExploreStore();

  const { data: tables, isLoading: tablesLoading, mutate: mutateTables } = useWarehouseTables();
  const { isFeatureFlagEnabled } = useFeatureFlags();

  const showStatisticsTab = isFeatureFlagEnabled(FeatureFlagKeys.DATA_STATISTICS);

  // Reset state on mount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const handleTableSelect = useCallback((schema: string, table: string) => {
    setSelectedTable({ schema, table });
    setActiveTab('preview');
  }, [setSelectedTable, setActiveTab]);

  const handleSync = useCallback(async () => {
    try {
      const freshTables = await syncWarehouseTables();
      mutateTables(freshTables, false);
      toast.success('Tables synced with warehouse');
    } catch (error) {
      toast.error('Failed to sync tables');
      console.error('Sync error:', error);
    }
  }, [mutateTables]);

  const handleResize = useCallback(
    (_event: React.SyntheticEvent, { size }: { size: { width: number } }) => {
      setSidebarWidth(size.width);
    },
    [setSidebarWidth]
  );

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden">
      {/* Resizable Sidebar */}
      <Resizable
        width={sidebarWidth}
        height={0}
        onResize={handleResize}
        minConstraints={[EXPLORE_DIMENSIONS.SIDEBAR_MIN_WIDTH, 0]}
        maxConstraints={[EXPLORE_DIMENSIONS.SIDEBAR_MAX_WIDTH, 0]}
        handle={
          <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-border hover:bg-primary/50 transition-colors" />
        }
        axis="x"
      >
        <div
          className="relative h-full border-r bg-background"
          style={{ width: sidebarWidth }}
        >
          <ProjectTree
            tables={tables ?? []}
            loading={tablesLoading}
            onSync={handleSync}
            onTableSelect={handleTableSelect}
            selectedTable={selectedTable}
          />
        </div>
      </Resizable>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedTable ? (
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'preview' | 'statistics')}
            className="flex flex-col h-full"
          >
            <div className="border-b px-4">
              <TabsList className="h-12">
                <TabsTrigger value="preview" data-testid="preview-tab">
                  Preview
                </TabsTrigger>
                {showStatisticsTab && (
                  <TabsTrigger value="statistics" data-testid="statistics-tab">
                    Data Statistics
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <TabsContent value="preview" className="flex-1 overflow-hidden m-0">
              <PreviewPane
                schema={selectedTable.schema}
                table={selectedTable.table}
              />
            </TabsContent>

            {showStatisticsTab && (
              <TabsContent value="statistics" className="flex-1 overflow-hidden m-0">
                <StatisticsPane
                  schema={selectedTable.schema}
                  table={selectedTable.table}
                />
              </TabsContent>
            )}
          </Tabs>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Select a table from the left pane to view</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Update app/explore/page.tsx**

```typescript
// app/explore/page.tsx
import { Explore } from '@/components/explore/Explore';

export default function ExplorePage() {
  return <Explore />;
}
```

**Step 3: Commit**

```bash
git add components/explore/Explore.tsx app/explore/page.tsx
git commit -m "feat(explore): add main Explore component with resizable layout"
```

---

### Task 6: Create ProjectTree Component

**Files:**
- Create: `components/explore/ProjectTree.tsx`

**Step 1: Write the ProjectTree component**

```typescript
// components/explore/ProjectTree.tsx
'use client';

import { useMemo, useCallback, useRef } from 'react';
import { Tree, TreeApi } from 'react-arborist';
import useResizeObserver from 'use-resize-observer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Search, RefreshCw, Folder, FolderOpen, Table2, Loader2 } from 'lucide-react';
import { useExploreStore } from '@/stores/exploreStore';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import type { WarehouseTable, TreeNode } from '@/types/explore';
import { EXPLORE_DIMENSIONS } from '@/constants/explore';
import { cn } from '@/lib/utils';

interface ProjectTreeProps {
  tables: WarehouseTable[];
  loading: boolean;
  onSync: () => void;
  onTableSelect: (schema: string, table: string) => void;
  selectedTable: { schema: string; table: string } | null;
  included_in?: 'explore' | 'visual_designer';
}

interface NodeRendererProps {
  node: {
    id: string;
    data: TreeNode;
    isOpen: boolean;
    isSelected: boolean;
    toggle: () => void;
    select: () => void;
  };
  style: React.CSSProperties;
}

export function ProjectTree({
  tables,
  loading,
  onSync,
  onTableSelect,
  selectedTable,
  included_in = 'explore',
}: ProjectTreeProps) {
  const { ref: containerRef, width = 280, height = 400 } = useResizeObserver<HTMLDivElement>();
  const treeRef = useRef<TreeApi<TreeNode>>(null);
  const { searchTerm, setSearchTerm } = useExploreStore();
  const { permissions } = useUserPermissions();

  const canCreateModel = permissions.includes('can_create_dbt_model');
  const canSyncSources = permissions.includes('can_sync_sources');

  // Build tree data structure
  const treeData = useMemo<TreeNode[]>(() => {
    if (!tables || tables.length === 0) {
      return [];
    }

    // Group tables by schema
    const schemaMap = new Map<string, WarehouseTable[]>();
    tables.forEach((table) => {
      const existing = schemaMap.get(table.schema) || [];
      existing.push(table);
      schemaMap.set(table.schema, existing);
    });

    // Build tree structure
    const schemaNodes: TreeNode[] = Array.from(schemaMap.entries()).map(
      ([schema, schemaTables]) => ({
        id: `schema-${schema}`,
        schema,
        children: schemaTables.map((t) => ({
          id: t.id,
          schema: t.schema,
          name: t.name,
          type: t.type,
          display_name: t.name,
          source_name: t.schema,
        })),
      })
    );

    return [
      {
        id: 'root',
        schema: 'Data',
        children: schemaNodes,
      },
    ];
  }, [tables]);

  // Filter tree based on search term
  const filteredTreeData = useMemo(() => {
    if (!searchTerm.trim()) {
      return treeData;
    }

    const lowerSearch = searchTerm.toLowerCase();

    const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
      return nodes
        .map((node) => {
          // Check if this node matches
          const nameMatch = node.name?.toLowerCase().includes(lowerSearch);
          const schemaMatch = node.schema?.toLowerCase().includes(lowerSearch);

          // Filter children recursively
          const filteredChildren = node.children
            ? filterNodes(node.children)
            : undefined;

          // Include node if it matches or has matching children
          if (nameMatch || schemaMatch || (filteredChildren && filteredChildren.length > 0)) {
            return {
              ...node,
              children: filteredChildren,
            };
          }

          return null;
        })
        .filter((n): n is TreeNode => n !== null);
    };

    return filterNodes(treeData);
  }, [treeData, searchTerm]);

  const handleNodeClick = useCallback(
    (nodes: TreeNode[]) => {
      const node = nodes[0];
      if (!node || !canCreateModel) return;

      // Only handle leaf nodes (tables)
      if (node.name && node.schema) {
        onTableSelect(node.schema, node.name);
      }
    },
    [canCreateModel, onTableSelect]
  );

  const SEARCH_AREA_HEIGHT = 70;
  const BOTTOM_PADDING = 16;
  const treeHeight = Math.max(200, height - SEARCH_AREA_HEIGHT - BOTTOM_PADDING);

  // Custom node renderer
  const Node = useCallback(
    ({ node, style }: NodeRendererProps) => {
      const isFolder = !!node.data.children;
      const isRoot = node.id === 'root';
      const isSelected =
        selectedTable &&
        node.data.name === selectedTable.table &&
        node.data.schema === selectedTable.schema;

      const displayName = isRoot
        ? 'Data'
        : isFolder
          ? node.data.schema
          : node.data.name ?? '';

      return (
        <div
          style={style}
          className={cn(
            'flex items-center gap-2 px-2 py-1 cursor-pointer rounded-sm',
            'hover:bg-accent transition-colors',
            isSelected && 'bg-accent',
            !canCreateModel && 'opacity-50 cursor-not-allowed'
          )}
          onClick={() => {
            if (isFolder) {
              node.toggle();
            } else {
              node.select();
            }
          }}
          data-testid={isFolder ? `schema-${node.data.schema}` : `table-${node.data.name}`}
        >
          {isFolder ? (
            node.isOpen ? (
              <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )
          ) : (
            <Table2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="truncate text-sm">{displayName}</span>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{displayName}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
    [canCreateModel, selectedTable]
  );

  return (
    <div ref={containerRef} className="flex flex-col h-full p-3">
      {/* Search & Sync */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tables..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="tree-search-input"
          />
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onSync}
                disabled={loading || !canSyncSources}
                className={cn(!canSyncSources && 'opacity-50')}
                data-testid="sync-tables-btn"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Sync tables with warehouse</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* Tree */}
      {filteredTreeData.length > 0 ? (
        <Tree<TreeNode>
          ref={treeRef}
          data={filteredTreeData}
          openByDefault={!!searchTerm}
          indent={EXPLORE_DIMENSIONS.TREE_INDENT}
          rowHeight={EXPLORE_DIMENSIONS.TREE_ROW_HEIGHT}
          height={treeHeight}
          width={width - 24} // Account for padding
          onSelect={handleNodeClick}
          childrenAccessor="children"
        >
          {Node}
        </Tree>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          {searchTerm ? 'No matching tables' : 'No data sources available'}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/explore/ProjectTree.tsx
git commit -m "feat(explore): add ProjectTree component with search and sync"
```

---

## Phase 3: Preview Tab

### Task 7: Create PreviewPane Component

**Files:**
- Create: `components/explore/PreviewPane.tsx`

**Step 1: Write the PreviewPane component**

```typescript
// components/explore/PreviewPane.tsx
'use client';

import { useState, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useTableData, useTableColumns, useTableCount, downloadTableCSV } from '@/hooks/api/useWarehouse';
import { toast } from 'sonner';
import { PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from '@/constants/explore';
import type { SortConfig, PaginationConfig } from '@/types/explore';

interface PreviewPaneProps {
  schema: string;
  table: string;
}

export function PreviewPane({ schema, table }: PreviewPaneProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: null, order: 1 });
  const [pagination, setPagination] = useState<PaginationConfig>({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  const [downloading, setDownloading] = useState(false);

  const { data: columns, isLoading: columnsLoading } = useTableColumns(schema, table);
  const { data: tableData, isLoading: dataLoading } = useTableData(schema, table, {
    page: pagination.page,
    limit: pagination.pageSize,
    order_by: sortConfig.column ?? undefined,
    order: sortConfig.column ? sortConfig.order : undefined,
  });
  const { data: countData } = useTableCount(schema, table);

  const totalRows = countData?.total_rows ?? 0;
  const totalPages = Math.ceil(totalRows / pagination.pageSize);
  const startRow = (pagination.page - 1) * pagination.pageSize + 1;
  const endRow = Math.min(pagination.page * pagination.pageSize, totalRows);

  const handleSort = useCallback((columnName: string) => {
    setSortConfig((prev) => {
      if (prev.column === columnName) {
        return { column: columnName, order: prev.order === 1 ? -1 : 1 };
      }
      return { column: columnName, order: 1 };
    });
    // Reset to first page when sorting changes
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      await downloadTableCSV(schema, table);
      toast.success('CSV downloaded successfully');
    } catch (error) {
      toast.error('Failed to download CSV');
      console.error('Download error:', error);
    } finally {
      setDownloading(false);
    }
  }, [schema, table]);

  const handlePageSizeChange = useCallback((value: string) => {
    setPagination({ page: 1, pageSize: parseInt(value, 10) });
  }, []);

  const handlePrevPage = useCallback(() => {
    setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }));
  }, []);

  const handleNextPage = useCallback(() => {
    setPagination((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }));
  }, [totalPages]);

  const isLoading = columnsLoading || dataLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="font-medium text-lg" data-testid="preview-table-name">
          {schema}.{table}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={downloading || isLoading}
          data-testid="download-csv-btn"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Download CSV
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-4 w-24" />
                  </TableHead>
                ))
              ) : (
                columns?.map((col) => (
                  <TableHead
                    key={col.name}
                    className="cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => handleSort(col.name)}
                    data-testid={`sort-header-${col.name}`}
                  >
                    <div className="flex items-center gap-1">
                      {col.name}
                      {sortConfig.column === col.name ? (
                        sortConfig.order === 1 ? (
                          <ArrowUp className="h-4 w-4" />
                        ) : (
                          <ArrowDown className="h-4 w-4" />
                        )
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-30" />
                      )}
                    </div>
                  </TableHead>
                ))
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: pagination.pageSize }).map((_, rowIdx) => (
                <TableRow key={rowIdx}>
                  {Array.from({ length: 5 }).map((_, cellIdx) => (
                    <TableCell key={cellIdx}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : tableData && tableData.length > 0 ? (
              tableData.map((row, rowIdx) => (
                <TableRow key={rowIdx} data-testid={`data-row-${rowIdx}`}>
                  {columns?.map((col) => (
                    <TableCell key={col.name} className="max-w-xs truncate">
                      {row[col.name] != null ? String(row[col.name]) : ''}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns?.length ?? 5}
                  className="text-center text-muted-foreground py-8"
                >
                  No data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <Select
            value={pagination.pageSize.toString()}
            onValueChange={handlePageSizeChange}
          >
            <SelectTrigger className="w-[70px]" data-testid="page-size-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground" data-testid="pagination-info">
            {totalRows > 0 ? `${startRow}-${endRow} of ${totalRows.toLocaleString()}` : '0 rows'}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevPage}
              disabled={pagination.page <= 1 || isLoading}
              data-testid="prev-page-btn"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextPage}
              disabled={pagination.page >= totalPages || isLoading}
              data-testid="next-page-btn"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/explore/PreviewPane.tsx
git commit -m "feat(explore): add PreviewPane with sorting, pagination, and CSV download"
```

---

## Phase 4: Statistics Tab

### Task 8: Create StatisticsPane Component

**Files:**
- Create: `components/explore/StatisticsPane.tsx`

**Step 1: Write the StatisticsPane component**

```typescript
// components/explore/StatisticsPane.tsx
'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useTableColumnTypes, useTableCount, requestTableMetrics, useTaskStatus } from '@/hooks/api/useWarehouse';
import { NumberInsights } from './charts/NumberInsights';
import { StringInsights } from './charts/StringInsights';
import { RangeChart } from './charts/RangeChart';
import { DateTimeInsights } from './charts/DateTimeInsights';
import { toast } from 'sonner';
import { EXPLORE_DIMENSIONS, POLLING_INITIAL_DELAY } from '@/constants/explore';
import type { TableColumnWithType, NumericStats, StringStats, BooleanStats, DatetimeStats } from '@/types/explore';

interface StatisticsPaneProps {
  schema: string;
  table: string;
}

interface ColumnStatistics {
  loading: boolean;
  error: boolean;
  data: NumericStats | StringStats | BooleanStats | DatetimeStats | null;
  taskId: string | null;
}

type SortField = 'name' | 'type';
type SortOrder = 'asc' | 'desc';

export function StatisticsPane({ schema, table }: StatisticsPaneProps) {
  const [columnStats, setColumnStats] = useState<Map<string, ColumnStatistics>>(new Map());
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: columns, isLoading: columnsLoading } = useTableColumnTypes(schema, table);
  const { data: countData, isLoading: countLoading } = useTableCount(schema, table);

  const totalRows = countData?.total_rows ?? 0;

  // Sort columns
  const sortedColumns = useMemo(() => {
    if (!columns) return [];

    return [...columns].sort((a, b) => {
      const aVal = sortField === 'name' ? a.name : a.translated_type;
      const bVal = sortField === 'name' ? b.name : b.translated_type;
      const comparison = aVal.localeCompare(bVal);
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [columns, sortField, sortOrder]);

  // Fetch statistics for each column
  const fetchColumnStats = useCallback(async (column: TableColumnWithType) => {
    setColumnStats((prev) => {
      const next = new Map(prev);
      next.set(column.name, { loading: true, error: false, data: null, taskId: null });
      return next;
    });

    try {
      const response = await requestTableMetrics({
        db_schema: schema,
        db_table: table,
        column_name: column.name,
      });

      // Wait initial delay before polling starts
      await new Promise((resolve) => setTimeout(resolve, POLLING_INITIAL_DELAY));

      setColumnStats((prev) => {
        const next = new Map(prev);
        next.set(column.name, { loading: true, error: false, data: null, taskId: response.task_id });
        return next;
      });
    } catch (error) {
      console.error(`Failed to request stats for ${column.name}:`, error);
      setColumnStats((prev) => {
        const next = new Map(prev);
        next.set(column.name, { loading: false, error: true, data: null, taskId: null });
        return next;
      });
    }
  }, [schema, table]);

  // Fetch all column stats on mount or refresh
  useEffect(() => {
    if (!columns || columns.length === 0 || totalRows === 0) return;

    columns.forEach((col) => {
      fetchColumnStats(col);
    });

    // Cleanup on unmount
    return () => {
      // Clear all states
      setColumnStats(new Map());
    };
  }, [columns, totalRows, refreshKey, fetchColumnStats]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
    toast.success('Refreshing statistics...');
  }, []);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  }, [sortField]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 opacity-30" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  const isLoading = columnsLoading || countLoading;

  if (totalRows === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        No data (0 rows) available
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-4">
          <h2 className="font-medium text-lg" data-testid="statistics-table-name">
            {schema}.{table}
          </h2>
          <span className="text-sm text-muted-foreground">
            {columns?.length ?? 0} columns · {totalRows.toLocaleString()} rows
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          data-testid="refresh-stats-btn"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead
                className="w-[200px] cursor-pointer hover:bg-muted"
                onClick={() => handleSort('name')}
                data-testid="sort-column-name"
              >
                <div className="flex items-center gap-1">
                  Column
                  {renderSortIcon('name')}
                </div>
              </TableHead>
              <TableHead
                className="w-[120px] cursor-pointer hover:bg-muted"
                onClick={() => handleSort('type')}
                data-testid="sort-column-type"
              >
                <div className="flex items-center gap-1">
                  Type
                  {renderSortIcon('type')}
                </div>
              </TableHead>
              <TableHead className="w-[100px]">Distinct</TableHead>
              <TableHead className="w-[100px]">Nulls</TableHead>
              <TableHead>Distribution</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-24 w-full" /></TableCell>
                </TableRow>
              ))
            ) : (
              sortedColumns.map((col) => (
                <StatisticsRow
                  key={col.name}
                  column={col}
                  stats={columnStats.get(col.name)}
                  schema={schema}
                  table={table}
                  totalRows={totalRows}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Separate component for each row to handle individual polling
interface StatisticsRowProps {
  column: TableColumnWithType;
  stats?: ColumnStatistics;
  schema: string;
  table: string;
  totalRows: number;
}

function StatisticsRow({ column, stats, schema, table, totalRows }: StatisticsRowProps) {
  const [localStats, setLocalStats] = useState<ColumnStatistics | undefined>(stats);

  // Poll for task status
  const { data: taskData } = useTaskStatus(stats?.taskId ?? null);

  // Update local stats when polling completes
  useEffect(() => {
    if (taskData?.progress) {
      const latest = taskData.progress[taskData.progress.length - 1];
      if (latest.status === 'completed' && latest.results) {
        setLocalStats({
          loading: false,
          error: false,
          data: latest.results as NumericStats | StringStats | BooleanStats | DatetimeStats,
          taskId: null,
        });
      } else if (latest.status === 'failed' || latest.status === 'error') {
        setLocalStats({
          loading: false,
          error: true,
          data: null,
          taskId: null,
        });
      }
    }
  }, [taskData]);

  // Update when stats prop changes
  useEffect(() => {
    if (stats) {
      setLocalStats(stats);
    }
  }, [stats]);

  const renderChart = () => {
    if (!localStats || localStats.loading) {
      return <Skeleton className="h-24 w-full" />;
    }

    if (localStats.error || !localStats.data) {
      return <span className="text-muted-foreground text-sm">No data available</span>;
    }

    switch (column.translated_type) {
      case 'Numeric':
        return <NumberInsights data={localStats.data as NumericStats} />;
      case 'String':
        return <StringInsights data={localStats.data as StringStats} />;
      case 'Boolean':
        return <RangeChart data={formatBooleanData(localStats.data as BooleanStats, totalRows)} />;
      case 'Datetime':
        return (
          <DateTimeInsights
            data={localStats.data as DatetimeStats}
            schema={schema}
            table={table}
            columnName={column.name}
          />
        );
      default:
        return <span className="text-muted-foreground text-sm">Unsupported type</span>;
    }
  };

  const getDistinctCount = () => {
    if (!localStats?.data) return '-';
    const data = localStats.data as StringStats;
    return data.countDistinct?.toLocaleString() ?? '-';
  };

  const getNullCount = () => {
    if (!localStats?.data) return '-';
    const data = localStats.data as StringStats;
    return data.countNull?.toLocaleString() ?? '-';
  };

  return (
    <TableRow
      style={{ height: EXPLORE_DIMENSIONS.STATISTICS_ROW_HEIGHT }}
      data-testid={`stats-row-${column.name}`}
    >
      <TableCell className="font-medium">{column.name}</TableCell>
      <TableCell className="text-muted-foreground">{column.translated_type}</TableCell>
      <TableCell>{getDistinctCount()}</TableCell>
      <TableCell>{getNullCount()}</TableCell>
      <TableCell className="p-2">{renderChart()}</TableCell>
    </TableRow>
  );
}

// Helper to format boolean stats for RangeChart
function formatBooleanData(stats: BooleanStats, totalRows: number) {
  const truePercentage = totalRows > 0 ? ((stats.countTrue / totalRows) * 100).toFixed(1) : '0';
  const falsePercentage = totalRows > 0 ? ((stats.countFalse / totalRows) * 100).toFixed(1) : '0';
  const nullCount = totalRows - stats.countTrue - stats.countFalse;
  const nullPercentage = totalRows > 0 ? ((nullCount / totalRows) * 100).toFixed(1) : '0';

  const result = [
    { name: 'True', percentage: truePercentage, count: stats.countTrue },
    { name: 'False', percentage: falsePercentage, count: stats.countFalse },
  ];

  if (nullCount > 0) {
    result.push({ name: 'Null', percentage: nullPercentage, count: nullCount });
  }

  return result;
}
```

**Step 2: Commit**

```bash
git add components/explore/StatisticsPane.tsx
git commit -m "feat(explore): add StatisticsPane with polling and column statistics"
```

---

### Task 9: Create Chart Components Directory and Base Chart

**Files:**
- Create: `components/explore/charts/index.ts`
- Create: `components/explore/charts/BaseChart.tsx`

**Step 1: Create index file**

```typescript
// components/explore/charts/index.ts
export { NumberInsights } from './NumberInsights';
export { StringInsights } from './StringInsights';
export { RangeChart } from './RangeChart';
export { DateTimeInsights } from './DateTimeInsights';
export { BarChart } from './BarChart';
```

**Step 2: Create BaseChart component**

```typescript
// components/explore/charts/BaseChart.tsx
'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart as EBarChart, ScatterChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';

// Register ECharts components
echarts.use([
  EBarChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

interface BaseChartProps {
  option: EChartsOption;
  width?: number;
  height?: number;
  className?: string;
}

export function BaseChart({ option, width = 700, height = 100, className }: BaseChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize chart
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    // Set option
    chartInstance.current.setOption(option, { notMerge: true });

    // Cleanup
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [option]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      chartInstance.current?.resize();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (chartRef.current) {
      resizeObserver.observe(chartRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={chartRef}
      className={className}
      style={{ width, height }}
      data-testid="echarts-container"
    />
  );
}
```

**Step 3: Commit**

```bash
git add components/explore/charts/
git commit -m "feat(explore): add chart components base infrastructure"
```

---

### Task 10: Create NumberInsights Component

**Files:**
- Create: `components/explore/charts/NumberInsights.tsx`

**Step 1: Write the NumberInsights component**

```typescript
// components/explore/charts/NumberInsights.tsx
'use client';

import { useState, useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { BarChart3, List } from 'lucide-react';
import { EXPLORE_COLORS, EXPLORE_DIMENSIONS } from '@/constants/explore';
import type { EChartsOption } from 'echarts';
import type { NumericStats } from '@/types/explore';

interface NumberInsightsProps {
  data: NumericStats;
}

export function NumberInsights({ data }: NumberInsightsProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'numbers'>('chart');

  const { minVal, maxVal, mean, median, mode, other_modes } = data;

  // Check if all values are identical
  const allIdentical = minVal === maxVal;

  const chartOption = useMemo<EChartsOption>(() => {
    if (allIdentical) return {};

    const values = [
      { name: 'Min', value: minVal },
      { name: 'Max', value: maxVal },
      { name: 'Mean', value: mean },
      { name: 'Median', value: median },
    ];

    if (mode !== null && mode !== undefined) {
      values.push({ name: 'Mode', value: mode });
    }

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#fff',
        borderColor: '#000',
        borderWidth: 1,
        borderRadius: 8,
        formatter: (params: { name: string; value: number[] }) => {
          const name = params.name;
          const val = params.value[0];

          if (name === 'Mode' && other_modes && other_modes.length > 0) {
            return `${name}: ${Math.trunc(val).toLocaleString()}<br/>Other modes: ${other_modes.map(m => Math.trunc(m).toLocaleString()).join(', ')}`;
          }
          return `${name}: ${Math.trunc(val).toLocaleString()}`;
        },
      },
      xAxis: {
        type: 'value',
        min: minVal,
        max: maxVal,
        axisLabel: {
          formatter: (v: number) => Math.trunc(v).toLocaleString(),
        },
      },
      yAxis: {
        type: 'category',
        data: [''],
        show: false,
      },
      series: [
        {
          type: 'bar',
          data: [[Math.min(mean, median, mode ?? mean), Math.max(mean, median, mode ?? mean)]],
          itemStyle: { color: EXPLORE_COLORS.PRIMARY_TEAL },
          barWidth: 10,
        },
        {
          type: 'scatter',
          data: values.map((v) => ({
            value: [v.value, 0],
            name: v.name,
          })),
          symbol: 'rect',
          symbolSize: [2, 20],
          itemStyle: { color: '#000' },
          label: {
            show: true,
            position: 'top',
            formatter: (p: { name: string; value: number[] }) =>
              `${p.name}: ${Math.trunc(p.value[0]).toLocaleString()}`,
            fontSize: 10,
          },
        },
      ],
      grid: { top: 40, bottom: 20, left: 60, right: 60 },
    };
  }, [minVal, maxVal, mean, median, mode, other_modes, allIdentical]);

  if (allIdentical) {
    return (
      <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
        All entries in this column are identical ({Math.trunc(minVal).toLocaleString()})
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {viewMode === 'chart' ? (
        <BaseChart
          option={chartOption}
          width={EXPLORE_DIMENSIONS.CHART_WIDTH}
          height={EXPLORE_DIMENSIONS.CHART_HEIGHT}
        />
      ) : (
        <div className="flex items-center gap-8 min-h-[100px] min-w-[700px]">
          {[
            { key: 'minimum', label: 'Minimum', value: minVal },
            { key: 'maximum', label: 'Maximum', value: maxVal },
            { key: 'mean', label: 'Mean', value: mean },
            { key: 'median', label: 'Median', value: median },
            { key: 'mode', label: 'Mode', value: mode },
          ].map(({ key, label, value }) => (
            <div key={key} className="flex flex-col items-center">
              <span
                className="text-xs capitalize"
                style={{ color: EXPLORE_COLORS.LABEL_COLOR }}
              >
                {label}
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="h-6 w-[84px] flex items-center justify-center text-sm"
                      style={{ backgroundColor: EXPLORE_COLORS.STAT_BOX_BG }}
                    >
                      {value !== null && value !== undefined
                        ? Math.trunc(value).toLocaleString()
                        : 'NA'}
                    </div>
                  </TooltipTrigger>
                  {key === 'mode' && other_modes && other_modes.length > 0 && (
                    <TooltipContent>
                      <p>Other modes: {other_modes.map(m => Math.trunc(m).toLocaleString()).join(', ')}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          ))}
        </div>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setViewMode((prev) => (prev === 'chart' ? 'numbers' : 'chart'))}
        data-testid="toggle-view-mode"
      >
        {viewMode === 'chart' ? (
          <List className="h-4 w-4" />
        ) : (
          <BarChart3 className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/explore/charts/NumberInsights.tsx
git commit -m "feat(explore): add NumberInsights chart component"
```

---

### Task 11: Create RangeChart Component

**Files:**
- Create: `components/explore/charts/RangeChart.tsx`

**Step 1: Write the RangeChart component**

```typescript
// components/explore/charts/RangeChart.tsx
'use client';

import { useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { EXPLORE_COLORS, EXPLORE_DIMENSIONS } from '@/constants/explore';
import type { EChartsOption } from 'echarts';

interface RangeChartData {
  name: string;
  percentage: string;
  count: number;
}

interface RangeChartProps {
  data: RangeChartData[];
  barHeight?: number;
}

export function RangeChart({ data, barHeight = EXPLORE_DIMENSIONS.BAR_HEIGHT }: RangeChartProps) {
  const chartOption = useMemo<EChartsOption>(() => {
    if (!data || data.length === 0) return {};

    const colors = EXPLORE_COLORS.TEAL_PALETTE;

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#fff',
        borderColor: '#000',
        borderWidth: 1,
        borderRadius: 8,
        formatter: (params: { dataIndex: number }) => {
          const item = data[params.dataIndex];
          return `<strong>${item.name}</strong>: ${item.percentage}% | Count: ${item.count.toLocaleString()}`;
        },
      },
      legend: {
        show: true,
        bottom: 0,
        left: 'center',
        orient: 'horizontal',
        itemWidth: 16,
        itemHeight: 8,
        data: data.map((d, i) => ({
          name: d.name.length > 10 ? d.name.substring(0, 10) + '...' : d.name,
          itemStyle: { color: colors[i % colors.length] },
        })),
      },
      xAxis: {
        type: 'value',
        max: 100,
        show: false,
      },
      yAxis: {
        type: 'category',
        data: [''],
        show: false,
      },
      series: data.map((d, i) => ({
        name: d.name.length > 10 ? d.name.substring(0, 10) + '...' : d.name,
        type: 'bar',
        stack: 'total',
        data: [parseFloat(d.percentage)],
        itemStyle: { color: colors[i % colors.length] },
        barWidth: barHeight,
        label: {
          show: parseFloat(d.percentage) > 7,
          position: 'inside',
          formatter: `${d.percentage}%`,
          fontSize: 11,
          color: '#fff',
        },
      })),
      grid: { top: 30, bottom: 40, left: 0, right: 0, containLabel: false },
    };
  }, [data, barHeight]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
        No data available
      </div>
    );
  }

  return (
    <BaseChart
      option={chartOption}
      width={EXPLORE_DIMENSIONS.CHART_WIDTH}
      height={EXPLORE_DIMENSIONS.CHART_HEIGHT}
    />
  );
}
```

**Step 2: Commit**

```bash
git add components/explore/charts/RangeChart.tsx
git commit -m "feat(explore): add RangeChart component for boolean columns"
```

---

### Task 12: Create StringInsights Component

**Files:**
- Create: `components/explore/charts/StringInsights.tsx`

**Step 1: Write the StringInsights component**

```typescript
// components/explore/charts/StringInsights.tsx
'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { RangeChart } from './RangeChart';
import { BarChart } from './BarChart';
import { BarChart3, PieChart, TrendingUp } from 'lucide-react';
import type { StringStats } from '@/types/explore';

interface StringInsightsProps {
  data: StringStats;
}

type ViewMode = 'range' | 'bars' | 'stats';

export function StringInsights({ data }: StringInsightsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('range');

  const { charts, count, countNull, countDistinct } = data;

  // Check edge cases
  const isAllNull = countNull === count;
  const isAllDistinct = countDistinct === count;

  // Format data for charts
  const chartData = useMemo(() => {
    if (!charts || charts.length === 0 || !charts[0]?.data) return [];

    return charts[0].data.map((item) => {
      const percentage = count > 0
        ? ((item.count / count) * 100).toFixed(1)
        : '0';
      return {
        name: item.category,
        percentage,
        count: item.count,
        label: item.category,
        value: item.count,
      };
    });
  }, [charts, count]);

  const cycleViewMode = () => {
    setViewMode((prev) => {
      if (prev === 'range') return 'bars';
      if (prev === 'bars') return 'stats';
      return 'range';
    });
  };

  const getViewIcon = () => {
    switch (viewMode) {
      case 'range':
        return <PieChart className="h-4 w-4" />;
      case 'bars':
        return <BarChart3 className="h-4 w-4" />;
      case 'stats':
        return <TrendingUp className="h-4 w-4" />;
    }
  };

  // Edge case: all nulls
  if (isAllNull) {
    return (
      <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
        All values are NULL ({count.toLocaleString()} rows)
      </div>
    );
  }

  // Edge case: all distinct
  if (isAllDistinct && count > 10) {
    return (
      <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
        All values are distinct ({countDistinct.toLocaleString()} unique values)
      </div>
    );
  }

  // No data
  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
        No distribution data available
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        {viewMode === 'range' && <RangeChart data={chartData} />}
        {viewMode === 'bars' && <BarChart data={chartData} />}
        {viewMode === 'stats' && (
          <div className="flex flex-col gap-1 text-sm">
            <p className="text-muted-foreground text-xs mb-2">String length distribution</p>
            {chartData.slice(0, 5).map((item, idx) => (
              <div key={idx} className="flex justify-between">
                <span className="truncate max-w-[200px]">{item.name}</span>
                <span className="text-muted-foreground">
                  {item.count.toLocaleString()} ({item.percentage}%)
                </span>
              </div>
            ))}
            {chartData.length > 5 && (
              <span className="text-muted-foreground text-xs">
                +{chartData.length - 5} more
              </span>
            )}
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={cycleViewMode}
        data-testid="cycle-view-mode"
      >
        {getViewIcon()}
      </Button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/explore/charts/StringInsights.tsx
git commit -m "feat(explore): add StringInsights component with multiple view modes"
```

---

### Task 13: Create BarChart Component

**Files:**
- Create: `components/explore/charts/BarChart.tsx`

**Step 1: Write the BarChart component**

```typescript
// components/explore/charts/BarChart.tsx
'use client';

import { useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { EXPLORE_COLORS, EXPLORE_DIMENSIONS } from '@/constants/explore';
import type { EChartsOption } from 'echarts';

interface BarChartData {
  label: string;
  value: number;
  barTopLabel?: string;
}

interface BarChartProps {
  data: BarChartData[];
}

export function BarChart({ data }: BarChartProps) {
  const chartOption = useMemo<EChartsOption>(() => {
    if (!data || data.length === 0) return {};

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#fff',
        borderColor: '#000',
        borderWidth: 1,
        borderRadius: 8,
        formatter: (params: Array<{ dataIndex: number }>) => {
          const p = params[0];
          const item = data[p.dataIndex];
          // Show full label if truncated
          return `${item.label}<br/>Value: ${item.value.toLocaleString()}`;
        },
      },
      xAxis: {
        type: 'category',
        data: data.map((d) =>
          d.label.length > 10 ? d.label.substring(0, 10) + '...' : d.label
        ),
        axisLabel: {
          interval: 0,
          rotate: data.length > 6 ? 45 : 0,
          fontSize: 10,
        },
      },
      yAxis: {
        type: 'value',
      },
      series: [
        {
          type: 'bar',
          data: data.map((d) => d.value),
          itemStyle: { color: EXPLORE_COLORS.PRIMARY_TEAL },
          label: {
            show: true,
            position: 'top',
            formatter: (p: { dataIndex: number }) => {
              const item = data[p.dataIndex];
              return item.barTopLabel ?? item.value.toLocaleString();
            },
            fontSize: 10,
          },
        },
      ],
      grid: { top: 40, bottom: 60, left: 40, right: 20, containLabel: true },
    };
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
        No data available
      </div>
    );
  }

  return (
    <BaseChart
      option={chartOption}
      width={EXPLORE_DIMENSIONS.CHART_WIDTH}
      height={EXPLORE_DIMENSIONS.CHART_HEIGHT}
    />
  );
}
```

**Step 2: Commit**

```bash
git add components/explore/charts/BarChart.tsx
git commit -m "feat(explore): add BarChart component"
```

---

### Task 14: Create DateTimeInsights Component

**Files:**
- Create: `components/explore/charts/DateTimeInsights.tsx`

**Step 1: Write the DateTimeInsights component**

```typescript
// components/explore/charts/DateTimeInsights.tsx
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BaseChart } from './BaseChart';
import { ChevronLeft, ChevronRight, Calendar, List } from 'lucide-react';
import { requestTableMetrics, useTaskStatus } from '@/hooks/api/useWarehouse';
import { EXPLORE_COLORS, EXPLORE_DIMENSIONS, MONTH_NAMES, POLLING_INITIAL_DELAY } from '@/constants/explore';
import type { EChartsOption } from 'echarts';
import type { DatetimeStats } from '@/types/explore';

interface DateTimeInsightsProps {
  data: DatetimeStats;
  schema: string;
  table: string;
  columnName: string;
}

type RangeFilter = 'year' | 'month' | 'day';
type ViewMode = 'chart' | 'numbers';

interface DateFilter {
  range: RangeFilter;
  limit: number;
  offset: number;
}

export function DateTimeInsights({ data: initialData, schema, table, columnName }: DateTimeInsightsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [filter, setFilter] = useState<DateFilter>({ range: 'year', limit: 10, offset: 0 });
  const [chartData, setChartData] = useState(initialData.charts?.[0]?.data ?? []);
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);

  const { minVal, maxVal } = initialData;

  // Poll for task status when filter changes
  const { data: taskData } = useTaskStatus(taskId);

  // Update chart data when task completes
  useEffect(() => {
    if (taskData?.progress) {
      const latest = taskData.progress[taskData.progress.length - 1];
      if (latest.status === 'completed' && latest.results) {
        const results = latest.results as DatetimeStats;
        setChartData(results.charts?.[0]?.data ?? []);
        setLoading(false);
        setTaskId(null);
      } else if (latest.status === 'failed' || latest.status === 'error') {
        setLoading(false);
        setTaskId(null);
      }
    }
  }, [taskData]);

  // Fetch data when filter changes
  const fetchFilteredData = useCallback(async (newFilter: DateFilter) => {
    setLoading(true);
    try {
      const response = await requestTableMetrics({
        db_schema: schema,
        db_table: table,
        column_name: columnName,
        filter: newFilter,
      });

      await new Promise((resolve) => setTimeout(resolve, POLLING_INITIAL_DELAY));
      setTaskId(response.task_id);
    } catch (error) {
      console.error('Failed to fetch datetime data:', error);
      setLoading(false);
    }
  }, [schema, table, columnName]);

  const handlePrevPage = useCallback(() => {
    const newFilter = { ...filter, offset: Math.max(0, filter.offset - 10) };
    setFilter(newFilter);
    fetchFilteredData(newFilter);
  }, [filter, fetchFilteredData]);

  const handleNextPage = useCallback(() => {
    const newFilter = { ...filter, offset: filter.offset + 10 };
    setFilter(newFilter);
    fetchFilteredData(newFilter);
  }, [filter, fetchFilteredData]);

  const cycleRange = useCallback(() => {
    const ranges: RangeFilter[] = ['year', 'month', 'day'];
    const currentIdx = ranges.indexOf(filter.range);
    const nextRange = ranges[(currentIdx + 1) % ranges.length];
    const newFilter = { range: nextRange, limit: 10, offset: 0 };
    setFilter(newFilter);
    fetchFilteredData(newFilter);
  }, [filter.range, fetchFilteredData]);

  const formatDateLabel = useCallback((d: { year?: number; month?: number; day?: number }) => {
    if (filter.range === 'year') return d.year?.toString() ?? '';
    if (filter.range === 'month') {
      const month = d.month ? MONTH_NAMES[d.month - 1] : '';
      return `${month} ${d.year ?? ''}`;
    }
    if (filter.range === 'day') {
      const month = d.month ? MONTH_NAMES[d.month - 1] : '';
      return `${d.day ?? ''} ${month} ${d.year ?? ''}`;
    }
    return '';
  }, [filter.range]);

  const chartOption = useMemo<EChartsOption>(() => {
    if (!chartData || chartData.length === 0) return {};

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#fff',
        borderColor: '#000',
        borderWidth: 1,
        borderRadius: 8,
      },
      xAxis: {
        type: 'category',
        data: chartData.map(formatDateLabel),
        axisLabel: {
          interval: 0,
          rotate: filter.range !== 'year' ? 45 : 0,
          fontSize: 10,
        },
      },
      yAxis: {
        type: 'value',
        name: 'Frequency',
        nameTextStyle: { fontSize: 10 },
      },
      series: [
        {
          type: 'bar',
          data: chartData.map((d) => d.frequency),
          itemStyle: { color: EXPLORE_COLORS.PRIMARY_TEAL },
        },
      ],
      grid: { top: 40, bottom: 80, left: 60, right: 20, containLabel: true },
    };
  }, [chartData, formatDateLabel, filter.range]);

  // Calculate total days
  const totalDays = useMemo(() => {
    if (!minVal || !maxVal) return 0;
    const min = new Date(minVal);
    const max = new Date(maxVal);
    return Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24));
  }, [minVal, maxVal]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
        No data available
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {viewMode === 'chart' ? (
        <>
          {/* Left Arrow */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevPage}
            disabled={filter.offset === 0 || loading}
            className="h-20 w-4 rounded-sm"
            style={{ backgroundColor: EXPLORE_COLORS.STAT_BOX_BG }}
            data-testid="datetime-prev-btn"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Chart */}
          {loading ? (
            <Skeleton className="w-[600px] h-[100px]" />
          ) : (
            <BaseChart
              option={chartOption}
              width={600}
              height={EXPLORE_DIMENSIONS.CHART_HEIGHT}
            />
          )}

          {/* Right Arrow */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextPage}
            disabled={chartData.length < 10 || loading}
            className="h-20 w-4 rounded-sm"
            style={{ backgroundColor: EXPLORE_COLORS.STAT_BOX_BG }}
            data-testid="datetime-next-btn"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Range Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={cycleRange}
            className="text-xs"
            data-testid="datetime-range-toggle"
          >
            {filter.range}
          </Button>
        </>
      ) : (
        <div className="flex items-center gap-8 min-h-[100px] min-w-[600px]">
          <div className="flex flex-col items-center">
            <span className="text-xs" style={{ color: EXPLORE_COLORS.LABEL_COLOR }}>
              Min Date
            </span>
            <div
              className="h-6 px-3 flex items-center justify-center text-sm"
              style={{ backgroundColor: EXPLORE_COLORS.STAT_BOX_BG }}
            >
              {minVal ? new Date(minVal).toLocaleDateString() : 'NA'}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs" style={{ color: EXPLORE_COLORS.LABEL_COLOR }}>
              Max Date
            </span>
            <div
              className="h-6 px-3 flex items-center justify-center text-sm"
              style={{ backgroundColor: EXPLORE_COLORS.STAT_BOX_BG }}
            >
              {maxVal ? new Date(maxVal).toLocaleDateString() : 'NA'}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs" style={{ color: EXPLORE_COLORS.LABEL_COLOR }}>
              Total Days
            </span>
            <div
              className="h-6 px-3 flex items-center justify-center text-sm"
              style={{ backgroundColor: EXPLORE_COLORS.STAT_BOX_BG }}
            >
              {totalDays.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setViewMode((prev) => (prev === 'chart' ? 'numbers' : 'chart'))}
        data-testid="toggle-datetime-view"
      >
        {viewMode === 'chart' ? (
          <List className="h-4 w-4" />
        ) : (
          <Calendar className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/explore/charts/DateTimeInsights.tsx
git commit -m "feat(explore): add DateTimeInsights component with pagination and range filter"
```

---

## Phase 5: Polish & Integration

### Task 15: Create Placeholder Components (PreviewPane, StatisticsPane stubs)

**Files:**
- Create placeholder files if not already created

**Step 1: Ensure all exports are correct**

```typescript
// components/explore/index.ts
export { Explore } from './Explore';
export { ProjectTree } from './ProjectTree';
export { PreviewPane } from './PreviewPane';
export { StatisticsPane } from './StatisticsPane';
```

**Step 2: Commit**

```bash
git add components/explore/index.ts
git commit -m "feat(explore): add component exports"
```

---

### Task 16: Verify Feature Flags Setup

**Files:**
- Verify: `hooks/api/useFeatureFlags.ts`

**Step 1: Verify DATA_STATISTICS is in FeatureFlagKeys enum**

Read the file and ensure `DATA_STATISTICS` is present. If not, add it.

**Step 2: Commit if changes needed**

```bash
git add hooks/api/useFeatureFlags.ts
git commit -m "feat(explore): ensure DATA_STATISTICS feature flag is available"
```

---

### Task 17: Add Test Stubs

**Files:**
- Create: `components/explore/__tests__/explore-mock-data.ts`
- Create: `components/explore/__tests__/Explore.test.tsx`

**Step 1: Create mock data factory**

```typescript
// components/explore/__tests__/explore-mock-data.ts
import type { WarehouseTable, TableColumn, NumericStats, StringStats, BooleanStats, DatetimeStats } from '@/types/explore';

export const createMockWarehouseTable = (overrides: Partial<WarehouseTable> = {}): WarehouseTable => ({
  id: 'table-1',
  name: 'users',
  schema: 'public',
  type: 'source',
  ...overrides,
});

export const createMockTableColumn = (overrides: Partial<TableColumn> = {}): TableColumn => ({
  name: 'id',
  data_type: 'integer',
  ...overrides,
});

export const createMockNumericStats = (overrides: Partial<NumericStats> = {}): NumericStats => ({
  minVal: 0,
  maxVal: 100,
  mean: 50,
  median: 45,
  mode: 42,
  ...overrides,
});

export const createMockStringStats = (overrides: Partial<StringStats> = {}): StringStats => ({
  charts: [{ data: [{ category: 'value1', count: 10 }, { category: 'value2', count: 5 }] }],
  count: 15,
  countNull: 0,
  countDistinct: 2,
  ...overrides,
});

export const createMockBooleanStats = (overrides: Partial<BooleanStats> = {}): BooleanStats => ({
  count: 100,
  countTrue: 60,
  countFalse: 40,
  ...overrides,
});

export const createMockDatetimeStats = (overrides: Partial<DatetimeStats> = {}): DatetimeStats => ({
  charts: [{ data: [{ year: 2024, frequency: 50 }, { year: 2025, frequency: 75 }] }],
  minVal: '2024-01-01',
  maxVal: '2025-12-31',
  ...overrides,
});

export const createMockWarehouseTables = (): WarehouseTable[] => [
  createMockWarehouseTable({ id: '1', name: 'users', schema: 'public' }),
  createMockWarehouseTable({ id: '2', name: 'orders', schema: 'public' }),
  createMockWarehouseTable({ id: '3', name: 'products', schema: 'inventory' }),
];
```

**Step 2: Create basic test file**

```typescript
// components/explore/__tests__/Explore.test.tsx
import { render, screen } from '@testing-library/react';
import { Explore } from '../Explore';
import { TestWrapper } from '@/test-utils/render';

// Mock the hooks
jest.mock('@/hooks/api/useWarehouse', () => ({
  useWarehouseTables: () => ({ data: [], isLoading: false, mutate: jest.fn() }),
  syncWarehouseTables: jest.fn(),
}));

jest.mock('@/hooks/api/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    isFeatureFlagEnabled: () => true,
    flags: {},
    isLoading: false,
  }),
  FeatureFlagKeys: { DATA_STATISTICS: 'DATA_STATISTICS' },
}));

describe('Explore', () => {
  it('renders empty state when no table selected', () => {
    render(
      <TestWrapper>
        <Explore />
      </TestWrapper>
    );

    expect(screen.getByText('Select a table from the left pane to view')).toBeInTheDocument();
  });
});
```

**Step 3: Commit**

```bash
git add components/explore/__tests__/
git commit -m "test(explore): add mock data factories and initial tests"
```

---

### Task 18: Final Integration Verification

**Step 1: Run TypeScript check**

Run:
```bash
npm run build
```

Expected: Build completes without type errors

**Step 2: Run linting**

Run:
```bash
npm run lint
```

Expected: No errors (warnings OK)

**Step 3: Run tests**

Run:
```bash
npm run test -- --passWithNoTests
```

Expected: Tests pass

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(explore): complete explore page migration from webapp"
```

---

## Summary

### Files Created

| Path | Purpose |
|------|---------|
| `types/explore.ts` | Type definitions |
| `stores/exploreStore.ts` | Zustand state management |
| `hooks/api/useWarehouse.ts` | SWR API hooks |
| `constants/explore.ts` | Constants and colors |
| `components/explore/Explore.tsx` | Main container |
| `components/explore/ProjectTree.tsx` | Tree sidebar |
| `components/explore/PreviewPane.tsx` | Data preview tab |
| `components/explore/StatisticsPane.tsx` | Statistics tab |
| `components/explore/charts/BaseChart.tsx` | ECharts wrapper |
| `components/explore/charts/NumberInsights.tsx` | Numeric stats |
| `components/explore/charts/RangeChart.tsx` | Boolean chart |
| `components/explore/charts/StringInsights.tsx` | String distribution |
| `components/explore/charts/DateTimeInsights.tsx` | Datetime chart |
| `components/explore/charts/BarChart.tsx` | Generic bar chart |
| `components/explore/charts/index.ts` | Chart exports |
| `components/explore/index.ts` | Component exports |
| `components/explore/__tests__/explore-mock-data.ts` | Test factories |
| `components/explore/__tests__/Explore.test.tsx` | Component tests |

### Files Modified

| Path | Change |
|------|--------|
| `app/explore/page.tsx` | Update to use new Explore component |
| `package.json` | Add react-arborist, use-resize-observer |

### Total Tasks

- Phase 0: 1 task (dependencies)
- Phase 1: 4 tasks (types, store, hooks, constants)
- Phase 2: 2 tasks (layout, tree)
- Phase 3: 1 task (preview)
- Phase 4: 7 tasks (statistics, charts)
- Phase 5: 4 tasks (polish, tests, verification)

**Total: 19 tasks**
