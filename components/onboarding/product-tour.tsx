'use client';

/**
 * Guided product tour engine (driver.js). Mirrors the "tour flow" Figma frames
 * (section 2303:4689) — three DIFFERENT elements per step, not one:
 *  - the SPOTLIGHT (dim-overlay cutout) covers the top of the page's list/content, so the
 *    step's rows are the one lit part of the page. A synthetic "virtual" element sized to that
 *    band is what driver.js is handed as the step's highlight target. The rows are picked out
 *    by the cutout alone — no border is drawn around them.
 *  - the RING (`.dalgo-tour-ring`) goes on the sidebar nav item for that route. The app chrome
 *    — top navbar AND the whole sidebar — is lifted out of the dim
 *    (`.dalgo-tour-chrome-lifted`), so only the list page dims: the nav stays fully legible for
 *    the run and the ring marks which entry this step is about.
 *  - the POPOVER sits next to that same nav item — its position is overridden onto the
 *    sidebar link via `onPopoverRender`, since driver.js would otherwise place it against
 *    the band.
 *
 * Exposes `startTour()` via ref so the intent modal / getting-started widget (siblings,
 * not descendants) can trigger it without a context provider — the tour itself renders
 * through driver.js's own DOM, not React. The post-tour modal (shown on a real "Finish Tour"
 * completion) IS real React output though, and is owned directly here rather than lifted to
 * a parent via a callback — this is the same component that knows definitively whether the
 * user completed the last step, so there's no cross-component state to fall out of sync.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { driver, type Driver, type PopoverDOM } from 'driver.js';
import 'driver.js/dist/driver.css';
import './tour.css';
import { trackEvent } from '@/lib/analytics';
import {
  startOnboardingPath,
  resumeOnboardingPath,
  trackOnboardingPathStage,
  completeOnboardingPath,
  exitOnboardingPath,
} from '@/lib/onboarding-analytics';
import { ANALYTICS_EVENTS, ONBOARDING_PATHS } from '@/constants/analytics';
import {
  TOUR_STEPS,
  TOUR_CONTENT_SELECTOR,
  markTourSeen,
  saveTourProgress,
  clearTourProgress,
  type TourStep,
} from './tour-constants';
import {
  clampPopoverLeftToViewport,
  clampPopoverTopToViewport,
  hasVisibleArea,
  sidebarTargetScrollDelta,
} from './product-tour-positioning';
import { alignPopoverCloseWithHeader, outlinePopoverArrow } from './tour-popover-chrome';
import { ensurePopoverArrow } from './tour-arrow';
import { saveTrialWalkthroughFlow } from '@/hooks/api/useTrialWalkthrough';
import { useSidebarStore } from '@/stores/sidebarStore';

export interface ProductTourHandle {
  /** @param startIndex - step to begin at; non-zero when resuming an interrupted run. */
  startTour: (startIndex?: number) => void;
}

interface ProductTourProps {
  orgSlug: string;
  /** Fires once the tour ends, however it ended (completed, skipped, or closed). */
  onTourEnd?: (reason: 'completed' | 'skipped') => void;
  /**
   * Fires when the tour is completed via its last step's "Finish Tour" button (not on Skip)
   * and the follow-up choice is still worth offering. The dialog itself lives in tour-gate.tsx
   * — all its entry points share one instance so it can swap screens in place.
   */
  onOfferPostTourChoice: () => void;
  /**
   * False once BOTH post-tour flows (insights, automate-pipeline) are already completed —
   * the modal would have nothing left to offer, so it's suppressed. The tour itself stays
   * freely re-runnable; only this follow-up prompt stops appearing.
   */
  canOfferPostTourChoice?: boolean;
}

/** Resolve when `selector` is in the DOM, or after `timeout` ms (returns the el or null). */
function waitForElement(selector: string, timeout = 6000): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);
    const start = Date.now();
    const tick = () => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      if (Date.now() - start > timeout) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/**
 * Resolve once the browser's real URL reports `route`, or after `timeout` ms.
 *
 * The sidebar link and content wrapper we target are ALWAYS in the DOM (present regardless
 * of route), so `waitForElement` alone resolves instantly regardless of whether the actual
 * page navigation has caught up — the popover would then show the next step while the
 * previous page's content is still on screen ("page loads late, tour goes first"). Waiting
 * for the pathname itself to settle closes that gap.
 *
 * Reads `window.location.pathname` directly rather than the `usePathname()`-derived React
 * state this component otherwise tracks — that state was observed (via logging) to stop
 * updating after the first navigation in some sessions, silently timing out on every
 * subsequent step and stalling the popover for the full `timeout`. The DOM/URL is ground
 * truth and isn't subject to whatever was stalling the hook.
 */
function waitForPathname(route: string, timeout = 4000): Promise<void> {
  return new Promise((resolve) => {
    if (window.location.pathname === route) return resolve();
    const start = Date.now();
    const tick = () => {
      if (window.location.pathname === route || Date.now() - start > timeout) return resolve();
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/**
 * Cheap "are this page's rows on screen yet" check, mirroring the shapes getFirstRowsRect
 * measures. Deliberately does no measuring or scrolling of its own — it runs once per frame
 * inside waitForRealRows, where a scrollIntoView side-effect would fight the user.
 */
function hasSpotlightRows(contentEl: Element, rowSelector?: string): boolean {
  if (rowSelector && contentEl.querySelector(rowSelector)) return true;
  if (contentEl.querySelector('tbody tr')) return true;
  return Array.from(contentEl.querySelectorAll<HTMLElement>('[class*="grid"]')).some(
    (el) => el.children.length > 1 && getComputedStyle(el).display === 'grid'
  );
}

/**
 * Resolve once `contentEl` actually has real rows to measure (or after `timeout` ms).
 *
 * `spotlightRowOnly` steps measure the page's first N rows the instant we navigate to them —
 * but the page's own data fetch (SWR) is often still in flight at that moment. Two distinct
 * ways that bites, both handled here:
 *
 *  - Skeleton rows are already in the DOM: they're shorter than real rows, so the spotlight
 *    comes out undersized. Waiting for `[data-slot="skeleton"]` to clear covers this.
 *  - NO rows are in the DOM at all yet, because the page renders a spinner (or any other
 *    non-Skeleton loader) while loading — e.g. Ingest, whose LOADING state is a bare
 *    `<Loader2>`. The skeleton check passes instantly there, getFirstRowsRect finds nothing,
 *    and the spotlight silently falls back to the fixed band measured from the content top,
 *    swallowing the page header. Waiting for the rows themselves covers this.
 *
 * Either way nothing re-triggers positioning once data lands (only a resize does), so the
 * wait has to happen up front.
 */
function waitForRealRows(contentEl: Element, rowSelector?: string, timeout = 3000): Promise<void> {
  return new Promise((resolve) => {
    const ready = () =>
      !contentEl.querySelector('[data-slot="skeleton"]') &&
      hasSpotlightRows(contentEl, rowSelector);
    if (ready()) return resolve();
    const start = Date.now();
    const tick = () => {
      if (ready() || Date.now() - start > timeout) return resolve();
      requestAnimationFrame(tick);
    };
    tick();
  });
}

// Fallback band height, used only when a step isn't spotlightFull and no first row could be
// measured (e.g. an empty-state page with no rows/cards yet).
const SPOTLIGHT_HEIGHT_PX = 340;
const SPOTLIGHT_ELEMENT_ID = 'dalgo-tour-content-spotlight';
// Gap between the sidebar nav item and the popover anchored beside it.
const POPOVER_SIDEBAR_GAP_PX = 16;
// Minimum gap kept between the popover's bottom edge and the spotlight box, so a spotlight
// that sits close to the sidebar item's vertical position (e.g. spotlightRowOnly steps) never
// gets covered by the popover.
const POPOVER_SPOTLIGHT_GAP_PX = 16;
// Never let the popover render fully off the top of the viewport when it gets pushed up to
// clear the spotlight.
const POPOVER_VIEWPORT_MARGIN_PX = 12;
// Caps how far the popover can be pushed above the sidebar link's own top to avoid the
// spotlight. Fully clearing a tall spotlight/popover pair (e.g. Dashboards' 4-row box) could
// need a shift bigger than the gap to the PREVIOUS sidebar item — past that, the arrow (which
// points at wherever the popover ends up, clamped to its own bounds) reads as pointing at that
// other item instead. A little overlap with the spotlight is preferred over that.
const POPOVER_MAX_PUSH_UP_PX = 72;
// Space around the ringed sidebar item when the nav must scroll to reveal a lower tour step.
const SIDEBAR_TARGET_MARGIN_PX = 6;
// Tooltip triangle dimensions, matching the Figma spec (17.5px point length, 14px tall).
const ARROW_WIDTH_PX = 17.5;
const ARROW_HEIGHT_PX = 14;
const ARROW_ELEMENT_ID = 'dalgo-tour-sidebar-arrow';
/**
 * Rounded brand outline drawn on the step's SIDEBAR NAV ITEM — the thing the popover points
 * at, and the only thing in this tour that's actually clickable (see `.dalgo-tour-ring` in
 * tour.css). The content band gets its own outline from CSS, keyed off the element id rather
 * than this class, precisely because it is a region and not a click target.
 */
const RING_CLASS = 'dalgo-tour-ring';
/**
 * Goes on the app-chrome ROOTS (not the ringed item) for the tour's duration, keeping the top
 * navbar and the whole side nav out of the dim — only the list page itself dims, so the chrome
 * stays fully legible and the user can see where each step is heading next. Applied by THIS
 * component only: the coachmark runs with no overlay, so it has nothing to lift above. See
 * `.dalgo-tour-chrome-lifted` in tour.css.
 */
const CHROME_LIFT_CLASS = 'dalgo-tour-chrome-lifted';
const CHROME_ROOT_IDS = ['main-layout-navbar', 'main-layout-sidebar'];

/** Lift/drop the navbar + sidebar out of (and back into) the dim overlay. Idempotent. */
function setChromeLifted(lifted: boolean) {
  for (const id of CHROME_ROOT_IDS) {
    document.getElementById(id)?.classList.toggle(CHROME_LIFT_CLASS, lifted);
  }
}

/**
 * Custom triangle pointing at the sidebar nav item, appended inside the popover wrapper.
 * Built and positioned entirely via inline styles rather than driver.js's own
 * `.driver-popover-arrow` element/CSS classes — that element's visibility and side depend on
 * driver.js's internal auto-positioning, which doesn't know about our manual repositioning of
 * the popover, and ended up hidden/misplaced as a result.
 */
function getOrCreateSidebarArrow(wrapper: HTMLElement): HTMLElement {
  let arrow = document.getElementById(ARROW_ELEMENT_ID);
  if (!arrow) {
    arrow = document.createElement('div');
    arrow.id = ARROW_ELEMENT_ID;
    arrow.style.position = 'absolute';
    arrow.style.left = `${-ARROW_WIDTH_PX}px`;
    arrow.style.width = '0';
    arrow.style.height = '0';
    arrow.style.borderTop = `${ARROW_HEIGHT_PX / 2}px solid transparent`;
    arrow.style.borderBottom = `${ARROW_HEIGHT_PX / 2}px solid transparent`;
    arrow.style.borderRight = `${ARROW_WIDTH_PX}px solid var(--card)`;
    arrow.style.pointerEvents = 'none';
  }
  if (arrow.parentElement !== wrapper) wrapper.appendChild(arrow);
  return arrow;
}

/**
 * Builds the popover's whole header block — progress dots + "N of total" counter, then the
 * step title below it. Rendered into driver.js's `title` slot (not `description`) since that's
 * the only slot above the content, and the Figma spec puts the progress row above the title.
 */
function popoverHeaderHtml(index: number, total: number, title: string): string {
  const dots = Array.from({ length: total })
    .map((_, i) => `<span class="${i <= index ? 'is-active' : ''}"></span>`)
    .join('');
  return (
    `<div class="dalgo-tour-progress-row">` +
    `<div class="dalgo-tour-progress">${dots}</div>` +
    `<span class="dalgo-tour-progress-count">${index + 1} of ${total}</span>` +
    `</div>` +
    `<div class="dalgo-tour-title-text">${title}</div>`
  );
}

/**
 * A synthetic, invisible-but-real element used purely so driver.js has something to call
 * getBoundingClientRect() on for the stage cutout — sized/positioned to the content area's
 * top band. `position: fixed` + appended to body (not nested in the content area) so it
 * isn't affected by `#main-layout-main-content`'s `overflow: hidden`.
 */
function getOrCreateSpotlightElement(): HTMLElement {
  let el = document.getElementById(SPOTLIGHT_ELEMENT_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = SPOTLIGHT_ELEMENT_ID;
    el.style.position = 'fixed';
    el.style.pointerEvents = 'none';
    el.style.background = 'transparent';
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Every list page wraps its real content (below the fixed title/filter header) in a
 * `.overflow-y-auto` scroll container (see rules/components.md's page layout pattern), itself
 * inset from the full-bleed `#main-layout-main-content` by the page's own side padding —
 * that padding div is what we want the spotlight's right edge to align with, since the
 * header's action button (e.g. "CREATE KPI") sits at that same padding, not the page's raw
 * edge. Reading the WRAPPER's own rect isn't quite right though: some pages nest an extra
 * bordered card between the padding div and `.overflow-y-auto` (e.g. KPI's
 * `p-6 > border-rounded-card p-5 > overflow-y-auto`), making the wrapper itself narrower than
 * the padding div by that card's own inner padding. Going up to its parent lands on the
 * padding div either way — directly, or via the full-width card — giving a consistent small
 * gap that matches the header instead of undershooting past the button or overshooting into
 * the gutter. Falls back to the full content rect if no such wrapper is found (or it's
 * hidden, e.g. an inactive tab panel).
 */
function getVisibleContentWidth(contentEl: Element, contentRect: DOMRect): number {
  const wrapper = Array.from(contentEl.querySelectorAll<HTMLElement>('.overflow-y-auto')).find(
    (el) => el.offsetWidth > 0 && el.offsetHeight > 0
  );
  const boundary = wrapper?.parentElement ?? wrapper;
  if (!boundary) return contentRect.width;
  const boundaryRect = boundary.getBoundingClientRect();
  return Math.max(0, boundaryRect.right - contentRect.left);
}

/**
 * Finds the page's first `rowCount` rows of content — their own bounds, not the whole content
 * area's. Used two ways: `spotlightRowOnly` steps spotlight exactly this rect; other steps
 * only take its `bottom` (band height ends there, but the band still starts/spans the full
 * content area, so header/filters stay included) — those always pass `rowCount: 1`, preserving
 * the original single-row band behavior. Handles the two row shapes across the tour's pages:
 * table rows (union of the first `rowCount` `<tbody> <tr>`s — header row is excluded since it's
 * outside `<tbody>`; rect is already full table width), and CSS-grid card rows (e.g. KPI's card
 * grid) — rect spans the grid's own width, but only the first `rowCount` distinct row-offsets'
 * worth of cards, since a grid can wrap to further rows.
 */
function unionRowsRect(rows: HTMLElement[]): DOMRect {
  const lastRow = rows[rows.length - 1];
  // The list's own scrollable ancestor may not yet have the last row fully in view (e.g.
  // rowCount=4 asks for more rows than fit before a scroll) — its rect would still measure
  // correctly, but the row's actual pixels would be clipped by that ancestor's overflow,
  // making the spotlight look "cut off" even though it's sized right. `scroll-behavior` is
  // forced to `auto` app-wide (globals.css), so this is instant, not an animated jump.
  lastRow.scrollIntoView({ block: 'nearest' });
  const first = rows[0].getBoundingClientRect();
  const last = lastRow.getBoundingClientRect();
  return new DOMRect(first.left, first.top, first.width, last.bottom - first.top);
}

function getFirstRowsRect(
  contentEl: Element,
  rowCount: number,
  rowSelector?: string
): DOMRect | null {
  // An explicit per-step selector wins over the shape heuristics below — needed for pages
  // whose rows are neither table rows nor grid cards (Ingest's flex list), and for pages
  // where the heuristics would match the WRONG rows (Ingest again: every source row embeds
  // its own connections <table>, so `tbody tr` would find those nested rows instead).
  if (rowSelector) {
    const rows = Array.from(contentEl.querySelectorAll<HTMLElement>(rowSelector)).slice(
      0,
      rowCount
    );
    if (rows.length > 0) return unionRowsRect(rows);
  }

  const tableRows = Array.from(contentEl.querySelectorAll<HTMLElement>('tbody tr')).slice(
    0,
    rowCount
  );
  if (tableRows.length > 0) return unionRowsRect(tableRows);

  const gridCandidates = contentEl.querySelectorAll<HTMLElement>('[class*="grid"]');
  const grid = Array.from(gridCandidates).find(
    (el) => el.children.length > 1 && getComputedStyle(el).display === 'grid'
  );
  if (!grid) return null;

  const cardRects = Array.from(grid.children)
    .map((child) => child.getBoundingClientRect())
    .filter((r) => r.height > 0);
  if (!cardRects.length) return null;
  const rowTops = Array.from(new Set(cardRects.map((r) => Math.round(r.top))))
    .sort((a, b) => a - b)
    .slice(0, rowCount);
  const includedRects = cardRects.filter((r) => rowTops.includes(Math.round(r.top)));
  const top = Math.min(...includedRects.map((r) => r.top));
  const bottom = Math.max(...includedRects.map((r) => r.bottom));
  const gridRect = grid.getBoundingClientRect();
  return new DOMRect(gridRect.left, top, gridRect.width, bottom - top);
}

function positionSpotlightElement(
  el: HTMLElement,
  contentEl: Element,
  spotlightFull: boolean,
  spotlightRowOnly: boolean,
  spotlightRowCount: number,
  rowSelector?: string
): void {
  const rect = contentEl.getBoundingClientRect();
  const rowRect = spotlightFull
    ? null
    : getFirstRowsRect(contentEl, spotlightRowOnly ? spotlightRowCount : 1, rowSelector);

  if (spotlightRowOnly && rowRect) {
    el.style.top = `${rowRect.top}px`;
    el.style.left = `${rowRect.left}px`;
    el.style.width = `${rowRect.width}px`;
    el.style.height = `${rowRect.height}px`;
    return;
  }

  const width = getVisibleContentWidth(contentEl, rect);
  const height = spotlightFull
    ? rect.height
    : Math.min(rowRect ? rowRect.bottom - rect.top : SPOTLIGHT_HEIGHT_PX, rect.height);

  el.style.top = `${rect.top}px`;
  el.style.left = `${rect.left}px`;
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
}

/**
 * Pins the popover beside the CURRENT step's sidebar nav item instead of wherever driver.js's
 * own side/align auto-positioning would put it (which targets the synthetic spotlight band,
 * not the sidebar). Needs re-applying any time driver.js repositions the popover on its own —
 * not just on the initial `onPopoverRender` — otherwise a later reposition (e.g. its own
 * window-resize handler, or our own `refresh()` call) snaps it back to the default slot.
 */
function anchorPopoverToSidebar(popover: PopoverDOM, step: TourStep): void {
  const sidebarRoot = document.getElementById('main-layout-sidebar');
  const sidebarEl = sidebarRoot?.querySelector(`a[href="${step.route}"]`);
  if (
    !sidebarRoot ||
    !sidebarEl ||
    !hasVisibleArea(sidebarRoot.getBoundingClientRect()) ||
    !hasVisibleArea(sidebarEl.getBoundingClientRect())
  ) {
    // Tablet layouts keep the desktop sidebar mounted but hidden. In that mode driver.js's
    // own collision-aware placement around the content spotlight is the truthful target;
    // remove the desktop-only arrow instead of pointing at an invisible navigation item.
    document.getElementById(ARROW_ELEMENT_ID)?.remove();
    popover.arrow.style.display = '';
    // driver.js hides its own arrow outright when the card fits on no side of the spotlight —
    // likelier here than anywhere, since the spotlight band is nearly as wide as the page.
    ensurePopoverArrow(popover, document.getElementById(SPOTLIGHT_ELEMENT_ID));
    return;
  }
  const sidebarScroller = document.getElementById('main-layout-sidebar-nav');
  if (sidebarScroller?.contains(sidebarEl)) {
    const scrollerRect = sidebarScroller.getBoundingClientRect();
    const targetRect = sidebarEl.getBoundingClientRect();
    sidebarScroller.scrollTop += sidebarTargetScrollDelta(
      targetRect.top,
      targetRect.bottom,
      scrollerRect.top,
      scrollerRect.bottom,
      SIDEBAR_TARGET_MARGIN_PX
    );
  }
  const sidebarRect = sidebarEl.getBoundingClientRect();
  const popoverRect = popover.wrapper.getBoundingClientRect();

  // Naively, the popover's top would match the sidebar link's top — but for a
  // spotlightRowOnly step (or any step where the row sits close to the sidebar item's own
  // height), that overlaps the spotlight box sitting just below it. Clamp so the popover's
  // bottom always stays above the spotlight, pushing the whole popover up instead.
  const spotlightRect = document.getElementById(SPOTLIGHT_ELEMENT_ID)?.getBoundingClientRect();
  let top = sidebarRect.top;
  if (spotlightRect) {
    const clearedTop = spotlightRect.top - POPOVER_SPOTLIGHT_GAP_PX - popoverRect.height;
    top = Math.min(top, Math.max(clearedTop, sidebarRect.top - POPOVER_MAX_PUSH_UP_PX));
  }
  // Sidebar items near the bottom of a short laptop viewport (Metrics is the common case)
  // can otherwise put the footer and Next button below the screen. Preserve the preferred
  // sidebar-aligned position when it fits, but move the whole card up far enough to keep both
  // edges inside the visual viewport. The custom arrow is clamped separately below, so it
  // continues to point toward the sidebar item even after this larger safety shift.
  const viewportTop = window.visualViewport?.offsetTop ?? 0;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  top = clampPopoverTopToViewport(
    top,
    popoverRect.height,
    viewportTop,
    viewportHeight,
    POPOVER_VIEWPORT_MARGIN_PX
  );

  const viewportLeft = window.visualViewport?.offsetLeft ?? 0;
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const left = clampPopoverLeftToViewport(
    sidebarRect.right + POPOVER_SIDEBAR_GAP_PX,
    popoverRect.width,
    viewportLeft,
    viewportWidth,
    POPOVER_VIEWPORT_MARGIN_PX
  );

  popover.wrapper.style.top = `${top}px`;
  popover.wrapper.style.left = `${left}px`;
  popover.wrapper.style.right = 'auto';
  popover.wrapper.style.bottom = 'auto';

  // driver.js's own arrow relies on it resolving a side/position that matches where WE end up
  // putting the popover — it doesn't, since we override position after the fact, so hide it
  // and draw our own via a plain inline-styled div instead. Fully self-contained (no shared
  // CSS classes with driver.js, no dependency on which side it internally resolved to), so
  // there's nothing else that can silently hide or reposition it.
  popover.arrow.style.display = 'none';
  const arrow = getOrCreateSidebarArrow(popover.wrapper);
  const arrowCenter = sidebarRect.top + sidebarRect.height / 2 - top - ARROW_HEIGHT_PX / 2;
  const maxArrowTop = popoverRect.height - ARROW_HEIGHT_PX - POPOVER_VIEWPORT_MARGIN_PX;
  arrow.style.top = `${Math.min(Math.max(arrowCenter, POPOVER_VIEWPORT_MARGIN_PX), maxArrowTop)}px`;
}

/**
 * Every step's popover chrome: the ✕ close label, the CTA class, and the sidebar re-anchor.
 * Module-level because it touches no component state beyond the step it's handed.
 */
function decoratePopover(popover: PopoverDOM, step: TourStep): void {
  // Close is an "✕" aligned with the progress row, and the primary CTA sits at the footer's
  // left. Clicking ✕ runs the same path as any other exit — finish('skipped') — so it records
  // the skip on the backend, not just locally.
  popover.closeButton.textContent = '✕';
  popover.closeButton.setAttribute('aria-label', 'Skip tour');
  popover.closeButton.classList.add('dalgo-tour-close-btn');
  popover.nextButton.classList.add('dalgo-tour-next-btn');
  outlinePopoverArrow(popover);
  alignPopoverCloseWithHeader(popover, 'product-tour');

  // The popover's target is the synthetic spotlight band (for the stage cutout), but the
  // popover itself must sit beside the SIDEBAR item, not the content. Deferred a frame:
  // driver.js calls its own auto-positioning function right after this hook returns, which
  // would otherwise clobber a same-tick override.
  requestAnimationFrame(() => anchorPopoverToSidebar(popover, step));
}

export const ProductTour = forwardRef<ProductTourHandle, ProductTourProps>(function ProductTour(
  { orgSlug, onTourEnd, onOfferPostTourChoice, canOfferPostTourChoice = true },
  ref
) {
  const router = useRouter();
  const pathname = usePathname();
  const driverRef = useRef<Driver | null>(null);
  const stepIndexRef = useRef(0);
  const activeRef = useRef(false);
  /** Sidebar nav item currently wearing RING_CLASS — cleared as the tour moves on or ends. */
  const ringedElRef = useRef<HTMLElement | null>(null);
  // Guards against the pathname-triggered re-anchor effect below firing a second,
  // redundant renderStep for the same index while the first one is still awaiting
  // waitForElement (e.g. right after router.push, before the new page has painted).
  const renderingIndexRef = useRef<number | null>(null);

  // Read through a ref so openPostTourModal below can stay referentially stable — it's
  // captured in renderStep's closure, and re-creating that chain on every prop change would
  // churn the whole step-render pipeline mid-tour.
  const canOfferPostTourChoiceRef = useRef(canOfferPostTourChoice);
  useEffect(() => {
    canOfferPostTourChoiceRef.current = canOfferPostTourChoice;
  }, [canOfferPostTourChoice]);

  // Same reason as canOfferPostTourChoiceRef — keeps openPostTourModal stable even though
  // the parent re-creates this callback on its own re-renders.
  const onOfferPostTourChoiceRef = useRef(onOfferPostTourChoice);
  useEffect(() => {
    onOfferPostTourChoiceRef.current = onOfferPostTourChoice;
  }, [onOfferPostTourChoice]);

  // Deferred a tick: this is called from driver.js's native button click handler, outside
  // React's own synthetic event system. Opening the Dialog synchronously here mounts it (and
  // its "click outside to close" listener) WHILE the same click event is still bubbling to
  // `document` — Radix's own listener then sees that same event as an outside click and
  // immediately closes the dialog it just opened, before it's ever visible. Waiting for the
  // current event to fully finish first avoids that.
  const openPostTourModal = useCallback(() => {
    // Both post-tour flows already decided — a repeat run of the tour ends silently rather
    // than re-offering choices the user has been through.
    if (!canOfferPostTourChoiceRef.current) return;
    setTimeout(() => onOfferPostTourChoiceRef.current(), 0);
  }, []);

  const finish = useCallback(
    (reason: 'completed' | 'skipped') => {
      markTourSeen(orgSlug);
      // The run is over one way or the other, so there's nothing left to resume — leaving the
      // index behind would re-open the tour on the next page load.
      clearTourProgress(orgSlug);
      trackEvent(
        reason === 'completed' ? ANALYTICS_EVENTS.TOUR_COMPLETED : ANALYTICS_EVENTS.TOUR_SKIPPED,
        { step: stepIndexRef.current + 1 }
      );
      // Cross-path lifecycle. The stage is the step's ROUTE, not its title: routes are stable
      // identifiers, titles are copy and get rewritten.
      if (reason === 'completed') {
        completeOnboardingPath(ONBOARDING_PATHS.WALKTHROUGH);
      } else {
        exitOnboardingPath(
          ONBOARDING_PATHS.WALKTHROUGH,
          TOUR_STEPS[stepIndexRef.current]?.route ?? null
        );
      }
      void saveTrialWalkthroughFlow('product_tour', reason);
      ringedElRef.current?.classList.remove(RING_CLASS);
      ringedElRef.current = null;
      setChromeLifted(false);
      document.getElementById(SPOTLIGHT_ELEMENT_ID)?.remove();
      onTourEnd?.(reason);
    },
    [orgSlug, onTourEnd]
  );

  const renderStep = useCallback(
    async (index: number) => {
      if (!activeRef.current || renderingIndexRef.current === index) return;
      renderingIndexRef.current = index;
      stepIndexRef.current = index;
      // Written before the step actually renders, not after: a reload can land anywhere in the
      // navigate-and-wait sequence below, and resuming the step the user was heading to beats
      // resuming the one they already left.
      saveTourProgress(orgSlug, index);
      const step = TOUR_STEPS[index];
      const isLast = index === TOUR_STEPS.length - 1;
      const sidebarSelector = `#main-layout-sidebar a[href="${step.route}"]`;

      // Wrapped so ANY failure here (a thrown error, a page that never settles) always
      // clears renderingIndexRef — without this, one bad step permanently wedges the guard
      // above and the popover is stuck on whatever it last successfully rendered, forever,
      // with the page underneath still free to navigate on (looked like "page changes, modal
      // doesn't", with no way to recover short of reloading).
      try {
        if (window.location.pathname !== step.route) {
          router.push(step.route);
          await waitForPathname(step.route);
          if (!activeRef.current) return;
        }

        // Every step of this tour rings a sidebar item and pins its popover beside it (see
        // anchorPopoverToSidebar), so a collapsed sidebar leaves the whole tour hanging off a
        // column of unlabelled icons. Open it — the tour never collapses it back.
        useSidebarStore.getState().revealNavItem(step.route);

        // Wait for the sidebar link (handles the "Data" submenu needing to auto-expand
        // before its children mount) AND the content wrapper (for the spotlight band).
        const [sidebarEl, contentEl] = await Promise.all([
          waitForElement(sidebarSelector),
          waitForElement(TOUR_CONTENT_SELECTOR),
        ]);
        if (!activeRef.current || !contentEl) return;
        if (!sidebarEl) {
          // This step's nav item never showed up — the current user/org doesn't have that
          // feature (e.g. Reports gated by role or Superset setup). Skip it instead of
          // leaving the previous step's popover hanging on screen forever.
          if (isLast) {
            activeRef.current = false;
            finish('completed');
            openPostTourModal();
            driverRef.current?.destroy();
          } else {
            void renderStep(index + 1);
          }
          return;
        }

        if (step.spotlightRowOnly) {
          await waitForRealRows(contentEl, step.rowSelector);
          if (!activeRef.current) return;
        }

        // Keep the whole nav out of the dim, then ring this step's item (and un-ring the
        // previous step's). Re-applied per step rather than once at start: the sidebar root
        // survives navigation, but the tour can be resumed onto a freshly mounted layout.
        setChromeLifted(true);
        ringedElRef.current?.classList.remove(RING_CLASS);
        const sidebarTargetVisible = hasVisibleArea(sidebarEl.getBoundingClientRect());
        if (sidebarTargetVisible) {
          (sidebarEl as HTMLElement).classList.add(RING_CLASS);
          ringedElRef.current = sidebarEl as HTMLElement;
        } else {
          ringedElRef.current = null;
        }

        const spotlightEl = getOrCreateSpotlightElement();
        positionSpotlightElement(
          spotlightEl,
          contentEl,
          step.spotlightFull ?? false,
          step.spotlightRowOnly ?? false,
          step.spotlightRowCount ?? 1,
          step.rowSelector
        );

        driverRef.current?.highlight({
          element: spotlightEl,
          popover: {
            title: popoverHeaderHtml(index, TOUR_STEPS.length, step.title),
            description: `<div>${step.content}</div>`,
            side: 'right',
            align: 'start',
            showButtons: ['next', 'close'],
            nextBtnText: step.ctaLabel ?? 'Next',
            onNextClick: (_el, _step, { state }) => {
              // Give instant feedback the moment Next is clicked — the actual step change can
              // take a beat (route navigation, waiting for the new page's content to mount),
              // and without this the popover just sits frozen on the old step, reading as
              // "stuck", then jumps to the new one all at once. Grabbing the button off
              // `state.popover` (rather than a querySelector) targets exactly the button that
              // was clicked.
              const btn = state.popover?.nextButton;
              if (btn) {
                btn.disabled = true;
                btn.style.opacity = '0.6';
              }
              if (isLast) {
                // Call finish() directly rather than relying on driver.js's onDestroyed hook
                // to detect completion — that hook only fires if driver's OWN internal
                // "active element/step" state happens to be set by the time destroy() runs,
                // which depends on an animation-completion timer outside our control.
                // openPostTourModal() (deferred, see its own comment) then guarantees the
                // dialog actually shows on a real completion.
                activeRef.current = false;
                finish('completed');
                openPostTourModal();
                driverRef.current?.destroy();
              } else {
                void renderStep(index + 1);
              }
            },
          },
        });
        trackEvent(ANALYTICS_EVENTS.TOUR_STEP_VIEWED, { step: index + 1, title: step.title });
        trackOnboardingPathStage(ONBOARDING_PATHS.WALKTHROUGH, step.route, { stageIndex: index });
        // Prefetch the next step's route now, while this step is on screen, so the RSC
        // payload is already cached by the time the user clicks Next.
        const nextStep = TOUR_STEPS[index + 1];
        if (nextStep) router.prefetch(nextStep.route);
      } catch (err) {
        console.error('[ProductTour] step render failed, tour may be out of sync', index, err);
      } finally {
        // Only clear our own slot — the sidebarEl-missing branch above may have already
        // kicked off a synchronous renderStep(index + 1) that's now mid-flight and has
        // claimed the ref for itself; blindly nulling it here would clobber that.
        if (renderingIndexRef.current === index) renderingIndexRef.current = null;
      }
    },
    [router, orgSlug, finish, openPostTourModal]
  );

  const startTour = useCallback(
    (startIndex = 0) => {
      if (activeRef.current) return;
      activeRef.current = true;
      stepIndexRef.current = startIndex;
      // Defensive: the insight walkthrough's coachmarks put this on <body> to let clicks
      // through their dialog (see tour.css). It's cleaned up with each of those stages, but if
      // one ever overlapped the tour it would re-enable the whole page mid-tour.
      document.body.classList.remove('dalgo-tour-passthrough');
      driverRef.current = driver({
        popoverClass: 'dalgo-tour',
        overlayColor: '#000000',
        // Dims the page except the cutout over the content band — THE thing that makes the
        // step's list rows read as picked out. The navbar and sidebar are lifted above this
        // overlay by CHROME_LIFT_CLASS so the chrome isn't dimmed along with the list.
        overlayOpacity: 0.55,
        stagePadding: 6,
        // Rounds the cutout, and kept in sync with the band's own border-radius in tour.css so the
        // ring drawn on the band follows the same curve as the hole it sits in.
        stageRadius: 10,
        // Next and ✕ in the popover are the only ways through the tour.
        //
        // allowClose gates driver.js's OWN exits — overlay click and Escape — not our ✕, which
        // runs through the onCloseClick hook below and still works with this false. The overlay
        // click was the live one: the overlay <svg> is pointer-events:none, but driver gives its
        // <path> an inline `auto`, so a click anywhere on the dimmed page hit that path, emitted
        // overlayClick, and tore the tour down — recording a SKIP the user never asked for.
        allowClose: false,
        // Same story for the keyboard: Escape hit the same close path, and the arrow keys drove
        // a step navigation this tour doesn't use.
        allowKeyboardControl: false,
        disableActiveInteraction: true,
        onPopoverRender: (popover: PopoverDOM) =>
          decoratePopover(popover, TOUR_STEPS[stepIndexRef.current]),
        onCloseClick: () => {
          // Handle the "Skip" click ourselves rather than falling through to driver.js's
          // default close behavior — that behavior only calls `onDestroyed` if its OWN
          // internal `__activeElement`/`__activeStep` state happens to already be set, which
          // depends on an animation-completion timer we don't control. Calling `finish`
          // directly here guarantees it always fires.
          activeRef.current = false;
          finish('skipped');
          driverRef.current?.destroy();
        },
        onDestroyed: () => {
          // Safety net only. With allowClose/allowKeyboardControl off there are no driver.js
          // exits left, so in practice this now covers unmounts alone — but both
          // `onNextClick`'s isLast branch and `onCloseClick` above already call `finish`
          // themselves and set `activeRef.current = false` first, so this stays a no-op for
          // those paths (avoids double-firing analytics/localStorage for the same exit).
          const wasActive = activeRef.current;
          activeRef.current = false;
          driverRef.current = null;
          if (wasActive) finish('skipped');
        },
      });
      // Only a genuine start counts — a resume is the same run continuing, and firing this
      // again would inflate starts every time the user reloads mid-tour.
      if (startIndex === 0) {
        trackEvent(ANALYTICS_EVENTS.TOUR_STARTED);
        startOnboardingPath(ONBOARDING_PATHS.WALKTHROUGH);
      } else {
        resumeOnboardingPath(ONBOARDING_PATHS.WALKTHROUGH, TOUR_STEPS[startIndex]?.route ?? null);
      }
      void renderStep(startIndex);
    },
    [renderStep, finish]
  );

  useImperativeHandle(ref, () => ({ startTour }), [startTour]);

  // Re-anchor after a route change settles, in case the tour is mid-step when the
  // pathname updates (covers back/forward nav during the tour).
  useEffect(() => {
    if (!activeRef.current) return;
    const step = TOUR_STEPS[stepIndexRef.current];
    if (step && step.route === pathname) {
      void renderStep(stepIndexRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
      ringedElRef.current?.classList.remove(RING_CLASS);
      ringedElRef.current = null;
      setChromeLifted(false);
      document.getElementById(SPOTLIGHT_ELEMENT_ID)?.remove();
    };
  }, []);

  // Keep the spotlight (and popover) locked to the real content on zoom/window resize. The
  // synthetic spotlight element is `position: fixed` with plain inline px — it doesn't
  // reflow on its own, so without this it visually drifts off the actual card/table as soon
  // as the viewport changes size. `driver.refresh()` re-reads the (now-repositioned)
  // element's rect to redraw the overlay cutout — but it also resets the popover to driver.js's
  // own default side/align position (targeting the spotlight band, not the sidebar), so the
  // sidebar-anchor override has to be re-applied straight after, same as `onPopoverRender`.
  useEffect(() => {
    const reposition = () => {
      if (!activeRef.current) return;
      const step = TOUR_STEPS[stepIndexRef.current];
      const contentEl = document.querySelector(TOUR_CONTENT_SELECTOR);
      if (!step || !contentEl) return;
      positionSpotlightElement(
        getOrCreateSpotlightElement(),
        contentEl,
        step.spotlightFull ?? false,
        step.spotlightRowOnly ?? false,
        step.spotlightRowCount ?? 1,
        step.rowSelector
      );
      driverRef.current?.refresh();
      const popover = driverRef.current?.getState('popover') as PopoverDOM | undefined;
      if (popover) requestAnimationFrame(() => anchorPopoverToSidebar(popover, step));
    };
    let frame: number | null = null;
    const onResize = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reposition);
    };
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, []);

  // Renders nothing of its own — the tour is driver.js overlays plus a synthetic spotlight
  // element appended to the body, and the post-tour dialog now lives in tour-gate.tsx.
  return null;
});
