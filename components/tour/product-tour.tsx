'use client';

/**
 * Product walkthrough (driver.js). NEW, self-contained feature.
 *
 * - Renders a single floating "Take a tour" button (the only added control).
 * - Drives a step-by-step tour that auto-navigates between pages/tabs.
 * - Two-phase highlight: when a step moves to a different sidebar section, the
 *   tour briefly spotlights the sidebar menu item first (a moving "look here"
 *   beat that draws the eye), then spotlights the page content.
 * - For Explore steps, selects a demo warehouse table in the existing Explore
 *   store so real data is on screen — read-only use of the store.
 *
 * No existing platform UI is modified; selectors target elements that already
 * exist in the DOM.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './tour.css';
import { Compass } from 'lucide-react';
import { useExploreStore } from '@/stores/exploreStore';
import { ExploreTab } from '@/constants/explore';
import { tourSteps, DEMO_EXPLORE_TABLE, type TourStep } from './tour-steps';
import { GuestWelcomeModal } from './guest-welcome-modal';

const TEAL = '#00897B';
const SIDEBAR = '#main-layout-sidebar';
const navSelector = (title: string) => `${SIDEBAR} a[title="${title}"]`;

// How long the sidebar menu item is spotlighted before moving to page content.
const NAV_FLASH_MS = 950;

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function progressDotsHtml(index: number, total: number): string {
  const dots = Array.from({ length: total })
    .map((_, i) => `<span class="${i === index ? 'is-active' : ''}"></span>`)
    .join('');
  return `<div class="dalgo-tour-progress">${dots}</div>`;
}

function buildDescription(step: TourStep, index: number, total: number): string {
  return `<div>${step.content}</div>${progressDotsHtml(index, total)}`;
}

export function ProductTour() {
  const router = useRouter();
  const pathname = usePathname();
  const driverRef = useRef<Driver | null>(null);
  const stepRef = useRef(0);
  const activeRef = useRef(false);
  // Guards re-anchoring while a step transition (nav flash + navigate) is mid-flight.
  const transitioningRef = useRef(false);
  // Indirection so popover button callbacks can call renderStep (defined below).
  const renderStepRef = useRef<(index: number) => void>(() => {});
  const [isRunning, setIsRunning] = useState(false);

  const cleanup = useCallback(() => {
    activeRef.current = false;
    transitioningRef.current = false;
    setIsRunning(false);
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, []);

  // Build the popover config for the content step (shared by render + re-anchor).
  const contentPopover = useCallback(
    (index: number) => {
      const step = tourSteps[index];
      return {
        title: `${step.icon}  ${step.title}`,
        description: buildDescription(step, index, tourSteps.length),
        side: step.side,
        align: step.align ?? 'center',
        showButtons: (index === 0 ? ['next', 'close'] : ['previous', 'next', 'close']) as (
          | 'next'
          | 'previous'
          | 'close'
        )[],
        nextBtnText: index === tourSteps.length - 1 ? 'Finish ✓' : 'Next →',
        prevBtnText: '← Back',
        progressText: `${index + 1} of ${tourSteps.length}`,
        showProgress: true,
        onNextClick: () => {
          if (stepRef.current >= tourSteps.length - 1) cleanup();
          else renderStepRef.current(stepRef.current + 1);
        },
        onPrevClick: () => renderStepRef.current(stepRef.current - 1),
        onCloseClick: () => cleanup(),
      };
    },
    [cleanup]
  );

  // Render a given step: optional sidebar flash, navigate, then spotlight content.
  const renderStep = useCallback(
    async (index: number) => {
      if (!activeRef.current) return;
      if (index < 0 || index >= tourSteps.length) {
        cleanup();
        return;
      }
      const prevIndex = stepRef.current;
      stepRef.current = index;
      const step = tourSteps[index];
      const d = driverRef.current;
      if (!d) return;

      transitioningRef.current = true;

      const needsNav = () => {
        const here = window.location.pathname + window.location.search;
        return step.route !== here && step.route !== window.location.pathname;
      };

      // Phase 1 — sidebar beat: if this step's menu section differs from the
      // previous step's, spotlight the sidebar menu item briefly to draw the eye.
      const prevNav = tourSteps[prevIndex]?.navTitle;
      const movingForward = index >= prevIndex;
      const sectionChanged = !!step.navTitle && step.navTitle !== prevNav;
      if (step.navTitle && sectionChanged && movingForward) {
        // The sidebar link only exists when its parent menu (e.g. "Data") is
        // expanded — which happens automatically once we're inside that section.
        // If it's not visible yet (e.g. starting from Impact), navigate first so
        // the menu expands, then flash the now-visible item.
        let navEl = await waitForElement(navSelector(step.navTitle), 600);
        if (!activeRef.current) return;
        if (!navEl && needsNav()) {
          router.push(step.route);
          navEl = await waitForElement(navSelector(step.navTitle), 4000);
          if (!activeRef.current) return;
        }
        if (navEl) {
          d.highlight({
            element: navSelector(step.navTitle),
            popover: {
              title: `${step.icon}  ${step.title}`,
              description: `<div style="color:#6b7280;font-size:13px">Opening <b style="color:#111827">${step.title}</b>…</div>`,
              side: 'right',
              align: 'center',
              showButtons: [],
            },
          });
          await sleep(NAV_FLASH_MS);
          if (!activeRef.current) return;
        }
      }

      // Navigate if needed (compare against current path + query).
      if (needsNav()) {
        router.push(step.route);
      }

      // Centered "you're all set" closing screen: no element spotlight, just a
      // modal in the middle of the page. Skip the content wait/highlight.
      if (step.center) {
        driverRef.current?.highlight({ popover: contentPopover(index) });
        transitioningRef.current = false;
        return;
      }

      // Phase 2 — wait for the page content, then spotlight it.
      await waitForElement(step.selector);
      if (!activeRef.current) return;
      driverRef.current?.highlight({
        element: step.selector,
        popover: contentPopover(index),
      });
      transitioningRef.current = false;

      // Open the demo Explore table so the preview shows real data. The Explore
      // page resets its selection on unmount and doesn't persist it (and React
      // strict mode double-mounts in dev), so set it AFTER the page has mounted
      // and re-assert it a few times to win against that reset.
      if (step.selectExploreTable) {
        const assert = () => {
          const s = useExploreStore.getState();
          const cur = s.selectedTable;
          if (
            !cur ||
            cur.schema !== DEMO_EXPLORE_TABLE.schema ||
            cur.table !== DEMO_EXPLORE_TABLE.table
          ) {
            s.setSelectedTable({ ...DEMO_EXPLORE_TABLE });
            s.setActiveTab(ExploreTab.PREVIEW);
          }
        };
        [0, 250, 600, 1100, 1800].forEach((ms) =>
          setTimeout(() => {
            if (activeRef.current && stepRef.current === index) assert();
          }, ms)
        );
      }
    },
    [router, cleanup, contentPopover]
  );

  // Keep the ref pointing at the latest renderStep so popover callbacks can use it.
  useEffect(() => {
    renderStepRef.current = (index: number) => void renderStep(index);
  }, [renderStep]);

  const startTour = useCallback(
    (startIndex = 0) => {
      if (activeRef.current) return;
      activeRef.current = true;
      setIsRunning(true);
      driverRef.current = driver({
        popoverClass: 'dalgo-tour',
        overlayColor: '#111827',
        overlayOpacity: 0.55,
        stagePadding: 6,
        stageRadius: 10,
        allowClose: true,
        disableActiveInteraction: true,
        onDestroyed: () => {
          activeRef.current = false;
          transitioningRef.current = false;
          setIsRunning(false);
        },
      });
      void renderStep(startIndex);
    },
    [renderStep]
  );

  // Clean up on unmount.
  useEffect(() => cleanup, [cleanup]);

  // Re-anchor the popover after route transitions settle. Content-anchored pages
  // remount on navigation, so re-pin the current step — but not while a step
  // transition (which navigates itself) is still in flight.
  useEffect(() => {
    if (!activeRef.current || transitioningRef.current) return;
    const step = tourSteps[stepRef.current];
    if (step && step.selector.includes('main-layout-main-content')) {
      void renderStep(stepRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      <GuestWelcomeModal suppressed={isRunning} onStart={() => startTour(0)} />
      <button
        type="button"
        onClick={() => startTour(0)}
        aria-label="Take a guided tour of Dalgo"
        className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-105"
        style={{
          background: TEAL,
          fontFamily: 'var(--font-anek-latin), system-ui, sans-serif',
          visibility: isRunning ? 'hidden' : 'visible',
        }}
      >
        <Compass className="h-5 w-5" />
        Take a tour
      </button>
    </>
  );
}
