/**
 * MSW Handlers for Pipeline/Orchestrate API
 *
 * These handlers intercept API calls and return mock data.
 * Used for integration tests where we want real hooks to run
 * but fake server responses.
 */

import { http, HttpResponse } from 'msw';
import { Pipeline, TransformTask, Connection, PipelineDetailResponse } from '@/types/pipeline';

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

// ============ MSW Handlers ============

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002';

export const pipelineHandlers = [
  // GET /api/prefect/v1/flows/ - List all pipelines
  http.get(`${BASE_URL}/api/prefect/v1/flows/`, () => {
    return HttpResponse.json(mockPipelines);
  }),

  // GET /api/prefect/v1/flows/:deploymentId - Get single pipeline
  http.get(`${BASE_URL}/api/prefect/v1/flows/:deploymentId`, ({ params }) => {
    const { deploymentId } = params;
    const pipeline = mockPipelines.find((p) => p.deploymentId === deploymentId);

    if (!pipeline) {
      return new HttpResponse(null, { status: 404 });
    }

    const detailResponse: PipelineDetailResponse = {
      name: pipeline.name,
      cron: pipeline.cron,
      isScheduleActive: pipeline.status,
      connections: [{ id: 'conn-1', name: 'Postgres Source', seq: 1 }],
      transformTasks: [
        { uuid: 'task-1', seq: 1 },
        { uuid: 'task-2', seq: 2 },
      ],
    };

    return HttpResponse.json(detailResponse);
  }),

  // POST /api/prefect/v1/flows/ - Create pipeline
  http.post(`${BASE_URL}/api/prefect/v1/flows/`, async ({ request }) => {
    const body = (await request.json()) as { name: string };
    return HttpResponse.json({ name: body.name }, { status: 201 });
  }),

  // PUT /api/prefect/v1/flows/:deploymentId - Update pipeline
  http.put(`${BASE_URL}/api/prefect/v1/flows/:deploymentId`, () => {
    return HttpResponse.json({ success: true });
  }),

  // DELETE /api/prefect/v1/flows/:deploymentId - Delete pipeline
  http.delete(`${BASE_URL}/api/prefect/v1/flows/:deploymentId`, () => {
    return HttpResponse.json({ success: true });
  }),

  // POST /api/prefect/v1/flows/:deploymentId/flow_run/ - Trigger run
  http.post(`${BASE_URL}/api/prefect/v1/flows/:deploymentId/flow_run/`, () => {
    return HttpResponse.json({ success: true });
  }),

  // GET /api/prefect/tasks/transform/ - List transform tasks
  http.get(`${BASE_URL}/api/prefect/tasks/transform/`, () => {
    return HttpResponse.json(mockTasks);
  }),

  // GET /api/airbyte/v1/connections - List connections
  http.get(`${BASE_URL}/api/airbyte/v1/connections`, () => {
    return HttpResponse.json(mockConnections);
  }),

  // GET /api/prefect/v1/flows/:deploymentId/flow_runs/history - Run history
  http.get(`${BASE_URL}/api/prefect/v1/flows/:deploymentId/flow_runs/history`, () => {
    return HttpResponse.json([
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
    ]);
  }),
];
