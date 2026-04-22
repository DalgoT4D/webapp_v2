// components/transform/canvas/nodes/DbtSourceModelNode.tsx
'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps, useEdges } from 'reactflow';
import { Trash2, Database } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTransformStore } from '@/stores/transformStore';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import type { CanvasNodeRenderData } from '@/types/transform';
import { NODE_COLORS, OperationFormAction, CanvasActionEnum } from '@/constants/transform';

type DbtSourceModelNodeProps = NodeProps<CanvasNodeRenderData>;

function DbtSourceModelNode({ id, type, data, selected, xPos, yPos }: DbtSourceModelNodeProps) {
  const edges = useEdges();
  const {
    setSelectedNode,
    dispatchCanvasAction,
    setPreviewData,
    clearPreviewAction,
    openOperationPanel,
    canInteractWithCanvas,
  } = useTransformStore();
  const { hasPermission } = useUserPermissions();

  const edgesEmanatingOutOfNode = edges.filter((edge) => edge.source === id);
  const isLeafNode = edgesEmanatingOutOfNode.length === 0;
  const canDelete = isLeafNode && hasPermission('can_delete_dbt_model');

  const schema = data?.dbtmodel?.schema || '';
  const tableName = data?.dbtmodel?.name || data?.name || 'Unknown';
  const displayName = data?.name || tableName;

  // data.name from the API may already include the schema prefix
  // (e.g. "intermediate.table_name") — strip it for display in the table-name slot.
  const cleanTableName =
    schema && displayName.startsWith(`${schema}.`)
      ? displayName.slice(schema.length + 1)
      : tableName;

  // v1: #00897B for published/source, #50A85C for unpublished models
  const iconPanelColor =
    type === 'model' && data?.isPublished === false
      ? NODE_COLORS.SOURCE_MODEL_UNPUBLISHED
      : NODE_COLORS.SOURCE_MODEL_PUBLISHED;

  const handleNodeClick = useCallback(() => {
    // Clear any project-tree preview so node preview takes priority
    clearPreviewAction();
    if (schema && tableName) {
      setPreviewData({ schema, table: tableName });
    }

    setSelectedNode({ id, type, data, selected, position: { x: xPos, y: yPos } });

    // Only open operation panel if user has create permission
    if (hasPermission('can_create_dbt_model')) {
      openOperationPanel();
      dispatchCanvasAction({
        type: CanvasActionEnum.OPEN_OPCONFIG_PANEL,
        data: { mode: OperationFormAction.CREATE },
      });
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
    clearPreviewAction,
    openOperationPanel,
    dispatchCanvasAction,
    hasPermission,
  ]);

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatchCanvasAction({
        type: CanvasActionEnum.DELETE_NODE,
        data: { nodeId: id, nodeType: type, isDummy: data?.isDummy, canvasNodeUuid: data?.uuid },
      });
    },
    [id, type, data?.isDummy, data?.uuid, dispatchCanvasAction]
  );

  return (
    <div
      data-testid={`source-model-node-${id}`}
      style={{
        border: selected || data?.isDummy ? '2px dotted #000' : 'none',
        borderRadius: 8,
        padding: selected || data?.isDummy ? 0 : 2,
        cursor: canInteractWithCanvas() ? 'grab' : 'pointer',
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
          borderRadius: 8,
          boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.16)',
          overflow: 'hidden',
          background: '#fff',
          display: 'flex',
          alignItems: 'stretch',
          position: 'relative',
        }}
      >
        {/* Icon panel */}
        <div
          style={{
            width: 56,
            background: iconPanelColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          <Database style={{ width: 22, height: 22 }} />
        </div>

        {/* Body: schema + table name */}
        <div
          style={{
            flex: 1,
            padding: '10px 12px',
            paddingRight: canDelete ? 32 : 12,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minWidth: 0,
          }}
        >
          {schema && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: '#6b7280',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {schema}
            </div>
          )}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: '#111827',
                    lineHeight: 1.25,
                    marginTop: schema ? 2 : 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {cleanTableName}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {displayName}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Delete button (top-right, only on leaf nodes with permission) */}
        {canDelete && (
          <button
            onClick={handleDeleteClick}
            aria-label="Delete node"
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 22,
              height: 22,
              background: 'rgba(0, 0, 0, 0.04)',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
            data-testid={`delete-node-${id}`}
          >
            <Trash2 style={{ width: 13, height: 13 }} />
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(DbtSourceModelNode);
