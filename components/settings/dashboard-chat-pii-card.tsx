'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getDashboardChatPIIColumnKey,
  getDashboardChatPIIColumnTestId,
} from './dashboard-chat-pii-utils';
import type { DashboardChatPIIColumn } from '@/hooks/api/useDashboardAIChat';

interface DashboardChatPIICardProps {
  columns: DashboardChatPIIColumn[];
  totalColumnCount: number;
  piiColumnCount: number;
  isLoading: boolean;
  updatingColumnKey: string | null;
  onColumnPIIChange: (column: DashboardChatPIIColumn, pii: boolean) => void | Promise<void>;
}

export function DashboardChatPIICard({
  columns,
  totalColumnCount,
  piiColumnCount,
  isLoading,
  updatingColumnKey,
  onColumnPIIChange,
}: DashboardChatPIICardProps) {
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState('all');

  const visibleColumns = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    return columns.filter((column) => {
      if (filter === 'pii' && !column.effective_pii) {
        return false;
      }
      if (filter === 'not-pii' && column.effective_pii) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return [
        column.dashboard_title,
        column.full_table_name,
        column.model_name,
        column.column_name,
        column.description,
        column.semantic_role,
        column.value_semantics,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [columns, filter, searchText]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle>PII column review</CardTitle>
            <CardDescription>
              Review enriched metadata columns and correct which values should be masked before LLM
              calls when PII sharing is off.
            </CardDescription>
          </div>
          <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-medium text-slate-900">{piiColumnCount}</span> PII columns out of{' '}
            <span className="font-medium text-slate-900">{totalColumnCount}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <Input
            id="dashboard-chat-pii-column-search"
            data-testid="dashboard-chat-pii-column-search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search dashboard, table, column, or description..."
          />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger
              id="dashboard-chat-pii-column-filter"
              data-testid="dashboard-chat-pii-column-filter"
            >
              <SelectValue placeholder="Filter columns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All columns</SelectItem>
              <SelectItem value="pii">PII only</SelectItem>
              <SelectItem value="not-pii">Not PII only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[520px] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dashboard</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Column</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Inferred</TableHead>
                <TableHead>Reviewed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleColumns.map((column) => {
                const key = getDashboardChatPIIColumnKey(column);
                const testId = getDashboardChatPIIColumnTestId(column);
                const isUpdating = updatingColumnKey === key;
                return (
                  <TableRow
                    key={`${column.dashboard_id}:${key}`}
                    data-testid={`pii-column-row-${testId}`}
                  >
                    <TableCell className="max-w-[180px] whitespace-normal text-sm">
                      {column.dashboard_title}
                    </TableCell>
                    <TableCell className="max-w-[220px] whitespace-normal text-xs">
                      <div className="font-medium">{column.full_table_name}</div>
                      {column.model_name ? (
                        <div className="text-muted-foreground">{column.model_name}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[180px] whitespace-normal text-sm font-medium">
                      <div>{column.column_name}</div>
                      <div className="text-xs font-normal text-muted-foreground">
                        {column.data_type || 'unknown type'}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[360px] whitespace-normal text-xs text-slate-700">
                      {column.description || 'No description yet'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={column.inferred_pii ? 'destructive' : 'secondary'}>
                        {column.inferred_pii ? 'PII' : 'Not PII'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={column.effective_pii ? 'true' : 'false'}
                        disabled={isLoading || isUpdating}
                        onValueChange={(value) => onColumnPIIChange(column, value === 'true')}
                      >
                        <SelectTrigger
                          id={`pii-column-review-${testId}`}
                          data-testid={`pii-column-review-${testId}`}
                          className="w-[130px]"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">PII</SelectItem>
                          <SelectItem value="false">Not PII</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
              {visibleColumns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">
                    {isLoading
                      ? 'Loading PII columns...'
                      : 'No metadata columns match this filter.'}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
