export type ElementarySetupStatus = 'set-up' | 'not-set-up';

export interface ElementarySetupStatusResponse {
  status: ElementarySetupStatus;
}

export interface ElementaryReportTokenResponse {
  token: string;
  created_on_utc: string;
}

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

export interface TaskProgressResponse {
  progress: Array<{
    status: string;
    message: string;
  }>;
}

export interface CreateTrackingTablesResponse {
  task_id: string;
  hashkey: string;
}
