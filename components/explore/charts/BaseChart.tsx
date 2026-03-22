// components/explore/charts/BaseChart.tsx
'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart as EBarChart, ScatterChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';

// Register ECharts components
echarts.use([
  EBarChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

interface BaseChartProps {
  option: EChartsOption;
  width?: number;
  height?: number;
  className?: string;
}

export function BaseChart({ option, width = 700, height = 100, className }: BaseChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Initialize chart instance (once)
  useEffect(() => {
    if (!chartRef.current) return;

    chartInstance.current = echarts.init(chartRef.current);

    const resizeObserver = new ResizeObserver(() => {
      chartInstance.current?.resize();
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  // Update options when they change (without disposing)
  useEffect(() => {
    if (chartInstance.current && Object.keys(option).length > 0) {
      chartInstance.current.setOption(option, { notMerge: true });
    }
  }, [option]);

  return (
    <div
      ref={chartRef}
      className={className}
      style={{ width, height }}
      data-testid="echarts-container"
    />
  );
}
