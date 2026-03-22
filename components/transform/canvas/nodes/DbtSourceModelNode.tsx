// components/transform/canvas/nodes/DbtSourceModelNode.tsx
'use client';

import { memo, useEffect, useState, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps, useEdges } from 'reactflow';
import { Trash2 } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { useTransformStore } from '@/stores/transformStore';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import type { CanvasNodeRenderData, ColumnData } from '@/types/transform';
import { NODE_COLORS } from '@/constants/transform';
import { truncateName } from '@/components/transform/utils';
import { NodeColumnTable } from './NodeColumnTable';

type DbtSourceModelNodeProps = NodeProps<CanvasNodeRenderData>;

function DbtSourceModelNode({ id, type, data, selected, xPos, yPos }: DbtSourceModelNodeProps) {
  const [columns, setColumns] = useState<ColumnData[]>([]);
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);
  const fetchedRef = useRef(false);

  const edges = useEdges();
  const { setSelectedNode, dispatchCanvasAction, setPreviewData, openOperationPanel } =
    useTransformStore();
  const { hasPermission } = useUserPermissions();

  const edgesEmanatingOutOfNode = edges.filter((edge) => edge.source === id);
  const isLeafNode = edgesEmanatingOutOfNode.length === 0;
  const canDelete = isLeafNode && hasPermission('can_delete_dbt_model');

  const schema = data?.dbtmodel?.schema || '';
  const tableName = data?.dbtmodel?.name || data?.name || 'Unknown';
  const displayName = data?.name || tableName;

  // v1: #00897B for published/source, #50A85C for unpublished models
  const headerColor =
    type === 'model' && data?.isPublished === false
      ? NODE_COLORS.SOURCE_MODEL_UNPUBLISHED
      : NODE_COLORS.SOURCE_MODEL_PUBLISHED;

  // Reset fetch flag when canvas refreshes so columns are re-fetched
  const refreshTrigger = useTransformStore((s) => s.refreshTrigger);
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchedRef.current = false;
    }
  }, [refreshTrigger]);

  // Fetch columns once
  useEffect(() => {
    if (!schema || !tableName || data?.isDummy || fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchColumns = async () => {
      setIsLoadingColumns(true);
      try {
        const response = (await apiGet(
          `/api/warehouse/table_columns/${schema}/${tableName}`
        )) as ColumnData[];
        setColumns(response || []);
      } catch {
        setColumns([]);
      } finally {
        setIsLoadingColumns(false);
      }
    };
    fetchColumns();
  }, [schema, tableName, data?.isDummy]);

  const handleNodeClick = useCallback(() => {
    // Always set preview data
    if (schema && tableName) {
      setPreviewData({ schema, table: tableName });
    }

    setSelectedNode({ id, type, data, selected, position: { x: xPos, y: yPos } });

    // Only open operation panel if user has create permission
    if (hasPermission('can_create_dbt_model')) {
      openOperationPanel();
      dispatchCanvasAction({ type: 'open-opconfig-panel', data: { mode: 'create' } });
    }
  }, [
    id,
    type,
    data,
    selected,
    xPos,
    yPos,
    schema,
    tableName,
    setSelectedNode,
    setPreviewData,
    openOperationPanel,
    dispatchCanvasAction,
    hasPermission,
  ]);

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatchCanvasAction({
        type: 'delete-node',
        data: { nodeId: id, nodeType: type, isDummy: data?.isDummy, canvasNodeUuid: data?.uuid },
      });
    },
    [id, type, data?.isDummy, data?.uuid, dispatchCanvasAction]
  );

  // Format display: "schema.tableName" for header.
  // data.name from the API may already include the schema prefix (e.g. "intermediate.table_name"),
  // so only prepend schema if displayName doesn't already start with it.
  const alreadyHasSchema = schema && displayName.startsWith(`${schema}.`);
  const headerText = alreadyHasSchema
    ? truncateName(displayName)
    : schema
      ? `${schema}.${truncateName(tableName)}`
      : truncateName(displayName);

  return (
    <div
      data-testid={`source-model-node-${id}`}
      style={{
        border: selected || data?.isDummy ? '2px dotted #000' : 'none',
        borderRadius: 5,
        padding: selected || data?.isDummy ? 0 : 2,
        cursor: 'pointer',
      }}
      onClick={handleNodeClick}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ width: 8, height: 8, background: '#999' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ width: 8, height: 8, background: '#999' }}
      />

      <div
        style={{
          width: 250,
          borderRadius: 5,
          boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.16)',
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: headerColor,
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: '5px 5px 0 0',
          }}
        >
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }} title={displayName}>
            {headerText}
          </span>
          {canDelete && (
            <button
              onClick={handleDeleteClick}
              aria-label="Delete node"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#fff',
                marginLeft: 'auto',
                padding: 0,
                display: 'flex',
              }}
              data-testid={`delete-node-${id}`}
            >
              <Trash2 style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>

        {/* Column Table */}
        <NodeColumnTable columns={columns} isLoading={isLoadingColumns} />
      </div>
    </div>
  );
}

export default memo(DbtSourceModelNode);
