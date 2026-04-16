// constants/dbt-tasks.ts

// DBT task slug constants (matching backend slugs)
export const TASK_DBTRUN = 'dbt-run';
export const TASK_DBTTEST = 'dbt-test';
export const TASK_DBTCLEAN = 'dbt-clean';
export const TASK_DBTDEPS = 'dbt-deps';
export const TASK_GITPULL = 'git-pull';
export const TASK_DOCSGENERATE = 'dbt-docs-generate';
export const TASK_DBTCLOUD_JOB = 'dbt-cloud-job';

// Log pagination page size (matching v1's flowRunLogsOffsetLimit)
export const FLOW_RUN_LOGS_OFFSET_LIMIT = 200;
