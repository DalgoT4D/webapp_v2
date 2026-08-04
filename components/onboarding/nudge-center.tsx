'use client';

/**
 * Single decision point for which trial nudge (if any) is shown — mounted once in
 * header.tsx, app-wide, not gated to any one page. Two candidates can independently want
 * to fire on the same load (e.g. day 7 lands while a flow is also mid-progress); this
 * picks at most one so they never stack. The day-7/day-13 lifecycle nudge wins — it's
 * time-boxed to a single day, whereas the flow-resume nudge nags every session anyway
 * and will simply show up next time.
 *
 * The flags themselves stay in localStorage (read inside each modal); this component
 * only computes which localStorage-backed candidate takes priority right now.
 */
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  FREE_TRIAL_PLAN_NAME,
  TRIAL_PERIOD_DAYS,
  trialDaysRemaining,
  hasTrialDayNudgeDismissed,
} from '@/constants/trial';
import { useFlowResumeStep } from './flow-resume';
import { TrialDayNudgeModal } from './trial-day-nudge-modal';
import { FlowResumeNudgeModal } from './flow-resume-nudge-modal';

export function NudgeCenter() {
  const getCurrentOrgUser = useAuthStore((s) => s.getCurrentOrgUser);
  const orgUser = getCurrentOrgUser();
  const resumeStep = useFlowResumeStep();

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
  if (resumeStep) return <FlowResumeNudgeModal />;
  return null;
}
