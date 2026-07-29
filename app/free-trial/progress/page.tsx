'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TrialSplitCard } from '@/app/free-trial/_components/TrialSplitCard';
import { TrialNoticeCard } from '@/app/free-trial/_components/TrialNoticeCard';
import { TrialMarketingPanel } from '@/app/free-trial/_components/TrialMarketingPanel';
import { TrialBrandHeader } from '@/app/free-trial/_components/TrialBrandHeader';
import { CloneProgress } from '@/app/free-trial/_components/CloneProgress';
import { TRIAL_MARKETING_PANELS, TRIAL_SUPPORT_EMAIL } from '@/app/free-trial/_lib/constants';
import { apiPost, apiPublicPost } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import {
  TRIAL_STEP_LABELS,
  TRIAL_CREDS_STORAGE_KEY,
  TRIAL_ELAPSED_TICK_MS,
  TRIAL_MAX_CONSECUTIVE_POLL_FAILURES,
  TRIAL_HARD_TIMEOUT_SECONDS,
  TRIAL_RETRY_PATH,
} from '@/constants/trial';
import { useAuthStore } from '@/stores/authStore';
import { useTrialStatus } from '@/hooks/api/useTrialStatus';
import { deriveCurrentIndex } from '@/app/free-trial/_lib/utils';

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
  const [retrying, setRetrying] = useState(false);

  // Give up when the backend is unreachable for a sustained stretch, or when we
  // blow past the hard timeout without a terminal status. Once we give up we null
  // the SWR key so polling stops (data keeps its last value).
  const pollGaveUp = pollFailures >= TRIAL_MAX_CONSECUTIVE_POLL_FAILURES || timedOut;

  const { data, mutate } = useTrialStatus(taskId, {
    enabled: !pollGaveUp,
    onSuccess: () => setPollFailures(0),
    onError: () => setPollFailures((n) => n + 1),
  });

  // "Try again" re-runs the clone under the SAME task_id — the backend kept the person
  // (email/password/verified) when it tore the failed attempt down, so no re-signup. On a
  // failed status SWR has already halted its interval (refreshInterval returns 0), so after the
  // re-enqueue we must clear the give-up state (re-enables the SWR key) and revalidate to pull
  // the fresh "queued"/"running" status and resume polling.
  const handleRetry = async (from: 'failed' | 'timeout') => {
    if (!taskId || retrying) return;
    setRetrying(true);
    try {
      await apiPublicPost(`${TRIAL_RETRY_PATH}/${taskId}`, {});
      // Long-running async work, so this is a *_triggered event fired once the
      // re-enqueue is accepted — not a success/failure outcome.
      trackEvent(ANALYTICS_EVENTS.TRIAL_RETRY_TRIGGERED, { from });
      loginAttemptedRef.current = false; // let a subsequent completion auto-login again
      pollTimeoutTrackedRef.current = false;
      setManualLoginNeeded(false);
      setPollFailures(0);
      setTimedOut(false);
      await mutate();
    } catch {
      // retry endpoint unreachable, or refused (409 — the workspace already completed, or a
      // clone is still running). Fall back to a clean full restart from the signup screen.
      router.replace('/free-trial');
    } finally {
      setRetrying(false);
    }
  };

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
      <TrialNoticeCard
        testId="trial-progress-missing-task"
        title="Missing setup task"
        description="We could not find a workspace setup in progress. Please start a new trial."
      >
        <Button variant="primary" className="w-full" asChild>
          <Link href="/free-trial">Start a new trial</Link>
        </Button>
      </TrialNoticeCard>
    );
  }

  // Figma frame 2453:3089.
  if (failed) {
    return (
      <TrialSplitCard
        testId="trial-progress-failed"
        aside={<TrialMarketingPanel panel={TRIAL_MARKETING_PANELS.provisioning} />}
      >
        <div className="space-y-8">
          <TrialBrandHeader
            title="Workspace setup interrupted"
            subtitle="We hit a technical snag while provisioning your workspace. Your details are saved, but we need to restart this final step."
          />
          <div className="space-y-4">
            <Button
              variant="primary"
              className="w-full"
              onClick={() => handleRetry('failed')}
              disabled={retrying}
              data-testid="trial-progress-retry-button"
            >
              {retrying ? 'Starting…' : 'Retry setup'}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              <a
                href={`mailto:${TRIAL_SUPPORT_EMAIL}`}
                className="font-medium text-primary underline hover:no-underline"
                data-testid="trial-contact-support"
              >
                Contact support
              </a>
            </p>
          </div>
        </div>
      </TrialSplitCard>
    );
  }

  if (manualLoginNeeded) {
    return (
      <TrialNoticeCard
        testId="trial-progress-manual-login"
        title="🎉 Your workspace is ready!"
        description="Please log in to get started."
      >
        <Button variant="primary" className="w-full" asChild>
          <Link href="/login" data-testid="trial-login-cta">
            Log in
          </Link>
        </Button>
      </TrialNoticeCard>
    );
  }

  if (pollGaveUp) {
    return (
      <TrialNoticeCard
        testId="trial-progress-timeout"
        title="This is taking longer than expected"
        description="Your workspace may still be finishing in the background. Try logging in — if it's not ready yet, start again in a moment."
      >
        <Button variant="primary" className="w-full" asChild>
          <Link href="/login" data-testid="trial-timeout-login-button">
            Log in
          </Link>
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleRetry('timeout')}
          disabled={retrying}
          data-testid="trial-timeout-retry-button"
        >
          {retrying ? 'Starting…' : 'Start again'}
        </Button>
      </TrialNoticeCard>
    );
  }

  // Figma frame 2452:416. ElapsedClock stays a SIBLING of CloneProgress, never a
  // wrapper — it re-renders every second, and re-rendering this card's hooks resets
  // the SWR poller's interval before it can fire (see the notes above).
  return (
    <TrialSplitCard
      testId="trial-progress-card"
      aside={<TrialMarketingPanel panel={TRIAL_MARKETING_PANELS.provisioning} />}
    >
      <div className="space-y-8">
        <TrialBrandHeader
          title="Creating workspace"
          subtitle="This usually takes 1 to 2 minutes."
          testId="trial-progress-heading"
        />
        <ElapsedClock startedAt={data?.started_at ?? null} frozen={isTerminal || pollGaveUp} />
        <CloneProgress steps={TRIAL_STEP_LABELS} currentIndex={currentIndex} failed={failed} />
      </div>
    </TrialSplitCard>
  );
}

export default function TrialProgressPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center" data-testid="trial-progress-loading">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading...</p>
        </div>
      }
    >
      <ProgressCard />
    </Suspense>
  );
}
