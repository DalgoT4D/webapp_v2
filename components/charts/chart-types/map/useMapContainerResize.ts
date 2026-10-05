import { useEffect, type MutableRefObject, type RefObject } from 'react';
import type * as echarts from 'echarts';
import { computeResponsiveMapOptions, type MapSize } from './map-option';

interface MapContainerResizeOptions {
  chartRef: RefObject<HTMLDivElement | null>;
  chartInstance: MutableRefObject<echarts.ECharts | null>;
  containerSizeRef: MutableRefObject<MapSize>;
  resizeTimeoutRef: MutableRefObject<NodeJS.Timeout | null>;
  listenersAttachedRef: MutableRefObject<boolean>;
  safeCustomizations: Record<string, any>;
  isResizing: boolean;
}

/** Window resize, ResizeObserver (re-fit + responsive options), the post-drag resize and unmount dispose. Moved verbatim. */
export function useMapContainerResize({
  chartRef,
  chartInstance,
  containerSizeRef,
  resizeTimeoutRef,
  listenersAttachedRef,
  safeCustomizations,
  isResizing,
}: MapContainerResizeOptions) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref passed as a parameter is stable; deps kept as before R6
  }, []); // No dependencies to avoid infinite loops

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
                const { layoutSize, tooltipOptions, visualMapOptions } =
                  computeResponsiveMapOptions(
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs passed as parameters are stable; deps kept as before R6
  }, [safeCustomizations]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs passed as parameters are stable; deps kept as before R6
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs passed as parameters are stable; deps kept as before R6
  }, []);
}
