import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { useSidebarStore } from '@/stores/sidebarStore';
import { mockApiPut } from '@/test-utils/api';
import {
  getStoredWalkthroughStage,
  hasFinishedWalkthrough,
  getStoredPath,
  getStoredTrackedConnection,
  getActiveWalkthroughFlow,
  markKpiCreated,
  hasKpiCreated,
} from '../insight-walkthrough-constants';
import { setWalkthroughScope, USER_A, ORG_A, ORG_B } from './walkthrough-scope-utils';

/** finish()/skip() write to the backend before clearing — let that promise settle. */
const flushBackendWrite = () => new Promise((resolve) => setTimeout(resolve, 0));

const store = () => useInsightWalkthroughStore.getState();

describe('insightWalkthroughStore', () => {
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

  it('start() activates at fork2 and persists it', () => {
    store().start(ORG_A);
    expect(store().active).toBe(true);
    expect(store().stage).toBe('fork2');
    expect(store().flow).toBe('insights');
    expect(getStoredWalkthroughStage('insights')).toBe('fork2');
  });

  it('advanceTo() moves to an explicit stage and persists it under the live flow', () => {
    store().start(ORG_A);
    store().advanceTo('kpi_intro');
    expect(store().stage).toBe('kpi_intro');
    expect(getStoredWalkthroughStage('insights')).toBe('kpi_intro');
    expect(getStoredWalkthroughStage('automate_pipeline')).toBeNull();
  });

  it('advanceTo("share") followed by finish() marks that flow done and deactivates', () => {
    store().start(ORG_A);
    store().advanceTo('share');
    store().finish();
    expect(store().active).toBe(false);
    expect(hasFinishedWalkthrough('insights')).toBe(true);
  });

  it('finish() gives the sidebar back — the flow ends on a page that collapsed it', () => {
    useSidebarStore.setState({ collapsed: true });
    store().start(ORG_A);
    store().advanceTo('share_copy_link');

    store().finish();

    expect(useSidebarStore.getState().collapsed).toBe(false);
  });

  it('skip() gives the sidebar back too', () => {
    useSidebarStore.setState({ collapsed: true });
    store().start(ORG_A);

    store().skip();

    expect(useSidebarStore.getState().collapsed).toBe(false);
  });

  it('skip() deactivates without marking done', () => {
    store().start(ORG_A);
    store().skip();
    expect(store().active).toBe(false);
    expect(hasFinishedWalkthrough('insights')).toBe(false);
  });

  it('advanceIfBefore moves forward but never backwards', () => {
    store().start(ORG_A);
    store().chooseSample();
    store().advanceTo('kpi_submit');

    // A late hint firing after the user has already moved on must not rewind them.
    store().advanceIfBefore('kpi_target');
    expect(store().stage).toBe('kpi_submit');

    store().advanceIfBefore('dashboard_nudge');
    expect(store().stage).toBe('dashboard_nudge');
  });

  it('advanceIfBefore catches up a stage the user skipped past', () => {
    store().start(ORG_A);
    store().chooseSample();
    // Left the defaulted Direction dropdown alone, so its change-driven advance never fired.
    store().advanceTo('kpi_direction');

    // Clicking Continue is the checkpoint — it should pull them forward regardless.
    store().advanceIfBefore('kpi_type');

    expect(store().stage).toBe('kpi_type');
  });

  it('advanceIfBefore reads the order of the fork actually being run', () => {
    store().startAutomatePipeline(ORG_A);
    store().advanceTo('pipeline_orchestrate_intro');

    // pipeline_pick_table is earlier in AUTOMATE_PIPELINE_STAGE_ORDER — no rewind.
    store().advanceIfBefore('pipeline_pick_table');
    expect(store().stage).toBe('pipeline_orchestrate_intro');

    store().advanceIfBefore('pipeline_create_it');
    expect(store().stage).toBe('pipeline_create_it');
  });

  it('advanceIfBefore carries the own-data fork from its ingest step to the chart tail', () => {
    // Nothing between them any more — that's the flow split.
    store().start(ORG_A);
    store().chooseOwnData();
    store().advanceIfBefore('chart_intro');
    expect(store().stage).toBe('chart_intro');
  });

  describe('startChartFlow', () => {
    it('opens build-insights on the chart tail, with no fork2 step', () => {
      store().startChartFlow(ORG_A);
      expect(store().active).toBe(true);
      expect(store().flow).toBe('insights');
      expect(store().stage).toBe('chart_intro');
      // Runs under own_data so isStageBefore reads the order that contains the chart tail.
      expect(store().path).toBe('own_data');
      expect(getStoredPath('insights')).toBe('own_data');
      expect(getStoredWalkthroughStage('insights')).toBe('chart_intro');
    });

    it('advances through the chart tail from there', () => {
      store().startChartFlow(ORG_A);
      store().advanceIfBefore('chart_save');
      expect(store().stage).toBe('chart_save');
      store().advanceIfBefore('chart_create');
      expect(store().stage).toBe('chart_save');
    });
  });

  describe('celebration handover', () => {
    it('is null until something raises it, and clears when the destination consumes it', () => {
      store().startChartFlow(ORG_A);
      expect(store().pendingCelebration).toBeNull();
      store().setPendingCelebration('chart');
      expect(store().pendingCelebration).toBe('chart');
      store().setPendingCelebration(null);
      expect(store().pendingCelebration).toBeNull();
    });

    it('is cancelled by skipping — no congratulations for a flow just abandoned', () => {
      store().startChartFlow(ORG_A);
      store().setPendingCelebration('chart');
      store().skip();
      expect(store().pendingCelebration).toBeNull();
    });

    it('survives finish(), because the pipeline celebration is raised BY finishing', () => {
      // pipeline-form calls finish() and then raises this; the pipeline list renders it a
      // route later. Clearing on finish would swallow it entirely.
      store().startAutomatePipeline(ORG_A);
      store().advanceTo('pipeline_create_it');
      store().finish();
      store().setPendingCelebration('pipeline');
      expect(store().pendingCelebration).toBe('pipeline');
    });
  });

  describe('flow isolation', () => {
    it('starting the pipeline walkthrough leaves a half-finished insight run intact', () => {
      store().start(ORG_A);
      store().chooseOwnData();
      store().advanceTo('chart_pick_type');
      store().trackConnection('conn-insights');

      store().startAutomatePipeline(ORG_A);

      expect(store().flow).toBe('automate_pipeline');
      expect(store().stage).toBe('pipeline_ingest_nudge');
      // The whole point: the other run is still exactly where it was left.
      expect(getStoredWalkthroughStage('insights')).toBe('chart_pick_type');
      expect(getStoredPath('insights')).toBe('own_data');
      expect(getStoredTrackedConnection('insights')).toBe('conn-insights');
    });

    it('resumes the insight run afterwards, with its own path and connection', () => {
      store().start(ORG_A);
      store().chooseOwnData();
      store().advanceTo('chart_create');
      store().trackConnection('conn-insights');
      store().startAutomatePipeline(ORG_A);
      store().trackConnection('conn-pipeline');

      store().resume(ORG_A, 'insights');

      expect(store().flow).toBe('insights');
      expect(store().stage).toBe('chart_create');
      expect(store().path).toBe('own_data');
      expect(store().trackedConnectionId).toBe('conn-insights');
    });

    it('finishing one flow leaves the other resumable', async () => {
      store().start(ORG_A);
      store().chooseOwnData();
      store().advanceTo('chart_create');

      store().startAutomatePipeline(ORG_A);
      // pipeline_create_it is where that walkthrough ends.
      store().advanceTo('pipeline_create_it');
      store().finish();
      await flushBackendWrite();

      expect(mockApiPut).toHaveBeenCalledWith('/api/userpreferences/trial-walkthrough', {
        flow: 'automate_pipeline',
        completed: true,
      });
      // Finishing used to set one org-wide done flag, which stopped this resuming at all.
      expect(hasFinishedWalkthrough('insights')).toBe(false);
      store().resume(ORG_A, 'insights');
      expect(store().stage).toBe('chart_create');
    });

    it('tracks the active flow so a cold resume knows which one to come back to', () => {
      store().start(ORG_A);
      expect(getActiveWalkthroughFlow()).toBe('insights');
      store().startAutomatePipeline(ORG_A);
      expect(getActiveWalkthroughFlow()).toBe('automate_pipeline');
      store().resume(ORG_A, 'insights');
      expect(getActiveWalkthroughFlow()).toBe('insights');
    });
  });

  it('resume() re-activates at a previously stored stage', () => {
    store().start(ORG_A);
    store().advanceTo('dashboard_intro');
    useInsightWalkthroughStore.setState({ active: false, orgSlug: null, flow: null, stage: null });
    store().resume(ORG_A);
    expect(store().stage).toBe('dashboard_intro');
    expect(store().active).toBe(true);
  });

  // A stage anchored to something a reload destroys (the KPI dialog, an unsaved dashboard)
  // can't be resumed as itself — its coachmark would wait forever on a selector that never
  // comes back, which reads as the walkthrough vanishing on refresh.
  it('resume() rewinds a stage that a page reload cannot restore to its anchor', () => {
    store().start(ORG_A);
    store().advanceTo('builder_save');
    useInsightWalkthroughStore.setState({ active: false, orgSlug: null, flow: null, stage: null });

    store().resume(ORG_A);

    expect(store().stage).toBe('dashboard_intro');
    expect(store().active).toBe(true);
    // Persisted too, so the next reload resumes from the anchor rather than rewinding again.
    expect(getStoredWalkthroughStage('insights')).toBe('dashboard_intro');
  });

  it('resume() does nothing if that flow was already finished', () => {
    store().start(ORG_A);
    store().advanceTo('share');
    store().finish();
    store().resume(ORG_A);
    expect(store().active).toBe(false);
  });

  it('chooseOwnData() sets path + stage and persists both', () => {
    store().start(ORG_A);
    store().chooseOwnData();
    expect(store().path).toBe('own_data');
    expect(store().stage).toBe('own_data_ingest');
    expect(getStoredPath('insights')).toBe('own_data');
    expect(getStoredWalkthroughStage('insights')).toBe('own_data_ingest');
  });

  it('chooseSample() sets path + stage and persists both', () => {
    store().start(ORG_A);
    store().chooseSample();
    expect(store().path).toBe('sample');
    expect(store().stage).toBe('kpi_intro');
    expect(getStoredPath('insights')).toBe('sample');
  });

  it('trackConnection() persists the connection id under the live flow', () => {
    store().start(ORG_A);
    store().chooseOwnData();
    store().trackConnection('conn-123');
    expect(store().trackedConnectionId).toBe('conn-123');
    expect(getStoredTrackedConnection('insights')).toBe('conn-123');
  });

  it('untrackConnection() rewinds to the ingest step while the first sync is still awaited', () => {
    // The connection was deleted mid-wait (typically to start over after a failure). The ingest
    // stage is silent while a connection is tracked, so dropping the tracking is what puts
    // "connect your data" back on screen.
    store().start(ORG_A);
    store().chooseOwnData();
    store().trackConnection('conn-123');
    store().advanceTo('sync_running');

    store().untrackConnection();

    expect(store().trackedConnectionId).toBeNull();
    expect(store().stage).toBe('own_data_ingest');
  });

  it('untrackConnection() leaves a flow that is already past ingest where it is', () => {
    // Regression: this rewind was unconditional, so losing sight of a connection that had
    // ALREADY synced (deleted afterwards, or simply missing from a stale list) sent a user who
    // was building charts back to "connect your data" — the ingestion they had just finished
    // looked like it never happened.
    store().start(ORG_A);
    store().chooseOwnData();
    store().trackConnection('conn-123');
    store().advanceTo('chart_intro');

    store().untrackConnection();

    expect(store().trackedConnectionId).toBeNull();
    expect(store().stage).toBe('chart_intro');
  });

  it("records the completion, then wipes that flow's local scratch space", async () => {
    store().start(ORG_A);
    store().chooseOwnData();
    store().advanceTo('share');

    store().finish();
    await flushBackendWrite();

    expect(mockApiPut).toHaveBeenCalledWith('/api/userpreferences/trial-walkthrough', {
      flow: 'insights',
      completed: true,
    });
    // The backend holds the record now.
    expect(getStoredPath('insights')).toBeNull();
    expect(getStoredWalkthroughStage('insights')).toBeNull();
    expect(hasFinishedWalkthrough('insights')).toBe(false);
  });

  it('keeps shared milestones after a flow resolves — they are facts, not progress', async () => {
    store().start(ORG_A);
    store().chooseOwnData();
    markKpiCreated();
    store().advanceTo('share');

    store().finish();
    await flushBackendWrite();

    // Wiping these would make the automate-pipeline flow ask for work already done.
    expect(hasKpiCreated()).toBe(true);
  });

  it('skip() records the skip and wipes that flow too', async () => {
    store().start(ORG_A);
    store().chooseSample();

    store().skip();
    await flushBackendWrite();

    expect(mockApiPut).toHaveBeenCalledWith('/api/userpreferences/trial-walkthrough', {
      flow: 'insights',
      skipped: true,
    });
    expect(getStoredPath('insights')).toBeNull();
  });

  it('keeps everything local when the backend write fails, so nothing is lost', async () => {
    mockApiPut.mockRejectedValue(new Error('offline'));
    store().start(ORG_A);
    store().chooseOwnData();
    markKpiCreated();

    store().finish();
    await flushBackendWrite();

    expect(getStoredPath('insights')).toBe('own_data');
    expect(hasKpiCreated()).toBe(true);
    expect(hasFinishedWalkthrough('insights')).toBe(true);
  });

  it("wipes only the finishing org, never another org's progress", async () => {
    setWalkthroughScope(USER_A, ORG_B);
    markKpiCreated();
    setWalkthroughScope(USER_A, ORG_A);
    store().start(ORG_A);
    store().chooseSample();

    store().finish();
    await flushBackendWrite();

    expect(getStoredPath('insights')).toBeNull();
    setWalkthroughScope(USER_A, ORG_B);
    expect(hasKpiCreated()).toBe(true);
  });

  it('finish() clears the tracked connection', () => {
    store().start(ORG_A);
    store().chooseOwnData();
    store().trackConnection('conn-123');
    store().finish();
    expect(getStoredTrackedConnection('insights')).toBeNull();
    expect(store().trackedConnectionId).toBeNull();
  });

  it('resume() restores path + trackedConnectionId from storage', () => {
    store().start(ORG_A);
    store().chooseOwnData();
    store().trackConnection('conn-123');
    useInsightWalkthroughStore.setState({ active: false, orgSlug: null, flow: null, stage: null });
    store().resume(ORG_A);
    expect(store().path).toBe('own_data');
    expect(store().trackedConnectionId).toBe('conn-123');
  });

  it('startAutomatePipeline() sets path + stage and persists both, with no fork2 step', () => {
    store().startAutomatePipeline(ORG_A);
    expect(store().active).toBe(true);
    expect(store().path).toBe('automate_pipeline');
    // The Ingest sidebar nudge, not /ingest itself — starting this flow doesn't navigate.
    expect(store().stage).toBe('pipeline_ingest_nudge');
    expect(getStoredPath('automate_pipeline')).toBe('automate_pipeline');
    expect(getStoredWalkthroughStage('automate_pipeline')).toBe('pipeline_ingest_nudge');
  });
});
