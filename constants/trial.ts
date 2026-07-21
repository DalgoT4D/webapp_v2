// Free trial onboarding constants — signup → activate → live progress → auto-login

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
// Hard ceiling on the provisioning screen. The clone measures ~82s end-to-end;
// if we cross this without a terminal status the poll is almost certainly wedged,
// so flip to the fallback card instead of spinning forever. (seconds)
export const TRIAL_HARD_TIMEOUT_SECONDS = 300;

// Public backend endpoints (unauthenticated — via apiPublicPost/apiPublicGet)
export const TRIAL_SIGNUP_PATH = '/api/v1/public/trial/signup';
export const TRIAL_ACTIVATE_PATH = '/api/v1/public/trial/activate';
export const TRIAL_STATUS_PATH = '/api/v1/public/trial/status';

// Friendly step order for rendering (backend sends the same labels)
export const TRIAL_STEP_LABELS = [
  'Creating your workspace',
  'Setting up your warehouse',
  'Copying your data',
  'Connecting your sources',
  'Building your pipelines',
  'Setting up transforms',
  'Scheduling syncs',
  'Preparing your dashboards',
];

// sessionStorage key bridging the activate page's credentials to the
// progress page's auto-login (cleared immediately after login)
export const TRIAL_CREDS_STORAGE_KEY = 'dalgo_trial_creds';
