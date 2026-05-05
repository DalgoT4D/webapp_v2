// Pipeline/Orchestrate constants

// Lock status - pipeline lock lifecycle from the backend
export enum LockStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  LOCKED = 'locked',
  COMPLETE = 'complete',
  CANCELLED = 'cancelled',
}

// Prefect flow run status (state_type) - uppercase values from the API
export enum FlowRunStatus {
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CRASHED = 'CRASHED',
}

// Prefect flow run state name
export enum FlowRunStateName {
  DBT_TEST_FAILED = 'DBT_TEST_FAILED',
}

// UI display status - derived in getRunStatus() for the pipeline list StatusBadge
export enum PipelineRunDisplayStatus {
  RUNNING = 'running',
  QUEUED = 'queued',
  LOCKED = 'locked',
  SUCCESS = 'success',
  FAILED = 'failed',
  WARNING = 'warning', //dbt failure
}

// Celery task progress status - used for polling async tasks across explore, transform, and orchestrate
export enum TaskProgressStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ERROR = 'error',
}

export const DEFAULT_LOAD_MORE_LIMIT = 3;
export const FLOW_RUN_LOGS_OFFSET_LIMIT = 200;

// Date cutoff for showing "By: username" in run history
// We started recording manual triggering of flow-runs on 2025-05-20
export const FLOW_RUN_STARTED_BY_DATE_CUTOFF = '2025-05-20T00:00:00.0+00:00';

// System task slugs
export const TASK_DBTRUN = 'dbt-run';
export const TASK_DBTTEST = 'dbt-test';
export const TASK_DBTCLEAN = 'dbt-clean';
export const TASK_DBTDEPS = 'dbt-deps';
export const TASK_DBTSEED = 'dbt-seed';
export const TASK_GITPULL = 'git-pull';
export const TASK_DOCSGENERATE = 'dbt-docs-generate';
export const TASK_DBTCLOUD_JOB = 'dbt-cloud-job';

// System command ordering - matches backend TRANSFORM_TASKS_SEQ
export const SYSTEM_COMMAND_ORDER: Record<string, number> = {
  'git-pull': 1,
  'dbt-clean': 2,
  'dbt-deps': 3,
  'dbt-seed': 4,
  'dbt-run': 5,
  'dbt-test': 6,
  'dbt-docs-generate': 8,
  'dbt-cloud-job': 20,
};

// Custom command ordering - custom tasks sit between system dbt-run (5) and system dbt-test (6)
export const CUSTOM_COMMAND_ORDER: Record<string, number> = {
  'dbt-run': 5,
  'dbt-test': 6,
};

// Custom commands default to order 5 if not specified
export const CUSTOM_COMMAND_DEFAULT_ORDER = 5;

// Task order constraints for drag-drop
export const DBT_RUN_MIN_ORDER = 5;
export const DBT_TEST_MIN_ORDER = 6;

// Weekdays for schedule selection
export const WEEKDAYS: Record<string, string> = {
  '0': 'Sunday',
  '1': 'Monday',
  '2': 'Tuesday',
  '3': 'Wednesday',
  '4': 'Thursday',
  '5': 'Friday',
  '6': 'Saturday',
};

// Schedule options
export const SCHEDULE_OPTIONS = [
  { id: 'manual', label: 'Manual' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
] as const;

// Polling intervals
export const POLLING_INTERVAL_WHEN_LOCKED = 3000; // 3 seconds when pipeline is running
export const POLLING_INTERVAL_IDLE = 0; // No polling when idle

// Task readable names mapping
export const TASK_READABLE_NAMES: Record<string, string> = {
  'shellop-git-pull': 'Git pull',
  'dbtjob-dbt-clean': 'DBT clean',
  'dbtjob-dbt-deps': 'DBT deps',
  'dbtjob-dbt-run': 'DBT run',
  'dbtjob-dbt-test': 'DBT test',
};

// AI summary feature flag
export const ENABLE_LOG_SUMMARIES = process.env.NEXT_PUBLIC_ENABLE_LOG_SUMMARIES === 'true';

// Hex codes used here because these colors have no CSS variable equivalents
// and are passed to ECharts / SVG icons which cannot consume CSS variables
export const STATUS_COLOR_RUNNING = '#DAA520';
export const STATUS_COLOR_FAILED_DARK = '#981F1F'; // darker red for warning icon

// Tooltip button colors (used in ECharts custom tooltip)
export const TOOLTIP_BUTTON_BG = '#5C7080';
export const TOOLTIP_BUTTON_HOVER = '#4a5d69';

// Chart baseline color (ECharts)
export const CHART_BASELINE_COLOR = '#758397';
