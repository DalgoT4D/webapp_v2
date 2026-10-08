'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { TableHead, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import type { getTableTheme } from '@/components/charts/styling/table-themes';
import { getAlignmentClass } from './table-cells';
import type { TableChartProps } from './TableChart';

interface TableChartHeaderRowProps {
  columns: string[];
  config: NonNullable<TableChartProps['config']>;
  firstRow: Record<string, unknown> | undefined;
  theme: ReturnType<typeof getTableTheme>;
  onSort: TableChartProps['onSort'];
  getSortDirection: (column: string) => 'asc' | 'desc' | undefined;
  handleSort: (column: string) => void;
}

/** The sticky header row: one cell per column, a sort button when `onSort` is passed (no page passes it today). */
export function TableChartHeaderRow({
  columns,
  config,
  firstRow,
  theme,
  onSort,
  getSortDirection,
  handleSort,
}: TableChartHeaderRowProps) {
  const data = [firstRow];
  return (
    <TableRow>
      {columns.map((column) => {
        const sortDirection = getSortDirection(column);
        const canSort = !!onSort;

        return (
          <TableHead
            key={column}
            className={`font-semibold py-2 px-2 ${getAlignmentClass(config.columnAlignment?.[column], columns, column, data[0]?.[column])} ${
              config.freezeFirstColumn && columns.indexOf(column) === 0
                ? 'sticky left-0 z-10 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]'
                : ''
            }`}
            style={{
              color: theme.headerText,
              backgroundColor: theme.header,
              borderColor: theme.border,
            }}
          >
            {canSort ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 font-semibold hover:bg-transparent"
                onClick={() => handleSort(column)}
                data-testid={`chart-table-sort-${column}`}
              >
                <span className="mr-1">{column}</span>
                {sortDirection === 'asc' ? (
                  <ChevronUp className="h-3 w-3" />
                ) : sortDirection === 'desc' ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <div className="h-3 w-3" />
                )}
              </Button>
            ) : (
              column
            )}
          </TableHead>
        );
      })}
    </TableRow>
  );
}
