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
}

// Stages driven purely by route change (no manual advanceTo call needed elsewhere) map here
// to the NEXT stage they unlock once that route is reached.
const ROUTE_ADVANCES: Partial<Record<WalkthroughStage, WalkthroughStage>> = {
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
  dashboard_intro: {
    route: '/dashboards',
    selector: '#dashboard-create-button',
    title: 'Create a dashboard',
    description:
      'Pin your KPI and charts into a dashboard and share it with your team — click Create dashboard.',
  },
  builder_add_kpi: {
    route: '/dashboards/create',
    selector: '[data-testid="add-kpi-btn"]',
    title: 'Add your KPI',
    description: 'Click Add KPI and pick the KPI you just built to drop it onto the canvas.',
  },
  builder_add_chart: {
    route: '/dashboards/create',
    selector: '[data-testid="add-chart-btn"]',
    title: 'Add a Chart',
    description: 'Click Add chart and drop a sample chart next to it.',
  },
  builder_save: {
    route: '/dashboards/create',
    selector: '[data-testid="dashboard-save-btn"]',
    title: 'Save your dashboard',
    description: 'Looks good. Save it so your team can open it.',
  },
  builder_preview: {
    route: '/dashboards/create',
    selector: '[data-testid="dashboard-preview-btn"]',
    title: 'Preview it first',
    description: 'Saved! Take a quick look the way your team will see it.',
  },
  share: {
    route: null, // resolved dynamically to /dashboards/{id} — matched by pathname regex below
    selector: '[data-testid="dashboard-share-btn"]',
    title: 'Share your dashboard',
    description: 'Send it to your team so everyone sees the same numbers — click the Share icon.',
  },
};

export function InsightWalkthroughCoachmark(): null {
  const router = useRouter();
  const pathname = usePathname();
  const active = useInsightWalkthroughStore((s) => s.active);
  const stage = useInsightWalkthroughStore((s) => s.stage);
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
        d.highlight({ element: sidebarEl as HTMLElement });
      })();
    }

    return () => {
      cancelled = true;
      driverRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stage]);

  // kpi_fields: 5-step mini-sequence inside the already-open KPIForm dialog. Uses driver.js's
  // built-in multi-step `steps` array (with Next/Previous) rather than one-highlight-at-a-time
  // like the other stages — these are informational field callouts inside a single dialog the
  // user is actively filling out, not gated on a real action per field.
  useEffect(() => {
    let cancelled = false;

    if (active && stage === 'kpi_fields') {
      (async () => {
        const metricEl = await waitForElement('[data-testid="kpi-form-metric-field"]');
        if (cancelled || !metricEl) return;

        const d = driver({
          popoverClass: 'dalgo-tour',
          overlayColor: '#000000',
          overlayOpacity: 0.55,
          stagePadding: 6,
          stageRadius: 10,
          allowClose: true,
          showButtons: ['next', 'close'],
          steps: [
            {
              element: '[data-testid="kpi-form-metric-field"]',
              popover: {
                title: 'Pick a metric',
                description:
                  'The measure this KPI tracks, for example a count of beneficiaries. Choose the suggested one to get started.',
              },
            },
            {
              element: '[data-testid="kpi-form-target-field"]',
              popover: {
                title: 'Target value',
                description:
                  'The number you’re aiming for. Dalgo marks the KPI green once you reach it and red when you fall short.',
              },
            },
            {
              element: '[data-testid="kpi-form-direction-field"]',
              popover: {
                title: 'Direction',
                description:
                  'Tell Dalgo whether a higher or lower value counts as on-track, so it knows which way to flag.',
              },
            },
            {
              element: '[data-testid="kpi-form-time-column-field"]',
              popover: {
                title: 'Time column',
                description:
                  'The date column Dalgo trends this KPI over — paired with a grain like Monthly so the number moves over time.',
              },
            },
            {
              element: '[data-testid="kpi-form-type-field"]',
              popover: {
                title: 'KPI type',
                description:
                  'A simple way to classify what this measures along the results chain — input, output, outcome or impact. It just organises your KPIs, so pick whichever fits.',
              },
            },
          ],
          onCloseClick: () => {
            useInsightWalkthroughStore.getState().skip();
            d.destroy();
          },
          onDestroyed: () => {
            driverRef.current = null;
          },
        });
        driverRef.current = d;
        d.drive();
      })();
    }

    return () => {
      cancelled = true;
      driverRef.current?.destroy();
    };
  }, [active, stage]);

  // All other single-highlight stages: generic highlight+skip against STAGE_CONFIG, keyed by
  // route+selector.
  useEffect(() => {
    let cancelled = false;
    const config =
      active && stage && stage !== 'fork2' && stage !== 'kpi_fields'
        ? STAGE_CONFIG[stage]
        : undefined;

    if (config) {
      (async () => {
        if (config.route && window.location.pathname !== config.route) return;
        if (stage === 'share' && !/^\/dashboards\/\d+$/.test(window.location.pathname)) return;
        const el = await waitForElement(config.selector);
        if (cancelled || !el) return;

        const d = driver({
          popoverClass: 'dalgo-tour',
          overlayColor: '#000000',
          overlayOpacity: 0.55,
          stagePadding: 6,
          stageRadius: 10,
          allowClose: true,
          showButtons: ['close'],
          onPopoverRender: (popover) => {
            popover.closeButton.textContent = 'Skip';
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
            side: 'bottom',
            align: 'start',
          },
        });
      })();
    }

    return () => {
      cancelled = true;
      driverRef.current?.destroy();
    };
  }, [active, stage, pathname]);

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
