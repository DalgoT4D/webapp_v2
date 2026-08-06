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
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { FREE_TRIAL_PLAN_NAME } from '@/constants/trial';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { useConnectionsList } from '@/hooks/api/useConnections';
import { SyncStatus } from '@/constants/connections';
import { ProductTour, type ProductTourHandle } from './product-tour';
import { TourIntentModal } from './tour-intent-modal';
import { GettingStartedWidget } from './getting-started-widget';
import { InsightWalkthroughCoachmark } from './insight-walkthrough-coachmark';
import { hasSeenTour } from './tour-constants';
import {
  hasFinishedWalkthrough,
  markConnectedRealData,
  hasPipelineCreated,
  getStoredPath,
} from './insight-walkthrough-constants';
import { useTrialWalkthrough, isFlowDecided } from '@/hooks/api/useTrialWalkthrough';

const IMPACT_PATH = '/impact';

export function TourGate() {
  const pathname = usePathname();
  const orgUsers = useAuthStore((s) => s.orgUsers);
  const selectedOrgSlug = useAuthStore((s) => s.selectedOrgSlug);
  const orgUser = orgUsers.find((ou) => ou.org.slug === selectedOrgSlug) ?? null;

  const tourRef = useRef<ProductTourHandle>(null);
  const hasOpenedModalRef = useRef(false);
  const [intentModalOpen, setIntentModalOpen] = useState(false);
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

  useEffect(() => {
    if (!orgSlug || walkthroughLoading) return;
    const nowSeen = hasSeenTour(orgSlug);
    if (!isTrialOrg || nowSeen || pathname !== IMPACT_PATH || hasOpenedModalRef.current) return;
    // Already skipped or completed the tour on some other browser/session.
    if (isFlowDecided(walkthroughState, 'product_tour')) return;
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

  if (!isTrialOrg || !orgSlug) return null;

  const startTour = () => {
    setTourRunning(true);
    tourRef.current?.startTour();
  };

  return (
    <>
      <ProductTour
        ref={tourRef}
        orgSlug={orgSlug}
        canOfferPostTourChoice={
          !isFlowDecided(walkthroughState, 'insights') ||
          !isFlowDecided(walkthroughState, 'automate_pipeline')
        }
        onTourEnd={() => setTourRunning(false)}
        onInsightPathChosen={() => useInsightWalkthroughStore.getState().start(orgSlug)}
        onPipelinePathChosen={() =>
          useInsightWalkthroughStore.getState().startAutomatePipeline(orgSlug)
        }
      />
      <InsightWalkthroughCoachmark />
      {/* Available on every page — the panel itself only auto-opens on /impact (defaultOpen),
          elsewhere it stays a pill until the user opens it. Unmounted while the tour runs so
          it can't cover the spotlighted content. */}
      {!tourRunning && (
        <GettingStartedWidget
          orgSlug={orgSlug}
          defaultOpen={pathname === IMPACT_PATH}
          walkthroughActive={walkthroughActive}
          hasBuiltFirstInsight={hasFinishedWalkthrough(orgSlug)}
          hasAutomatedPipeline={hasPipelineCreated(orgSlug)}
          onStartTour={startTour}
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
