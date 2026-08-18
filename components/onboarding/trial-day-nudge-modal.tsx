'use client';

/**
 * Trial lifecycle nudges — fire on an exact number of days REMAINING in the trial (see
 * TRIAL_NUDGE_DAYS), regardless of onboarding-flow progress. Mounted via NudgeCenter.
 *
 * 7 days left is the halfway "let's get your data flowing" prompt. 2 and 1 days left — the
 * second-last and last days, counted inclusive of today — both show the "almost over" upgrade
 * modal, deliberately as two separate nudges: dismissal is keyed per day, so closing it with 2
 * days left still lets the final-day one land.
 *
 * Every day count comes from the org plan's own end_date (currentuserv2 `plan_end_date`), the
 * same date the backend's lifecycle emails and expired-trial reaper work from.
 *
 * Dismissing is per session, per org and per day — unlike the flow-resume nudge, this isn't
 * meant to nag every session, just to land once on that specific day.
 *
 * "Subscribe Now" sends the subscription request from right here rather than routing anywhere:
 * the Settings → Billing page it used to open no longer exists, so this and the header pill are
 * the same one-per-org POST behind the same words, sharing SubscriptionRequestModal.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { useOrgPlan, requestPlanUpgrade } from '@/hooks/api/useOrgPlan';
import { toastError } from '@/lib/toast';
import {
  FREE_TRIAL_PLAN_NAME,
  TRIAL_NUDGE_DAYS,
  type TrialNudgeDay,
  trialDaysRemaining,
  markTrialDayNudgeDismissed,
  hasTrialDayNudgeDismissed,
} from '@/constants/trial';
import {
  SubscriptionRequestModal,
  type SubscriptionRequestStage,
} from '@/components/onboarding/subscription-request-modal';
import { TwoPaneNudgeDialog } from './two-pane-nudge-dialog';

const ILLUSTRATION_SRC = '/branding/trial-ending-soon-illustration.jpg';

export function TrialDayNudgeModal() {
  const router = useRouter();
  const getCurrentOrgUser = useAuthStore((s) => s.getCurrentOrgUser);
  const orgUser = getCurrentOrgUser();
  const orgSlug =
    orgUser?.subscription_plan === FREE_TRIAL_PLAN_NAME ? (orgUser.org?.slug ?? null) : null;
  const planEndDate = orgUser?.plan_end_date ?? null;
  // Starts null so nothing flashes open before this effect can check sessionStorage — a
  // browser-only API, unavailable during server render.
  const [day, setDay] = useState<TrialNudgeDay | null>(null);
  const [stage, setStage] = useState<SubscriptionRequestStage>('idle');
  // Same SWR key the header pill reads, so the two share one cache entry and one request: a
  // subscription requested from either surface flips both to "Request sent" without a reload.
  const { orgPlan, mutate: mutateOrgPlan } = useOrgPlan(Boolean(orgSlug));
  const alreadyRequested = orgPlan?.upgrade_requested === true;
  // The nudge closes before the request modal opens, which clears `day` — so the day count the
  // analytics needs is captured on the way out rather than read back later.
  const [daysLeftAtRequest, setDaysLeftAtRequest] = useState<number | null>(null);

  useEffect(() => {
    if (!orgSlug || !planEndDate) return;
    // TRIAL_NUDGE_DAYS counts days REMAINING inclusive of today, matching what the copy claims:
    // 7 days left is the halfway nudge, 2 and 1 are the last two days. `trialDaysRemaining` is
    // unclamped, so an expired trial hits 0 or below and matches nothing rather than sticking on
    // the final-day nudge.
    const daysLeft = trialDaysRemaining(planEndDate);
    const candidate = TRIAL_NUDGE_DAYS.find((d) => d === daysLeft);
    setDay(
      candidate !== undefined && !hasTrialDayNudgeDismissed(orgSlug, candidate) ? candidate : null
    );
  }, [orgSlug, planEndDate]);

  const sendRequest = async () => {
    setStage('sending');
    try {
      const response = await requestPlanUpgrade();
      trackEvent(ANALYTICS_EVENTS.SUBSCRIPTION_REQUEST_SENT, {
        days_left: daysLeftAtRequest,
        already_requested: Boolean(response?.already_requested),
        source: 'trial_nudge',
      });
      // picks up `upgrade_requested` for both this modal and the header pill
      await mutateOrgPlan();
      setStage('sent');
    } catch (error) {
      // back to the confirm step so the user can retry — the nudge itself is already gone
      setStage('confirm');
      toastError.api(error, 'Could not send your subscription request');
    }
  };

  // Rendered alongside every branch below, including the "no nudge today" one: the nudge closes
  // itself the moment Upgrade is hit, so by the time this modal matters `day` is already null.
  const requestModal = (
    <SubscriptionRequestModal
      stage={stage}
      onConfirm={sendRequest}
      onClose={() => setStage('idle')}
    />
  );

  if (day === null || !orgSlug || !planEndDate) return requestModal;

  // Closing is the ONLY thing that suppresses this for the session — a reload before closing
  // deliberately brings it back, because the user hasn't acknowledged it yet.
  const dismiss = () => {
    markTrialDayNudgeDismissed(orgSlug, day);
    setDay(null);
  };

  if (day === 7) {
    return (
      <TwoPaneNudgeDialog
        onOpenChange={(open) => !open && dismiss()}
        title="7 days left. Let's get your data flowing."
        body="You have seven days left to see Dalgo in action. Let's get some numbers on the board so you can actually see the value."
        ctaLabel="Start with sample data"
        onCta={() => {
          dismiss();
          useInsightWalkthroughStore.getState().start(orgSlug);
          useInsightWalkthroughStore.getState().chooseSample();
          router.push('/kpis?create=true');
        }}
        imageSrc={ILLUSTRATION_SRC}
        testId="trial-nudge-7d-modal"
      />
    );
  }

  // 2 and 1 days left share this modal — the deletion date is what changes meaning between them
  // (tomorrow vs today), and the date is spelled out rather than described, so one copy holds.
  // It is the plan's real end_date, not an arithmetic guess: this is the one line of copy that
  // makes the user a promise about when their data disappears.
  const expiry = new Date(planEndDate);

  return (
    <>
      <TwoPaneNudgeDialog
        onOpenChange={(open) => !open && dismiss()}
        title="Your trial is almost over."
        body={`On ${format(expiry, 'MMMM d, yyyy')}, your account will be deleted. Secure your full licence now to keep your data syncing seamlessly and your dashboards active.`}
        // Same words, same flow and same state as the header pill — one name for one action, so
        // the user isn't asked to work out whether this and the pill up there differ. Once the
        // org has requested, both go inert rather than offering a second request.
        ctaLabel={alreadyRequested ? 'Request sent' : 'Subscribe Now'}
        ctaDisabled={alreadyRequested}
        onCta={() => {
          setDaysLeftAtRequest(day);
          dismiss();
          trackEvent(ANALYTICS_EVENTS.SUBSCRIPTION_REQUEST_OPENED, {
            days_left: day,
            source: 'trial_nudge',
          });
          setStage('confirm');
        }}
        imageSrc={ILLUSTRATION_SRC}
        testId={`trial-nudge-${day}d-modal`}
      />
      {requestModal}
    </>
  );
}
