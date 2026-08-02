'use client';

/**
 * Mounts the guided-tour feature globally (see main-layout.tsx, alongside
 * RbacNoticeCarousel) and decides IF any of it renders: only for a trial-plan org's
 * users. Gating is localStorage-only for v1 (no new backend field — decided with
 * Himanshu), keyed per org slug so a shared browser across two trial orgs doesn't
 * cross-suppress the tour.
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
  getStoredPath,
  hasConnectedRealData,
  markConnectedRealData,
} from './insight-walkthrough-constants';

const IMPACT_PATH = '/impact';

export function TourGate() {
  const pathname = usePathname();
  const orgUsers = useAuthStore((s) => s.orgUsers);
  const selectedOrgSlug = useAuthStore((s) => s.selectedOrgSlug);
  const orgUser = orgUsers.find((ou) => ou.org.slug === selectedOrgSlug) ?? null;

  const tourRef = useRef<ProductTourHandle>(null);
  const hasOpenedModalRef = useRef(false);
  const [intentModalOpen, setIntentModalOpen] = useState(false);
  const [seen, setSeen] = useState(false);
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

  // Single effect: reading localStorage and deciding whether to auto-open the modal must
  // happen atomically. Splitting these into two effects raced on mount — the auto-open
  // effect could still see the stale initial `seen=false` on the same commit that the
  // seen-flag effect was busy updating, flashing the modal open for an already-seen org.
  useEffect(() => {
    if (!orgSlug) return;
    const nowSeen = hasSeenTour(orgSlug);
    setSeen(nowSeen);
    if (!isTrialOrg || nowSeen || pathname !== IMPACT_PATH || hasOpenedModalRef.current) return;
    hasOpenedModalRef.current = true;
    setIntentModalOpen(true);
  }, [isTrialOrg, orgSlug, pathname]);

  // Resume the insight walkthrough (see insight-walkthrough-coachmark.tsx) if the user
  // refreshed or navigated away mid-flow — a no-op if it was never started or already finished.
  useEffect(() => {
    if (!orgSlug) return;
    useInsightWalkthroughStore.getState().resume(orgSlug);
  }, [orgSlug]);

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
    tourRef.current?.startTour();
  };

  return (
    <>
      <ProductTour
        ref={tourRef}
        orgSlug={orgSlug}
        onTourEnd={() => setSeen(true)}
        onInsightPathChosen={() => useInsightWalkthroughStore.getState().start(orgSlug)}
        onPipelinePathChosen={() =>
          useInsightWalkthroughStore.getState().startAutomatePipeline(orgSlug)
        }
      />
      <InsightWalkthroughCoachmark />
      {pathname === IMPACT_PATH && (
        <>
          <TourIntentModal
            open={intentModalOpen}
            onOpenChange={setIntentModalOpen}
            onStartTour={startTour}
          />
          <GettingStartedWidget
            hasSeenTour={seen}
            hasBuiltFirstInsight={
              hasFinishedWalkthrough(orgSlug) && getStoredPath(orgSlug) !== 'automate_pipeline'
            }
            hasConnectedOwnData={hasConnectedRealData(orgSlug)}
            hasAutomatedPipeline={
              getStoredPath(orgSlug) === 'automate_pipeline' && hasFinishedWalkthrough(orgSlug)
            }
            onStartTour={startTour}
          />
        </>
      )}
    </>
  );
}
