// components/explore/charts/BarChart.tsx
'use client';

import { useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { EXPLORE_COLORS, EXPLORE_DIMENSIONS } from '@/constants/explore';
import type { EChartsOption } from 'echarts';

interface BarChartData {
  label: string;
  value: number;
  barTopLabel?: string;
  name?: string;
  count?: number;
  percentage?: string;
}

interface BarChartProps {
  data: BarChartData[];
}

export function BarChart({ data }: BarChartProps) {
  const chartOption = useMemo<EChartsOption>(() => {
    if (!data || data.length === 0) return {};

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#fff',
        borderColor: '#000',
        borderWidth: 1,
        borderRadius: 8,
        formatter: (params: Array<{ dataIndex: number }>) => {
          const p = params[0];
          const item = data[p.dataIndex];
          // Show full label if truncated
          const label = item.label || item.name || '';
          return `${label}<br/>Value: ${item.value.toLocaleString()}`;
        },
      },
      xAxis: {
        type: 'category',
        data: data.map((d) => {
          const label = d.label || d.name || '';
          return label.length > 10 ? label.substring(0, 10) + '...' : label;
        }),
        axisLabel: {
          interval: 0,
          rotate: data.length > 6 ? 45 : 0,
          fontSize: 10,
        },
      },
      yAxis: {
        type: 'value',
      },
      series: [
        {
          type: 'bar',
          data: data.map((d) => d.value),
          itemStyle: { color: EXPLORE_COLORS.PRIMARY_TEAL },
          label: {
            show: true,
            position: 'top',
            formatter: (p: { dataIndex: number }) => {
              const item = data[p.dataIndex];
              return item.barTopLabel ?? item.value.toLocaleString();
            },
            fontSize: 10,
          },
        },
      ],
      grid: { top: 40, bottom: 60, left: 40, right: 20, containLabel: true },
    };
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
        No data available
      </div>
    );
  }

  return (
    <BaseChart
      option={chartOption}
      width={EXPLORE_DIMENSIONS.CHART_WIDTH}
      height={EXPLORE_DIMENSIONS.CHART_HEIGHT}
    />
  );
}
