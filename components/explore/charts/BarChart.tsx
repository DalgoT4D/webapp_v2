// components/explore/charts/BarChart.tsx
'use client';

import { useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { EXPLORE_COLORS, EXPLORE_DIMENSIONS } from '@/constants/explore';
import type { EChartsOption } from 'echarts';

interface BarChartData {
  label?: string;
  value: number;
  barTopLabel?: string;
  name?: string;
  count?: number;
  percentage?: string;
}

interface BarChartProps {
  data: BarChartData[];
}

// Trim labels to 10 chars matching v1
const trimLabel = (label: string) => {
  return label.length > 10 ? label.substring(0, 10) + '...' : label;
};

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
        textStyle: { fontSize: 12 },
        formatter: (params: unknown) => {
          const p = (params as Array<{ dataIndex: number }>)[0];
          const item = data[p.dataIndex];
          // v1: tooltip only shows for truncated labels (length > 10)
          const label = item.label || item.name || '';
          if (label.length <= 10) return '';
          return label;
        },
      },
      xAxis: {
        type: 'category',
        data: data.map((d) => trimLabel(d.label || d.name || '')),
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
          data: data.map((d) => d.value),
          itemStyle: { color: EXPLORE_COLORS.PRIMARY_TEAL },
          label: {
            show: true,
            position: 'top',
            formatter: (p: unknown) => {
              const item = data[(p as { dataIndex: number }).dataIndex];
              return item.barTopLabel ?? String(item.value);
            },
            fontSize: 10,
            color: '#000',
          },
        },
      ],
      grid: { top: 20, bottom: 20, left: 0, right: 0 },
    };
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 110 }}>
        -- -- -- No data available -- -- --
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
