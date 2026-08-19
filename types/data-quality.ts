export type ElementarySetupStatus = 'set-up' | 'not-set-up';

export interface ElementarySetupStatusResponse {
  status: ElementarySetupStatus;
}

export interface ElementarySchedule {
  cron: string;
}

// Backend returns { report_exists: false } when no EDR run has produced a
// report in S3 within the lookback window (expected empty state on a
// freshly-set-up org), and { report_exists: true, token, created_on_utc,
// schedule } when a report is available. `schedule` is present on both
// responses (may be null if the EDR deployment isn't set up yet).
export type ElementaryReportTokenResponse =
  | { report_exists: false; schedule: ElementarySchedule | null }
  | {
      report_exists: true;
      token: string;
      created_on_utc: string;
      created_on_ist?: string;
      schedule: ElementarySchedule | null;
    };

export interface ElementaryRefreshResponse {
  flow_run_id: string;
}

export interface ElementaryStatus {
  exists: {
    elementary_package?: string | Record<string, unknown>;
    elementary_target_schema?: string | Record<string, unknown>;
  };
  missing: {
    elementary_package?: string | Record<string, unknown>;
    elementary_target_schema?: string | Record<string, unknown>;
  };
}

// Response from POST /api/dbt/elementary/check
export type ElementaryCheckResponse =
  | { status: 'ready' }
  | ({ status: 'needs_repo_changes' } & ElementaryStatus);

// Response from POST /api/dbt/elementary/install — celery task handle
export interface ElementaryInstallResponse {
  task_id: string;
  hashkey: string;
}

// Sub-step status emitted by the install_elementary celery task
export type InstallStepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface InstallStepProgress {
  stepIndex: number;
  step: string;
  status: InstallStepStatus;
  message?: string;
}

export interface TaskProgressResponse {
  progress: Array<{
    status: string;
    message?: string;
    stepIndex?: number;
    step?: string;
  }>;
}

export type ElementaryLockResponse = {
  is_locked: boolean;
  status: string;
  task_slug: string;
  flowRunId: string;
  lockedBy: string;
  lockedAt: string;
} | null;
