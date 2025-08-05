'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, AlertCircle } from 'lucide-react';
import { useChart, useChartData } from '@/hooks/api/useCharts';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Register necessary ECharts components
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
]);

interface ChartElementV2Props {
  chartId: number;
  config: any;
  onRemove: () => void;
  onUpdate: (config: any) => void;
}

export function ChartElementV2({ chartId, config, onRemove, onUpdate }: ChartElementV2Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const { data: chart, isLoading: chartLoading, isError: chartError } = useChart(chartId);
  const { data: chartData, isLoading: dataLoading, isError: dataError } = useChartData(chartId);

  useEffect(() => {
    // Initialize or update chart
    if (chartRef.current && chartData?.echarts_config) {
      if (!chartInstance.current) {
        chartInstance.current = echarts.init(chartRef.current);
      }

      // Set chart option
      chartInstance.current.setOption(chartData.echarts_config, true);
    }

    // Cleanup on unmount
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [chartData]);

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

  const isLoading = chartLoading || dataLoading;
  const isError = chartError || dataError;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{chart?.title || `Chart #${chartId}`}</CardTitle>
            <CardDescription className="text-xs">
              {chart?.chart_type && chart?.computation_type
                ? `${chart.chart_type} • ${chart.computation_type}`
                : 'Data Visualization'}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onRemove} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-64">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-xs text-muted-foreground">Loading chart...</p>
              </div>
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-sm text-destructive">Failed to load chart</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Please check your data connection
                </p>
              </div>
            </div>
          ) : (
            <div ref={chartRef} className="w-full h-full" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
