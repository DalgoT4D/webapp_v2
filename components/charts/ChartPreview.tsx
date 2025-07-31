'use client';

import React, { useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, BarChart3, TrendingUp, AlertTriangle } from 'lucide-react';

// Dynamically import ECharts to avoid SSR issues
const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  ),
});

export interface ChartPreviewProps {
  chartData: any;
  config: {
    title?: string;
    chartType?:
      | 'bar'
      | 'line'
      | 'pie'
      | 'scatter'
      | 'area'
      | 'funnel'
      | 'radar'
      | 'heatmap'
      | 'table'
      | 'gauge'
      | 'boxplot'
      | 'candlestick'
      | 'sankey'
      | 'treemap'
      | 'sunburst'
      | 'number';
    isLoading?: boolean;
    error?: any;
    useSampleData?: boolean;
  };
}

export const ChartPreview = forwardRef<any, ChartPreviewProps>(({ chartData, config }, ref) => {
  const chartRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    getEchartsInstance: () => chartRef.current?.getEchartsInstance(),
  }));

  // Generate ECharts configuration
  const echartsOptions = useMemo(() => {
    // If using sample data and chartData has ECharts format
    if (config?.useSampleData && chartData && (chartData.series || chartData.xAxis)) {
      return {
        ...chartData,
        title: {
          text: config?.title || chartData.title?.text || 'Chart Preview',
          left: 'center',
          textStyle: {
            fontSize: 16,
            fontWeight: 'bold',
          },
        },
        tooltip: chartData.tooltip || {
          trigger: 'axis',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderColor: 'rgba(0, 0, 0, 0.8)',
          textStyle: {
            color: '#fff',
          },
        },
        toolbox: {
          feature: {
            saveAsImage: { show: true },
            dataZoom: { show: true },
            restore: { show: true },
          },
        },
      };
    }

    if (!chartData?.data) return null;

    const data = chartData.data;

    // Base configuration
    const baseConfig = {
      title: {
        text: config?.title || 'Chart Preview',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold',
        },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: 'rgba(0, 0, 0, 0.8)',
        textStyle: {
          color: '#fff',
        },
      },
      legend: {
        bottom: 10,
        data: [] as string[],
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        containLabel: true,
      },
      toolbox: {
        feature: {
          saveAsImage: { show: true },
          dataZoom: { show: true },
          restore: { show: true },
        },
      },
    };

    // Process data based on chart type
    if (config?.chartType === 'bar') {
      const xAxisData = data.map((item: any) => item.x || item.dimension || item.name);
      const yAxisData = data.map((item: any) => item.y || item.value || item.count);

      return {
        ...baseConfig,
        xAxis: {
          type: 'category',
          data: xAxisData,
          axisLabel: {
            rotate: 45,
            interval: 0,
          },
        },
        yAxis: {
          type: 'value',
          axisLabel: {
            formatter: (value: number) => {
              if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
              if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
              return value.toString();
            },
          },
        },
        series: [
          {
            name: 'Value',
            type: 'bar',
            data: yAxisData,
            itemStyle: {
              color: '#3b82f6',
            },
            emphasis: {
              itemStyle: {
                color: '#1d4ed8',
              },
            },
          },
        ],
      };
    }

    if (config?.chartType === 'line') {
      const xAxisData = data.map((item: any) => item.x || item.dimension || item.name);
      const yAxisData = data.map((item: any) => item.y || item.value || item.count);

      return {
        ...baseConfig,
        xAxis: {
          type: 'category',
          data: xAxisData,
          boundaryGap: false,
        },
        yAxis: {
          type: 'value',
          axisLabel: {
            formatter: (value: number) => {
              if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
              if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
              return value.toString();
            },
          },
        },
        series: [
          {
            name: 'Value',
            type: 'line',
            data: yAxisData,
            smooth: true,
            itemStyle: {
              color: '#10b981',
            },
            lineStyle: {
              color: '#10b981',
              width: 2,
            },
            areaStyle: {
              color: 'rgba(16, 185, 129, 0.1)',
            },
          },
        ],
      };
    }

    if (config?.chartType === 'pie') {
      const pieData = data.map((item: any) => ({
        name: item.x || item.dimension || item.name,
        value: item.y || item.value || item.count,
      }));

      return {
        ...baseConfig,
        tooltip: {
          trigger: 'item',
          formatter: '{a} <br/>{b}: {c} ({d}%)',
        },
        series: [
          {
            name: 'Distribution',
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            data: pieData,
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
              },
            },
            label: {
              show: false,
              position: 'center',
            },
            labelLine: {
              show: false,
            },
          },
        ],
      };
    }

    return null;
  }, [chartData, config?.chartType, config?.title]);

  // Empty state component
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
      <BarChart3 className="h-12 w-12 mb-4 text-gray-400" />
      <h3 className="text-lg font-medium mb-2">Configure your chart</h3>
      <p className="text-sm text-center max-w-sm">
        Select a chart type, data source, and configure your axes to see a preview here.
      </p>
    </div>
  );

  // Loading state
  if (config?.isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Loading Chart...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (config?.error) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Chart Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {config.error.message || 'Failed to load chart data'}
            </AlertDescription>
          </Alert>
          <EmptyState />
        </CardContent>
      </Card>
    );
  }

  // No data state
  if (!config?.useSampleData && (!chartData?.data || chartData.data.length === 0)) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Chart Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Chart Preview
          </div>
          <div className="flex items-center space-x-2">
            {config?.useSampleData ? (
              <>
                <span className="text-sm text-gray-600">Sample Data</span>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span className="text-xs text-gray-500">Demo</span>
                </div>
              </>
            ) : (
              <>
                <span className="text-sm text-gray-600">
                  {chartData?.data?.length || 0} data points
                </span>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-gray-500">Live</span>
                </div>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          {echartsOptions ? (
            <ReactECharts
              option={echartsOptions}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
              notMerge={true}
              lazyUpdate={true}
              onChartReady={(instance) => {
                if (chartRef.current) {
                  chartRef.current.getEchartsInstance = () => instance;
                }
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Unable to render chart</p>
            </div>
          )}
        </div>

        {/* Chart metadata */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Chart Type:</span>
              <span className="ml-2 capitalize">{config?.chartType}</span>
            </div>
            <div>
              <span className="font-medium">Data Points:</span>
              <span className="ml-2">
                {config?.useSampleData ? 'Sample' : chartData?.data?.length || 0}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

ChartPreview.displayName = 'ChartPreview';
