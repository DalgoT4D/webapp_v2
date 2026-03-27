// components/explore/charts/DateTimeInsights.tsx
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { BaseChart } from './BaseChart';
import { ChevronLeft, ChevronRight, Calendar, List, BarChart3 } from 'lucide-react';
import { requestTableMetrics, useTaskStatus } from '@/hooks/api/useWarehouse';
import {
  EXPLORE_COLORS,
  EXPLORE_DIMENSIONS,
  MONTH_NAMES,
  POLLING_INITIAL_DELAY,
} from '@/constants/explore';
import { TaskProgressStatus } from '@/constants/pipeline';
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

// Arrow button styles matching v1
const arrowStyles: React.CSSProperties = {
  width: 16,
  marginTop: 24,
  height: 80,
  background: '#F5FAFA',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

// Format date matching v1: moment(date).format('ddd, Do MMMM, YYYY')
function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const day = d.getDate();
  const ordinal =
    day === 1 || day === 21 || day === 31
      ? 'st'
      : day === 2 || day === 22
        ? 'nd'
        : day === 3 || day === 23
          ? 'rd'
          : 'th';

  return `${days[d.getDay()]}, ${day}${ordinal} ${months[d.getMonth()]}, ${d.getFullYear()}`;
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
      if (latest.status === TaskProgressStatus.COMPLETED && latest.results) {
        const results = latest.results as DatetimeStats;
        const newData = results.charts?.[0]?.data ?? [];
        setChartData(newData);
        setLoading(false);
        setTaskId(null);
      } else if (
        latest.status === TaskProgressStatus.FAILED ||
        latest.status === TaskProgressStatus.ERROR
      ) {
        setLoading(false);
        setTaskId(null);
      }
    }
  }, [taskData]);

  // Fetch data when filter changes — sends refresh: true to match v1
  const fetchFilteredData = useCallback(
    async (newFilter: DateFilter) => {
      setLoading(true);
      try {
        const response = await requestTableMetrics({
          db_schema: schema,
          db_table: table,
          column_name: columnName,
          filter: newFilter,
          refresh: true,
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
    const rangeMap: Record<RangeFilter, RangeFilter> = {
      year: 'month',
      month: 'day',
      day: 'year',
    };
    const nextRange = rangeMap[filter.range];
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
          fontSize: 10,
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        show: false,
      },
      series: [
        {
          type: 'bar',
          data: chartData.map((d) => d.frequency),
          itemStyle: { color: EXPLORE_COLORS.PRIMARY_TEAL },
          label: {
            show: true,
            position: 'top',
            formatter: (p: { value: number }) => String(p.value),
            fontSize: 10,
          },
        },
      ],
      grid: { top: 20, bottom: 20, left: 0, right: 0 },
    };
  }, [chartData, formatDateLabel]);

  // Calculate total days — use floor to match v1 moment.diff behavior
  const totalDays = useMemo(() => {
    if (!minVal || !maxVal) return 0;
    const min = new Date(minVal);
    const max = new Date(maxVal);
    return Math.floor((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24));
  }, [minVal, maxVal]);

  const toggleView = useCallback(() => {
    setViewMode((prev) => (prev === 'chart' ? 'numbers' : 'chart'));
  }, []);

  if (!chartData || chartData.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 110 }}>
        -- -- -- No data available -- -- --
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', minHeight: 110 }}>
      {viewMode === 'chart' ? (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Left Arrow — hidden when offset === 0 (v1 behavior) */}
          {filter.offset > 0 && (
            <div
              style={arrowStyles}
              onClick={handlePrevPage}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#c8d3d3')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#F5FAFA')}
              data-testid="datetime-prev-btn"
            >
              <ChevronLeft className="h-4 w-4" />
            </div>
          )}

          {/* Chart */}
          <div style={{ position: 'relative', marginTop: 40 }}>
            {loading ? (
              <Skeleton style={{ height: 100, width: 700 }} />
            ) : chartData.length === 0 ? (
              <div style={{ width: 700, textAlign: 'center' }}>No Data available</div>
            ) : (
              <BaseChart
                option={chartOption}
                width={EXPLORE_DIMENSIONS.CHART_WIDTH}
                height={EXPLORE_DIMENSIONS.CHART_HEIGHT}
              />
            )}

            {/* Range label + filter toggle — positioned absolute like v1 */}
            <div
              style={{
                position: 'absolute',
                right: 20,
                top: -50,
                textAlign: 'right',
              }}
            >
              <span>{filter.range}</span>
              <div
                onClick={cycleRange}
                style={{ cursor: 'pointer', marginLeft: 'auto', display: 'block', marginTop: 4 }}
                data-testid="datetime-range-toggle"
              >
                <Calendar className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* Right Arrow — hidden when less than 10 items (v1 behavior) */}
          {chartData.length === 10 && (
            <div
              style={arrowStyles}
              onClick={handleNextPage}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#c8d3d3')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#F5FAFA')}
              data-testid="datetime-next-btn"
            >
              <ChevronRight className="h-4 w-4" />
            </div>
          )}
        </div>
      ) : (
        <div style={{ minWidth: 700, display: 'flex', alignItems: 'center' }}>
          <div style={{ marginRight: 30 }}>
            <div style={{ color: EXPLORE_COLORS.LABEL_COLOR }}>Minimum date</div>
            <div
              style={{
                marginTop: 8,
                paddingRight: 16,
                background: EXPLORE_COLORS.STAT_BOX_BG,
                height: 24,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div style={{ marginLeft: 8 }}>{minVal ? formatDisplayDate(minVal) : 'NA'}</div>
            </div>
          </div>

          <div style={{ paddingTop: 24 }}>TO</div>

          <div style={{ margin: '0 30px' }}>
            <div style={{ color: EXPLORE_COLORS.LABEL_COLOR }}>Maximum date</div>
            <div
              style={{
                marginTop: 8,
                paddingRight: 16,
                background: EXPLORE_COLORS.STAT_BOX_BG,
                height: 24,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div style={{ marginLeft: 8 }}>{maxVal ? formatDisplayDate(maxVal) : 'NA'}</div>
            </div>
          </div>

          <div>
            <div style={{ color: EXPLORE_COLORS.LABEL_COLOR }}>Total days data</div>
            <div
              style={{
                marginTop: 8,
                paddingRight: 16,
                background: EXPLORE_COLORS.STAT_BOX_BG,
                height: 24,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div style={{ marginLeft: 8 }}>{totalDays}</div>
            </div>
          </div>
        </div>
      )}

      <div
        style={{ marginLeft: 20, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        onClick={toggleView}
        data-testid="toggle-datetime-view"
      >
        {viewMode === 'chart' ? <List className="h-5 w-5" /> : <BarChart3 className="h-5 w-5" />}
      </div>
    </div>
  );
}
