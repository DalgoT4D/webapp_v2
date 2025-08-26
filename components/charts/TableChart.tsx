'use client';

import { useMemo } from 'react';
import { ChevronUp, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

interface TableChartProps {
  data?: Record<string, any>[];
  config?: {
    table_columns?: string[];
    column_formatting?: Record<
      string,
      {
        type?: 'currency' | 'percentage' | 'date' | 'number' | 'text';
        precision?: number;
        prefix?: string;
        suffix?: string;
      }
    >;
    sort?: Array<{
      column: string;
      direction: 'asc' | 'desc';
    }>;
  };
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  isLoading?: boolean;
  error?: any;
}

export function TableChart({ data = [], config = {}, onSort, isLoading, error }: TableChartProps) {
  const { table_columns, column_formatting = {}, sort = [] } = config;

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading table data...</p>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load table data. Please check your configuration and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Get columns to display - either from config or all available columns
  const columns = useMemo(() => {
    if (table_columns && table_columns.length > 0) {
      return table_columns;
    }
    if (data.length > 0) {
      return Object.keys(data[0]);
    }
    return [];
  }, [data, table_columns]);

  // Format cell value based on column formatting config
  const formatCellValue = (value: any, column: string) => {
    const formatting = column_formatting[column];

    if (!formatting || value == null) {
      return value?.toString() || '';
    }

    const { type, precision = 2, prefix = '', suffix = '' } = formatting;

    switch (type) {
      case 'currency':
        const currencyValue = typeof value === 'number' ? value : parseFloat(value) || 0;
        return `${prefix}$${currencyValue.toFixed(precision)}${suffix}`;

      case 'percentage':
        const percentValue = typeof value === 'number' ? value : parseFloat(value) || 0;
        return `${prefix}${(percentValue * 100).toFixed(precision)}%${suffix}`;

      case 'number':
        const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
        return `${prefix}${numValue.toFixed(precision)}${suffix}`;

      case 'date':
        try {
          const dateValue = new Date(value);
          return `${prefix}${dateValue.toLocaleDateString()}${suffix}`;
        } catch {
          return value?.toString() || '';
        }

      case 'text':
      default:
        return `${prefix}${value?.toString() || ''}${suffix}`;
    }
  };

  // Get sort direction for a column
  const getSortDirection = (column: string) => {
    const sortConfig = sort.find((s) => s.column === column);
    return sortConfig?.direction;
  };

  // Handle column header click for sorting
  const handleSort = (column: string) => {
    if (!onSort) return;

    const currentDirection = getSortDirection(column);
    const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
    onSort(column, newDirection);
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-muted-foreground">
          <p>No data available</p>
          <p className="text-sm mt-2">Configure your table to display data</p>
        </div>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-muted-foreground">
          <p>No columns configured</p>
          <p className="text-sm mt-2">Select columns to display in the table</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => {
              const sortDirection = getSortDirection(column);
              const canSort = !!onSort;

              return (
                <TableHead key={column} className="font-semibold">
                  {canSort ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 font-semibold hover:bg-transparent"
                      onClick={() => handleSort(column)}
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
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell key={column} className="py-2">
                  {formatCellValue(row[column], column)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
