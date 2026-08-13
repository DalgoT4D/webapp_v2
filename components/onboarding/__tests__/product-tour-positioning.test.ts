import {
  clampPopoverLeftToViewport,
  clampPopoverTopToViewport,
  hasVisibleArea,
  sidebarTargetScrollDelta,
} from '../product-tour-positioning';

describe('clampPopoverTopToViewport', () => {
  const margin = 12;

  it('moves a bottom-anchored tour card up at the audited small-laptop height', () => {
    const viewportHeight = 684;
    const popoverHeight = 190;

    const top = clampPopoverTopToViewport(600, popoverHeight, 0, viewportHeight, margin);

    expect(top).toBe(482);
    expect(top + popoverHeight).toBeLessThanOrEqual(viewportHeight - margin);
  });

  it('keeps a tour card at its preferred position when it already fits', () => {
    expect(clampPopoverTopToViewport(240, 190, 0, 684, margin)).toBe(240);
  });

  it('keeps the top edge inside the viewport', () => {
    expect(clampPopoverTopToViewport(-40, 190, 0, 684, margin)).toBe(margin);
  });

  it('respects a visual viewport offset introduced by zooming', () => {
    const top = clampPopoverTopToViewport(700, 190, 80, 684, margin);

    expect(top).toBe(562);
    expect(top + 190).toBeLessThanOrEqual(80 + 684 - margin);
  });
});

describe('clampPopoverLeftToViewport', () => {
  const margin = 12;

  it('keeps the right edge inside a narrow viewport', () => {
    const left = clampPopoverLeftToViewport(900, 320, 0, 1087, margin);

    expect(left).toBe(755);
    expect(left + 320).toBeLessThanOrEqual(1087 - margin);
  });

  it('respects a visual viewport horizontal offset', () => {
    expect(clampPopoverLeftToViewport(20, 320, 60, 1087, margin)).toBe(72);
  });
});

describe('hasVisibleArea', () => {
  it('rejects hidden sidebar rectangles', () => {
    expect(hasVisibleArea({ width: 0, height: 40 })).toBe(false);
    expect(hasVisibleArea({ width: 240, height: 0 })).toBe(false);
  });

  it('accepts a rendered sidebar target', () => {
    expect(hasVisibleArea({ width: 240, height: 40 })).toBe(true);
  });
});

describe('sidebarTargetScrollDelta', () => {
  const margin = 6;

  it('scrolls down just enough when the tour target is below the sidebar viewport', () => {
    expect(sidebarTargetScrollDelta(620, 660, 100, 640, margin)).toBe(26);
  });

  it('scrolls up just enough when the tour target is above the sidebar viewport', () => {
    expect(sidebarTargetScrollDelta(90, 130, 100, 640, margin)).toBe(-16);
  });

  it('does not scroll when the target and its outline already fit', () => {
    expect(sidebarTargetScrollDelta(120, 160, 100, 640, margin)).toBe(0);
  });
});
