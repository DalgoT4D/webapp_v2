'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ResultTable as ResultTableData } from '@/types/chat-with-data';

/**
 * Query results attached to an assistant answer. Rows are pre-truncated by the
 * backend (max 100), so this renders everything it gets inside a scroll box.
 */
export function ResultTable({ table }: { table: ResultTableData }) {
  if (!table.columns.length || !table.rows.length) return null;

  return (
    <div className="mt-2 rounded-md border" data-testid="chat-result-table">
      <div className="max-h-80 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {table.columns.map((column) => (
                <TableHead key={column} className="whitespace-nowrap">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.map((row, rowIndex) => (
              // rows have no natural id; index is stable because results never reorder
              // eslint-disable-next-line react/no-array-index-key
              <TableRow key={`row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <TableCell key={`cell-${rowIndex}-${cellIndex}`} className="whitespace-nowrap">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
        {table.row_count} row{table.row_count === 1 ? '' : 's'}
      </p>
    </div>
  );
}
