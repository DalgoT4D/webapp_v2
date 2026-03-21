// components/explore/charts/RangeChart.tsx
'use client';

import { useMemo } from 'react';
import { BaseChart } from './BaseChart';
import { EXPLORE_COLORS, EXPLORE_DIMENSIONS } from '@/constants/explore';
import type { EChartsOption } from 'echarts';

interface RangeChartData {
  name: string;
  percentage: string;
  count: number;
}

interface RangeChartProps {
  data: RangeChartData[];
  barHeight?: number;
}

export function RangeChart({ data, barHeight = EXPLORE_DIMENSIONS.BAR_HEIGHT }: RangeChartProps) {
  const chartOption = useMemo<EChartsOption>(() => {
    if (!data || data.length === 0) return {};

    const colors = EXPLORE_COLORS.TEAL_PALETTE;

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#fff',
        borderColor: '#000',
        borderWidth: 1,
        borderRadius: 8,
        formatter: (params: { dataIndex: number }) => {
          const item = data[params.dataIndex];
          return `<strong>${item.name}</strong>: ${item.percentage}% | Count: ${item.count.toLocaleString()}`;
        },
      },
      legend: {
        show: true,
        bottom: 0,
        left: 'center',
        orient: 'horizontal',
        itemWidth: 16,
        itemHeight: 8,
        data: data.map((d, i) => ({
          name: d.name.length > 10 ? d.name.substring(0, 10) + '...' : d.name,
          itemStyle: { color: colors[i % colors.length] },
        })),
      },
      xAxis: {
        type: 'value',
        max: 100,
        show: false,
      },
      yAxis: {
        type: 'category',
        data: [''],
        show: false,
      },
      series: data.map((d, i) => ({
        name: d.name.length > 10 ? d.name.substring(0, 10) + '...' : d.name,
        type: 'bar',
        stack: 'total',
        data: [parseFloat(d.percentage)],
        itemStyle: { color: colors[i % colors.length] },
        barWidth: barHeight,
        label: {
          show: parseFloat(d.percentage) > 7,
          position: 'inside',
          formatter: `${d.percentage}%`,
          fontSize: 11,
          color: '#fff',
        },
      })),
      grid: { top: 30, bottom: 40, left: 0, right: 0, containLabel: false },
    };
  }, [data, barHeight]);

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
