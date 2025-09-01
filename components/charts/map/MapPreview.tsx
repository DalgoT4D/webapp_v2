'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import * as echarts from 'echarts';
import { Loader2, AlertCircle, Map, ArrowLeft, Home } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Zoom state
  const [currentZoom, setCurrentZoom] = useState(1);

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
    if (!chartRef.current) return;

    try {
      let chartConfig;
      let mapName = uniqueMapName; // Use stable unique map name

      // Check if we have GeoJSON data to render
      if (geojsonData) {
        // Register the GeoJSON data
        echarts.registerMap(mapName, geojsonData);

        // Create map series data
        let seriesData: any[] = [];
        if (mapData && mapData.length > 0) {
          // We have data to overlay on the map
          seriesData = mapData.map((item) => ({
            name: item.name,
            value: item.value,
          }));
        }

        // Calculate min/max values for color scaling
        const values = seriesData.map((item) => item.value).filter((v) => v != null);
        const minValue = values.length > 0 ? Math.min(...values) : 0;
        const maxValue = values.length > 0 ? Math.max(...values) : 100;

        // Create uniform color with opacity-based mapping for each data point
        const baseColor = '#1f77b4'; // Blue base color
        const enhancedSeriesData = seriesData.map((item) => {
          const normalizedValue =
            maxValue > minValue ? (item.value - minValue) / (maxValue - minValue) : 0;
          // Map to opacity range: 0.3 (min) to 1.0 (max) for better visibility
          const opacity = 0.3 + normalizedValue * 0.7;
          return {
            name: item.name,
            value: item.value,
            itemStyle: {
              areaColor: `${baseColor}${Math.round(opacity * 255)
                .toString(16)
                .padStart(2, '0')}`,
            },
          };
        });

        // Create ECharts configuration
        chartConfig = {
          title: title
            ? {
                text: title,
                left: 'center',
              }
            : undefined,
          tooltip: {
            trigger: 'item',
            formatter: function (params: any) {
              if (params.data && params.data.value != null) {
                return `${params.name}<br/>${valueColumn || 'Value'}: ${params.data.value}`;
              }
              return `${params.name}<br/>No data`;
            },
          },
          // Disable visualMap to prevent it from coloring ALL regions
          // Instead, use individual itemStyle coloring for data regions only
          series: [
            {
              name: 'Map Data',
              type: 'map',
              mapType: mapName,
              roam: 'move', // Allow pan but disable pinch zoom
              // Configure how regions without data should appear (default styling)
              itemStyle: {
                areaColor: '#f5f5f5', // Light gray for regions without data
                borderColor: '#333',
                borderWidth: 0.5,
              },
              emphasis: {
                label: {
                  show: true,
                },
                itemStyle: {
                  areaColor: '#37a2da',
                },
              },
              // Use enhanced data with individual colors to avoid global visualMap
              data: enhancedSeriesData,
            },
          ],
        };
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

      // Dispose existing instance
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }

      // Create new instance
      chartInstance.current = echarts.init(chartRef.current);
      chartInstance.current.setOption(chartConfig);

      // Configure touch behavior - disable pinch zoom only
      if (chartInstance.current && chartRef.current) {
        const chartDom = chartRef.current;

        // Disable default pinch zoom behaviors
        chartDom.addEventListener(
          'touchstart',
          (e) => {
            if (e.touches.length > 1) {
              e.preventDefault(); // Prevent pinch zoom
            }
          },
          { passive: false }
        );

        chartDom.addEventListener(
          'touchmove',
          (e) => {
            if (e.touches.length > 1) {
              e.preventDefault(); // Prevent pinch zoom
            }
          },
          { passive: false }
        );
      }

      // Click event listener will be added separately to avoid re-initialization

      if (onChartReady) {
        onChartReady(chartInstance.current);
      }
    } catch (err) {
      console.error('Error initializing map chart:', err);
    }
  }, [geojsonData, mapData, title, valueColumn, config, onChartReady]);

  // Initialize chart when data changes
  useEffect(() => {
    initializeMapChart();
  }, [initializeMapChart]);

  // Handle click event listener separately to prevent re-initialization during resize
  useEffect(() => {
    if (!chartInstance.current || !onRegionClick) return undefined;

    const handleClick = (params: any) => {
      if (params.componentType === 'geo' || params.componentType === 'series') {
        onRegionClick(params.name, params.data);
      }
    };

    // Remove any existing click listeners
    chartInstance.current.off('click');
    // Add new click listener
    chartInstance.current.on('click', handleClick);

    return () => {
      if (chartInstance.current) {
        chartInstance.current.off('click');
      }
    };
  }, [onRegionClick]); // Only re-run when onRegionClick changes

  // Handle window resize with debouncing - separate from chart data changes
  useEffect(() => {
    let resizeTimeoutId: NodeJS.Timeout | null = null;

    const handleResize = () => {
      if (chartInstance.current) {
        // Clear any pending resize
        if (resizeTimeoutId) {
          clearTimeout(resizeTimeoutId);
        }

        // Debounce resize calls
        resizeTimeoutId = setTimeout(() => {
          if (chartInstance.current) {
            chartInstance.current.resize();
          }
        }, 100);
      }
    };

    // Handle window resize
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
    };
  }, []); // No dependencies to avoid infinite loops

  // Handle container resize using ResizeObserver - separate effect
  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimeoutId: NodeJS.Timeout | null = null;

    if (chartRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver((entries) => {
        // Clear any pending resize
        if (resizeTimeoutId) {
          clearTimeout(resizeTimeoutId);
        }

        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            // Debounce rapid resize events
            resizeTimeoutId = setTimeout(() => {
              if (chartInstance.current) {
                // Constrain dimensions to ensure chart fits within bounds
                const maxWidth = Math.floor(width);
                const maxHeight = Math.floor(height);

                // Force explicit resize with constrained dimensions
                chartInstance.current.resize({
                  width: maxWidth,
                  height: maxHeight,
                });

                // Force chart to redraw and refit content
                const currentOption = chartInstance.current.getOption();
                chartInstance.current.setOption(currentOption, {
                  notMerge: false,
                  lazyUpdate: false,
                });

                // Additional resize call to ensure proper fitting
                setTimeout(() => {
                  if (chartInstance.current) {
                    chartInstance.current.resize();
                  }
                }, 50);
              }
            }, 50); // Even faster response for browser zoom
          }
        }
      });

      resizeObserver.observe(chartRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
    };
  }, []); // No dependencies to avoid re-creating observer

  // Handle resize when isResizing prop changes (dashboard resize)
  useEffect(() => {
    if (!isResizing && chartInstance.current && chartRef.current) {
      // Clear any pending resize
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      // Perform final resize after drag/resize stops
      resizeTimeoutRef.current = setTimeout(() => {
        if (chartInstance.current && chartRef.current) {
          const { width, height } = chartRef.current.getBoundingClientRect();
          chartInstance.current.resize({
            width: Math.floor(width),
            height: Math.floor(height),
          });
        }
      }, 300); // Slightly longer delay for final resize
    }

    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [isResizing]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  // Show loading states
  if (isLoading || geojsonLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
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
      <div className="flex items-center justify-center h-full min-h-[500px] p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load map. Please check your configuration and try again.
            <br />
            <span className="text-xs mt-1 block">{errorMessage}</span>
          </AlertDescription>
        </Alert>
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
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}

          <Badge variant="outline">Level {drillDownPath.length || 1}</Badge>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full relative">
      {showBreadcrumbs && <BreadcrumbNavigation />}
      <div ref={chartRef} className="w-full h-full" style={{ width: '100%', height: '100%' }} />

      {/* Custom Zoom Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-1 z-10">
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 flex items-center justify-center text-lg font-bold text-gray-600"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 flex items-center justify-center text-lg font-bold text-gray-600"
          title="Zoom Out"
        >
          −
        </button>
      </div>

      {/* Data loading overlay */}
      {showDataLoadingOverlay && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading data...</p>
          </div>
        </div>
      )}

      {/* Data error overlay */}
      {mapDataError && geojsonData && (
        <div className="absolute top-4 right-4">
          <Alert variant="destructive" className="w-80">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load data: {mapDataError?.message || mapDataError}
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
