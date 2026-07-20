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
}
