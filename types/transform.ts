// types/transform.ts

// ============================================
// WORKSPACE & SETUP
// ============================================

export type TransformType = 'github' | 'ui' | 'none' | 'dbtcloud' | null;

export interface TransformTypeResponse {
  transform_type: TransformType;
}

export interface DbtWorkspace {
  gitrepo_url: string | null;
  default_schema: string;
  target_type?: string;
  transform_type?: TransformType;
}

export interface DbtWorkspaceFormData {
  gitrepoUrl: string;
  gitrepoAccessToken: string;
  defaultSchema: string;
}

// ============================================
// TASKS
// ============================================

export interface TransformTask {
  uuid: string;
  label: string;
  slug: string;
  type: string;
  command: string;
  generated_by: 'system' | 'client';
  deploymentId: string;
  deploymentName: string;
  cron?: string | null;
  lock?: {
    status: string;
    flowRunId: string;
    celeryTaskId: string;
    lockedBy: string;
    lockedAt: string;
  } | null;
  lastRun?: {
    startTime: string;
    endTime?: string;
    status: string;
  } | null;
}

export interface TaskProgress {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'error';
  message: string;
  timestamp: string;
  results?: unknown;
}

export interface PrefectFlowRun {
  id: string;
  name: string;
  deployment_id: string;
  flow_id: string;
  state_type: string;
  state_name: string;
}

export interface PrefectFlowRunLog {
  level: number;
  timestamp: string;
  message: string;
}

// ============================================
// SOURCES & MODELS
// ============================================

export interface DbtModelResponse {
  id: string;
  name: string;
  schema: string;
  type: 'source' | 'model';
  display_name: string;
  source_name: string;
  sql_path: string;
  output_cols: string[];
  uuid: string;
}
