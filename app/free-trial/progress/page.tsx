'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { AnimatedBackgroundSimple } from '@/components/ui/animated-background-simple';
import { CloneProgress } from '@/app/free-trial/_components/CloneProgress';
import { apiPost } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import {
  TRIAL_STEP_LABELS,
  TRIAL_CREDS_STORAGE_KEY,
  TRIAL_ELAPSED_TICK_MS,
  TRIAL_MAX_CONSECUTIVE_POLL_FAILURES,
  TRIAL_HARD_TIMEOUT_SECONDS,
} from '@/constants/trial';
import { useAuthStore } from '@/stores/authStore';
import { useTrialStatus } from '@/hooks/api/useTrialStatus';
import type { TrialProgressStep } from '@/types/trial';

// 1-based `step` from the backend → 0-based index into TRIAL_STEP_LABELS.
const STEP_TO_INDEX_OFFSET = 1;

// Fall back to matching the last progress event's message text against the
// known step labels when the backend doesn't send a numeric `step`.
function deriveCurrentIndex(progress: TrialProgressStep[] | undefined): number {
  if (!progress || progress.length === 0) {
    return 0;
  }

  // Walk backwards from the latest event so a single label that has drifted
  // out of sync with the frontend↔backend TRIAL_STEP_LABELS contract doesn't
  // roll the progress bar back to 0 — fall back to the nearest earlier event
  // that still resolves to a known step.
  for (let i = progress.length - 1; i >= 0; i -= 1) {
    const step = progress[i];
    if (typeof step.step === 'number') {
      return step.step - STEP_TO_INDEX_OFFSET;
    }
    const labelIndex = TRIAL_STEP_LABELS.indexOf(step.message);
    if (labelIndex >= 0) {
      return labelIndex;
    }
  }

  // No event in the whole history matched — clamp to the last known step
  // index instead of resetting to 0.
  return progress.length - 1;
}

// Elapsed clock lives in its OWN component so its per-second re-render stays isolated
// here and does NOT re-render ProgressCard. ProgressCard hosts the SWR poller, and a
// parent that re-renders every second churns SWR enough to keep resetting its poll
// interval timer before it can fire (the "polls once then never again" bug). Anchored to
// the backend `startedAt` when available so a refresh doesn't restart the count.
function ElapsedClock({ startedAt, frozen }: { startedAt: number | null; frozen: boolean }) {
  const mountMsRef = useRef<number | null>(null);
  if (mountMsRef.current === null) {
    mountMsRef.current = Date.now();
  }
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (frozen) return undefined;
    const tick = setInterval(() => setNowMs(Date.now()), TRIAL_ELAPSED_TICK_MS);
    return () => clearInterval(tick);
  }, [frozen]);

  const baseMs = startedAt !== null ? startedAt * 1000 : mountMsRef.current;
  const secs = Math.max(0, Math.floor((nowMs - baseMs) / 1000));
  const label = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <p className="text-sm text-muted-foreground mt-2" data-testid="trial-elapsed">
      Elapsed: {label}
    </p>
  );
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
  const pollTimeoutTrackedRef = useRef(false);
  const [manualLoginNeeded, setManualLoginNeeded] = useState(false);
  // consecutive failed status polls (reset to 0 on any success) + hard-timeout flag.
  // Either one flips the screen off the infinite spinner onto the fallback card.
  const [pollFailures, setPollFailures] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  // Give up when the backend is unreachable for a sustained stretch, or when we
  // blow past the hard timeout without a terminal status. Once we give up we null
  // the SWR key so polling stops (data keeps its last value).
  const pollGaveUp = pollFailures >= TRIAL_MAX_CONSECUTIVE_POLL_FAILURES || timedOut;

  const { data } = useTrialStatus(taskId, {
    enabled: !pollGaveUp,
    onSuccess: () => setPollFailures(0),
    onError: () => setPollFailures((n) => n + 1),
  });

  const currentIndex = useMemo(() => deriveCurrentIndex(data?.progress), [data?.progress]);
  const failed = data?.status === 'failed';

  const isTerminal = data?.status === 'completed' || data?.status === 'failed';

  // hard-timeout guard — a SINGLE timer (not a per-second tick) so ProgressCard doesn't
  // re-render every second. A per-second re-render here churns the SWR poller enough to keep
  // resetting its refreshInterval timer, so it fetches once and never polls again. The
  // visible elapsed clock lives in <ElapsedClock/>, which re-renders only itself.
  useEffect(() => {
    if (isTerminal || pollGaveUp) return undefined;
    const timer = setTimeout(() => setTimedOut(true), TRIAL_HARD_TIMEOUT_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [isTerminal, pollGaveUp]);

  // fire the poll-timeout event once, when we give up on a still-non-terminal clone
  useEffect(() => {
    if (pollGaveUp && !isTerminal && !pollTimeoutTrackedRef.current) {
      pollTimeoutTrackedRef.current = true;
      trackEvent(ANALYTICS_EVENTS.TRIAL_POLL_TIMEOUT);
    }
  }, [pollGaveUp, isTerminal]);

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
        // Creds missing — e.g. the tab was reloaded or progress was opened in
        // a new tab. The clone itself still succeeded, so send the user to a
        // manual login instead of leaving them stuck with no feedback.
        setManualLoginNeeded(true);
        trackEvent(ANALYTICS_EVENTS.TRIAL_MANUAL_LOGIN_REQUIRED);
        return;
      }
      const { email, password } = JSON.parse(raw);

      try {
        await apiPost('/api/v2/login/', { username: email, password });

        sessionStorage.removeItem(TRIAL_CREDS_STORAGE_KEY);
        useAuthStore.getState().setAuthenticated(true);
        trackEvent(ANALYTICS_EVENTS.TRIAL_CLONE_COMPLETED);
        router.replace('/impact');
      } catch {
        // Auto-login failed (network/backend blip) — the workspace clone
        // still succeeded, so don't leave the plaintext password sitting in
        // sessionStorage or strand the user on a spinner forever.
        sessionStorage.removeItem(TRIAL_CREDS_STORAGE_KEY);
        setManualLoginNeeded(true);
        trackEvent(ANALYTICS_EVENTS.TRIAL_MANUAL_LOGIN_REQUIRED);
      }
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

  if (manualLoginNeeded) {
    return (
      <CardShell>
        <div className="text-center" data-testid="trial-progress-manual-login">
          <div className="flex justify-center mb-6">
            <Image
              src="/dalgo_logo.svg"
              alt="Dalgo"
              width={80}
              height={90}
              className="text-primary"
            />
          </div>
          <h1 className="text-2xl font-bold mb-2">🎉 Your workspace is ready!</h1>
          <p className="text-gray-600">Please log in to get started.</p>
        </div>
        <Button variant="primary" className="w-full" asChild>
          <Link href="/login" data-testid="trial-login-cta">
            Log in
          </Link>
        </Button>
      </CardShell>
    );
  }

  if (pollGaveUp) {
    return (
      <CardShell>
        <div className="text-center" data-testid="trial-progress-timeout">
          <div className="flex justify-center mb-6">
            <Image
              src="/dalgo_logo.svg"
              alt="Dalgo"
              width={80}
              height={90}
              className="text-primary"
            />
          </div>
          <h1 className="text-2xl font-bold mb-2">This is taking longer than expected</h1>
          <p className="text-gray-600">
            Your workspace may still be finishing in the background. Try logging in — if it&apos;s
            not ready yet, start again in a moment.
          </p>
        </div>
        <div className="space-y-3">
          <Button variant="primary" className="w-full" asChild>
            <Link href="/login" data-testid="trial-timeout-login-button">
              Log in
            </Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/free-trial" data-testid="trial-timeout-retry-button">
              Start again
            </Link>
          </Button>
        </div>
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
        <ElapsedClock startedAt={data?.started_at ?? null} frozen={isTerminal || pollGaveUp} />
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
