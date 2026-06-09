// components/explore/ProjectTree.tsx
'use client';

import { useMemo, useCallback, useRef, useState } from 'react';
import { Tree, TreeApi } from 'react-arborist';
import useResizeObserver from '@/hooks/useResizeObserver';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { OverflowTooltip } from './OverflowTooltip';
import {
  Search,
  RefreshCw,
  Folder,
  FolderOpen,
  Database,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { useExploreStore } from '@/stores/exploreStore';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import type { WarehouseTable, TreeNode } from '@/types/explore';
import { EXPLORE_DIMENSIONS } from '@/constants/explore';
import { cn } from '@/lib/utils';
import { ProjectTreeMode } from '@/constants/explore';

interface ProjectTreeProps {
  tables: WarehouseTable[];
  loading: boolean;
  onSync: () => void;
  onTableSelect: (schema: string, table: string) => void;
  selectedTable: { schema: string; table: string } | null;
  included_in?: 'explore' | 'visual_designer';
  /** Mode determines behavior: 'explore' for data preview, 'canvas' for adding to canvas */
  mode?: ProjectTreeMode;
  /** Callback when user clicks add-to-canvas button on a table node (canvas mode only) */
  onAddToCanvas?: (schema: string, table: string) => void;
  /** Callback when user clicks delete button on a table node (canvas mode only) */
  onDeleteFromCanvas?: (nodeId: string) => void;
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
  mode = ProjectTreeMode.EXPLORE,
  onAddToCanvas,
  onDeleteFromCanvas,
}: ProjectTreeProps) {
  const { ref: containerRef, width = 280, height = 400 } = useResizeObserver<HTMLDivElement>();
  const treeRef = useRef<TreeApi<TreeNode>>(null);
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const globalSearchTerm = useExploreStore((s) => s.searchTerm);
  const setGlobalSearchTerm = useExploreStore((s) => s.setSearchTerm);

  // Use local state in canvas mode to avoid polluting explore page search
  const searchTerm = mode === ProjectTreeMode.CANVAS ? localSearchTerm : globalSearchTerm;
  const setSearchTerm = mode === ProjectTreeMode.CANVAS ? setLocalSearchTerm : setGlobalSearchTerm;
  const { hasPermission } = useUserPermissions();

  const canCreateModel = hasPermission('can_create_dbt_model');
  const canSyncSources = hasPermission('can_sync_sources');

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
          const filteredChildren = node.children ? filterNodes(node.children) : undefined;

          // Include node if it matches or has matching children
          if (nameMatch || schemaMatch || (filteredChildren && filteredChildren.length > 0)) {
            const filtered: TreeNode = { ...node };
            if (filteredChildren !== undefined) {
              filtered.children = filteredChildren;
            }
            return filtered;
          }

          return null;
        })
        .filter((n): n is TreeNode => n !== null);
    };

    return filterNodes(treeData);
  }, [treeData, searchTerm]);

  const handleNodeClick = useCallback(
    (nodes: { data: TreeNode }[]) => {
      const node = nodes[0];
      if (!node || !canCreateModel) return;

      // Only handle leaf nodes (tables)
      const data = node.data;
      if (data.name && data.schema && !data.children) {
        onTableSelect(data.schema, data.name);
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

      const displayName = isRoot ? 'Data' : isFolder ? node.data.schema : (node.data.name ?? '');
      const isLeaf = !isFolder && node.data.name && node.data.schema;

      return (
        <div
          style={{
            ...style,
            width: 'calc(100% - 16px)',
          }}
          className={cn(
            'flex items-center gap-1.5 pl-2 cursor-pointer transition-colors',
            'hover:bg-gray-100',
            isSelected && 'bg-teal-50 border-l-2 border-l-teal-500',
            !isSelected && 'border-l-2 border-l-transparent',
            !canCreateModel && !isFolder && 'opacity-50 cursor-not-allowed'
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
              <FolderOpen className="h-[18px] w-[18px] flex-shrink-0 text-gray-500" />
            ) : (
              <Folder className="h-[18px] w-[18px] flex-shrink-0 text-gray-500" />
            )
          ) : (
            <Database
              className={cn(
                'h-[18px] w-[18px] flex-shrink-0',
                isSelected ? 'text-teal-600' : 'text-gray-400'
              )}
            />
          )}

          <OverflowTooltip
            text={displayName}
            className={cn(
              'flex-1 min-w-0 text-sm',
              isSelected ? 'text-teal-700 font-semibold' : 'text-gray-700',
              isFolder && 'font-semibold text-gray-800'
            )}
            tooltipClassName="bg-gray-900 text-white border-gray-700 z-50"
            tooltipSide="bottom"
            tooltipAlign="start"
          />

          {/* Canvas mode actions for leaf nodes */}
          {mode === ProjectTreeMode.CANVAS && isLeaf && (
            <span className="flex items-center gap-1 flex-shrink-0 ml-1">
              {onDeleteFromCanvas && (
                <button
                  className="p-0.5 rounded hover:opacity-70 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFromCanvas(node.data.id);
                  }}
                  data-testid={`delete-source-${node.data.id}`}
                  aria-label="Remove from canvas"
                >
                  <Trash2 className="h-[18px] w-[18px] text-gray-500" />
                </button>
              )}
              {onAddToCanvas && (
                <button
                  className="p-0.5 rounded hover:opacity-70 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToCanvas(node.data.schema!, node.data.name!);
                  }}
                  data-testid={`add-to-canvas-${node.data.name}`}
                >
                  <Plus className="h-[18px] w-[18px] text-teal-600" />
                </button>
              )}
            </span>
          )}
        </div>
      );
    },
    [canCreateModel, selectedTable, mode, onAddToCanvas, onDeleteFromCanvas]
  );

  return (
    <div ref={containerRef} className="flex flex-col h-full pl-2.5 pr-0 py-2.5 bg-white">
      {/* Search & Sync */}
      <div className="flex gap-2 mb-4 px-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <label htmlFor="project-tree-search" className="sr-only">
            Search schemas and tables
          </label>
          <Input
            id="project-tree-search"
            placeholder="Search tables..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white border-gray-200 focus:border-gray-300 focus:ring-0"
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
                className={cn(
                  'bg-white border-gray-200 hover:bg-gray-50',
                  !canSyncSources && 'opacity-50'
                )}
                data-testid="sync-tables-btn"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                ) : (
                  <RefreshCw className="h-4 w-4 text-gray-600" />
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
        <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground mt-2">
            Fetching latest schemas and tables...
          </p>
        </div>
      )}

      {/* Tree */}
      {filteredTreeData.length > 0 ? (
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white rounded-lg border border-gray-200 thin-scrollbar">
          <Tree<TreeNode>
            ref={treeRef}
            data={filteredTreeData}
            openByDefault={true}
            indent={EXPLORE_DIMENSIONS.TREE_INDENT}
            rowHeight={EXPLORE_DIMENSIONS.TREE_ROW_HEIGHT}
            height={treeHeight}
            width={width}
            onSelect={handleNodeClick}
            childrenAccessor="children"
          >
            {Node}
          </Tree>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-base bg-white rounded-lg border border-gray-200">
          {searchTerm ? 'No matching tables' : 'No data sources available'}
        </div>
      )}
    </div>
  );
}
