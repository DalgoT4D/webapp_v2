'use client';

/**
 * Trial lifecycle nudges — fire on an exact elapsed day of the 14-day trial (see
 * TRIAL_NUDGE_DAYS), regardless of onboarding-flow progress. Mounted via NudgeCenter.
 *
 * Day 7 is the halfway "let's get your data flowing" prompt. Days 13 and 14 — the second-last
 * and last days — both show the "almost over" upgrade modal, deliberately as two separate
 * nudges: dismissal is keyed per day, so closing it on 13 still lets the final-day one land.
 *
 * Dismissing is permanent (localStorage) per org and per day — unlike the flow-resume nudge,
 * this isn't meant to nag every session, just to land once on that specific day.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import {
  FREE_TRIAL_PLAN_NAME,
  TRIAL_PERIOD_DAYS,
  TRIAL_NUDGE_DAYS,
  type TrialNudgeDay,
  trialDaysElapsed,
  markTrialDayNudgeDismissed,
  hasTrialDayNudgeDismissed,
} from '@/constants/trial';
import { TwoPaneNudgeDialog } from './two-pane-nudge-dialog';

const ILLUSTRATION_SRC = '/branding/trial-countdown-illustration.jpg';

export function TrialDayNudgeModal() {
  const router = useRouter();
  const getCurrentOrgUser = useAuthStore((s) => s.getCurrentOrgUser);
  const orgUser = getCurrentOrgUser();
  const orgSlug =
    orgUser?.subscription_plan === FREE_TRIAL_PLAN_NAME ? (orgUser.org?.slug ?? null) : null;
  const createdAt = orgUser?.org?.created_at ?? null;
  // Starts null so nothing flashes open before this effect can check sessionStorage — a
  // browser-only API, unavailable during server render.
  const [day, setDay] = useState<TrialNudgeDay | null>(null);

  useEffect(() => {
    if (!orgSlug || !createdAt) return;
    // TRIAL_NUDGE_DAYS counts days ELAPSED since signup, not days remaining — 7 of 14 is the
    // halfway nudge, 13 and 14 are the last two days.
    const elapsedDay = trialDaysElapsed(createdAt);
    const candidate = TRIAL_NUDGE_DAYS.find((d) => d === elapsedDay);
    setDay(candidate && !hasTrialDayNudgeDismissed(orgSlug, candidate) ? candidate : null);
  }, [orgSlug, createdAt]);

  if (!day || !orgSlug || !createdAt) return null;

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
        testId="trial-day7-nudge-modal"
      />
    );
  }

  // Days 13 and 14 share this modal — the deletion date is what changes meaning between them
  // (tomorrow vs today), and the date is spelled out rather than described, so one copy holds.
  const expiry = new Date(createdAt);
  expiry.setDate(expiry.getDate() + TRIAL_PERIOD_DAYS);

  return (
    <TwoPaneNudgeDialog
      onOpenChange={(open) => !open && dismiss()}
      title="Your trial is almost over."
      body={`On ${format(expiry, 'MMMM d, yyyy')}, your account will be deleted. Secure your full licence now to keep your data syncing seamlessly and your dashboards active.`}
      ctaLabel="Upgrade"
      onCta={() => {
        dismiss();
        router.push('/settings/billing');
      }}
      imageSrc={ILLUSTRATION_SRC}
      testId={`trial-day${day}-nudge-modal`}
    />
  );
}
