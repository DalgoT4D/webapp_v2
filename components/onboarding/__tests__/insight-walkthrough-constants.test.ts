import {
  WALKTHROUGH_STAGE_ORDER,
  AUTOMATE_PIPELINE_STAGE_ORDER,
  getStoredWalkthroughStage,
  saveWalkthroughStage,
  clearWalkthroughState,
  markWalkthroughDone,
  hasFinishedWalkthrough,
  markConnectedRealData,
  hasConnectedRealData,
  markPipelineCreated,
  hasPipelineCreated,
  isStageBefore,
} from '../insight-walkthrough-constants';

describe('insight-walkthrough-constants', () => {
  beforeEach(() => localStorage.clear());

  it('has no stored stage before anything runs', () => {
    expect(getStoredWalkthroughStage('org-a')).toBeNull();
  });

  it('round-trips a saved stage', () => {
    saveWalkthroughStage('org-a', 'kpi_intro');
    expect(getStoredWalkthroughStage('org-a')).toBe('kpi_intro');
  });

  it('keys state per org slug', () => {
    saveWalkthroughStage('org-a', 'kpi_intro');
    saveWalkthroughStage('org-b', 'share');
    expect(getStoredWalkthroughStage('org-a')).toBe('kpi_intro');
    expect(getStoredWalkthroughStage('org-b')).toBe('share');
  });

  it('is not done until markWalkthroughDone is called', () => {
    expect(hasFinishedWalkthrough('org-a')).toBe(false);
    markWalkthroughDone('org-a');
    expect(hasFinishedWalkthrough('org-a')).toBe(true);
  });

  it('clearWalkthroughState removes the stage but not the done flag', () => {
    saveWalkthroughStage('org-a', 'kpi_intro');
    markWalkthroughDone('org-a');
    clearWalkthroughState('org-a');
    expect(getStoredWalkthroughStage('org-a')).toBeNull();
    expect(hasFinishedWalkthrough('org-a')).toBe(true);
  });

  it('orders fork2 first and the share-link copy last', () => {
    expect(WALKTHROUGH_STAGE_ORDER[0]).toBe('fork2');
    // Copying the public link is the final action — see dashboard-native-view.tsx.
    expect(WALKTHROUGH_STAGE_ORDER[WALKTHROUGH_STAGE_ORDER.length - 1]).toBe('share_copy_link');
  });

  it('orders pipeline_ingest first, converging into the own-data tail so it ends at the copy step', () => {
    expect(AUTOMATE_PIPELINE_STAGE_ORDER[0]).toBe('pipeline_ingest');
    expect(AUTOMATE_PIPELINE_STAGE_ORDER).toContain('pipeline_create_it');
    expect(AUTOMATE_PIPELINE_STAGE_ORDER[AUTOMATE_PIPELINE_STAGE_ORDER.length - 1]).toBe(
      'share_copy_link'
    );
  });

  it('hasConnectedRealData is false until markConnectedRealData is called, and persists per org', () => {
    expect(hasConnectedRealData('org-a')).toBe(false);
    markConnectedRealData('org-a');
    expect(hasConnectedRealData('org-a')).toBe(true);
    expect(hasConnectedRealData('org-b')).toBe(false);
  });

  it('hasPipelineCreated is false until markPipelineCreated is called, and persists per org', () => {
    expect(hasPipelineCreated('org-a')).toBe(false);
    markPipelineCreated('org-a');
    expect(hasPipelineCreated('org-a')).toBe(true);
    expect(hasPipelineCreated('org-b')).toBe(false);
  });

  it('isStageBefore treats a stage outside this fork as behind, so nothing can stall on it', () => {
    // builder_add_kpi belongs to the sample fork only; the own-data fork adds the chart first.
    expect(isStageBefore('own_data', 'builder_add_kpi', 'builder_save')).toBe(true);
    expect(isStageBefore('sample', 'kpi_target', 'kpi_submit')).toBe(true);
    expect(isStageBefore('sample', 'kpi_submit', 'kpi_target')).toBe(false);
    // Same stage is not "before" itself — a repeated checkpoint is a no-op.
    expect(isStageBefore('sample', 'kpi_submit', 'kpi_submit')).toBe(false);
  });

  it('lists the KPI wizard stages in the order its handlers actually fire them', () => {
    // Regression guard: the wizard goes Direction -> Time Column -> Continue. With Continue
    // listed first, isStageBefore called Time Column "later", so the Continue checkpoint
    // could never catch a user up from it and the flow stalled with no coach on screen.
    const order = WALKTHROUGH_STAGE_ORDER;
    expect(order.indexOf('kpi_direction')).toBeLessThan(order.indexOf('kpi_time_column'));
    expect(order.indexOf('kpi_time_column')).toBeLessThan(order.indexOf('kpi_continue'));
    expect(order.indexOf('kpi_continue')).toBeLessThan(order.indexOf('kpi_type'));
    expect(isStageBefore('sample', 'kpi_time_column', 'kpi_continue')).toBe(true);
  });
});
