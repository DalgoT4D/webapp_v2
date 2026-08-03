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
import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './tour.css';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import type { WalkthroughStage } from './insight-walkthrough-constants';

/** Resolve when `selector` is in the DOM, or after `timeout` ms (returns the el or null). */
function waitForElement(selector: string, timeout = 30000): Promise<Element | null> {
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
  /**
   * Most targets are a static data-testid string. A few (e.g. a just-created canvas
   * node, whose DOM id isn't known ahead of time) resolve from transient store state
   * instead — pass a function returning the selector, or null while it isn't available
   * yet (the stage is skipped rather than highlighting nothing).
   */
  selector: string | (() => string | null);
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
  own_data_charts_intro: 'own_data_chart_create',
  own_data_dashboard_nudge: 'dashboard_intro',
  pipeline_transform_intro: 'pipeline_workflow_intro',
  pipeline_workflow_intro: 'pipeline_pick_table',
  pipeline_table_built: 'pipeline_orchestrate_intro',
  pipeline_orchestrate_intro: 'pipeline_add_connection',
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
  // own_data_ingest has no entry here — it's a silent wait stage (see tour-gate.tsx's
  // sync-detection effect), not a coachmark.
  own_data_charts_intro: {
    route: null, // shown wherever the user is when the tracked connection's sync is detected
    selector: 'a[href="/charts"]',
    title: 'Your data’s in',
    description:
      'Data is synced and clean. Let’s create charts from your own data — same builder you saw with the sample.',
    closeLabel: 'Later',
  },
  own_data_chart_create: {
    route: '/charts',
    selector: '[data-testid="charts-create-btn"]',
    title: 'Start here',
    description: 'Create a chart from one of your tables — it only takes a couple of clicks.',
  },
  own_data_chart_save: {
    route: null, // resolved dynamically to /charts/{id}/edit — matched by pathname regex below
    selector: '[data-testid="chart-edit-save-button"]',
    title: 'Looks good — save it',
    description: 'Save this chart to reuse it on a dashboard your team can open.',
    dimOverlay: false,
  },
  own_data_dashboard_nudge: {
    route: '/charts',
    selector: 'a[href="/dashboards"]',
    title: 'Add it to a dashboard',
    description:
      'Your chart is live 🎉 Pin it onto a dashboard so your team sees the full picture.',
    closeLabel: 'Later',
    dimOverlay: false,
  },
  own_data_builder_add_chart: {
    route: '/dashboards/create',
    selector: '[data-testid="add-chart-btn"]',
    title: 'Add a Chart',
    description: 'Click Add chart and drop a sample chart next to it.',
    dimOverlay: false,
    side: 'bottom',
  },
  own_data_builder_add_kpi: {
    route: '/dashboards/create',
    selector: '[data-testid="add-kpi-btn"]',
    title: 'Add your KPI',
    description: 'Click Add KPI and pick one to drop it onto the canvas.',
    dimOverlay: false,
    side: 'bottom',
  },
  // Unlike own_data_ingest (silent — that fork's Fork2 bubble already set expectations
  // right before landing here), automate-pipeline has no preceding bubble at all, so
  // landing on a bare Ingest page with zero feedback read as broken. This nudge closes
  // that gap; the wizard itself still explains its own steps once opened (no per-step
  // coachmarks inside it, same as own_data_ingest).
  pipeline_ingest: {
    route: '/ingest',
    selector: '[data-testid="new-source-btn"]',
    title: 'Connect your data',
    description: 'Add a real source here — once it syncs, we’ll walk you through the rest.',
  },
  pipeline_transform_intro: {
    route: null, // shown wherever the user is when the tracked connection's sync is detected
    selector: 'a[href="/transform"]',
    title: 'Your data’s in — now shape it',
    description:
      'Raw tables aren’t a pipeline yet. Head to Transform to combine them into one clean, chart-ready dataset.',
  },
  pipeline_workflow_intro: {
    route: '/transform',
    selector: '[data-testid="edit-workflow-btn"]',
    title: 'Open the workflow editor',
    description:
      'This is where you shape your raw tables. Click Edit Workflow and we’ll walk you through just two steps.',
  },
  pipeline_pick_table: {
    route: '/transform/canvas',
    // Whole tree panel (not just one table's + button): react-arborist virtualizes
    // rows, so a single row's rect can be unreliable right as it mounts. The panel
    // itself (search bar at the top) is always present and stable to measure, and
    // keeping it as the highlighted element means every + button inside stays
    // clickable (driver.js's overlay only lets clicks through its highlighted area).
    selector: '[data-testid="project-tree-panel"]',
    title: 'Start with a table',
    description:
      'Your tables are listed here — find one and click the + beside it to start building.',
    dimOverlay: false,
  },
  pipeline_select_node: {
    route: '/transform/canvas',
    // Resolved from the store, not a static string: the node's DOM id (its canvas
    // node uuid) doesn't exist until useSourceTreeActions creates it.
    selector: () => {
      const id = useInsightWalkthroughStore.getState().targetNodeId;
      return id ? `[data-testid="source-model-node-${id}"]` : null;
    },
    title: 'Open it up',
    description: 'Click this table to start building — a functions panel opens on the right.',
    dimOverlay: false,
  },
  pipeline_pick_function: {
    route: '/transform/canvas',
    // Whole panel, not just the "Functions" heading: the heading alone doesn't
    // cover the operation rows below it, and driver.js blocks clicks outside
    // whatever element it highlights.
    selector: '[data-testid="operation-config-layout"]',
    title: 'Pick a function',
    description:
      'We are focusing on Drop, Arithmetic and Filter. Click Drop to remove the columns you do not need.',
    dimOverlay: false,
  },
  pipeline_drop_columns: {
    route: '/transform/canvas',
    // Whole form (checkboxes + Save), not just the column list — same reason as above.
    selector: '[data-testid="drop-operation-form"]',
    title: 'Drop the clutter',
    description: 'Tick the fields you do not report on, then click Save.',
    dimOverlay: false,
  },
  pipeline_save_table: {
    route: '/transform/canvas',
    selector: '[data-testid="create-table-btn"]',
    title: 'Save it as a table',
    description:
      'Turn this cleaned result into a new table your charts can use — click Create a table.',
    dimOverlay: false,
  },
  pipeline_name_table: {
    route: '/transform/canvas',
    // Whole form (name + schema + folder + Save) — schema/folder are already
    // pre-filled (intermediate / root), no separate steps needed for those.
    selector: '[data-testid="create-table-form"]',
    title: 'Name your table',
    description:
      'Give it a clear name — like customer_summary. Schema and folder are pre-filled (intermediate / root) — hit Save and it builds automatically.',
    dimOverlay: false,
  },
  pipeline_table_built: {
    route: '/transform/canvas',
    selector: '[data-testid="publish-button"]',
    title: 'Your table is built',
    description:
      'You’ve got a final, chart-ready dataset. Publish it, then make it repeatable with a pipeline.',
    dimOverlay: false,
  },
  pipeline_orchestrate_intro: {
    route: '/orchestrate',
    selector: '[data-testid="create-pipeline-btn"]',
    title: 'Make it repeatable',
    description:
      'One last step — wrap your ingest + transform into a pipeline so it runs on its own, every day.',
  },
  pipeline_add_connection: {
    route: '/orchestrate/create',
    selector: '[data-testid="connections-container"]',
    title: 'Add a connection',
    description:
      'Open Connections and pick your source — this is the data the pipeline pulls in on every run.',
    dimOverlay: false,
  },
  pipeline_run_transform: {
    route: '/orchestrate/create',
    selector: '[data-testid="run-transform-tasks-checkbox"]',
    title: 'Run all the tasks',
    description:
      'Tick Run transform tasks so each daily run does ingest and your transform together.',
    dimOverlay: false,
  },
  pipeline_set_schedule: {
    route: '/orchestrate/create',
    selector: '[data-testid="cron-container"]',
    title: 'Set a schedule',
    description:
      'Open Frequency and choose, so your pipeline refreshes the data on its own every morning.',
    dimOverlay: false,
  },
  pipeline_create_it: {
    route: '/orchestrate/create',
    selector: '[data-testid="submit-btn"]',
    title: 'Create it',
    description:
      'That’s everything — a connection, your transform and a daily schedule. Click Create Pipeline to set it running.',
    dimOverlay: false,
  },
};

export function InsightWalkthroughCoachmark(): null {
  const router = useRouter();
  const pathname = usePathname();
  const active = useInsightWalkthroughStore((s) => s.active);
  const stage = useInsightWalkthroughStore((s) => s.stage);
  const suppressCoachmark = useInsightWalkthroughStore((s) => s.suppressCoachmark);
  const trackedConnectionId = useInsightWalkthroughStore((s) => s.trackedConnectionId);
  const driverRef = useRef<Driver | null>(null);
  const trackingFrameRef = useRef<number>(0);

  // Keeps a highlight glued to its target while layout is still moving under it —
  // a sidebar collapsing, a canvas pan/zoom settling, dagre re-laying nodes out —
  // none of which fire the window 'resize' event driver.js listens for on its own.
  // Also self-destroys the moment the target leaves the DOM (e.g. a panel closes
  // after Save), instead of leaving a stale popover pointing at nothing until the
  // stage variable itself gets around to changing.
  const trackTarget = useCallback((d: Driver, el: Element) => {
    const tick = () => {
      if (!document.body.contains(el)) {
        d.destroy();
        return;
      }
      d.refresh();
      trackingFrameRef.current = requestAnimationFrame(tick);
    };
    trackingFrameRef.current = requestAnimationFrame(tick);
  }, []);

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
                useInsightWalkthroughStore.getState().chooseSample();
                router.push('/kpis');
              });
            popover.wrapper.querySelector('[data-action="own"]')?.addEventListener('click', () => {
              d.destroy();
              useInsightWalkthroughStore.getState().chooseOwnData();
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
    // pipeline_ingest's "Connect your data" nudge only makes sense before the user has
    // actually created a connection — once trackedConnectionId is set, they're mid-sync
    // (possibly for minutes), and re-showing "add a source" would be actively misleading.
    // Fall back to fully silent (same as own_data_ingest) until the sync-detection effect
    // in tour-gate.tsx advances the stage.
    const isWaitingOnTrackedConnection = stage === 'pipeline_ingest' && trackedConnectionId;
    const config =
      active && stage && stage !== 'fork2' && !suppressCoachmark && !isWaitingOnTrackedConnection
        ? STAGE_CONFIG[stage]
        : undefined;

    if (config) {
      (async () => {
        if (config.route && window.location.pathname !== config.route) return;
        if (stage === 'share' && !/^\/dashboards\/\d+$/.test(window.location.pathname)) return;
        if (
          stage === 'own_data_chart_save' &&
          !/^\/charts\/\d+\/edit$/.test(window.location.pathname)
        )
          return;
        const resolvedSelector =
          typeof config.selector === 'function' ? config.selector() : config.selector;
        if (!resolvedSelector) return;
        const el = await waitForElement(resolvedSelector);
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
        trackTarget(d, el);
      })();
    }

    return () => {
      cancelAnimationFrame(trackingFrameRef.current);
      cancelled = true;
      driverRef.current?.destroy();
    };
  }, [active, stage, pathname, suppressCoachmark, trackedConnectionId, trackTarget]);

  // Route-driven advances: reaching a mapped route auto-advances to the stage it unlocks.
  useEffect(() => {
    if (!active || !stage) return;
    const walkthrough = useInsightWalkthroughStore.getState();

    // dashboard_intro is shared by both forks but unlocks a different next stage
    // depending which one the user took (own-data adds chart-then-KPI; sample adds
    // KPI-then-chart) — can't go through the flat ROUTE_ADVANCES map for this one.
    if (stage === 'dashboard_intro' && pathname === '/dashboards/create') {
      walkthrough.advanceTo(
        walkthrough.path === 'own_data' ? 'own_data_builder_add_chart' : 'builder_add_kpi'
      );
      return;
    }

    const next = ROUTE_ADVANCES[stage];
    if (next && STAGE_CONFIG[next]?.route === pathname) {
      walkthrough.advanceTo(next);
    }
    // These stages resolve to a dynamic route (id unknown ahead of time) so they can't
    // go through the ROUTE_ADVANCES map's plain equality check above.
    if (stage === 'builder_preview' && /^\/dashboards\/\d+$/.test(pathname)) {
      walkthrough.advanceTo('share');
    }
    if (stage === 'own_data_chart_create' && /^\/charts\/\d+\/edit$/.test(pathname)) {
      walkthrough.advanceTo('own_data_chart_save');
    }
  }, [active, stage, pathname]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(trackingFrameRef.current);
      driverRef.current?.destroy();
    };
  }, []);

  return null;
}
