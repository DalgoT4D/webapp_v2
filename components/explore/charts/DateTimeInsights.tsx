// components/explore/charts/DateTimeInsights.tsx
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BaseChart } from './BaseChart';
import { ChevronLeft, ChevronRight, Calendar, List } from 'lucide-react';
import { requestTableMetrics, useTaskStatus } from '@/hooks/api/useWarehouse';
import {
  EXPLORE_COLORS,
  EXPLORE_DIMENSIONS,
  MONTH_NAMES,
  POLLING_INITIAL_DELAY,
} from '@/constants/explore';
import type { EChartsOption } from 'echarts';
import type { DatetimeStats } from '@/types/explore';

interface DateTimeInsightsProps {
  data: DatetimeStats;
  schema: string;
  table: string;
  columnName: string;
}

type RangeFilter = 'year' | 'month' | 'day';
type ViewMode = 'chart' | 'numbers';

interface DateFilter {
  range: RangeFilter;
  limit: number;
  offset: number;
}

export function DateTimeInsights({
  data: initialData,
  schema,
  table,
  columnName,
}: DateTimeInsightsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const [filter, setFilter] = useState<DateFilter>({
    range: 'year',
    limit: 10,
    offset: 0,
  });
  const [chartData, setChartData] = useState(initialData.charts?.[0]?.data ?? []);
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);

  const { minVal, maxVal } = initialData;

  // Poll for task status when filter changes
  const { data: taskData } = useTaskStatus(taskId);

  // Update chart data when task completes
  useEffect(() => {
    if (taskData?.progress) {
      const latest = taskData.progress[taskData.progress.length - 1];
      if (latest.status === 'completed' && latest.results) {
        const results = latest.results as DatetimeStats;
        setChartData(results.charts?.[0]?.data ?? []);
        setLoading(false);
        setTaskId(null);
      } else if (latest.status === 'failed' || latest.status === 'error') {
        setLoading(false);
        setTaskId(null);
      }
    }
  }, [taskData]);

  // Fetch data when filter changes
  const fetchFilteredData = useCallback(
    async (newFilter: DateFilter) => {
      setLoading(true);
      try {
        const response = await requestTableMetrics({
          db_schema: schema,
          db_table: table,
          column_name: columnName,
          filter: newFilter,
        });

        await new Promise((resolve) => setTimeout(resolve, POLLING_INITIAL_DELAY));
        setTaskId(response.task_id);
      } catch (error) {
        console.error('Failed to fetch datetime data:', error);
        setLoading(false);
      }
    },
    [schema, table, columnName]
  );

  const handlePrevPage = useCallback(() => {
    const newFilter = { ...filter, offset: Math.max(0, filter.offset - 10) };
    setFilter(newFilter);
    fetchFilteredData(newFilter);
  }, [filter, fetchFilteredData]);

  const handleNextPage = useCallback(() => {
    const newFilter = { ...filter, offset: filter.offset + 10 };
    setFilter(newFilter);
    fetchFilteredData(newFilter);
  }, [filter, fetchFilteredData]);

  const cycleRange = useCallback(() => {
    const ranges: RangeFilter[] = ['year', 'month', 'day'];
    const currentIdx = ranges.indexOf(filter.range);
    const nextRange = ranges[(currentIdx + 1) % ranges.length];
    const newFilter = { range: nextRange, limit: 10, offset: 0 };
    setFilter(newFilter);
    fetchFilteredData(newFilter);
  }, [filter.range, fetchFilteredData]);

  const formatDateLabel = useCallback(
    (d: { year?: number; month?: number; day?: number }) => {
      if (filter.range === 'year') return d.year?.toString() ?? '';
      if (filter.range === 'month') {
        const month = d.month ? MONTH_NAMES[d.month - 1] : '';
        return `${month} ${d.year ?? ''}`;
      }
      if (filter.range === 'day') {
        const month = d.month ? MONTH_NAMES[d.month - 1] : '';
        return `${d.day ?? ''} ${month} ${d.year ?? ''}`;
      }
      return '';
    },
    [filter.range]
  );

  const chartOption = useMemo<EChartsOption>(() => {
    if (!chartData || chartData.length === 0) return {};

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#fff',
        borderColor: '#000',
        borderWidth: 1,
        borderRadius: 8,
      },
      xAxis: {
        type: 'category',
        data: chartData.map(formatDateLabel),
        axisLabel: {
          interval: 0,
          rotate: filter.range !== 'year' ? 45 : 0,
          fontSize: 10,
        },
      },
      yAxis: {
        type: 'value',
        name: 'Frequency',
        nameTextStyle: { fontSize: 10 },
      },
      series: [
        {
          type: 'bar',
          data: chartData.map((d) => d.frequency),
          itemStyle: { color: EXPLORE_COLORS.PRIMARY_TEAL },
        },
      ],
      grid: { top: 40, bottom: 80, left: 60, right: 20, containLabel: true },
    };
  }, [chartData, formatDateLabel, filter.range]);

  // Calculate total days
  const totalDays = useMemo(() => {
    if (!minVal || !maxVal) return 0;
    const min = new Date(minVal);
    const max = new Date(maxVal);
    return Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24));
  }, [minVal, maxVal]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
        No data available
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {viewMode === 'chart' ? (
        <>
          {/* Left Arrow */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevPage}
            disabled={filter.offset === 0 || loading}
            className="h-20 w-4 rounded-sm"
            style={{ backgroundColor: EXPLORE_COLORS.STAT_BOX_BG }}
            data-testid="datetime-prev-btn"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Chart */}
          {loading ? (
            <Skeleton className="w-[600px] h-[100px]" />
          ) : (
            <BaseChart option={chartOption} width={600} height={EXPLORE_DIMENSIONS.CHART_HEIGHT} />
          )}

          {/* Right Arrow */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextPage}
            disabled={chartData.length < 10 || loading}
            className="h-20 w-4 rounded-sm"
            style={{ backgroundColor: EXPLORE_COLORS.STAT_BOX_BG }}
            data-testid="datetime-next-btn"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Range Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={cycleRange}
            className="text-xs"
            data-testid="datetime-range-toggle"
          >
            {filter.range}
          </Button>
        </>
      ) : (
        <div className="flex items-center gap-8 min-h-[100px] min-w-[600px]">
          <div className="flex flex-col items-center">
            <span className="text-xs" style={{ color: EXPLORE_COLORS.LABEL_COLOR }}>
              Min Date
            </span>
            <div
              className="h-6 px-3 flex items-center justify-center text-sm"
              style={{ backgroundColor: EXPLORE_COLORS.STAT_BOX_BG }}
            >
              {minVal ? new Date(minVal).toLocaleDateString() : 'NA'}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs" style={{ color: EXPLORE_COLORS.LABEL_COLOR }}>
              Max Date
            </span>
            <div
              className="h-6 px-3 flex items-center justify-center text-sm"
              style={{ backgroundColor: EXPLORE_COLORS.STAT_BOX_BG }}
            >
              {maxVal ? new Date(maxVal).toLocaleDateString() : 'NA'}
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs" style={{ color: EXPLORE_COLORS.LABEL_COLOR }}>
              Total Days
            </span>
            <div
              className="h-6 px-3 flex items-center justify-center text-sm"
              style={{ backgroundColor: EXPLORE_COLORS.STAT_BOX_BG }}
            >
              {totalDays.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setViewMode((prev) => (prev === 'chart' ? 'numbers' : 'chart'))}
        data-testid="toggle-datetime-view"
      >
        {viewMode === 'chart' ? <List className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
      </Button>
    </div>
  );
}
