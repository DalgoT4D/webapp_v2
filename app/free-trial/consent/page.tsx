'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Database, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TrialCenteredCard } from '@/app/free-trial/_components/TrialCenteredCard';
import { TrialBrandHeader } from '@/app/free-trial/_components/TrialBrandHeader';
import { apiPublicPost } from '@/lib/api';
import { hardNavigate } from '@/lib/navigation';
import { toastError, toastInfo } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import {
  TRIAL_ACTIVATE_PATH,
  TRIAL_CREDS_STORAGE_KEY,
  TRIAL_PENDING_ACTIVATION_KEY,
} from '@/constants/trial';
import type { TrialActivateResponse } from '@/types/trial';

// Backend response codes handled specially on activate.
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_CONFLICT = 409;

interface PendingActivation {
  token: string;
  password: string;
}

const DATA_HANDLING_NOTICES = [
  {
    icon: Clock,
    title: '14-day trial, then deleted',
    description:
      'This account is valid for two weeks following which the account and underlying data will be deleted.',
  },
  {
    icon: Database,
    title: 'Stored in a Dalgo warehouse',
    description:
      'All the data you connect to Dalgo during this trial is stored in a Dalgo provisioned data warehouse. This can be edited in warehouse settings.',
  },
  {
    icon: ShieldCheck,
    title: 'Avoid sensitive or personal data',
    description:
      "Avoid uploading sensitive/private information to the Dalgo warehouse during this trial. As per DPDP you are liable as the data fiduciary for your team and beneficiarie's data.",
  },
];

export default function TrialConsentPage() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingActivation | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);
  const [accountConflict, setAccountConflict] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(TRIAL_PENDING_ACTIVATION_KEY);
    if (!raw) {
      // No pending activation — e.g. this screen was opened directly. Nothing to
      // create an account from, so send the user back to start the flow over.
      router.replace('/free-trial');
      return;
    }
    setPending(JSON.parse(raw));
  }, [router]);

  const handleAccept = async () => {
    if (!pending) return;
    setSubmitting(true);
    try {
      const res: TrialActivateResponse = await apiPublicPost(TRIAL_ACTIVATE_PATH, {
        token: pending.token,
        password: pending.password,
      });
      // Stash creds for the auto-login on the progress screen (cleared after login).
      sessionStorage.setItem(
        TRIAL_CREDS_STORAGE_KEY,
        JSON.stringify({ email: res.email, password: pending.password })
      );
      sessionStorage.removeItem(TRIAL_PENDING_ACTIVATION_KEY);
      trackEvent(ANALYTICS_EVENTS.TRIAL_ACTIVATED);
      // Full-page navigation so the progress screen's SWR poller mounts on a clean
      // document load — see activate page's note on hardNavigate for why.
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
        toastError.api(error, 'Could not set up your workspace. Please try again.');
      }
      setSubmitting(false);
    }
  };

  if (!pending) {
    return (
      <div className="text-center" data-testid="trial-consent-loading">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-lg font-medium">Loading...</p>
      </div>
    );
  }

  return (
    <TrialCenteredCard testId="trial-consent-card" width="wide">
      <TrialBrandHeader
        title="How we handle your trial data"
        subtitle="A few things to know while we set up your workspace."
      />

      {invalidToken && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          This link is invalid or has expired. Please request a new one from the signup page.
        </div>
      )}

      {accountConflict && (
        <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
          This account already exists or is already being set up.
        </div>
      )}

      <div className="rounded-lg border divide-y">
        {DATA_HANDLING_NOTICES.map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex gap-4 p-4">
            <div className="flex-shrink-0 h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="trial-consent-checkbox"
          checked={agreed}
          onCheckedChange={(checked) => setAgreed(checked === true)}
          data-testid="trial-consent-checkbox"
        />
        <label htmlFor="trial-consent-checkbox" className="text-sm text-muted-foreground">
          I&apos;ve read and accept the{' '}
          <a
            href="https://dalgo.org/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
            data-testid="trial-consent-privacy-policy-link"
          >
            Privacy Policy
          </a>
        </label>
      </div>

      <Button
        type="button"
        variant="primary"
        className="w-full"
        disabled={!agreed || submitting}
        onClick={handleAccept}
        data-testid="trial-consent-accept-button"
      >
        {submitting ? 'Setting up…' : 'Accept and Continue'}
      </Button>
    </TrialCenteredCard>
  );
}
