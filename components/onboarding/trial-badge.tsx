'use client';

/**
 * Free-trial countdown pill in the app header, doubling as the subscription CTA.
 *
 * Renders only for free-trial orgs; shows days left counted inclusive of today, switching to an
 * hour count for the final 24 hours, from data already in the auth store (plan_end_date + subscription_plan from
 * currentuserv2). The window is the backend's own OrgPlans.end_date, so an admin-extended or
 * -shortened trial counts down truthfully and the badge agrees with the lifecycle emails and
 * the reaper.
 *
 * The "Subscribe Now" half is a once-per-org request that emails the partnerships team, so
 * it needs the server's `upgrade_requested` — the one extra fetch this component makes, and
 * only for trial orgs (useOrgPlan is passed `false` for everyone else, which nulls the SWR
 * key so no request goes out). Deliberately NOT permission-gated: every member of a trial org
 * gets to ask, and once anyone has, this flips to an inert "Request sent".
 *
 * TrialDayNudgeModal offers the same request off the same SWR key, so the two are always in
 * the same state — requesting from either flips both.
 */
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { useOrgPlan, requestPlanUpgrade } from '@/hooks/api/useOrgPlan';
import {
  FREE_TRIAL_PLAN_NAME,
  TRIAL_COUNTDOWN_TICK_MS,
  trialCountdownLabel,
  trialDaysRemaining,
} from '@/constants/trial';
import { toastError } from '@/lib/toast';
import {
  SubscriptionRequestModal,
  type SubscriptionRequestStage,
} from '@/components/onboarding/subscription-request-modal';

export function TrialBadge() {
  const { getCurrentOrgUser } = useAuthStore();
  const orgUser = getCurrentOrgUser();
  const planEndDate = orgUser?.plan_end_date;
  const isTrial = orgUser?.subscription_plan === FREE_TRIAL_PLAN_NAME && Boolean(planEndDate);

  const { orgPlan, mutate: mutateOrgPlan } = useOrgPlan(isTrial);
  const [stage, setStage] = useState<SubscriptionRequestStage>('idle');

  // The label is read off the clock, so nothing re-renders this on its own. Without the tick a
  // tab left open through the final day keeps showing the hour count it mounted with — the one
  // stretch of the trial where a stale number is worst.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isTrial) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), TRIAL_COUNTDOWN_TICK_MS);
    return () => clearInterval(id);
  }, [isTrial]);

  if (!isTrial) return null;

  // Days until the last 24 hours, then hours — see trialCountdownLabel.
  const label = trialCountdownLabel(planEndDate as string);
  // Still days for analytics: the funnel groups trials by day, and an hours-based property would
  // splinter the final day into 24 buckets.
  const days = trialDaysRemaining(planEndDate as string);

  const alreadyRequested = orgPlan?.upgrade_requested === true;
  // Only offer the CTA once we know the org has NOT already requested. While the plan is
  // still loading (or failed to load) the pill stays a plain countdown rather than briefly
  // offering a request that has already been made.
  const canRequest = orgPlan !== undefined && !alreadyRequested;

  const openConfirm = () => {
    trackEvent(ANALYTICS_EVENTS.SUBSCRIPTION_REQUEST_OPENED, {
      days_left: days,
      source: 'header_badge',
    });
    setStage('confirm');
  };

  const sendRequest = async () => {
    setStage('sending');
    try {
      const response = await requestPlanUpgrade();
      trackEvent(ANALYTICS_EVENTS.SUBSCRIPTION_REQUEST_SENT, {
        days_left: days,
        already_requested: Boolean(response?.already_requested),
        source: 'header_badge',
      });
      await mutateOrgPlan();
      setStage('sent');
    } catch (error) {
      // stay on the confirm modal so the user can retry without re-opening it
      setStage('confirm');
      toastError.api(error, 'Could not send your subscription request');
    }
  };

  return (
    <>
      <div
        className="from-primary via-primary/60 to-primary/20 hidden rounded-full bg-gradient-to-r p-[1px] md:flex"
        data-testid="trial-days-badge"
      >
        <div
          className="from-background to-primary/5 flex items-center rounded-full bg-gradient-to-r px-4 py-1.5"
          data-testid="trial-days-badge-surface"
        >
          <span className="text-foreground text-sm">{label}</span>
          {(canRequest || alreadyRequested) && (
            <span className="text-muted-foreground mx-2" aria-hidden="true">
              ·
            </span>
          )}
          {canRequest ? (
            <button
              type="button"
              onClick={openConfirm}
              className="text-primary focus-visible:ring-primary cursor-pointer rounded-sm text-sm font-bold hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              data-testid="trial-subscribe-cta"
            >
              Subscribe Now
            </button>
          ) : (
            alreadyRequested && (
              <span
                className="text-muted-foreground text-sm"
                data-testid="trial-request-sent-label"
                role="status"
              >
                Request sent
              </span>
            )
          )}
        </div>
      </div>
      <SubscriptionRequestModal
        stage={stage}
        onConfirm={sendRequest}
        onClose={() => setStage('idle')}
      />
    </>
  );
}
