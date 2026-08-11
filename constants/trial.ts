// Free trial onboarding constants — signup → activate → live progress → auto-login

/**
 * Default free-trial length in days, for copy and for tests that need a realistic window.
 *
 * NOT a source of truth for any countdown. Every trial window comes from the org's plan dates
 * (`OrgPlans.start_date` / `end_date`, surfaced on currentuserv2 as `plan_start_date` /
 * `plan_end_date`) — an admin can extend or shorten a trial via the backend's `createorgplan`,
 * and the lifecycle emails and expired-trial reaper both honour those dates. Anything here that
 * counted days from a constant would quietly disagree with them.
 *
 * Keep in sync with the backend's TRIAL_DURATION_DAYS.
 */
export const TRIAL_PERIOD_DAYS = 14;
// base_plan value the backend returns for free-trial orgs (OrgPlanType.FREE_TRIAL)
export const FREE_TRIAL_PLAN_NAME = 'Free Trial';

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

/**
 * Days left before the plan's `end_date`, counted INCLUSIVE of the day the user is on — a trial
 * that started an hour ago reads 14, not 13, and its final day reads 1.
 *
 * Ceil, not floor, because that is exactly what the backend says out loud. The lifecycle emails
 * compute `total_days - day_number` where `day_number = (now - start_date).days` floors
 * (`lifecycle_emails.trial_window`), and `total_days - floor(elapsed) === ceil(total_days -
 * elapsed) === ceil(remaining)`. Flooring the remainder here made every surface in the app read
 * one day lower than the email that landed in the same inbox on the same day.
 *
 * Duration math, deliberately NOT calendar days in the viewer's local timezone. Calendar-day
 * math made the answer depend on the browser's clock offset, so a user in IST and the nightly
 * backend sweep could disagree by a day about which day of the trial it was — the frontend's
 * midpoint modal would fire before the backend's midpoint email. Duration math gives both the
 * same number wherever the user is.
 *
 * NOT clamped: an expired trial whose reaper hasn't run yet returns 0 or a negative number, and
 * callers need to be able to tell "last day" (1) from "already over" (<= 0). Clamping here is
 * what made the old created_at version stick at its bounds forever. Clamp at the point of
 * display instead.
 */
export function trialDaysRemaining(endIso: string): number {
  return Math.ceil((new Date(endIso).getTime() - Date.now()) / MS_PER_DAY);
}

/**
 * Hours left before the plan's `end_date`, rounded the same inclusive way `trialDaysRemaining`
 * rounds days — 90 minutes left reads as 2, and anything inside the last hour reads as 1.
 *
 * Only meaningful on the final day; `trialCountdownLabel` is what decides when to reach for it.
 */
export function trialHoursRemaining(endIso: string): number {
  return Math.ceil((new Date(endIso).getTime() - Date.now()) / MS_PER_HOUR);
}

/**
 * The one countdown string every surface shows — header badge and the billing page — so the two
 * can never word the same moment differently.
 *
 * Days until the final day, then hours. The whole last day counts in hours rather than saying
 * "last day today": a trial expires at the clock time it was created (end_date is clone-time +
 * 14 days, see the backend's clone_service), so "last day" spans anything from 24 hours to a
 * few minutes. An hour count is the only thing that tells the user which of those they're in.
 *
 * Reads the clock, so it does NOT update on its own — a caller that keeps it on screen has to
 * re-render on a timer (see TRIAL_COUNTDOWN_TICK_MS).
 */
export function trialCountdownLabel(endIso: string): string {
  const days = trialDaysRemaining(endIso);
  // 2+ days covers everything up to the second-last day; 1 means "somewhere inside the last
  // 24 hours", which is where the hour count takes over.
  if (days >= 2) return `${days} days left`;

  const hours = trialHoursRemaining(endIso);
  // Unclamped, like the day count: the reaper sweeps hourly, so an org can sit past its
  // end_date for up to an hour, and saying anything but "ended" then would be a lie.
  if (hours <= 0) return 'Trial ended';
  // Ceil means 1 covers the whole final hour — there is no honest "1 hour left" to show.
  if (hours === 1) return 'Less than an hour left';
  return `${hours} hours left`;
}

/**
 * How often a mounted countdown re-reads the clock. One minute: the label only ever changes on
 * an hour boundary, and a minute of staleness on that is invisible, but a tab left open all day
 * must not still be showing the number it mounted with.
 */
export const TRIAL_COUNTDOWN_TICK_MS = 60_000;

/**
 * Days REMAINING that fire a trial lifecycle nudge (see TrialDayNudgeModal). 7 is the halfway
 * "let's get your data flowing" prompt; 2 and 1 are the second-last and last days, both
 * showing the "almost over" upgrade modal.
 *
 * These count the same inclusive way `trialDaysRemaining` does, so the LAST day is 1, not 0 —
 * 0 is only ever the expiry instant itself, which no user is sitting on. Day 7 lands on the
 * same calendar day as the backend's midpoint email (`day_number >= 7`), so the modal saying
 * "7 days left" agrees with both the email and the header badge.
 *
 * Keyed on days remaining rather than days elapsed because that is what the copy says out loud
 * ("7 days left", "your account will be deleted on…"). On the standard 14-day window the two
 * are the same trigger; on an admin-shortened window only the remaining-based one keeps the
 * words true.
 *
 * Shared with NudgeCenter, which decides whether to mount the modal at all — the two must
 * agree or the modal mounts on a day it then refuses to render.
 */
export const TRIAL_NUDGE_DAYS = [7, 2, 1] as const;
export type TrialNudgeDay = (typeof TRIAL_NUDGE_DAYS)[number];

// Booking link for a call with the Dalgo team. Read by the "Book a call" link in the trial
// nudge modals and the getting-started widget's "Schedule a call with us" row — one constant so
// a change of host or owner is a single edit.
export const BOOK_A_CALL_URL = 'https://calendly.com/priyesh-projecttech4dev/30min';

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

// "Function" options for the trial signup form, also imported by the post-invitation signup
// (app/invitations/page.tsx) so both forms offer exactly one list. This is metadata about the
// person's team; it is NOT a Dalgo permission role.
//
// The backend accepts ONLY these five slugs (trial_schema.WorkDomain) — anything else is a 422.
// Adding or renaming an option means changing that Literal too.
export const WORK_FUNCTION_OPTIONS = [
  { value: 'monitoring_evaluation', label: 'Monitoring and Evaluation' },
  { value: 'program_implementation', label: 'Program Implementation' },
  { value: 'data_technology', label: 'Data and Technology' },
  { value: 'leadership', label: 'Leadership (Founder, COO, CTO, etc.)' },
  { value: 'external_consultant', label: 'External Consultant' },
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
 * days remaining.
 *
 * Written when the user CLOSES the modal, not when it opens: closing is the only thing that
 * suppresses it. A reload before closing deliberately shows it again — the user hasn't
 * acknowledged it yet, and on the last two days that message is worth repeating.
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
 * on /impact on nudge days — the day the trial nudge matters most is exactly the day the intent
 * modal is most likely to be showing.
 *
 * Browser-only (sessionStorage): call it from an effect, never during render.
 */
export function isTrialDayNudgeDue(orgSlug: string, endIso: string): boolean {
  const daysLeft = trialDaysRemaining(endIso);
  return (
    TRIAL_NUDGE_DAYS.some((d) => d === daysLeft) && !hasTrialDayNudgeDismissed(orgSlug, daysLeft)
  );
}
