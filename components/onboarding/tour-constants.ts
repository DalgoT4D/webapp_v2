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
   * Spotlight the whole content area instead of just the first row/card of it — for pages
   * like Transform where the thing being called out (the workflow diagram) isn't at the top.
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
    spotlightFull: true,
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
