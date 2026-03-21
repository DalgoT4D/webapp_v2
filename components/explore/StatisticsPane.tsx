// components/explore/StatisticsPane.tsx
'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import {
  useTableColumnTypes,
  useTableCount,
  requestTableMetrics,
  useTaskStatus,
} from '@/hooks/api/useWarehouse';
import { NumberInsights } from './charts/NumberInsights';
import { StringInsights } from './charts/StringInsights';
import { RangeChart } from './charts/RangeChart';
import { DateTimeInsights } from './charts/DateTimeInsights';
import { toast } from 'sonner';
import { EXPLORE_DIMENSIONS, POLLING_INITIAL_DELAY } from '@/constants/explore';
import type {
  TableColumnWithType,
  NumericStats,
  StringStats,
  BooleanStats,
  DatetimeStats,
} from '@/types/explore';

interface StatisticsPaneProps {
  schema: string;
  table: string;
}

interface ColumnStatistics {
  loading: boolean;
  error: boolean;
  data: NumericStats | StringStats | BooleanStats | DatetimeStats | null;
  taskId: string | null;
}

type SortField = 'name' | 'type';
type SortOrder = 'asc' | 'desc';

export function StatisticsPane({ schema, table }: StatisticsPaneProps) {
  const [columnStats, setColumnStats] = useState<Map<string, ColumnStatistics>>(new Map());
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: columns, isLoading: columnsLoading } = useTableColumnTypes(schema, table);
  const { data: countData, isLoading: countLoading } = useTableCount(schema, table);

  const totalRows = countData?.total_rows ?? 0;

  // Sort columns
  const sortedColumns = useMemo(() => {
    if (!columns) return [];

    return [...columns].sort((a, b) => {
      const aVal = sortField === 'name' ? a.name : a.translated_type;
      const bVal = sortField === 'name' ? b.name : b.translated_type;
      const comparison = aVal.localeCompare(bVal);
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [columns, sortField, sortOrder]);

  // Fetch statistics for each column
  const fetchColumnStats = useCallback(
    async (column: TableColumnWithType) => {
      setColumnStats((prev) => {
        const next = new Map(prev);
        next.set(column.name, {
          loading: true,
          error: false,
          data: null,
          taskId: null,
        });
        return next;
      });

      try {
        const response = await requestTableMetrics({
          db_schema: schema,
          db_table: table,
          column_name: column.name,
        });

        // Wait initial delay before polling starts
        await new Promise((resolve) => setTimeout(resolve, POLLING_INITIAL_DELAY));

        setColumnStats((prev) => {
          const next = new Map(prev);
          next.set(column.name, {
            loading: true,
            error: false,
            data: null,
            taskId: response.task_id,
          });
          return next;
        });
      } catch (error) {
        console.error(`Failed to request stats for ${column.name}:`, error);
        setColumnStats((prev) => {
          const next = new Map(prev);
          next.set(column.name, {
            loading: false,
            error: true,
            data: null,
            taskId: null,
          });
          return next;
        });
      }
    },
    [schema, table]
  );

  // Fetch all column stats on mount or refresh
  useEffect(() => {
    if (!columns || columns.length === 0 || totalRows === 0) return;

    columns.forEach((col) => {
      fetchColumnStats(col);
    });

    // Cleanup on unmount
    return () => {
      // Clear all states
      setColumnStats(new Map());
    };
  }, [columns, totalRows, refreshKey, fetchColumnStats]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
    toast.success('Refreshing statistics...');
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortOrder('asc');
      }
    },
    [sortField]
  );

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-4 w-4 text-gray-600" />
    ) : (
      <ArrowDown className="h-4 w-4 text-gray-600" />
    );
  };

  const isLoading = columnsLoading || countLoading;

  if (totalRows === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground bg-white">
        No data (0 rows) available
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-4">
          <h2 className="font-medium text-lg text-gray-900" data-testid="statistics-table-name">
            {schema}.{table}
          </h2>
          <span className="text-sm text-gray-500">
            {columns?.length ?? 0} columns · {totalRows.toLocaleString()} rows
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="text-white hover:opacity-90 shadow-xs"
          style={{ backgroundColor: '#06887b' }}
          data-testid="refresh-stats-btn"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          REFRESH
        </Button>
      </div>

      {/* Statistics Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-white rounded-lg border shadow-sm">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead
                  className="w-[200px] text-base font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors border-r"
                  onClick={() => handleSort('name')}
                  data-testid="sort-column-name"
                >
                  <div className="flex items-center gap-2 py-1">
                    Column
                    {renderSortIcon('name')}
                  </div>
                </TableHead>
                <TableHead
                  className="w-[120px] text-base font-medium text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors border-r"
                  onClick={() => handleSort('type')}
                  data-testid="sort-column-type"
                >
                  <div className="flex items-center gap-2 py-1">
                    Type
                    {renderSortIcon('type')}
                  </div>
                </TableHead>
                <TableHead className="w-[100px] text-base font-medium text-gray-700 border-r">
                  Distinct
                </TableHead>
                <TableHead className="w-[100px] text-base font-medium text-gray-700 border-r">
                  Nulls
                </TableHead>
                <TableHead className="text-base font-medium text-gray-700">Distribution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="border-r">
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell className="border-r">
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell className="border-r">
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell className="border-r">
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-24 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : sortedColumns.map((col) => (
                    <StatisticsRow
                      key={col.name}
                      column={col}
                      stats={columnStats.get(col.name)}
                      schema={schema}
                      table={table}
                      totalRows={totalRows}
                    />
                  ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// Separate component for each row to handle individual polling
interface StatisticsRowProps {
  column: TableColumnWithType;
  stats?: ColumnStatistics;
  schema: string;
  table: string;
  totalRows: number;
}

function StatisticsRow({ column, stats, schema, table, totalRows }: StatisticsRowProps) {
  const [localStats, setLocalStats] = useState<ColumnStatistics | undefined>(stats);

  // Poll for task status
  const { data: taskData } = useTaskStatus(stats?.taskId ?? null);

  // Update local stats when polling completes
  useEffect(() => {
    if (taskData?.progress) {
      const latest = taskData.progress[taskData.progress.length - 1];
      if (latest.status === 'completed' && latest.results) {
        setLocalStats({
          loading: false,
          error: false,
          data: latest.results as NumericStats | StringStats | BooleanStats | DatetimeStats,
          taskId: null,
        });
      } else if (latest.status === 'failed' || latest.status === 'error') {
        setLocalStats({
          loading: false,
          error: true,
          data: null,
          taskId: null,
        });
      }
    }
  }, [taskData]);

  // Update when stats prop changes
  useEffect(() => {
    if (stats) {
      setLocalStats(stats);
    }
  }, [stats]);

  const renderChart = () => {
    if (!localStats || localStats.loading) {
      return <Skeleton className="h-24 w-full" />;
    }

    if (localStats.error || !localStats.data) {
      return <span className="text-muted-foreground text-sm">No data available</span>;
    }

    switch (column.translated_type) {
      case 'Numeric':
        return <NumberInsights data={localStats.data as NumericStats} />;
      case 'String':
        return <StringInsights data={localStats.data as StringStats} />;
      case 'Boolean':
        return <RangeChart data={formatBooleanData(localStats.data as BooleanStats, totalRows)} />;
      case 'Datetime':
        return (
          <DateTimeInsights
            data={localStats.data as DatetimeStats}
            schema={schema}
            table={table}
            columnName={column.name}
          />
        );
      default:
        return <span className="text-muted-foreground text-sm">Unsupported type</span>;
    }
  };

  const getDistinctCount = () => {
    if (!localStats?.data) return '-';
    const data = localStats.data as StringStats;
    return data.countDistinct?.toLocaleString() ?? '-';
  };

  const getNullCount = () => {
    if (!localStats?.data) return '-';
    const data = localStats.data as StringStats;
    return data.countNull?.toLocaleString() ?? '-';
  };

  return (
    <TableRow
      style={{ height: EXPLORE_DIMENSIONS.STATISTICS_ROW_HEIGHT }}
      data-testid={`stats-row-${column.name}`}
      className="hover:bg-gray-50/50"
    >
      <TableCell className="font-medium text-gray-900 border-r">{column.name}</TableCell>
      <TableCell className="text-gray-500 border-r">{column.translated_type}</TableCell>
      <TableCell className="text-gray-700 border-r">{getDistinctCount()}</TableCell>
      <TableCell className="text-gray-700 border-r">{getNullCount()}</TableCell>
      <TableCell className="p-2">{renderChart()}</TableCell>
    </TableRow>
  );
}

// Helper to format boolean stats for RangeChart
function formatBooleanData(stats: BooleanStats, totalRows: number) {
  const truePercentage = totalRows > 0 ? ((stats.countTrue / totalRows) * 100).toFixed(1) : '0';
  const falsePercentage = totalRows > 0 ? ((stats.countFalse / totalRows) * 100).toFixed(1) : '0';
  const nullCount = totalRows - stats.countTrue - stats.countFalse;
  const nullPercentage = totalRows > 0 ? ((nullCount / totalRows) * 100).toFixed(1) : '0';

  const result = [
    { name: 'True', percentage: truePercentage, count: stats.countTrue },
    { name: 'False', percentage: falsePercentage, count: stats.countFalse },
  ];

  if (nullCount > 0) {
    result.push({ name: 'Null', percentage: nullPercentage, count: nullCount });
  }

  return result;
}
