'use client';

import { useState } from 'react';
import { ChartPreview } from './ChartPreview';
import ChartExport from './ChartExport';
import type * as echarts from 'echarts';

interface ChartWithExportProps {
  chartId: number;
  chartTitle: string;
  chartConfig: Record<string, any>;
  isLoading?: boolean;
  error?: any;
}

export function ChartWithExport({
  chartId,
  chartTitle,
  chartConfig,
  isLoading,
  error,
}: ChartWithExportProps) {
  const [chartInstance, setChartInstance] = useState<echarts.ECharts | null>(null);

  return (
    <div className="relative h-full">
      <div className="absolute top-2 right-2 z-10">
        <ChartExport chartId={chartId} chartTitle={chartTitle} chartInstance={chartInstance} />
      </div>
      <ChartPreview
        config={chartConfig}
        isLoading={isLoading}
        error={error}
        onChartReady={setChartInstance}
      />
    </div>
  );
}
