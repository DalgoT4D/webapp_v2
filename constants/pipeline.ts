// Pipeline/Orchestrate constants

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
export const TASK_GITPULL = 'git-pull';
export const TASK_DOCSGENERATE = 'dbt-docs-generate';
export const TASK_DBTCLOUD_JOB = 'dbt-cloud-job';

// System command ordering - these define the execution order
export const SYSTEM_COMMAND_ORDER: Record<string, number> = {
  'git-pull': 1,
  'dbt-clean': 2,
  'dbt-deps': 3,
  'dbt-run': 5,
  'dbt-test': 6,
  'dbt-docs-generate': 7,
  'dbt-cloud-job': 8,
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
