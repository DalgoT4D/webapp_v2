'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as echarts from 'echarts';
import { Loader2, AlertCircle, Map, ArrowLeft, Home } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/formatters';

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

// HTML escape function to prevent XSS in tooltip HTML
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
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
        let minValue = values.length > 0 ? Math.min(...values) : 0;
        let maxValue = values.length > 0 ? Math.max(...values) : 100;

        // Check if we have single value scenario (all regions have same value)
        const hasSingleValue = minValue === maxValue && values.length > 0;

        // Fix for single value: create a meaningful range from 0 or to 0
        // This ensures the single state is highlighted properly and legend shows context
        if (hasSingleValue && minValue === maxValue) {
          const actualValue = maxValue;

          if (actualValue > 0) {
            // Positive value: range from 0 to value (e.g., 0 to 100)
            minValue = 0;
            maxValue = actualValue;
          } else if (actualValue < 0) {
            // Negative value: range from value to 0 (e.g., -50 to 0)
            minValue = actualValue;
            maxValue = 0;
          } else {
            // Value is exactly 0: create a small symmetric range
            minValue = -1;
            maxValue = 1;
          }
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

        // Create a lighter version of the base color for emphasis/highlight
        const lightenColor = (hex: string, percent: number): string => {
          const num = parseInt(hex.replace('#', ''), 16);
          const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * percent));
          const g = Math.min(
            255,
            Math.floor(((num >> 8) & 0x00ff) + (255 - ((num >> 8) & 0x00ff)) * percent)
          );
          const b = Math.min(
            255,
            Math.floor((num & 0x0000ff) + (255 - (num & 0x0000ff)) * percent)
          );
          return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        };
        const emphasisColor = lightenColor(baseColor, 0.4); // 40% lighter

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
          tooltip: (() => {
            // Responsive tooltip based on container size
            const currentSize = containerSizeRef.current;
            const effectiveWidth = currentSize.width > 0 ? currentSize.width : 400;
            const effectiveHeight = currentSize.height > 0 ? currentSize.height : 300;
            const isVerySmall = effectiveWidth < 250 || effectiveHeight < 200;
            const isSmall = effectiveWidth < 350 || effectiveHeight < 280;

            return {
              trigger: 'item',
              show: safeCustomizations.showTooltip !== false,
              // Responsive padding and font size
              padding: isVerySmall ? [4, 6] : isSmall ? [6, 8] : [8, 12],
              textStyle: {
                fontSize: isVerySmall ? 10 : isSmall ? 11 : 12,
              },
              // Constrain tooltip size for small containers
              extraCssText: isVerySmall
                ? 'max-width: 120px; white-space: normal; line-height: 1.3;'
                : isSmall
                  ? 'max-width: 150px; white-space: normal; line-height: 1.4;'
                  : '',
              formatter: function (params: any) {
                const rawLabel = valueColumn || 'Value';
                const label = escapeHtml(rawLabel);
                const rawName = params.name ?? '';
                if (params.data && params.data.value != null) {
                  // Truncate long names for small containers, then escape
                  const truncatedName =
                    isVerySmall && rawName.length > 15
                      ? rawName.substring(0, 13) + '...'
                      : isSmall && rawName.length > 20
                        ? rawName.substring(0, 18) + '...'
                        : rawName;
                  const name = escapeHtml(truncatedName);
                  // Apply number formatting if configured
                  let formattedValue = params.data.value;
                  if (
                    safeCustomizations.numberFormat ||
                    safeCustomizations.decimalPlaces !== undefined
                  ) {
                    formattedValue = formatNumber(params.data.value, {
                      format: safeCustomizations.numberFormat || 'default',
                      decimalPlaces: safeCustomizations.decimalPlaces,
                    });
                  }
                  return `<b>${name}</b><br/>${label}: ${formattedValue}`;
                }
                const rawNullLabel =
                  safeCustomizations.nullValueLabel !== undefined
                    ? String(safeCustomizations.nullValueLabel)
                    : 'No Data';
                const nullLabel = escapeHtml(rawNullLabel);
                // Truncate long names for small containers, then escape
                const truncatedName =
                  isVerySmall && rawName.length > 15
                    ? rawName.substring(0, 13) + '...'
                    : isSmall && rawName.length > 20
                      ? rawName.substring(0, 18) + '...'
                      : rawName;
                const name = escapeHtml(truncatedName);
                return `<b>${name}</b><br/>${nullLabel}`;
              },
            };
          })(),
          // Add legend based on customizations - responsive to container size
          // For single values, show range from 0 to actual value for meaningful context
          ...(safeCustomizations.showLegend !== false &&
            values.length > 0 && {
              visualMap: (() => {
                // Get effective container size for responsive legend
                const currentSize = containerSizeRef.current;
                const effectiveWidth = currentSize.width > 0 ? currentSize.width : 400;
                const effectiveHeight = currentSize.height > 0 ? currentSize.height : 300;

                // Determine legend mode based on container size
                const isVerySmall = effectiveWidth < 200 || effectiveHeight < 180;
                const isSmall = effectiveWidth < 300 || effectiveHeight < 250;
                const isCompact = effectiveWidth < 400 || effectiveHeight < 320;

                // Hide legend for very small containers
                if (isVerySmall) {
                  return { show: false };
                }

                // Responsive sizing based on container
                const itemWidth = isSmall ? 12 : isCompact ? 16 : 20;
                const itemHeight = isSmall ? 50 : isCompact ? 70 : 100;
                const fontSize = isSmall ? 10 : isCompact ? 11 : 12;
                const margin = isSmall ? 8 : isCompact ? 12 : 20;

                // Legend positioning - defaults to bottom-left, users can change in customizations
                // Any unrecognized value defaults to bottom-left
                const legendPosition = safeCustomizations.legendPosition || 'bottom-left';
                let positionConfig;
                switch (legendPosition) {
                  case 'top-right':
                    positionConfig = {
                      orient: 'vertical',
                      right: `${margin}px`,
                      top: `${margin}px`,
                    };
                    break;
                  case 'top-left':
                    positionConfig = {
                      orient: 'vertical',
                      left: `${margin}px`,
                      top: `${margin}px`,
                    };
                    break;
                  case 'bottom-right':
                    positionConfig = {
                      orient: 'vertical',
                      right: `${margin}px`,
                      bottom: `${margin}px`,
                    };
                    break;
                  case 'bottom-left':
                  default:
                    positionConfig = {
                      orient: 'vertical',
                      left: `${margin}px`,
                      bottom: `${margin}px`,
                    };
                    break;
                }

                return {
                  show: true,
                  min: minValue,
                  max: maxValue,
                  text: isSmall ? ['H', 'L'] : ['High', 'Low'],
                  realtime: false,
                  calculable: true,
                  inRange: {
                    color: [
                      `${baseColor}4D`, // 30% opacity
                      baseColor, // 100% opacity
                    ],
                  },
                  ...positionConfig,
                  itemWidth,
                  itemHeight,
                  textStyle: {
                    fontSize,
                    color: '#666',
                  },
                };
              })(),
            }),
          series: [
            {
              name: 'Map Data',
              type: 'map',
              mapType: mapName,
              // Enable move only (panning) - zoom handled by our custom buttons
              roam: 'move',
              // Responsive map sizing - use more space for smaller containers
              layoutCenter: ['50%', '50%'],
              layoutSize: (() => {
                const currentSize = containerSizeRef.current;
                const effectiveWidth = currentSize.width > 0 ? currentSize.width : 400;
                const effectiveHeight = currentSize.height > 0 ? currentSize.height : 300;
                // For smaller containers, use more of the available space
                if (effectiveWidth < 250 || effectiveHeight < 200) return '95%';
                if (effectiveWidth < 350 || effectiveHeight < 280) return '90%';
                if (effectiveWidth < 450 || effectiveHeight < 350) return '85%';
                return '80%'; // Standard size for larger containers
              })(),
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
                  show: true,
                  fontSize: 14,
                },
                itemStyle: {
                  areaColor: emphasisColor,
                },
              },
              // Animation settings
              animation: safeCustomizations.animation !== false,
              animationDuration: safeCustomizations.animation !== false ? 1000 : 0,
              // Use enhanced data with individual colors when legend is disabled
              ...(safeCustomizations.showLegend === false
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

        // Add click event listener for region clicks
        if (onRegionClick) {
          const handleClick = (params: any) => {
            if (params.componentType === 'geo' || params.componentType === 'series') {
              onRegionClick(params.name, params.data);
            }
          };

          chartInstance.current.on('click', handleClick);

          // Also add mobile-specific touch handling
          if ('ontouchstart' in window) {
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

  // Helper to compute responsive layout options based on container size
  const computeResponsiveOptions = useCallback(
    (width: number, height: number, legendPosition: string) => {
      const isVerySmall = width < 250 || height < 200;
      const isSmall = width < 350 || height < 280;
      const isCompact = width < 400 || height < 320;

      // Compute layoutSize
      let layoutSize = '80%';
      if (width < 250 || height < 200) layoutSize = '95%';
      else if (width < 350 || height < 280) layoutSize = '90%';
      else if (width < 450 || height < 350) layoutSize = '85%';

      // Compute tooltip options
      const tooltipOptions = {
        padding: isVerySmall ? [4, 6] : isSmall ? [6, 8] : [8, 12],
        textStyle: {
          fontSize: isVerySmall ? 10 : isSmall ? 11 : 12,
        },
        extraCssText: isVerySmall
          ? 'max-width: 120px; white-space: normal; line-height: 1.3;'
          : isSmall
            ? 'max-width: 150px; white-space: normal; line-height: 1.4;'
            : '',
      };

      // Compute visualMap options (legend)
      const isVerySmallLegend = width < 200 || height < 180;
      const isSmallLegend = width < 300 || height < 250;
      const itemWidth = isSmallLegend ? 12 : isCompact ? 16 : 20;
      const itemHeight = isSmallLegend ? 50 : isCompact ? 70 : 100;
      const fontSize = isSmallLegend ? 10 : isCompact ? 11 : 12;
      const margin = isSmallLegend ? 8 : isCompact ? 12 : 20;

      // Compute legend position based on user customization
      // Any unrecognized value defaults to bottom-left
      let positionConfig;
      switch (legendPosition) {
        case 'top-right':
          positionConfig = { orient: 'vertical', right: `${margin}px`, top: `${margin}px` };
          break;
        case 'top-left':
          positionConfig = { orient: 'vertical', left: `${margin}px`, top: `${margin}px` };
          break;
        case 'bottom-right':
          positionConfig = { orient: 'vertical', right: `${margin}px`, bottom: `${margin}px` };
          break;
        case 'bottom-left':
        default:
          positionConfig = { orient: 'vertical', left: `${margin}px`, bottom: `${margin}px` };
          break;
      }

      const visualMapOptions = isVerySmallLegend
        ? { show: false }
        : {
            text: isSmallLegend ? ['H', 'L'] : ['High', 'Low'],
            itemWidth,
            itemHeight,
            textStyle: { fontSize, color: '#666' },
            ...positionConfig,
          };

      return { layoutSize, tooltipOptions, visualMapOptions };
    },
    []
  );

  // Handle container resize using ResizeObserver - separate effect
  // Updates containerSizeRef and calls setOption for responsive updates
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
            // Update container size ref (no state update, no re-render)
            containerSizeRef.current = { width, height };

            // Debounce rapid resize events
            resizeTimeoutId = setTimeout(() => {
              if (chartInstance.current) {
                const maxWidth = Math.floor(width);
                const maxHeight = Math.floor(height);

                // Resize the chart canvas
                chartInstance.current.resize({
                  width: maxWidth,
                  height: maxHeight,
                });

                // Update responsive layout options without full re-init
                const { layoutSize, tooltipOptions, visualMapOptions } = computeResponsiveOptions(
                  width,
                  height,
                  safeCustomizations.legendPosition || 'bottom-left'
                );

                chartInstance.current.setOption(
                  {
                    tooltip: tooltipOptions,
                    visualMap: visualMapOptions,
                    series: [{ layoutSize }],
                  },
                  { notMerge: false }
                );
              }
            }, 50);
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
  }, [computeResponsiveOptions, safeCustomizations]);

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
        listenersAttachedRef.current = false;
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
