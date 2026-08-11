'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TrialSplitCard } from '@/app/free-trial/_components/TrialSplitCard';
import { TrialCenteredCard } from '@/app/free-trial/_components/TrialCenteredCard';
import { TrialMarketingPanel } from '@/app/free-trial/_components/TrialMarketingPanel';
import { TrialBrandHeader } from '@/app/free-trial/_components/TrialBrandHeader';
import { TrialField } from '@/app/free-trial/_components/TrialField';
import { TRIAL_MARKETING_PANELS } from '@/app/free-trial/_lib/constants';
import { inboxUrlForEmail } from '@/app/free-trial/_lib/utils';
import { apiPublicPost } from '@/lib/api';
import { toastError, toastInfo } from '@/lib/toast';
import { trackEvent, trackFeatureView } from '@/lib/analytics';
import { ANALYTICS_EVENTS, FEATURES } from '@/constants/analytics';
import { TRIAL_SIGNUP_PATH, WORK_FUNCTION_OPTIONS } from '@/constants/trial';
import type { TrialSignupRequest } from '@/types/trial';

// Backend returns 409 when an account with this email already exists.
const HTTP_STATUS_CONFLICT = 409;

export default function FreeTrialPage() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [resending, setResending] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<TrialSignupRequest>();

  const onSubmit = async (data: TrialSignupRequest) => {
    try {
      await apiPublicPost(TRIAL_SIGNUP_PATH, data);
      trackEvent(ANALYTICS_EVENTS.TRIAL_SIGNUP_SUBMITTED);
      // The confirmation screen is local state, not a route, so feature:viewed won't
      // fire for it on its own — see rules/analytics.md on tab-like screens.
      trackFeatureView(FEATURES.FREE_TRIAL_SIGNUP, { tab: 'check_email' });
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

  // Re-POST the same signup payload — the backend treats a repeat signup for an unverified
  // email as "send a fresh link" (its account-exists check keys on OrgUser, which only exists
  // once a clone has run), so no separate resend endpoint is needed. A previously-sent link
  // stays valid too; whichever the user clicks first wins.
  //
  // This reads the values off the still-mounted React Hook Form instance, so it works for as
  // long as the user stays on this screen. A refresh returns them to the empty form instead.
  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    try {
      await apiPublicPost(TRIAL_SIGNUP_PATH, getValues());
      trackEvent(ANALYTICS_EVENTS.TRIAL_LINK_RESENT);
      toastInfo.generic(`Verification link re-sent to ${submittedEmail}.`);
    } catch (error) {
      toastError.api(error, 'Could not resend the link. Please try again.');
    } finally {
      setResending(false);
    }
  };

  if (submittedEmail) {
    const inboxUrl = inboxUrlForEmail(submittedEmail);

    return (
      <TrialCenteredCard testId="trial-signup-confirmation">
        <TrialBrandHeader
          title="Verify your email"
          align="center"
          subtitle={
            <>
              We&apos;ve sent a verification link to <strong>{submittedEmail}</strong>. Click it to
              set your password and create your workspace.
            </>
          }
        />

        <div className="space-y-4">
          <p className="text-center text-xs text-muted-foreground">
            Incorrect email?{' '}
            <button
              type="button"
              onClick={() => setSubmittedEmail(null)}
              className="font-medium text-primary underline hover:no-underline"
              data-testid="trial-change-email"
            >
              Change email address
            </button>
          </p>

          {/* Only rendered when we can resolve the provider — a button that goes
              nowhere is worse than no button. */}
          {inboxUrl ? (
            <Button variant="primary" className="w-full" asChild>
              <a
                href={inboxUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="trial-open-email-app"
              >
                Open email app
              </a>
            </Button>
          ) : null}

          <p className="text-center text-xs text-muted-foreground">
            Didn&apos;t receive it?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="font-medium text-primary underline hover:no-underline disabled:opacity-50"
              data-testid="trial-resend-link"
            >
              {resending ? 'Resending…' : 'Resend email'}
            </button>
          </p>

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline">
              Back to log in
            </Link>
          </p>
        </div>
      </TrialCenteredCard>
    );
  }

  return (
    <TrialSplitCard
      testId="trial-signup-card"
      aside={<TrialMarketingPanel panel={TRIAL_MARKETING_PANELS.signup} priority />}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <TrialBrandHeader title="Create your account" logoGapClassName="mb-[62px]" />

        {accountExists && (
          <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
            An account with this email already exists.{' '}
            <Link href="/login" className="font-medium underline">
              Log in
            </Link>{' '}
            instead.
          </div>
        )}

        <div className="space-y-5">
          <TrialField id="email" label="Email ID" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="eg xycemail.com"
              aria-invalid={!!errors.email}
              data-testid="trial-signup-email-input"
              {...register('email', {
                required: 'Required field',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email. Please check again',
                },
              })}
            />
          </TrialField>

          <TrialField id="role" label="Function" error={errors.role?.message}>
            <Controller
              name="role"
              control={control}
              rules={{ required: 'Required field' }}
              render={({ field }) => (
                <Select value={field.value || ''} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="role"
                    className="w-full"
                    aria-invalid={!!errors.role}
                    data-testid="trial-signup-role-input"
                  >
                    <SelectValue placeholder="eg. Data and Technology" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_FUNCTION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </TrialField>

          <TrialField id="org_name" label="Organization Name" error={errors.org_name?.message}>
            <Input
              id="org_name"
              type="text"
              autoComplete="organization"
              placeholder="eg. ABC foundation"
              aria-invalid={!!errors.org_name}
              data-testid="trial-signup-org-name-input"
              {...register('org_name', { required: 'Required field' })}
            />
          </TrialField>
        </div>

        <Button
          type="submit"
          variant="default"
          className="w-full"
          disabled={isSubmitting}
          data-testid="trial-signup-submit-button"
        >
          {isSubmitting ? 'Starting your trial…' : 'Continue'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Already have an account ?{' '}
          <Link href="/login" className="font-medium text-primary underline hover:no-underline">
            log in
          </Link>
        </p>
      </form>
    </TrialSplitCard>
  );
}
