import { create } from 'zustand';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import {
  saveTrialWalkthroughFlow,
  type TrialWalkthroughFlow,
} from '@/hooks/api/useTrialWalkthrough';
import {
  type WalkthroughStage,
  type WalkthroughPath,
  isStageBefore,
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
  clearWalkthroughStorage,
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
  /** The canvas node id 'pipeline_select_node' should highlight — set right before
   * advancing to that stage, since the node's DOM id isn't known until it's created.
   * Transient (not persisted): a page reload mid-walkthrough just re-highlights nothing
   * until the user acts again. */
  targetNodeId: string | null;
  start: (orgSlug: string) => void;
  resume: (orgSlug: string) => void;
  advanceTo: (stage: WalkthroughStage) => void;
  /** advanceTo, but never backwards — see isStageBefore. */
  advanceIfBefore: (stage: WalkthroughStage) => void;
  setTargetNodeId: (nodeId: string | null) => void;
  chooseSample: () => void;
  chooseOwnData: () => void;
  startAutomatePipeline: (orgSlug: string) => void;
  trackConnection: (connectionId: string) => void;
  setSuppressCoachmark: (suppressed: boolean) => void;
  skip: () => void;
  finish: () => void;
}

/**
 * Which backend flow this walkthrough counts as. Only 'automate_pipeline' is its own flow;
 * both insight forks (sample / own_data) — and a skip at fork2 before either was picked
 * (path still null) — record against 'insights'. The chosen fork itself stays in
 * localStorage: the backend only needs to know which of the three walkthroughs was run.
 */
function backendFlowFor(path: WalkthroughPath | null): TrialWalkthroughFlow {
  return path === 'automate_pipeline' ? 'automate_pipeline' : 'insights';
}

export const useInsightWalkthroughStore = create<InsightWalkthroughState>((set, get) => ({
  active: false,
  orgSlug: null,
  stage: null,
  path: null,
  trackedConnectionId: null,
  suppressCoachmark: false,
  targetNodeId: null,

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

  /**
   * What every real checkpoint (Continue, Create KPI, Save, Share) should call instead of
   * advanceTo. Coachmarks are hints, not gates: a user can leave a defaulted dropdown alone,
   * click past a field, or dismiss a popover, and the stage they're on may be behind what
   * they've actually done. Jumping forward — and only forward — rejoins them to the flow
   * rather than waiting for a step whose trigger can no longer fire.
   */
  advanceIfBefore: (stage) => {
    const { orgSlug, stage: current, path } = get();
    if (!orgSlug || !current) return;
    if (!isStageBefore(path, current, stage)) return;
    get().advanceTo(stage);
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

  // No fork2 screen for this path — the GetStartedModal's caller navigates straight to /ingest,
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

  setTargetNodeId: (nodeId) => set({ targetNodeId: nodeId }),

  skip: () => {
    const { orgSlug, stage, path } = get();
    if (orgSlug) {
      clearWalkthroughState(orgSlug);
      clearTrackedConnection(orgSlug);
      trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_SKIPPED, { stage });
      void resolveFlow(orgSlug, path, 'skipped');
    }
    set({ active: false, orgSlug: null, stage: null, trackedConnectionId: null });
  },

  finish: () => {
    const { orgSlug, path } = get();
    if (orgSlug) {
      clearWalkthroughState(orgSlug);
      clearTrackedConnection(orgSlug);
      markWalkthroughDone(orgSlug);
      trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_COMPLETED);
      void resolveFlow(orgSlug, path, 'completed');
    }
    set({ active: false, orgSlug: null, stage: null, trackedConnectionId: null });
  },
}));

/**
 * Hands a resolved flow to the backend — the permanent record from here on — and only then
 * drops this org's local scratch space.
 *
 * Order matters: if the write fails (offline, backend down) the local state stays exactly as
 * it was, so this browser still suppresses the flow and can still resume it. Clearing first
 * would lose both.
 */
async function resolveFlow(
  orgSlug: string,
  path: WalkthroughPath | null,
  outcome: 'skipped' | 'completed'
): Promise<void> {
  const saved = await saveTrialWalkthroughFlow(backendFlowFor(path), outcome);
  if (saved) clearWalkthroughStorage(orgSlug);
}
