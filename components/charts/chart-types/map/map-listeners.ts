import type { MutableRefObject } from 'react';
import type * as echarts from 'echarts';

/**
 * Pinch-zoom suppression, the region click handler and the mobile tap → showTip fallback.
 * Attached once per DOM node (the caller tracks that). Moved verbatim from MapPreview.
 */
export function attachMapDomListeners(
  chartDom: HTMLDivElement,
  chartInstance: MutableRefObject<echarts.ECharts | null>,
  onRegionClick: ((regionName: string, regionData: unknown) => void) | undefined
) {
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
    const handleClick = (params: { componentType?: string; name: string; data?: unknown }) => {
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
}
