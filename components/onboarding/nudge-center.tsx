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
import { FREE_TRIAL_PLAN_NAME, isTrialDayNudgeDue } from '@/constants/trial';
import { TrialDayNudgeModal } from './trial-day-nudge-modal';

export function NudgeCenter() {
  const getCurrentOrgUser = useAuthStore((s) => s.getCurrentOrgUser);
  const orgUser = getCurrentOrgUser();

  const orgSlug =
    orgUser?.subscription_plan === FREE_TRIAL_PLAN_NAME ? (orgUser.org?.slug ?? null) : null;
  const planEndDate = orgUser?.plan_end_date ?? null;

  // Starts false so this never flashes a priority decision made before hydration —
  // hasTrialDayNudgeDismissed reads sessionStorage, unavailable during server render.
  const [dayNudgeEligible, setDayNudgeEligible] = useState(false);

  useEffect(() => {
    if (!orgSlug || !planEndDate) {
      setDayNudgeEligible(false);
      return;
    }
    // Same predicate the modal itself applies, and the same one TourGate stands down for
    // (see isTrialDayNudgeDue) — if these disagreed, the modal would mount and render
    // nothing, or two dialogs would open at once.
    setDayNudgeEligible(isTrialDayNudgeDue(orgSlug, planEndDate));
  }, [orgSlug, planEndDate]);

  if (dayNudgeEligible) return <TrialDayNudgeModal />;
  return null;
}
