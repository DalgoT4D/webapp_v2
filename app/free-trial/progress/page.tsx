'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { AnimatedBackgroundSimple } from '@/components/ui/animated-background-simple';
import { CloneProgress } from '@/app/free-trial/_components/CloneProgress';
import { apiPost } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import {
  TRIAL_STATUS_PATH,
  TRIAL_STATUS_POLL_INTERVAL,
  TRIAL_STEP_LABELS,
  TRIAL_CREDS_STORAGE_KEY,
} from '@/constants/trial';
import { useAuthStore } from '@/stores/authStore';
import type { TrialStatusResponse, TrialProgressStep } from '@/types/trial';

// 1-based `step` from the backend → 0-based index into TRIAL_STEP_LABELS.
const STEP_TO_INDEX_OFFSET = 1;

// Fall back to matching the last progress event's message text against the
// known step labels when the backend doesn't send a numeric `step`.
function deriveCurrentIndex(progress: TrialProgressStep[] | undefined): number {
  if (!progress || progress.length === 0) {
    return 0;
  }

  const last = progress[progress.length - 1];

  if (typeof last.step === 'number') {
    return last.step - STEP_TO_INDEX_OFFSET;
  }

  const labelIndex = TRIAL_STEP_LABELS.indexOf(last.message);
  return labelIndex >= 0 ? labelIndex : 0;
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <AnimatedBackgroundSimple>
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-sm space-y-6 rounded-lg bg-white/95 backdrop-blur-sm p-8 shadow-lg border border-white/20">
          {children}
        </div>
      </div>
    </AnimatedBackgroundSimple>
  );
}

function ProgressCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskId = searchParams.get('task_id');
  const loginAttemptedRef = useRef(false);

  const statusUrl = taskId ? `${TRIAL_STATUS_PATH}/${taskId}` : null;
  const { data } = useSWR<TrialStatusResponse>(statusUrl, {
    refreshInterval: (latest?: TrialStatusResponse) =>
      latest?.status === 'completed' || latest?.status === 'failed'
        ? 0
        : TRIAL_STATUS_POLL_INTERVAL,
  });

  const currentIndex = useMemo(() => deriveCurrentIndex(data?.progress), [data?.progress]);
  const failed = data?.status === 'failed';

  // Auto-login once cloning completes — mirrors app/login's onLogin exactly,
  // using the creds the activate page stashed in sessionStorage.
  useEffect(() => {
    if (data?.status !== 'completed' || loginAttemptedRef.current) {
      return;
    }
    loginAttemptedRef.current = true;

    const autoLogin = async () => {
      const raw = sessionStorage.getItem(TRIAL_CREDS_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const { email, password } = JSON.parse(raw);

      await apiPost('/api/v2/login/', { username: email, password });

      sessionStorage.removeItem(TRIAL_CREDS_STORAGE_KEY);
      useAuthStore.getState().setAuthenticated(true);
      trackEvent(ANALYTICS_EVENTS.TRIAL_CLONE_COMPLETED);
      router.replace('/impact');
    };

    autoLogin();
  }, [data?.status, router]);

  useEffect(() => {
    if (data?.status === 'failed') {
      trackEvent(ANALYTICS_EVENTS.TRIAL_CLONE_FAILED);
    }
  }, [data?.status]);

  if (!taskId) {
    return (
      <CardShell>
        <div className="text-center" data-testid="trial-progress-missing-task">
          <h1 className="text-2xl font-bold mb-2">Missing setup task</h1>
          <p className="text-gray-600">
            We could not find a workspace setup in progress. Please start a new trial.
          </p>
        </div>
        <div className="text-center pt-4">
          <Link href="/free-trial" className="text-primary hover:underline font-medium">
            Start a new trial
          </Link>
        </div>
      </CardShell>
    );
  }

  if (failed) {
    return (
      <CardShell>
        <div className="text-center" data-testid="trial-progress-failed">
          <div className="flex justify-center mb-6">
            <Image
              src="/dalgo_logo.svg"
              alt="Dalgo"
              width={80}
              height={90}
              className="text-primary"
            />
          </div>
          <h1 className="text-2xl font-bold mb-2">
            Something went wrong setting up your workspace
          </h1>
          <p className="text-gray-600">
            Please try again — if the problem continues, reach out to our support team.
          </p>
        </div>
        <Button variant="primary" className="w-full" asChild>
          <Link href="/free-trial" data-testid="trial-progress-retry-button">
            Try again
          </Link>
        </Button>
      </CardShell>
    );
  }

  return (
    <CardShell>
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <Image
            src="/dalgo_logo.svg"
            alt="Dalgo"
            width={80}
            height={90}
            className="text-primary"
          />
        </div>
        <h1 className="text-2xl font-bold mb-2" data-testid="trial-progress-heading">
          Setting up your Dalgo workspace&hellip;
        </h1>
        <p className="text-gray-600">This usually takes a couple of minutes. Hang tight.</p>
      </div>
      <CloneProgress steps={TRIAL_STEP_LABELS} currentIndex={currentIndex} failed={failed} />
    </CardShell>
  );
}

export default function TrialProgressPage() {
  return (
    <Suspense
      fallback={
        <AnimatedBackgroundSimple>
          <div className="flex min-h-screen items-center justify-center">
            <div className="text-center" data-testid="trial-progress-loading">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-lg font-medium">Loading...</p>
            </div>
          </div>
        </AnimatedBackgroundSimple>
      }
    >
      <ProgressCard />
    </Suspense>
  );
}
