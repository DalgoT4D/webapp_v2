'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';

export interface UseEChartsInstanceOptions {
  /** ECharts configuration object */
  config: Record<string, any> | undefined;
  /** Chart type for config transformation (bar, line, pie, number, gauge, etc.) */
  chartType?: string;
  /** Callback when chart instance is ready */
  onChartReady?: (chart: echarts.ECharts) => void;
  /** Custom config transformation function */
  transformConfig?: (config: Record<string, any>, chartType?: string) => Record<string, any>;
  /** ECharts setOption options */
  setOptionOpts?: {
    notMerge?: boolean;
    replaceMerge?: string[];
    lazyUpdate?: boolean;
  };
}

export interface UseEChartsInstanceReturn {
  /** Ref to attach to the chart container div */
  chartRef: React.RefObject<HTMLDivElement>;
  /** Mutable ref containing the ECharts instance (for advanced usage) */
  chartInstance: React.MutableRefObject<echarts.ECharts | null>;
  /** Manually trigger chart resize */
  resize: () => void;
  /** Manually reinitialize the chart */
  reinitialize: () => void;
}

/**
 * Hook for managing ECharts instance lifecycle
 *
 * Handles:
 * - Chart initialization with optional config transformation
 * - Window resize handling
 * - Cleanup on unmount
 * - Config change detection
 *
 * @example
 * ```tsx
 * const { chartRef } = useEChartsInstance({
 *   config: chartConfig,
 *   chartType: 'bar',
 *   onChartReady: (chart) => console.log('Chart ready'),
 *   transformConfig: transformStandardChartConfig,
 * });
 *
 * return <div ref={chartRef} className="w-full h-full" />;
 * ```
 */
export function useEChartsInstance({
  config,
  chartType,
  onChartReady,
  transformConfig,
  setOptionOpts,
}: UseEChartsInstanceOptions): UseEChartsInstanceReturn {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Initialize or update chart
  const initializeChart = useCallback(() => {
    if (!chartRef.current) return;

    // If no config, dispose existing chart to clear it
    if (!config) {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
      return;
    }

    try {
      // Dispose existing instance if it exists
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }

      // Create new instance
      chartInstance.current = echarts.init(chartRef.current);

      // Apply custom transformation if provided, otherwise use config as-is
      const finalConfig = transformConfig ? transformConfig(config, chartType) : config;

      // Set chart option with provided options or defaults
      chartInstance.current.setOption(finalConfig, setOptionOpts);

      // Notify parent component that chart is ready
      if (onChartReady) {
        onChartReady(chartInstance.current);
      }
    } catch (err) {
      console.error('Error initializing chart:', err);
    }
  }, [config, chartType, onChartReady, transformConfig, setOptionOpts]);

  // Resize function for external use
  const resize = useCallback(() => {
    chartInstance.current?.resize();
  }, []);

  // Effect for initialization and window resize
  useEffect(() => {
    initializeChart();

    // Handle window resize
    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [initializeChart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  return {
    chartRef,
    chartInstance,
    resize,
    reinitialize: initializeChart,
  };
}

export default useEChartsInstance;
