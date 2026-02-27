// Pipeline/Orchestrate types

import { LockStatus } from '@/constants/pipeline';

export interface TaskLock {
  lockedBy: string;
  lockedAt: string;
  status: LockStatus;
  flowRunId?: string;
  celeryTaskId?: string;
}

export interface QueuedRuntimeInfo {
  max_wait_time: number;
  min_wait_time: number;
  queue_no: number;
}

export interface FlowRun {
  id: string;
  name: string;
  status: string;
  state_name: string;
  startTime: string;
  expectedStartTime: string;
  orguser: string | null;
}

export interface Pipeline {
  name: string;
  cron: string | null;
  deploymentName: string;
  deploymentId: string;
  lastRun: FlowRun | null;
  lock: TaskLock | null | undefined;
  status: boolean;
  queuedFlowRunWaitTime: QueuedRuntimeInfo | null;
}

export interface TransformTask {
  label: string;
  slug: string;
  deploymentId: string | null;
  lock: TaskLock | null;
  command: string | null;
  generated_by: 'system' | 'client';
  uuid: string;
  seq: number;
  pipeline_default: boolean;
  order?: number;
}

export interface LogEntry {
  level: number;
  message: string;
  timestamp: string;
}

export interface TaskRun {
  end_time: string;
  id: string;
  kind: string;
  label: string;
  logs: LogEntry[];
  start_time: string;
  state_name: string;
  state_type: string;
  total_run_time: number;
  estimated_run_time: number;
  parameters: {
    connection_name?: string;
    [key: string]: any;
  } | null;
}

export interface DeploymentRun {
  deployment_id: string;
  expectedStartTime: string;
  id: string;
  orguser: string | null;
  runs: TaskRun[];
  name: string;
  startTime: string;
  state_name: string;
  status: string;
  totalRunTime: number;
}

export interface Connection {
  name: string;
  connectionId: string;
  deploymentId: string;
  catalogId: string;
  destination: {
    destinationId: string;
    destinationName: string;
  };
  source: {
    sourceId: string;
    sourceName: string;
    icon?: string;
  };
  lock: TaskLock | null;
  lastRun: any | null;
  normalize: boolean;
  status: string;
  syncCatalog: object;
  resetConnDeploymentId: string | null;
  clearConnDeploymentId: string | null;
  queuedFlowRunWaitTime: QueuedRuntimeInfo | null;
  blockId: string;
}

// Form types
export interface ScheduleOption {
  id: string;
  label: string;
}

export interface WeekdayOption {
  id: string;
  label: string;
}

export interface ConnectionOption {
  id: string;
  label: string;
}

export interface PipelineFormData {
  active: boolean;
  name: string;
  tasks: TransformTask[];
  connections: ConnectionOption[];
  cron: ScheduleOption | null;
  cronDaysOfWeek: WeekdayOption[];
  cronTimeOfDay: string;
}

// API response types
export interface PipelineDetailResponse {
  name: string;
  cron: string | null;
  isScheduleActive: boolean;
  connections: Array<{
    id: string;
    name: string;
    seq: number;
  }>;
  transformTasks: Array<{
    uuid: string;
    seq: number;
  }>;
}

export interface LogSummaryResult {
  prompt: string;
  response: string;
}

export interface TaskProgressResponse {
  progress: Array<{
    status: string;
    result?: LogSummaryResult[];
  }>;
}

// Dashboard API types (for /pipeline overview page)
export interface DashboardRun {
  id: string;
  name: string;
  status: string;
  state_name: string;
  startTime: string;
  totalRunTime: number;
}

export interface DashboardPipeline {
  id: string;
  deploymentName: string;
  name: string;
  status: string;
  lock: boolean;
  runs: DashboardRun[];
  lastRun?: { startTime: string };
}
// Pipeline/Orchestrate types

export interface TaskLock {
  lockedBy: string;
  lockedAt: string;
  status: 'queued' | 'running' | 'locked' | 'complete' | 'cancelled';
  flowRunId?: string;
  celeryTaskId?: string;
}

export interface QueuedRuntimeInfo {
  max_wait_time: number;
  min_wait_time: number;
  queue_no: number;
}

export interface FlowRun {
  id: string;
  name: string;
  status: string;
  state_name: string;
  startTime: string;
  expectedStartTime: string;
  orguser: string | null;
}

export interface Pipeline {
  name: string;
  cron: string | null;
  deploymentName: string;
  deploymentId: string;
  lastRun: FlowRun | null;
  lock: TaskLock | null | undefined;
  status: boolean;
  queuedFlowRunWaitTime: QueuedRuntimeInfo | null;
}

export interface TransformTask {
  label: string;
  slug: string;
  deploymentId: string | null;
  lock: TaskLock | null;
  command: string | null;
  generated_by: 'system' | 'client';
  uuid: string;
  seq: number;
  pipeline_default: boolean;
  order?: number;
}

export interface LogEntry {
  level: number;
  message: string;
  timestamp: string;
}

export interface TaskRun {
  end_time: string;
  id: string;
  kind: string;
  label: string;
  logs: LogEntry[];
  start_time: string;
  state_name: string;
  state_type: string;
  total_run_time: number;
  estimated_run_time: number;
  parameters: {
    connection_name?: string;
    [key: string]: any;
  } | null;
}

export interface DeploymentRun {
  deployment_id: string;
  expectedStartTime: string;
  id: string;
  orguser: string | null;
  runs: TaskRun[];
  name: string;
  startTime: string;
  state_name: string;
  status: string;
  totalRunTime: number;
}

export interface Connection {
  name: string;
  connectionId: string;
  deploymentId: string;
  catalogId: string;
  destination: {
    destinationId: string;
    destinationName: string;
  };
  source: {
    sourceId: string;
    sourceName: string;
    icon?: string;
  };
  lock: TaskLock | null;
  lastRun: any | null;
  normalize: boolean;
  status: string;
  syncCatalog: object;
  resetConnDeploymentId: string | null;
  clearConnDeploymentId: string | null;
  queuedFlowRunWaitTime: QueuedRuntimeInfo | null;
  blockId: string;
}

// Form types
export interface ScheduleOption {
  id: string;
  label: string;
}

export interface WeekdayOption {
  id: string;
  label: string;
}

export interface ConnectionOption {
  id: string;
  label: string;
}

export interface PipelineFormData {
  active: boolean;
  name: string;
  tasks: TransformTask[];
  connections: ConnectionOption[];
  cron: ScheduleOption | null;
  cronDaysOfWeek: WeekdayOption[];
  cronTimeOfDay: string;
}

// API response types
export interface PipelineDetailResponse {
  name: string;
  cron: string | null;
  isScheduleActive: boolean;
  connections: Array<{
    id: string;
    name: string;
    seq: number;
  }>;
  transformTasks: Array<{
    uuid: string;
    seq: number;
  }>;
}

export interface LogSummaryResult {
  prompt: string;
  response: string;
}

export interface TaskProgressResponse {
  progress: Array<{
    status: string;
    result?: LogSummaryResult[];
  }>;
}
