'use client';

/**
 * Renders the one-shot feature coachmarks described in feature-nudge-constants.ts — Reports,
 * Alerts and Metrics. Mounted once by tour-gate.tsx, which is itself trial-only, so nothing
 * here runs (and no preferences request is made) for a paid org.
 *
 * Deliberately its own driver.js instance rather than a stage in
 * insight-walkthrough-coachmark.tsx: these have no order, no next step and no resume. They do
 * share that component's popover styling (`dalgo-tour-coach`, see tour.css) so a nudge looks
 * identical to a walkthrough coachmark.
 */
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { driver, type Driver, type PopoverDOM } from 'driver.js';
import 'driver.js/dist/driver.css';
import './tour.css';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import {
  saveTrialWalkthroughFlow,
  type TrialWalkthroughState,
} from '@/hooks/api/useTrialWalkthrough';
import { getFeatureNudgeForRoute } from './feature-nudge-constants';
import { alignPopoverCloseWithHeader, outlinePopoverArrow } from './tour-popover-chrome';
import { revealElementInScrollParents } from './tour-reveal';
import { ensurePopoverArrow } from './tour-arrow';

/** Set on <body> (where driver.js puts `driver-active`) so the page stays clickable — tour.css. */
const PASSTHROUGH_CLASS = 'dalgo-tour-passthrough';

/**
 * How long we wait for the page's CTA before giving up. All three are permission-gated and
 * render after their page's data resolves, so this covers a slow list load — but a user
 * without the permission simply never gets the nudge, and it stays unseen for a colleague
 * who does.
 */
const TARGET_TIMEOUT_MS = 15000;

/**
 * Radix dialog content, mounted and open — every create dialog on these three pages is one.
 *
 * Matched on `data-slot` rather than `[role="dialog"]`: driver.js gives its OWN popover
 * role="dialog", so the broader selector had the coachmark tearing itself down the instant it
 * rendered.
 */
const OPEN_DIALOG_SELECTOR = '[data-slot="dialog-content"][data-state="open"]';

/** Resolve when `selector` is in the DOM, or after `timeout` ms (returns the el or null). */
function waitForElement(selector: string, timeout: number): Promise<Element | null> {
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

interface FeatureNudgeCoachmarkProps {
  /**
   * True while a walkthrough coachmark or the product tour owns the screen. The walkthrough
   * wins: a nudge is unseen until dismissed, so skipping this visit costs nothing, whereas
   * two popovers at once would compete for the same user.
   */
  suppressed: boolean;
  /**
   * The backend record. `undefined` while the request is in flight — the nudge waits rather
   * than flashing something the user may have already dismissed.
   */
  walkthroughState: TrialWalkthroughState | undefined;
}

export function FeatureNudgeCoachmark({
  suppressed,
  walkthroughState,
}: FeatureNudgeCoachmarkProps): null {
  const pathname = usePathname();
  const driverRef = useRef<Driver | null>(null);
  const watchFrameRef = useRef<number>(0);
  // Captured in onPopoverRender (driver.js rebuilds the popover DOM per highlight) so the
  // watch loop can keep the pointer triangle attached — see ensurePopoverArrow.
  const popoverRef = useRef<PopoverDOM | null>(null);

  const nudge = getFeatureNudgeForRoute(pathname);
  // Reduced to a primitive on purpose: `walkthroughState` is SWR's response object, whose
  // identity changes on every revalidation — as an effect dependency it would tear the
  // coachmark down and rebuild it each time the preferences endpoint is re-fetched.
  // null = still loading.
  const isDismissed = walkthroughState
    ? Boolean(nudge && walkthroughState[nudge.key]?.completed)
    : null;

  useEffect(() => {
    // isDismissed === null means the preferences request is still in flight; wait rather than
    // flashing a nudge the user may have already dismissed.
    // `undefined` rather than a bare return: the other path returns a cleanup function, and
    // noImplicitReturns wants both spelled out.
    if (!nudge || suppressed || isDismissed !== false) return undefined;

    let cancelled = false;

    /**
     * Tears the coachmark down WITHOUT recording it as seen: the user hasn't read it, the
     * page has simply moved on under it. Two cases — the CTA left the DOM, and a dialog
     * opened over the page (clicking the CTA opens one, and the popover would then float on
     * top of it). Both leave the nudge to reappear on the next visit.
     */
    const watchForTeardown = (el: Element) => {
      const tick = () => {
        if (cancelled) return;
        if (!document.body.contains(el) || document.querySelector(OPEN_DIALOG_SELECTOR)) {
          driverRef.current?.destroy();
          driverRef.current = null;
          document.body.classList.remove(PASSTHROUGH_CLASS);
          return;
        }
        driverRef.current?.refresh();
        // After the refresh: that's what re-runs driver.js's arrow placement, including the
        // `arrow-none` case this restores a triangle for.
        ensurePopoverArrow(popoverRef.current, el);
        watchFrameRef.current = requestAnimationFrame(tick);
        return;
      };
      watchFrameRef.current = requestAnimationFrame(tick);
    };

    const show = async (): Promise<void> => {
      // Set before the first await so driver.js's `.driver-active * { pointer-events: none }`
      // never gets a window where the page is unclickable.
      document.body.classList.add(PASSTHROUGH_CLASS);

      const el = await waitForElement(nudge.selector, TARGET_TIMEOUT_MS);
      if (cancelled) return;
      // No CTA (permission-gated away, or the page never rendered it) — show nothing, and
      // leave the nudge unseen.
      if (!el) {
        document.body.classList.remove(PASSTHROUGH_CLASS);
        return;
      }
      // A dialog already open when we arrive: the same conflict watchForTeardown handles.
      if (document.querySelector(OPEN_DIALOG_SELECTOR)) {
        document.body.classList.remove(PASSTHROUGH_CLASS);
        return;
      }

      const d = driver({
        popoverClass: 'dalgo-tour dalgo-tour-coach',
        overlayColor: '#000000',
        // No dim: the popover IS the highlight. driver.js still needs the overlay element for
        // its positioning machinery, so it stays — transparent and, via PASSTHROUGH_CLASS,
        // click-through.
        overlayOpacity: 0,
        stagePadding: 6,
        stageRadius: 10,
        // The ✕ is the only exit; this only gates driver.js's own Escape / overlay-click
        // dismissals, which would end the nudge without recording it.
        allowClose: false,
        onPopoverRender: (popover) => {
          popoverRef.current = popover;
          outlinePopoverArrow(popover);
          popover.closeButton.textContent = '✕';
          popover.closeButton.setAttribute('aria-label', `Dismiss ${nudge.title} tip`);
          popover.closeButton.setAttribute('data-testid', 'feature-nudge-dismiss-btn');
          popover.closeButton.classList.add('dalgo-tour-close-btn');
          alignPopoverCloseWithHeader(popover, 'coachmark');
        },
        onCloseClick: () => {
          // Optimistic: tear down now, persist in the background. A failed write only means
          // the nudge returns on the next visit (saveTrialWalkthroughFlow never throws).
          d.destroy();
          driverRef.current = null;
          trackEvent(ANALYTICS_EVENTS.FEATURE_NUDGE_DISMISSED, { nudge: nudge.key });
          void saveTrialWalkthroughFlow(nudge.key, 'completed');
        },
        onDestroyed: () => {
          driverRef.current = null;
          popoverRef.current = null;
        },
      });
      driverRef.current = d;
      // driver.js only scrolls a target that's outside the WINDOW; one clipped by an ancestor
      // scroller (sidebar nav, scrolling dialog) stays hidden, which is what happens to the
      // lower nav items under browser zoom. Do that reveal ourselves, before the measurement.
      revealElementInScrollParents(el as HTMLElement);
      d.highlight({
        element: el as HTMLElement,
        popover: {
          title: nudge.title,
          description: nudge.description,
          side: 'bottom',
          align: 'center',
          // Must be set on the popover, NOT as a driver() option: `highlight()` injects its
          // own `showButtons: []` into the step it builds, and that beats instance config —
          // which would leave this coachmark with no way to dismiss it at all.
          showButtons: ['close'],
        },
      });
      // Immediately as well as in the watch loop, so the card's first painted frame already
      // carries its triangle.
      ensurePopoverArrow(popoverRef.current, el);
      trackEvent(ANALYTICS_EVENTS.FEATURE_NUDGE_VIEWED, { nudge: nudge.key });
      watchForTeardown(el);
    };

    void show();

    return () => {
      cancelled = true;
      cancelAnimationFrame(watchFrameRef.current);
      document.body.classList.remove(PASSTHROUGH_CLASS);
      driverRef.current?.destroy();
      driverRef.current = null;
    };
    // `nudge` is derived from `pathname` by a pure lookup, so pathname covers it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, suppressed, isDismissed]);

  return null;
}
