import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import {
  getStoredWalkthroughStage,
  hasFinishedWalkthrough,
} from '../insight-walkthrough-constants';

describe('insightWalkthroughStore', () => {
  beforeEach(() => {
    localStorage.clear();
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
});
