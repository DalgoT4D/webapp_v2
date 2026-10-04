import {
  GRID_BREAKPOINTS,
  GRID_COLS,
  GRID_COLUMN_COUNT,
  GRID_CONTAINER_PADDING,
  GRID_GAP_PX,
  GRID_MARGIN,
  GRID_PADDING_PX,
  GRID_ROW_HEIGHT,
  SCREEN_SIZES,
} from '@/components/dashboard/grid/grid-constants';
import { GRID_CONFIG } from '@/lib/chart-size-constraints';
import { PRINT_ROW_HEIGHT_PX } from '@/components/reports/logic/print-rows';

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

describe('one column count and row height across grid, size estimates and print', () => {
  it('12 columns everywhere', () => {
    expect(GRID_COLUMN_COUNT).toBe(12);
    expect(GRID_CONFIG.cols).toBe(GRID_COLUMN_COUNT);
  });

  it('size estimates keep their own [10, 10] margin; row height is the grid row height', () => {
    expect(GRID_CONFIG).toEqual({ cols: 12, rowHeight: 20, margin: [10, 10] });
    expect(GRID_CONFIG.rowHeight).toBe(GRID_ROW_HEIGHT);
    expect(PRINT_ROW_HEIGHT_PX).toBe(GRID_ROW_HEIGHT);
  });
});
