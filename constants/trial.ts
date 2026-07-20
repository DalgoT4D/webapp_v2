// Free trial onboarding constants — signup → activate → live progress → auto-login

// Status polling cadence for the progress screen (ms)
export const TRIAL_STATUS_POLL_INTERVAL = 2000;

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
