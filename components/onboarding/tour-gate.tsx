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
  SILENT_STAGE_ROUTES,
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
    const flow = getStoredPath(orgSlug) === 'automate_pipeline' ? 'automate_pipeline' : 'insights';
    if (isFlowDecided(walkthroughState, flow)) return;
    useInsightWalkthroughStore.getState().resume(orgSlug);
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
  const { data: connections } = useConnectionsList();
  useEffect(() => {
    if (!orgSlug) return;
    const { active, stage, trackedConnectionId } = useInsightWalkthroughStore.getState();
    if (!active || !trackedConnectionId) return;
    const conn = connections.find((c) => c.connectionId === trackedConnectionId);
    if (conn?.lastRun?.status !== SyncStatus.SUCCESS) return;

    // Fires for EITHER fork, independent of stage/finish — see hasConnectedRealData's
    // doc comment for why this is decoupled from path+hasFinishedWalkthrough.
    markConnectedRealData(orgSlug);

    if (stage === 'own_data_ingest') {
      useInsightWalkthroughStore.getState().advanceTo('own_data_charts_intro');
    } else if (stage === 'pipeline_ingest') {
      useInsightWalkthroughStore.getState().advanceTo('pipeline_transform_intro');
    }
  }, [connections, orgSlug]);

  /**
   * Puts the store on the insight walkthrough's opening stage ('fork2') without picking a
   * fork yet. Idempotent — reopening the dialog after dismissing it shouldn't re-fire the
   * "walkthrough started" event or reset a fork already chosen.
   */
  const ensureWalkthroughStarted = useCallback(() => {
    if (!orgSlug) return;
    const store = useInsightWalkthroughStore.getState();
    // The orgSlug check matters after an org switch: the store can still hold the previous
    // org's live flow, and every persistence helper is keyed by slug.
    if (store.active && store.stage && store.orgSlug === orgSlug) return;
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
  const resumeStoredFlow = useCallback(() => {
    if (!orgSlug) return false;
    const stage = getStoredWalkthroughStage(orgSlug);
    // 'fork2' isn't a coachmark — it's the dialog, which callers open directly.
    if (!stage || stage === 'fork2') return false;
    const anchor = getResumeAnchorStage(stage);
    const route = WALKTHROUGH_STAGE_ROUTES[anchor] ?? SILENT_STAGE_ROUTES[anchor];
    if (!route) return false;

    useInsightWalkthroughStore.getState().resume(orgSlug);
    if (useInsightWalkthroughStore.getState().stage !== anchor) {
      useInsightWalkthroughStore.getState().advanceTo(anchor);
    }
    router.push(route);
    return true;
  }, [orgSlug, router]);

  const handleBuildInsightClick = useCallback(() => {
    if (!orgSlug) return;
    const path = getStoredPath(orgSlug);
    if ((path === 'sample' || path === 'own_data') && resumeStoredFlow()) return;
    // Never started, or started and then skipped (which clears the stage) — ask again which
    // way they want to build it.
    openInsightFork('widget');
  }, [orgSlug, resumeStoredFlow, openInsightFork]);

  const handleAutomatePipelineClick = useCallback(() => {
    if (!orgSlug) return;
    const path = getStoredPath(orgSlug);
    if (path === 'automate_pipeline') {
      if (resumeStoredFlow()) return;
      // Skipped, so there's no stage to resume — fall back to the milestone-derived next
      // step, which is computed from real progress rather than coachmark position.
      const step = getFlowResumeStep(orgSlug, path as WalkthroughPath);
      router.push(step ? FLOW_RESUME_ROUTES[step.id] : '/pipeline');
      return;
    }
    // This flow has no fork to choose, so the row starts it outright.
    useInsightWalkthroughStore.getState().startAutomatePipeline(orgSlug);
    router.push('/ingest');
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

  // Which post-tour follow-ups are still worth offering. The tour is freely re-runnable, so
  // a flow the user already resolved (completed, or explicitly skipped) must not be offered
  // again when they run it a second time. Completing automate-pipeline also settles insights
  // — that fork ends in the same chart -> dashboard -> share tail. Not the reverse.
  const canOfferInsight =
    !isFlowDecided(walkthroughState, 'insights') &&
    !isFlowCompleted(walkthroughState, 'automate_pipeline');
  const canOfferPipeline = !isFlowDecided(walkthroughState, 'automate_pipeline');

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
          useInsightWalkthroughStore.getState().startAutomatePipeline(orgSlug);
          router.push('/ingest');
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
          hasBuiltFirstInsight={
            // Completing automate-pipeline means an insight was built too: that fork ends in
            // the same chart -> dashboard -> share tail. Not the reverse.
            isFlowCompleted(walkthroughState, 'insights') ||
            isFlowCompleted(walkthroughState, 'automate_pipeline')
          }
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
