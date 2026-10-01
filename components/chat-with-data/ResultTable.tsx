'use client';

import type { ResultTable as ResultTableData } from '@/types/chat-with-data';

/**
 * Query results attached to an assistant answer, styled as the design's
 * rounded result card. Rows are pre-truncated by the backend (max 100), so
 * this renders everything it gets inside a scroll box.
 */
export function ResultTable({ table }: { table: ResultTableData }) {
  if (!table.columns.length || !table.rows.length) return null;

  return (
    <div
      className="overflow-hidden rounded-[10px] border border-[#E8ECEF] bg-white"
      data-testid="chat-result-table"
    >
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F8FAFB]">
              {table.columns.map((column) => (
                <th
                  key={column}
                  className="whitespace-nowrap px-4 py-2 text-left text-[11.5px] font-semibold uppercase tracking-[0.5px] text-[#5C5C6D]"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              // rows have no natural id; index is stable because results never reorder
              // eslint-disable-next-line react/no-array-index-key
              <tr key={`row-${rowIndex}`} className="border-t border-[#F1F5F9]">
                {row.map((cell, cellIndex) => (
                  <td
                    // eslint-disable-next-line react/no-array-index-key
                    key={`cell-${rowIndex}-${cellIndex}`}
                    className={
                      cellIndex === 0
                        ? 'whitespace-nowrap px-4 py-2 text-[#1A1A2E]'
                        : 'whitespace-nowrap px-4 py-2 text-[#5C5C6D]'
                    }
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-[#F1F5F9] px-4 py-1.5 text-xs text-[#7A7A8C]">
        {table.row_count} row{table.row_count === 1 ? '' : 's'}
      </p>
    </div>
  );
}
