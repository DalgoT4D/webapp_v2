/**
 * Playwright API Mock Handlers for Pipeline Tests
 *
 * Shared mock data and route interception helpers for E2E tests.
 * Use these to test UI interactions without hitting the backend.
 *
 * Uses actual types from the codebase where possible.
 * If real types change, TypeScript will catch mismatches here.
 */

import { Page } from '@playwright/test';

// Import actual types from codebase - if these change, tests will catch it
import type {
  Pipeline,
  TransformTask,
  Connection,
  DeploymentRun,
  PipelineDetailResponse,
} from '../../../types/pipeline';

// ============ Test-Specific Types ============
// These are only for mock data that doesn't match existing types

interface MockOrgUser {
  email: string;
  org: {
    slug: string;
    name: string;
    viz_url: string;
  };
  active: boolean;
  new_role_slug: string;
  permissions: { slug: string; name: string }[];
  landing_dashboard_id: string | null;
  org_default_dashboard_id: string | null;
}

// ============ Mock Data ============

export const mockTasks: TransformTask[] = [
  {
    label: 'Git Pull',
    slug: 'git-pull',
    deploymentId: null,
    lock: null,
    command: 'git pull',
    generated_by: 'system',
    uuid: 'task-1',
    seq: 1,
    pipeline_default: true,
    order: 1,
  },
  {
    label: 'DBT Run',
    slug: 'dbt-run',
    deploymentId: null,
    lock: null,
    command: 'dbt run',
    generated_by: 'system',
    uuid: 'task-2',
    seq: 2,
    pipeline_default: true,
    order: 5,
  },
  {
    label: 'DBT Test',
    slug: 'dbt-test',
    deploymentId: null,
    lock: null,
    command: 'dbt test',
    generated_by: 'system',
    uuid: 'task-3',
    seq: 3,
    pipeline_default: true,
    order: 6,
  },
  {
    label: 'Custom Task',
    slug: 'custom-task',
    deploymentId: null,
    lock: null,
    command: 'custom command',
    generated_by: 'client',
    uuid: 'task-4',
    seq: 4,
    pipeline_default: false,
    order: 10,
  },
];

export const mockConnections: Connection[] = [
  {
    name: 'Postgres Source',
    connectionId: 'conn-1',
    deploymentId: 'dep-conn-1',
    catalogId: 'cat-1',
    destination: { destinationId: 'dest-1', destinationName: 'Warehouse' },
    source: { sourceId: 'src-1', sourceName: 'Postgres' },
    lock: null,
    lastRun: null,
    normalize: false,
    status: 'active',
    syncCatalog: {},
    resetConnDeploymentId: null,
    clearConnDeploymentId: null,
    queuedFlowRunWaitTime: null,
    blockId: 'block-1',
  },
  {
    name: 'Salesforce Source',
    connectionId: 'conn-2',
    deploymentId: 'dep-conn-2',
    catalogId: 'cat-2',
    destination: { destinationId: 'dest-2', destinationName: 'Data Lake' },
    source: { sourceId: 'src-2', sourceName: 'Salesforce' },
    lock: null,
    lastRun: null,
    normalize: false,
    status: 'active',
    syncCatalog: {},
    resetConnDeploymentId: null,
    clearConnDeploymentId: null,
    queuedFlowRunWaitTime: null,
    blockId: 'block-2',
  },
  {
    name: 'Stripe Source',
    connectionId: 'conn-3',
    deploymentId: 'dep-conn-3',
    catalogId: 'cat-3',
    destination: { destinationId: 'dest-3', destinationName: 'Analytics' },
    source: { sourceId: 'src-3', sourceName: 'Stripe' },
    lock: null,
    lastRun: null,
    normalize: false,
    status: 'active',
    syncCatalog: {},
    resetConnDeploymentId: null,
    clearConnDeploymentId: null,
    queuedFlowRunWaitTime: null,
    blockId: 'block-3',
  },
];

export const mockPipelines: Pipeline[] = [
  {
    name: 'Daily Sync',
    cron: '0 9 * * *',
    deploymentName: 'daily-sync-deployment',
    deploymentId: 'dep-1',
    lastRun: {
      id: 'run-1',
      name: 'Daily Sync Run',
      status: 'COMPLETED',
      state_name: 'Completed',
      startTime: '2025-05-21T10:00:00Z',
      expectedStartTime: '2025-05-21T09:00:00Z',
      orguser: 'user@test.com',
    },
    lock: null,
    status: true,
    queuedFlowRunWaitTime: null,
  },
  {
    name: 'Weekly Report',
    cron: '0 9 * * 1',
    deploymentName: 'weekly-report-deployment',
    deploymentId: 'dep-2',
    lastRun: null,
    lock: null,
    status: false,
    queuedFlowRunWaitTime: null,
  },
  {
    name: 'Manual Pipeline',
    cron: null,
    deploymentName: 'manual-pipeline-deployment',
    deploymentId: 'dep-3',
    lastRun: {
      id: 'run-3',
      name: 'Manual Run',
      status: 'FAILED',
      state_name: 'Failed',
      startTime: '2025-05-20T14:00:00Z',
      expectedStartTime: '',
      orguser: 'System',
    },
    lock: null,
    status: true,
    queuedFlowRunWaitTime: null,
  },
  {
    name: 'Running Pipeline',
    cron: '0 8 * * *',
    deploymentName: 'running-pipeline-deployment',
    deploymentId: 'dep-4',
    lastRun: null,
    lock: {
      lockedBy: 'user@test.com',
      lockedAt: new Date().toISOString(),
      status: 'running',
    },
    status: true,
    queuedFlowRunWaitTime: null,
  },
];

export const mockPipelineDetail = {
  name: 'Daily Sync',
  cron: '0 9 * * *',
  isScheduleActive: true,
  connections: [{ id: 'conn-1', name: 'Postgres Source', seq: 1 }],
  transformTasks: [
    { uuid: 'task-1', seq: 1 },
    { uuid: 'task-2', seq: 2 },
    { uuid: 'task-3', seq: 3 },
  ],
};

export const mockRunHistory: DeploymentRun[] = [
  {
    id: 'run-1',
    deployment_id: 'dep-1',
    name: 'Pipeline Run 1',
    status: 'COMPLETED',
    state_name: 'Completed',
    startTime: '2025-05-21T10:00:00Z',
    expectedStartTime: '2025-05-21T10:00:00Z',
    orguser: 'user@test.com',
    totalRunTime: 120,
    runs: [
      {
        id: 'task-run-1',
        label: 'dbtjob-dbt-run',
        kind: 'task-run',
        start_time: '2025-05-21T10:00:00Z',
        end_time: '2025-05-21T10:01:00Z',
        state_type: 'COMPLETED',
        state_name: 'Completed',
        total_run_time: 60,
        estimated_run_time: 60,
        logs: [],
        parameters: { connection_name: 'Postgres' },
      },
    ],
  },
  {
    id: 'run-2',
    deployment_id: 'dep-1',
    name: 'Pipeline Run 2',
    status: 'FAILED',
    state_name: 'Failed',
    startTime: '2025-05-20T10:00:00Z',
    expectedStartTime: '2025-05-20T10:00:00Z',
    orguser: 'System',
    totalRunTime: 45,
    runs: [
      {
        id: 'task-run-2',
        label: 'dbtjob-dbt-test',
        kind: 'task-run',
        start_time: '2025-05-20T10:00:00Z',
        end_time: '2025-05-20T10:00:45Z',
        state_type: 'FAILED',
        state_name: 'Failed',
        total_run_time: 45,
        estimated_run_time: 60,
        logs: [],
        parameters: null,
      },
    ],
  },
  {
    id: 'run-3',
    deployment_id: 'dep-1',
    name: 'Pipeline Run 3',
    status: 'COMPLETED',
    state_name: 'Completed',
    startTime: '2025-05-19T10:00:00Z',
    expectedStartTime: '2025-05-19T10:00:00Z',
    orguser: 'user@test.com',
    totalRunTime: 90,
    runs: [],
  },
];

export const mockLogs = {
  logs: {
    logs: [
      { message: 'Starting pipeline run...' },
      { message: 'Executing task: dbt run' },
      { message: 'Task completed successfully' },
      { message: 'Pipeline run finished' },
    ],
  },
};

export const mockPermissions = [
  { slug: 'can_view_pipeline', name: 'Can View Pipeline' },
  { slug: 'can_create_pipeline', name: 'Can Create Pipeline' },
  { slug: 'can_edit_pipeline', name: 'Can Edit Pipeline' },
  { slug: 'can_delete_pipeline', name: 'Can Delete Pipeline' },
  { slug: 'can_run_pipeline', name: 'Can Run Pipeline' },
];

// Mock org users response - this is what /api/currentuserv2 returns
export const mockOrgUsers: MockOrgUser[] = [
  {
    email: 'test@dalgo.in',
    org: {
      slug: 'test-org',
      name: 'Test Organization',
      viz_url: 'http://localhost:3000',
    },
    active: true,
    new_role_slug: 'account_manager',
    permissions: mockPermissions,
    landing_dashboard_id: null,
    org_default_dashboard_id: null,
  },
];

// ============ Route Setup Helpers ============

/**
 * Setup all pipeline-related API mocks
 * Uses wildcard patterns to match both localhost and production URLs
 */
export async function setupPipelineMocks(page: Page) {
  // Mock authentication - token refresh endpoint (to prevent 401 failures)
  await page.route('**/api/v2/token/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      json: { success: true },
      headers: {
        'Set-Cookie': 'access_token=mock-token; Path=/; HttpOnly',
      },
    });
  });

  // Mock current user endpoint - this is called on page load
  // Note: The endpoint returns an ARRAY of org users
  // Handle both with and without trailing slash
  await page.route('**/api/currentuserv2', async (route) => {
    await route.fulfill({ json: mockOrgUsers });
  });
  await page.route('**/api/currentuserv2/**', async (route) => {
    await route.fulfill({ json: mockOrgUsers });
  });

  // Mock pipelines list
  await page.route('**/api/prefect/v1/flows/', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({ json: mockPipelines });
    } else if (method === 'POST') {
      await route.fulfill({ json: { name: 'New Pipeline', success: true } });
    } else {
      await route.continue();
    }
  });

  // Mock transform tasks
  await page.route('**/api/prefect/tasks/transform/**', async (route) => {
    await route.fulfill({ json: mockTasks });
  });

  // Mock connections
  await page.route('**/api/airbyte/v1/connections**', async (route) => {
    await route.fulfill({ json: mockConnections });
  });

  // Mock pipeline detail - handle any deployment ID
  await page.route('**/api/prefect/v1/flows/dep-*', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Handle specific pipeline detail requests (not flow_run or flow_runs)
    if (
      url.match(/\/api\/prefect\/v1\/flows\/dep-[^/]+$/) ||
      url.match(/\/api\/prefect\/v1\/flows\/dep-[^/]+\/$/)
    ) {
      if (method === 'GET') {
        // Return appropriate mock based on deployment ID
        const urlPath = url.split('?')[0];
        const deploymentId = urlPath.replace(/\/$/, '').split('/').pop();
        if (deploymentId === 'dep-1') {
          await route.fulfill({ json: mockPipelineDetail });
        } else if (deploymentId === 'dep-2') {
          await route.fulfill({
            json: {
              name: 'Weekly Report',
              cron: '0 9 * * 1',
              isScheduleActive: false,
              connections: [],
              transformTasks: [],
            },
          });
        } else {
          await route.fulfill({ json: mockPipelineDetail });
        }
      } else if (method === 'PUT') {
        await route.fulfill({ json: { success: true } });
      } else if (method === 'DELETE') {
        await route.fulfill({ json: { success: true } });
      } else {
        await route.continue();
      }
    }
    // Handle flow run trigger
    else if (url.includes('/flow_run/')) {
      await route.fulfill({ json: { success: true } });
    }
    // Handle flow runs history
    else if (url.includes('/flow_runs/history')) {
      await route.fulfill({ json: mockRunHistory });
    } else {
      await route.continue();
    }
  });

  // Mock schedule status updates
  await page.route('**/api/prefect/flows/*/set_schedule/*', async (route) => {
    await route.fulfill({ json: { success: true } });
  });

  // Mock flow run logs
  await page.route('**/api/prefect/flow_runs/*/logs*', async (route) => {
    await route.fulfill({ json: mockLogs });
  });
}

/**
 * Setup mocks for empty state testing
 */
export async function setupEmptyStateMocks(page: Page) {
  // Mock authentication
  await page.route('**/api/v2/token/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      json: { success: true },
      headers: {
        'Set-Cookie': 'access_token=mock-token; Path=/; HttpOnly',
      },
    });
  });

  await page.route('**/api/currentuserv2', async (route) => {
    await route.fulfill({ json: mockOrgUsers });
  });
  await page.route('**/api/currentuserv2/**', async (route) => {
    await route.fulfill({ json: mockOrgUsers });
  });

  await page.route('**/api/prefect/v1/flows/', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: [] });
    } else {
      await route.continue();
    }
  });

  await page.route('**/api/prefect/tasks/transform/**', async (route) => {
    await route.fulfill({ json: mockTasks });
  });

  await page.route('**/api/airbyte/v1/connections**', async (route) => {
    await route.fulfill({ json: mockConnections });
  });
}

/**
 * Setup auth mocks - simulates a logged-in user
 * Sets up localStorage values before page navigation
 */
export async function setupAuthMocks(page: Page) {
  // Set auth-related localStorage values before navigating
  await page.addInitScript(() => {
    localStorage.setItem('selectedOrg', 'test-org');
  });
}

/**
 * Custom mock for a specific pipeline
 */
export async function mockPipelineById(
  page: Page,
  deploymentId: string,
  pipelineData: Record<string, unknown>
) {
  await page.route(`**/api/prefect/v1/flows/${deploymentId}`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: pipelineData });
    } else if (route.request().method() === 'PUT') {
      await route.fulfill({ json: { success: true } });
    } else if (route.request().method() === 'DELETE') {
      await route.fulfill({ json: { success: true } });
    } else {
      await route.continue();
    }
  });
}

/**
 * Intercept and capture API calls for assertions
 */
export function captureApiCalls(page: Page, pattern: string | RegExp) {
  const calls: { method: string; url: string; body?: unknown }[] = [];

  page.on('request', (request) => {
    const url = request.url();
    const matches = typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url);

    if (matches) {
      calls.push({
        method: request.method(),
        url,
        body: request.postDataJSON(),
      });
    }
  });

  return calls;
}
