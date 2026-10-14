// Pure helpers for the free-trial screens. Kept out of the page components so the
// edge-case logic (step derivation, password rules, storage guards) is directly
// unit-testable — see __tests__/utils.test.ts.

import {
  BACKEND_STEP_TO_DISPLAY_INDEX,
  TRIAL_STEP_LABELS,
  TRIAL_VALIDATE_PASSWORD_PATH,
} from '@/constants/trial';
import { apiPublicPost } from '@/lib/api';
import { TRIAL_PASSWORD_MIN_LENGTH } from './constants';
import type { TrialProgressStep } from '@/types/trial';

/**
 * The two Django validators we can check offline: length and all-numeric.
 *
 * The backend calls `validate_password(password)` with NO user object, so
 * `UserAttributeSimilarityValidator` returns early and never fires. The only other live
 * validator is `CommonPasswordValidator`, which needs Django's 20,000-word list — that one
 * is checked by asking the backend (`checkTrialPasswordWithBackend`).
 *
 * Returns the message to show, or null when the password clears these two rules.
 */
export function validateTrialPassword(password: string): string | null {
  if (password.length < TRIAL_PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${TRIAL_PASSWORD_MIN_LENGTH} characters`;
  }
  if (/^\d+$/.test(password)) {
    return 'Password cannot be entirely numbers';
  }
  return null;
}

// Matches the Error `apiPublicPost` throws: `Public API error: <status> <statusText> - <detail>`.
const PUBLIC_API_ERROR_PATTERN = /^Public API error: (\d{3})[^-]*(?: - (.*))?$/s;

/**
 * Pull a REJECTION reason out of an `apiPublicPost` error — i.e. Django's own message on a 400.
 *
 * Only 400 counts. A 500 or a network failure means the check itself broke, not that the
 * password is bad, and surfacing that as a password error would tell the user to change a
 * password that may be perfectly fine. Those return null so the caller falls open.
 */
function passwordRejectionReason(error: unknown): string | null {
  const message = error instanceof Error ? error.message : '';
  const match = PUBLIC_API_ERROR_PATTERN.exec(message);
  if (!match || match[1] !== '400') return null;
  return match[2]?.trim() || null;
}

/**
 * Ask the backend to run the real `AUTH_PASSWORD_VALIDATORS` against this password.
 *
 * Runs the offline rules first so an obviously-short password costs no round-trip, then hits
 * `/trial/validate-password` for the rest (in practice: the common-password list). Returns
 * Django's own message so the user is told exactly which rule they broke, or null when the
 * password passes.
 *
 * Fails OPEN — a network error, a 500, or a 400 with no detail all return null and let the
 * user continue. `/trial/activate` re-validates server-side and is the actual gate; blocking
 * signup here because a UX pre-check couldn't reach the server would be strictly worse.
 */
export async function checkTrialPasswordWithBackend(password: string): Promise<string | null> {
  const offlineError = validateTrialPassword(password);
  if (offlineError) return offlineError;

  try {
    await apiPublicPost(TRIAL_VALIDATE_PASSWORD_PATH, { password });
    return null;
  } catch (error) {
    return passwordRejectionReason(error);
  }
}

/** Map the backend's 1-based `step` onto a 0-based index into TRIAL_STEP_LABELS. */
export function backendStepToDisplayIndex(step: number): number | null {
  return BACKEND_STEP_TO_DISPLAY_INDEX[step] ?? null;
}

/**
 * Resolve which step the progress bar should sit on from the event history.
 *
 * Walks backwards from the latest event so a single label that has drifted out of
 * sync with the frontend↔backend contract doesn't roll the bar back to 0 — it falls
 * back to the nearest earlier event that still resolves to a known step.
 */
export function deriveCurrentIndex(progress: TrialProgressStep[] | undefined): number {
  if (!progress || progress.length === 0) {
    return 0;
  }

  for (let i = progress.length - 1; i >= 0; i -= 1) {
    const step = progress[i];
    if (typeof step.step === 'number') {
      const displayIndex = backendStepToDisplayIndex(step.step);
      if (displayIndex !== null) {
        return displayIndex;
      }
    }
    const labelIndex = TRIAL_STEP_LABELS.indexOf(step.message);
    if (labelIndex >= 0) {
      return labelIndex;
    }
  }

  // Nothing in the whole history matched — the history holds only non-step events
  // (the "queued" marker right after a signup/retry, or a terminal marker). Start at
  // the FIRST step: returning the last index here rendered every step as already
  // complete ("all ticks + Finalizing") on a freshly queued or just-retried clone.
  return 0;
}
