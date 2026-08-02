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
  getStoredOwnDataConnection,
  saveOwnDataConnection,
  clearOwnDataConnection,
} from '@/components/onboarding/insight-walkthrough-constants';

interface InsightWalkthroughState {
  active: boolean;
  orgSlug: string | null;
  stage: WalkthroughStage | null;
  /** Which fork the user took at fork2 — null until they choose. Unlike `stage`,
   * survives skip()/finish() so the getting-started widget can read it afterward. */
  path: WalkthroughPath | null;
  /** Connection created during the own-data fork, tracked so a later page load can
   * check whether THIS connection (not just any connection in the org) has synced. */
  ownDataConnectionId: string | null;
  /** True while a plain interaction (e.g. a picker modal) is covering the spotlighted
   * target — the coachmark hides rather than darkening content it doesn't own. */
  suppressCoachmark: boolean;
  start: (orgSlug: string) => void;
  resume: (orgSlug: string) => void;
  advanceTo: (stage: WalkthroughStage) => void;
  chooseSample: () => void;
  chooseOwnData: () => void;
  trackOwnDataConnection: (connectionId: string) => void;
  setSuppressCoachmark: (suppressed: boolean) => void;
  skip: () => void;
  finish: () => void;
}

export const useInsightWalkthroughStore = create<InsightWalkthroughState>((set, get) => ({
  active: false,
  orgSlug: null,
  stage: null,
  path: null,
  ownDataConnectionId: null,
  suppressCoachmark: false,

  start: (orgSlug) => {
    saveWalkthroughStage(orgSlug, 'fork2');
    trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_STARTED);
    set({ active: true, orgSlug, stage: 'fork2', path: null, ownDataConnectionId: null });
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
      ownDataConnectionId: getStoredOwnDataConnection(orgSlug),
    });
  },

  advanceTo: (stage) => {
    const orgSlug = get().orgSlug;
    if (!orgSlug) return;
    saveWalkthroughStage(orgSlug, stage);
    trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_STEP_VIEWED, { stage });
    set({ stage });
  },

  // Persists path 'sample' even though nothing downstream reads it for the sample
  // path itself — overwrites any stale 'own_data' left by a prior abandoned attempt,
  // which would otherwise mis-check "Connect your own data" in the getting-started
  // widget once this (sample) walkthrough completes.
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

  trackOwnDataConnection: (connectionId) => {
    const orgSlug = get().orgSlug;
    if (!orgSlug) return;
    saveOwnDataConnection(orgSlug, connectionId);
    set({ ownDataConnectionId: connectionId });
  },

  setSuppressCoachmark: (suppressed) => set({ suppressCoachmark: suppressed }),

  skip: () => {
    const { orgSlug, stage } = get();
    if (orgSlug) {
      clearWalkthroughState(orgSlug);
      clearOwnDataConnection(orgSlug);
      trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_SKIPPED, { stage });
    }
    set({ active: false, orgSlug: null, stage: null, ownDataConnectionId: null });
  },

  finish: () => {
    const orgSlug = get().orgSlug;
    if (orgSlug) {
      clearWalkthroughState(orgSlug);
      clearOwnDataConnection(orgSlug);
      markWalkthroughDone(orgSlug);
      trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_COMPLETED);
    }
    set({ active: false, orgSlug: null, stage: null, ownDataConnectionId: null });
  },
}));
