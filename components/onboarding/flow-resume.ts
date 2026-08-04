/**
 * Computes "what's the next step" for a user who started one of the three onboarding
 * flows (sample-data insight, own-data insight, automate-pipeline) and left mid-way.
 * Pure derivation over the milestone flags in insight-walkthrough-constants.ts — no
 * polling, no backend calls. Decoupled from the live coachmark (`stage`): this reflects
 * real progress even if the guided tour was never resumed or was abandoned.
 *
 * The "create dashboard" step is intentionally never resumed into a specific dashboard —
 * the user just makes a fresh one each time; only the milestone flags matter, not which
 * dashboard satisfied them.
 */
import { useAuthStore } from '@/stores/authStore';
import {
  type WalkthroughPath,
  getStoredPath,
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

function dashboardGroupDone(orgSlug: string, requireChart: boolean): boolean {
  const chartDone = !requireChart || hasChartAddedToDashboard(orgSlug);
  return chartDone && hasKpiAddedToDashboard(orgSlug) && hasDashboardShared(orgSlug);
}

export function getFlowResumeStep(
  orgSlug: string,
  path: WalkthroughPath | null
): FlowResumeStep | null {
  if (!path) return null;

  if (path === 'sample') {
    if (!hasKpiCreated(orgSlug)) return { id: 'create_kpi', label: 'Create a KPI' };
    if (!dashboardGroupDone(orgSlug, false)) {
      return { id: 'create_dashboard', label: 'Create a dashboard' };
    }
    return null;
  }

  if (path === 'own_data') {
    if (!hasConnectedRealData(orgSlug)) return { id: 'ingest_data', label: 'Connect your data' };
    if (!hasChartCreated(orgSlug)) return { id: 'create_chart', label: 'Create a chart' };
    if (!dashboardGroupDone(orgSlug, true)) {
      return { id: 'create_dashboard', label: 'Create a dashboard' };
    }
    return null;
  }

  // automate_pipeline
  if (!hasConnectedRealData(orgSlug)) return { id: 'ingest_data', label: 'Connect your data' };
  if (!hasTransformPublished(orgSlug))
    return { id: 'transform_data', label: 'Transform your data' };
  if (!hasPipelineCreated(orgSlug))
    return { id: 'orchestrate_pipeline', label: 'Orchestrate your pipeline' };
  if (!hasChartCreated(orgSlug)) return { id: 'create_chart', label: 'Create a chart' };
  if (!dashboardGroupDone(orgSlug, true)) {
    return { id: 'create_dashboard', label: 'Create a dashboard' };
  }
  return null;
}

/** orgSlug is read the same way TourGate does — via the selected org on authStore. */
export function useFlowResumeStep(): FlowResumeStep | null {
  const orgUsers = useAuthStore((s) => s.orgUsers);
  const selectedOrgSlug = useAuthStore((s) => s.selectedOrgSlug);
  const orgSlug = orgUsers.find((ou) => ou.org.slug === selectedOrgSlug)?.org.slug ?? null;
  if (!orgSlug) return null;
  const path = getStoredPath(orgSlug);
  return getFlowResumeStep(orgSlug, path);
}
