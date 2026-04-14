export enum SyncMode {
  FULL_REFRESH = 'full_refresh',
  INCREMENTAL = 'incremental',
}

export enum DestinationSyncMode {
  APPEND = 'append',
  OVERWRITE = 'overwrite',
  APPEND_DEDUP = 'append_dedup',
}

export enum SyncStatus {
  // Airbyte job API returns 'succeeded' (past tense), not 'success'
  SUCCESS = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RUNNING = 'running',
  QUEUED = 'queued',
  LOCKED = 'locked',
}

// Uppercase status strings returned by Prefect flow run API
export enum FlowRunStatus {
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

// Form modes for connection create/edit/view dialogs
export enum FormMode {
  CREATE = 'create',
  EDIT = 'edit',
  VIEW = 'view',
}

// Schema catalog-level transform types (stream added/removed/updated)
export enum CatalogTransformType {
  ADD_STREAM = 'add_stream',
  REMOVE_STREAM = 'remove_stream',
  UPDATE_STREAM = 'update_stream',
}

// Field-level transform types within an updated stream
export enum FieldTransformType {
  ADD_FIELD = 'add_field',
  REMOVE_FIELD = 'remove_field',
  UPDATE_FIELD_SCHEMA = 'update_field_schema',
}

// Airbyte sync job types
export enum JobType {
  SYNC = 'sync',
  RESET_CONNECTION = 'reset_connection',
}

// Celery/Prefect task polling status (lowercase, used in task progress API)
export enum TaskStatus {
  COMPLETED = 'completed',
  FAILED = 'failed',
  RUNNING = 'running',
}

// Schema change severity
export const SCHEMA_CHANGE_BREAKING = 'breaking' as const;

export const CONNECTION_PERMISSIONS = {
  CREATE: 'can_create_connection',
  EDIT: 'can_edit_connection',
  DELETE: 'can_delete_connection',
  RESET: 'can_reset_connection',
  SYNC: 'can_sync_sources',
} as const;

// Sync history pagination size
export const SYNC_HISTORY_PAGE_SIZE = 20;

// Polling intervals in milliseconds
export const FLOW_RUN_POLL_INTERVAL_MS = 5000;
export const TASK_PROGRESS_POLL_INTERVAL_MS = 3000;

// Polling interval for log summary task progress in milliseconds
export const LOG_SUMMARY_POLL_INTERVAL_MS = 3000;

// Hex codes for SVG icon fills — SVG `fill` cannot consume CSS variables
export const ICON_COLOR_DEFAULT = '#369B44'; // matches source list connection icon
export const ICON_COLOR_FAILED = '#b91c1c'; // Tailwind red-700

// Centralized status → display config for sync jobs and lock states
export const SYNC_STATUS_CONFIG: Record<string, { label: string; colorClass: string }> = {
  [SyncStatus.SUCCESS]: { label: 'Success', colorClass: 'text-green-700' },
  [SyncStatus.FAILED]: { label: 'Failed', colorClass: 'text-red-700' },
  [SyncStatus.CANCELLED]: { label: 'Cancelled', colorClass: 'text-amber-600' },
  [SyncStatus.RUNNING]: { label: 'Running', colorClass: 'text-green-600' },
  [SyncStatus.QUEUED]: { label: 'Queued', colorClass: 'text-gray-600' },
  [SyncStatus.LOCKED]: { label: 'Locked', colorClass: 'text-gray-600' },
};

// Fallback for unrecognized statuses
export const SYNC_STATUS_DEFAULT = { label: 'Unknown', colorClass: 'text-gray-500' };

export const CONNECTION_API = {
  CONNECTIONS: '/api/airbyte/v1/connections',
  SCHEMA_CHANGES: '/api/airbyte/v1/connection/schema_change',
} as const;
