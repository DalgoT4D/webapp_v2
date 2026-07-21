// Free trial onboarding types — signup → activate → live progress → auto-login

export interface TrialSignupRequest {
  email: string;
  org_name: string;
  role: string;
}

export interface TrialSignupResponse {
  status: string;
}

export interface TrialActivateRequest {
  token: string;
  password: string;
}

export interface TrialActivateResponse {
  task_id: string;
  email: string;
}

export interface TrialProgressStep {
  step?: number;
  message: string;
  status: string;
  org_slug?: string;
}

export interface TrialStatusResponse {
  task_id: string;
  progress: TrialProgressStep[];
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed';
  org_slug?: string;
  // clone start time (unix seconds), set by the backend at activate. Lets the progress
  // screen anchor its elapsed clock to a fixed origin so it survives a page refresh.
  started_at?: number | null;
}
