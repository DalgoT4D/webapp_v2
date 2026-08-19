import { arrowOffsetAlongEdge, resolveArrowSide } from '../tour-arrow';

function rect(left: number, top: number, width: number, height: number) {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

describe('resolveArrowSide', () => {
  const target = rect(200, 60, 180, 46);

  it('points right-ward when the card sits to the left of the target', () => {
    expect(resolveArrowSide(rect(-120, 40, 320, 115), target)).toBe('left');
  });

  it('points left-ward when the card sits to the right of the target', () => {
    expect(resolveArrowSide(rect(380, 40, 320, 115), target)).toBe('right');
  });

  it('points down when the card sits above the target', () => {
    expect(resolveArrowSide(rect(180, -80, 320, 115), target)).toBe('top');
  });

  it('points up when the card is pinned below the target — the arrow-none case', () => {
    // The reproduced 420x240 viewport: driver.js pins the card to the bottom of the screen
    // and drops its own arrow, even though the card sits cleanly under the target.
    expect(resolveArrowSide(rect(85, 114, 320, 115), target)).toBe('bottom');
  });

  it('prefers the axis whose perpendicular ranges overlap when the card sits diagonally', () => {
    // Card is both left of AND above the target, but overlaps it vertically — a horizontal
    // arrow lines up with the target, a vertical one would point into empty corner.
    expect(resolveArrowSide(rect(-140, 50, 320, 115), target)).toBe('left');
  });

  it('points across the shorter gap when the card sits in a true corner', () => {
    // Neither axis overlaps. Far to the left (280px gap) but only just above (25px gap) —
    // the arrow belongs on the near edge, pointing down.
    expect(resolveArrowSide(rect(-400, -80, 320, 115), target)).toBe('top');
    // Mirror: only just to the left (20px gap), but far above (185px gap).
    expect(resolveArrowSide(rect(-140, -240, 320, 115), target)).toBe('left');
  });

  it('gives up when the card overlaps the target', () => {
    expect(resolveArrowSide(rect(220, 70, 320, 115), target)).toBeNull();
  });
});

describe('arrowOffsetAlongEdge', () => {
  it('centres the arrow on the target', () => {
    // Target centre 300, card spanning 200..520 → 300 - 200 - 5.
    expect(arrowOffsetAlongEdge(300, 200, 320)).toBe(95);
  });

  it('keeps the arrow off the leading rounded corner', () => {
    expect(arrowOffsetAlongEdge(205, 200, 320)).toBe(14);
  });

  it('keeps the arrow off the trailing rounded corner', () => {
    expect(arrowOffsetAlongEdge(515, 200, 320)).toBe(320 - 10 - 14);
  });

  it('does not fall off a card shorter than the corner margins', () => {
    expect(arrowOffsetAlongEdge(300, 290, 20)).toBe(14);
  });
});
