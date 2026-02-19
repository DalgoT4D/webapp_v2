/**
 * Mock Data Factories for Pipeline/Orchestrate Tests
 *
 * Extracted from MSW handlers for use with Jest mocks.
 */

import type { Pipeline, TransformTask, Connection, PipelineDetailResponse } from '@/types/pipeline';

// ============ Mock Data Factories ============

export const createMockPipeline = (overrides: Partial<Pipeline> = {}): Pipeline => ({
  name: 'Test Pipeline',
  cron: '0 9 * * *',
  deploymentName: 'test-deployment',
  deploymentId: 'test-dep-123',
  lastRun: null,
  lock: null,
  status: true,
  queuedFlowRunWaitTime: null,
  ...overrides,
});

export const createMockTask = (overrides: Partial<TransformTask> = {}): TransformTask => ({
  label: 'Git Pull',
  slug: 'git-pull',
  deploymentId: null,
  lock: null,
  command: 'git pull',
  generated_by: 'system',
  uuid: 'task-uuid-1',
  seq: 1,
  pipeline_default: true,
  order: 1,
  ...overrides,
});

export const createMockConnection = (overrides: Partial<Connection> = {}): Connection => ({
  name: 'Test Connection',
  connectionId: 'conn-123',
  deploymentId: 'dep-123',
  catalogId: 'cat-123',
  destination: { destinationId: 'dest-1', destinationName: 'Warehouse' },
  source: { sourceId: 'src-1', sourceName: 'Database' },
  lock: null,
  lastRun: null,
  normalize: false,
  status: 'active',
  syncCatalog: {},
  resetConnDeploymentId: null,
  clearConnDeploymentId: null,
  queuedFlowRunWaitTime: null,
  blockId: 'block-1',
  ...overrides,
});

// ============ Default Mock Data ============

export const mockPipelines: Pipeline[] = [
  createMockPipeline({ name: 'Daily Sync', deploymentId: 'dep-1' }),
  createMockPipeline({
    name: 'Weekly Report',
    deploymentId: 'dep-2',
    cron: '0 9 * * 1',
    status: false,
  }),
  createMockPipeline({
    name: 'Running Pipeline',
    deploymentId: 'dep-3',
    lock: { lockedBy: 'user@test.com', lockedAt: new Date().toISOString(), status: 'running' },
  }),
];

export const mockTasks: TransformTask[] = [
  createMockTask({ uuid: 'task-1', slug: 'git-pull', command: 'git pull', order: 1 }),
  createMockTask({ uuid: 'task-2', slug: 'dbt-run', command: 'dbt run', order: 5 }),
  createMockTask({ uuid: 'task-3', slug: 'dbt-test', command: 'dbt test', order: 6 }),
];

export const mockConnections: Connection[] = [
  createMockConnection({ connectionId: 'conn-1', name: 'Postgres Source' }),
  createMockConnection({ connectionId: 'conn-2', name: 'Salesforce Source' }),
];

export const mockPipelineDetail: PipelineDetailResponse = {
  name: 'Pipeline Detail',
  cron: '0 9 * * *',
  isScheduleActive: true,
  connections: [{ id: 'conn-1', name: 'Postgres Source', seq: 1 }],
  transformTasks: [
    { uuid: 'task-1', seq: 1 },
    { uuid: 'task-2', seq: 2 },
  ],
};

export const mockRunHistory = [
  {
    id: 'run-1',
    name: 'Daily Sync Run',
    status: 'COMPLETED',
    state_name: 'Completed',
    startTime: '2025-05-21T10:00:00Z',
    expectedStartTime: '2025-05-21T10:00:00Z',
    orguser: 'user@test.com',
  },
  {
    id: 'run-2',
    name: 'Daily Sync Run',
    status: 'FAILED',
    state_name: 'Failed',
    startTime: '2025-05-20T10:00:00Z',
    expectedStartTime: '2025-05-20T10:00:00Z',
    orguser: 'System',
  },
];

export const mockLogs = {
  logs: {
    logs: [
      { message: 'Starting pipeline run...' },
      { message: 'Task 1 completed successfully' },
      { message: 'Pipeline run finished' },
    ],
  },
};

// ============ Pipeline Factory for Shared Connection Tests ============

/**
 * Create pipelines that share a connection for locking tests
 * When one pipeline runs, all pipelines sharing a connection should be locked
 */
export const createPipelinesWithSharedConnection = (sharedConnectionId: string) => {
  const sharedLock = {
    lockedBy: 'user@test.com',
    lockedAt: new Date().toISOString(),
    status: 'running' as const,
  };

  return {
    runningPipeline: createMockPipeline({
      name: 'Running Pipeline',
      deploymentId: 'running-dep',
      lock: sharedLock,
    }),
    lockedPipeline1: createMockPipeline({
      name: 'Locked Pipeline 1',
      deploymentId: 'locked-dep-1',
      lock: { ...sharedLock, status: 'locked' as const },
    }),
    lockedPipeline2: createMockPipeline({
      name: 'Locked Pipeline 2',
      deploymentId: 'locked-dep-2',
      lock: { ...sharedLock, status: 'locked' as const },
    }),
  };
};
