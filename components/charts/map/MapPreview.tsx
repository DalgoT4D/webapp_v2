'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
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
  // MapPreview initialization
  // Create stable reference for customizations to avoid unnecessary re-renders
  const safeCustomizations = useMemo(() => customizations || {}, [customizations]);

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

      console.log('📊 [MAP-PREVIEW] Starting chart configuration with mapName:', mapName);

      // Check if we have GeoJSON data to render
      if (geojsonData) {
        console.log('🗺️ [MAP-PREVIEW] GeoJSON data found, registering map:', {
          mapName,
          geojsonFeatures: geojsonData.features?.length || 0,
          geojsonType: geojsonData.type,
        });

        // Register the GeoJSON data
        echarts.registerMap(mapName, geojsonData);
        console.log('✅ [MAP-PREVIEW] Map registered successfully with ECharts');

        // Create map series data
        let seriesData: any[] = [];
        if (mapData && mapData.length > 0) {
          console.log('📊 [MAP-PREVIEW] Creating series data from mapData:', {
            mapDataLength: mapData.length,
            sampleData: mapData.slice(0, 3),
          });

          // We have data to overlay on the map
          seriesData = mapData.map((item) => ({
            name: item.name,
            value: item.value,
          }));

          console.log('📈 [MAP-PREVIEW] Series data created:', {
            seriesLength: seriesData.length,
            sampleSeries: seriesData.slice(0, 3),
          });
        } else {
          console.log('⚠️ [MAP-PREVIEW] No mapData available for series creation');
        }

        // Calculate min/max values for color scaling
        const values = seriesData.map((item) => item.value).filter((v) => v != null);
        let minValue = values.length > 0 ? Math.min(...values) : 0;
        let maxValue = values.length > 0 ? Math.max(...values) : 100;

        // Check if we have single value scenario (all regions have same value)
        const hasSingleValue = minValue === maxValue && values.length > 0;

        // Fix for single value: create a small range for visualMap to work correctly
        // This ensures the single state is highlighted properly when only one state has data
        if (hasSingleValue && minValue === maxValue) {
          const originalValue = minValue;
          // Create a small range around the single value (e.g., ±10% or minimum ±1)
          const offset = Math.max(Math.abs(minValue * 0.1), 1);
          minValue = minValue - offset;
          maxValue = maxValue + offset;
          console.log('🎨 [MAP-PREVIEW] Single value detected - adjusting range for visualMap:', {
            originalValue,
            adjustedMin: minValue,
            adjustedMax: maxValue,
            dataPoints: seriesData.length,
          });
        }

        // Get color scheme from customizations
        const colorScheme = safeCustomizations.colorScheme || 'Blues';
        const colorMaps: Record<string, string> = {
          Blues: '#1f77b4',
          Reds: '#d62728',
          Greens: '#2ca02c',
          Purples: '#9467bd',
          Oranges: '#ff7f0e',
          Greys: '#7f7f7f',
        };
        const baseColor = colorMaps[colorScheme] || colorMaps.Blues;

        // Create color-mapped data points based on scheme
        const enhancedSeriesData = seriesData.map((item) => {
          const normalizedValue =
            maxValue > minValue ? (item.value - minValue) / (maxValue - minValue) : 1; // Use 1.0 for single value case
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

        // Create ECharts configuration with applied customizations
        chartConfig = {
          title:
            safeCustomizations.title || title
              ? {
                  text: safeCustomizations.title || title,
                  left: 'center',
                  show: true,
                }
              : undefined,
          tooltip: {
            trigger: 'item',
            show: safeCustomizations.showTooltip !== false,
            formatter: function (params: any) {
              if (params.data && params.data.value != null) {
                return `${params.name}<br/>${valueColumn || 'Value'}: ${params.data.value}`;
              }
              return `${params.name}<br/>${safeCustomizations.nullValueLabel !== undefined ? safeCustomizations.nullValueLabel : 'No Data'}`;
            },
          },
          // Add legend based on customizations
          // Hide legend for single-value scenarios as it would be misleading to show a range
          ...(safeCustomizations.showLegend !== false &&
            values.length > 0 &&
            !hasSingleValue && {
              visualMap: {
                min: minValue,
                max: maxValue,
                text: ['High', 'Low'],
                realtime: false,
                calculable: true,
                inRange: {
                  color: [
                    `${baseColor}4D`, // 30% opacity
                    baseColor, // 100% opacity
                  ],
                },
                orient: 'vertical',
                left: '20px',
                bottom: '72px', // Moved up by another 16px (56px + 16px = 72px)
                // Ensure legend is properly sized and visible
                itemWidth: 20,
                itemHeight: '120px',
                textStyle: {
                  fontSize: 12,
                  color: '#666',
                },
              },
            }),
          series: [
            {
              name: 'Map Data',
              type: 'map',
              mapType: mapName,
              // Enable move only (panning) - zoom handled by our custom buttons
              roam: 'move',
              // Ensure map fits within container bounds with better sizing
              layoutCenter: ['50%', '50%'],
              layoutSize: '75%',
              // Set initial zoom level
              zoom: currentZoom,
              // Apply selection settings - ALWAYS enable for clicks to work
              selectedMode: 'single',
              // Configure how regions without data should appear (default styling)
              itemStyle: {
                areaColor: '#f5f5f5', // Light gray for regions without data
                borderColor: safeCustomizations.borderColor || '#333',
                borderWidth: safeCustomizations.borderWidth || 0.5,
              },
              label: {
                show: safeCustomizations.showLabels === true,
                fontSize: 12,
                color: '#333',
              },
              emphasis: {
                label: {
                  show: safeCustomizations.emphasis !== false,
                  fontSize: 14,
                },
                itemStyle: {
                  areaColor: safeCustomizations.emphasis !== false ? '#37a2da' : undefined,
                },
              },
              // Animation settings
              animation: safeCustomizations.animation !== false,
              animationDuration: safeCustomizations.animation !== false ? 1000 : 0,
              // Use enhanced data with individual colors when legend is disabled OR single value
              ...(safeCustomizations.showLegend === false || hasSingleValue
                ? {
                    data: enhancedSeriesData,
                  }
                : {
                    data: seriesData, // Use original data when visualMap is enabled
                  }),
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

      // Add click event listener immediately after chart initialization
      if (onRegionClick) {
        const handleClick = (params: any) => {
          if (params.componentType === 'geo' || params.componentType === 'series') {
            onRegionClick(params.name, params.data);
          }
        };

        // Add click listener to the newly created chart instance
        chartInstance.current.on('click', handleClick);

        // Also add mobile-specific touch handling
        if ('ontouchstart' in window && chartRef.current) {
          const chartDom = chartRef.current;
          let touchStartTime = 0;
          let touchMoved = false;

          const handleTouchStart = () => {
            touchStartTime = Date.now();
            touchMoved = false;
          };

          const handleTouchMove = () => {
            touchMoved = true;
          };

          const handleTouchEnd = (e: TouchEvent) => {
            const touchDuration = Date.now() - touchStartTime;
            if (!touchMoved && touchDuration < 500) {
              // Simulate a click event for mobile
              const touch = e.changedTouches[0];
              const rect = chartDom.getBoundingClientRect();
              const x = touch.clientX - rect.left;
              const y = touch.clientY - rect.top;

              // Trigger ECharts click detection
              chartInstance.current?.dispatchAction({
                type: 'showTip',
                x: x,
                y: y,
              });
            }
          };

          chartDom.addEventListener('touchstart', handleTouchStart);
          chartDom.addEventListener('touchmove', handleTouchMove);
          chartDom.addEventListener('touchend', handleTouchEnd);
        }
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
  ]);

  // Initialize chart when data changes
  useEffect(() => {
    initializeMapChart();
  }, [initializeMapChart]);

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
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-9 h-9 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-md shadow-md hover:bg-white hover:shadow-lg transition-all duration-200 flex items-center justify-center text-base font-semibold text-gray-700 hover:text-gray-900"
          title="Zoom Out"
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
