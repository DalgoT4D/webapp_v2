import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { mockApiPut } from '@/test-utils/api';
import {
  getStoredWalkthroughStage,
  hasFinishedWalkthrough,
  getStoredPath,
  getStoredTrackedConnection,
  markKpiCreated,
  hasKpiCreated,
} from '../insight-walkthrough-constants';

/** finish()/skip() write to the backend before clearing — let that promise settle. */
const flushBackendWrite = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('insightWalkthroughStore', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    mockApiPut.mockResolvedValue({ success: true });
    useInsightWalkthroughStore.setState({ active: false, orgSlug: null, stage: null });
  });

  it('start() activates at fork2 and persists it', () => {
    useInsightWalkthroughStore.getState().start('org-a');
    const state = useInsightWalkthroughStore.getState();
    expect(state.active).toBe(true);
    expect(state.stage).toBe('fork2');
    expect(getStoredWalkthroughStage('org-a')).toBe('fork2');
  });

  it('advanceTo() moves to an explicit stage and persists it', () => {
    useInsightWalkthroughStore.getState().start('org-a');
    useInsightWalkthroughStore.getState().advanceTo('kpi_intro');
    expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_intro');
    expect(getStoredWalkthroughStage('org-a')).toBe('kpi_intro');
  });

  it('advanceTo("share") followed by finish() marks done and deactivates', () => {
    useInsightWalkthroughStore.getState().start('org-a');
    useInsightWalkthroughStore.getState().advanceTo('share');
    useInsightWalkthroughStore.getState().finish();
    const state = useInsightWalkthroughStore.getState();
    expect(state.active).toBe(false);
    expect(hasFinishedWalkthrough('org-a')).toBe(true);
  });

  it('skip() deactivates without marking done', () => {
    useInsightWalkthroughStore.getState().start('org-a');
    useInsightWalkthroughStore.getState().skip();
    const state = useInsightWalkthroughStore.getState();
    expect(state.active).toBe(false);
    expect(hasFinishedWalkthrough('org-a')).toBe(false);
  });

  it('advanceIfBefore moves forward but never backwards', () => {
    useInsightWalkthroughStore.getState().start('org-a');
    useInsightWalkthroughStore.getState().chooseSample();
    useInsightWalkthroughStore.getState().advanceTo('kpi_submit');

    // A late hint firing after the user has already moved on must not rewind them.
    useInsightWalkthroughStore.getState().advanceIfBefore('kpi_target');
    expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_submit');

    useInsightWalkthroughStore.getState().advanceIfBefore('dashboard_nudge');
    expect(useInsightWalkthroughStore.getState().stage).toBe('dashboard_nudge');
  });

  it('advanceIfBefore catches up a stage the user skipped past', () => {
    useInsightWalkthroughStore.getState().start('org-a');
    useInsightWalkthroughStore.getState().chooseSample();
    // Left the defaulted Direction dropdown alone, so its change-driven advance never fired.
    useInsightWalkthroughStore.getState().advanceTo('kpi_direction');

    // Clicking Continue is the checkpoint — it should pull them forward regardless.
    useInsightWalkthroughStore.getState().advanceIfBefore('kpi_type');

    expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_type');
  });

  it('advanceIfBefore reads the order of the fork actually being run', () => {
    useInsightWalkthroughStore.getState().startAutomatePipeline('org-a');
    useInsightWalkthroughStore.getState().advanceTo('pipeline_orchestrate_intro');

    // pipeline_pick_table is earlier in AUTOMATE_PIPELINE_STAGE_ORDER — no rewind.
    useInsightWalkthroughStore.getState().advanceIfBefore('pipeline_pick_table');
    expect(useInsightWalkthroughStore.getState().stage).toBe('pipeline_orchestrate_intro');

    useInsightWalkthroughStore.getState().advanceIfBefore('pipeline_create_it');
    expect(useInsightWalkthroughStore.getState().stage).toBe('pipeline_create_it');
  });

  it('resume() re-activates at a previously stored stage', () => {
    useInsightWalkthroughStore.getState().start('org-a');
    useInsightWalkthroughStore.getState().advanceTo('builder_save');
    useInsightWalkthroughStore.setState({ active: false, orgSlug: null, stage: null });
    useInsightWalkthroughStore.getState().resume('org-a');
    expect(useInsightWalkthroughStore.getState().stage).toBe('builder_save');
    expect(useInsightWalkthroughStore.getState().active).toBe(true);
  });

  it('resume() does nothing if the walkthrough was already finished', () => {
    useInsightWalkthroughStore.getState().start('org-a');
    useInsightWalkthroughStore.getState().advanceTo('share');
    useInsightWalkthroughStore.getState().finish();
    useInsightWalkthroughStore.getState().resume('org-a');
    expect(useInsightWalkthroughStore.getState().active).toBe(false);
  });

  it('chooseOwnData() sets path + stage and persists both', () => {
    useInsightWalkthroughStore.getState().start('org-a');
    useInsightWalkthroughStore.getState().chooseOwnData();
    const state = useInsightWalkthroughStore.getState();
    expect(state.path).toBe('own_data');
    expect(state.stage).toBe('own_data_ingest');
    expect(getStoredPath('org-a')).toBe('own_data');
    expect(getStoredWalkthroughStage('org-a')).toBe('own_data_ingest');
  });

  it('chooseSample() sets path + stage and persists both', () => {
    useInsightWalkthroughStore.getState().start('org-a');
    useInsightWalkthroughStore.getState().chooseSample();
    const state = useInsightWalkthroughStore.getState();
    expect(state.path).toBe('sample');
    expect(state.stage).toBe('kpi_intro');
    expect(getStoredPath('org-a')).toBe('sample');
  });

  it('trackConnection() persists the connection id', () => {
    useInsightWalkthroughStore.getState().start('org-a');
    useInsightWalkthroughStore.getState().chooseOwnData();
    useInsightWalkthroughStore.getState().trackConnection('conn-123');
    expect(useInsightWalkthroughStore.getState().trackedConnectionId).toBe('conn-123');
    expect(getStoredTrackedConnection('org-a')).toBe('conn-123');
  });

  it("records the completion, then wipes that org's local scratch space", async () => {
    useInsightWalkthroughStore.getState().start('org-a');
    useInsightWalkthroughStore.getState().chooseOwnData();
    markKpiCreated('org-a');
    useInsightWalkthroughStore.getState().advanceTo('share');

    useInsightWalkthroughStore.getState().finish();
    await flushBackendWrite();

    expect(mockApiPut).toHaveBeenCalledWith('/api/userpreferences/trial-walkthrough', {
      flow: 'insights',
      completed: true,
    });
    // The backend holds the record now; stale local flags would make a restarted flow think
    // this work was already done.
    expect(getStoredPath('org-a')).toBeNull();
    expect(getStoredWalkthroughStage('org-a')).toBeNull();
    expect(hasKpiCreated('org-a')).toBe(false);
    expect(hasFinishedWalkthrough('org-a')).toBe(false);
  });

  it('skip() records the skip and wipes too', async () => {
    useInsightWalkthroughStore.getState().start('org-a');
    useInsightWalkthroughStore.getState().chooseSample();

    useInsightWalkthroughStore.getState().skip();
    await flushBackendWrite();

    expect(mockApiPut).toHaveBeenCalledWith('/api/userpreferences/trial-walkthrough', {
      flow: 'insights',
      skipped: true,
    });
    expect(getStoredPath('org-a')).toBeNull();
  });

  it('keeps everything local when the backend write fails, so nothing is lost', async () => {
    mockApiPut.mockRejectedValue(new Error('offline'));
    useInsightWalkthroughStore.getState().start('org-a');
    useInsightWalkthroughStore.getState().chooseOwnData();
    markKpiCreated('org-a');

    useInsightWalkthroughStore.getState().finish();
    await flushBackendWrite();

    expect(getStoredPath('org-a')).toBe('own_data');
    expect(hasKpiCreated('org-a')).toBe(true);
    expect(hasFinishedWalkthrough('org-a')).toBe(true);
  });

  it("wipes only the finishing org, never another org's progress", async () => {
    markKpiCreated('org-b');
    useInsightWalkthroughStore.getState().start('org-a');
    useInsightWalkthroughStore.getState().chooseSample();

    useInsightWalkthroughStore.getState().finish();
    await flushBackendWrite();

    expect(getStoredPath('org-a')).toBeNull();
    expect(hasKpiCreated('org-b')).toBe(true);
  });

  it('finish() clears the tracked connection', () => {
    useInsightWalkthroughStore.getState().start('org-a');
    useInsightWalkthroughStore.getState().chooseOwnData();
    useInsightWalkthroughStore.getState().trackConnection('conn-123');
    useInsightWalkthroughStore.getState().finish();
    expect(getStoredTrackedConnection('org-a')).toBeNull();
    expect(useInsightWalkthroughStore.getState().trackedConnectionId).toBeNull();
  });

  it('resume() restores path + trackedConnectionId from storage', () => {
    useInsightWalkthroughStore.getState().start('org-a');
    useInsightWalkthroughStore.getState().chooseOwnData();
    useInsightWalkthroughStore.getState().trackConnection('conn-123');
    useInsightWalkthroughStore.setState({ active: false, orgSlug: null, stage: null });
    useInsightWalkthroughStore.getState().resume('org-a');
    const state = useInsightWalkthroughStore.getState();
    expect(state.path).toBe('own_data');
    expect(state.trackedConnectionId).toBe('conn-123');
  });

  it('startAutomatePipeline() sets path + stage and persists both, with no fork2 step', () => {
    useInsightWalkthroughStore.getState().startAutomatePipeline('org-a');
    const state = useInsightWalkthroughStore.getState();
    expect(state.active).toBe(true);
    expect(state.path).toBe('automate_pipeline');
    expect(state.stage).toBe('pipeline_ingest');
    expect(getStoredPath('org-a')).toBe('automate_pipeline');
    expect(getStoredWalkthroughStage('org-a')).toBe('pipeline_ingest');
  });
});
