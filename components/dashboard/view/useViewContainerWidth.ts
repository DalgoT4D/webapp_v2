'use client';

import { useEffect, useState, type RefObject } from 'react';
import { getCurrentScreenSize } from './view-layout';
import type { ScreenSizeKey } from '@/components/dashboard/grid/grid-constants';

/** Debounce for re-measuring the viewport category on window resize. */
const SCREEN_SIZE_DEBOUNCE_MS = 150;
/** Width used before the container is measured (server render). */
const FALLBACK_WIDTH_PX = 1200;

/** The canvas container's measured width (and the viewport category, tracked as before). */
export function useViewContainerWidth(dashboardContainerRef: RefObject<HTMLDivElement | null>) {
  const [actualContainerWidth, setActualContainerWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : FALLBACK_WIDTH_PX
  );
  const [, setCurrentScreenSize] = useState<ScreenSizeKey>('desktop');

  // Update current screen size on resize
  useEffect(() => {
    const updateScreenSize = () => {
      const newScreenSize = getCurrentScreenSize();
      setCurrentScreenSize(newScreenSize);
    };

    // Initial measurement
    updateScreenSize();

    // Update on window resize with debouncing
    let resizeTimeout: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateScreenSize, SCREEN_SIZE_DEBOUNCE_MS);
    };

    window.addEventListener('resize', debouncedResize);

    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', debouncedResize);
    };
  }, []);

  // Observe dashboard container for responsive width
  useEffect(() => {
    if (!dashboardContainerRef.current) return undefined;

    // Set initial width
    const initialWidth = dashboardContainerRef.current.offsetWidth || window.innerWidth;
    setActualContainerWidth(initialWidth);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        // Use full available container width
        setActualContainerWidth(width);
      }
    });

    resizeObserver.observe(dashboardContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kept as before — mount-only observer
  }, []);

  return { actualContainerWidth };
}
