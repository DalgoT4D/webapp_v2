/**
 * Guided product walkthrough steps (driver.js).
 *
 * NEW, self-contained file. Does NOT modify any existing platform UI.
 *
 * Every step spotlights the whole page content area (`#main-layout-main-content`)
 * so the actual page is highlighted and the popover settles at the bottom. When a
 * step moves to a different sidebar section, the tour first briefly spotlights the
 * sidebar menu item (the "moving menu" beat) before highlighting the page.
 *
 * Order: Ingest (Warehouse → Sources → Connections) → Transform → Orchestrate →
 * Overview → Explore (opens a table to show real data) → Charts → Dashboards →
 * live dashboard → User Management.
 *
 * Plain-language copy only — no technical jargon.
 */

// The demo dashboard built in Session 2 (Education Access & Equity).
export const DEMO_DASHBOARD_ID = 11;

// The warehouse table opened in the Explore step.
export const DEMO_EXPLORE_TABLE = {
  schema: 'intermediate',
  table: 'mart_coverage_by_district',
};

export interface TourStep {
  /** Route to navigate to before showing this step (skipped if already there). */
  route: string;
  /** CSS selector for the element to spotlight. */
  selector: string;
  /** Popover placement relative to the element. */
  side: 'top' | 'bottom' | 'left' | 'right' | 'over';
  align?: 'start' | 'center' | 'end';
  icon: string;
  title: string;
  content: string;
  /**
   * The sidebar menu item this step lives under (its `title="..."`). When it
   * changes from the previous step, the tour briefly spotlights this sidebar
   * item first. Omit for steps with no menu (e.g. welcome).
   */
  navTitle?: string;
  /** When true, open the demo Explore table so real data is on screen. */
  selectExploreTable?: boolean;
}

const CONTENT = '#main-layout-main-content';
const SIDE = 'left' as const;
const ALIGN = 'center' as const;

export const tourSteps: TourStep[] = [
  {
    route: '/ingest?tab=warehouse',
    selector: CONTENT,
    side: SIDE,
    align: ALIGN,
    icon: '👋',
    title: 'Welcome to Dalgo',
    content:
      "Let's take a quick tour. I'll walk you through each part of the platform in plain language — what it is and what it's for. Press Next to begin.",
  },
  {
    route: '/ingest?tab=warehouse',
    selector: CONTENT,
    side: SIDE,
    align: ALIGN,
    icon: '🏠',
    title: 'Your Warehouse',
    navTitle: 'Ingest',
    content:
      'Think of this as the central home for all your data — everything kept together, neatly, in one safe place.',
  },
  {
    route: '/ingest?tab=sources',
    selector: CONTENT,
    side: SIDE,
    align: ALIGN,
    icon: '📥',
    title: 'Sources',
    navTitle: 'Ingest',
    content:
      'These are the places your data comes from — like Google Sheets, your apps, or files you already use every day.',
  },
  {
    route: '/ingest?tab=connections',
    selector: CONTENT,
    side: SIDE,
    align: ALIGN,
    icon: '🔗',
    title: 'Connections',
    navTitle: 'Ingest',
    content:
      'A connection is the pipe that brings data from a source into your warehouse for you — so you never copy-paste again.',
  },
  {
    route: '/transform',
    selector: CONTENT,
    side: SIDE,
    align: ALIGN,
    icon: '✨',
    title: 'Transform',
    navTitle: 'Transform',
    content:
      'Tidy up and combine your raw data so it actually answers your questions — cleaning, joining and shaping, all in one place.',
  },
  {
    route: '/orchestrate',
    selector: CONTENT,
    side: SIDE,
    align: ALIGN,
    icon: '⚙️',
    title: 'Orchestrate',
    navTitle: 'Orchestrate',
    content:
      'Put everything on autopilot — Dalgo refreshes your data on a schedule, so what you see is always up to date without any manual work.',
  },
  {
    route: '/pipeline',
    selector: CONTENT,
    side: SIDE,
    align: ALIGN,
    icon: '📋',
    title: 'Overview',
    navTitle: 'Overview',
    content:
      'A simple status board showing whether your automatic updates ran successfully — green means all good.',
  },
  {
    route: '/explore',
    selector: CONTENT,
    side: SIDE,
    align: ALIGN,
    icon: '🔎',
    title: 'Explore your data',
    navTitle: 'Explore',
    content:
      "Browse the data sitting in your warehouse, just like opening a spreadsheet. We've opened a real, cleaned-up table for you — have a look around.",
    selectExploreTable: true,
  },
  {
    route: '/charts',
    selector: CONTENT,
    side: SIDE,
    align: ALIGN,
    icon: '📈',
    title: 'Charts',
    navTitle: 'Charts',
    content:
      'Turn your numbers into simple visuals — bars, lines, pies and more. This is the list of charts you can build.',
  },
  {
    route: '/dashboards',
    selector: CONTENT,
    side: SIDE,
    align: ALIGN,
    icon: '🗂️',
    title: 'Dashboards',
    navTitle: 'Dashboards',
    content:
      "Bring your charts together into one page you can share with your team. Let's open one and take a look.",
  },
  {
    route: `/dashboards/${DEMO_DASHBOARD_ID}`,
    selector: CONTENT,
    side: SIDE,
    align: ALIGN,
    icon: '🌟',
    title: 'A live dashboard',
    navTitle: 'Dashboards',
    content:
      'This is a ready-made dashboard telling a full story from your data — headline numbers, charts and notes in one view.',
  },
  {
    route: '/settings/user-management',
    selector: CONTENT,
    side: SIDE,
    align: ALIGN,
    icon: '👥',
    title: 'User Management',
    navTitle: 'User Management',
    content:
      "Invite your team and choose what each person can see and do. That's the tour — you're all set to explore on your own!",
  },
];
