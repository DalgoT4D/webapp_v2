import {
  GRID_BREAKPOINTS,
  GRID_COLS,
  GRID_CONTAINER_PADDING,
  GRID_GAP_PX,
  GRID_MARGIN,
  GRID_PADDING_PX,
  GRID_ROW_HEIGHT,
  SCREEN_SIZES,
} from '@/components/dashboard/grid/grid-constants';

describe('dashboard grid constants', () => {
  it('keeps the 12-column Superset-style grid at every breakpoint', () => {
    expect(GRID_BREAKPOINTS).toEqual({ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 });
    expect(GRID_COLS).toEqual({ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 });
  });

  it('keeps row height, gaps and padding', () => {
    expect(GRID_ROW_HEIGHT).toBe(20);
    expect(GRID_GAP_PX).toBe(8);
    expect(GRID_PADDING_PX).toBe(8);
    expect(GRID_MARGIN).toEqual([8, 8]);
    expect(GRID_CONTAINER_PADDING).toEqual([8, 8]);
  });

  it('keeps the target screen sizes', () => {
    expect(SCREEN_SIZES).toEqual({
      desktop: { name: 'Desktop', width: 1200, height: 800, cols: 12, breakpoint: 'lg' },
      tablet: { name: 'Tablet', width: 768, height: 1024, cols: 12, breakpoint: 'sm' },
      mobile: { name: 'Mobile', width: 375, height: 667, cols: 12, breakpoint: 'xxs' },
    });
  });
});
