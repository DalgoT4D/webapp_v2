'use client';

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, GaugeChart, ScatterChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Register necessary ECharts components
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GaugeChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  CanvasRenderer,
]);

export interface MiniChartProps {
  config?: any; // ECharts configuration object
  chartType?: string;
  chartId?: number; // Alternative: chart ID to fetch config
  className?: string;
}

export function MiniChart({
  config,
  chartType,
  chartId,
  className = 'w-full h-full',
}: MiniChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [chartData, setChartData] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Fetch chart data if we have a chartId
  useEffect(() => {
    if (chartId) {
      setIsLoading(true);
      // Import apiGet dynamically to avoid circular dependencies
      import('@/lib/api').then(({ apiGet }) => {
        // First fetch chart metadata to get render_config
        apiGet(`/api/charts/${chartId}/`)
          .then((chart) => {
            console.log(`MiniChart ${chartId} - Chart metadata:`, chart);

            // Check if render_config exists and has content
            if (chart.render_config && Object.keys(chart.render_config).length > 0) {
              console.log(`MiniChart ${chartId} - Using render_config`);
              setChartData(chart.render_config);
            } else {
              // If no render_config, try fetching from data endpoint
              console.log(`MiniChart ${chartId} - No render_config, fetching from /data endpoint`);
              return apiGet(`/api/charts/${chartId}/data/`).then((data) => {
                if (data?.echarts_config) {
                  console.log(`MiniChart ${chartId} - Using echarts_config from data endpoint`);
                  setChartData(data.echarts_config);
                } else {
                  console.log(`MiniChart ${chartId} - No data available, using mock`);
                  setChartData(getMockConfig(chartId));
                }
              });
            }
          })
          .catch((err) => {
            console.error(`MiniChart ${chartId} - Failed to load chart:`, err);
            setChartData(getMockConfig(chartId));
          })
          .finally(() => setIsLoading(false));
      });
    }
  }, [chartId]);

  useEffect(() => {
    // Initialize chart
    if (chartRef.current && (config || chartData)) {
      if (!chartInstance.current) {
        chartInstance.current = echarts.init(chartRef.current);
      }

      // Set chart option
      const option = generateMiniOption();
      chartInstance.current.setOption(option, true); // Use true to clear previous options
    }

    // Cleanup on unmount
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [config, chartData]); // Remove chartType and chartId to reduce re-renders

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Generate mock config based on chartId if config not provided
  const getMockConfig = (id: number) => {
    const chartTypes = ['line', 'bar', 'pie'];
    const type = chartTypes[(id - 1) % chartTypes.length];

    const mockData = {
      line: {
        xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
        yAxis: { type: 'value' },
        series: [{ type: 'line', data: [120, 200, 150, 80, 70] }],
      },
      bar: {
        xAxis: { type: 'category', data: ['A', 'B', 'C', 'D'] },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: [120, 200, 150, 80] }],
      },
      pie: {
        series: [
          {
            type: 'pie',
            data: [
              { value: 335, name: 'Direct' },
              { value: 310, name: 'Email' },
              { value: 234, name: 'Union Ads' },
              { value: 135, name: 'Video Ads' },
            ],
          },
        ],
      },
    };

    return mockData[type as keyof typeof mockData] || mockData.line;
  };

  const generateMiniOption = () => {
    // Use provided config or fetched chartData or generate mock based on chartId
    const chartConfig = config || chartData || (chartId ? getMockConfig(chartId) : {});
    if (!chartConfig) return {};

    const baseOption = {
      backgroundColor: 'transparent',
      animation: false,
      grid: {
        left: 15,
        right: 15,
        top: 15,
        bottom: 15,
        containLabel: false,
      },
      tooltip: { show: false },
      legend: { show: false },
      title: { show: false },
    };

    // Merge baseOption with the chart config
    return {
      ...baseOption,
      ...chartConfig,
      // Override specific options for thumbnail view
      xAxis: chartConfig.xAxis
        ? {
            ...chartConfig.xAxis,
            show: false,
          }
        : undefined,
      yAxis: chartConfig.yAxis
        ? {
            ...chartConfig.yAxis,
            show: false,
          }
        : undefined,
      series: chartConfig.series
        ? chartConfig.series.map((series: any) => ({
            ...series,
            // Customize series options for thumbnail
            label: { show: false },
            emphasis: { scale: false },
          }))
        : [],
    };
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return <div ref={chartRef} className={className} />;
}
