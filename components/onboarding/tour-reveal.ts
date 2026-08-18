import { sidebarTargetScrollDelta } from './product-tour-positioning';

/**
 * Breathing room kept around a coachmark target when it has to be scrolled into view. Slightly
 * larger than `.dalgo-tour-ring`'s 2px outline + 4px offset, so a ringed target is revealed
 * with its whole ring rather than flush against the scroller's edge.
 */
export const REVEAL_MARGIN_PX = 8;

/** A container only counts as scrollable if it both allows overflow AND has some to scroll. */
function isScrollable(el: HTMLElement, axis: 'x' | 'y'): boolean {
  const style = getComputedStyle(el);
  const overflow = axis === 'y' ? style.overflowY : style.overflowX;
  if (!/(auto|scroll|overlay)/.test(overflow)) return false;
  return axis === 'y' ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1;
}

/**
 * Scrolls whatever is hiding `el` — its scrollable ancestors first, then the page — just far
 * enough to bring it fully into view.
 *
 * Needed because driver.js only scrolls when the target is outside the WINDOW: a nav item
 * clipped by the sidebar's own `overflow-y: auto` scroller (`#main-layout-sidebar-nav`) is
 * still inside the window rect, so the library leaves it hidden and the coachmark points at
 * nothing. Browser zoom is the common trigger — at 150% the sidebar's lower items (Alerts,
 * Settings) fall below the fold on a laptop, and the same happens to fields near the bottom of
 * a scrolling dialog.
 *
 * Uses the smallest delta that reveals the target (the `block: 'nearest'` behaviour), never a
 * centring jump: the coachmark is showing the user something on a page they're already reading,
 * so the page should move as little as possible. `scroll-behavior` is forced to `auto` app-wide
 * (globals.css), so this is instant rather than an animated slide.
 */
export function revealElementInScrollParents(
  el: HTMLElement,
  margin: number = REVEAL_MARGIN_PX
): void {
  // Innermost scroller outwards: scrolling an outer container first can move the target back
  // out of an inner one, so the deltas have to be measured (and applied) inside-out.
  let parent = el.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    if (isScrollable(parent, 'y')) {
      const parentRect = parent.getBoundingClientRect();
      const targetRect = el.getBoundingClientRect();
      parent.scrollTop += sidebarTargetScrollDelta(
        targetRect.top,
        targetRect.bottom,
        parentRect.top,
        parentRect.bottom,
        margin
      );
    }
    if (isScrollable(parent, 'x')) {
      const parentRect = parent.getBoundingClientRect();
      const targetRect = el.getBoundingClientRect();
      parent.scrollLeft += sidebarTargetScrollDelta(
        targetRect.left,
        targetRect.right,
        parentRect.left,
        parentRect.right,
        margin
      );
    }
    parent = parent.parentElement;
  }

  // Then the page itself, against the VISUAL viewport — under browser zoom that's the box the
  // user can actually see, and it's the same box ProductTour clamps its popover to.
  const rect = el.getBoundingClientRect();
  const viewportTop = window.visualViewport?.offsetTop ?? 0;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const pageDelta = sidebarTargetScrollDelta(
    rect.top,
    rect.bottom,
    viewportTop,
    viewportTop + viewportHeight,
    margin
  );
  if (pageDelta !== 0) window.scrollBy(0, pageDelta);
}
