import type { PopoverDOM } from 'driver.js';

export type TourPopoverHeaderKind = 'product-tour' | 'coachmark';

export const TOUR_ARROW_OUTLINE_CLASS = 'dalgo-tour-arrow-outlined';

/**
 * Marks driver.js's triangle for the matching card-border treatment in tour.css.
 *
 * The library paints the triangle with a single solid CSS border, so the card's own border
 * stops at the point where the arrow begins. The class gives CSS a stable hook for a second,
 * slightly larger triangle behind it, completing the outline without changing positioning.
 */
export function outlinePopoverArrow(popover: Pick<PopoverDOM, 'wrapper'>): void {
  // driver.js rewrites the arrow element's className after onPopoverRender when it resolves
  // the final side. The wrapper is stable across that positioning pass, so keep the hook here.
  popover.wrapper.classList.add(TOUR_ARROW_OUTLINE_CLASS);
}

/**
 * Puts driver.js's title and close button in one real layout row.
 *
 * driver.js absolutely positions the close button against the whole card. That happens to
 * look close enough on a plain popover, but it drifts above the progress row in the product
 * tour and stays over the illustration on image coachmarks. A shared row keeps the control
 * aligned with the content it dismisses, regardless of the content above the heading.
 */
export function alignPopoverCloseWithHeader(
  popover: Pick<PopoverDOM, 'title' | 'closeButton'>,
  kind: TourPopoverHeaderKind
): HTMLDivElement {
  const existingRow = popover.title.parentElement;
  if (existingRow?.classList.contains('dalgo-tour-heading-row')) {
    existingRow.classList.add(`dalgo-tour-heading-row--${kind}`);
    existingRow.append(popover.closeButton);
    return existingRow as HTMLDivElement;
  }

  const row = document.createElement('div');
  row.classList.add('dalgo-tour-heading-row', `dalgo-tour-heading-row--${kind}`);
  popover.title.before(row);
  row.append(popover.title, popover.closeButton);
  return row;
}
