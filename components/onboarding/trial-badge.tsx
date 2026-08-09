'use client';

/**
 * Free-trial countdown pill in the app header, doubling as the subscription CTA.
 *
 * Renders only for free-trial orgs; shows whole days left ("Last day today" on the final
 * day) computed from data already in the auth store (plan_end_date + subscription_plan from
 * currentuserv2). The window is the backend's own OrgPlans.end_date, so an admin-extended or
 * -shortened trial counts down truthfully and the badge agrees with the lifecycle emails and
 * the reaper.
 *
 * The "Subscribe Now" half is a once-per-org request that emails the partnerships team, so
 * it needs the server's `upgrade_requested` — the one extra fetch this component makes, and
 * only for trial orgs (useOrgPlan is passed `false` for everyone else, which nulls the SWR
 * key so no request goes out). Users without the upgrade permission see the countdown with
 * no CTA, since the POST would 403 for them.
 */
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import { useOrgPlan, requestPlanUpgrade } from '@/hooks/api/useOrgPlan';
import { FREE_TRIAL_PLAN_NAME, trialDaysRemaining } from '@/constants/trial';
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

  const { hasPermission } = useRbac();
  const { orgPlan, mutate: mutateOrgPlan } = useOrgPlan(isTrial);
  const [stage, setStage] = useState<SubscriptionRequestStage>('idle');

  if (!isTrial) return null;

  // Unclamped: a negative count means the trial is already over and the reaper hasn't run yet,
  // which is a different thing to say than "last day".
  const days = trialDaysRemaining(planEndDate as string);
  const label =
    days < 0
      ? 'Trial ended'
      : days === 0
        ? 'Last day today'
        : `${days} day${days === 1 ? '' : 's'} left`;

  const alreadyRequested = orgPlan?.upgrade_requested === true;
  // Only offer the CTA once we know the org has NOT already requested. While the plan is
  // still loading (or failed to load) the pill stays a plain countdown rather than briefly
  // offering a request that has already been made.
  const canRequest =
    orgPlan !== undefined &&
    !alreadyRequested &&
    hasPermission(PERMISSIONS.CAN_INITIATE_ORG_PLAN_UPGRADE);

  const openConfirm = () => {
    trackEvent(ANALYTICS_EVENTS.SUBSCRIPTION_REQUEST_OPENED, { days_left: days });
    setStage('confirm');
  };

  const sendRequest = async () => {
    setStage('sending');
    try {
      const response = await requestPlanUpgrade();
      trackEvent(ANALYTICS_EVENTS.SUBSCRIPTION_REQUEST_SENT, {
        days_left: days,
        already_requested: Boolean(response?.already_requested),
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
        className="border-primary/40 hidden items-center rounded-full border px-4 py-1.5 md:flex"
        data-testid="trial-days-badge"
      >
        <span className="text-foreground text-sm">{label}</span>
        {(canRequest || alreadyRequested) && <span className="text-muted-foreground mx-2">·</span>}
        {canRequest ? (
          <button
            type="button"
            onClick={openConfirm}
            className="text-primary cursor-pointer text-sm font-bold hover:underline"
            data-testid="trial-subscribe-cta"
          >
            Subscribe Now
          </button>
        ) : (
          alreadyRequested && (
            <span className="text-muted-foreground text-sm" data-testid="trial-request-sent-label">
              Request sent
            </span>
          )
        )}
      </div>
      <SubscriptionRequestModal
        stage={stage}
        onConfirm={sendRequest}
        onClose={() => setStage('idle')}
      />
    </>
  );
}
