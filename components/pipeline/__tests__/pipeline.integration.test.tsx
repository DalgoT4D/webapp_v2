/**
 * Pipeline/Orchestrate Integration Tests (Consolidated)
 *
 * These tests verify that components work correctly with real hooks and API calls.
 * Jest mocks intercept the API module, so we test the full component → hook → API flow.
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  mockApiGet,
  mockApiPost,
  mockApiDelete,
  mockApiPut,
  resetApiMocks,
} from '@/test-utils/api';
import { TestWrapper, PollingTestWrapper } from '@/test-utils/render';
import {
  mockPipelines,
  mockTasks,
  mockConnections,
  createMockPipeline,
  createPipelinesWithSharedConnection,
} from './pipeline-mock-data';
import { PipelineList } from '../pipeline-list';
import { PipelineForm } from '../pipeline-form';
import { LockStatus } from '@/constants/pipeline';

// ============ Mocks ============

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    loading: jest.fn(),
    promise: jest.fn(),
  },
}));

const getMockToast = () => jest.requireMock('sonner').toast;

jest.mock('@/hooks/useSyncLock', () => ({
  useSyncLock: () => ({
    tempSyncState: false,
    setTempSyncState: jest.fn(),
  }),
}));

const mockConfirm = jest.fn().mockResolvedValue(true);
jest.mock('@/components/ui/confirmation-dialog', () => ({
  useConfirmationDialog: () => ({
    confirm: mockConfirm,
    DialogComponent: (): null => null,
  }),
}));

jest.mock('@/hooks/api/usePermissions', () => ({
  useUserPermissions: () => ({
    hasPermission: () => true,
  }),
}));

jest.mock('../pipeline-run-history', () => ({
  PipelineRunHistory: (): null => null,
}));

// ============ Setup ============

beforeEach(() => {
  resetApiMocks();
  jest.clearAllMocks();

  mockApiGet.mockImplementation((url: string) => {
    if (url === '/api/prefect/v1/flows/') {
      return Promise.resolve(mockPipelines);
    }
    if (url === '/api/prefect/tasks/transform/') {
      return Promise.resolve(mockTasks);
    }
    if (url === '/api/airbyte/v1/connections') {
      return Promise.resolve(mockConnections);
    }
    if (url.match(/\/api\/prefect\/v1\/flows\/[\w-]+$/)) {
      return Promise.resolve({
        name: 'Pipeline Detail',
        cron: '0 9 * * *',
        isScheduleActive: true,
        connections: [{ id: 'conn-1', name: 'Postgres Source', seq: 1 }],
        transformTasks: [
          { uuid: 'task-1', seq: 1 },
          { uuid: 'task-2', seq: 2 },
        ],
      });
    }
    return Promise.reject(new Error(`Unmocked GET: ${url}`));
  });

  mockApiPost.mockResolvedValue({ success: true });
  mockApiPut.mockResolvedValue({ success: true });
  mockApiDelete.mockResolvedValue({ success: true });
});

// ============ Pipeline List Integration Tests ============

describe('Pipeline List - Integration Tests', () => {
  it('fetches data, renders all status badge variations, and shows empty state', async () => {
    // Data fetching
    const { unmount } = render(
      <TestWrapper>
        <PipelineList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Daily Sync')).toBeInTheDocument();
    });
    expect(screen.getByText('Weekly Report')).toBeInTheDocument();
    expect(screen.getByText('Running Pipeline')).toBeInTheDocument();
    expect(mockApiGet).toHaveBeenCalledWith('/api/prefect/v1/flows/');
    unmount();

    // All status badge variations
    const statusPipelines = [
      createMockPipeline({ name: 'Active Pipeline', deploymentId: 'status-1', status: true }),
      createMockPipeline({ name: 'Inactive Pipeline', deploymentId: 'status-2', status: false }),
      createMockPipeline({
        name: 'Running Pipeline',
        deploymentId: 'status-3',
        lock: {
          lockedBy: 'user@test.com',
          lockedAt: new Date().toISOString(),
          status: LockStatus.RUNNING,
        },
      }),
      createMockPipeline({
        name: 'Queued Pipeline',
        deploymentId: 'status-4',
        lock: {
          lockedBy: 'user@test.com',
          lockedAt: new Date().toISOString(),
          status: LockStatus.QUEUED,
        },
      }),
      createMockPipeline({
        name: 'Success Pipeline',
        deploymentId: 'status-5',
        lastRun: {
          id: 'r1',
          name: 'run',
          status: 'COMPLETED',
          state_name: 'Completed',
          startTime: '2025-05-21T10:00:00Z',
          expectedStartTime: '',
          orguser: 'user@test.com',
        },
      }),
      createMockPipeline({
        name: 'Failed Pipeline',
        deploymentId: 'status-6',
        lastRun: {
          id: 'r2',
          name: 'run',
          status: 'FAILED',
          state_name: 'Failed',
          startTime: '2025-05-21T10:00:00Z',
          expectedStartTime: '',
          orguser: 'System',
        },
      }),
      createMockPipeline({
        name: 'Tests Failed Pipeline',
        deploymentId: 'status-7',
        lastRun: {
          id: 'r3',
          name: 'run',
          status: 'FAILED',
          state_name: 'DBT_TEST_FAILED',
          startTime: '2025-05-21T10:00:00Z',
          expectedStartTime: '',
          orguser: null,
        },
      }),
    ];

    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/prefect/v1/flows/') return Promise.resolve(statusPipelines);
      return Promise.reject(new Error(`Unmocked GET: ${url}`));
    });

    const { unmount: unmount2 } = render(
      <TestWrapper>
        <PipelineList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Active Pipeline')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getAllByText('Failed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('DBT Test Failed')).toBeInTheDocument();
    unmount2();

    // Empty state
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/prefect/v1/flows/') return Promise.resolve([]);
      return Promise.reject(new Error(`Unmocked GET: ${url}`));
    });

    render(
      <TestWrapper>
        <PipelineList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('No pipelines yet')).toBeInTheDocument();
    });
    const createButtons = screen.getAllByRole('button', { name: /create pipeline/i });
    expect(createButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('handles navigation, run trigger, run errors, and delete with confirmation', async () => {
    const user = userEvent.setup();

    // Navigate to create
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/prefect/v1/flows/') {
        return Promise.resolve([
          createMockPipeline({ name: 'Action Test', deploymentId: 'action-1' }),
        ]);
      }
      return Promise.reject(new Error(`Unmocked GET: ${url}`));
    });

    const { unmount } = render(
      <TestWrapper>
        <PipelineList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Action Test')).toBeInTheDocument();
    });

    const createButton = screen.getAllByRole('button', { name: /create pipeline/i })[0];
    await user.click(createButton);
    expect(mockPush).toHaveBeenCalledWith('/orchestrate/create');
    mockPush.mockClear();

    // Run pipeline
    const runButton = screen.getByRole('button', { name: /run/i });
    await user.click(runButton);
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/prefect/v1/flows/action-1/flow_run/', {});
    });
    await waitFor(() => {
      expect(getMockToast().success).toHaveBeenCalledWith('Pipeline started successfully');
    });
    unmount();

    // Run error
    mockApiPost.mockRejectedValue(new Error('Pipeline is locked'));

    const { unmount: unmount2 } = render(
      <TestWrapper>
        <PipelineList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Action Test')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /run/i }));
    await waitFor(() => {
      expect(getMockToast().error).toHaveBeenCalled();
    });
    unmount2();

    // Delete with confirmation
    mockApiPost.mockResolvedValue({ success: true });

    render(
      <TestWrapper>
        <PipelineList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Action Test')).toBeInTheDocument();
    });

    const row = screen.getByText('Action Test').closest('tr');
    const dropdownTriggers = within(row!).getAllByRole('button');
    const moreDropdown = dropdownTriggers.find((btn) =>
      btn.querySelector('svg.lucide-more-horizontal')
    );

    if (moreDropdown) {
      await user.click(moreDropdown);
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /delete/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('menuitem', { name: /delete/i }));
      await waitFor(() => {
        expect(mockConfirm).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(mockApiDelete).toHaveBeenCalledWith('/api/prefect/v1/flows/action-1');
      });
    }
  });

  it('disables run button for running/queued pipelines and shows shared connection locking', async () => {
    // Running pipeline has disabled button
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/prefect/v1/flows/') {
        return Promise.resolve([
          createMockPipeline({
            name: 'Already Running',
            deploymentId: 'running-1',
            lock: {
              lockedBy: 'user@test.com',
              lockedAt: new Date().toISOString(),
              status: LockStatus.RUNNING,
            },
          }),
        ]);
      }
      return Promise.reject(new Error(`Unmocked GET: ${url}`));
    });

    const { unmount } = render(
      <TestWrapper>
        <PipelineList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Already Running')).toBeInTheDocument();
    });
    expect(screen.getByText('Running')).toBeInTheDocument();

    const row = screen.getByText('Already Running').closest('tr');
    const buttons = within(row!).getAllByRole('button');
    const disabledButtons = buttons.filter((btn) => btn.hasAttribute('disabled'));
    expect(disabledButtons.length).toBeGreaterThanOrEqual(1);
    unmount();

    // Shared connection locking
    const { runningPipeline, lockedPipeline1, lockedPipeline2 } =
      createPipelinesWithSharedConnection('shared-conn-1');

    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/prefect/v1/flows/') {
        return Promise.resolve([runningPipeline, lockedPipeline1, lockedPipeline2]);
      }
      return Promise.reject(new Error(`Unmocked GET: ${url}`));
    });

    render(
      <TestWrapper>
        <PipelineList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Running Pipeline')).toBeInTheDocument();
    });

    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getAllByText('Locked').length).toBe(2);
  });
});

// ============ Pipeline Form Integration Tests ============

describe('Pipeline Form - Integration Tests', () => {
  it('renders create mode with all sections, validation, modes, and cancel', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <PipelineForm />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create Pipeline' })).toBeInTheDocument();
    });

    // All form sections
    expect(screen.getByText('Pipeline Details')).toBeInTheDocument();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Transform Tasks')).toBeInTheDocument();
    expect(screen.getByText('Connections')).toBeInTheDocument();

    // Simple mode default
    expect(screen.getByLabelText('Run all tasks')).toBeInTheDocument();

    // Toggle run all tasks
    const checkbox = screen.getByLabelText('Run all tasks');
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    // Switch to advanced mode
    await user.click(screen.getByText('Advanced'));
    await waitFor(() => {
      expect(screen.queryByLabelText('Run all tasks')).not.toBeInTheDocument();
      expect(screen.getByTestId('task-selector-input')).toBeInTheDocument();
    });

    // Validation error on empty submit
    await user.click(screen.getByText('Simple'));
    await user.click(screen.getByRole('button', { name: /create pipeline/i }));
    await waitFor(() => {
      expect(screen.getByText('Schedule is required')).toBeInTheDocument();
    });

    // Cancel navigates back
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockPush).toHaveBeenCalledWith('/orchestrate');
  });

  it('loads existing pipeline in edit mode with various schedule types and task alignment detection', async () => {
    // Daily schedule with aligned tasks → simple mode
    const dailyPipeline = {
      name: 'Existing Daily Pipeline',
      cron: '30 9 * * *',
      isScheduleActive: true,
      connections: [{ id: 'conn-1', name: 'Postgres Source', seq: 1 }],
      transformTasks: [
        { uuid: 'task-1', seq: 1 },
        { uuid: 'task-2', seq: 2 },
      ],
    };

    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/prefect/v1/flows/existing-dep') return Promise.resolve(dailyPipeline);
      if (url === '/api/prefect/tasks/transform/') return Promise.resolve(mockTasks);
      if (url === '/api/airbyte/v1/connections') return Promise.resolve(mockConnections);
      return Promise.reject(new Error(`Unmocked GET: ${url}`));
    });

    const { unmount } = render(
      <TestWrapper>
        <PipelineForm deploymentId="existing-dep" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect((screen.getByTestId('name') as HTMLInputElement).value).toBe(
        'Existing Daily Pipeline'
      );
    });
    expect(screen.getByText('Update Pipeline')).toBeInTheDocument();
    expect(screen.getByTestId('activeSwitch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    unmount();

    // Manual schedule (null cron)
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/prefect/v1/flows/manual-dep')
        return Promise.resolve({
          name: 'Manual Pipeline',
          cron: null,
          isScheduleActive: false,
          connections: [{ id: 'conn-1', name: 'Connection 1', seq: 1 }],
          transformTasks: [],
        });
      if (url === '/api/prefect/tasks/transform/') return Promise.resolve(mockTasks);
      if (url === '/api/airbyte/v1/connections') return Promise.resolve(mockConnections);
      return Promise.reject(new Error(`Unmocked GET: ${url}`));
    });

    const { unmount: unmount2 } = render(
      <TestWrapper>
        <PipelineForm deploymentId="manual-dep" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('name')).toHaveValue('Manual Pipeline');
    });
    expect(screen.queryByTestId('cronTimeOfDay')).not.toBeInTheDocument();
    unmount2();

    // Non-aligned tasks → advanced mode
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/prefect/v1/flows/custom-order-dep')
        return Promise.resolve({
          name: 'Custom Order Pipeline',
          cron: '0 10 * * *',
          isScheduleActive: true,
          connections: [],
          transformTasks: [
            { uuid: 'task-3', seq: 1 },
            { uuid: 'task-1', seq: 2 },
          ],
        });
      if (url === '/api/prefect/tasks/transform/') return Promise.resolve(mockTasks);
      if (url === '/api/airbyte/v1/connections') return Promise.resolve(mockConnections);
      return Promise.reject(new Error(`Unmocked GET: ${url}`));
    });

    render(
      <TestWrapper>
        <PipelineForm deploymentId="custom-order-dep" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('name')).toHaveValue('Custom Order Pipeline');
    });
    expect(screen.queryByLabelText('Run all tasks')).not.toBeInTheDocument();
  });

  it('toggles active status in edit mode', async () => {
    const user = userEvent.setup();

    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/prefect/v1/flows/toggle-dep')
        return Promise.resolve({
          name: 'Toggle Test Pipeline',
          cron: '0 9 * * *',
          isScheduleActive: true,
          connections: [],
          transformTasks: [],
        });
      if (url === '/api/prefect/tasks/transform/') return Promise.resolve(mockTasks);
      if (url === '/api/airbyte/v1/connections') return Promise.resolve(mockConnections);
      return Promise.reject(new Error(`Unmocked GET: ${url}`));
    });

    render(
      <TestWrapper>
        <PipelineForm deploymentId="toggle-dep" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('activeSwitch')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('activeSwitch'));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalled();
    });
  });

  it('handles API errors, empty data scenarios, and DBT cloud pipelines', async () => {
    // API error when loading pipelines
    mockApiGet.mockRejectedValue(new Error('Server error'));

    const { unmount } = render(
      <TestWrapper>
        <PipelineList />
      </TestWrapper>
    );

    await waitFor(
      () => {
        expect(screen.queryByText('Daily Sync')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
    unmount();

    // No connections available
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/prefect/tasks/transform/') return Promise.resolve(mockTasks);
      if (url === '/api/airbyte/v1/connections') return Promise.resolve([]);
      return Promise.reject(new Error(`Unmocked GET: ${url}`));
    });

    const { unmount: unmount2 } = render(
      <TestWrapper>
        <PipelineForm />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Connections')).toBeInTheDocument();
    });
    expect(screen.getByTestId('name')).toBeInTheDocument();
    unmount2();

    // No tasks available
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/prefect/tasks/transform/') return Promise.resolve([]);
      if (url === '/api/airbyte/v1/connections') return Promise.resolve(mockConnections);
      return Promise.reject(new Error(`Unmocked GET: ${url}`));
    });

    const { unmount: unmount3 } = render(
      <TestWrapper>
        <PipelineForm />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Transform Tasks')).toBeInTheDocument();
    });
    expect(screen.getByTestId('name')).toBeInTheDocument();
    unmount3();

    // DBT Cloud pipeline (no transform tasks)
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/prefect/v1/flows/dbt-cloud-dep')
        return Promise.resolve({
          name: 'DBT Cloud Pipeline',
          cron: '0 10 * * *',
          isScheduleActive: true,
          connections: [{ id: 'conn-1', name: 'Connection 1', seq: 1 }],
          transformTasks: [],
        });
      if (url === '/api/prefect/tasks/transform/') return Promise.resolve(mockTasks);
      if (url === '/api/airbyte/v1/connections') return Promise.resolve(mockConnections);
      return Promise.reject(new Error(`Unmocked GET: ${url}`));
    });

    render(
      <TestWrapper>
        <PipelineForm deploymentId="dbt-cloud-dep" />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('name')).toHaveValue('DBT Cloud Pipeline');
    });
    expect(screen.getByLabelText('Run all tasks')).not.toBeChecked();
  });
});

// ============ Polling Tests ============

describe('Pipeline Polling Behavior', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('polls for updates when a pipeline is running, stops when complete', async () => {
    let pollCount = 0;
    const maxPolls = 3;

    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/prefect/v1/flows/') {
        pollCount++;
        const isStillRunning = pollCount < maxPolls;

        return Promise.resolve([
          createMockPipeline({
            name: 'Polling Test Pipeline',
            deploymentId: 'poll-test',
            lock: isStillRunning
              ? {
                  lockedBy: 'user@test.com',
                  lockedAt: new Date().toISOString(),
                  status: LockStatus.RUNNING,
                }
              : null,
            lastRun: isStillRunning
              ? null
              : {
                  id: 'run-1',
                  name: 'run',
                  status: 'COMPLETED',
                  state_name: 'Completed',
                  startTime: new Date().toISOString(),
                  expectedStartTime: '',
                  orguser: 'user@test.com',
                },
          }),
        ]);
      }
      return Promise.reject(new Error(`Unmocked GET: ${url}`));
    });

    render(
      <PollingTestWrapper>
        <PipelineList />
      </PollingTestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Polling Test Pipeline')).toBeInTheDocument();
    });
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(pollCount).toBe(1);

    await jest.advanceTimersByTimeAsync(3000);
    expect(pollCount).toBe(2);
    expect(screen.getByText('Running')).toBeInTheDocument();

    await jest.advanceTimersByTimeAsync(3000);
    expect(pollCount).toBe(3);

    await waitFor(() => {
      expect(screen.getByText('Success')).toBeInTheDocument();
    });

    const pollCountAfterComplete = pollCount;
    await jest.advanceTimersByTimeAsync(3000);
    expect(pollCount).toBe(pollCountAfterComplete);
  });
});
