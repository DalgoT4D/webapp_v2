// components/transform/canvas/nodes/OperationNode.tsx
'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps, useEdges } from 'reactflow';
import Image from 'next/image';
import { Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTransformStore, useSelectedNode } from '@/stores/transformStore';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import type { CanvasNodeRenderData } from '@/types/transform';
import {
  NODE_COLORS,
  operationLabelMap,
  operationIconMapping,
  OperationFormAction,
  CanvasActionEnum,
} from '@/constants/transform';

type OperationNodeProps = NodeProps<CanvasNodeRenderData>;

function OperationNode({ id, type, data, selected, xPos, yPos }: OperationNodeProps) {
  const edges = useEdges();
  const selectedNode = useSelectedNode();
  const {
    setSelectedNode,
    dispatchCanvasAction,
    openOperationPanel,
    clearPreviewAction,
    canInteractWithCanvas,
  } = useTransformStore();
  const { hasPermission } = useUserPermissions();

  const operationType = data?.operation_config?.type || 'unknown';
  const operationLabel = operationLabelMap[operationType] || operationType;
  const operationIcon = operationIconMapping[operationType];

  // Leaf node check — can delete only leaf nodes
  const edgesEmanatingOutOfNode = edges.filter((edge) => edge.source === id);
  const isLeafNode = edgesEmanatingOutOfNode.length === 0;
  const canDelete = isLeafNode && hasPermission('can_delete_dbt_operation');

  // Handle node click — open panel in edit or view mode based on permissions
  const handleNodeClick = useCallback(() => {
    clearPreviewAction();
    const nodeProps = { id, type, data, selected, position: { x: xPos, y: yPos } };
    setSelectedNode(nodeProps);

    if (hasPermission('can_edit_dbt_operation')) {
      // Open panel directly in the same synchronous handler as setSelectedNode
      // so React batches both Zustand updates into a single render where
      // operationPanelOpen=true AND selectedNode are both available.
      openOperationPanel();
      dispatchCanvasAction({
        type: CanvasActionEnum.OPEN_OPCONFIG_PANEL,
        data: { mode: OperationFormAction.EDIT },
      });
    } else if (hasPermission('can_view_dbt_operation')) {
      openOperationPanel();
      dispatchCanvasAction({
        type: CanvasActionEnum.OPEN_OPCONFIG_PANEL,
        data: { mode: OperationFormAction.VIEW },
      });
    }
    // If neither permission, just select the node but don't open panel
  }, [
    id,
    type,
    data,
    selected,
    setSelectedNode,
    dispatchCanvasAction,
    openOperationPanel,
    clearPreviewAction,
    hasPermission,
  ]);

  // Handle delete click
  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatchCanvasAction({
        type: CanvasActionEnum.DELETE_NODE,
        data: { nodeId: id, nodeType: type, isDummy: data?.isDummy },
      });
    },
    [id, type, data?.isDummy, dispatchCanvasAction]
  );

  const isSelected = selected || selectedNode?.id === id || data?.isDummy;

  return (
    <div
      data-testid={`operation-node-${id}`}
      className={`${canInteractWithCanvas() ? 'cursor-grab' : 'cursor-pointer'} relative`}
      style={{
        border: isSelected ? '2px dotted #000' : 'none',
        borderRadius: 5,
        padding: isSelected ? 0 : 2,
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

      {/* Delete button — v1 style: absolute at top-right corner outside the node */}
      {canDelete && (
        <button
          onClick={handleDeleteClick}
          aria-label="Delete operation"
          style={{
            position: 'absolute',
            right: -15,
            top: -15,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#fff',
            border: '1px solid #ccc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            cursor: 'pointer',
          }}
          data-testid={`delete-operation-${id}`}
        >
          <Trash2 style={{ width: 12, height: 12, color: '#666' }} />
        </button>
      )}

      <div
        style={{
          width: 90,
          height: 100,
          background: '#fff',
          borderRadius: 5,
          boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.16)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Icon area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#F5FAFA',
          }}
        >
          {operationIcon ? (
            <Image
              src={operationIcon}
              alt={operationLabel}
              width={28}
              height={28}
              draggable={false}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <span
              style={{ color: NODE_COLORS.SOURCE_MODEL_PUBLISHED, fontSize: 14, fontWeight: 700 }}
            >
              {operationLabel.substring(0, 3).toUpperCase()}
            </span>
          )}
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid #EEEEEE' }} />

        {/* Label */}
        <div style={{ padding: 8, textAlign: 'center' }}>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#212121',
                    margin: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {operationLabel}
                </p>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {operationLabel}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

export default memo(OperationNode);
