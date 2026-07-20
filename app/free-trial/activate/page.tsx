'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AnimatedBackgroundSimple } from '@/components/ui/animated-background-simple';
import { apiPublicPost } from '@/lib/api';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [invalidToken, setInvalidToken] = useState(false);
  const [accountConflict, setAccountConflict] = useState(false);

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
      router.push(`/free-trial/progress?task_id=${res.task_id}`);
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

  if (!token || invalidToken) {
    return (
      <AnimatedBackgroundSimple>
        <div className="flex min-h-screen items-center justify-center">
          <div
            className="w-full max-w-sm space-y-6 rounded-lg bg-white/95 backdrop-blur-sm p-8 shadow-lg border border-white/20"
            data-testid="trial-activate-invalid-token"
          >
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
              <h1 className="text-2xl font-bold mb-2">Invalid or expired link</h1>
              <p className="text-gray-600">
                This activation link is invalid or has expired. Please request a new one.
              </p>
            </div>
            <div className="text-center pt-4">
              <Link
                href="/free-trial"
                className="text-primary hover:underline font-medium"
                data-testid="trial-activate-request-new-link"
              >
                Request a new link
              </Link>
            </div>
          </div>
        </div>
      </AnimatedBackgroundSimple>
    );
  }

  return (
    <AnimatedBackgroundSimple>
      <div className="flex min-h-screen items-center justify-center">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="w-full max-w-sm space-y-6 rounded-lg bg-white/95 backdrop-blur-sm p-8 shadow-lg border border-white/20"
        >
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
            <h1 className="text-2xl font-bold mb-2">Set your password</h1>
            <p className="text-gray-600">Choose a password to finish setting up your workspace</p>
          </div>

          {accountConflict && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 px-4 py-3 rounded text-sm">
              This account already exists or is already being set up.{' '}
              <Link href="/login" className="underline font-medium">
                Log in
              </Link>{' '}
              instead.
            </div>
          )}

          <div>
            <Label htmlFor="password">Password*</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Enter a password"
              data-testid="trial-activate-password-input"
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: 8,
                  message: 'Password must be at least 8 characters',
                },
              })}
              className="mt-1"
            />
            {errors.password && (
              <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirm password*</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Confirm your password"
              data-testid="trial-activate-confirm-password-input"
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (value) => value === watch('password') || 'Passwords do not match',
              })}
              className="mt-1"
            />
            {errors.confirmPassword && (
              <p className="text-red-600 text-sm mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={isSubmitting}
            data-testid="trial-activate-submit-button"
          >
            {isSubmitting ? 'Setting password...' : 'Set password & continue'}
          </Button>

          <div className="text-center text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Log in
            </Link>
          </div>
        </form>
      </div>
    </AnimatedBackgroundSimple>
  );
}

export default function TrialActivatePage() {
  return (
    <Suspense
      fallback={
        <AnimatedBackgroundSimple>
          <div className="flex min-h-screen items-center justify-center">
            <div className="text-center" data-testid="trial-activate-loading">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-lg font-medium">Loading...</p>
            </div>
          </div>
        </AnimatedBackgroundSimple>
      }
    >
      <ActivateFormCard />
    </Suspense>
  );
}
