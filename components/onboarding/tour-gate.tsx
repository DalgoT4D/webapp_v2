'use client';

/**
 * Mounts the guided-tour feature globally (see main-layout.tsx, alongside
 * RbacNoticeCarousel) and decides IF any of it renders: only for a trial-plan org's users.
 *
 * Two gating sources, by design (see hooks/api/useTrialWalkthrough.ts):
 *  - the backend's per-user trial_walkthrough dict says whether a flow was already
 *    skipped/completed, so we don't re-offer it — survives a cleared localStorage.
 *  - localStorage (keyed per org slug) holds mid-flow position and milestone progress.
 * Both must say "not decided" before a flow is auto-offered.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { FREE_TRIAL_PLAN_NAME } from '@/constants/trial';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { useConnectionsList } from '@/hooks/api/useConnections';
import { SyncStatus } from '@/constants/connections';
import { NEXT_PUBLIC_WEBAPP_ENVIRONMENT } from '@/constants/constants';
import type { Connection } from '@/types/connections';
import { ProductTour, type ProductTourHandle } from './product-tour';
import { TourIntentModal } from './tour-intent-modal';
import { GettingStartedWidget } from './getting-started-widget';
import {
  InsightWalkthroughCoachmark,
  WALKTHROUGH_STAGE_ROUTES,
} from './insight-walkthrough-coachmark';
import { GetStartedModal, type GetStartedEntry, type GetStartedScreen } from './get-started-modal';
import { hasSeenTour, getTourProgress } from './tour-constants';
import {
  markConnectedRealData,
  getStoredPath,
  getStoredWalkthroughStage,
  getResumeAnchorStage,
  getActiveWalkthroughFlow,
  hasConnectedRealData,
  getDismissedSyncRun,
  POST_SYNC_STAGE_FOR,
  SYNC_WAIT_STAGES,
  type WalkthroughFlow,
  type WalkthroughPath,
} from './insight-walkthrough-constants';
import { getFlowResumeStep, FLOW_RESUME_ROUTES } from './flow-resume';
import {
  useTrialWalkthrough,
  isFlowDecided,
  isFlowCompleted,
} from '@/hooks/api/useTrialWalkthrough';

const IMPACT_PATH = '/impact';

interface GetStartedModalState {
  open: boolean;
  screen: GetStartedScreen;
  entry: GetStartedEntry;
}

const CLOSED_MODAL: GetStartedModalState = { open: false, screen: 'choice', entry: 'post_tour' };

/**
 * LOCAL DEV ONLY. Waiting out a real first sync makes the walkthrough untestable on a laptop,
 * so on `NEXT_PUBLIC_WEBAPP_ENVIRONMENT=local` the checkpoint treats a sync that has merely
 * STARTED as a success and moves straight on. Every other environment — staging, production,
 * and the default when the var is unset (see constants/constants.ts) — waits for the real
 * thing.
 */
const ADVANCE_ON_SYNC_START = NEXT_PUBLIC_WEBAPP_ENVIRONMENT === 'local';

type SyncOutcome =
  /** Data landed. The walkthrough moves on to this fork's post-sync stage. */
  | 'success'
  /** The run is over and didn't succeed (failed/cancelled) — the user has to retry. */
  | 'failed'
  /** Queued or running. Nothing to do but tell the user we're watching. */
  | 'pending'
  /** Nothing has been triggered on this connection at all — see the note below. */
  | 'unknown';

/**
 * Where the tracked connection's first sync currently stands.
 *
 * `lock` and `lastRun` answer different questions and are read in that order: the backend
 * creates a TaskLock synchronously inside the trigger-sync request and DELETES it the moment
 * the flow run reaches a terminal state (see fetch_orgtask_lock_v1 in the backend), so a live
 * lock means "in flight" and its absence hands the verdict to `lastRun`.
 *
 * 'unknown' — no lock and no run — is deliberately NOT treated as a failure. It's the state a
 * connection is in for the instant between being created and its first sync being triggered,
 * and a stray revalidation landing in that window would otherwise declare a perfectly healthy
 * connection broken. The one case that genuinely stays there forever (triggerSync threw, which
 * is best-effort in connection-form-body.tsx) reports itself from that catch block instead.
 */
function classifySync(conn: Connection): SyncOutcome {
  if (ADVANCE_ON_SYNC_START && (conn.lock || conn.lastRun?.status)) return 'success';
  if (conn.lock) return 'pending';
  const status = conn.lastRun?.status;
  if (!status) return 'unknown';
  if (status === SyncStatus.SUCCESS) return 'success';
  // Only the two statuses that definitely mean "over, and not successful" count as a failure.
  // Everything else — running, queued, and any state Airbyte reports that SyncStatus doesn't
  // enumerate (its job API also has 'incomplete' and 'pending') — falls through to waiting.
  // Telling someone their live sync failed is a worse error than making them wait a bit.
  if (status === SyncStatus.FAILED || status === SyncStatus.CANCELLED) return 'failed';
  return 'pending';
}

export function TourGate() {
  const router = useRouter();
  const pathname = usePathname();
  const orgUsers = useAuthStore((s) => s.orgUsers);
  const selectedOrgSlug = useAuthStore((s) => s.selectedOrgSlug);
  const orgUser = orgUsers.find((ou) => ou.org.slug === selectedOrgSlug) ?? null;

  const tourRef = useRef<ProductTourHandle>(null);
  const hasOpenedModalRef = useRef(false);
  const hasResumedTourRef = useRef(false);
  const [intentModalOpen, setIntentModalOpen] = useState(false);
  // One dialog instance, three entry points (tour finish, the Get Started widget, and
  // resuming a stored 'fork2' stage) — see get-started-modal.tsx.
  const [getStartedModal, setGetStartedModal] = useState<GetStartedModalState>(CLOSED_MODAL);
  // The tour spotlights one region per step; the floating Get Started panel would sit on top
  // of that, covering the very content each step is pointing at. Hide it for the tour's
  // duration — this is scoped to the product tour deliberately, NOT the insight walkthrough,
  // which can stay active for days and needs the widget as its resume affordance.
  const [tourRunning, setTourRunning] = useState(false);
  // ?tour=preview bypasses the trial-plan gate — lets us QA the tour/widget on any
  // account without a real trial-plan org. Debug-only; not linked from anywhere in the UI.
  // Read directly from window.location rather than useSearchParams() so this component
  // doesn't force a Suspense boundary requirement onto every authenticated page.
  const [forcePreview, setForcePreview] = useState(false);
  useEffect(() => {
    setForcePreview(new URLSearchParams(window.location.search).get('tour') === 'preview');
  }, [pathname]);

  const isTrialOrg = forcePreview || orgUser?.subscription_plan === FREE_TRIAL_PLAN_NAME;
  const orgSlug = orgUser?.org.slug ?? null;
  // Subscribed (not read via getState) so the widget collapses the moment a flow starts,
  // wherever the user happens to be, and reopens once it ends.
  const walkthroughActive = useInsightWalkthroughStore((s) => s.active);

  // Skipped entirely for non-trial users — this component can't early-return before its
  // hooks run, so the enabled flag is what keeps the request off every other page load.
  const { walkthroughState, isLoading: walkthroughLoading } = useTrialWalkthrough(isTrialOrg);

  const runTour = useCallback((startIndex = 0) => {
    setTourRunning(true);
    tourRef.current?.startTour(startIndex);
  }, []);

  /**
   * Puts an interrupted tour back on screen. The tour holds its position in refs, so a page
   * reload (or any full remount) used to end it silently — the ✕ is meant to be the only way
   * out. A stored step index means the run never reached finish(), which clears it.
   *
   * Deliberately NOT gated on isFlowDecided, unlike the intent modal below. That backend
   * record answers "has this user ever decided about the tour", which is the right gate for
   * whether to OFFER it — but the tour is freely re-runnable from the widget, so a user who
   * skipped it months ago can be running it right now. A stored index is written by a run in
   * progress in THIS browser and cleared the moment that run ends, so it's strictly fresher
   * than the record and wins. (Gating on it here was the original bug: anyone who had ever
   * hit ✕ could never refresh mid-tour again.)
   *
   * Runs at most once per mount: the tour owns its own progress from here, and re-firing this
   * on a later render would restart it under the user.
   *
   * Deferred a macrotask (and cancelled on cleanup) so it survives React StrictMode's
   * mount/unmount/mount in dev. Starting synchronously here means the simulated unmount
   * destroys the driver instance mid-flight, which routes through onDestroyed -> skip and
   * both clears the stored step and records a skip the user never made. The flag is set
   * inside the timer for the same reason — set outside, the second pass would see it and
   * decline to resume at all.
   */
  useEffect(() => {
    if (!isTrialOrg || !orgSlug || hasResumedTourRef.current) return;
    const storedStep = getTourProgress(orgSlug);
    if (storedStep === null) return;
    const timer = setTimeout(() => {
      hasResumedTourRef.current = true;
      runTour(storedStep);
    }, 0);
    return () => clearTimeout(timer);
  }, [isTrialOrg, orgSlug, runTour]);

  useEffect(() => {
    if (!orgSlug || walkthroughLoading) return;
    const nowSeen = hasSeenTour(orgSlug);
    if (!isTrialOrg || nowSeen || pathname !== IMPACT_PATH || hasOpenedModalRef.current) return;
    // Already skipped or completed the tour on some other browser/session.
    if (isFlowDecided(walkthroughState, 'product_tour')) return;
    // Mid-run and about to be resumed by the effect above — offering to start it again on top
    // of its own popover would be nonsense.
    if (getTourProgress(orgSlug) !== null) return;
    hasOpenedModalRef.current = true;
    setIntentModalOpen(true);
  }, [isTrialOrg, orgSlug, pathname, walkthroughLoading, walkthroughState]);

  // Resume the insight walkthrough (see insight-walkthrough-coachmark.tsx) if the user
  // refreshed or navigated away mid-flow — a no-op if it was never started or already
  // finished. Waits for the backend gate so a flow resolved elsewhere doesn't briefly
  // resume from this browser's stale localStorage stage before being suppressed.
  useEffect(() => {
    if (!orgSlug || walkthroughLoading) return;
    // Both walkthroughs can hold a half-finished stage at the same time, so which one to put
    // back on screen is a real choice — take the one the user was last driving, and only fall
    // back to a fixed order when there's no pointer (older browsers, cleared key).
    const lastActive = getActiveWalkthroughFlow();
    const candidates: WalkthroughFlow[] = lastActive
      ? [lastActive, lastActive === 'insights' ? 'automate_pipeline' : 'insights']
      : ['insights', 'automate_pipeline'];
    const flow = candidates.find(
      (candidate) =>
        !isFlowDecided(walkthroughState, candidate) && getStoredWalkthroughStage(candidate)
    );
    if (!flow) return;
    useInsightWalkthroughStore.getState().resume(orgSlug, flow);
    // 'fork2' is the one stage rendered as a dialog rather than a coachmark, so resuming it
    // means reopening that dialog — the user closed the tab while deciding sample vs own data.
    if (useInsightWalkthroughStore.getState().stage === 'fork2') {
      setGetStartedModal({ open: true, screen: 'insight', entry: 'resume' });
    }
  }, [orgSlug, walkthroughLoading, walkthroughState]);

  // Own-data / automate-pipeline walkthrough's sync checkpoint: the wait for a first sync
  // can outlive the browser session, so this can't rely on an in-memory callback from the
  // ingest wizard. useConnectionsList() already fetches fresh data on every mount (plus
  // smart-polls while any connection is locked/running) — reuse it rather than adding new
  // polling.
  const {
    data: connections,
    isLoading: connectionsLoading,
    isError: connectionsError,
  } = useConnectionsList();
  // Subscribed, not read through getState(), because they have to be effect DEPENDENCIES.
  // The resume effect above waits on the backend's userpreferences fetch, so on a cold load
  // the connections response can easily land first — with the store still inactive. Reading
  // these via getState() only, the checkpoint would bail on that pass and never run again:
  // a finished sync holds no lock, so refreshInterval is 0 and `connections` keeps its
  // identity for the rest of the mount. The user would sit on a page with no coachmark until
  // they happened to navigate.
  const trackedConnectionId = useInsightWalkthroughStore((s) => s.trackedConnectionId);
  useEffect(() => {
    if (!orgSlug) return;
    const { active, path, stage, flow } = useInsightWalkthroughStore.getState();
    if (!active || !flow || !trackedConnectionId) return;
    // Only the two forks that ingest real data. Belt-and-braces against a stale tracked
    // connection surviving into a sample-data run: 'pipeline_transform_intro' isn't in the
    // sample order at all, so isStageBefore would wave it through and yank that user into
    // Transform.
    if (path !== 'own_data' && path !== 'automate_pipeline') return;
    const conn = connections.find((c) => c.connectionId === trackedConnectionId);
    if (!conn) {
      // Gone from a list that actually loaded = deleted, typically after a failed sync so the
      // user could start over. Both guards matter: useConnectionsList returns `data || []`, so
      // an in-flight fetch AND a failed one are both indistinguishable from an empty org by the
      // array alone — untracking on either would throw away a live connection over nothing more
      // than a cold mount or a blip in the network.
      if (!connectionsLoading && !connectionsError) {
        useInsightWalkthroughStore.getState().untrackConnection();
      }
      return;
    }

    const outcome = classifySync(conn);

    if (outcome === 'success') {
      // Fires for EITHER fork, independent of stage/finish — see hasConnectedRealData's
      // doc comment for why this is decoupled from path+hasFinishedWalkthrough.
      markConnectedRealData();

      // The two forks rejoin in DIFFERENT places: own-data goes straight to building a chart,
      // automate-pipeline has transform and orchestrate to do first. advanceIfBefore, not
      // advanceTo — a stale connections response arriving after the user has moved on must
      // never drag them back to the start of the tail. It also carries them off sync_running
      // and sync_failed, which sit outside every order array precisely so this can.
      useInsightWalkthroughStore.getState().advanceIfBefore(POST_SYNC_STAGE_FOR[path]);
      return;
    }

    // Everything below only reports on a wait the user is still IN. Without this guard a
    // second connection created later in the flow (tracked the moment it's made) would drag
    // someone already building charts back to "your sync is running".
    if (!stage || !SYNC_WAIT_STAGES.includes(stage)) return;

    // 'unknown' means nothing has been triggered yet — say nothing rather than guess (see
    // classifySync). Both real outcomes below use advanceTo, not advanceIfBefore: these stages
    // sit outside the order arrays, so the monotonic helper can't reason about them, and a
    // failed retry genuinely has to move the user BACK from the ingest stage they were handed
    // when they dismissed the previous failure.
    if (outcome === 'pending') {
      if (stage !== 'sync_running') useInsightWalkthroughStore.getState().advanceTo('sync_running');
      return;
    }
    if (outcome !== 'failed') return;

    // Keyed by RUN, not by a plain dismissed flag: the same failure must never nag twice (the
    // acknowledgement is persisted, so this holds across reloads), while a retry that fails
    // again is a different job id and does speak up.
    const runId = conn.lastRun ? String(conn.lastRun.job_id) : null;
    if (runId && getDismissedSyncRun(flow) === runId) return;
    // Recorded before the stage moves so the coachmark's "Got it" knows which failure it is
    // acknowledging (see dismissSyncFailure).
    useInsightWalkthroughStore.getState().setSyncFailedRunId(runId);
    if (stage !== 'sync_failed') useInsightWalkthroughStore.getState().advanceTo('sync_failed');
  }, [
    connections,
    connectionsLoading,
    connectionsError,
    orgSlug,
    walkthroughActive,
    trackedConnectionId,
  ]);

  /**
   * Puts the store on the insight walkthrough's opening stage ('fork2') without picking a
   * fork yet. Idempotent — reopening the dialog after dismissing it shouldn't re-fire the
   * "walkthrough started" event or reset a fork already chosen.
   */
  const ensureWalkthroughStarted = useCallback(() => {
    if (!orgSlug) return;
    const store = useInsightWalkthroughStore.getState();
    // The orgSlug check matters after an org switch: the store can still hold the previous
    // org's live flow. The flow check matters because the store may be driving the
    // automate-pipeline walkthrough right now — that's not this one, and returning early
    // would leave the insight fork never started.
    if (store.active && store.stage && store.orgSlug === orgSlug && store.flow === 'insights') {
      return;
    }
    store.start(orgSlug);
  }, [orgSlug]);

  const openInsightFork = useCallback(
    (entry: GetStartedEntry) => {
      ensureWalkthroughStarted();
      setGetStartedModal({ open: true, screen: 'insight', entry });
    },
    [ensureWalkthroughStarted]
  );

  /**
   * Puts a flow the user walked away from back on screen: re-activates the store (which the
   * auto-resume effect above may have skipped, e.g. because the backend has this flow marked
   * skipped) and navigates to the stage's page so its coachmark renders. Returns false when
   * there's nothing to resume, so the caller can fall back to offering a fresh start.
   */
  const resumeStoredFlow = useCallback(
    (flow: WalkthroughFlow) => {
      if (!orgSlug) return false;
      const stage = getStoredWalkthroughStage(flow);
      // 'fork2' isn't a coachmark — it's the dialog, which callers open directly.
      if (!stage || stage === 'fork2') return false;
      const anchor = getResumeAnchorStage(stage);
      // A route-less anchor points at something in the sidebar, which is on screen already —
      // resume it where the user is rather than treating it as unresumable. Returning false
      // here used to hand these stages to the fresh-start branch, which rewound a user who
      // had finished their chart back to the start of the chart flow.
      const route = WALKTHROUGH_STAGE_ROUTES[anchor];

      useInsightWalkthroughStore.getState().resume(orgSlug, flow);
      if (useInsightWalkthroughStore.getState().stage !== anchor) {
        useInsightWalkthroughStore.getState().advanceTo(anchor);
      }
      if (route) router.push(route);
      return true;
    },
    [orgSlug, router]
  );

  const handleBuildInsightClick = useCallback(() => {
    if (!orgSlug) return;
    const path = getStoredPath('insights');
    if ((path === 'sample' || path === 'own_data') && resumeStoredFlow('insights')) return;
    // Nothing to resume. If the user's own data is already in the platform — they automated a
    // pipeline, or connected a source some other way — the fork's question has no useful
    // branch left, so skip it and start the chart flow.
    //
    // Deliberately no navigation: the opening stage points at the sidebar's Charts link, and
    // pushing /charts here would satisfy its own route-advance instantly, skipping the beat.
    // Clicking Charts is the step.
    if (hasConnectedRealData()) {
      useInsightWalkthroughStore.getState().startChartFlow(orgSlug);
      return;
    }
    // Never started, or started and then skipped (which clears the stage) — ask again which
    // way they want to build it.
    openInsightFork('widget');
  }, [orgSlug, resumeStoredFlow, openInsightFork]);

  const handleAutomatePipelineClick = useCallback(() => {
    if (!orgSlug) return;
    const path = getStoredPath('automate_pipeline');
    if (path === 'automate_pipeline') {
      if (resumeStoredFlow('automate_pipeline')) return;
      // Skipped, so there's no stage to resume — fall back to the milestone-derived next
      // step, which is computed from real progress rather than coachmark position.
      const step = getFlowResumeStep(path as WalkthroughPath);
      router.push(step ? FLOW_RESUME_ROUTES[step.id] : '/pipeline');
      return;
    }
    // This flow has no fork to choose, so the row starts it outright. No navigation: it opens
    // on a nudge pointing at the Ingest nav item, and the user clicks it themselves.
    useInsightWalkthroughStore.getState().startAutomatePipeline(orgSlug);
  }, [orgSlug, resumeStoredFlow, router]);

  const chooseFork = useCallback(
    (fork: 'sample' | 'own_data') => {
      // Covers the post-tour 'choice' screen, which reaches the fork without going through
      // openInsightFork — the store needs an orgSlug before chooseSample/chooseOwnData run.
      ensureWalkthroughStarted();
      if (fork === 'sample') {
        useInsightWalkthroughStore.getState().chooseSample();
        router.push('/kpis');
      } else {
        useInsightWalkthroughStore.getState().chooseOwnData();
        router.push('/ingest');
      }
    },
    [ensureWalkthroughStarted, router]
  );

  // Which post-tour follow-ups are still worth offering. The tour is freely re-runnable, so a
  // flow the user already COMPLETED must not be offered again when they run it a second time.
  //
  // Completed only, deliberately NOT isFlowDecided: skipping a flow means "not now", not
  // "never" — the whole point of finishing the tour again is to be shown what's left to do,
  // and a single past Skip shouldn't bury the flow permanently. (Auto-OFFERING a flow
  // unprompted still respects a skip; that's the isFlowDecided gate on the intent modal and
  // the resume effects above.)
  //
  // The two are independent. Automating a pipeline used to imply an insight had been built,
  // because that walkthrough ran on into the chart -> dashboard -> share tail; it now ends at
  // the created pipeline, so finishing it says nothing about insights — and offering
  // build-insights next is precisely the intended follow-up.
  const canOfferInsight = !isFlowCompleted(walkthroughState, 'insights');
  const canOfferPipeline = !isFlowCompleted(walkthroughState, 'automate_pipeline');

  if (!isTrialOrg || !orgSlug) return null;

  // Wrapped rather than passed directly: these are `() => void` props, and handing them
  // `runTour` would let a click event object arrive as the start index.
  const startTour = () => runTour();

  return (
    <>
      <ProductTour
        ref={tourRef}
        orgSlug={orgSlug}
        canOfferPostTourChoice={canOfferInsight || canOfferPipeline}
        onTourEnd={() => setTourRunning(false)}
        onOfferPostTourChoice={() =>
          setGetStartedModal({ open: true, screen: 'choice', entry: 'post_tour' })
        }
      />
      <InsightWalkthroughCoachmark />
      <GetStartedModal
        open={getStartedModal.open}
        initialScreen={getStartedModal.screen}
        entry={getStartedModal.entry}
        // Choice-screen rows only — the widget's own entry points open the 'insight' screen
        // directly and stay clickable regardless, so a user can always redo a flow on purpose.
        showInsightOption={canOfferInsight}
        showPipelineOption={canOfferPipeline}
        onOpenChange={(open) => setGetStartedModal((prev) => ({ ...prev, open }))}
        onSelectPipeline={() => {
          // Deliberately no router.push — the flow's first stage is the Ingest sidebar nudge.
          useInsightWalkthroughStore.getState().startAutomatePipeline(orgSlug);
        }}
        onSelectSample={() => chooseFork('sample')}
        onSelectOwnData={() => chooseFork('own_data')}
      />
      {/* Available on every page — the panel itself only auto-opens on /impact (defaultOpen),
          elsewhere it stays a pill until the user opens it. Unmounted while the tour runs so
          it can't cover the spotlighted content. */}
      {!tourRunning && (
        <GettingStartedWidget
          defaultOpen={pathname === IMPACT_PATH}
          walkthroughActive={walkthroughActive}
          // Both ticks read the backend, the only permanent record — the local flags are
          // scratch space wiped once a flow resolves (see the store's finish/skip).
          // Only the insights flow builds an insight. The pipeline walkthrough stops at the
          // created pipeline, so ticking this off it would claim work the user hasn't done —
          // and hide the very next thing we want them to do.
          hasBuiltFirstInsight={isFlowCompleted(walkthroughState, 'insights')}
          hasAutomatedPipeline={isFlowCompleted(walkthroughState, 'automate_pipeline')}
          onStartTour={startTour}
          onBuildInsightClick={handleBuildInsightClick}
          onAutomatePipelineClick={handleAutomatePipelineClick}
        />
      )}
      {/* Still /impact-only: this is the first-run welcome prompt, not a persistent affordance. */}
      {pathname === IMPACT_PATH && (
        <TourIntentModal
          open={intentModalOpen}
          onOpenChange={setIntentModalOpen}
          onStartTour={startTour}
        />
      )}
    </>
  );
}
