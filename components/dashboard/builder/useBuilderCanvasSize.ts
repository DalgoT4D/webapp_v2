'use client';

import { useEffect, useState, type RefObject } from 'react';
import { SCREEN_SIZES, type ScreenSizeKey } from '@/components/dashboard/grid/grid-constants';

/** Width used until the screen config provides one. */
const FALLBACK_CANVAS_WIDTH_PX = 1200;
/** The canvas is never shorter than this. */
const MIN_CANVAS_HEIGHT_PX = 400;

/** The builder canvas size: the target screen's config and the white container's measured width. */
export function useBuilderCanvasSize(
  targetScreenSize: ScreenSizeKey,
  dashboardContainerRef: RefObject<HTMLDivElement | null>
) {
  const currentScreenConfig = SCREEN_SIZES[targetScreenSize];
  const [containerWidth, setContainerWidth] = useState(
    SCREEN_SIZES[targetScreenSize]?.width || FALLBACK_CANVAS_WIDTH_PX
  );
  const [actualContainerWidth, setActualContainerWidth] = useState(
    SCREEN_SIZES[targetScreenSize]?.width || FALLBACK_CANVAS_WIDTH_PX
  );
  // Track actual dashboard container height for snap indicators (set, not read — kept)
  const [, setDashboardActualHeight] = useState(
    Math.max(currentScreenConfig.height, MIN_CANVAS_HEIGHT_PX)
  );

  // Update container width when target screen size changes
  useEffect(() => {
    const newWidth = SCREEN_SIZES[targetScreenSize].width;
    setContainerWidth(newWidth);
    setActualContainerWidth(newWidth);
  }, [targetScreenSize]);

  // Sync dashboardActualHeight when screen config changes (ResizeObserver may not fire on config change)
  useEffect(() => {
    setDashboardActualHeight((prevHeight) =>
      Math.max(prevHeight, currentScreenConfig.height, MIN_CANVAS_HEIGHT_PX)
    );
  }, [currentScreenConfig.height, targetScreenSize]);

  // Observe WHITE dashboard container for responsive width (not gray outer container)
  useEffect(() => {
    if (!dashboardContainerRef.current) return undefined;

    const handleResize = (entries: ResizeObserverEntry[]): void => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        // Use full available WHITE container width - let charts fill all available space
        setActualContainerWidth(width);

        // Track actual container height for snap indicators
        // Use scrollHeight to get the full content height including overflow
        const actualHeight = (entry.target as HTMLElement).scrollHeight;
        setDashboardActualHeight(
          Math.max(actualHeight, currentScreenConfig.height, MIN_CANVAS_HEIGHT_PX)
        );
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(dashboardContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dashboardContainerRef is a ref; unchanged dependency list
  }, [containerWidth, currentScreenConfig.height]);

  return { currentScreenConfig, actualContainerWidth };
}
