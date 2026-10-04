/**
 * Dashboard grid model shared by the builder and the view.
 * Superset-style: always 12 columns; columns scale with the container width.
 */

/** Height of one grid row in px. */
export const GRID_ROW_HEIGHT = 20;

/** Gap between widgets, in px (used for pixel math such as cross-tab drag previews). */
export const GRID_GAP_PX = 8;

/** Padding around the grid, in px. */
export const GRID_PADDING_PX = 8;

/** The same values in react-grid-layout's [x, y] form. */
export const GRID_MARGIN: [number, number] = [GRID_GAP_PX, GRID_GAP_PX];
export const GRID_CONTAINER_PADDING: [number, number] = [GRID_PADDING_PX, GRID_PADDING_PX];

/** react-grid-layout breakpoints (container width in px). */
export const GRID_BREAKPOINTS = {
  lg: 1200,
  md: 996,
  sm: 768,
  xs: 480,
  xxs: 0,
};

/** Fixed 12 columns at all breakpoints. */
export const GRID_COLS = {
  lg: 12,
  md: 12,
  sm: 12,
  xs: 12,
  xxs: 12,
};

/** Target screen sizes the builder can preview. All use 12 columns. */
export const SCREEN_SIZES = {
  desktop: { name: 'Desktop', width: 1200, height: 800, cols: 12, breakpoint: 'lg' },
  tablet: { name: 'Tablet', width: 768, height: 1024, cols: 12, breakpoint: 'sm' },
  mobile: { name: 'Mobile', width: 375, height: 667, cols: 12, breakpoint: 'xxs' },
};

export type ScreenSizeKey = keyof typeof SCREEN_SIZES;
