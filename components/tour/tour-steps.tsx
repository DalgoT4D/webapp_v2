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
 * Reports → Metrics → KPIs → Impact → User Management → "you're all set" finish.
 *
 * Plain-language copy only — no technical jargon.
 */

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
  /**
   * When true, show the popover as a centered modal with no element spotlight
   * (used for the closing "you're all set" screen). `selector`/`side` are ignored.
   */
  center?: boolean;
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
    navTitle: 'Ingest',
    content:
      "Let's take a quick tour. We'll start with your Warehouse — the central home for all your data, kept together neatly in one safe place. Press Next to continue.",
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
      'Bring your charts together into one page you can share with your team — this is the list of dashboards you can build and open.',
  },
  {
    route: '/reports',
    selector: CONTENT,
    side: SIDE,
    align: ALIGN,
    icon: '📄',
    title: 'Reports',
    navTitle: 'Reports',
    content:
      'Generate polished, ready-to-share reports of your data — perfect for sending to funders, partners or your team.',
  },
  {
    route: '/metrics',
    selector: CONTENT,
    side: SIDE,
    align: ALIGN,
    icon: '🔢',
    title: 'Metrics',
    navTitle: 'Metrics',
    content:
      'Define the key numbers you care about — like people reached or funds spent — and track each one over time, all in one place.',
  },
  {
    route: '/kpis',
    selector: CONTENT,
    side: SIDE,
    align: ALIGN,
    icon: '🎯',
    title: 'KPIs',
    navTitle: 'KPIs',
    content:
      "Set targets for the numbers that matter most and see at a glance whether you're on track to meet your goals.",
  },
  {
    route: '/impact',
    selector: CONTENT,
    side: SIDE,
    align: ALIGN,
    icon: '🏠',
    title: 'Impact',
    navTitle: 'Impact',
    content:
      "For now, pick one dashboard to be your home page — a single overview of how your programs are doing. It's the first thing you'll see each time you log in.",
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
      'Invite your team and choose what each person can see and do — control who has access to what.',
  },
  {
    route: '/settings/user-management',
    selector: '',
    side: SIDE,
    align: ALIGN,
    icon: '🎉',
    title: "You're all set!",
    center: true,
    content:
      "That's the tour. Have a click around and explore Dalgo on your own — you can restart this tour any time from the button in the bottom-right corner.",
  },
];
