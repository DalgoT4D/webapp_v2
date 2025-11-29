'use client';

import { useMemo } from 'react';
import type * as echarts from 'echarts';
import { Map } from 'lucide-react';
import { useMapChart } from '@/hooks/useMapChart';
import { transformMapConfig, transformLegacyMapConfig } from '@/lib/map-config-transform';
import {
  ChartLoadingState,
  ChartErrorState,
  ChartEmptyState,
  DataLoadingOverlay,
  DataErrorOverlay,
} from '../common/ChartStateRenderers';
import { MapBreadcrumbs, MapZoomControls, type DrillDownLevel } from '../common/MapControls';

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
  onChartReady?: (chart: echarts.ECharts) => void;
  onRegionClick?: (regionName: string, regionData: any) => void;
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
  // Stable customizations reference
  const safeCustomizations = useMemo(() => customizations || {}, [customizations]);

  // Use the map chart hook for all ECharts lifecycle management
  const { chartRef, handleZoomIn, handleZoomOut } = useMapChart({
    geojsonData: geojsonData,
    mapData: mapData,
    title,
    valueColumn,
    customizations: safeCustomizations,
    legacyConfig: config,
    onChartReady,
    onRegionClick,
    isResizing,
    transformConfig: transformMapConfig,
    transformLegacyConfig: transformLegacyMapConfig,
  });

  // Show loading states
  if (isLoading || geojsonLoading) {
    return (
      <ChartLoadingState
        message={geojsonLoading ? 'Loading map boundaries...' : 'Loading map...'}
        minHeight="500px"
      />
    );
  }

  // Show error states
  if (error || geojsonError) {
    const errorMessage = error?.message || error || geojsonError?.message || geojsonError;
    return (
      <ChartErrorState
        message="Map configuration needs a small adjustment. Please review your settings and try again."
        details={errorMessage}
        minHeight="500px"
      />
    );
  }

  // Show empty state when no GeoJSON or config is available
  if (!geojsonData && !config) {
    return (
      <ChartEmptyState
        icon={Map}
        title="Configure your map to see a preview"
        subtitle="Select country and GeoJSON to get started"
        minHeight="500px"
      />
    );
  }

  // Show data loading overlay if map is rendered but data is loading
  const showDataLoadingOverlay = mapDataLoading && geojsonData;

  return (
    <div className="w-full h-full relative overflow-hidden">
      {showBreadcrumbs && (
        <MapBreadcrumbs
          drillDownPath={drillDownPath}
          onDrillUp={onDrillUp}
          onDrillHome={onDrillHome}
        />
      )}

      <div
        ref={chartRef}
        className="w-full h-full"
        style={{ width: '100%', height: '100%', overflow: 'hidden' }}
      />

      <MapZoomControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        showBreadcrumbs={showBreadcrumbs && drillDownPath.length > 0}
      />

      {/* Data loading overlay */}
      {showDataLoadingOverlay && <DataLoadingOverlay message="Loading data..." />}

      {/* Data error overlay */}
      {mapDataError && geojsonData && (
        <DataErrorOverlay message={mapDataError?.message || mapDataError} />
      )}
    </div>
  );
}
