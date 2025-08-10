'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts';
import { Loader2, AlertCircle, Map } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MapPreviewProps {
  config?: Record<string, any>;
  isLoading?: boolean;
  error?: any;
  onChartReady?: (chart: echarts.ECharts) => void;
}

export function MapPreview({ config, isLoading, error, onChartReady }: MapPreviewProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Register GeoJSON with ECharts before rendering
  const initializeMapChart = useCallback(() => {
    if (!chartRef.current || !config) return;

    try {
      // Register custom map data if provided
      if (config.mapData && config.mapName) {
        echarts.registerMap(config.mapName, config.mapData);
      }

      // Dispose existing instance
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }

      // Create new instance
      chartInstance.current = echarts.init(chartRef.current);

      // Remove custom properties from config before setting (they're not ECharts options)
      const chartConfig = { ...config };
      delete chartConfig.mapData;
      delete chartConfig.mapName;

      chartInstance.current.setOption(chartConfig);

      if (onChartReady) {
        onChartReady(chartInstance.current);
      }
    } catch (err) {
      console.error('Error initializing map chart:', err);
    }
  }, [config, onChartReady]);

  useEffect(() => {
    initializeMapChart();

    // Handle resize
    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [initializeMapChart]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px] p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load map data. Please check your configuration and try again.
            <br />
            <span className="text-xs mt-1 block">{error?.message || error}</span>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="text-center text-muted-foreground">
          <Map className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>Configure your map to see a preview</p>
          <p className="text-sm mt-2">Select data source, columns, and map layer to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={chartRef}
      className="w-full h-full min-h-[500px]"
      style={{ width: '100%', height: '100%', minHeight: '500px' }}
    />
  );
}
