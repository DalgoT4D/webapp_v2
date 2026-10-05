'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChartTitleEditor } from './chart-title-editor';
import type { ChartTitleConfig } from '@/lib/chart-title-utils';
import { type DashboardFilterConfig } from '@/lib/dashboard-filter-utils';
import { useMapDrillPath } from '@/components/dashboard/widgets/chart/useMapDrillPath';
import { MapDrillBreadcrumb } from '@/components/dashboard/widgets/chart/MapDrillBreadcrumb';
import { useBuilderChartData } from '@/components/dashboard/widgets/chart/useBuilderChartData';
import { useBuilderChartInstance } from '@/components/dashboard/widgets/chart/useBuilderChartInstance';
import { BuilderChartBody } from '@/components/dashboard/widgets/chart/BuilderChartBody';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, GaugeChart, ScatterChart, MapChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  VisualMapComponent,
  GeoComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Register necessary ECharts components
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GaugeChart,
  ScatterChart,
  MapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DatasetComponent,
  VisualMapComponent,
  GeoComponent,
  CanvasRenderer,
]);

interface ChartElementBuilderProps {
  chartId: number;
  config: any & ChartTitleConfig;
  onRemove: () => void;
  onUpdate: (config: any & ChartTitleConfig) => void;
  isResizing?: boolean;
  isEditMode?: boolean;
  appliedFilters?: Record<string, any>;
  dashboardFilterConfigs?: DashboardFilterConfig[];
}

export function ChartElementBuilder({
  chartId,
  config,
  onRemove,
  onUpdate,
  isResizing,
  isEditMode = true,
  appliedFilters = {},
  dashboardFilterConfigs = [],
}: ChartElementBuilderProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isResizingRef = useRef(isResizing); // Track isResizing for ResizeObserver
  const { drillDownPath, setDrillDownPath, handleDrillUp, handleDrillHome } = useMapDrillPath();

  // Container size for responsive legend
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Keep isResizingRef in sync for ResizeObserver
  useEffect(() => {
    isResizingRef.current = isResizing;
  }, [isResizing]);

  const data = useBuilderChartData({
    chartId,
    appliedFilters,
    dashboardFilterConfigs,
    drillDownPath,
    setDrillDownPath,
  });

  // Handle title configuration updates
  const handleTitleChange = (titleConfig: ChartTitleConfig) => {
    onUpdate({
      ...config,
      ...titleConfig,
    });
  };

  useBuilderChartInstance({
    chartId,
    chartRef,
    chartInstance,
    resizeTimeoutRef,
    isResizingRef,
    isResizing,
    chartData: data.chartData,
    mapDataOverlay: data.mapDataOverlay,
    geojsonData: data.geojsonData,
    chart: data.chart,
    isLoading: data.isLoading,
    filterHash: data.filterHash,
    isMapChart: data.isMapChart,
    isLineChart: data.isLineChart,
    isBarChart: data.isBarChart,
    isPieChart: data.isPieChart,
    isNumberChart: data.isNumberChart,
    drillDownPath,
    handleRegionClick: data.handleRegionClick,
    containerSize,
    setContainerSize,
  });

  return (
    <div className="h-full w-full relative">
      {/* Action buttons moved to dashboard level for proper drag-cancel behavior */}
      <Card className="h-full w-full flex flex-col">
        <CardContent className="p-2 flex-1 flex flex-col min-h-0">
          {/* Chart Title Editor */}
          <ChartTitleEditor
            chartData={data.chart}
            config={config}
            onTitleChange={handleTitleChange}
            isEditMode={isEditMode}
            className="flex-shrink-0"
          />

          {/* Drill-down navigation for maps */}
          {data.isMapChart && drillDownPath.length > 0 && (
            <MapDrillBreadcrumb
              chartId={chartId}
              drillDownPath={drillDownPath}
              onHome={handleDrillHome}
              onDrillUp={handleDrillUp}
            />
          )}

          {/* Chart Content */}
          <div className="flex-1 w-full h-full">
            <BuilderChartBody
              chartId={chartId}
              chartRef={chartRef}
              data={data}
              drillDownPath={drillDownPath}
              handleDrillUp={handleDrillUp}
              handleDrillHome={handleDrillHome}
              isResizing={isResizing}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
