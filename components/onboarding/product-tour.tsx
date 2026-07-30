'use client';

/**
 * Guided product tour engine (driver.js). Mirrors the "tour flow" Figma frames
 * (section 2303:4689) — two DIFFERENT elements per step, not one:
 *  - the SPOTLIGHT (dim-overlay cutout) covers the top of the page's list/content — the
 *    first couple of rows, not the whole page.
 *  - the POPOVER sits next to the sidebar nav item for that route.
 * driver.js ties both to a single target, so we spotlight a synthetic "virtual" element
 * sized/positioned to the content's top band, and separately override the popover's
 * position onto the sidebar link via `onPopoverRender`.
 *
 * Exposes `startTour()` via ref so the intent modal / getting-started widget (siblings,
 * not descendants) can trigger it without a context provider — this component owns no
 * visible React output, everything renders through driver.js's own DOM.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { driver, type Driver, type PopoverDOM } from 'driver.js';
import 'driver.js/dist/driver.css';
import './tour.css';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { TOUR_STEPS, TOUR_CONTENT_SELECTOR, markTourSeen } from './tour-constants';

export interface ProductTourHandle {
  startTour: () => void;
}

interface ProductTourProps {
  orgSlug: string;
  /** Fires once the tour ends, however it ended (completed, skipped, or closed). */
  onTourEnd?: () => void;
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

// Fallback band height, used only when a step isn't spotlightFull and no first row could be
// measured (e.g. an empty-state page with no rows/cards yet).
const SPOTLIGHT_HEIGHT_PX = 340;
const SPOTLIGHT_ELEMENT_ID = 'dalgo-tour-content-spotlight';
// Gap between the sidebar nav item and the popover anchored beside it.
const POPOVER_SIDEBAR_GAP_PX = 16;

function progressDotsHtml(index: number, total: number): string {
  const dots = Array.from({ length: total })
    .map((_, i) => `<span class="${i <= index ? 'is-active' : ''}"></span>`)
    .join('');
  return `<div class="dalgo-tour-progress">${dots}</div>`;
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
 * `.overflow-y-auto` scroll container (see rules/components.md's page layout pattern), which
 * is narrower than the full-bleed `#main-layout-main-content` — inset by the page's own side
 * padding. Capping the spotlight's width to it (instead of the raw content element) keeps the
 * highlight flush with the visible card/table instead of overshooting into the page gutter.
 * Falls back to the full content rect if no such wrapper is found (or it's hidden, e.g. an
 * inactive tab panel).
 */
function getVisibleContentWidth(contentEl: Element, contentRect: DOMRect): number {
  const wrapper = Array.from(contentEl.querySelectorAll<HTMLElement>('.overflow-y-auto')).find(
    (el) => el.offsetWidth > 0 && el.offsetHeight > 0
  );
  if (!wrapper) return contentRect.width;
  const wrapperRect = wrapper.getBoundingClientRect();
  return Math.max(0, wrapperRect.right - contentRect.left);
}

/**
 * Finds the bottom edge of the page's first row of content, so the spotlight band can end
 * exactly there instead of at a fixed height that cuts through it on pages with a taller
 * header (or leaves a gap on pages with a shorter one). Handles the two row shapes used
 * across the tour's pages: table rows, and CSS-grid card rows (e.g. KPI's card grid) — for
 * the latter, only cards sharing the first row's top offset count, since a grid can wrap.
 */
function getFirstRowBottom(contentEl: Element): number | null {
  const firstTableRow = contentEl.querySelector('tbody tr');
  if (firstTableRow) return firstTableRow.getBoundingClientRect().bottom;

  const gridCandidates = contentEl.querySelectorAll<HTMLElement>('[class*="grid"]');
  const grid = Array.from(gridCandidates).find(
    (el) => el.children.length > 1 && getComputedStyle(el).display === 'grid'
  );
  if (!grid) return null;

  const rowRects = Array.from(grid.children)
    .map((child) => child.getBoundingClientRect())
    .filter((r) => r.height > 0);
  if (!rowRects.length) return null;
  const firstRowTop = Math.min(...rowRects.map((r) => r.top));
  const firstRowBottoms = rowRects
    .filter((r) => Math.abs(r.top - firstRowTop) < 1)
    .map((r) => r.bottom);
  return Math.max(...firstRowBottoms);
}

function positionSpotlightElement(
  el: HTMLElement,
  contentEl: Element,
  spotlightFull: boolean
): void {
  const rect = contentEl.getBoundingClientRect();
  const width = getVisibleContentWidth(contentEl, rect);
  const rowBottom = spotlightFull ? null : getFirstRowBottom(contentEl);
  const height = spotlightFull
    ? rect.height
    : Math.min(rowBottom ? rowBottom - rect.top : SPOTLIGHT_HEIGHT_PX, rect.height);

  el.style.top = `${rect.top}px`;
  el.style.left = `${rect.left}px`;
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
}

export const ProductTour = forwardRef<ProductTourHandle, ProductTourProps>(function ProductTour(
  { orgSlug, onTourEnd },
  ref
) {
  const router = useRouter();
  const pathname = usePathname();
  const driverRef = useRef<Driver | null>(null);
  const stepIndexRef = useRef(0);
  const activeRef = useRef(false);
  // Guards against the pathname-triggered re-anchor effect below firing a second,
  // redundant renderStep for the same index while the first one is still awaiting
  // waitForElement (e.g. right after router.push, before the new page has painted).
  const renderingIndexRef = useRef<number | null>(null);

  const finish = useCallback(
    (reason: 'completed' | 'skipped') => {
      markTourSeen(orgSlug);
      trackEvent(
        reason === 'completed' ? ANALYTICS_EVENTS.TOUR_COMPLETED : ANALYTICS_EVENTS.TOUR_SKIPPED,
        { step: stepIndexRef.current + 1 }
      );
      document.getElementById(SPOTLIGHT_ELEMENT_ID)?.remove();
      onTourEnd?.();
    },
    [orgSlug, onTourEnd]
  );

  const renderStep = useCallback(
    async (index: number) => {
      if (!activeRef.current || renderingIndexRef.current === index) return;
      renderingIndexRef.current = index;
      stepIndexRef.current = index;
      const step = TOUR_STEPS[index];
      const isLast = index === TOUR_STEPS.length - 1;
      const sidebarSelector = `a[href="${step.route}"]`;

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
            driverRef.current?.destroy();
          } else {
            void renderStep(index + 1);
          }
          return;
        }

        const spotlightEl = getOrCreateSpotlightElement();
        positionSpotlightElement(spotlightEl, contentEl, step.spotlightFull ?? false);

        driverRef.current?.highlight({
          element: spotlightEl,
          popover: {
            title: step.title,
            description: `<div>${step.content}</div>${progressDotsHtml(index, TOUR_STEPS.length)}`,
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
                driverRef.current?.destroy();
              } else {
                void renderStep(index + 1);
              }
            },
          },
        });
        trackEvent(ANALYTICS_EVENTS.TOUR_STEP_VIEWED, { step: index + 1, title: step.title });
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
    [router]
  );

  const startTour = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    stepIndexRef.current = 0;
    driverRef.current = driver({
      popoverClass: 'dalgo-tour',
      overlayColor: '#000000',
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 10,
      allowClose: true,
      disableActiveInteraction: true,
      onPopoverRender: (popover: PopoverDOM) => {
        // Re-skin driver.js's default "close" (X) button as the Figma "Skip" text link,
        // and move it next to the primary button so the footer matches the design
        // (Skip on the left, primary CTA on the right) instead of a top-right X.
        popover.closeButton.textContent = 'Skip';
        popover.closeButton.setAttribute('aria-label', 'Skip tour');
        popover.closeButton.classList.add('dalgo-tour-skip-btn');
        popover.nextButton.classList.add('dalgo-tour-next-btn');
        popover.footerButtons.insertBefore(popover.closeButton, popover.footerButtons.firstChild);

        // The popover's target is the synthetic spotlight band (for the stage cutout), but
        // the popover itself must sit beside the SIDEBAR item, not the content. Recompute
        // its position from the current step's actual sidebar link. Deferred a frame:
        // driver.js calls its own auto-positioning function right after this hook returns,
        // which would otherwise clobber a same-tick override.
        const step = TOUR_STEPS[stepIndexRef.current];
        const sidebarEl = document.querySelector(`a[href="${step.route}"]`);
        if (sidebarEl) {
          requestAnimationFrame(() => {
            const rect = sidebarEl.getBoundingClientRect();
            popover.wrapper.style.top = `${rect.top}px`;
            popover.wrapper.style.left = `${rect.right + POPOVER_SIDEBAR_GAP_PX}px`;
            popover.wrapper.style.right = 'auto';
            popover.wrapper.style.bottom = 'auto';
            popover.arrow.style.display = 'none';
          });
        }
      },
      onDestroyed: () => {
        const completed = stepIndexRef.current === TOUR_STEPS.length - 1;
        activeRef.current = false;
        driverRef.current = null;
        finish(completed ? 'completed' : 'skipped');
      },
    });
    trackEvent(ANALYTICS_EVENTS.TOUR_STARTED);
    void renderStep(0);
  }, [renderStep, finish]);

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
      document.getElementById(SPOTLIGHT_ELEMENT_ID)?.remove();
    };
  }, []);

  return null;
});
