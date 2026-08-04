'use client';

/**
 * Single decision point for which trial nudge (if any) is shown — mounted once in
 * header.tsx, app-wide, not gated to any one page. Currently just the day-7/day-13
 * lifecycle nudge; the flow-resume popup was removed (per Himanshu — resuming a
 * mid-progress flow now happens via the "Get Started" widget's checklist instead, which
 * reads the same localStorage-backed flow-resume logic). Kept as its own component
 * (rather than inlining TrialDayNudgeModal directly in header.tsx) so a second nudge
 * candidate can slot back in here later without touching header.tsx again.
 */
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  FREE_TRIAL_PLAN_NAME,
  TRIAL_PERIOD_DAYS,
  trialDaysRemaining,
  hasTrialDayNudgeDismissed,
} from '@/constants/trial';
import { TrialDayNudgeModal } from './trial-day-nudge-modal';

export function NudgeCenter() {
  const getCurrentOrgUser = useAuthStore((s) => s.getCurrentOrgUser);
  const orgUser = getCurrentOrgUser();

  const orgSlug =
    orgUser?.subscription_plan === FREE_TRIAL_PLAN_NAME ? (orgUser.org?.slug ?? null) : null;
  const createdAt = orgUser?.org?.created_at ?? null;

  // Starts false so this never flashes a priority decision made before hydration —
  // hasTrialDayNudgeDismissed reads localStorage, unavailable during server render.
  const [dayNudgeEligible, setDayNudgeEligible] = useState(false);

  useEffect(() => {
    if (!orgSlug || !createdAt) {
      setDayNudgeEligible(false);
      return;
    }
    const elapsedDay = TRIAL_PERIOD_DAYS - trialDaysRemaining(createdAt);
    setDayNudgeEligible(
      (elapsedDay === 7 || elapsedDay === 13) && !hasTrialDayNudgeDismissed(orgSlug, elapsedDay)
    );
  }, [orgSlug, createdAt]);

  if (dayNudgeEligible) return <TrialDayNudgeModal />;
  return null;
}
