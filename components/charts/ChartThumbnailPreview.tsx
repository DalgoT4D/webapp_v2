'use client';

import React, { useState, useEffect } from 'react';
import { MiniChart } from './MiniChart';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { useChartData, useChart } from '@/hooks/api/useCharts';

interface ChartThumbnailPreviewProps {
  chartId: number;
  chartType?: string;
  chartTitle?: string;
  chart?: any; // Chart object from API
  className?: string;
  iconComponent: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  typeColors: {
    color: string;
    bgColor: string;
  };
}

export function ChartThumbnailPreview({
  chartId,
  chart: providedChart,
  className = '',
  iconComponent: IconComponent,
  typeColors,
}: ChartThumbnailPreviewProps) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [showIcon, setShowIcon] = useState(false);

  const { targetRef, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '200px',
    triggerOnce: true,
  });

  // Determine if we have chart data and what type it is
  const chart = providedChart;
  const chartType = chart?.chart_type;

  // Immediately show icon for map and table charts to prevent any API calls
  const isMapOrTable = chartType === 'map' || chartType === 'table';

  // Set initial state based on chart type - show icon immediately for map/table charts
  useEffect(() => {
    if (isMapOrTable) {
      setShowIcon(true);
      // Also set shouldLoad to true so the component doesn't wait for intersection
      setShouldLoad(true);
    }
  }, [isMapOrTable]);

  // Trigger loading when component becomes visible (only for supported chart types)
  useEffect(() => {
    if (isIntersecting && !shouldLoad && !isMapOrTable && chart) {
      setShouldLoad(true);
    }
  }, [isIntersecting, shouldLoad, isMapOrTable, chart]);

  // Fallback to fetch chart metadata only if chart not provided and not map/table
  const { data: fetchedChart, error: chartError } = useChart(
    !chart && shouldLoad && !isMapOrTable ? chartId : 0
  );

  // If chart metadata fails, immediately show icon
  useEffect(() => {
    if (chartError) {
      setShowIcon(true);
    }
  }, [chartError]);

  // Use fetched chart as fallback
  const finalChart = chart || fetchedChart;
  const finalChartType = finalChart?.chart_type;

  // Double-check chart type after fetch
  useEffect(() => {
    if (finalChartType === 'map' || finalChartType === 'table') {
      setShowIcon(true);
    }
  }, [finalChartType]);

  // Use the existing chart data hook - only load for supported chart types
  const shouldFetchChartData =
    shouldLoad && finalChart && finalChartType !== 'map' && finalChartType !== 'table' && !showIcon;

  const { data: chartData, isLoading, isError } = useChartData(shouldFetchChartData ? chartId : 0);

  // If chart data fails, show icon
  useEffect(() => {
    if (isError) {
      setShowIcon(true);
    }
  }, [isError]);

  // Process chart data for thumbnail display - must be called before any conditional returns
  const thumbnailData = React.useMemo(() => {
    if (!chartData?.echarts_config) return null;

    return {
      ...chartData.echarts_config,
      // Optimize for thumbnail display
      animation: false,
      tooltip: { show: false },
      legend: { show: false },
      dataZoom: undefined, // Remove zoom controls
      brush: undefined, // Remove brush tool
    };
  }, [chartData]);

  // Render fallback icon for: 1) Map/table charts, 2) Error states, 3) Not intersected yet
  if (showIcon || (!shouldLoad && !isMapOrTable)) {
    return (
      <div
        ref={targetRef}
        className={`relative h-40 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden group-hover:from-gray-100 group-hover:to-gray-150 transition-colors duration-200 ${className}`}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-20 h-20 rounded-xl flex items-center justify-center shadow-sm border border-white/50"
            style={{ backgroundColor: typeColors.bgColor }}
          >
            <IconComponent className="w-12 h-12" style={{ color: typeColors.color }} />
          </div>
        </div>
      </div>
    );
  }

  // Show loading skeleton
  if (isLoading) {
    return (
      <div
        ref={targetRef}
        className={`relative h-40 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden group-hover:from-gray-100 group-hover:to-gray-150 transition-colors duration-200 ${className}`}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse rounded-lg" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  // Show thumbnail if data is available
  if (thumbnailData) {
    return (
      <div
        ref={targetRef}
        className={`relative h-40 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden group-hover:from-gray-100 group-hover:to-gray-150 transition-colors duration-200 ${className}`}
      >
        <div className="absolute inset-0 bg-white rounded-lg" />
        <div className="absolute inset-2">
          <MiniChart config={thumbnailData} className="w-full h-full" showTitle={false} />
        </div>
        <div
          className="absolute bottom-2 right-2 w-8 h-8 rounded-md flex items-center justify-center shadow-sm border border-white/50"
          style={{ backgroundColor: typeColors.bgColor }}
        >
          <IconComponent className="w-5 h-5" style={{ color: typeColors.color }} />
        </div>
      </div>
    );
  }

  // Final fallback: Show large chart icon
  return (
    <div
      ref={targetRef}
      className={`relative h-40 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden group-hover:from-gray-100 group-hover:to-gray-150 transition-colors duration-200 ${className}`}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-20 h-20 rounded-xl flex items-center justify-center shadow-sm border border-white/50"
          style={{ backgroundColor: typeColors.bgColor }}
        >
          <IconComponent className="w-12 h-12" style={{ color: typeColors.color }} />
        </div>
      </div>
    </div>
  );
}
