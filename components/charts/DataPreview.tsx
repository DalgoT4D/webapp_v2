'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Database, ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DataPreviewProps {
  data: any[];
  columns: string[];
  columnTypes?: Record<string, string>;
  isLoading?: boolean;
  error?: any;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
  };
}

export function DataPreview({
  data,
  columns,
  columnTypes = {},
  isLoading,
  error,
  pagination,
}: DataPreviewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load data preview. Please check your configuration and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data || data.length === 0 || columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <Database className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>No data to preview</p>
          <p className="text-sm mt-2">Select a table to see data</p>
        </div>
      </div>
    );
  }

  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') return value.toLocaleString();
    if (value instanceof Date) return value.toLocaleDateString();
    return String(value);
  };

  const getColumnTypeIcon = (type: string) => {
    const lowerType = type.toLowerCase();
    if (
      lowerType.includes('int') ||
      lowerType.includes('numeric') ||
      lowerType.includes('double')
    ) {
      return '123';
    }
    if (lowerType.includes('date') || lowerType.includes('time')) {
      return '📅';
    }
    if (lowerType.includes('bool')) {
      return '✓';
    }
    return 'Aa';
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col} className="font-medium text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xs opacity-60">
                      {getColumnTypeIcon(columnTypes[col] || 'text')}
                    </span>
                    <span className="text-xs">{col}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {columnTypes[col] || 'unknown'}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow key={idx}>
                {columns.map((col) => (
                  <TableCell key={col} className="text-xs">
                    {formatCellValue(row[col])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <div className="border-t p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                {pagination.total.toLocaleString()} rows
              </div>
              {pagination.onPageSizeChange && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rows per page:</span>
                  <Select
                    value={pagination.pageSize.toString()}
                    onValueChange={(value) => pagination.onPageSizeChange?.(parseInt(value))}
                  >
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pagination.onPageChange(1)}
                  disabled={pagination.page === 1}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pagination.onPageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-sm">
                  Page {pagination.page} of {Math.ceil(pagination.total / pagination.pageSize)}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => pagination.onPageChange(pagination.page + 1)}
                  disabled={pagination.page * pagination.pageSize >= pagination.total}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    pagination.onPageChange(Math.ceil(pagination.total / pagination.pageSize))
                  }
                  disabled={pagination.page * pagination.pageSize >= pagination.total}
                >
                  Last
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
