/**
 * One-shot feature coachmarks for the three pages no guided flow ever touches: Reports,
 * Alerts and Metrics. A trial user landing on one of them gets a popover pointing at that
 * page's primary CTA, explaining what the feature is for.
 *
 * These are NOT walkthrough stages, deliberately. `STAGE_CONFIG` in
 * insight-walkthrough-coachmark.tsx is a linear state machine — ordered stages, advanceTo /
 * advanceIfBefore, exported route map for mid-flow resume. A nudge has no order, no next step
 * and nothing to resume, so it lives here with its own renderer instead.
 *
 * Persistence is the backend's trial_walkthrough dict (see hooks/api/useTrialWalkthrough.ts):
 * dismissing writes `completed: true` under `key`, and the nudge is never shown again. No
 * localStorage — a cleared browser must not resurrect a nudge the user already dismissed.
 */
import type { TrialWalkthroughFlow } from '@/hooks/api/useTrialWalkthrough';

export interface FeatureNudge {
  /** Backend key inside `trial_walkthrough`, and the analytics `nudge` property. */
  key: TrialWalkthroughFlow;
  /** Exact pathname this nudge belongs to — matched by equality, never a prefix. */
  route: string;
  /**
   * The page's primary CTA. All three are permission-gated in their pages, so this can
   * legitimately never appear — the renderer shows nothing and leaves the nudge unseen
   * rather than burning it on a user who couldn't act on it anyway.
   */
  selector: string;
  title: string;
  description: string;
}

/**
 * All three CTAs sit at the top-right of their page header, so the popover hangs BELOW them:
 * a 'right' popover would be clamped against the viewport edge and read as pointing at
 * nothing, while there is always open page underneath.
 *
 * No ring (the walkthrough's `.dalgo-tour-ring`) on any of these — that outline means "click
 * this", and a nudge explains a feature without asking for anything.
 */
export const FEATURE_NUDGES: FeatureNudge[] = [
  {
    key: 'reports_nudge',
    route: '/reports',
    selector: '[data-testid="create-report-btn"]',
    title: 'Report',
    description:
      'Reports capture a snapshot of any dashboard at a specific point in time — so you can review, share, and comment on your data.',
  },
  {
    key: 'alerts_nudge',
    route: '/alerts',
    selector: '[data-testid="create-alert-btn"]',
    title: 'Alerts',
    description:
      'Alerts notify you by email or Slack when your data crosses a threshold you care about — a KPI going red, a Metric dropping below a number, or a custom check on any table in your warehouse.',
  },
  {
    key: 'metrics_nudge',
    route: '/metrics',
    selector: '[data-testid="create-metric-btn"]',
    title: 'Metric',
    description:
      'Metrics are reusable measurements — a saved combination of a column and an aggregation — that power your KPIs and charts.',
  },
];

/** The nudge anchored to `pathname`, or null. */
export function getFeatureNudgeForRoute(pathname: string): FeatureNudge | null {
  return FEATURE_NUDGES.find((nudge) => nudge.route === pathname) ?? null;
}
