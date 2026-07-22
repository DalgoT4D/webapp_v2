'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import Link from 'next/link';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AnimatedBackgroundSimple } from '@/components/ui/animated-background-simple';
import { apiPublicPost } from '@/lib/api';
import { toastError, toastInfo } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { TRIAL_SIGNUP_PATH, TRIAL_ROLE_OPTIONS } from '@/constants/trial';
import type { TrialSignupRequest } from '@/types/trial';

// Backend returns 409 when an account with this email already exists.
const HTTP_STATUS_CONFLICT = 409;

export default function FreeTrialPage() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TrialSignupRequest>();

  const onSubmit = async (data: TrialSignupRequest) => {
    try {
      await apiPublicPost(TRIAL_SIGNUP_PATH, data);
      trackEvent(ANALYTICS_EVENTS.TRIAL_SIGNUP_SUBMITTED);
      setSubmittedEmail(data.email);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes(String(HTTP_STATUS_CONFLICT))) {
        setAccountExists(true);
        toastInfo.generic('An account with this email already exists.');
      } else {
        toastError.api(error, 'Could not start your trial. Please try again.');
      }
    }
  };

  if (submittedEmail) {
    return (
      <AnimatedBackgroundSimple>
        <div className="flex min-h-screen items-center justify-center">
          <div
            className="w-full max-w-sm space-y-6 rounded-lg bg-white/95 backdrop-blur-sm p-8 shadow-lg border border-white/20"
            data-testid="trial-signup-confirmation"
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
              <h1 className="text-2xl font-bold mb-2">Check your email</h1>
              <p className="text-gray-600">
                We've sent a verification link to <strong>{submittedEmail}</strong>. Click it to set
                your password and create your workspace.
              </p>
            </div>
            <div className="text-center pt-4">
              <Link href="/login" className="text-primary hover:underline font-medium">
                Already have an account? Log in
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
            <h1 className="text-2xl font-bold mb-2">Start your free trial</h1>
            <p className="text-gray-600">Set up a Dalgo workspace in minutes</p>
          </div>

          {accountExists && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 px-4 py-3 rounded text-sm">
              An account with this email already exists.{' '}
              <Link href="/login" className="underline font-medium">
                Log in
              </Link>{' '}
              instead.
            </div>
          )}

          <div>
            <Label htmlFor="email">Email*</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="eg. user@domain.com"
              data-testid="trial-signup-email-input"
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                },
              })}
              className="mt-1"
            />
            {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <Label htmlFor="org_name">Organization Name*</Label>
            <Input
              id="org_name"
              type="text"
              autoComplete="organization"
              placeholder="eg. Acme Foundation"
              data-testid="trial-signup-org-name-input"
              {...register('org_name', { required: 'Organization name is required' })}
              className="mt-1"
            />
            {errors.org_name && (
              <p className="text-red-600 text-sm mt-1">{errors.org_name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="role">Your Role*</Label>
            <Controller
              name="role"
              control={control}
              rules={{ required: 'Role is required' }}
              render={({ field }) => (
                <Select value={field.value || ''} onValueChange={field.onChange}>
                  <SelectTrigger id="role" className="mt-1" data-testid="trial-signup-role-input">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIAL_ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.role && <p className="text-red-600 text-sm mt-1">{errors.role.message}</p>}
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={isSubmitting}
            data-testid="trial-signup-submit-button"
          >
            {isSubmitting ? 'Starting your trial...' : 'Start free trial'}
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
