'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as echarts from 'echarts';

export interface UseMapChartOptions {
  /** GeoJSON data for map boundaries */
  geojsonData: any | undefined;
  /** Map data points for overlay */
  mapData: any[] | undefined;
  /** Chart title */
  title?: string;
  /** Value column name for tooltips */
  valueColumn?: string;
  /** Map customization options */
  customizations?: Record<string, any>;
  /** Legacy config for backwards compatibility */
  legacyConfig?: Record<string, any>;
  /** Callback when chart instance is ready */
  onChartReady?: (chart: echarts.ECharts) => void;
  /** Callback when a region is clicked */
  onRegionClick?: (regionName: string, regionData: any) => void;
  /** Whether the dashboard is currently resizing */
  isResizing?: boolean;
  /** Transform function to build ECharts config */
  transformConfig: (
    mapName: string,
    mapData: any[] | undefined,
    title: string | undefined,
    valueColumn: string | undefined,
    customizations: Record<string, any>,
    zoom: number
  ) => Record<string, any>;
  /** Transform function for legacy config */
  transformLegacyConfig?: (config: Record<string, any>) => {
    chartConfig: Record<string, any>;
    mapData: any;
    mapName: string;
  };
}

export interface UseMapChartReturn {
  /** Ref to attach to the chart container div */
  chartRef: React.RefObject<HTMLDivElement>;
  /** Current zoom level */
  currentZoom: number;
  /** Zoom in handler */
  handleZoomIn: () => void;
  /** Zoom out handler */
  handleZoomOut: () => void;
  /** Whether chart is ready */
  isReady: boolean;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 10;
const ZOOM_FACTOR = 1.5;
const DEFAULT_ZOOM = 0.8;

/**
 * Hook for managing ECharts map instance lifecycle
 *
 * Extends base ECharts functionality with:
 * - GeoJSON map registration
 * - Unique map naming per instance
 * - ResizeObserver for container changes
 * - Dashboard resize handling
 * - Touch event handling for mobile
 * - Zoom controls
 * - Region click handling
 *
 * @example
 * ```tsx
 * const { chartRef, currentZoom, handleZoomIn, handleZoomOut } = useMapChart({
 *   geojsonData,
 *   mapData,
 *   customizations,
 *   onRegionClick: (name, data) => console.log(name, data),
 *   transformConfig: transformMapConfig,
 * });
 *
 * return <div ref={chartRef} className="w-full h-full" />;
 * ```
 */
export function useMapChart({
  geojsonData,
  mapData,
  title,
  valueColumn,
  customizations = {},
  legacyConfig,
  onChartReady,
  onRegionClick,
  isResizing = false,
  transformConfig,
  transformLegacyConfig,
}: UseMapChartOptions): UseMapChartReturn {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Zoom state
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
  const [isReady, setIsReady] = useState(false);

  // Create stable reference for customizations
  const safeCustomizations = useMemo(() => customizations || {}, [customizations]);

  // Create a unique map name per component instance
  const uniqueMapName = useRef(`customMap-${Date.now()}-${Math.random()}`).current;
  // Zoom control functions
  const handleZoomIn = useCallback(() => {
    if (chartInstance.current) {
      const newZoom = Math.min(currentZoom * ZOOM_FACTOR, MAX_ZOOM);
      setCurrentZoom(newZoom);

      chartInstance.current.setOption({
        series: [{ zoom: newZoom }],
      });
    }
  }, [currentZoom]);

  const handleZoomOut = useCallback(() => {
    if (chartInstance.current) {
      const newZoom = Math.max(currentZoom / ZOOM_FACTOR, MIN_ZOOM);
      setCurrentZoom(newZoom);

      chartInstance.current.setOption({
        series: [{ zoom: newZoom }],
      });
    }
  }, [currentZoom]);
  // Initialize map chart
  const initializeMapChart = useCallback(() => {
    if (!chartRef.current) return;

    try {
      let chartConfig: Record<string, any>;
      let mapName = uniqueMapName;

      // Check if we have GeoJSON data to render
      if (geojsonData) {
        // Register the GeoJSON data
        echarts.registerMap(mapName, geojsonData);
        // Build chart config using transform function
        chartConfig = transformConfig(
          mapName,
          mapData,
          title,
          valueColumn,
          safeCustomizations,
          currentZoom
        );
      } else if (legacyConfig && transformLegacyConfig) {
        // Fallback to legacy config format
        const {
          chartConfig: legacyChartConfig,
          mapData: legacyMapData,
          mapName: legacyMapName,
        } = transformLegacyConfig(legacyConfig);

        if (legacyMapData && legacyMapName) {
          echarts.registerMap(legacyMapName, legacyMapData);
        }
        chartConfig = legacyChartConfig;
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
        width: chartRef.current.clientWidth,
        height: chartRef.current.clientHeight,
      });

      chartInstance.current.setOption(chartConfig, {
        notMerge: true,
        replaceMerge: ['series'],
      });

      // Configure touch behavior - disable pinch zoom only
      if (chartRef.current) {
        const chartDom = chartRef.current;

        const preventPinchZoom = (e: TouchEvent) => {
          if (e.touches.length > 1) {
            e.preventDefault();
          }
        };

        chartDom.addEventListener('touchstart', preventPinchZoom, { passive: false });
        chartDom.addEventListener('touchmove', preventPinchZoom, { passive: false });
      }

      // Add click event listener
      if (onRegionClick && chartInstance.current) {
        chartInstance.current.on('click', (params: any) => {
          if (params.componentType === 'geo' || params.componentType === 'series') {
            onRegionClick(params.name, params.data);
          }
        });

        // Mobile touch handling
        if ('ontouchstart' in window && chartRef.current) {
          const chartDom = chartRef.current;
          let touchStartTime = 0;
          let touchMoved = false;

          chartDom.addEventListener('touchstart', () => {
            touchStartTime = Date.now();
            touchMoved = false;
          });

          chartDom.addEventListener('touchmove', () => {
            touchMoved = true;
          });

          chartDom.addEventListener('touchend', (e: TouchEvent) => {
            const touchDuration = Date.now() - touchStartTime;
            if (!touchMoved && touchDuration < 500) {
              const touch = e.changedTouches[0];
              const rect = chartDom.getBoundingClientRect();
              const x = touch.clientX - rect.left;
              const y = touch.clientY - rect.top;

              chartInstance.current?.dispatchAction({
                type: 'showTip',
                x: x,
                y: y,
              });
            }
          });
        }
      }

      setIsReady(true);

      if (onChartReady && chartInstance.current) {
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
    legacyConfig,
    onChartReady,
    onRegionClick,
    transformConfig,
    transformLegacyConfig,
    uniqueMapName,
    currentZoom,
  ]);

  // Initialize chart when data changes
  useEffect(() => {
    initializeMapChart();
  }, [initializeMapChart]);

  // Handle window resize with debouncing
  useEffect(() => {
    let resizeTimeoutId: NodeJS.Timeout | null = null;

    const handleResize = () => {
      if (chartInstance.current) {
        if (resizeTimeoutId) {
          clearTimeout(resizeTimeoutId);
        }
        resizeTimeoutId = setTimeout(() => {
          chartInstance.current?.resize();
        }, 100);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
    };
  }, []);

  // Handle container resize using ResizeObserver
  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimeoutId: NodeJS.Timeout | null = null;

    if (chartRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver((entries) => {
        if (resizeTimeoutId) {
          clearTimeout(resizeTimeoutId);
        }

        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            resizeTimeoutId = setTimeout(() => {
              if (chartInstance.current) {
                chartInstance.current.resize({
                  width: Math.floor(width),
                  height: Math.floor(height),
                });

                // Force redraw
                const currentOption = chartInstance.current.getOption();
                chartInstance.current.setOption(currentOption, {
                  notMerge: false,
                  lazyUpdate: false,
                });

                setTimeout(() => {
                  chartInstance.current?.resize();
                }, 50);
              }
            }, 50);
          }
        }
      });

      resizeObserver.observe(chartRef.current);
    }

    return () => {
      resizeObserver?.disconnect();
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
    };
  }, []);

  // Handle resize when isResizing prop changes (dashboard resize)
  useEffect(() => {
    if (!isResizing && chartInstance.current && chartRef.current) {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      resizeTimeoutRef.current = setTimeout(() => {
        if (chartInstance.current && chartRef.current) {
          const { width, height } = chartRef.current.getBoundingClientRect();
          chartInstance.current.resize({
            width: Math.floor(width),
            height: Math.floor(height),
          });
        }
      }, 300);
    }

    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [isResizing]);

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
    currentZoom,
    handleZoomIn,
    handleZoomOut,
    isReady,
  };
}

export default useMapChart;
