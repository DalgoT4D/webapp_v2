// components/transform/canvas/nodes/DbtSourceModelNode.tsx
'use client';

import { memo, useEffect, useState, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps, useEdges } from 'reactflow';
import { Trash2 } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { useTransformStore } from '@/stores/transformStore';
import type { CanvasNodeRenderData, ColumnData } from '@/types/transform';

type DbtSourceModelNodeProps = NodeProps<CanvasNodeRenderData>;

// v1 colors
const COLOR_PUBLISHED = '#00897B';
const COLOR_UNPUBLISHED = '#50A85C';
const TABLE_HEADER_BG = '#EEF3F3';
const TABLE_CONTENT_BG = '#F8F8F8';
const TABLE_ODD_ROW = '#F7F7F7';
const TABLE_BORDER = '#E8E8E8';

function DbtSourceModelNode({ id, type, data, selected }: DbtSourceModelNodeProps) {
  const [columns, setColumns] = useState<ColumnData[]>([]);
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);
  const fetchedRef = useRef(false);

  const edges = useEdges();
  const { setSelectedNode, dispatchCanvasAction, setPreviewData } = useTransformStore();

  const edgesEmanatingOutOfNode = edges.filter((edge) => edge.source === id);
  const isLeafNode = edgesEmanatingOutOfNode.length === 0;
  const canDelete = isLeafNode;

  const schema = data?.dbtmodel?.schema || '';
  const tableName = data?.dbtmodel?.name || data?.name || 'Unknown';
  const displayName = data?.name || tableName;

  // v1: #00897B for published/source, #50A85C for unpublished models
  const headerColor =
    type === 'model' && data?.isPublished === false ? COLOR_UNPUBLISHED : COLOR_PUBLISHED;

  // Fetch columns once
  useEffect(() => {
    if (!schema || !tableName || data?.isDummy || fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchColumns = async () => {
      setIsLoadingColumns(true);
      try {
        const response = await apiGet<ColumnData[]>(
          `/api/warehouse/table_columns/${schema}/${tableName}`
        );
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
    setSelectedNode({ id, type, data, selected });
    if (schema && tableName) {
      setPreviewData({ schema, table: tableName });
    }
    dispatchCanvasAction({ type: 'open-opconfig-panel', data: { mode: 'create' } });
  }, [
    id,
    type,
    data,
    selected,
    schema,
    tableName,
    setSelectedNode,
    setPreviewData,
    dispatchCanvasAction,
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

  const truncateName = (name: string, maxLength: number = 25) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 3) + '...';
  };

  // Format display: "schema.tableName" for header
  const headerText = schema ? `${schema}.${truncateName(displayName)}` : truncateName(displayName);

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
        <div
          style={{
            background: TABLE_CONTENT_BG,
            maxHeight: 120,
            overflowY: 'auto',
            borderRadius: '0 0 4px 4px',
          }}
          onWheelCapture={(e) => e.stopPropagation()}
        >
          {isLoadingColumns ? (
            <div
              style={{
                height: 80,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: 11,
              }}
            >
              Loading columns...
            </div>
          ) : columns.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th
                    style={{
                      background: TABLE_HEADER_BG,
                      fontWeight: 600,
                      fontSize: 11,
                      padding: '4px 0 4px 10px',
                      textAlign: 'left',
                      borderRight: `1px solid ${TABLE_BORDER}`,
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    NAME
                  </th>
                  <th
                    style={{
                      background: TABLE_HEADER_BG,
                      fontWeight: 600,
                      fontSize: 11,
                      padding: '4px 0 4px 10px',
                      textAlign: 'left',
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    TYPE
                  </th>
                </tr>
              </thead>
              <tbody>
                {columns.slice(0, 10).map((col, idx) => (
                  <tr
                    key={col.name}
                    style={{
                      background: idx % 2 === 0 ? TABLE_ODD_ROW : '#fff',
                    }}
                  >
                    <td
                      style={{
                        fontWeight: 500,
                        fontSize: 11,
                        color: '#212121',
                        padding: '3px 4px 3px 10px',
                        borderRight: `1px solid ${TABLE_BORDER}`,
                        maxWidth: 120,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={col.name}
                    >
                      {col.name}
                    </td>
                    <td
                      style={{
                        fontWeight: 500,
                        fontSize: 11,
                        color: '#212121',
                        padding: '3px 4px 3px 10px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={col.data_type || ''}
                    >
                      {col.data_type}
                    </td>
                  </tr>
                ))}
                {columns.length > 10 && (
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        textAlign: 'center',
                        fontSize: 10,
                        color: '#999',
                        padding: '3px 0',
                      }}
                    >
                      +{columns.length - 10} more columns
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <div
              style={{
                height: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: 11,
              }}
            >
              No columns
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(DbtSourceModelNode);
