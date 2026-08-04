'use client';

/**
 * Trial lifecycle nudges — fire on the exact day (7 or 13 of the 14-day trial),
 * regardless of onboarding-flow progress. Mounted via NudgeCenter. Dismissing is
 * permanent (localStorage) per org — unlike the flow-resume nudge, this isn't meant to
 * nag every session, just to land once on that specific day.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import {
  FREE_TRIAL_PLAN_NAME,
  TRIAL_PERIOD_DAYS,
  trialDaysRemaining,
  markTrialDayNudgeDismissed,
  hasTrialDayNudgeDismissed,
} from '@/constants/trial';
import { TwoPaneNudgeDialog } from './two-pane-nudge-dialog';

const ILLUSTRATION_SRC = '/branding/trial-countdown-illustration.jpg';
const NUDGE_DAYS = [7, 13] as const;
type NudgeDay = (typeof NUDGE_DAYS)[number];

export function TrialDayNudgeModal() {
  const router = useRouter();
  const getCurrentOrgUser = useAuthStore((s) => s.getCurrentOrgUser);
  const orgUser = getCurrentOrgUser();
  const orgSlug =
    orgUser?.subscription_plan === FREE_TRIAL_PLAN_NAME ? (orgUser.org?.slug ?? null) : null;
  const createdAt = orgUser?.org?.created_at ?? null;
  // Starts null so nothing flashes open before this effect can check localStorage — a
  // browser-only API, unavailable during server render.
  const [day, setDay] = useState<NudgeDay | null>(null);

  useEffect(() => {
    if (!orgSlug || !createdAt) return;
    // NUDGE_DAYS counts elapsed days since signup, not days *remaining* — day 7 of 14 is
    // the halfway nudge, day 13 is the "almost over" one. trialDaysRemaining() only gives
    // remaining, so elapsed = period - remaining.
    const elapsedDay = TRIAL_PERIOD_DAYS - trialDaysRemaining(createdAt);
    const candidate = NUDGE_DAYS.find((d) => d === elapsedDay);
    setDay(candidate && !hasTrialDayNudgeDismissed(orgSlug, candidate) ? candidate : null);
  }, [orgSlug, createdAt]);

  if (!day || !orgSlug || !createdAt) return null;

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
        testId="trial-day7-nudge-modal"
      />
    );
  }

  const expiry = new Date(createdAt);
  expiry.setDate(expiry.getDate() + TRIAL_PERIOD_DAYS);

  return (
    <TwoPaneNudgeDialog
      onOpenChange={(open) => !open && dismiss()}
      title="Your trial is almost over."
      body={`On ${format(expiry, 'MMMM d, yyyy')}, your account will be deleted. There is still time to connect some sample data and see what Dalgo can actually do for you.`}
      ctaLabel="Upgrade"
      onCta={() => {
        dismiss();
        router.push('/settings/billing');
      }}
      imageSrc={ILLUSTRATION_SRC}
      testId="trial-day13-nudge-modal"
    />
  );
}
