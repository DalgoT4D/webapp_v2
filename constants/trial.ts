// Free trial onboarding constants — signup → activate → live progress → auto-login

// Free-trial length in days. Drives the header "N days remaining" badge, computed from the
// org's created_at. Must match the backend reaper that deletes trial orgs after this many days.
export const TRIAL_PERIOD_DAYS = 14;
// base_plan value the backend returns for free-trial orgs (OrgPlanType.FREE_TRIAL)
export const FREE_TRIAL_PLAN_NAME = 'Free Trial';

/** Whole calendar days left in a trial given the org's created_at (ISO). Clamped at 0. */
export function trialDaysRemaining(createdAtIso: string): number {
  const created = new Date(createdAtIso);
  const endMs = new Date(
    created.getFullYear(),
    created.getMonth(),
    created.getDate() + TRIAL_PERIOD_DAYS
  ).getTime();
  const now = new Date();
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const MS_PER_DAY = 86_400_000;
  return Math.max(0, Math.round((endMs - todayMs) / MS_PER_DAY));
}

/**
 * Whole calendar days since signup, counting the signup day as 0.
 *
 * NOT `TRIAL_PERIOD_DAYS - trialDaysRemaining()`, which is what the nudges used to do:
 * `trialDaysRemaining` clamps at 0, so that expression sticks at 14 forever once the trial
 * ends — an expired org whose reaper hasn't run yet would keep matching the day-14 nudge.
 * This counts up without a ceiling, so day 14 means day 14 and nothing later does.
 */
export function trialDaysElapsed(createdAtIso: string): number {
  const created = new Date(createdAtIso);
  const createdMs = new Date(
    created.getFullYear(),
    created.getMonth(),
    created.getDate()
  ).getTime();
  const now = new Date();
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const MS_PER_DAY = 86_400_000;
  // Clamped below only, against a clock skew that puts "today" before signup.
  return Math.max(0, Math.round((todayMs - createdMs) / MS_PER_DAY));
}

/**
 * Elapsed days that fire a trial lifecycle nudge (see TrialDayNudgeModal). Day 7 is the
 * halfway "let's get your data flowing" prompt; 13 and 14 are the second-last and last days
 * of the trial, both showing the "almost over" upgrade modal.
 *
 * Shared with NudgeCenter, which decides whether to mount the modal at all — the two must
 * agree or the modal mounts on a day it then refuses to render.
 */
export const TRIAL_NUDGE_DAYS = [7, 13, 14] as const;
export type TrialNudgeDay = (typeof TRIAL_NUDGE_DAYS)[number];

// TODO: point at the real scheduling link once it exists. Kept as a single constant so the
// swap is one line — the "Book a call" link in the trial nudge modals reads it.
export const BOOK_A_CALL_URL = '#';

// Public product docs — the "Read documentation" link in the getting-started widget's
// all-done state.
export const DALGO_DOCS_URL = 'https://docs.dalgo.org/intro';

// Status polling cadence for the progress screen (ms). Kept above the SWRProvider's
// dedupingInterval (2000ms in lib/swr.tsx). The hook also sets refreshWhenHidden so
// polling continues even if the tab is backgrounded — this is a provisioning screen
// the user watches, and it must keep advancing regardless of tab focus/visibility.
export const TRIAL_STATUS_POLL_INTERVAL = 5000;
// tick for the "elapsed" clock on the provisioning screen (1s)
export const TRIAL_ELAPSED_TICK_MS = 1000;
// Number of consecutive failed status polls before we stop spinning and show the
// "taking too long" fallback card (e.g. backend unreachable / wrong port). At the
// 3s cadence, 15 failures ≈ 45s of solid errors before we give up.
export const TRIAL_MAX_CONSECUTIVE_POLL_FAILURES = 15;
// Hard ceiling on the provisioning screen (seconds). The BACKEND now owns the real timeout:
// clone_trial_org_task has soft_time_limit=300 / hard time_limit=360, so a wedged clone tears
// down and reports "failed" by ~360s. This ceiling sits ABOVE that (420s) so the backend's
// terminal "failed" almost always arrives first and the user lands on the clean single "Try
// again" card — this frontend ceiling is only the last-resort escape hatch for a truly
// unreachable backend.
export const TRIAL_HARD_TIMEOUT_SECONDS = 420;

// Public backend endpoints (unauthenticated — via apiPublicPost/apiPublicGet)
export const TRIAL_SIGNUP_PATH = '/api/v1/public/trial/signup';
export const TRIAL_ACTIVATE_PATH = '/api/v1/public/trial/activate';
export const TRIAL_STATUS_PATH = '/api/v1/public/trial/status';
// Re-run a failed clone under the SAME task_id — no re-signup / re-verify / re-password. The
// backend kept the person (email + password + verified) when it tore down the failed attempt.
export const TRIAL_RETRY_PATH = '/api/v1/public/trial/retry';

// Role options for the trial signup form. Same list the post-invitation signup uses for its
// "work domain" field (app/invitations/page.tsx) — kept in sync so the captured value matches.
// This is job-title metadata only; it is NOT a Dalgo permission role.
export const TRIAL_ROLE_OPTIONS = [
  { value: 'none', label: 'None / Prefer not to say' },
  { value: 'monitoring_evaluation', label: 'Monitoring & Evaluation' },
  { value: 'program_manager', label: 'Program Manager' },
  { value: 'data_tech', label: 'Data & Tech' },
  { value: 'leadership', label: 'Leadership (COO, Founder, CTO etc.)' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'field_worker', label: 'Field worker' },
] as const;

// Labels shown on the progress screen. The backend emits 7 numbered steps (1-7, see
// clone_service.STEP_LABELS) — the warehouse data copy happens server-side inside step 2
// ("Setting up warehouse"), so the lists map 1:1.
export const TRIAL_STEP_LABELS = [
  'Creating workspace',
  'Setting up warehouse',
  'Connecting sources',
  'Building pipelines',
  'Setting up transforms',
  'Scheduling syncs',
  'Finalizing',
];

// Maps the backend's 1-based step number → 0-based index into TRIAL_STEP_LABELS. Index 0 is a
// placeholder (backend steps are 1-based).
export const BACKEND_STEP_TO_DISPLAY_INDEX = [0, 0, 1, 2, 3, 4, 5, 6];

// sessionStorage key bridging the activate page's credentials to the
// progress page's auto-login (cleared immediately after login)
export const TRIAL_CREDS_STORAGE_KEY = 'dalgo_trial_creds';

// sessionStorage key bridging the activate page's token + password to the consent
// page, which is where the activate API call (account creation) actually fires.
// Cleared once that call succeeds.
export const TRIAL_PENDING_ACTIVATION_KEY = 'dalgo_trial_pending_activation';

const TRIAL_DAY_NUDGE_DISMISSED_PREFIX = 'dalgo_trial_day_nudge_dismissed_';

/**
 * Per-SESSION dismiss for the trial lifecycle nudges (TrialDayNudgeModal), keyed by org and
 * elapsed day.
 *
 * Written when the user CLOSES the modal, not when it opens: closing is the only thing that
 * suppresses it. A reload before closing deliberately shows it again — the user hasn't
 * acknowledged it yet, and on days 13 and 14 that message is worth repeating.
 *
 * sessionStorage, deliberately: once closed it stays gone for the rest of the session however
 * the user navigates or refreshes, but coming back to Dalgo in a new session on a nudge day
 * shows it again. These are end-of-trial prompts; landing once and never again for the rest of
 * the trial would waste the day that matters most.
 */
export function markTrialDayNudgeDismissed(orgSlug: string, day: number): void {
  try {
    sessionStorage.setItem(`${TRIAL_DAY_NUDGE_DISMISSED_PREFIX}${day}_${orgSlug}`, '1');
  } catch {
    // no-op
  }
}

export function hasTrialDayNudgeDismissed(orgSlug: string, day: number): boolean {
  try {
    return sessionStorage.getItem(`${TRIAL_DAY_NUDGE_DISMISSED_PREFIX}${day}_${orgSlug}`) === '1';
  } catch {
    return false;
  }
}

/**
 * Whether a trial lifecycle nudge is due right now — today is one of TRIAL_NUDGE_DAYS and it
 * hasn't been dismissed this session.
 *
 * Read by NudgeCenter (to decide whether to mount the modal) AND by TourGate (to stand its own
 * landing-page modal down). Both are unrouted auto-opening dialogs, so without this they stack
 * on /impact on days 7, 13 and 14 — the day the trial nudge matters most is exactly the day
 * the intent modal is most likely to be showing.
 *
 * Browser-only (sessionStorage): call it from an effect, never during render.
 */
export function isTrialDayNudgeDue(orgSlug: string, createdAtIso: string): boolean {
  const elapsedDay = trialDaysElapsed(createdAtIso);
  return (
    TRIAL_NUDGE_DAYS.some((d) => d === elapsedDay) &&
    !hasTrialDayNudgeDismissed(orgSlug, elapsedDay)
  );
}
