import type { DashboardLayoutItem } from '@/types/dashboard';
import {
  GRID_COLS,
  GRID_COLUMN_COUNT,
  type ScreenSizeKey,
} from '@/components/dashboard/grid/grid-constants';

/** Viewport widths (px) at which the view counts as desktop / tablet. */
const DESKTOP_MIN_WIDTH_PX = 1200;
const TABLET_MIN_WIDTH_PX = 768;
/** Large mobile treated as tablet. */
const LARGE_MOBILE_MIN_WIDTH_PX = 480;

// Get current viewport screen size category
export function getCurrentScreenSize(): ScreenSizeKey {
  if (typeof window === 'undefined') return 'desktop';

  const width = window.innerWidth;
  if (width >= DESKTOP_MIN_WIDTH_PX) return 'desktop';
  if (width >= TABLET_MIN_WIDTH_PX) return 'tablet';
  if (width >= LARGE_MOBILE_MIN_WIDTH_PX) return 'tablet'; // Large mobile treated as tablet
  return 'mobile';
}

// Helper function to generate responsive layouts with preview screen size focus
// With fixed 12 columns (Superset-style), all breakpoints use the same layout
export function generateResponsiveLayoutsForPreview(
  layout: DashboardLayoutItem[],
  _previewScreenSize: ScreenSizeKey
): Record<string, DashboardLayoutItem[]> {
  const layouts: Record<string, DashboardLayoutItem[]> = {};

  // Since all breakpoints use 12 columns (Superset-style),
  // the same layout works for all screen sizes - columns just scale in width
  Object.keys(GRID_COLS).forEach((breakpoint) => {
    // Use the same layout for all breakpoints - the grid columns scale with container width
    layouts[breakpoint] = layout.map((item) => ({
      ...item,
      // Ensure valid constraints
      w: Math.max(1, Math.min(item.w, GRID_COLUMN_COUNT)),
      x: Math.max(0, Math.min(item.x, GRID_COLUMN_COUNT - Math.max(1, item.w))),
      y: Math.max(0, item.y),
      minW: Math.max(1, Math.min(item.minW || 1, GRID_COLUMN_COUNT)),
      minH: item.minH || 1,
      maxW: GRID_COLUMN_COUNT,
    }));
  });

  return layouts;
}
