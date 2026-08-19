import { getFlowResumeStep, FLOW_RESUME_ROUTES } from '../flow-resume';
import {
  markConnectedRealData,
  markTransformPublished,
  markPipelineCreated,
  markChartCreated,
  markKpiCreated,
  markChartAddedToDashboard,
  markKpiAddedToDashboard,
  markDashboardShared,
} from '../insight-walkthrough-constants';
import { setWalkthroughScope, USER_A, ORG_A } from './walkthrough-scope-utils';

describe('getFlowResumeStep', () => {
  beforeEach(() => {
    localStorage.clear();
    setWalkthroughScope(USER_A, ORG_A);
  });

  it('has nothing to resume before a fork is chosen', () => {
    expect(getFlowResumeStep(null)).toBeNull();
  });

  describe('sample fork', () => {
    it('walks KPI -> dashboard and then reports nothing left', () => {
      expect(getFlowResumeStep('sample')?.id).toBe('create_kpi');
      markKpiCreated();
      expect(getFlowResumeStep('sample')?.id).toBe('create_dashboard');
      // The sample fork never builds a chart, so its dashboard group doesn't require one.
      markKpiAddedToDashboard();
      markDashboardShared();
      expect(getFlowResumeStep('sample')).toBeNull();
    });
  });

  describe('own_data fork', () => {
    it('walks ingest -> chart -> dashboard, with no transform or orchestrate step', () => {
      expect(getFlowResumeStep('own_data')?.id).toBe('ingest_data');

      markConnectedRealData();
      // The core of this flow: real data lands and the next thing to do is build a chart.
      // Sending own-data users to Transform first is what the flow split removed.
      expect(getFlowResumeStep('own_data')?.id).toBe('create_chart');

      markChartCreated();
      expect(getFlowResumeStep('own_data')?.id).toBe('create_dashboard');

      markChartAddedToDashboard();
      markKpiAddedToDashboard();
      markDashboardShared();
      expect(getFlowResumeStep('own_data')).toBeNull();
    });
  });

  describe('automate_pipeline fork', () => {
    it('walks ingest -> transform -> orchestrate and then has nothing left', () => {
      expect(getFlowResumeStep('automate_pipeline')?.id).toBe('ingest_data');

      markConnectedRealData();
      expect(getFlowResumeStep('automate_pipeline')?.id).toBe('transform_data');

      markTransformPublished();
      expect(getFlowResumeStep('automate_pipeline')?.id).toBe('orchestrate_pipeline');

      // A scheduled pipeline is the whole deliverable — nothing left in THIS flow. Charting
      // it is build-insights, which the user starts from the checklist separately.
      markPipelineCreated();
      expect(getFlowResumeStep('automate_pipeline')).toBeNull();
    });
  });

  it('lets work done in one flow count for the other', () => {
    // Milestones are shared on purpose: someone who connected data and built a chart while
    // automating a pipeline shouldn't be asked to do either again by build-insights.
    markConnectedRealData();
    markChartCreated();
    expect(getFlowResumeStep('own_data')?.id).toBe('create_dashboard');
    // The pipeline flow still has its own work outstanding — sharing facts isn't sharing steps.
    expect(getFlowResumeStep('automate_pipeline')?.id).toBe('transform_data');
    expect(getFlowResumeStep('sample')?.id).toBe('create_kpi');
  });

  it.each(['own_data', 'automate_pipeline'] as const)('routes %s to Ingest first', (path) => {
    expect(FLOW_RESUME_ROUTES[getFlowResumeStep(path)!.id]).toBe('/ingest');
  });
});
