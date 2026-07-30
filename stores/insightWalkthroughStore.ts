import { create } from 'zustand';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import {
  type WalkthroughStage,
  getStoredWalkthroughStage,
  saveWalkthroughStage,
  clearWalkthroughState,
  markWalkthroughDone,
  hasFinishedWalkthrough,
} from '@/components/onboarding/insight-walkthrough-constants';

interface InsightWalkthroughState {
  active: boolean;
  orgSlug: string | null;
  stage: WalkthroughStage | null;
  start: (orgSlug: string) => void;
  resume: (orgSlug: string) => void;
  advanceTo: (stage: WalkthroughStage) => void;
  skip: () => void;
  finish: () => void;
}

export const useInsightWalkthroughStore = create<InsightWalkthroughState>((set, get) => ({
  active: false,
  orgSlug: null,
  stage: null,

  start: (orgSlug) => {
    saveWalkthroughStage(orgSlug, 'fork2');
    trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_STARTED);
    set({ active: true, orgSlug, stage: 'fork2' });
  },

  resume: (orgSlug) => {
    if (hasFinishedWalkthrough(orgSlug)) return;
    const stage = getStoredWalkthroughStage(orgSlug);
    if (!stage) return;
    set({ active: true, orgSlug, stage });
  },

  advanceTo: (stage) => {
    const orgSlug = get().orgSlug;
    if (!orgSlug) return;
    saveWalkthroughStage(orgSlug, stage);
    trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_STEP_VIEWED, { stage });
    set({ stage });
  },

  skip: () => {
    const { orgSlug, stage } = get();
    if (orgSlug) {
      clearWalkthroughState(orgSlug);
      trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_SKIPPED, { stage });
    }
    set({ active: false, orgSlug: null, stage: null });
  },

  finish: () => {
    const orgSlug = get().orgSlug;
    if (orgSlug) {
      clearWalkthroughState(orgSlug);
      markWalkthroughDone(orgSlug);
      trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_COMPLETED);
    }
    set({ active: false, orgSlug: null, stage: null });
  },
}));
