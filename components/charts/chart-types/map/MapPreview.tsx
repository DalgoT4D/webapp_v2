'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as echarts from 'echarts';
import { Loader2, AlertCircle, Map, ArrowLeft, Home } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buildMapChartOption } from './map-option';
import { attachMapDomListeners } from './map-listeners';
import { useMapContainerResize } from './useMapContainerResize';

/** MapPreview builds its chart with the full `echarts` bundle, not tree-shaken `echarts/core`. */
export type MapChartInstance = echarts.ECharts;

interface DrillDownLevel {
  level: number;
  name: string;
  geographic_column: string;
  parent_selections: Array<{
    column: string;
    value: string;
  }>;
}

interface MapPreviewProps {
  // For rendering just the GeoJSON (empty map)
  geojsonData?: any;
  geojsonLoading?: boolean;
  geojsonError?: any;

  // For data overlay (when geographic column is selected)
  mapData?: any[];
  mapDataLoading?: boolean;
  mapDataError?: any;

  // Map configuration
  title?: string;
  valueColumn?: string;
  customizations?: Record<string, any>;

  // Legacy support
  config?: Record<string, any>;
  isLoading?: boolean;
  error?: any;

  // Event handlers
  onChartReady?: (chart: MapChartInstance) => void;
  onRegionClick?: (regionName: string, regionData: unknown) => void;
  drillDownPath?: DrillDownLevel[];
  onDrillUp?: (level: number) => void;
  onDrillHome?: () => void;

  // UI options
  showBreadcrumbs?: boolean;

  // Dashboard integration
  isResizing?: boolean;
}

export function MapPreview({
  // New props for separated data fetching
  geojsonData,
  geojsonLoading = false,
  geojsonError,
  mapData,
  mapDataLoading = false,
  mapDataError,
  title,
  valueColumn,
  customizations = {},

  // Legacy props
  config,
  isLoading = false,
  error,

  // Event handlers
  onChartReady,
  onRegionClick,
  drillDownPath = [],
  onDrillUp,
  onDrillHome,

  // UI options
  showBreadcrumbs = true,

  // Dashboard integration
  isResizing = false,
}: MapPreviewProps) {
  // MapPreview initialization
  // Create stable reference for customizations to avoid unnecessary re-renders
  const safeCustomizations = useMemo(() => customizations || {}, [customizations]);

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const listenersAttachedRef = useRef(false);
  const containerSizeRef = useRef({ width: 0, height: 0 });

  // Zoom state - start with smaller default zoom
  const [currentZoom, setCurrentZoom] = useState(0.8);

  // Zoom control functions using setOption
  const handleZoomIn = useCallback(() => {
    if (chartInstance.current) {
      const newZoom = Math.min(currentZoom * 1.5, 10); // Max zoom 10x
      setCurrentZoom(newZoom);

      chartInstance.current.setOption({
        series: [
          {
            zoom: newZoom,
          },
        ],
      });
    }
  }, [currentZoom]);

  const handleZoomOut = useCallback(() => {
    if (chartInstance.current) {
      const newZoom = Math.max(currentZoom / 1.5, 0.5); // Min zoom 0.5x
      setCurrentZoom(newZoom);

      chartInstance.current.setOption({
        series: [
          {
            zoom: newZoom,
          },
        ],
      });
    }
  }, [currentZoom]);

  // Create a unique map name per component instance to prevent ECharts global registration conflicts
  const uniqueMapName = useRef(`customMap-${Date.now()}-${Math.random()}`).current;

  // Initialize map chart with separated data
  const initializeMapChart = useCallback(() => {
    if (!chartRef.current) {
      return;
    }

    try {
      let chartConfig;
      let mapName = uniqueMapName; // Use stable unique map name

      // Check if we have GeoJSON data to render
      if (geojsonData) {
        // Register the GeoJSON data
        echarts.registerMap(mapName, geojsonData);

        chartConfig = buildMapChartOption({
          mapName,
          mapData,
          customizations: safeCustomizations,
          title,
          valueColumn,
          containerSize: containerSizeRef.current,
          zoom: currentZoom,
        });
      } else if (config) {
        // Fallback to legacy config format
        let mapDataLegacy, mapNameLegacy;

        if (config.echarts_config) {
          mapDataLegacy = config.geojson;
          mapNameLegacy = config.geojson?.name || 'customMap';
          chartConfig = config.echarts_config;
        } else {
          mapDataLegacy = config.mapData;
          mapNameLegacy = config.mapName || 'customMap';
          chartConfig = { ...config };
          delete chartConfig.mapData;
          delete chartConfig.mapName;
        }

        if (mapDataLegacy && mapNameLegacy) {
          echarts.registerMap(mapNameLegacy, mapDataLegacy);
        }
      } else {
        // No data to render
        return;
      }

      // Dispose existing instance and reset listeners flag
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
        listenersAttachedRef.current = false;
      }

      // Create new instance with explicit sizing
      chartInstance.current = echarts.init(chartRef.current, null, {
        renderer: 'canvas',
        useDirtyRect: false,
        // Ensure the chart fits within its container
        width: chartRef.current.clientWidth,
        height: chartRef.current.clientHeight,
      });

      chartInstance.current.setOption(chartConfig, {
        notMerge: true,
        replaceMerge: ['series'],
      });

      // Configure touch behavior and event listeners only once
      if (!listenersAttachedRef.current && chartInstance.current && chartRef.current) {
        attachMapDomListeners(chartRef.current, chartInstance, onRegionClick);
        listenersAttachedRef.current = true;
      }

      if (onChartReady) {
        onChartReady(chartInstance.current);
      }
    } catch (err) {
      console.error('Error initializing map chart:', err);
    }
  }, [
    geojsonData,
    mapData,
    title,
    valueColumn,
    safeCustomizations,
    config,
    onChartReady,
    onRegionClick,
    uniqueMapName,
  ]);

  // Initialize chart when data changes
  useEffect(() => {
    initializeMapChart();
  }, [initializeMapChart]);

  useMapContainerResize({
    chartRef,
    chartInstance,
    containerSizeRef,
    resizeTimeoutRef,
    listenersAttachedRef,
    safeCustomizations,
    isResizing,
  });

  // Show loading states
  if (isLoading || geojsonLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">
            {geojsonLoading ? 'Loading map boundaries...' : 'Loading map...'}
          </p>
        </div>
      </div>
    );
  }

  // Show error states
  if (error || geojsonError) {
    const errorMessage = error?.message || error || geojsonError?.message || geojsonError;
    return (
      <div className="relative h-full min-h-[500px]">
        <div className="absolute top-0 left-0 right-0 z-10 p-4">
          <Alert variant="warning">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Map configuration needs a small adjustment. Please review your settings and try again.
              <br />
              <span className="text-xs mt-1 block">{errorMessage}</span>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Show empty state when no GeoJSON or config is available
  if (!geojsonData && !config) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="text-center text-muted-foreground">
          <Map className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>Configure your map to see a preview</p>
          <p className="text-sm mt-2">Select country and GeoJSON to get started</p>
        </div>
      </div>
    );
  }

  // Show data loading overlay if map is rendered but data is loading
  const showDataLoadingOverlay = mapDataLoading && geojsonData;

  // Breadcrumb navigation component
  const BreadcrumbNavigation = () => {
    if (drillDownPath.length === 0) return null;

    return (
      <div className="flex items-center justify-between p-4 bg-muted/50 border-b">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDrillHome}
            className="flex items-center gap-1"
            data-testid="chart-map-breadcrumb-home"
          >
            <Home className="h-4 w-4" />
            Home
          </Button>

          {drillDownPath.map((level, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-muted-foreground">/</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDrillUp?.(index)}
                className="flex items-center gap-1"
                data-testid={`chart-map-breadcrumb-level-${index}`}
              >
                {level.name}
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {drillDownPath.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDrillUp?.(drillDownPath.length - 2)}
              className="flex items-center gap-1"
              data-testid="chart-map-breadcrumb-back"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}

          <Badge variant="outline" data-testid="chart-map-level-badge">
            Level {drillDownPath.length || 1}
          </Badge>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full relative overflow-hidden">
      {showBreadcrumbs && <BreadcrumbNavigation />}
      <div
        ref={chartRef}
        className="w-full h-full"
        style={{ width: '100%', height: '100%', overflow: 'hidden' }}
      />

      {/* Custom Zoom Controls - positioned to avoid overlap with map and any chart toolbars */}
      <div
        className="absolute flex flex-col gap-1 z-10"
        style={{
          top: showBreadcrumbs ? '80px' : '12px',
          right: '12px',
          marginRight: '4px',
        }}
      >
        <button
          onClick={handleZoomIn}
          className="w-9 h-9 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-md shadow-md hover:bg-white hover:shadow-lg transition-all duration-200 flex items-center justify-center text-base font-semibold text-gray-700 hover:text-gray-900"
          title="Zoom In"
          data-testid="chart-map-zoom-in"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-9 h-9 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-md shadow-md hover:bg-white hover:shadow-lg transition-all duration-200 flex items-center justify-center text-base font-semibold text-gray-700 hover:text-gray-900"
          title="Zoom Out"
          data-testid="chart-map-zoom-out"
        >
          −
        </button>
      </div>

      {/* Data loading overlay */}
      {showDataLoadingOverlay && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-sm text-muted-foreground">Loading data...</p>
          </div>
        </div>
      )}

      {/* Data error overlay */}
      {mapDataError && geojsonData && (
        <div className="absolute top-4 left-4 right-4">
          <Alert variant="warning" className="max-w-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Data needs attention: {mapDataError?.message || mapDataError}
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
