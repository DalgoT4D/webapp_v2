'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { Metric } from '../_lib/types';
import type { RagStatus } from '../_lib/types';

const RAG_COLORS: Record<RagStatus, string> = {
  on_track: '#10b981',
  at_risk: '#f59e0b',
  below_target: '#ef4444',
};

interface TrendChartProps {
  metric: Metric;
  className?: string;
}

export function TrendChart({ metric, className }: TrendChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const color = RAG_COLORS[metric.ragStatus];
  const unit = metric.unit ? ` ${metric.unit}` : '';

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const min = Math.min(...metric.trend, metric.target) * 0.95;
    const max = Math.max(...metric.trend, metric.target) * 1.05;
    const range = max - min || 1;

    const option: echarts.EChartsOption = {
      title: {
        text: metric.name,
        left: 'center',
        top: 0,
        textStyle: { fontSize: 14, fontWeight: 600 },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const p = params as Array<{ dataIndex: number }>;
          if (!p?.length) return '';
          const idx = p[0].dataIndex ?? 0;
          const label = metric.trend_labels[idx] ?? '';
          const value = metric.trend[idx];
          return `${label}: ${value}${unit}`;
        },
      },
      grid: {
        left: 50,
        right: 40,
        top: 40,
        bottom: 40,
      },
      xAxis: {
        type: 'category',
        data: metric.trend_labels,
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisLabel: { color: '#6b7280', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        min,
        max,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
        axisLabel: { color: '#6b7280', fontSize: 11 },
      },
      series: [
        {
          type: 'line',
          data: metric.trend,
          smooth: true,
          lineStyle: { color, width: 2.5 },
          itemStyle: { color },
          areaStyle: {
            opacity: 0.1,
            color,
          },
          symbol: 'circle',
          symbolSize: 6,
          markLine: {
            silent: true,
            symbol: 'none',
            label: {
              formatter: `Target: ${metric.target}${unit}`,
              position: 'end',
            },
            lineStyle: { type: 'dashed', color: '#9ca3af', width: 1.5 },
            data: [{ yAxis: metric.target }],
          },
        },
      ],
    };

    chartInstance.current.setOption(option, true);

    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [metric]);

  useEffect(() => {
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <div ref={chartRef} className={className} style={{ minHeight: 300 }} />;
}
