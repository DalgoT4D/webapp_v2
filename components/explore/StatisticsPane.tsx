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
import { RefreshCw, Eye, ArrowUp, ArrowDown, ArrowUpDown, Loader2 } from 'lucide-react';
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
import { toastSuccess } from '@/lib/toast';
import { EXPLORE_DIMENSIONS, POLLING_INITIAL_DELAY, TranslatedDataType } from '@/constants/explore';
import { TaskProgressStatus } from '@/constants/pipeline';
import type {
  TableColumnWithType,
  NumericStats,
  StringStats,
  BooleanStats,
  DatetimeStats,
} from '@/types/explore';

// Column widths matching v1: 160, 150, 100, 100, 800
const COL_WIDTHS = {
  NAME: 160,
  TYPE: 150,
  DISTINCT: 100,
  NULL: 100,
  DISTRIBUTION: 800,
} as const;

// Header cell style matching v1
const headerCellStyle = {
  backgroundColor: '#F5FAFA',
  border: '1px solid #dddddd',
  fontWeight: 700,
  color: 'rgba(15, 36, 64, 0.57)',
  textAlign: 'left' as const,
};

// Body cell style matching v1
const bodyCellStyle = {
  fontWeight: 600,
  borderBottom: '1px solid #ddd',
  fontSize: '0.8rem',
};

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

type SortField = 'name' | 'type' | 'distinct' | 'null';
type SortOrder = 'asc' | 'desc';

// Union type for accessing countNull/countDistinct from any stats type
interface StatsWithCounts {
  countNull?: number;
  countDistinct?: number;
}

export function StatisticsPane({ schema, table }: StatisticsPaneProps) {
  const [columnStats, setColumnStats] = useState<Map<string, ColumnStatistics>>(new Map());
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: columns, isLoading: columnsLoading } = useTableColumnTypes(schema, table);
  const { data: countData, isLoading: countLoading } = useTableCount(schema, table);

  const totalRows = countData?.total_rows ?? 0;

  // Sort columns — support all 4 sortable fields
  const sortedColumns = useMemo(() => {
    if (!columns) return [];

    return [...columns].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortField === 'name') {
        aVal = a.name;
        bVal = b.name;
      } else if (sortField === 'type') {
        aVal = a.translated_type;
        bVal = b.translated_type;
      } else {
        // For distinct/null, sort by the numeric value from stats
        const aStats = columnStats.get(a.name)?.data as StatsWithCounts | null;
        const bStats = columnStats.get(b.name)?.data as StatsWithCounts | null;
        if (sortField === 'distinct') {
          aVal = aStats?.countDistinct ?? -1;
          bVal = bStats?.countDistinct ?? -1;
        } else {
          aVal = aStats?.countNull ?? -1;
          bVal = bStats?.countNull ?? -1;
        }
        const comparison = (aVal as number) - (bVal as number);
        return sortOrder === 'asc' ? comparison : -comparison;
      }

      const comparison = String(aVal).localeCompare(String(bVal));
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [columns, sortField, sortOrder, columnStats]);

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
  // No cleanup on unmount — preserves stats across tab switches (matching v1)
  useEffect(() => {
    if (!columns || columns.length === 0 || totalRows === 0) return;

    // Clear stats before re-fetching
    setColumnStats(new Map());

    columns.forEach((col) => {
      fetchColumnStats(col);
    });
  }, [columns, totalRows, refreshKey, fetchColumnStats]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
    toastSuccess.generic('Refreshing statistics...');
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
      return <ArrowUpDown className="h-4 w-4 ml-1" style={{ color: 'rgba(15, 36, 64, 0.57)' }} />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-4 w-4 ml-1" style={{ color: 'rgba(15, 36, 64, 0.57)' }} />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" style={{ color: 'rgba(15, 36, 64, 0.57)' }} />
    );
  };

  const isLoading = columnsLoading || countLoading;

  // No table data
  if (totalRows === 0 && !isLoading) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ color: 'rgba(15, 36, 64, 0.57)' }}
      >
        No data (0 rows) available to generate insights
      </div>
    );
  }

  // Still loading columns or all column stats not started yet
  const allStatsEmpty = !columns || columns.length === 0 || columnStats.size === 0;
  if (isLoading || allStatsEmpty) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Generating insights
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header info bar — matching v1 layout */}
      <div className="flex-shrink-0 flex items-center" style={{ padding: '6px 8px 6px 44px' }}>
        <span style={{ fontWeight: 'bold' }} data-testid="statistics-table-name">
          {table}
        </span>

        <div className="flex items-center" style={{ marginLeft: '56px', fontWeight: 600 }}>
          <div className="flex items-center mr-4">
            <Eye className="h-5 w-5 mr-1" style={{ color: '#00897b' }} />
            {columns?.length ?? 0} Columns
          </div>
          {totalRows > 0 ? totalRows : 0} Rows
        </div>

        <div className="flex items-center" style={{ marginLeft: 'auto', marginRight: '16px' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="text-white hover:opacity-90 shadow-xs"
            style={{ backgroundColor: 'var(--primary)' }}
            data-testid="refresh-stats-btn"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow style={{ backgroundColor: '#F5FAFA' }} className="hover:bg-transparent">
              <TableHead
                style={{
                  ...headerCellStyle,
                  width: COL_WIDTHS.NAME,
                  padding: '8px 8px 8px 40px',
                  cursor: 'pointer',
                }}
                onClick={() => handleSort('name')}
                data-testid="sort-column-name"
              >
                <div className="flex items-center">
                  Column name
                  {renderSortIcon('name')}
                </div>
              </TableHead>
              <TableHead
                style={{
                  ...headerCellStyle,
                  width: COL_WIDTHS.TYPE,
                  padding: '8px',
                  cursor: 'pointer',
                }}
                onClick={() => handleSort('type')}
                data-testid="sort-column-type"
              >
                <div className="flex items-center">
                  Column type
                  {renderSortIcon('type')}
                </div>
              </TableHead>
              <TableHead
                style={{
                  ...headerCellStyle,
                  width: COL_WIDTHS.DISTINCT,
                  padding: '8px',
                  cursor: 'pointer',
                }}
                onClick={() => handleSort('distinct')}
                data-testid="sort-column-distinct"
              >
                <div className="flex items-center">
                  Distinct
                  {renderSortIcon('distinct')}
                </div>
              </TableHead>
              <TableHead
                style={{
                  ...headerCellStyle,
                  width: COL_WIDTHS.NULL,
                  padding: '8px',
                  cursor: 'pointer',
                }}
                onClick={() => handleSort('null')}
                data-testid="sort-column-null"
              >
                <div className="flex items-center">
                  Null
                  {renderSortIcon('null')}
                </div>
              </TableHead>
              <TableHead
                style={{ ...headerCellStyle, width: COL_WIDTHS.DISTRIBUTION, padding: '8px' }}
              >
                Data distribution
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody style={{ borderColor: '#dddddd' }}>
            {sortedColumns.map((col) => (
              <StatisticsRow
                key={col.name}
                column={col}
                stats={columnStats.get(col.name)}
                schema={schema}
                table={table}
              />
            ))}
          </TableBody>
        </Table>
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
}

function StatisticsRow({ column, stats, schema, table }: StatisticsRowProps) {
  const [completedData, setCompletedData] = useState<
    NumericStats | StringStats | BooleanStats | DatetimeStats | null
  >(null);
  const [hasError, setHasError] = useState(false);

  // Poll for task status using the taskId from parent
  const taskId = stats?.taskId ?? null;
  const { data: taskData } = useTaskStatus(taskId);

  // Update completed data when polling finishes
  useEffect(() => {
    if (taskData?.progress) {
      const latest = taskData.progress[taskData.progress.length - 1];
      if (latest.status === TaskProgressStatus.COMPLETED && latest.results) {
        setCompletedData(
          latest.results as NumericStats | StringStats | BooleanStats | DatetimeStats
        );
        setHasError(false);
      } else if (
        latest.status === TaskProgressStatus.FAILED ||
        latest.status === TaskProgressStatus.ERROR
      ) {
        setCompletedData(null);
        setHasError(true);
      }
    }
  }, [taskData]);

  // Reset when stats prop changes (e.g., on refresh)
  useEffect(() => {
    if (stats?.loading && stats?.taskId === null) {
      // Parent just started a new fetch — clear old data
      setCompletedData(null);
      setHasError(false);
    }
  }, [stats?.loading, stats?.taskId]);

  const isLoading = stats?.loading && !completedData && !hasError;

  const getDistinctCount = () => {
    if (!completedData) return undefined;
    return (completedData as StatsWithCounts).countDistinct;
  };

  const getNullCount = () => {
    if (!completedData) return undefined;
    return (completedData as StatsWithCounts).countNull;
  };

  const renderChart = () => {
    if (isLoading) {
      return <Skeleton style={{ height: 118, width: '100%' }} />;
    }

    if (hasError || stats?.error) {
      return (
        <div className="flex items-center" style={{ minHeight: 100 }}>
          -- -- -- No data available -- -- --
        </div>
      );
    }

    if (!completedData) {
      return <Skeleton style={{ height: 118, width: '100%' }} />;
    }

    switch (column.translated_type) {
      case TranslatedDataType.NUMERIC:
        return <NumberInsights data={completedData as NumericStats} />;

      case TranslatedDataType.STRING: {
        const stringData = completedData as StringStats;
        if (stringData.count === stringData.countNull) {
          return <div>All values are null</div>;
        }
        if (stringData.count === stringData.countDistinct) {
          return <div>All values are distinct</div>;
        }
        return <StringInsights data={stringData} />;
      }

      case TranslatedDataType.BOOLEAN: {
        const boolData = completedData as BooleanStats;
        const denominator = boolData.count;
        return (
          <RangeChart
            data={[
              {
                name: 'True',
                percentage:
                  denominator > 0 ? ((boolData.countTrue * 100) / denominator).toFixed(1) : '0',
                count: boolData.countTrue,
              },
              {
                name: 'False',
                percentage:
                  denominator > 0 ? ((boolData.countFalse * 100) / denominator).toFixed(1) : '0',
                count: boolData.countFalse,
              },
            ]}
            colors={['#00897b', '#c7d8d7']}
            barHeight={12}
          />
        );
      }

      case TranslatedDataType.DATETIME:
        return (
          <DateTimeInsights
            data={completedData as DatetimeStats}
            schema={schema}
            table={table}
            columnName={column.name}
          />
        );

      default:
        return (
          <div className="flex items-center" style={{ minHeight: 100 }}>
            -- -- -- No data available -- -- --
          </div>
        );
    }
  };

  const distinctCount = getDistinctCount();
  const nullCount = getNullCount();

  return (
    <TableRow
      style={{ boxShadow: 'unset', height: EXPLORE_DIMENSIONS.STATISTICS_ROW_HEIGHT }}
      data-testid={`stats-row-${column.name}`}
      className="hover:bg-gray-50/50"
    >
      <TableCell
        style={{
          ...bodyCellStyle,
          width: COL_WIDTHS.NAME,
          padding: '8px 8px 8px 46px',
        }}
      >
        {column.name}
      </TableCell>
      <TableCell
        style={{
          ...bodyCellStyle,
          width: COL_WIDTHS.TYPE,
          padding: '8px',
        }}
      >
        {column.translated_type}
      </TableCell>
      <TableCell
        style={{
          ...bodyCellStyle,
          width: COL_WIDTHS.DISTINCT,
          padding: '8px',
        }}
      >
        {distinctCount !== undefined ? distinctCount.toLocaleString() : isLoading ? '' : ''}
      </TableCell>
      <TableCell
        style={{
          ...bodyCellStyle,
          width: COL_WIDTHS.NULL,
          padding: '8px',
        }}
      >
        {nullCount !== undefined ? nullCount.toLocaleString() : isLoading ? '' : ''}
      </TableCell>
      <TableCell
        style={{
          ...bodyCellStyle,
          width: COL_WIDTHS.DISTRIBUTION,
          padding: '8px',
        }}
      >
        {renderChart()}
      </TableCell>
    </TableRow>
  );
}
