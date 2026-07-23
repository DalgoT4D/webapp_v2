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
