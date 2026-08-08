import { create } from 'zustand';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { saveTrialWalkthroughFlow } from '@/hooks/api/useTrialWalkthrough';
import {
  type WalkthroughStage,
  type WalkthroughPath,
  type WalkthroughFlow,
  isStageBefore,
  getStoredWalkthroughStage,
  getResumeAnchorStage,
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
  CHART_ENTRY_STAGE,
  saveActiveWalkthroughFlow,
  clearActiveWalkthroughFlow,
} from '@/components/onboarding/insight-walkthrough-constants';

interface InsightWalkthroughState {
  active: boolean;
  orgSlug: string | null;
  /**
   * Which of the independently-runnable walkthroughs is currently driving the coachmark.
   * Only one is ever on screen — starting the other SWITCHES to it rather than running both,
   * and because each flow's stage/path/connection live under their own storage keys, the one
   * switched away from is preserved exactly where it was and resumes intact.
   */
  flow: WalkthroughFlow | null;
  stage: WalkthroughStage | null;
  /** Which fork the user took — null until they choose. Unlike `stage`, survives
   * skip()/finish() so the getting-started widget can read it afterward. */
  path: WalkthroughPath | null;
  /** Connection created during the own-data or automate-pipeline fork, tracked so a
   * later page load can check whether THIS connection (not just any connection in the
   * org) has synced. Stored per flow, so each walkthrough watches the connection it made. */
  trackedConnectionId: string | null;
  /** True while a plain interaction (e.g. a picker modal) is covering the spotlighted
   * target — the coachmark hides rather than darkening content it doesn't own. */
  suppressCoachmark: boolean;
  /**
   * A celebration raised by one route for another route to render.
   *
   * Both cases put the dialog on the thing the user just built, not on the form they're
   * leaving — the chart on its own page, the pipeline on the pipeline list — so the handler
   * that knows the moment happened can't render the dialog itself. It raises this and
   * navigates; the destination consumes it.
   *
   * Transient (never persisted): a reload loses the celebration, which is the right trade for
   * a moment that only makes sense immediately after the action.
   */
  pendingCelebration: 'chart' | 'pipeline' | null;
  /** The canvas node id 'pipeline_select_node' should highlight — set right before
   * advancing to that stage, since the node's DOM id isn't known until it's created.
   * Transient (not persisted): a page reload mid-walkthrough just re-highlights nothing
   * until the user acts again. */
  targetNodeId: string | null;
  start: (orgSlug: string) => void;
  resume: (orgSlug: string, flow?: WalkthroughFlow) => void;
  advanceTo: (stage: WalkthroughStage) => void;
  /** advanceTo, but never backwards — see isStageBefore. */
  advanceIfBefore: (stage: WalkthroughStage) => void;
  setTargetNodeId: (nodeId: string | null) => void;
  chooseSample: () => void;
  chooseOwnData: () => void;
  /** Build-insights entered with real data already in place — see the action below. */
  startChartFlow: (orgSlug: string) => void;
  startAutomatePipeline: (orgSlug: string) => void;
  trackConnection: (connectionId: string) => void;
  setSuppressCoachmark: (suppressed: boolean) => void;
  setPendingCelebration: (celebration: 'chart' | 'pipeline' | null) => void;
  skip: () => void;
  finish: () => void;
}

export const useInsightWalkthroughStore = create<InsightWalkthroughState>((set, get) => ({
  active: false,
  orgSlug: null,
  flow: null,
  stage: null,
  path: null,
  trackedConnectionId: null,
  suppressCoachmark: false,
  pendingCelebration: null,
  targetNodeId: null,

  start: (orgSlug) => {
    saveActiveWalkthroughFlow('insights');
    saveWalkthroughStage('insights', 'fork2');
    trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_STARTED);
    set({
      active: true,
      orgSlug,
      flow: 'insights',
      stage: 'fork2',
      path: null,
      trackedConnectionId: null,
    });
  },

  resume: (orgSlug, flow = 'insights') => {
    if (hasFinishedWalkthrough(flow)) return;
    const stored = getStoredWalkthroughStage(flow);
    if (!stored) return;
    // A reload wipes whatever the stored stage was anchored to — an open KPI dialog, an
    // unsaved dashboard, a selected canvas node. Resuming as-is leaves the coachmark waiting
    // on a selector that will never appear, which reads as the walkthrough vanishing on
    // refresh. Rewind to the last stage reachable from a cold page load instead.
    const stage = getResumeAnchorStage(stored);
    if (stage !== stored) saveWalkthroughStage(flow, stage);
    saveActiveWalkthroughFlow(flow);
    set({
      active: true,
      orgSlug,
      flow,
      stage,
      path: getStoredPath(flow),
      trackedConnectionId: getStoredTrackedConnection(flow),
    });
  },

  advanceTo: (stage) => {
    const { orgSlug, flow } = get();
    if (!orgSlug || !flow) return;
    saveWalkthroughStage(flow, stage);
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
    savePath('insights', 'sample');
    saveWalkthroughStage('insights', 'kpi_intro');
    trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_STEP_VIEWED, { stage: 'kpi_intro' });
    set({ flow: 'insights', path: 'sample', stage: 'kpi_intro' });
  },

  chooseOwnData: () => {
    const orgSlug = get().orgSlug;
    if (!orgSlug) return;
    savePath('insights', 'own_data');
    saveWalkthroughStage('insights', 'own_data_ingest');
    trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_STEP_VIEWED, { stage: 'own_data_ingest' });
    set({ flow: 'insights', path: 'own_data', stage: 'own_data_ingest' });
  },

  /**
   * Starts build-insights at the chart tail, skipping fork2 entirely.
   *
   * For a user who already has their own data in the platform — typically because they just
   * finished the automate-pipeline walkthrough. Asking "sample data or your own data?" at that
   * point is a question with an obvious answer and no useful branch: their data is right there.
   * Runs under path 'own_data' so isStageBefore reads the order that actually contains the
   * chart tail (OWN_DATA_WALKTHROUGH_STAGE_ORDER).
   */
  startChartFlow: (orgSlug) => {
    saveActiveWalkthroughFlow('insights');
    savePath('insights', 'own_data');
    saveWalkthroughStage('insights', CHART_ENTRY_STAGE);
    trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_STARTED, { path: 'own_data', entry: 'chart' });
    set({
      active: true,
      orgSlug,
      flow: 'insights',
      stage: CHART_ENTRY_STAGE,
      path: 'own_data',
      trackedConnectionId: null,
    });
  },

  // No fork2 screen for this path — the GetStartedModal's caller navigates straight to /ingest,
  // this action just flips the store state before that navigation happens. Writes only into the
  // 'automate_pipeline' namespace, so a build-insights run left half-finished is untouched and
  // still resumable.
  startAutomatePipeline: (orgSlug) => {
    saveActiveWalkthroughFlow('automate_pipeline');
    savePath('automate_pipeline', 'automate_pipeline');
    saveWalkthroughStage('automate_pipeline', 'pipeline_ingest');
    trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_STARTED, { path: 'automate_pipeline' });
    set({
      active: true,
      orgSlug,
      flow: 'automate_pipeline',
      stage: 'pipeline_ingest',
      path: 'automate_pipeline',
      trackedConnectionId: null,
    });
  },

  trackConnection: (connectionId) => {
    const { orgSlug, flow } = get();
    if (!orgSlug || !flow) return;
    saveTrackedConnection(flow, connectionId);
    set({ trackedConnectionId: connectionId });
  },

  setSuppressCoachmark: (suppressed) => set({ suppressCoachmark: suppressed }),

  setPendingCelebration: (celebration) => set({ pendingCelebration: celebration }),

  setTargetNodeId: (nodeId) => set({ targetNodeId: nodeId }),

  skip: () => {
    const { orgSlug, stage, flow } = get();
    if (orgSlug && flow) {
      clearWalkthroughState(flow);
      clearTrackedConnection(flow);
      clearActiveWalkthroughFlow();
      trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_SKIPPED, { stage });
      void resolveFlow(flow, 'skipped');
    }
    // Abandoning the flow cancels any celebration queued for it — congratulating someone on
    // a walkthrough they just quit reads as a bug.
    set({
      active: false,
      orgSlug: null,
      flow: null,
      stage: null,
      trackedConnectionId: null,
      pendingCelebration: null,
    });
  },

  finish: () => {
    const { orgSlug, flow } = get();
    if (orgSlug && flow) {
      clearWalkthroughState(flow);
      clearTrackedConnection(flow);
      clearActiveWalkthroughFlow();
      markWalkthroughDone(flow);
      trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_COMPLETED);
      void resolveFlow(flow, 'completed');
    }
    // pendingCelebration deliberately survives: the automate-pipeline flow's celebration is
    // raised BY finishing it, and the pipeline list renders it a route later.
    set({
      active: false,
      orgSlug: null,
      flow: null,
      stage: null,
      trackedConnectionId: null,
    });
  },
}));

/**
 * Hands a resolved flow to the backend — the permanent record from here on — and only then
 * drops that flow's local scratch space.
 *
 * Order matters: if the write fails (offline, backend down) the local state stays exactly as
 * it was, so this browser still suppresses the flow and can still resume it. Clearing first
 * would lose both.
 *
 * Only THIS flow's keys are dropped. The other walkthrough may be mid-run, and the shared
 * milestones are facts about work already done — see clearWalkthroughStorage.
 */
async function resolveFlow(flow: WalkthroughFlow, outcome: 'skipped' | 'completed'): Promise<void> {
  const saved = await saveTrialWalkthroughFlow(flow, outcome);
  if (saved) clearWalkthroughStorage(flow);
}
