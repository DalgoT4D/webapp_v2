'use client';

/**
 * Renders the "Build your first insight" walkthrough's coachmarks (Figma "tour flow"
 * sample-data fork, frames 2672:856 -> 2683:7260). Unlike ProductTour, steps here advance
 * on the user's REAL action (clicking Create KPI, saving, sharing) rather than a driver.js
 * "Next" button — those real components call `useInsightWalkthroughStore.getState().advanceTo(...)`
 * directly (see kpi-page.tsx, dashboard-builder-v2.tsx, dashboard-native-view.tsx). This
 * component only owns rendering the right highlight for the CURRENT stage and reacting to
 * route changes for stages whose advance signal is simply "the user navigated onward".
 *
 * The one stage NOT rendered here is 'fork2' (sample vs own data) — that's a dialog now,
 * see get-started-modal.tsx, rendered by tour-gate.tsx.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { driver, type Driver, type Popover, type PopoverDOM } from 'driver.js';
import 'driver.js/dist/driver.css';
import './tour.css';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { useSidebarStore } from '@/stores/sidebarStore';
import {
  getResumeAnchorStage,
  INGEST_STAGES,
  type WalkthroughStage,
} from './insight-walkthrough-constants';
import { alignPopoverCloseWithHeader, outlinePopoverArrow } from './tour-popover-chrome';
import { revealElementInScrollParents } from './tour-reveal';
import { ensurePopoverArrow } from './tour-arrow';
import { LeaveWalkthroughDialog } from './leave-walkthrough-dialog';
import { useWalkthroughExitGuard } from './walkthrough-exit-guard';

/** Shared by both forks' "now build a dashboard" nudges. */
const DASHBOARD_NUDGE_IMAGE = '/branding/dashboard-nudge-graph.jpg';

/**
 * The source picker inside the add-source wizard, shared verbatim by own_data_pick_source and
 * pipeline_pick_source — one definition so the two forks' copy and selector can't drift. They
 * stay distinct STAGES (only one is ever the live `stage`, so they can't both show) purely so
 * each can rewind to its own fork's ingest step.
 *
 * Highlights the whole picker body (search box + popular grid), not one card: any source is a
 * valid choice here — a popular card or anything found through search — and spotlighting a
 * single card read as the only allowed answer.
 *
 * Advances on the user's real selection rather than a `nextOnInteraction` click listener: the
 * selection can come from a card OR a search result row, and the search list doesn't exist in
 * the DOM until the user types, so there's no one element to listen on. SelectSourceStep calls
 * advanceIfBefore(SOURCE_NEXT_STAGE_FOR[...]) from its own state instead.
 *
 * Entered from SelectSourceStep's mount, not from a click on the New Source button — see
 * PICK_SOURCE_STAGE_FOR for why the button click is the wrong signal.
 */
const PICK_SOURCE_STAGE: StageConfig = {
  route: '/ingest', // the wizard is a dialog rendered on the Ingest page
  selector: '[data-testid="source-picker-body"]',
  title: 'Pick a data source',
  description: 'Get started quickly with a google sheet',
  // No `ring`: any source in the picker is a valid choice, and outlining the whole panel
  // read as "click the panel". The popover pointing at it is the whole highlight here.
  // The picker fills a centred, narrow (sm:max-w-xl) dialog — a 'right' popover would be
  // clamped against the viewport edge, and 'bottom' would cover the wizard's own footer.
  side: 'left',
  align: 'center',
};

/**
 * The wizard's Next button, once a source is selected — the other half of PICK_SOURCE_STAGE,
 * and shared by both forks for the same reason.
 *
 * No `nextOnInteraction`: nothing useful follows this click inside the wizard (Configure and
 * the connection step explain themselves), so the stage sits here until the tracked
 * connection's first sync is detected in tour-gate.tsx. Once the button unmounts, the
 * trackTarget -> onLost -> show() loop just re-waits and times out quietly.
 */
const SOURCE_NEXT_STAGE: StageConfig = {
  route: '/ingest',
  selector: '[data-testid="wizard-select-next-btn"]',
  title: 'Now set it up',
  description: 'Click Next to provide the credentials required to connect to the data source.',
  ring: true,
  // Beside the button, not above it: a 'top' popover sat over the dialog body and covered the
  // source cards the user had just picked from. The dialog is centred and narrow
  // (sm:max-w-xl), so there's always open page to its right for the popover to sit in.
  side: 'right',
  align: 'end',
};

/** Set on <body> (where driver.js puts `driver-active`) for every stage — see tour.css. */
const PASSTHROUGH_CLASS = 'dalgo-tour-passthrough';

/** The rounded brand outline drawn on `ring: true` targets — see tour.css. */
const RING_CLASS = 'dalgo-tour-ring';

/**
 * driver.js focuses its popover on every render (`[popover, element][0].focus()`), which is
 * fine when a highlight appears on its own but not when one stage advances into the next
 * mid-typing: these stages advance on the user's real input, so the coachmark can move while
 * a field still has the caret in it. Put focus back where it was — the highlight is a pointer,
 * it should never take the keyboard away from what the user is doing.
 */
function highlightKeepingFocus(d: Driver, element: HTMLElement, popover: Popover): void {
  const previous = document.activeElement as HTMLElement | null;
  d.highlight({ element, popover });
  if (previous && previous !== document.activeElement && document.body.contains(previous)) {
    previous.focus({ preventScroll: true });
  }
}

/**
 * How long a hint stage waits for its field before giving up and moving on. Short on purpose:
 * these targets are already-rendered fields in an open dialog, so anything slower than a
 * re-render means the field isn't coming — it's conditional and this metric doesn't have it
 * (Time Column only renders when the table has a date column). Waiting the full 30s there
 * leaves the user staring at no coach at all.
 */
const HINT_TARGET_TIMEOUT_MS = 2500;

/**
 * How long an `advanceOn: 'value'` field waits after the last keystroke before treating the
 * value as entered. Long enough not to fire between two digits of "500", short enough that a
 * user who types and then sits still isn't left on a stage they've finished.
 */
const VALUE_IDLE_MS = 600;

/**
 * How long a `deferWhileDropdownOpen` stage waits for the open dropdown to be dismissed before
 * showing anyway. A ceiling, not an expectation: a user who parks a combobox open and wanders
 * off should still get the coachmark rather than silence.
 */
const DROPDOWN_CLOSE_TIMEOUT_MS = 15000;

/**
 * Modals that stay guarded while the walkthrough is active EVEN WITH NO COACHMARK on screen.
 *
 * The add-source wizard's later steps (configure, connection) deliberately carry no stage —
 * they explain themselves — so the coachmark goes quiet there and, without this, the exit guard
 * stood down with it: ✕, Cancel and Back dropped the user out of a live walkthrough silently,
 * mid-way through creating the source the whole flow depends on. The wizard is still the flow,
 * coachmark or not.
 *
 * Scoped to named dialogs rather than "any open dialog": a stage like sync_running explicitly
 * tells the user to go and explore, and prompting them for closing some unrelated dialog while
 * they wait would be nonsense.
 */
const WALKTHROUGH_PROTECTED_DIALOGS = '[data-testid="add-source-wizard"]';

/** The layout's content region — everything but the navbar and sidebar. See main-layout.tsx. */
const PAGE_CONTENT_SELECTOR = '#main-layout-main-content';

/** Radix popover content, mounted and open — every Combobox dropdown in the app is one. */
const OPEN_DROPDOWN_SELECTOR = '[data-slot="popover-content"][data-state="open"]';

/** Resolve once no dropdown is open, or after `timeout` ms either way. */
function waitForDropdownsClosed(timeout = DROPDOWN_CLOSE_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve) => {
    if (!document.querySelector(OPEN_DROPDOWN_SELECTOR)) return resolve();
    const start = Date.now();
    const tick = () => {
      if (!document.querySelector(OPEN_DROPDOWN_SELECTOR)) return resolve();
      if (Date.now() - start > timeout) return resolve();
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/**
 * A stage whose target IS a sidebar nav link — `dashboard_nudge`, `sync_failed`, `chart_intro`,
 * `chart_dashboard_nudge`, `pipeline_ingest_nudge`, `pipeline_transform_intro`,
 * `pipeline_orchestrate_nudge`. Matched off the selector rather than carried as a separate
 * StageConfig flag so the two can't disagree.
 */
const SIDEBAR_LINK_SELECTOR = /^a\[href="([^"]+)"\]$/;

/**
 * Open the sidebar when this stage points at a nav item, and leave it open.
 *
 * These stages all fire at a hand-off — "your sync finished, now go to Transform", "you've
 * published, now go to Orchestrate", "your chart is saved, now go to Dashboards" — and by then
 * the user is usually standing on a page that collapsed the sidebar to the icon rail on arrival
 * (/charts/new, /dashboards/create, /transform/canvas, a saved dashboard). Nothing ever expands
 * it again, so the coachmark either pointed at an unlabelled 40px icon or, for the three Data
 * children, waited out its 30s timeout on a link that isn't rendered while Data is closed.
 *
 * Deliberately one-way: the walkthrough never collapses the sidebar, so the per-page
 * auto-collapse still behaves exactly as it always did once the user moves on into a builder.
 */
function revealSidebarTarget(selector: string): void {
  const href = selector.match(SIDEBAR_LINK_SELECTOR)?.[1];
  if (href) useSidebarStore.getState().revealNavItem(href);
}

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

// Creating a dashboard posts from /dashboards/create and immediately redirects to
// /dashboards/{id}/edit?new=true, so the builder is never rendered under the /dashboards/create
// pathname. Builder stages keep that route as their navigable entry point (see
// WALKTHROUGH_STAGE_ROUTES) but match the URL the redirect actually lands on.
const DASHBOARD_BUILDER_ROUTE = /^\/dashboards\/\d+\/edit$/;

/**
 * True when `pathname` is where this stage's target lives. Stages on a dynamic URL declare a
 * `routeMatch` pattern; everything else compares its single static `route`.
 */
function matchesStageRoute(config: StageConfig, pathname: string): boolean {
  return config.routeMatch ? config.routeMatch.test(pathname) : config.route === pathname;
}

interface StageConfig {
  /**
   * Route this stage's target lives on, or null if it doesn't require navigation. Doubles as the
   * URL the Get Started widget navigates to when resuming, so it stays a real, enterable path
   * even for stages whose live URL is dynamic — those add `routeMatch` for the actual gating.
   */
  route: string | null;
  /**
   * Pattern the live pathname must match for this stage to show, for targets on a dynamic URL
   * (an id in the path). When set it replaces the plain `route` equality check; `route` still
   * supplies the navigable entry point.
   */
  routeMatch?: RegExp;
  /**
   * Most targets are a static data-testid string. A few (e.g. a just-created canvas
   * node, whose DOM id isn't known ahead of time) resolve from transient store state
   * instead — pass a function returning the selector, or null while it isn't available
   * yet (the stage is skipped rather than highlighting nothing).
   */
  selector: string | (() => string | null);
  /**
   * Marks this stage a hint rather than a gate: the user is being shown a field, not asked to
   * do a particular thing to it. Set it to the stage that follows and the coachmark moves on
   * once they act on THAT FIELD — never on a click elsewhere on the page, which used to walk
   * the coachmark forward on any stray click.
   *
   * Leave unset where the target genuinely must be clicked (Continue, Create KPI, Save,
   * Share) — those advance from the real handler instead.
   */
  nextOnInteraction?: WalkthroughStage;
  /**
   * What counts as "acting on the field", for a `nextOnInteraction` stage:
   * - 'click' (default) — dropdowns, prefilled selects, button groups. Opening the control is
   *   the action; there's nothing to type, and waiting on a value change stalls forever on a
   *   field that already holds a valid default (Direction).
   * - 'value' — free-text/number inputs. Advances only once something has been ENTERED, and
   *   not until the user stops typing (blur, or a short idle) so the coachmark can't jump
   *   mid-keystroke.
   * - 'open' — Radix Select triggers. Same intent as 'click', but that never fires here:
   *   Select calls preventDefault() on the trigger's pointerdown (react-select's own open
   *   handler), which suppresses the compatibility mouse events, click included. So the stage
   *   listens on pointerdown instead — opening the list IS the action, and the user who reads
   *   the options and keeps the default is done with the field either way. Opt-in rather than
   *   the default because advancing on pointerdown tears the coachmark down while a real
   *   button's click is still in flight (see advancePastHint).
   */
  advanceOn?: 'click' | 'value' | 'open';
  /**
   * Element the `nextOnInteraction` listener attaches to, when that isn't the element being
   * spotlighted. Defaults to `selector`.
   *
   * Needed where the highlighted control is ALREADY in the state the coachmark is describing:
   * chart_data_config points at the Data Configuration tab, which is the tab open by default,
   * so a click listener on it alone would wait for a click no one has any reason to make. It
   * listens on the whole tab list instead — moving to Chart Styling is the real signal that
   * the user is done reading about this one.
   */
  interactionSelector?: string;
  /**
   * Renders a "Next" button that advances to `nextOnInteraction`.
   *
   * For stages where there is genuinely nothing to DO — the two chart-builder tabs just
   * explain what each panel is for, over fields the builder has already prefilled. Without a
   * button these dead-ended: the only way forward was a second click on a tab the user had
   * just clicked to get there, which nothing on screen suggested.
   *
   * Stages that ask for a real action never get this — the action is the affordance.
   */
  showNext?: boolean;
  /**
   * Renders a "Got it" button that runs this handler instead of advancing a stage.
   *
   * For coachmarks whose button means "I've read this", not "I've done it" — the sync-failure
   * message, which has to record WHICH failure was acknowledged as well as move the
   * walkthrough, and which moves it BACKWARDS (something advanceIfBefore would refuse). The
   * handler owns both, so this stays a rendering flag.
   *
   * Ignored when `showNext` is set — a stage asks for one button, not two.
   */
  onDismiss?: () => void;
  /**
   * Hold this stage's coachmark back while a Radix popover (our Combobox dropdowns) is open,
   * showing it only once the user has closed the list.
   *
   * For stages ENTERED FROM a dropdown selection: a multi-select Combobox stays open after a
   * pick, so the next coachmark rendered straight over the option list the user was still
   * working in. Waiting costs nothing — the popover is dismissed by the same click-outside that
   * means "I'm done here".
   */
  deferWhileDropdownOpen?: boolean;
  /** Illustration rendered above the title inside the popover (public/ path). */
  imageSrc?: string;
  /** Keep short supporting copy on one line when the viewport has room for the full card. */
  singleLineDescription?: boolean;
  title: string;
  description: string;
  /**
   * Draws the rounded brand outline (see `.dalgo-tour-ring` in tour.css) around the target.
   *
   * Set it ONLY where the target is a major action the user is being told to take — a CTA
   * button (Save, Publish, Create KPI, Edit workflow, Next) or a sidebar nav item. Everything
   * else the coachmark merely points at — inputs, dropdowns, tabs, checkboxes, toggles, and
   * the whole-panel/whole-form targets — is left unringed: outlining a form field made every
   * field on the dialog look like the button to press.
   *
   * There is no dim overlay on any stage (both drivers run at overlayOpacity: 0), so this
   * outline plus the popover IS the highlight.
   */
  ring?: boolean;
  /**
   * Extra selectors that stay clickable on this stage, on top of the coached target.
   *
   * ONLY for a control the step cannot be completed without and that no stage coaches — a
   * required field, in practice. The exit guard holds every other click to the target (see
   * walkthrough-exit-guard.ts), so without this the user reaches a validation error they have no
   * way to fix and the walkthrough's only exit is Skip. Resolved per click, so a field that
   * mounts later still counts.
   */
  alsoClickable?: string[];
  /**
   * Leaves the whole page content area clickable on this stage, guarding only the app chrome
   * (sidebar, navbar) and the coachmark's own ✕.
   *
   * For the chart builder, where "the step" is genuinely the whole screen: picking a dataset,
   * switching Data / Raw / Preview tabs, every configuration and customisation control, the
   * chart's name. A chart is something the user has to shape to their own data, and no set of
   * stages can coach that field by field — pointing at one tab while blocking the panel under it
   * turns guidance into an obstacle.
   */
  allowPageRoam?: boolean;
  /**
   * Controls inside the page that stay guarded even under `allowPageRoam` — the ones that leave
   * the screen this stage lives on. The dashboard builder's Back button is the case: everything
   * else in the builder is the step (adding charts and KPIs, moving tiles, filters), and leaving
   * is the one thing worth asking about.
   */
  pageRoamExits?: string[];
  /**
   * Stands the exit guard down for this stage: the user can click anywhere, and only the ✕ still
   * raises the leave prompt.
   *
   * For a stage that asks for NOTHING — `sync_running`, where the copy is "leave it running,
   * we'll move you on when it finishes". That wait runs for minutes, so holding the app hostage
   * would be absurd; the walkthrough picks the user up again from wherever they are once the
   * sync lands (see tour-gate.tsx's sync detection). A stage that asks for an action never gets
   * this — the guard is what keeps the action the only thing on the table.
   */
  allowFreeRoam?: boolean;
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

/**
 * Required fields the walkthrough never points at, which therefore have to stay clickable while
 * their step is on screen — see StageConfig.alsoClickable.
 *
 * The KPI wizard's step 2 asks for a name (KpiSetupStep, `#kpi-name`) and the pipeline form
 * opens with one (pipeline-form.tsx, `[data-testid="name"]`). Both are `required` with an empty
 * default, so Continue / Create Pipeline simply fails validation until they're filled — and
 * every stage on those steps coaches a DIFFERENT control.
 *
 * The pipeline form's schedule adds two more: picking Daily or Weekly REVEALS Time of Day (and,
 * for Weekly, Days of the Week), both required and both rendered as siblings of the coached
 * `cron-container` rather than inside it. Choosing a frequency and then being unable to finish
 * setting it is the exact opposite of what that stage is asking for.
 */
/**
 * The dashboard builder's way out — see StageConfig.pageRoamExits. Both header layouts (compact
 * and full) render the same button, so one selector covers them.
 */
const DASHBOARD_BUILDER_EXITS = ['[data-testid="dashboard-back-btn"]'];

/**
 * The filter controls on a saved dashboard — see StageConfig.alsoClickable.
 *
 * The share stages ask for one thing (hit Share), but a dashboard the user has just built is
 * also the first place they try their filters, and that's the only other thing the page offers.
 * Two selectors because the panel switches layout with the viewport: a vertical sidebar on
 * desktop, an accordion above the grid on smaller screens.
 */
const DASHBOARD_VIEW_FILTERS = [
  '[data-testid="dashboard-filters-panel"]',
  '[data-testid="dashboard-filters-section"]',
];

const KPI_SETUP_REQUIRED_FIELDS = ['#kpi-name'];
const PIPELINE_FORM_REQUIRED_FIELDS = [
  '[data-testid="name"]',
  '[data-testid="cron-days-of-week-container"]',
  '[data-testid="cron-time-of-day-container"]',
];

// Stages driven purely by route change (no manual advanceTo call needed elsewhere) map here
// to the NEXT stage they unlock once that route is reached.
const ROUTE_ADVANCES: Partial<Record<WalkthroughStage, WalkthroughStage>> = {
  dashboard_nudge: 'dashboard_intro',
  // The nudge's whole job is getting the user onto /ingest — arriving there IS its
  // completion, same shape as the transform/orchestrate nudges below.
  pipeline_ingest_nudge: 'pipeline_ingest',
  chart_intro: 'chart_create',
  chart_create: 'chart_pick_table',
  // Selecting a type moves the guide to Continue. Reaching the configure route proves the
  // actual navigation happened and unlocks the configuration guidance.
  chart_continue: 'chart_data_config',
  chart_dashboard_nudge: 'dashboard_intro',
  pipeline_transform_intro: 'pipeline_workflow_intro',
  pipeline_workflow_intro: 'pipeline_pick_table',
  // Both publish stages fall through to Orchestrate on arrival: the commit box is the normal
  // path, pipeline_table_built the fallback for a user who published without ever landing on
  // that step (or dismissed the dialog and went to Orchestrate anyway). They skip the nudge on
  // purpose — a user already standing on /orchestrate doesn't need to be told to go there.
  pipeline_table_built: 'pipeline_orchestrate_intro',
  pipeline_publish_commit: 'pipeline_orchestrate_intro',
  // The nudge's whole job is getting the user onto /orchestrate, so arriving there IS its
  // completion — same shape as pipeline_transform_intro above.
  pipeline_orchestrate_nudge: 'pipeline_orchestrate_intro',
  pipeline_orchestrate_intro: 'pipeline_add_connection',
};

// Populated incrementally across the feature's tasks.
const STAGE_CONFIG: Partial<Record<WalkthroughStage, StageConfig>> = {
  kpi_intro: {
    ring: true,
    route: '/kpis',
    selector: '[data-testid="create-kpi-btn"]',
    title: 'Track your targets',
    description:
      'A key performance indicator uses your key metrics and shows the current value of your goals against a target, its trend over time, and status. Align this with your programs for an effective overview.',
  },
  kpi_metric: {
    route: '/kpis',
    nextOnInteraction: 'kpi_step1_continue',
    selector: '[data-testid="kpi-form-metric-field"]',
    title: 'Pick a metric',
    description:
      'The measure this KPI tracks, for example a count of beneficiaries. Choose any metric to get started.',
  },
  // Everything after this stage lives on the wizard's step 2, so this button is the gate that
  // puts those targets in the DOM at all — the walkthrough has to wait on it rather than
  // pointing at fields the user can't see yet.
  kpi_step1_continue: {
    ring: true,
    route: '/kpis',
    selector: '[data-testid="kpi-form-step1-continue-btn"]',
    title: 'Keep going',
    description: 'Click Continue to set this KPI’s target.',
  },
  kpi_target: {
    alsoClickable: KPI_SETUP_REQUIRED_FIELDS,
    route: '/kpis',
    nextOnInteraction: 'kpi_direction',
    advanceOn: 'value',
    selector: '[data-testid="kpi-form-target-field"]',
    title: 'Target value',
    description:
      'The number you are aiming for. Dalgo marks the KPI green once you reach it and red when you fall short.',
  },
  kpi_direction: {
    alsoClickable: KPI_SETUP_REQUIRED_FIELDS,
    route: '/kpis',
    nextOnInteraction: 'kpi_time_column',
    advanceOn: 'open',
    selector: '[data-testid="kpi-form-direction-field"]',
    title: 'Direction',
    description: 'Do you intend for the value of this indicator to rise or fall?',
  },
  kpi_continue: {
    alsoClickable: KPI_SETUP_REQUIRED_FIELDS,
    ring: true,
    route: '/kpis',
    selector: '[data-testid="kpi-form-continue-btn"]',
    title: 'Keep going',
    description: 'Click Continue to set the rest of the KPI details.',
  },
  kpi_time_column: {
    alsoClickable: KPI_SETUP_REQUIRED_FIELDS,
    route: '/kpis',
    nextOnInteraction: 'kpi_continue',
    selector: '[data-testid="kpi-form-time-column-field"]',
    title: 'Time column',
    description: 'Select the relevant column from the dataset to track the KPIs trend over time.',
  },
  kpi_type: {
    route: '/kpis',
    nextOnInteraction: 'kpi_submit',
    selector: '[data-testid="kpi-form-type-field"]',
    title: 'KPI type',
    description:
      'Classify the indicator based on your results framework. Is this a measure of your inputs, outputs, outcomes or impact?',
  },
  kpi_submit: {
    ring: true,
    route: '/kpis',
    selector: '[data-testid="kpi-form-submit-btn"]',
    title: 'Create your KPI',
    description: 'Click Create KPI to save it.',
  },
  dashboard_nudge: {
    ring: true,
    route: '/kpis',
    selector: 'a[href="/dashboards"]',
    imageSrc: DASHBOARD_NUDGE_IMAGE,
    // "Your KPI is live" moved to the celebration dialog that opens right before this
    // (kpi-live-modal.tsx) — repeating it here read as the same message twice.
    title: 'Build your first dashboard',
    description: 'Now add your KPI and a few charts to a dashboard and share it!',
  },
  dashboard_intro: {
    ring: true,
    route: '/dashboards',
    selector: '#dashboard-create-button',
    title: 'Create a dashboard',
    description:
      'Build a unified view of all the insights that are important to you. Add KPIs, charts, text, and filters.',
  },
  builder_add_kpi: {
    // The builder IS the step: charts, KPIs, tile moves, filters — see allowPageRoam.
    allowPageRoam: true,
    pageRoamExits: DASHBOARD_BUILDER_EXITS,
    ring: true,
    route: '/dashboards/create',
    routeMatch: DASHBOARD_BUILDER_ROUTE,
    selector: '[data-testid="add-kpi-btn"]',
    title: 'Add your KPI',
    description: 'Click Add KPI and pick the KPI you just built to add it to the dashboard',
    side: 'bottom',
  },
  builder_add_chart: {
    // The builder IS the step: charts, KPIs, tile moves, filters — see allowPageRoam.
    allowPageRoam: true,
    pageRoamExits: DASHBOARD_BUILDER_EXITS,
    ring: true,
    route: '/dashboards/create',
    routeMatch: DASHBOARD_BUILDER_ROUTE,
    selector: '[data-testid="add-chart-btn"]',
    title: 'Add a Chart',
    description: 'Add a sample chart to your dashboard',
    side: 'bottom',
  },
  builder_resize: {
    // The builder IS the step: charts, KPIs, tile moves, filters — see allowPageRoam.
    allowPageRoam: true,
    pageRoamExits: DASHBOARD_BUILDER_EXITS,
    route: '/dashboards/create',
    routeMatch: DASHBOARD_BUILDER_ROUTE,
    // Newest tile has no stable id to key a static selector on (grid items are created with
    // `chart-${Date.now()}`) — react-grid-layout always appends new widgets last in DOM order
    // (grid model: new items land at bottomY, nothing else reorders), so the last `.react-grid-item`
    // is reliably the one just added.
    selector: '.react-grid-item:last-of-type',
    title: 'Resize and move your tiles',
    description:
      'Drag a corner to resize, or grab a tile to move it around — now make your dashboard look nice.',
  },
  builder_save: {
    // The builder IS the step: charts, KPIs, tile moves, filters — see allowPageRoam.
    allowPageRoam: true,
    pageRoamExits: DASHBOARD_BUILDER_EXITS,
    ring: true,
    route: '/dashboards/create',
    routeMatch: DASHBOARD_BUILDER_ROUTE,
    selector: '[data-testid="dashboard-save-btn"]',
    title: 'Save your dashboard',
    description: 'Once you’re ready, save your dashboard so you can share it',
    side: 'bottom',
  },
  builder_preview: {
    // The builder IS the step: charts, KPIs, tile moves, filters — see allowPageRoam.
    allowPageRoam: true,
    pageRoamExits: DASHBOARD_BUILDER_EXITS,
    ring: true,
    route: '/dashboards/create',
    routeMatch: DASHBOARD_BUILDER_ROUTE,
    selector: '[data-testid="dashboard-preview-btn"]',
    title: 'Preview it first',
    description: 'See what your team will see.',
    singleLineDescription: true,
    side: 'bottom',
  },
  share: {
    alsoClickable: DASHBOARD_VIEW_FILTERS,
    ring: true,
    route: null, // resolved dynamically to /dashboards/{id} — matched by pathname regex below
    selector: '[data-testid="dashboard-share-btn"]',
    title: 'Share your dashboard',
    description: 'Hit share to show your team what you’ve built!',
    // The Share icon sits in the top-right toolbar: a 'right' popover runs off the viewport,
    // so it hangs below, right-aligned to keep it on screen.
    side: 'bottom',
    align: 'end',
  },
  share_public_toggle: {
    alsoClickable: DASHBOARD_VIEW_FILTERS,
    route: null, // same dynamic /dashboards/{id} as 'share'
    selector: '[data-testid="share-toggle"]',
    title: 'Turn on public access',
    description:
      'Flip this on to create a shareable link — anyone you send it to can open the dashboard, no login needed.',
    // Beside the dialog rather than inside it: the switch sits at the dialog's right edge, so
    // a 'right' popover clears the dialog entirely instead of covering the copy explaining
    // what the switch does.
    side: 'right',
    align: 'start',
  },
  share_copy_link: {
    alsoClickable: DASHBOARD_VIEW_FILTERS,
    ring: true,
    route: null, // same dynamic /dashboards/{id} as 'share'
    selector: '[data-testid="copy-link-btn"]',
    title: 'Grab the link',
    description: 'Copy it and drop it to your team — anyone with this link can open the dashboard.',
  },
  // The own-data fork's opening pair. This used to be a silent stage on the theory that the
  // ingest wizard explains itself — but the fork2 dialog closes, the route changes to /ingest
  // and nothing points anywhere, which read as the walkthrough never starting. Same two
  // targets (and same copy) as the automate-pipeline fork's pipeline_ingest pair below.
  own_data_ingest: {
    ring: true,
    route: '/ingest',
    selector: '[data-testid="new-source-btn"]',
    title: 'Connect your data',
    description: 'Add your own source here — we’ll start you off with a Google Sheet.',
  },
  own_data_pick_source: PICK_SOURCE_STAGE,
  own_data_source_next: SOURCE_NEXT_STAGE,
  // --- Waiting on the tracked connection's first sync. Shared by both real-data forks; only
  // tour-gate's checkpoint moves the user in and out of these. ---
  sync_running: {
    // The one stage that asks for nothing: it's a wait, not a step. See allowFreeRoam.
    allowFreeRoam: true,
    // Route-less on purpose: the stage stays live while the user wanders, it just doesn't
    // DRAW anywhere except /ingest (see below).
    route: null,
    // /ingest ONLY, pinned to the syncing connection's own sync button.
    //
    // Two deliberate choices here:
    //
    // 1. The button, not the row. A row-wide target parks the popover in the middle of the
    //    connection, pointing at nothing in particular; the spinner in the Actions cell is the
    //    thing that is actually "syncing", so that is what gets spotlighted.
    //
    // 2. Returning null off /ingest, which skips the stage rather than retargeting it. This
    //    used to fall back to the Ingest nav item so something was on screen for the whole
    //    multi-minute sync — but following the user onto every page reads as nagging, and the
    //    stage has nothing to ask of them. They are free to explore; sync completion moves
    //    them on from wherever they are (chart_intro / the transform hand-off are both
    //    route-less), so nothing is lost by going quiet. The stage redraws if they come back
    //    to /ingest — the effect re-runs on `pathname`.
    //
    // The connection id comes from the store: nothing else on the page identifies WHICH
    // connection this is about. Both button states are matched because the Actions cell swaps
    // between them — `sync-btn-*` while running or idle, `cancel-sync-*` while queued — and
    // only ever renders one, so the first match is the right one.
    selector: () => {
      const id = useInsightWalkthroughStore.getState().trackedConnectionId;
      if (!id || window.location.pathname !== '/ingest') return null;
      return `[data-testid="sync-btn-${id}"], [data-testid="cancel-sync-${id}"]`;
    },
    // No `ring`: nothing to click. The user is being told to wait, not to act.
    title: 'Your data is syncing',
    description:
      'This can take a few minutes for a first sync. Leave it running — we’ll move you to the next step as soon as it finishes, even if you come back later.',
    side: 'bottom',
    // End-aligned: the sync button sits at the right edge of a full-width table, so a
    // start-aligned popover would open off the side of the viewport.
    align: 'end',
  },
  sync_failed: {
    ring: true,
    route: null, // sidebar item — the failure matters wherever the user happens to be
    selector: 'a[href="/ingest"]',
    title: 'That sync didn’t finish',
    description:
      'Open Ingest and run the sync again, or connect a different source — we’ll pick things up as soon as one succeeds.',
    // "I've read this", not "I've done it" — records this run as acknowledged and hands them
    // back to their fork's ingest stage, which is silent while a tracked connection exists.
    onDismiss: () => useInsightWalkthroughStore.getState().dismissSyncFailure(),
  },
  // --- The chart -> dashboard -> share tail, run by own_data AND automate_pipeline ---
  chart_intro: {
    ring: true,
    route: null, // shown wherever the user is when the tracked connection's sync is detected
    selector: 'a[href="/charts"]',
    imageSrc: DASHBOARD_NUDGE_IMAGE,
    title: 'Create your first chart',
    description: 'Your data is in, lets visualise it in your first chart.',
  },
  chart_create: {
    ring: true,
    route: '/charts',
    selector: '[data-testid="charts-create-btn"]',
    title: 'Build chart',
    description: 'Visualise your data to deliver insights effectively for your team.',
  },
  chart_pick_table: {
    // The chart builder is shaped by the user, not by us — see allowPageRoam.
    allowPageRoam: true,
    route: '/charts/new',
    selector: '[data-testid="chart-dataset-selector"]',
    title: 'Select the relevant data table.',
    description: 'Look for and select the name of the table you connected.',
    // No nextOnInteraction: the advance comes from the real dataset selection (see
    // app/charts/new/page.tsx). A click listener here fired when the dropdown was merely
    // OPENED, jumping to the chart-type coachmark over a still-open dataset list.
  },
  chart_pick_type: {
    // The chart builder is shaped by the user, not by us — see allowPageRoam.
    allowPageRoam: true,
    route: '/charts/new',
    selector: '[data-testid="chart-type-grid"]',
    title: 'Select the relevant type',
    description: 'Pick the type of visualisation you wish to build. Try a bar chart to start',
  },
  chart_continue: {
    // The chart builder is shaped by the user, not by us — see allowPageRoam.
    allowPageRoam: true,
    ring: true,
    route: '/charts/new',
    selector: '[data-testid="chart-type-continue-button"]',
    title: 'Continue to configure your chart',
    description: 'Your chart type is selected. Click Continue to set up the data and styling.',
    side: 'top',
  },
  chart_data_config: {
    // The chart builder is shaped by the user, not by us — see allowPageRoam.
    allowPageRoam: true,
    route: '/charts/new/configure',
    nextOnInteraction: 'chart_styling',
    selector: '[data-testid="chart-data-config-tab"]',
    // The Data Configuration tab is the one already open, so a click on it isn't coming —
    // switching to the other tab is. See StageConfig.interactionSelector.
    interactionSelector: '[data-testid="chart-config-tabs"]',
    title: 'Data Configuration',
    description: 'Configure the relevant fields to create your charts.',
    showNext: true,
    side: 'bottom',
    align: 'start',
  },
  chart_styling: {
    // The chart builder is shaped by the user, not by us — see allowPageRoam.
    allowPageRoam: true,
    route: '/charts/new/configure',
    nextOnInteraction: 'chart_save',
    selector: '[data-testid="chart-styling-tab"]',
    title: 'Chart Styling',
    description: 'Use the chartstyling tab to make finer changes to way the data is represented.',
    showNext: true,
    side: 'bottom',
    align: 'center',
  },
  chart_save: {
    // The chart builder is shaped by the user, not by us — see allowPageRoam.
    allowPageRoam: true,
    ring: true,
    route: '/charts/new/configure',
    selector: '[data-testid="chart-edit-save-button"]',
    title: 'Once you’re ready, hit save.',
    description:
      'Save your chart to make it accessible to your team and available to add to a dashboard',
    side: 'bottom',
  },
  chart_dashboard_nudge: {
    ring: true,
    // Not pinned to /charts: saving lands the user on the new chart's own page
    // (/charts/{id}), and the Dashboards nav item this points at is in the sidebar on every
    // app route anyway.
    route: null,
    selector: 'a[href="/dashboards"]',
    imageSrc: DASHBOARD_NUDGE_IMAGE,
    title: 'Build your first dashboard',
    description: 'Now add your KPI and a few charts to a dashboard and share it!',
  },
  builder_add_chart_first: {
    // The builder IS the step: charts, KPIs, tile moves, filters — see allowPageRoam.
    allowPageRoam: true,
    pageRoamExits: DASHBOARD_BUILDER_EXITS,
    ring: true,
    route: '/dashboards/create',
    routeMatch: DASHBOARD_BUILDER_ROUTE,
    selector: '[data-testid="add-chart-btn"]',
    title: 'Add a Chart',
    description: 'Click Add chart and pick the chart you just built to add it to the dashboard',
    side: 'bottom',
  },
  builder_add_kpi_second: {
    // The builder IS the step: charts, KPIs, tile moves, filters — see allowPageRoam.
    allowPageRoam: true,
    pageRoamExits: DASHBOARD_BUILDER_EXITS,
    ring: true,
    route: '/dashboards/create',
    routeMatch: DASHBOARD_BUILDER_ROUTE,
    selector: '[data-testid="add-kpi-btn"]',
    title: 'Add sample KPIs',
    // Own-data tail, so there is no KPI the user built earlier — the design points at the
    // sample KPIs instead. Deliberately different from builder_add_kpi (sample fork), which
    // does follow a KPI the user made.
    description:
      'Add key performance indicators to headline your dashboard. Use a sample one for now to see how they look!',
    side: 'bottom',
  },
  // The automate-pipeline fork's opening beat: point at Ingest and let the user click it,
  // rather than pushing them onto /ingest the instant they pick the flow. Same illustrated
  // sidebar card as pipeline_transform_intro and pipeline_orchestrate_nudge, which do the
  // identical job for this fork's two later legs.
  pipeline_ingest_nudge: {
    ring: true,
    route: null, // sidebar item — on screen wherever the user picked the flow from
    selector: 'a[href="/ingest"]',
    imageSrc: DASHBOARD_NUDGE_IMAGE,
    title: 'Start with your data',
    description:
      'Head to the ingest section to connect the source your pipeline will pull from on every run.',
  },
  // The automate-pipeline fork's ingest pair — the own-data twin of these lives above.
  pipeline_ingest: {
    ring: true,
    route: '/ingest',
    selector: '[data-testid="new-source-btn"]',
    title: 'Connect your data',
    description: 'Add a real source here — once it syncs, we’ll walk you through the rest.',
  },
  pipeline_pick_source: PICK_SOURCE_STAGE,
  pipeline_source_next: SOURCE_NEXT_STAGE,
  pipeline_transform_intro: {
    ring: true,
    route: null, // shown wherever the user is when the tracked connection's sync is detected
    selector: 'a[href="/transform"]',
    // Same illustrated card treatment as the build-insights dashboard nudge: this is the
    // "one leg done, here's the next" beat of the automate-pipeline flow.
    imageSrc: DASHBOARD_NUDGE_IMAGE,
    title: 'Your data’s in — now shape it',
    description:
      'Head to the transform section to clean and convert your raw tables into chart-ready data.',
  },
  pipeline_workflow_intro: {
    ring: true,
    route: '/transform',
    selector: '[data-testid="edit-workflow-btn"]',
    title: 'Open the workflow editor',
    description:
      'This is where you shape your raw tables. Click Edit workflow and we’ll walk you through just two steps.',
    // Button sits at the top-right of the workflow card, so a 'right' popover would be clamped
    // against the viewport edge — there's always open card below it.
    side: 'bottom',
    align: 'end',
  },
  pipeline_pick_table: {
    route: '/transform/canvas',
    // Whole tree panel (not just one table's + button): react-arborist virtualizes
    // rows, so a single row's rect can be unreliable right as it mounts. The panel
    // itself (search bar at the top) is always present and stable to measure, and
    // keeping it as the highlighted element means every + button inside stays
    // clickable (driver.js's overlay only lets clicks through its highlighted area).
    selector: '[data-testid="project-tree-panel"]',
    title: 'Select your desired table',
    description:
      'This left pane represents all the data in your warehouse. Find the table you just connected to Dalgo by searching for its name, then click the + icon. (For a Google Sheet, search the name of the tab, not the name of the sheet.)',
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
  },
  pipeline_pick_function: {
    ring: true,
    route: '/transform/canvas',
    // The Drop row itself, not the whole Functions panel: the copy names exactly one
    // function, and spotlighting the entire list left the user hunting for it — worse on a
    // short viewport, where Drop sits below the fold of the panel's own scroll area. driver.js
    // scrolls a highlighted element into view (ancestor scroll containers included), so
    // pointing at the row is also what makes this work at any screen height.
    // Clicks elsewhere in the panel still land: every coachmark stage runs passthrough
    // (see PASSTHROUGH_CLASS), so highlighting one row doesn't gate the rest.
    selector: '[data-testid="operation-dropcolumns"]',
    title: 'Let’s start with a simple function',
    description: 'Select the Drop function to remove columns that you don’t need.',
    // Every stage below lives in the canvas's right-hand panel, which is flush with the
    // viewport's right edge — a 'right' popover has nowhere to go and gets clamped over the
    // panel it's pointing at. The canvas to their left is always open space.
    side: 'left',
    align: 'center',
  },
  pipeline_drop_columns: {
    route: '/transform/canvas',
    // The form's search bar, which is sticky at the top of the panel (see DropColumnOpForm) —
    // NOT the whole form. Anchored to the form, the popover was centred on a target whose
    // height is the entire column list, so it drifted off screen the moment the user scrolled
    // down to find a column. Pinned to the search bar it stays put while the list scrolls
    // under it.
    selector: '[data-testid="drop-search"]',
    title: 'Drop the clutter',
    description: 'Tick the fields you do not report on, then hit Save.',
    side: 'left',
    align: 'center',
  },
  pipeline_save_table: {
    ring: true,
    route: '/transform/canvas',
    selector: '[data-testid="create-table-btn"]',
    title: 'Create a table',
    description:
      'Save this new cleaned data to your warehouse so that you can build insights with it.',
    side: 'left',
    align: 'center',
  },
  pipeline_name_table: {
    route: '/transform/canvas',
    // The Output Name input, not the whole form: schema and folder are already pre-filled
    // (intermediate / root), so the name is the only thing to fill in, and a popover centred
    // on the full form landed level with whichever field happened to be in the middle —
    // "random position", pointing at nothing the copy mentions. Advances once that name has
    // actually been typed, which is what makes Save meaningful.
    selector: '[data-testid="output-name-input"]',
    nextOnInteraction: 'pipeline_save_new_table',
    advanceOn: 'value',
    title: 'Name your table',
    description:
      'We have pre-filled the intermediate schema. Give it a clear name — like customer_summary.',
    side: 'left',
    align: 'start',
  },
  pipeline_save_new_table: {
    ring: true,
    route: '/transform/canvas',
    selector: '[data-testid="save-table-btn"]',
    title: 'Save table',
    description:
      'Hit Save to build your first table. You can then string a few more functions together to build your desired final table, or go straight ahead and publish.',
    side: 'left',
    align: 'center',
  },
  pipeline_table_built: {
    ring: true,
    route: '/transform/canvas',
    selector: '[data-testid="publish-button"]',
    title: 'Publish your changes',
    description:
      'Once your table is successfully created, click Publish to make sure it’s saved and reusable in your pipeline.',
    // Toolbar button at the top-right of the canvas — same clamping problem as Edit workflow.
    side: 'bottom',
    align: 'end',
  },
  pipeline_publish_commit: {
    route: '/transform/canvas',
    selector: '[data-testid="commit-message-input"]',
    title: 'Enter a commit message',
    description:
      'Describe what you did and why, to maintain a record of changes and build context for collaborators.',
    // No `ring`: a free-text input, not a CTA. Same call as the KPI form's field stages.
    side: 'right',
    align: 'center',
  },
  pipeline_orchestrate_nudge: {
    ring: true,
    route: null, // sidebar item — on screen wherever the publish happened to land the user
    selector: 'a[href="/orchestrate"]',
    // Illustrated card, matching pipeline_transform_intro: both are "one leg done, here's the
    // next" beats rather than in-page instructions.
    imageSrc: DASHBOARD_NUDGE_IMAGE,
    title: 'Create a data pipeline',
    description: 'Setup a scheduled run of your data connection and transformation',
  },
  pipeline_orchestrate_intro: {
    ring: true,
    route: '/orchestrate',
    selector: '[data-testid="create-pipeline-btn"]',
    title: 'Make it repeatable',
    description: 'Click here to configure your first data pipeline with Dalgo',
  },
  pipeline_add_connection: {
    alsoClickable: PIPELINE_FORM_REQUIRED_FIELDS,
    route: '/orchestrate/create',
    selector: '[data-testid="connections-container"]',
    title: 'Add a connection',
    description:
      'Pick the data that you connected in the ingest step to refresh it on a regular schedule.',
  },
  pipeline_run_transform: {
    alsoClickable: PIPELINE_FORM_REQUIRED_FIELDS,
    route: '/orchestrate/create',
    selector: '[data-testid="run-transform-tasks-checkbox"]',
    title: 'Run all the tasks',
    description:
      'Select "Run transform tasks" to ensure your desired final tables for charting are built out with the latest connected data.',
    // The connections combobox is multi-select, so it STAYS OPEN after a pick — and the pick
    // is exactly what advances to this stage. Without the wait, this coachmark rendered on top
    // of the still-open option list, covering the very rows the user was choosing from.
    deferWhileDropdownOpen: true,
    // Below the checkbox, not beside it: 'right' put the popover over the checkbox's own label,
    // so "Run transform tasks" — the thing the copy tells you to tick — was unreadable.
    side: 'bottom',
    align: 'start',
  },
  pipeline_set_schedule: {
    alsoClickable: PIPELINE_FORM_REQUIRED_FIELDS,
    route: '/orchestrate/create',
    selector: '[data-testid="cron-container"]',
    title: 'Set a schedule',
    description:
      'Choose Daily or Weekly so this pipeline runs automatically based on your program needs.',
    // Frequency sits in the right-hand column, flush with the page edge — 'right' clamps.
    side: 'left',
    align: 'start',
  },
  pipeline_create_it: {
    alsoClickable: PIPELINE_FORM_REQUIRED_FIELDS,
    ring: true,
    route: '/orchestrate/create',
    selector: '[data-testid="submit-btn"]',
    title: 'Create it',
    description:
      'Once you’ve added a connection or transform task and set a schedule, click Create Pipeline to save it.',
  },
};

/**
 * Which route each stage's coachmark lives on — derived from STAGE_CONFIG so the two can't
 * drift. Used by the Get Started widget to send a returning user (who left mid-flow) to the
 * page their stored stage is anchored to, so the coachmark picks up exactly where they left
 * off. Stages with a dynamic route (`share`) or no route at all are simply absent.
 */
export const WALKTHROUGH_STAGE_ROUTES: Partial<Record<WalkthroughStage, string>> =
  Object.fromEntries(
    Object.entries(STAGE_CONFIG)
      .filter(([, config]) => config.route)
      .map(([stage, config]) => [stage, config.route])
  );

export function InsightWalkthroughCoachmark() {
  const pathname = usePathname();
  const active = useInsightWalkthroughStore((s) => s.active);
  const stage = useInsightWalkthroughStore((s) => s.stage);
  const suppressCoachmark = useInsightWalkthroughStore((s) => s.suppressCoachmark);
  const trackedConnectionId = useInsightWalkthroughStore((s) => s.trackedConnectionId);
  const driverRef = useRef<Driver | null>(null);
  const trackingFrameRef = useRef<number>(0);
  // The element currently wearing RING_CLASS. Held in a ref rather than re-queried on
  // teardown because a stage's target can be resolved dynamically (pipeline_select_node) or
  // re-resolved mid-stage by the trackTarget -> show() recovery loop — the selector alone
  // isn't guaranteed to still find the same node we ringed.
  const ringedElRef = useRef<HTMLElement | null>(null);

  // driver.js rebuilds the popover DOM on every highlight, so this is captured in
  // onPopoverRender rather than looked up — the tracking loop needs it to keep the pointer
  // triangle attached to the right edge (see ensurePopoverArrow).
  const popoverRef = useRef<PopoverDOM | null>(null);

  // The "Leave the walkthrough?" prompt, and the three things the exit guard needs to decide
  // whether a click belongs to the live stage (see walkthrough-exit-guard.ts). All refs: the
  // guard reads them from a native listener, and a stage's target can be re-resolved mid-stage
  // by the trackTarget -> show() recovery loop.
  const [leavePromptOpen, setLeavePromptOpen] = useState(false);
  /** True only while a coachmark is actually painted — not merely while the store is active. */
  const coachmarkLiveRef = useRef(false);
  const guardTargetRef = useRef<Element | null>(null);
  const guardInteractionRef = useRef<Element | null>(null);
  /** The live stage's `alsoClickable` selectors — see StageConfig. */
  const guardExtraSelectorsRef = useRef<string[]>([]);
  /** The live stage's `allowFreeRoam` — see StageConfig. */
  const guardFreeRoamRef = useRef(false);
  /** The live stage's `allowPageRoam` — see StageConfig. */
  const guardPageRoamRef = useRef(false);
  /** The live stage's `pageRoamExits` — see StageConfig. */
  const guardExitSelectorsRef = useRef<string[]>([]);

  // Keeps a highlight glued to its target while layout is still moving under it —
  // a sidebar collapsing, a canvas pan/zoom settling, dagre re-laying nodes out —
  // none of which fire the window 'resize' event driver.js listens for on its own.
  //
  // It also keeps the coachmark ALIVE. Two things used to kill it for good: the target
  // leaving the DOM (click outside the KPI dialog, Radix closes it, every target inside goes
  // with it) and driver.js's own close paths (Escape). Either way the flow looked broken —
  // the effect below only re-runs on stage/route changes, so reopening the dialog brought
  // nothing back. Now both cases just call `onLost`, which re-waits for the selector and
  // shows the same stage again. Skip is still the one way out: it flips `active`, and the
  // caller's guard stands the watcher down.
  const trackTarget = useCallback((d: Driver, baseEl: Element, onLost: () => void) => {
    const tick = () => {
      if (!document.body.contains(baseEl) || !d.isActive()) {
        d.destroy();
        onLost();
        return;
      }
      d.refresh();
      // After the refresh, since that's what re-runs driver.js's own arrow placement (and can
      // drop it to `arrow-none` when the card no longer fits on any side).
      ensurePopoverArrow(popoverRef.current, baseEl);
      trackingFrameRef.current = requestAnimationFrame(tick);
    };
    trackingFrameRef.current = requestAnimationFrame(tick);
  }, []);

  // Single-highlight stages: generic highlight+skip against STAGE_CONFIG, keyed by
  // route+selector.
  useEffect(() => {
    let cancelled = false;
    let detachEngagement: (() => void) | null = null;
    // The four ingest stages only make sense before the user has actually created a
    // connection — once trackedConnectionId is set they're mid-sync (possibly for minutes),
    // and re-showing "add a source" / "pick Google Sheets" would be actively misleading.
    // Go fully silent until the sync-detection effect in tour-gate.tsx advances the stage.
    const isWaitingOnTrackedConnection =
      !!trackedConnectionId && stage !== null && INGEST_STAGES.includes(stage);
    const config =
      // 'fork2' is the sample/own-data dialog (get-started-modal.tsx, rendered by
      // tour-gate.tsx), not a coachmark — it has no STAGE_CONFIG entry.
      active && stage && stage !== 'fork2' && !suppressCoachmark && !isWaitingOnTrackedConnection
        ? STAGE_CONFIG[stage]
        : undefined;

    if (config) {
      // Set before the first await, not inside show(): between one stage's cleanup and the
      // next stage's highlight there would otherwise be a window with the class off, and
      // driver.js's `.driver-active * { pointer-events: none }` eats any click landing in it.
      document.body.classList.add(PASSTHROUGH_CLASS);

      // A hint stage is done once the user acts on ITS OWN field — see `advanceOn`. Nothing
      // else moves it: clicking elsewhere on the page, dismissing nothing, or simply reading
      // leaves the coachmark exactly where it is. advanceIfBefore keeps this one-way: a late
      // event can't drag an already-progressed walkthrough backwards.
      // Deferred a macrotask on purpose. Advancing tears this stage's coachmark down and
      // builds the next one, which re-runs driver.js's pointer-events juggling — do that
      // while the user's click is still in flight and the click never reaches the control
      // they clicked (a KPI Type button would highlight, advance, and select nothing).
      // Letting the event finish first means the app's own handler wins.
      const advancePastHint = () => {
        if (!config.nextOnInteraction) return;
        setTimeout(() => {
          if (cancelled) return;
          useInsightWalkthroughStore.getState().advanceIfBefore(config.nextOnInteraction!);
        }, 0);
      };

      const listenForEngagement = (el: Element): (() => void) => {
        if (!config.nextOnInteraction) return () => {};

        if (config.advanceOn === 'value') {
          const input = (
            el.matches('input, textarea') ? el : el.querySelector('input, textarea')
          ) as HTMLInputElement | HTMLTextAreaElement | null;
          // No input to watch (markup changed under us) — fall through to the click rule
          // rather than leaving the stage with no way to advance at all.
          if (input) {
            let idleTimer = 0;
            const commit = () => {
              if (input.value.trim() !== '') advancePastHint();
            };
            const onInput = () => {
              window.clearTimeout(idleTimer);
              idleTimer = window.setTimeout(commit, VALUE_IDLE_MS);
            };
            // Leaving the field is the user saying they're done with it — no need to wait
            // out the idle timer as well.
            const onBlur = () => {
              window.clearTimeout(idleTimer);
              commit();
            };
            input.addEventListener('input', onInput);
            input.addEventListener('blur', onBlur);
            return () => {
              window.clearTimeout(idleTimer);
              input.removeEventListener('input', onInput);
              input.removeEventListener('blur', onBlur);
            };
          }
        }

        const engagementEvent = config.advanceOn === 'open' ? 'pointerdown' : 'click';
        const onTargetClick = () => advancePastHint();
        el.addEventListener(engagementEvent, onTargetClick);
        return () => el.removeEventListener(engagementEvent, onTargetClick);
      };

      /** Re-entrant: also the recovery path when a target disappears mid-stage. */
      const show = async (): Promise<void> => {
        if (config.route && !matchesStageRoute(config, window.location.pathname)) return;
        if (
          (stage === 'share' || stage === 'share_public_toggle' || stage === 'share_copy_link') &&
          !/^\/dashboards\/\d+$/.test(window.location.pathname)
        ) {
          return;
        }
        const resolvedSelector =
          typeof config.selector === 'function' ? config.selector() : config.selector;
        if (!resolvedSelector) return;
        // Before the wait, not after: for a target inside the Data submenu the link doesn't
        // exist in the DOM until this opens the menu, so waiting first would time out.
        revealSidebarTarget(resolvedSelector);
        const el = await waitForElement(
          resolvedSelector,
          config.nextOnInteraction ? HINT_TARGET_TIMEOUT_MS : undefined
        );
        if (cancelled) return;
        if (!el) {
          if (!config.nextOnInteraction) return;
          // A hint whose field never appeared while its dialog IS open: the field is
          // conditional and this metric doesn't have it (Direction hands off to Time Column,
          // which only renders for a metric with a date column). Hop to the next hint.
          if (document.querySelector('[role="dialog"]')) {
            advancePastHint();
            return;
          }
          // No dialog at all — the user closed it (Cancel, Escape, a click on the backdrop).
          // Walking FORWARD through hints whose fields are all equally gone would march the
          // walkthrough to its last stage and strand it. Rewind to the stage that reopens the
          // dialog instead, so the coachmark is waiting for them when they come back.
          const anchor = getResumeAnchorStage(stage!);
          if (anchor !== stage) useInsightWalkthroughStore.getState().advanceTo(anchor);
          return;
        }
        // Done AFTER the target is resolved but BEFORE anything is drawn, so the wait is on
        // rendering rather than on finding what to render.
        if (config.deferWhileDropdownOpen) {
          await waitForDropdownsClosed();
          if (cancelled) return;
        }
        // The store can have moved on (or been skipped) during that wait — re-showing a stage
        // the user has already left would yank them backwards.
        const live = useInsightWalkthroughStore.getState();
        if (!live.active || live.stage !== stage || live.suppressCoachmark) return;

        const d = driver({
          popoverClass: 'dalgo-tour dalgo-tour-coach',
          overlayColor: '#000000',
          // No dim, ever: the highlight is the rounded ring on the target (see RING_CLASS)
          // plus the popover. driver.js still needs an overlay element for its own
          // positioning/refresh machinery, so it stays — fully transparent and, via
          // PASSTHROUGH_CLASS, click-through (see tour.css).
          overlayOpacity: 0,
          stagePadding: 6,
          stageRadius: 10,
          // The ✕ is the ONLY exit. `allowClose` gates driver.js's own dismissals — Escape and
          // overlay click — not our close button, which runs through `onCloseClick` below and
          // still works with this false. Leaving it on meant a stray click on the dimmed page
          // tore the coachmark down.
          allowClose: false,
          onPopoverRender: (popover) => {
            popoverRef.current = popover;
            outlinePopoverArrow(popover);
            if (config.imageSrc) {
              // driver.js builds the popover DOM itself, so the illustration is injected
              // rather than passed as config — same approach the old fork2 popover used.
              popover.title.insertAdjacentHTML(
                'beforebegin',
                `<img src="${config.imageSrc}" alt="" class="dalgo-tour-stage-image" />`
              );
            }
            if (config.singleLineDescription) {
              popover.description.classList.add('dalgo-tour-description-one-line');
            }
            // Top-right ✕ on every coachmark (same affordance as ProductTour) rather than a
            // worded "Skip"/"Later" link — it ends the whole walkthrough, not just this stage
            // (see onCloseClick).
            if (config.showNext || config.onDismiss)
              popover.nextButton.classList.add('dalgo-tour-next-btn');
            popover.closeButton.textContent = '✕';
            popover.closeButton.setAttribute('aria-label', 'Skip walkthrough');
            popover.closeButton.setAttribute('data-testid', 'walkthrough-skip-btn');
            popover.closeButton.classList.add('dalgo-tour-close-btn');
            alignPopoverCloseWithHeader(popover, 'coachmark');
          },
          onCloseClick: () => {
            // Asks rather than skipping outright — the confirmed answer runs skipWalkthrough()
            // below, which is what this used to do inline. Deferred a tick because this runs
            // from driver.js's own native click handler: mounting the Dialog synchronously
            // would let Radix read the still-bubbling click as an outside click and close the
            // prompt before it's ever seen.
            setTimeout(() => setLeavePromptOpen(true), 0);
          },
          onDestroyed: () => {
            driverRef.current = null;
            popoverRef.current = null;
            // No coachmark on screen means nothing to keep the user on: the guard stands down
            // until the next stage paints. Covers the recovery loop's teardown (a target that
            // left the DOM) as well as a confirmed skip.
            coachmarkLiveRef.current = false;
            guardTargetRef.current = null;
            guardInteractionRef.current = null;
            // Back to the stricter default — a stale `true` would leave the guard disarmed for
            // whatever stage comes next.
            guardFreeRoamRef.current = false;
            guardPageRoamRef.current = false;
            guardExitSelectorsRef.current = [];
          },
        });
        driverRef.current = d;
        const onDismiss = config.showNext ? null : (config.onDismiss ?? null);
        const popover: Popover = {
          title: config.title,
          description: config.description,
          side: config.side ?? 'right',
          align: config.align ?? 'start',
          // Must be set HERE, per popover — NOT as a driver() config option. `driver.highlight()`
          // (as opposed to the stepped `drive()` API ProductTour uses) injects its own
          // `showButtons: []` default into the step it builds, and that empty array beats the
          // instance-level config, so driver.js renders the close button with an inline
          // `display: none`. That's why these coachmarks had no dismissal control at all.
          showButtons: config.showNext || onDismiss ? ['next', 'close'] : ['close'],
          ...(config.showNext && {
            nextBtnText: 'Got it',
            onNextClick: () => {
              useInsightWalkthroughStore.getState().advanceIfBefore(config.nextOnInteraction!);
            },
          }),
          ...(onDismiss && { nextBtnText: 'Got it', onNextClick: onDismiss }),
        };
        // Before the highlight, so driver.js measures the target where it will actually be
        // drawn. Covers the case driver.js's own scroll doesn't: a target hidden by an ANCESTOR
        // scroller (the sidebar nav's `overflow-y: auto`, a scrolling dialog body) rather than
        // by the window — the common shape at browser zoom, where the lower nav items fall
        // below the sidebar's fold.
        revealElementInScrollParents(el as HTMLElement);
        highlightKeepingFocus(d, el as HTMLElement, popover);
        // Immediately as well as in the tracking loop below, so the first painted frame already
        // has the triangle rather than showing an arrow-less card for one frame.
        ensurePopoverArrow(popoverRef.current, el);
        // Ring only the major targets (see StageConfig.ring). Cleared first because show() is
        // re-entrant — the recovery loop can land on a DIFFERENT node than the one ringed on
        // the previous pass, and leaving that one outlined would show two rings at once.
        ringedElRef.current?.classList.remove(RING_CLASS);
        ringedElRef.current = null;
        if (config.ring) {
          (el as HTMLElement).classList.add(RING_CLASS);
          ringedElRef.current = el as HTMLElement;
        }
        detachEngagement?.();
        // Falls back to the spotlighted element when no separate interaction target is
        // configured, and also when one is configured but isn't in the DOM — better to listen
        // on something than to leave the stage with no way forward.
        const interactionEl =
          (config.interactionSelector && document.querySelector(config.interactionSelector)) || el;
        detachEngagement = listenForEngagement(interactionEl);
        // The stage is now on screen: arm the exit guard against THIS stage's targets. Set
        // after the highlight so a click landing during the wait above is never judged against
        // a stale target.
        guardTargetRef.current = el;
        guardInteractionRef.current = interactionEl;
        guardExtraSelectorsRef.current = config.alsoClickable ?? [];
        guardFreeRoamRef.current = !!config.allowFreeRoam;
        guardPageRoamRef.current = !!config.allowPageRoam;
        guardExitSelectorsRef.current = config.pageRoamExits ?? [];
        coachmarkLiveRef.current = true;
        trackTarget(d, el, () => {
          detachEngagement?.();
          detachEngagement = null;
          if (cancelled) return;
          void show();
        });
      };

      void show();
    }

    return () => {
      cancelAnimationFrame(trackingFrameRef.current);
      cancelled = true;
      detachEngagement?.();
      coachmarkLiveRef.current = false;
      guardTargetRef.current = null;
      guardInteractionRef.current = null;
      guardFreeRoamRef.current = false;
      guardPageRoamRef.current = false;
      guardExitSelectorsRef.current = [];
      document.body.classList.remove(PASSTHROUGH_CLASS);
      ringedElRef.current?.classList.remove(RING_CLASS);
      ringedElRef.current = null;
      driverRef.current?.destroy();
    };
  }, [active, stage, pathname, suppressCoachmark, trackedConnectionId, trackTarget]);

  // Route-driven advances: reaching a mapped route auto-advances to the stage it unlocks.
  useEffect(() => {
    if (!active || !stage) return;
    const walkthrough = useInsightWalkthroughStore.getState();

    // dashboard_intro is shared by all 3 forks but unlocks a different next stage
    // depending which one the user took (own-data and automate-pipeline both add
    // chart-then-KPI, since a chart already exists by this point; sample adds
    // KPI-then-chart) — can't go through the flat ROUTE_ADVANCES map for this one.
    // Either URL counts as "the user started building": /dashboards/create only renders a
    // spinner before redirecting to the builder, and a slow create call (or a resumed session
    // landing straight on the builder) means that transient pathname can be missed entirely.
    if (
      stage === 'dashboard_intro' &&
      (pathname === '/dashboards/create' || DASHBOARD_BUILDER_ROUTE.test(pathname))
    ) {
      walkthrough.advanceTo(
        walkthrough.path === 'own_data' || walkthrough.path === 'automate_pipeline'
          ? 'builder_add_chart_first'
          : 'builder_add_kpi'
      );
      return;
    }

    const next = ROUTE_ADVANCES[stage];
    const nextConfig = next ? STAGE_CONFIG[next] : undefined;
    if (next && nextConfig?.route && matchesStageRoute(nextConfig, pathname)) {
      walkthrough.advanceTo(next);
    }
    // Resolves to a dynamic route (id unknown ahead of time) so it can't go through the
    // ROUTE_ADVANCES map's plain equality check above.
    if (stage === 'builder_preview' && /^\/dashboards\/\d+$/.test(pathname)) {
      walkthrough.advanceTo('share');
    }
  }, [active, stage, pathname]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(trackingFrameRef.current);
      ringedElRef.current?.classList.remove(RING_CLASS);
      ringedElRef.current = null;
      driverRef.current?.destroy();
    };
  }, []);

  /** The confirmed exit — what the ✕ used to do inline. */
  const skipWalkthrough = useCallback(() => {
    setLeavePromptOpen(false);
    useInsightWalkthroughStore.getState().skip();
    driverRef.current?.destroy();
  }, []);

  // While a coachmark is up, the coached control is the only thing the user can click — its
  // dropdown's option list included, since that's part of using it. Everything else, Cancel and
  // ✕ on the dialog the coachmark points into included, asks whether they meant to leave. The
  // target goes first: the guard reads it to tell a dialog the flow is IN from one the coached
  // click just opened (see isClickInsideForeignDialog).
  useWalkthroughExitGuard({
    // Stays armed while the prompt is up: dropping the guard there let the pointerdown be
    // cancelled but the FOLLOWING click through, so the card the user clicked opened anyway
    // behind the prompt. onLeaveIntent is idempotent, so re-raising is a no-op.
    //
    // Also armed on a coachmark-less step of a protected modal — see
    // WALKTHROUGH_PROTECTED_DIALOGS. With no coached target the modal rule is all that applies:
    // its contents stay free, its ✕ / Cancel / Back and its backdrop ask first.
    isArmed: () =>
      (coachmarkLiveRef.current && !guardFreeRoamRef.current) ||
      (active && document.querySelector(WALKTHROUGH_PROTECTED_DIALOGS) !== null),
    getAllowedRoots: () => [
      guardTargetRef.current,
      guardInteractionRef.current,
      ...guardExtraSelectorsRef.current.map((selector) => document.querySelector(selector)),
      guardPageRoamRef.current ? document.querySelector(PAGE_CONTENT_SELECTOR) : null,
    ],
    getGuardedExits: () => guardExitSelectorsRef.current,
    onLeaveIntent: () => setLeavePromptOpen(true),
  });

  return (
    <LeaveWalkthroughDialog
      open={leavePromptOpen}
      surface="insight_walkthrough"
      stage={stage}
      onContinue={() => setLeavePromptOpen(false)}
      onSkip={skipWalkthrough}
    />
  );
}
