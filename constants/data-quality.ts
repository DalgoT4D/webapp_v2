// Interval between polls when checking async task completion (e.g., tracking table creation).
// 3s balances responsiveness with avoiding excessive API calls during long-running dbt operations.
export const TASK_POLL_INTERVAL_MS = 3000;

// Interval between polls when checking if the Prefect report-generation lock has been released.
// 5s is sufficient since Elementary report generation typically takes minutes, not seconds.
export const LOCK_POLL_INTERVAL_MS = 5000;

// Maps backend config keys to the dbt file names users need to edit.
// Shown in the MappingComponent during Elementary setup when config is missing.
export const KEY_TO_FILENAME: Record<string, string> = {
  elementary_package: 'packages.yml',
  elementary_target_schema: 'dbt_project.yml',
};
