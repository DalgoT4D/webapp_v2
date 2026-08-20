import { create } from 'zustand';
import { useSidebarStore } from '@/stores/sidebarStore';
import { trackEvent } from '@/lib/analytics';
import {
  startOnboardingPath,
  resumeOnboardingPath,
  trackOnboardingPathStage,
  completeOnboardingPath,
  exitOnboardingPath,
} from '@/lib/onboarding-analytics';
import {
  ANALYTICS_EVENTS,
  ONBOARDING_PATHS,
  WALKTHROUGH_ENTRIES,
  type OnboardingPath,
  type WalkthroughEntry,
} from '@/constants/analytics';
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
  saveDismissedSyncRun,
  SYNC_RETRY_STAGE_FOR,
  SYNC_WAIT_STAGES,
  stageOrderFor,
} from '@/components/onboarding/insight-walkthrough-constants';

/**
 * The walkthrough's own fork name → the analytics path name. Separate vocabularies on purpose:
 * the store's `path` names branches of the insight walkthrough, while the analytics path is
 * one flat list across ALL onboarding walkthroughs (the product tour included).
 *
 * Null until a fork is chosen, and callers then report nothing — see the path-analytics test.
 */
const ANALYTICS_PATH_FOR: Record<WalkthroughPath, OnboardingPath> = {
  sample: ONBOARDING_PATHS.INSIGHT_SAMPLE,
  own_data: ONBOARDING_PATHS.INSIGHT_OWN_DATA,
  automate_pipeline: ONBOARDING_PATHS.PIPELINE,
};

/** Position of `stage` in its fork's order, or undefined when the stage isn't in it. */
function stageIndexFor(path: WalkthroughPath, stage: WalkthroughStage): number | undefined {
  const index = stageOrderFor(path).indexOf(stage);
  return index === -1 ? undefined : index;
}

function reportStage(path: WalkthroughPath | null, stage: WalkthroughStage): void {
  if (!path) return;
  trackOnboardingPathStage(ANALYTICS_PATH_FOR[path], stage, {
    stageIndex: stageIndexFor(path, stage),
  });
}

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
  /**
   * The Airbyte job id of the failed sync the 'sync_failed' coachmark is currently reporting,
   * so dismissing it can record WHICH failure was acknowledged (see dismissSyncFailure).
   *
   * Transient (not persisted): tour-gate's checkpoint re-derives it from the connections
   * response on every load, and the acknowledgement itself is what gets persisted.
   */
  syncFailedRunId: string | null;
  start: (orgSlug: string) => void;
  resume: (orgSlug: string, flow?: WalkthroughFlow) => void;
  advanceTo: (stage: WalkthroughStage) => void;
  /** advanceTo, but never backwards — see isStageBefore. */
  advanceIfBefore: (stage: WalkthroughStage) => void;
  setTargetNodeId: (nodeId: string | null) => void;
  /** @param opts.entry - which surface sent them here (see WALKTHROUGH_ENTRIES). */
  chooseSample: (opts?: { entry?: WalkthroughEntry }) => void;
  chooseOwnData: (opts?: { entry?: WalkthroughEntry }) => void;
  /** Build-insights entered with real data already in place — see the action below. */
  startChartFlow: (orgSlug: string) => void;
  startAutomatePipeline: (orgSlug: string) => void;
  trackConnection: (connectionId: string) => void;
  /** Stop watching the tracked connection — it's gone (see the action). */
  untrackConnection: () => void;
  setSyncFailedRunId: (runId: string | null) => void;
  /** "Got it" on the sync-failure coachmark — see the action for what it does and why. */
  dismissSyncFailure: () => void;
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
  syncFailedRunId: null,

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
    const path = getStoredPath(flow);
    if (path) resumeOnboardingPath(ANALYTICS_PATH_FOR[path], stage);
    set({
      active: true,
      orgSlug,
      flow,
      stage,
      path,
      trackedConnectionId: getStoredTrackedConnection(flow),
    });
  },

  advanceTo: (stage) => {
    const { orgSlug, flow, path } = get();
    if (!orgSlug || !flow) return;
    saveWalkthroughStage(flow, stage);
    trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_STEP_VIEWED, { stage });
    reportStage(path, stage);
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

  chooseSample: (opts) => {
    const orgSlug = get().orgSlug;
    if (!orgSlug) return;
    savePath('insights', 'sample');
    saveWalkthroughStage('insights', 'kpi_intro');
    trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_STEP_VIEWED, { stage: 'kpi_intro' });
    // The fork choice is where this path's clock starts — start() has no path to attribute to.
    startOnboardingPath(ONBOARDING_PATHS.INSIGHT_SAMPLE, opts);
    reportStage('sample', 'kpi_intro');
    set({ flow: 'insights', path: 'sample', stage: 'kpi_intro' });
  },

  chooseOwnData: (opts) => {
    const orgSlug = get().orgSlug;
    if (!orgSlug) return;
    savePath('insights', 'own_data');
    saveWalkthroughStage('insights', 'own_data_ingest');
    trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_STEP_VIEWED, { stage: 'own_data_ingest' });
    startOnboardingPath(ONBOARDING_PATHS.INSIGHT_OWN_DATA, opts);
    reportStage('own_data', 'own_data_ingest');
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
    startOnboardingPath(ONBOARDING_PATHS.INSIGHT_OWN_DATA, {
      entry: WALKTHROUGH_ENTRIES.CHART,
    });
    set({
      active: true,
      orgSlug,
      flow: 'insights',
      stage: CHART_ENTRY_STAGE,
      path: 'own_data',
      trackedConnectionId: null,
    });
  },

  // No fork2 screen for this path — picking it in the GetStartedModal starts the flow outright.
  // It opens on the Ingest sidebar nudge and does NOT navigate: the caller used to push
  // /ingest immediately, which moved the user somewhere they hadn't asked to go. They click
  // Ingest themselves and the nudge's route advance takes it from there. Writes only into the
  // 'automate_pipeline' namespace, so a build-insights run left half-finished is untouched and
  // still resumable.
  startAutomatePipeline: (orgSlug) => {
    saveActiveWalkthroughFlow('automate_pipeline');
    savePath('automate_pipeline', 'automate_pipeline');
    saveWalkthroughStage('automate_pipeline', 'pipeline_ingest_nudge');
    trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_STARTED, { path: 'automate_pipeline' });
    startOnboardingPath(ONBOARDING_PATHS.PIPELINE);
    set({
      active: true,
      orgSlug,
      flow: 'automate_pipeline',
      stage: 'pipeline_ingest_nudge',
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

  /**
   * The tracked connection no longer exists — the user deleted it, typically after a failed
   * sync, to start over.
   *
   * Puts them back on their fork's ingest stage AND drops the tracking, which is what makes
   * that stage visible again (it's silenced precisely while a connection is being watched).
   * Without this the walkthrough sat on a holding stage forever, waiting on a connection that
   * was never coming back and pointing its coachmark at a table row that no longer rendered.
   *
   * The rewind happens ONLY while the flow is still waiting on that first sync. Past that point
   * the connection has already done its job — the user is on transform, or building a chart —
   * and losing sight of it (deleted after it synced, or simply absent from a stale list) is no
   * reason to send them back to "connect your data", which is what made a finished ingest look
   * like it had never happened.
   */
  untrackConnection: () => {
    const { flow, path, stage } = get();
    if (!flow) return;
    clearTrackedConnection(flow);
    set({ trackedConnectionId: null, syncFailedRunId: null });
    const stillAwaitingFirstSync = Boolean(stage && SYNC_WAIT_STAGES.includes(stage));
    if (stillAwaitingFirstSync && (path === 'own_data' || path === 'automate_pipeline')) {
      get().advanceTo(SYNC_RETRY_STAGE_FOR[path]);
    }
  },

  setSyncFailedRunId: (runId) => {
    // Guarded: the checkpoint re-runs on every poll while a failure is on screen, and an
    // unconditional set() would wake every subscriber a few times a second for no change.
    if (get().syncFailedRunId === runId) return;
    set({ syncFailedRunId: runId });
  },

  /**
   * Acknowledge the failed sync the coachmark is reporting, and get out of the way.
   *
   * Records WHICH run was acknowledged (by Airbyte job id) so this exact failure never shows
   * again — including after a reload — while a retry that fails is a new job id and does. Then
   * hands the user back to their fork's ingest stage, which is silent while a tracked
   * connection exists, so nothing is on screen while they retry the sync or connect a
   * different source. Either of those rejoins the flow on its own: the checkpoint keeps
   * watching, and a success advances straight past both holding stages.
   */
  dismissSyncFailure: () => {
    const { flow, path, syncFailedRunId } = get();
    if (!flow) return;
    if (syncFailedRunId) saveDismissedSyncRun(flow, syncFailedRunId);
    if (path === 'own_data' || path === 'automate_pipeline') {
      get().advanceTo(SYNC_RETRY_STAGE_FOR[path]);
    }
  },

  setSuppressCoachmark: (suppressed) => set({ suppressCoachmark: suppressed }),

  setPendingCelebration: (celebration) => set({ pendingCelebration: celebration }),

  setTargetNodeId: (nodeId) => set({ targetNodeId: nodeId }),

  skip: () => {
    // Both flows end on a page that collapsed the sidebar on arrival (a saved dashboard, the
    // canvas), and nothing else ever expands it again. Whether they finished or quit, the user
    // is now on their own and needs the labelled menu back to find anything.
    useSidebarStore.getState().setCollapsed(false);
    const { orgSlug, stage, flow, path } = get();
    if (orgSlug && flow) {
      clearWalkthroughState(flow);
      clearTrackedConnection(flow);
      clearActiveWalkthroughFlow();
      trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_SKIPPED, { stage });
      if (path) exitOnboardingPath(ANALYTICS_PATH_FOR[path], stage);
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
    // See skip() — the flow ends on a collapsed page and the menu has to come back.
    useSidebarStore.getState().setCollapsed(false);
    const { orgSlug, flow, path } = get();
    if (orgSlug && flow) {
      clearWalkthroughState(flow);
      clearTrackedConnection(flow);
      clearActiveWalkthroughFlow();
      markWalkthroughDone(flow);
      trackEvent(ANALYTICS_EVENTS.INSIGHT_WALKTHROUGH_COMPLETED);
      if (path) completeOnboardingPath(ANALYTICS_PATH_FOR[path]);
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
