'use client';

import { useCallback, useEffect, useState } from 'react';
import { useOpenShareDeepLink } from '@/hooks/useOpenShareDeepLink';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import {
  markDashboardShared,
  type WalkthroughStage,
} from '@/components/onboarding/insight-walkthrough-constants';

/**
 * Walkthrough stages whose coachmark target lives INSIDE the share dialog — those keep their
 * spotlight while the dialog is open; every other stage's is suppressed.
 */
const SHARE_DIALOG_COACHMARK_STAGES: WalkthroughStage[] = [
  'share_public_toggle',
  'share_copy_link',
];

/** Stages the share dialog can be opened FROM — either routes on into the dialog's own steps. */
const SHARE_DIALOG_ENTRY_STAGES: WalkthroughStage[] = ['share', 'share_public_toggle'];

/**
 * Every stage from which copying the public link is the walkthrough's final act. Not just
 * 'share_copy_link': a dashboard that was already public never fires the sharing handler, so
 * the stage can still be one of the earlier two when the user copies.
 */
const SHARE_TAIL_STAGES: WalkthroughStage[] = ['share', 'share_public_toggle', 'share_copy_link'];

interface ShareFlowOptions {
  dashboard: { id?: number; is_public?: boolean } | undefined;
  /** The dashboard SWR mutate — called with no arguments after a sharing change. */
  refreshDashboard: () => void;
}

/** The view's Share dialog and the onboarding walkthrough steps that run through it. */
export function useDashboardShareFlow({ dashboard, refreshDashboard }: ShareFlowOptions) {
  const { initialOpen: initialShareModalOpen, clearParam: clearShareDeepLink } =
    useOpenShareDeepLink();
  const [shareModalOpen, setShareModalOpen] = useState(initialShareModalOpen);
  // Walkthrough only — the "you're officially live" beat, after the public link is copied.
  const [dashboardLiveModalOpen, setDashboardLiveModalOpen] = useState(false);
  const walkthroughStage = useInsightWalkthroughStore((state) => state.stage);

  // The share dialog gets no coachmark of its own while the user is finding their way around
  // it, so the spotlight hides (same pattern as the KPI/chart picker modals in
  // dashboard-builder) — except for the two stages whose targets are inside this very
  // dialog: the Public Access switch and, once that's on, the copy button.
  useEffect(() => {
    useInsightWalkthroughStore
      .getState()
      .setSuppressCoachmark(
        shareModalOpen && !SHARE_DIALOG_COACHMARK_STAGES.includes(walkthroughStage!)
      );
    // Opening the dialog is what completes the 'share' step. Where it goes next depends on the
    // dashboard: a private one needs the Public Access switch flipped, an ALREADY-public one
    // has nothing to flip, so it goes straight to the copy button. Without that second case
    // the walkthrough parks on a switch that is already on, the sharing handler (its only way
    // forward) never fires, and the flow can never reach finish() — nothing written to the
    // backend, no tick on the Get Started checklist.
    if (shareModalOpen && SHARE_DIALOG_ENTRY_STAGES.includes(walkthroughStage!)) {
      useInsightWalkthroughStore
        .getState()
        .advanceIfBefore(dashboard?.is_public ? 'share_copy_link' : 'share_public_toggle');
    }
  }, [shareModalOpen, walkthroughStage, dashboard?.is_public]);

  // Handle share
  const handleShare = () => {
    setShareModalOpen(true);
  };

  // Handle share modal close
  const handleShareModalClose = () => {
    setShareModalOpen(false);
    clearShareDeepLink();
  };

  // Handle dashboard update after sharing changes
  const handleDashboardUpdate = () => {
    refreshDashboard(); // Refresh the dashboard data
  };

  // ShareModal (a components/ui/ component we keep free of onboarding logic) reports when
  // General access flips to Public, and that is what moves the walkthrough on — same trick
  // dashboard-list uses for the "shared" milestone. The dialog stays open: the next stage
  // points at the copy button inside it.
  const handleMadePublic = useCallback(() => {
    markDashboardShared();
    const walkthrough = useInsightWalkthroughStore.getState();
    // Either stage can be live here: 'share_public_toggle' normally, or 'share' if the user
    // reached the access picker without the dialog-open effect having run (a resumed flow).
    if (walkthrough.active) walkthrough.advanceIfBefore('share_copy_link');
  }, []);

  // Copying the link is the walkthrough's last action — the flow ends on a celebration
  // rather than a toast, and stays put so the user is looking at what they just built.
  const handleCopyLink = useCallback(() => {
    // The share itself. Fired before the walkthrough branch so it lands on every copy,
    // not only during onboarding. DASHBOARD_MADE_PUBLIC (from updateGeneralAccess)
    // only means the link exists; this means the user actually handed it out.
    // dashboard.id, not the dashboardId prop: it is what ShareModal was opened with,
    // and it is a real id here (the modal only renders outside public mode).
    trackEvent(ANALYTICS_EVENTS.DASHBOARD_SHARED, { dashboard_id: dashboard?.id });
    const walkthrough = useInsightWalkthroughStore.getState();
    if (walkthrough.active && SHARE_TAIL_STAGES.includes(walkthrough.stage!)) {
      walkthrough.finish();
      setShareModalOpen(false);
      setDashboardLiveModalOpen(true);
    }
  }, [dashboard?.id]);

  return {
    shareModalOpen,
    dashboardLiveModalOpen,
    setDashboardLiveModalOpen,
    handleShare,
    handleShareModalClose,
    handleDashboardUpdate,
    handleMadePublic,
    handleCopyLink,
  };
}
