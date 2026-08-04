'use client';

/**
 * "Welcome back" nudge for a trial user returning mid-flow (build-insights or
 * automate-pipeline — not the product tour, which has its own re-entry). Shown app-wide
 * (mounted via NudgeCenter in header.tsx) while a flow is incomplete, per Himanshu: this
 * is meant to nag, not to be seen once and forgotten. Dismissing (X or the CTA) only
 * suppresses it for the rest of the current browser session — sessionStorage, not
 * localStorage — so coming back later in the same session doesn't reopen it, but the
 * next real return does.
 *
 * NudgeCenter is responsible for only mounting this when the day-7/day-13 lifecycle
 * nudge isn't also due — this component doesn't need to know about that itself.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { trialDaysRemaining } from '@/constants/trial';
import { useFlowResumeStep, type FlowResumeStep } from './flow-resume';
import { TwoPaneNudgeDialog } from './two-pane-nudge-dialog';

const DISMISSED_STORAGE_PREFIX = 'dalgo_flow_resume_nudge_dismissed_';
const ILLUSTRATION_SRC = '/branding/flow-resume-illustration.jpg';

const STEP_COPY: Record<
  FlowResumeStep['id'],
  { title: string; body: string; cta: string; route: string }
> = {
  ingest_data: {
    title: "Welcome back. Let's connect your data.",
    body: 'Pick up where you left off — connect a data source to get started.',
    cta: 'Connect your data',
    route: '/ingest',
  },
  create_chart: {
    title: "Welcome back. Let's build your first chart.",
    body: 'Your data is successfully connected. Turn those raw numbers into a clear visual.',
    cta: 'Create a chart',
    route: '/charts/new',
  },
  transform_data: {
    title: "Welcome back. Let's transform your data.",
    body: 'Your data is connected — now build and publish a transformation workflow.',
    cta: 'Go to Transform',
    route: '/transform',
  },
  orchestrate_pipeline: {
    title: "Welcome back. Let's automate your pipeline.",
    body: 'Your transformation is published — now set up a schedule to keep your data fresh.',
    cta: 'Orchestrate your pipeline',
    route: '/pipeline',
  },
  create_kpi: {
    title: "Welcome back. Let's build your first KPI.",
    body: 'Pick up where you left off — create a KPI to start tracking what matters.',
    cta: 'Create a KPI',
    route: '/kpis?create=true',
  },
  create_dashboard: {
    title: "Welcome back. Let's finish your dashboard.",
    body: 'Add your chart and KPI to a dashboard, then share it with your team.',
    cta: 'Create a dashboard',
    route: '/dashboards',
  },
};

export function FlowResumeNudgeModal() {
  const router = useRouter();
  const resumeStep = useFlowResumeStep();
  const getCurrentOrgUser = useAuthStore((s) => s.getCurrentOrgUser);
  const orgUser = getCurrentOrgUser();
  const orgSlug = orgUser?.org?.slug ?? null;
  // Starts true so the modal never flashes open during SSR/hydration before this effect
  // reads sessionStorage — a browser-only API, unavailable during server render.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!orgSlug) return;
    setDismissed(sessionStorage.getItem(`${DISMISSED_STORAGE_PREFIX}${orgSlug}`) === '1');
  }, [orgSlug]);

  if (!resumeStep || !orgSlug || dismissed) return null;

  const createdAt = orgUser?.org?.created_at ?? null;
  const days = createdAt ? trialDaysRemaining(createdAt) : null;
  const copy = STEP_COPY[resumeStep.id];

  const dismiss = () => {
    sessionStorage.setItem(`${DISMISSED_STORAGE_PREFIX}${orgSlug}`, '1');
    setDismissed(true);
  };

  const handleContinue = () => {
    dismiss();
    router.push(copy.route);
  };

  return (
    <TwoPaneNudgeDialog
      onOpenChange={(open) => !open && dismiss()}
      title={copy.title}
      body={
        <>
          {copy.body}
          {days !== null && (
            <>
              {' '}
              You have {days} day{days === 1 ? '' : 's'} left on your trial.
            </>
          )}
        </>
      }
      ctaLabel={copy.cta}
      onCta={handleContinue}
      imageSrc={ILLUSTRATION_SRC}
      testId="flow-resume-nudge-modal"
    />
  );
}
