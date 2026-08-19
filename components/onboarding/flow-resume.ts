/**
 * Computes "what's the next step" for a user who started one of the three onboarding
 * flows (sample-data insight, own-data insight, automate-pipeline) and left mid-way.
 * Pure derivation over the milestone flags in insight-walkthrough-constants.ts — no
 * polling, no backend calls. Decoupled from the live coachmark (`stage`): this reflects
 * real progress even if the guided tour was never resumed or was abandoned.
 *
 * Milestones are shared across flows on purpose (see the storage section of
 * insight-walkthrough-constants.ts), so a user who connected real data while automating a
 * pipeline isn't asked to connect it again by the build-insights checklist. Only the SEQUENCE
 * differs per path.
 *
 * The "create dashboard" step is intentionally never resumed into a specific dashboard —
 * the user just makes a fresh one each time; only the milestone flags matter, not which
 * dashboard satisfied them.
 */
import {
  type WalkthroughPath,
  getStoredPath,
  getActiveWalkthroughFlow,
  hasConnectedRealData,
  hasPipelineCreated,
  hasKpiCreated,
  hasChartCreated,
  hasChartAddedToDashboard,
  hasKpiAddedToDashboard,
  hasDashboardShared,
  hasTransformPublished,
} from './insight-walkthrough-constants';

export interface FlowResumeStep {
  id:
    | 'create_kpi'
    | 'ingest_data'
    | 'create_chart'
    | 'transform_data'
    | 'orchestrate_pipeline'
    | 'create_dashboard';
  label: string;
}

// Where each resume step actually continues the flow — used by GettingStartedWidget to
// route a checklist click to the exact spot a user left off, instead of a generic page.
export const FLOW_RESUME_ROUTES: Record<FlowResumeStep['id'], string> = {
  ingest_data: '/ingest',
  create_chart: '/charts/new',
  transform_data: '/transform',
  orchestrate_pipeline: '/pipeline',
  create_kpi: '/kpis?create=true',
  create_dashboard: '/dashboards',
};

function dashboardGroupDone(requireChart: boolean): boolean {
  const chartDone = !requireChart || hasChartAddedToDashboard();
  return chartDone && hasKpiAddedToDashboard() && hasDashboardShared();
}

export function getFlowResumeStep(path: WalkthroughPath | null): FlowResumeStep | null {
  if (!path) return null;

  if (path === 'sample') {
    if (!hasKpiCreated()) return { id: 'create_kpi', label: 'Create a KPI' };
    if (!dashboardGroupDone(false)) {
      return { id: 'create_dashboard', label: 'Create a dashboard' };
    }
    return null;
  }

  if (!hasConnectedRealData()) return { id: 'ingest_data', label: 'Connect your data' };

  // The automate-pipeline flow is ingest -> transform -> orchestrate and stops there: a
  // scheduled pipeline is what it set out to deliver. Charting the result is the build-insights
  // flow, which the user starts separately.
  if (path === 'automate_pipeline') {
    if (!hasTransformPublished()) return { id: 'transform_data', label: 'Transform your data' };
    if (!hasPipelineCreated())
      return { id: 'orchestrate_pipeline', label: 'Orchestrate your pipeline' };
    return null;
  }

  if (!hasChartCreated()) return { id: 'create_chart', label: 'Create a chart' };
  if (!dashboardGroupDone(true)) {
    return { id: 'create_dashboard', label: 'Create a dashboard' };
  }
  return null;
}

/**
 * The resume step for whichever flow the user was last driving. Both flows can be mid-run at
 * once, so the active-flow pointer decides which one the widget speaks about — the same
 * pointer TourGate resumes from, so the nudge and the coachmark never disagree.
 */
export function useFlowResumeStep(): FlowResumeStep | null {
  const flow = getActiveWalkthroughFlow() ?? 'insights';
  return getFlowResumeStep(getStoredPath(flow));
}
