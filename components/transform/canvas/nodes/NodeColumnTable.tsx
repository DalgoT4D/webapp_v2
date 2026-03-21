// components/transform/canvas/nodes/NodeColumnTable.tsx
// Extracted column table used inside DbtSourceModelNode

import type { ColumnData } from '@/types/transform';

// Node-specific table colors (used for React Flow inline styles)
const TABLE_HEADER_BG = '#EEF3F3';
const TABLE_CONTENT_BG = '#F8F8F8';
const TABLE_ODD_ROW = '#F7F7F7';
const TABLE_BORDER = '#E8E8E8';

// Maximum columns shown before "N more columns" indicator
const MAX_VISIBLE_COLUMNS = 10;

interface NodeColumnTableProps {
  columns: ColumnData[];
  isLoading: boolean;
}

export function NodeColumnTable({ columns, isLoading }: NodeColumnTableProps) {
  return (
    <div
      style={{
        background: TABLE_CONTENT_BG,
        maxHeight: 120,
        overflowY: 'auto',
        borderRadius: '0 0 4px 4px',
      }}
      onWheelCapture={(e) => e.stopPropagation()}
    >
      {isLoading ? (
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
            {columns.slice(0, MAX_VISIBLE_COLUMNS).map((col, idx) => (
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
            {columns.length > MAX_VISIBLE_COLUMNS && (
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
                  +{columns.length - MAX_VISIBLE_COLUMNS} more columns
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
  );
}
