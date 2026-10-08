import {
  generateResponsiveLayoutsForPreview,
  getCurrentScreenSize,
} from '@/components/dashboard/view/view-layout';

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

describe('getCurrentScreenSize', () => {
  it('desktop from 1200px, tablet from 480px (large phones count as tablet), else mobile', () => {
    for (const [width, size] of [
      [1600, 'desktop'],
      [1200, 'desktop'],
      [1199, 'tablet'],
      [768, 'tablet'],
      [767, 'tablet'],
      [480, 'tablet'],
      [479, 'mobile'],
    ] as const) {
      setWidth(width);
      expect(getCurrentScreenSize()).toBe(size);
    }
  });
});

describe('generateResponsiveLayoutsForPreview', () => {
  it('the same clamped layout for every breakpoint', () => {
    const layouts = generateResponsiveLayoutsForPreview(
      [{ i: 'a', x: 11, y: -2, w: 20, h: 3, minW: 0 }],
      'desktop'
    );
    expect(Object.keys(layouts)).toEqual(['lg', 'md', 'sm', 'xs', 'xxs']);
    expect(layouts.lg).toEqual([{ i: 'a', x: 0, y: 0, w: 12, h: 3, minW: 1, minH: 1, maxW: 12 }]);
    expect(layouts.xxs).toEqual(layouts.lg);
  });

  it('keeps a valid item, clamping x so it fits', () => {
    const [item] = generateResponsiveLayoutsForPreview(
      [{ i: 'b', x: 10, y: 4, w: 4, h: 2, minW: 3, minH: 2 }],
      'tablet'
    ).md;
    expect(item).toEqual({ i: 'b', x: 8, y: 4, w: 4, h: 2, minW: 3, minH: 2, maxW: 12 });
  });
});
