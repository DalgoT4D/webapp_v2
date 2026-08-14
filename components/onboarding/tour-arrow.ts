import type { PopoverDOM } from 'driver.js';

/**
 * driver.js builds its triangle out of a 5px border on a zero-size element, so the arrow
 * measures 10x10 whichever side it ends up on.
 */
const ARROW_SIZE_PX = 10;
/**
 * Keeps a fallback arrow clear of the card's rounded corners (`--radius-lg`), where a triangle
 * would poke out of the curve instead of a flat edge.
 */
const ARROW_CORNER_MARGIN_PX = 14;
/** Rects this close count as touching — sub-pixel layout shouldn't decide the side. */
const SIDE_TOLERANCE_PX = 1;

/** Matches the classes driver.js adds once it HAS resolved a real side for the arrow. */
const RESOLVED_SIDE_CLASS = /driver-popover-arrow-side-(left|right|top|bottom)\b/;

export type ArrowSide = 'left' | 'right' | 'top' | 'bottom';

type Rect = Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left' | 'width' | 'height'>;

/**
 * Which side of the target the popover is sitting on — i.e. which edge its arrow belongs on.
 * Named from driver.js's own perspective: `left` means the CARD is left of the target, so the
 * triangle sticks out of the card's right edge (`.driver-popover-arrow-side-left { left: 100% }`).
 *
 * Returns null when the two rects overlap, where no edge points honestly at anything.
 */
export function resolveArrowSide(popover: Rect, target: Rect): ArrowSide | null {
  const horizontal: ArrowSide | null =
    popover.right <= target.left + SIDE_TOLERANCE_PX
      ? 'left'
      : popover.left >= target.right - SIDE_TOLERANCE_PX
        ? 'right'
        : null;
  const vertical: ArrowSide | null =
    popover.bottom <= target.top + SIDE_TOLERANCE_PX
      ? 'top'
      : popover.top >= target.bottom - SIDE_TOLERANCE_PX
        ? 'bottom'
        : null;

  if (!horizontal) return vertical;
  if (!vertical) return horizontal;

  // Both axes are available, so the card sits diagonally off the target. Prefer the axis whose
  // PERPENDICULAR ranges overlap — that's the one where the triangle lines up with the target
  // instead of pointing off into the corner.
  const overlapsVertically = popover.bottom > target.top && popover.top < target.bottom;
  const overlapsHorizontally = popover.right > target.left && popover.left < target.right;
  if (overlapsVertically !== overlapsHorizontally)
    return overlapsVertically ? horizontal : vertical;

  // Neither axis lines up (a true corner placement): point across the SHORTER gap, so the
  // triangle sits on the edge nearest the target rather than the one furthest from it.
  const horizontalGap =
    horizontal === 'left' ? target.left - popover.right : popover.left - target.right;
  const verticalGap =
    vertical === 'top' ? target.top - popover.bottom : popover.top - target.bottom;
  return horizontalGap <= verticalGap ? horizontal : vertical;
}

/** Centre the arrow on the target, without letting it ride up onto a rounded corner. */
export function arrowOffsetAlongEdge(
  targetCentre: number,
  popoverStart: number,
  popoverLength: number
): number {
  const preferred = targetCentre - popoverStart - ARROW_SIZE_PX / 2;
  const maximum = Math.max(
    ARROW_CORNER_MARGIN_PX,
    popoverLength - ARROW_SIZE_PX - ARROW_CORNER_MARGIN_PX
  );
  return Math.min(Math.max(preferred, ARROW_CORNER_MARGIN_PX), maximum);
}

/**
 * Guarantees the coachmark has a pointer triangle.
 *
 * driver.js drops the arrow entirely (`driver-popover-arrow-none`, which its own stylesheet
 * hides) whenever NO side has room for the card — it then pins the card to the bottom of the
 * screen. That's a real state on a short or zoomed viewport, and it's how coachmarks ended up
 * as floating cards pointing at nothing, even though the card usually still sits cleanly above
 * or below its target and could point at it perfectly well.
 *
 * When driver.js has resolved a side, its own arrow is already right and this leaves it alone.
 * Otherwise it re-uses driver's arrow ELEMENT with the matching side class, so the themed fill
 * and the 1px outline underlay in tour.css apply to the fallback exactly as they do normally —
 * the two cases are visually indistinguishable.
 *
 * Cheap enough for the per-frame tracking loops both coachmarks already run: two rect reads and
 * an early return in the common case.
 */
export function ensurePopoverArrow(
  popover: Pick<PopoverDOM, 'wrapper' | 'arrow'> | null,
  target: Element | null
): void {
  if (!popover || !target || !document.body.contains(popover.wrapper)) return;
  const { arrow } = popover;
  if (RESOLVED_SIDE_CLASS.test(arrow.className)) return;

  const popoverRect = popover.wrapper.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const side = resolveArrowSide(popoverRect, targetRect);
  if (!side) return;

  arrow.className = `driver-popover-arrow driver-popover-arrow-side-${side}`;
  // driver.js's stylesheet pins the arrow to the correct EDGE (`left: 100%`, `bottom: 100%`,
  // …); only the offset along that edge is ours to set. Clear all four first — driver.js
  // leaves stale inline offsets behind from whichever side it tried previously.
  arrow.style.top = '';
  arrow.style.right = '';
  arrow.style.bottom = '';
  arrow.style.left = '';
  if (side === 'left' || side === 'right') {
    arrow.style.top = `${arrowOffsetAlongEdge(
      targetRect.top + targetRect.height / 2,
      popoverRect.top,
      popoverRect.height
    )}px`;
  } else {
    arrow.style.left = `${arrowOffsetAlongEdge(
      targetRect.left + targetRect.width / 2,
      popoverRect.left,
      popoverRect.width
    )}px`;
  }
}
