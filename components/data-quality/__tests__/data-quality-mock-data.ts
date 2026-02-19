import {
  ElementarySetupStatusResponse,
  ElementaryReportTokenResponse,
  ElementaryStatus,
  ElementaryRefreshResponse,
  CreateTrackingTablesResponse,
  TaskProgressResponse,
} from '../types';

export function createMockSetupStatusResponse(
  status: 'set-up' | 'not-set-up' = 'set-up'
): ElementarySetupStatusResponse {
  return { status };
}

export function createMockReportTokenResponse(
  overrides?: Partial<ElementaryReportTokenResponse>
): ElementaryReportTokenResponse {
  return {
    token: 'mock-elementary-token-123',
    created_on_utc: '2026-02-20T10:00:00Z',
    ...overrides,
  };
}

export function createMockElementaryStatus(
  overrides?: Partial<ElementaryStatus>
): ElementaryStatus {
  return {
    exists: {},
    missing: {},
    ...overrides,
  };
}

export function createMockRefreshResponse(): ElementaryRefreshResponse {
  return { flow_run_id: 'mock-flow-run-id' };
}

export function createMockTrackingTablesResponse(): CreateTrackingTablesResponse {
  return { task_id: 'mock-task-id', hashkey: 'mock-hashkey' };
}

export function createMockTaskProgressResponse(
  status: string = 'completed',
  message: string = 'Done'
): TaskProgressResponse {
  return {
    progress: [{ status, message }],
  };
}
