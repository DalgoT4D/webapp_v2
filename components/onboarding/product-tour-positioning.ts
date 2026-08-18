/**
 * Keep a manually-positioned tour popover fully inside the visible viewport.
 *
 * ProductTour anchors each card beside its sidebar item instead of letting driver.js choose
 * the position. Sidebar items near the bottom of a short laptop viewport can therefore put
 * the card's action below the screen unless we clamp both its top and bottom edges.
 */
export function clampPopoverTopToViewport(
  preferredTop: number,
  popoverHeight: number,
  viewportTop: number,
  viewportHeight: number,
  margin: number
): number {
  const minimumTop = viewportTop + margin;
  const maximumTop = Math.max(minimumTop, viewportTop + viewportHeight - popoverHeight - margin);
  return Math.min(Math.max(preferredTop, minimumTop), maximumTop);
}

/** Keep a manually positioned card inside the visual viewport horizontally. */
export function clampPopoverLeftToViewport(
  preferredLeft: number,
  popoverWidth: number,
  viewportLeft: number,
  viewportWidth: number,
  margin: number
): number {
  const minimumLeft = viewportLeft + margin;
  const maximumLeft = Math.max(minimumLeft, viewportLeft + viewportWidth - popoverWidth - margin);
  return Math.min(Math.max(preferredLeft, minimumLeft), maximumLeft);
}

/** A display:none element and its descendants report a zero-sized client rect. */
export function hasVisibleArea(rect: Pick<DOMRect, 'width' | 'height'>): boolean {
  return rect.width > 0 && rect.height > 0;
}

/**
 * Return the smallest scrollTop adjustment needed to reveal a sidebar target, including the
 * space used by its tour outline. A positive value scrolls down; a negative value scrolls up.
 */
export function sidebarTargetScrollDelta(
  targetTop: number,
  targetBottom: number,
  scrollerTop: number,
  scrollerBottom: number,
  margin: number
): number {
  const visibleTop = scrollerTop + margin;
  const visibleBottom = scrollerBottom - margin;
  if (targetTop < visibleTop) return targetTop - visibleTop;
  if (targetBottom > visibleBottom) return targetBottom - visibleBottom;
  return 0;
}
