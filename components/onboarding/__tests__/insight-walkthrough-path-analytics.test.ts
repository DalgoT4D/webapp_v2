/**
 * The insight/pipeline walkthroughs' half of the unified onboarding-path events.
 *
 * The store is the only thing that knows which fork is running, so it is where the path
 * lifecycle is reported from. The path lifecycle deliberately starts at the FORK CHOICE, not
 * at start(): before the user picks sample-vs-own-data there is no path to attribute anything
 * to, and inventing one there would make every started/completed ratio wrong.
 */
const mockStartPath = jest.fn();
const mockResumePath = jest.fn();
const mockStagePath = jest.fn();
const mockCompletePath = jest.fn();
const mockExitPath = jest.fn();

jest.mock('@/lib/onboarding-analytics', () => ({
  startOnboardingPath: (...args: unknown[]) => mockStartPath(...args),
  resumeOnboardingPath: (...args: unknown[]) => mockResumePath(...args),
  trackOnboardingPathStage: (...args: unknown[]) => mockStagePath(...args),
  completeOnboardingPath: (...args: unknown[]) => mockCompletePath(...args),
  exitOnboardingPath: (...args: unknown[]) => mockExitPath(...args),
}));

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { stageOrderFor } from '../insight-walkthrough-constants';
import { mockApiPut } from '@/test-utils/api';
import { setWalkthroughScope, USER_A, ORG_A } from './walkthrough-scope-utils';

const store = () => useInsightWalkthroughStore.getState();

describe('insight walkthrough path analytics', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    mockApiPut.mockResolvedValue({ success: true });
    setWalkthroughScope(USER_A, ORG_A);
    useInsightWalkthroughStore.setState({
      active: false,
      orgSlug: null,
      flow: null,
      stage: null,
      path: null,
      trackedConnectionId: null,
      pendingCelebration: null,
    });
  });

  describe('path start', () => {
    it('does NOT start a path on start() — the fork has not been chosen yet', () => {
      store().start(ORG_A);
      expect(mockStartPath).not.toHaveBeenCalled();
    });

    // The fork actions forward their opts straight through, so a caller that names no entry
    // surface passes undefined. The emitted event is the same either way — trackOnboardingPathStage
    // omits `entry` when there isn't one (see the onboarding-analytics tests).
    it('starts the sample path when the sample fork is chosen', () => {
      store().start(ORG_A);
      store().chooseSample();
      expect(mockStartPath).toHaveBeenCalledWith('insight_sample', undefined);
    });

    it('starts the own-data path when the own-data fork is chosen', () => {
      store().start(ORG_A);
      store().chooseOwnData();
      expect(mockStartPath).toHaveBeenCalledWith('insight_own_data', undefined);
    });

    it('starts the own-data path with entry "chart" when the chart tail is entered directly', () => {
      store().startChartFlow(ORG_A);
      expect(mockStartPath).toHaveBeenCalledWith('insight_own_data', { entry: 'chart' });
    });

    it('starts the pipeline path from startAutomatePipeline', () => {
      store().startAutomatePipeline(ORG_A);
      expect(mockStartPath).toHaveBeenCalledWith('pipeline');
    });

    it('carries the entry surface through the fork, so a nudge-started run is attributable', () => {
      store().start(ORG_A);
      store().chooseSample({ entry: 'trial_nudge' });
      expect(mockStartPath).toHaveBeenCalledWith('insight_sample', { entry: 'trial_nudge' });
    });

    it('carries the entry surface on the own-data fork too', () => {
      store().start(ORG_A);
      store().chooseOwnData({ entry: 'fork_modal' });
      expect(mockStartPath).toHaveBeenCalledWith('insight_own_data', { entry: 'fork_modal' });
    });
  });

  describe('path stages', () => {
    it('reports the fork choice as that path first stage', () => {
      store().start(ORG_A);
      store().chooseSample();
      expect(mockStagePath).toHaveBeenCalledWith('insight_sample', 'kpi_intro', { stageIndex: 1 });
    });

    it('reports each advance with the path and the stage index within that fork', () => {
      store().start(ORG_A);
      store().chooseOwnData();
      mockStagePath.mockClear();

      store().advanceTo('own_data_pick_source');

      expect(mockStagePath).toHaveBeenCalledWith('insight_own_data', 'own_data_pick_source', {
        stageIndex: 2,
      });
    });

    it('omits stage_index for a stage that is not in that fork ordered list', () => {
      store().startAutomatePipeline(ORG_A);
      mockStagePath.mockClear();

      // 'share' belongs to the insight forks, not the pipeline order.
      store().advanceTo('share');

      expect(mockStagePath).toHaveBeenCalledWith('pipeline', 'share', {});
    });

    it('reports nothing while no fork has been chosen', () => {
      store().start(ORG_A);
      mockStagePath.mockClear();

      store().advanceTo('fork2');

      expect(mockStagePath).not.toHaveBeenCalled();
    });
  });

  describe('path resume', () => {
    it('reports a resumed run with its stored path and stage', () => {
      store().startAutomatePipeline(ORG_A);
      store().advanceTo('pipeline_ingest');
      useInsightWalkthroughStore.setState({ active: false, flow: null, stage: null, path: null });

      store().resume(ORG_A, 'automate_pipeline');

      expect(mockResumePath).toHaveBeenCalledWith('pipeline', 'pipeline_ingest');
    });
  });

  describe('path end', () => {
    it('completes the running path on finish()', () => {
      store().startAutomatePipeline(ORG_A);
      store().finish();
      expect(mockCompletePath).toHaveBeenCalledWith('pipeline');
      expect(mockExitPath).not.toHaveBeenCalled();
    });

    it('exits the running path on skip(), with the stage quit on', () => {
      store().start(ORG_A);
      store().chooseSample();
      store().advanceTo('kpi_metric');

      store().skip();

      expect(mockExitPath).toHaveBeenCalledWith('insight_sample', 'kpi_metric', {
        stageIndex: stageOrderFor('sample').indexOf('kpi_metric'),
      });
      expect(mockCompletePath).not.toHaveBeenCalled();
    });

    it('reports no path end when the user quits at the fork, before choosing one', () => {
      store().start(ORG_A);
      store().skip();
      expect(mockExitPath).not.toHaveBeenCalled();
      expect(mockCompletePath).not.toHaveBeenCalled();
    });
  });
});
