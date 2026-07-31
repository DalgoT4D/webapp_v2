'use client';

/**
 * Renders the "Build your first insight" walkthrough's coachmarks (Figma "tour flow"
 * sample-data fork, frames 2672:856 -> 2683:7260). Unlike ProductTour, steps here advance
 * on the user's REAL action (clicking Create KPI, saving, sharing) rather than a driver.js
 * "Next" button — those real components call `useInsightWalkthroughStore.getState().advanceTo(...)`
 * directly (see kpi-page.tsx, dashboard-builder-v2.tsx, dashboard-native-view.tsx). This
 * component only owns rendering the right highlight for the CURRENT stage and reacting to
 * route changes for stages whose advance signal is simply "the user navigated onward".
 */
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './tour.css';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import type { WalkthroughStage } from './insight-walkthrough-constants';

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

interface StageConfig {
  /** Route this stage's target lives on, or null if it doesn't require navigation. */
  route: string | null;
  selector: string;
  title: string;
  description: string;
  /**
   * Whether to dim the rest of the screen behind the target (driver.js's own overlay+cutout).
   * Defaults to true for page-level targets (sidebar items, toolbar buttons) — matches Figma's
   * dimmed-background coachmarks there. Stages whose target lives INSIDE an already-open
   * Radix Dialog (the 5 KPIForm field stages) set this to false: driver.js's full-viewport
   * overlay sits above the dialog's own content, so dimming would darken the REST of the same
   * dialog (other fields, Cancel/Continue) around a small cutout hole for just the one field —
   * not a Figma-matching "spotlight", just a broken-looking modal. The Dialog's own backdrop
   * already dims the page behind it, so no extra overlay is needed for these.
   */
  dimOverlay?: boolean;
  /** Close-button label. Defaults to 'Skip'; Figma calls this one 'Later' on the dashboard nudge. */
  closeLabel?: string;
  /**
   * Popover placement relative to the target. Defaults to 'right'/'start', which suits
   * sidebar-anchored targets (open canvas to their right). Toolbar buttons mid-row aren't near
   * a viewport edge, so driver.js's own edge-avoidance clamps a 'right' popover toward the
   * viewport's right edge instead of the button — visually disconnecting the two. Those stages
   * override to 'bottom', where there's always open canvas below a top toolbar.
   */
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}

// Stages driven purely by route change (no manual advanceTo call needed elsewhere) map here
// to the NEXT stage they unlock once that route is reached.
const ROUTE_ADVANCES: Partial<Record<WalkthroughStage, WalkthroughStage>> = {
  dashboard_nudge: 'dashboard_intro',
  dashboard_intro: 'builder_add_kpi',
};

// Populated incrementally across the feature's tasks.
const STAGE_CONFIG: Partial<Record<WalkthroughStage, StageConfig>> = {
  kpi_intro: {
    route: '/kpis',
    selector: '[data-testid="create-kpi-btn"]',
    title: 'Track your targets',
    description:
      'A KPI turns a metric into a goal, set a target and Dalgo flags it green or red so you always know where you stand.',
  },
  kpi_metric: {
    route: '/kpis',
    selector: '[data-testid="kpi-form-metric-field"]',
    title: 'Pick a metric',
    description:
      'The measure this KPI tracks, for example a count of beneficiaries. Choose the suggested one to get started.',
    dimOverlay: false,
  },
  kpi_target: {
    route: '/kpis',
    selector: '[data-testid="kpi-form-target-field"]',
    title: 'Target value',
    description:
      'The number you’re aiming for. Dalgo marks the KPI green once you reach it and red when you fall short.',
    dimOverlay: false,
  },
  kpi_direction: {
    route: '/kpis',
    selector: '[data-testid="kpi-form-direction-field"]',
    title: 'Direction',
    description:
      'Tell Dalgo whether a higher or lower value counts as on-track, so it knows which way to flag.',
    dimOverlay: false,
  },
  kpi_continue: {
    route: '/kpis',
    selector: '[data-testid="kpi-form-continue-btn"]',
    title: 'Keep going',
    description: 'Click Continue to set the rest of the KPI details.',
    dimOverlay: false,
  },
  kpi_time_column: {
    route: '/kpis',
    selector: '[data-testid="kpi-form-time-column-field"]',
    title: 'Time column',
    description:
      'The date column Dalgo trends this KPI over — paired with a grain like Monthly so the number moves over time.',
    dimOverlay: false,
  },
  kpi_type: {
    route: '/kpis',
    selector: '[data-testid="kpi-form-type-field"]',
    title: 'KPI type',
    description:
      'A simple way to classify what this measures along the results chain — input, output, outcome or impact. It just organises your KPIs, so pick whichever fits.',
    dimOverlay: false,
  },
  kpi_submit: {
    route: '/kpis',
    selector: '[data-testid="kpi-form-submit-btn"]',
    title: 'Create your KPI',
    description: 'Click Create KPI to save it.',
    dimOverlay: false,
  },
  dashboard_nudge: {
    route: '/kpis',
    selector: 'a[href="/dashboards"]',
    title: 'Add it to a dashboard',
    description:
      'Your KPI is live 🎉 Pin it onto a dashboard with a chart so your team sees the full picture.',
    closeLabel: 'Later',
    dimOverlay: false,
  },
  dashboard_intro: {
    route: '/dashboards',
    selector: '#dashboard-create-button',
    title: 'Create a dashboard',
    description:
      'Pin your KPI and charts into a dashboard and share it with your team — click Create dashboard.',
    dimOverlay: false,
  },
  builder_add_kpi: {
    route: '/dashboards/create',
    selector: '[data-testid="add-kpi-btn"]',
    title: 'Add your KPI',
    description: 'Click Add KPI and pick the KPI you just built to drop it onto the canvas.',
    dimOverlay: false,
    side: 'bottom',
  },
  builder_add_chart: {
    route: '/dashboards/create',
    selector: '[data-testid="add-chart-btn"]',
    title: 'Add a Chart',
    description: 'Click Add chart and drop a sample chart next to it.',
    dimOverlay: false,
    side: 'bottom',
  },
  builder_resize: {
    route: '/dashboards/create',
    // Newest tile has no stable id to key a static selector on (grid items are created with
    // `chart-${Date.now()}`) — react-grid-layout always appends new widgets last in DOM order
    // (grid model: new items land at bottomY, nothing else reorders), so the last `.react-grid-item`
    // is reliably the one just added.
    selector: '.react-grid-item:last-of-type',
    title: 'Resize and move your tiles',
    description:
      'Drag a corner to resize, or grab a tile to move it around — now make your dashboard look nice.',
    dimOverlay: false,
  },
  builder_save: {
    route: '/dashboards/create',
    selector: '[data-testid="dashboard-save-btn"]',
    title: 'Save your dashboard',
    description: 'Looks good. Save it so your team can open it.',
    dimOverlay: false,
    side: 'bottom',
  },
  builder_preview: {
    route: '/dashboards/create',
    selector: '[data-testid="dashboard-preview-btn"]',
    title: 'Preview it first',
    description: 'Saved! Take a quick look the way your team will see it.',
    dimOverlay: false,
    side: 'bottom',
  },
  share: {
    route: null, // resolved dynamically to /dashboards/{id} — matched by pathname regex below
    selector: '[data-testid="dashboard-share-btn"]',
    title: 'Share your dashboard',
    description: 'Send it to your team so everyone sees the same numbers — click the Share icon.',
    dimOverlay: false,
  },
};

export function InsightWalkthroughCoachmark(): null {
  const router = useRouter();
  const pathname = usePathname();
  const active = useInsightWalkthroughStore((s) => s.active);
  const stage = useInsightWalkthroughStore((s) => s.stage);
  const suppressCoachmark = useInsightWalkthroughStore((s) => s.suppressCoachmark);
  const driverRef = useRef<Driver | null>(null);

  // Fork2: a one-off custom coachmark (3 actions, not a generic highlight+skip), rendered
  // manually rather than through STAGE_CONFIG/renderStage below.
  useEffect(() => {
    let cancelled = false;

    if (active && stage === 'fork2') {
      (async () => {
        const sidebarEl = await waitForElement('a[href="/kpis"]');
        if (cancelled || !sidebarEl) return;

        const d = driver({
          popoverClass: 'dalgo-tour',
          overlayColor: '#000000',
          overlayOpacity: 0.55,
          stagePadding: 6,
          stageRadius: 10,
          allowClose: true,
          showButtons: [],
          onPopoverRender: (popover) => {
            // driver.js hides title/description (display: none) when the step's popover
            // config had no title/description text — which is the case here (content is
            // injected here, not passed to highlight()). Restore visibility explicitly.
            popover.title.style.display = 'block';
            popover.description.style.display = 'block';
            popover.title.textContent = 'Build your first insight';
            popover.description.innerHTML =
              'How do you want to build it — with our ready-made sample data, or by connecting your own?' +
              '<div class="dalgo-tour-fork2-actions">' +
              '<button class="dalgo-tour-fork2-primary" data-action="sample">USE SAMPLE DATA</button>' +
              '<button class="dalgo-tour-fork2-secondary" data-action="own">CONNECT MY DATA</button>' +
              '</div>' +
              '<div class="dalgo-tour-fork2-skip" data-action="skip">Skip for now</div>';

            popover.wrapper
              .querySelector('[data-action="sample"]')
              ?.addEventListener('click', () => {
                d.destroy();
                useInsightWalkthroughStore.getState().advanceTo('kpi_intro');
                router.push('/kpis');
              });
            popover.wrapper.querySelector('[data-action="own"]')?.addEventListener('click', () => {
              d.destroy();
              useInsightWalkthroughStore.getState().skip();
              router.push('/ingest');
            });
            popover.wrapper.querySelector('[data-action="skip"]')?.addEventListener('click', () => {
              d.destroy();
              useInsightWalkthroughStore.getState().skip();
            });
          },
          onDestroyed: () => {
            driverRef.current = null;
          },
        });
        driverRef.current = d;
        // driver.js only builds popover DOM (and fires onPopoverRender) when `popover` is
        // present on the step — omitting it entirely (as opposed to an empty object) skips
        // popover creation altogether, leaving just the highlight ring with no content. This
        // step's actual title/description/buttons are injected via onPopoverRender above, so
        // an empty object here is enough to make driver.js build the DOM to inject into.
        d.highlight({ element: sidebarEl as HTMLElement, popover: {} });
      })();
    }

    return () => {
      cancelled = true;
      driverRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stage]);

  // All other single-highlight stages: generic highlight+skip against STAGE_CONFIG, keyed by
  // route+selector.
  useEffect(() => {
    let cancelled = false;
    const config =
      active && stage && stage !== 'fork2' && !suppressCoachmark ? STAGE_CONFIG[stage] : undefined;

    if (config) {
      (async () => {
        if (config.route && window.location.pathname !== config.route) return;
        if (stage === 'share' && !/^\/dashboards\/\d+$/.test(window.location.pathname)) return;
        const el = await waitForElement(config.selector);
        if (cancelled || !el) return;

        const dimOverlay = config.dimOverlay !== false;
        const d = driver({
          popoverClass: 'dalgo-tour',
          overlayColor: '#000000',
          overlayOpacity: dimOverlay ? 0.55 : 0,
          stagePadding: 6,
          stageRadius: 10,
          allowClose: true,
          showButtons: ['close'],
          onPopoverRender: (popover) => {
            const closeLabel = config.closeLabel ?? 'Skip';
            popover.closeButton.textContent = closeLabel;
            popover.closeButton.setAttribute('aria-label', 'Skip walkthrough');
            popover.closeButton.classList.add('dalgo-tour-skip-btn');
          },
          onCloseClick: () => {
            useInsightWalkthroughStore.getState().skip();
            d.destroy();
          },
          onDestroyed: () => {
            driverRef.current = null;
          },
        });
        driverRef.current = d;
        d.highlight({
          element: el as HTMLElement,
          popover: {
            title: config.title,
            description: config.description,
            side: config.side ?? 'right',
            align: config.align ?? 'start',
          },
        });
      })();
    }

    return () => {
      cancelled = true;
      driverRef.current?.destroy();
    };
  }, [active, stage, pathname, suppressCoachmark]);

  // Route-driven advances: reaching a mapped route auto-advances to the stage it unlocks.
  useEffect(() => {
    if (!active || !stage) return;
    const next = ROUTE_ADVANCES[stage];
    if (next && STAGE_CONFIG[next]?.route === pathname) {
      useInsightWalkthroughStore.getState().advanceTo(next);
    }
    // 'share' has no fixed route (it's /dashboards/{id}, a dynamic id) so it can't go through
    // the ROUTE_ADVANCES map's plain equality check above.
    if (stage === 'builder_preview' && /^\/dashboards\/\d+$/.test(pathname)) {
      useInsightWalkthroughStore.getState().advanceTo('share');
    }
  }, [active, stage, pathname]);

  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
    };
  }, []);

  return null;
}
