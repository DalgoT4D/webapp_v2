'use client';

/**
 * "Welcome back" nudge for a trial user returning mid-flow (build-insights or
 * automate-pipeline — not the product tour, which has its own re-entry). Shown on every
 * /impact load while a flow is incomplete, per Himanshu: this is meant to nag, not to be
 * seen once and forgotten. Dismissing (X or the CTA) only suppresses it for the rest of
 * the current browser session — sessionStorage, not localStorage — so navigating back to
 * /impact later in the same session doesn't reopen it, but the next real return does.
 */
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { trialDaysRemaining } from '@/constants/trial';
import { useFlowResumeStep, type FlowResumeStep } from './flow-resume';

const DISMISSED_STORAGE_PREFIX = 'dalgo_flow_resume_nudge_dismissed_';

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

  const days = orgUser?.org?.created_at ? trialDaysRemaining(orgUser.org.created_at) : null;
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
    <Dialog open onOpenChange={(open) => !open && dismiss()}>
      <DialogContent
        className="max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-3xl"
        data-testid="flow-resume-nudge-modal"
      >
        <div className="grid sm:grid-cols-2">
          <div className="flex flex-col gap-6 p-10">
            <DialogTitle className="text-2xl leading-tight font-bold">{copy.title}</DialogTitle>
            <p className="text-muted-foreground text-base">
              {copy.body}
              {days !== null && (
                <>
                  {' '}
                  You have {days} day{days === 1 ? '' : 's'} left on your trial.
                </>
              )}
            </p>
            <Button
              variant="primary"
              className="w-fit"
              onClick={handleContinue}
              data-testid="flow-resume-nudge-cta"
            >
              {copy.cta}
            </Button>
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm font-medium">Need help structuring your programme data?</p>
              <p className="text-muted-foreground mt-1 text-sm">Contact us at Book a call</p>
            </div>
          </div>
          <div className="relative hidden bg-[#d5f0e6] sm:block">
            <Image
              src="/branding/flow-resume-illustration.jpg"
              alt=""
              fill
              className="object-contain"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
