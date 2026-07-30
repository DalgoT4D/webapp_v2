import {
  WALKTHROUGH_STAGE_ORDER,
  getStoredWalkthroughStage,
  saveWalkthroughStage,
  clearWalkthroughState,
  markWalkthroughDone,
  hasFinishedWalkthrough,
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

  it('orders fork2 first and share last', () => {
    expect(WALKTHROUGH_STAGE_ORDER[0]).toBe('fork2');
    expect(WALKTHROUGH_STAGE_ORDER[WALKTHROUGH_STAGE_ORDER.length - 1]).toBe('share');
  });
});
