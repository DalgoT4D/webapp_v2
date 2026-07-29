'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TrialCenteredCard } from '@/app/free-trial/_components/TrialCenteredCard';
import { TrialNoticeCard } from '@/app/free-trial/_components/TrialNoticeCard';
import { TrialBrandHeader } from '@/app/free-trial/_components/TrialBrandHeader';
import { TrialField } from '@/app/free-trial/_components/TrialField';
import { validateTrialPassword } from '@/app/free-trial/_lib/utils';
import { apiPublicPost } from '@/lib/api';
import { hardNavigate } from '@/lib/navigation';
import { toastError, toastInfo } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { TRIAL_ACTIVATE_PATH, TRIAL_CREDS_STORAGE_KEY } from '@/constants/trial';
import type { TrialActivateResponse } from '@/types/trial';

// Backend response codes handled specially on activate.
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_CONFLICT = 409;

interface ActivateForm {
  password: string;
  confirmPassword: string;
}

function ActivateFormCard() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [invalidToken, setInvalidToken] = useState(false);
  const [accountConflict, setAccountConflict] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ActivateForm>();

  const onSubmit = async (data: ActivateForm) => {
    if (!token) {
      setInvalidToken(true);
      return;
    }

    try {
      const res: TrialActivateResponse = await apiPublicPost(TRIAL_ACTIVATE_PATH, {
        token,
        password: data.password,
      });
      // Stash creds for the auto-login on the progress screen (cleared after login).
      sessionStorage.setItem(
        TRIAL_CREDS_STORAGE_KEY,
        JSON.stringify({ email: res.email, password: data.password })
      );
      trackEvent(ANALYTICS_EVENTS.TRIAL_ACTIVATED);
      // Full-page navigation (not router.push) so the progress screen mounts on a clean
      // document load. A client-side transition lands the SWR poller into an already-live
      // SPA/HMR runtime where dev Fast Refresh events (broadcast to every open tab when any
      // route compiles on-demand) reset the refreshInterval timer before it can fire — the
      // screen then updates only on a manual refresh. A full load matches that working path.
      // The creds stashed in sessionStorage above survive same-origin navigation.
      hardNavigate(`/free-trial/progress?task_id=${res.task_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes(String(HTTP_STATUS_BAD_REQUEST))) {
        setInvalidToken(true);
        toastError.api(error, 'This link is invalid or has expired.');
      } else if (message.includes(String(HTTP_STATUS_CONFLICT))) {
        setAccountConflict(true);
        toastInfo.generic('This account already exists or is already being set up.');
      } else {
        toastError.api(error, 'Could not set your password. Please try again.');
      }
    }
  };

  // Figma frame 2453:3070. Note the design's "Resend email" button is shipped as a link
  // back to signup: a dead token yields no email, and POST /trial/signup needs email +
  // org_name + role, none of which are in scope here. See the plan's design questions.
  if (!token || invalidToken) {
    return (
      <TrialNoticeCard
        testId="trial-activate-invalid-token"
        title="This link has expired"
        description="For security, verification links time out after 24 hours. We can send a fresh one straight to your inbox."
      >
        <Button variant="primary" className="w-full" asChild>
          <Link href="/free-trial" data-testid="trial-activate-request-new-link">
            Get a new link
          </Link>
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/login" className="font-medium text-primary underline hover:no-underline">
            Back to log in
          </Link>
        </p>
      </TrialNoticeCard>
    );
  }

  return (
    <TrialCenteredCard testId="trial-activate-card">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <TrialBrandHeader
          title="Welcome to Dalgo"
          subtitle="Set up your password to finish setting up your workspace"
        />

        {accountConflict && (
          <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
            This account already exists or is already being set up.{' '}
            <Link href="/login" className="font-medium underline">
              Log in
            </Link>{' '}
            instead.
          </div>
        )}

        <div className="space-y-5">
          <TrialField id="password" label="Password*" error={errors.password?.message}>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Enter a password"
                aria-invalid={!!errors.password}
                data-testid="trial-activate-password-input"
                {...register('password', {
                  required: 'Password is required',
                  // Mirrors the three Django validators that actually run server-side, so a
                  // weak password is caught here rather than coming back as a 400 that is
                  // indistinguishable from an expired link.
                  validate: (value) => validateTrialPassword(value) ?? true,
                })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                data-testid="trial-activate-password-toggle"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </TrialField>

          <TrialField
            id="confirmPassword"
            label="Confirm Password*"
            error={errors.confirmPassword?.message}
          >
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Confirm your password"
                aria-invalid={!!errors.confirmPassword}
                data-testid="trial-activate-confirm-password-input"
                {...register('confirmPassword', {
                  required: 'Please confirm your password',
                  validate: (value) => value === watch('password') || 'Passwords do not match',
                })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                data-testid="trial-activate-confirm-password-toggle"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </TrialField>
        </div>

        <Button
          type="submit"
          variant="default"
          className="w-full"
          disabled={isSubmitting}
          data-testid="trial-activate-submit-button"
        >
          {isSubmitting ? 'Setting password…' : 'Continue'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Already have an account ?{' '}
          <Link href="/login" className="font-medium text-primary underline hover:no-underline">
            log in
          </Link>
        </p>
      </form>
    </TrialCenteredCard>
  );
}

export default function TrialActivatePage() {
  return (
    <Suspense
      fallback={
        <div className="text-center" data-testid="trial-activate-loading">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading...</p>
        </div>
      }
    >
      <ActivateFormCard />
    </Suspense>
  );
}
