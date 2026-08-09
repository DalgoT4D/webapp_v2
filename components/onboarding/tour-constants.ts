// Content + config for the 9-step guided product tour (driver.js).
// Copy and step order mirror the "tour flow" Figma frames (section 2303:4689).
//
// NOTE: Figma's copy for the Alerts/Metrics/Orchestrate/Transform frames (steps 5-8) was
// duplicated verbatim across all four frames (a WIP content placeholder, not a design
// decision) — only Alerts' text is from Figma; Metrics/Orchestrate/Transform below are
// written to match voice/tone pending real copy from design.

export interface TourStep {
  /** Route to navigate to before showing this step. */
  route: string;
  title: string;
  content: string;
  /** Overrides the default "Next" primary-button label. */
  ctaLabel?: string;
  /**
   * Spotlight the whole content area instead of just the first row/card of it. No step uses
   * this today — Transform did, but a cutout over the entire content area leaves nothing
   * dimmed, so the step read as unhighlighted; it now unions its two cards instead. Kept for
   * a page whose callout genuinely is the full area.
   */
  spotlightFull?: boolean;
  /**
   * Spotlight ONLY the first row(s)/card(s) themselves — excludes the header, filters, and
   * search bar above them (unlike the default band, which starts at the content area's top and
   * so includes them). Opt-in per step since most steps' Figma frames DO include the filter row
   * in the spotlight; KPI's and Charts' do not.
   */
  spotlightRowOnly?: boolean;
  /** How many rows/cards to include when `spotlightRowOnly` is set. Defaults to 1. */
  spotlightRowCount?: number;
  /**
   * Explicit selector for this page's row elements, overriding the default shape detection
   * (table rows, then grid cards). Only needed where those heuristics don't fit — see the
   * Ingest step below.
   */
  rowSelector?: string;
}

export const TOUR_TOTAL_STEPS = 9;

// The content wrapper each step's spotlight is measured against — the band is sized to the
// page's actual first table row / first card-grid row at render time (or the full area, for
// spotlightFull steps), not a fixed height. See product-tour.tsx's spotlight-element logic.
// The popover itself is positioned separately, next to the sidebar nav item for the route.
export const TOUR_CONTENT_SELECTOR = '#main-layout-main-content';

export const TOUR_STEPS: TourStep[] = [
  {
    route: '/kpis',
    title: 'KPI',
    content: "Set your programme targets and see what's on- or off-track at a glance.",
    ctaLabel: 'Start Tour',
    spotlightRowOnly: true,
  },
  {
    route: '/charts',
    title: 'Charts',
    content:
      'Turn any table into bar, line, pie or map charts in a couple of clicks — no code, no data engineer.',
    spotlightRowOnly: true,
    spotlightRowCount: 4,
  },
  {
    route: '/dashboards',
    title: 'Dashboards',
    content:
      'Pin your charts into one shareable view your whole team can open — the story behind your numbers.',
    spotlightRowOnly: true,
    spotlightRowCount: 4,
  },
  {
    route: '/reports',
    title: 'Reports',
    content:
      'Package your dashboards into funder-ready reports you can generate and share on a schedule.',
    spotlightRowOnly: true,
    spotlightRowCount: 4,
  },
  {
    route: '/alerts',
    title: 'Alerts',
    content:
      'Get notified the moment a metric crosses a threshold you care about — before it becomes a problem.',
    spotlightRowOnly: true,
    spotlightRowCount: 4,
  },
  {
    route: '/metrics',
    title: 'Metrics',
    content:
      'Define the key numbers you care about — like people reached or funds spent — and track each one over time.',
    spotlightRowOnly: true,
    spotlightRowCount: 4,
  },
  {
    route: '/orchestrate',
    title: 'Orchestrate',
    content:
      'Put your syncs and transforms on autopilot — schedule them once and Dalgo keeps your data fresh automatically.',
    spotlightRowOnly: true,
    spotlightRowCount: 4,
  },
  {
    route: '/transform',
    title: 'Transform',
    content:
      'Clean, join and reshape your raw data into models that actually answer your questions.',
    // One cutout covering BOTH of this page's cards — the DBT repository card and the workflow
    // canvas card — matching the Figma frame. Previously `spotlightFull`, which cut a hole over
    // the entire content area: nothing was left dimmed, so the step read as having no highlight
    // at all. The two cards are the page's only content, so the union of them is the highlight;
    // the page title and the UI/DBT tab row stay dimmed like every other step's header.
    spotlightRowOnly: true,
    spotlightRowCount: 2,
    rowSelector: '[data-testid="dbt-repository-card"], [data-testid="workflow-canvas-card"]',
  },
  {
    route: '/ingest',
    title: 'Ingest',
    content:
      "That's the tour. When you're ready, connect your own sources — Google Sheets, field tools — and build a pipeline.",
    ctaLabel: 'Finish Tour',
    spotlightRowOnly: true,
    spotlightRowCount: 4,
    // Ingest's source list is a flex column of divs, not a table or card grid, so neither
    // default shape matches. It also nests a connections <table> inside each source row —
    // without this selector the table heuristic would spotlight those inner connection rows
    // rather than the sources themselves.
    rowSelector: '[data-testid^="source-row-"]',
  },
];

// localStorage-only for v1 (explicitly not a backend field — see plan). Keyed by org slug so
// a shared browser across two trial orgs doesn't cross-suppress the tour.
export const TOUR_SEEN_STORAGE_PREFIX = 'dalgo_tour_seen_';

export function hasSeenTour(orgSlug: string): boolean {
  try {
    return localStorage.getItem(`${TOUR_SEEN_STORAGE_PREFIX}${orgSlug}`) === '1';
  } catch {
    return false;
  }
}

export function markTourSeen(orgSlug: string): void {
  try {
    localStorage.setItem(`${TOUR_SEEN_STORAGE_PREFIX}${orgSlug}`, '1');
  } catch {
    // localStorage unavailable (e.g. private mode) — worst case the tour re-offers itself.
  }
}

/**
 * Whether this org has EVER been shown the intent modal — which picks its copy, not whether
 * it opens. First time it asks "What brings you to Dalgo"; every time after, it greets a
 * returning user with the days left on their trial.
 *
 * Separate from TOUR_SEEN, which product-tour.tsx writes when the tour itself runs. A user
 * can meet this modal and never start the tour, and those two facts answer different
 * questions.
 */
export const TOUR_INTENT_SEEN_STORAGE_PREFIX = 'dalgo_tour_intent_seen_';

export function hasSeenIntentModal(orgSlug: string): boolean {
  try {
    return localStorage.getItem(`${TOUR_INTENT_SEEN_STORAGE_PREFIX}${orgSlug}`) === '1';
  } catch {
    return false;
  }
}

export function markIntentModalSeen(orgSlug: string): void {
  try {
    localStorage.setItem(`${TOUR_INTENT_SEEN_STORAGE_PREFIX}${orgSlug}`, '1');
  } catch {
    // localStorage unavailable (e.g. private mode) — worst case the user is greeted as a
    // first-timer again, which is a copy difference and nothing more.
  }
}

/**
 * Whether the intent modal has already opened in THIS browser session — the modal returns
 * each time the user comes back to Dalgo, but must not reappear on a refresh or on every
 * navigation back to /impact while they are working.
 *
 * sessionStorage, deliberately: "they opened Dalgo again" is exactly a new session, and there
 * is no login event a modal can hang off (a reload is indistinguishable from one).
 */
export const TOUR_INTENT_SESSION_STORAGE_PREFIX = 'dalgo_tour_intent_session_';

export function hasShownIntentModalThisSession(orgSlug: string): boolean {
  try {
    return sessionStorage.getItem(`${TOUR_INTENT_SESSION_STORAGE_PREFIX}${orgSlug}`) === '1';
  } catch {
    return false;
  }
}

export function markIntentModalShownThisSession(orgSlug: string): void {
  try {
    sessionStorage.setItem(`${TOUR_INTENT_SESSION_STORAGE_PREFIX}${orgSlug}`, '1');
  } catch {
    // no-op
  }
}

/**
 * Which step a RUNNING tour is on. Written on every step, cleared by finish() — so a value
 * being present means the run was interrupted rather than exited, and TourGate puts it back
 * on screen (see its resume effect).
 *
 * The tour keeps its live state in refs, which a page reload wipes; without this the ✕ was
 * not the only way out — F5 was too, silently. Separate from TOUR_SEEN (a permanent "this org
 * has been through it" flag) because the two answer different questions and clear at
 * different times.
 */
export const TOUR_PROGRESS_STORAGE_PREFIX = 'dalgo_tour_progress_';

export function saveTourProgress(orgSlug: string, stepIndex: number): void {
  try {
    localStorage.setItem(`${TOUR_PROGRESS_STORAGE_PREFIX}${orgSlug}`, String(stepIndex));
  } catch {
    // localStorage unavailable (e.g. private mode) — worst case a reload ends the tour.
  }
}

/** The step to resume at, or null if no tour is mid-run (or the stored value is unusable). */
export function getTourProgress(orgSlug: string): number | null {
  try {
    const raw = localStorage.getItem(`${TOUR_PROGRESS_STORAGE_PREFIX}${orgSlug}`);
    if (raw === null) return null;
    const index = Number(raw);
    // Guards a hand-edited value, and a stored index left over from a build whose TOUR_STEPS
    // had more steps than this one — resuming out of range would render nothing at all.
    if (!Number.isInteger(index) || index < 0 || index >= TOUR_STEPS.length) return null;
    return index;
  } catch {
    return null;
  }
}

export function clearTourProgress(orgSlug: string): void {
  try {
    localStorage.removeItem(`${TOUR_PROGRESS_STORAGE_PREFIX}${orgSlug}`);
  } catch {
    // no-op
  }
}
