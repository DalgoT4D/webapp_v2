import { create } from 'zustand';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import {
  type WalkthroughStage,
  type WalkthroughPath,
  getStoredWalkthroughStage,
  saveWalkthroughStage,
  clearWalkthroughState,
  markWalkthroughDone,
  hasFinishedWalkthrough,
  getStoredPath,
  savePath,
  getStoredTrackedConnection,
  saveTrackedConnection,
  clearTrackedConnection,
} from '@/components/onboarding/insight-walkthrough-constants';

interface InsightWalkthroughState {
  active: boolean;
  orgSlug: string | null;
  stage: WalkthroughStage | null;
  /** Which fork the user took — null until they choose. Unlike `stage`, survives
   * skip()/finish() so the getting-started widget can read it afterward. */
  path: WalkthroughPath | null;
  /** Connection created during the own-data or automate-pipeline fork, tracked so a
   * later page load can check whether THIS connection (not just any connection in the
   * org) has synced. Only one fork is ever active at a time, so one field covers both. */
  trackedConnectionId: string | null;
  /** True while a plain interaction (e.g. a picker modal) is covering the spotlighted
   * target — the coachmark hides rather than darkening content it doesn't own. */
  suppressCoachmark: boolean;
  start: (orgSlug: string) => void;
  resume: (orgSlug: string) => void;
  advanceTo: (stage: WalkthroughStage) => void;
  chooseSample: () => void;
  chooseOwnData: () => void;
  startAutomatePipeline: (orgSlug: string) => void;
  trackConnection: (connectionId: string) => void;
  setSuppressCoachmark: (suppressed: boolean) => void;
  skip: () => void;
  finish: () => void;
}

export const useInsightWalkthroughStore = create<InsightWalkthroughState>((set, get) => ({
  active: false,
  orgSlug: null,
  stage: null,
  path: null,
  trackedConnectionId: null,
  suppressCoachmark: false,

  start: (orgSlug) => {
    saveWalkthroughStage(orgSlug, 'fork2');
    trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_STARTED);
    set({ active: true, orgSlug, stage: 'fork2', path: null, trackedConnectionId: null });
  },

  resume: (orgSlug) => {
    if (hasFinishedWalkthrough(orgSlug)) return;
    const stage = getStoredWalkthroughStage(orgSlug);
    if (!stage) return;
    set({
      active: true,
      orgSlug,
      stage,
      path: getStoredPath(orgSlug),
      trackedConnectionId: getStoredTrackedConnection(orgSlug),
    });
  },

  advanceTo: (stage) => {
    const orgSlug = get().orgSlug;
    if (!orgSlug) return;
    saveWalkthroughStage(orgSlug, stage);
    trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_STEP_VIEWED, { stage });
    set({ stage });
  },

  chooseSample: () => {
    const orgSlug = get().orgSlug;
    if (!orgSlug) return;
    savePath(orgSlug, 'sample');
    saveWalkthroughStage(orgSlug, 'kpi_intro');
    trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_STEP_VIEWED, { stage: 'kpi_intro' });
    set({ path: 'sample', stage: 'kpi_intro' });
  },

  chooseOwnData: () => {
    const orgSlug = get().orgSlug;
    if (!orgSlug) return;
    savePath(orgSlug, 'own_data');
    saveWalkthroughStage(orgSlug, 'own_data_ingest');
    trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_STEP_VIEWED, { stage: 'own_data_ingest' });
    set({ path: 'own_data', stage: 'own_data_ingest' });
  },

  // No fork2 screen for this path — PostTourModal navigates straight to /ingest itself,
  // this action just flips the store state before that navigation happens.
  startAutomatePipeline: (orgSlug) => {
    savePath(orgSlug, 'automate_pipeline');
    saveWalkthroughStage(orgSlug, 'pipeline_ingest');
    trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_STARTED, { path: 'automate_pipeline' });
    set({
      active: true,
      orgSlug,
      stage: 'pipeline_ingest',
      path: 'automate_pipeline',
      trackedConnectionId: null,
    });
  },

  trackConnection: (connectionId) => {
    const orgSlug = get().orgSlug;
    if (!orgSlug) return;
    saveTrackedConnection(orgSlug, connectionId);
    set({ trackedConnectionId: connectionId });
  },

  setSuppressCoachmark: (suppressed) => set({ suppressCoachmark: suppressed }),

  skip: () => {
    const { orgSlug, stage } = get();
    if (orgSlug) {
      clearWalkthroughState(orgSlug);
      clearTrackedConnection(orgSlug);
      trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_SKIPPED, { stage });
    }
    set({ active: false, orgSlug: null, stage: null, trackedConnectionId: null });
  },

  finish: () => {
    const orgSlug = get().orgSlug;
    if (orgSlug) {
      clearWalkthroughState(orgSlug);
      clearTrackedConnection(orgSlug);
      markWalkthroughDone(orgSlug);
      trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_COMPLETED);
    }
    set({ active: false, orgSlug: null, stage: null, trackedConnectionId: null });
  },
}));
