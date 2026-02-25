/**
 * Pipeline Components - Consolidated Tests
 *
 * Tests for PipelineList, PipelineForm, and TaskSequence
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PipelineList } from '../pipeline-list';
import { PipelineForm } from '../pipeline-form';
import { TaskSequence } from '../task-sequence';
import * as usePipelinesHook from '@/hooks/api/usePipelines';
import * as usePermissionsHook from '@/hooks/api/usePermissions';
import type { Pipeline, TransformTask, Connection, PipelineDetailResponse } from '@/types/pipeline';

// ============ Mocks ============

jest.mock('@/hooks/api/usePipelines');
jest.mock('@/hooks/api/usePermissions');
jest.mock('@/hooks/useSyncLock', () => ({
  useSyncLock: () => ({ tempSyncState: false, setTempSyncState: jest.fn() }),
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn(), deleted: jest.fn(), created: jest.fn(), updated: jest.fn() },
  toastError: { api: jest.fn(), delete: jest.fn(), save: jest.fn() },
}));

jest.mock('@/components/ui/confirmation-dialog', () => ({
  useConfirmationDialog: () => ({
    confirm: jest.fn().mockResolvedValue(true),
    DialogComponent: (): null => null,
  }),
}));

jest.mock('../pipeline-run-history', () => ({ PipelineRunHistory: (): null => null }));

// Mock dnd-kit for TaskSequence
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: jest.fn(),
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(),
  useSensors: jest.fn().mockReturnValue([]),
}));

jest.mock('@dnd-kit/sortable', () => ({
  arrayMove: jest.fn((arr, from, to) => {
    const result = [...arr];
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: jest.fn(),
  useSortable: (): {
    attributes: object;
    listeners: object;
    setNodeRef: jest.Mock;
    transform: null;
    transition: null;
    isDragging: boolean;
  } => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: {},
}));

jest.mock('@dnd-kit/utilities', () => ({ CSS: { Transform: { toString: () => '' } } }));

// ============ Test Data Factories ============

const createPipeline = (overrides: Partial<Pipeline> = {}): Pipeline => ({
  name: 'Test Pipeline',
  cron: '0 9 * * *',
  deploymentName: 'test-deployment',
  deploymentId: 'test-dep-id',
  lastRun: null,
  lock: null,
  status: true,
  queuedFlowRunWaitTime: null,
  ...overrides,
});

const createTask = (overrides: Partial<TransformTask> = {}): TransformTask => ({
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
  ...overrides,
});

const createConnection = (overrides: Partial<Connection> = {}): Connection => ({
  name: 'Connection 1',
  connectionId: 'conn-1',
  deploymentId: 'dep-1',
  catalogId: 'cat-1',
  destination: { destinationId: 'dest-1', destinationName: 'Dest 1' },
  source: { sourceId: 'src-1', sourceName: 'Source 1' },
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

// ============ PipelineList Tests ============

describe('PipelineList', () => {
  const mockMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (usePipelinesHook.usePipelines as jest.Mock).mockReturnValue({
      pipelines: [],
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: () => true,
    });
  });

  it('renders empty state with header and create button, hides create button without permission, and shows loading skeleton', () => {
    // Empty state with permissions
    const { unmount } = render(<PipelineList />);
    expect(screen.getByText('Pipelines')).toBeInTheDocument();
    expect(
      screen.getByText('Manage your data sync and transformation workflows')
    ).toBeInTheDocument();
    expect(screen.getByText('No pipelines yet')).toBeInTheDocument();
    const createButtons = screen.getAllByRole('button', { name: /create pipeline/i });
    expect(createButtons.length).toBeGreaterThanOrEqual(1);
    unmount();

    // No permission - no create button
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: (p: string) => p !== 'can_create_pipeline',
    });
    const { unmount: unmount2 } = render(<PipelineList />);
    expect(screen.getByText('No pipelines yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create pipeline/i })).not.toBeInTheDocument();
    unmount2();

    // Loading state
    (usePipelinesHook.usePipelines as jest.Mock).mockReturnValue({
      pipelines: [],
      isLoading: true,
      isError: null,
      mutate: mockMutate,
    });
    render(<PipelineList />);
    expect(screen.queryByText('Pipelines')).not.toBeInTheDocument();
  });

  it('displays pipeline rows with all status variations including lock states', () => {
    const pipelines = [
      createPipeline({ name: 'Active Daily', status: true, cron: '0 9 * * *' }),
      createPipeline({ name: 'Inactive Manual', status: false, cron: null, deploymentId: 'dep-2' }),
      createPipeline({
        name: 'Running Pipeline',
        deploymentId: 'dep-3',
        lock: { lockedBy: 'user@test.com', lockedAt: new Date().toISOString(), status: 'running' },
      }),
      createPipeline({
        name: 'Queued Pipeline',
        deploymentId: 'dep-4',
        lock: { lockedBy: 'user@test.com', lockedAt: new Date().toISOString(), status: 'queued' },
      }),
      createPipeline({
        name: 'Locked Pipeline',
        deploymentId: 'dep-lock',
        lock: { lockedBy: 'user@test.com', lockedAt: new Date().toISOString(), status: 'locked' },
      }),
      createPipeline({
        name: 'Complete Lock Pipeline',
        deploymentId: 'dep-lock-complete',
        lock: {
          lockedBy: 'user@test.com',
          lockedAt: new Date().toISOString(),
          status: 'complete',
        },
      }),
      createPipeline({
        name: 'Completed Pipeline',
        deploymentId: 'dep-5',
        lastRun: {
          id: '1',
          name: 'run',
          status: 'COMPLETED',
          state_name: 'Completed',
          startTime: '2025-05-21T10:00:00Z',
          expectedStartTime: '',
          orguser: 'user@test.com',
        },
      }),
      createPipeline({
        name: 'Failed Pipeline',
        deploymentId: 'dep-6',
        lastRun: {
          id: '2',
          name: 'run',
          status: 'FAILED',
          state_name: 'Failed',
          startTime: '2025-05-21T10:00:00Z',
          expectedStartTime: '',
          orguser: 'System',
        },
      }),
      createPipeline({
        name: 'DBT Failed Pipeline',
        deploymentId: 'dep-7',
        lastRun: {
          id: '3',
          name: 'run',
          status: 'FAILED',
          state_name: 'DBT_TEST_FAILED',
          startTime: '2025-05-21T10:00:00Z',
          expectedStartTime: '',
          orguser: null,
        },
      }),
    ];

    (usePipelinesHook.usePipelines as jest.Mock).mockReturnValue({
      pipelines,
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });

    render(<PipelineList />);

    // All pipelines rendered
    expect(screen.getByText('Active Daily')).toBeInTheDocument();
    expect(screen.getByText('Inactive Manual')).toBeInTheDocument();
    expect(screen.getByText('Running Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Locked Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Complete Lock Pipeline')).toBeInTheDocument();

    // Status badges
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.getAllByText('Locked').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getAllByText('Failed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('DBT Test Failed')).toBeInTheDocument();

    // Schedule and user display
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getAllByText('user').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('System').length).toBeGreaterThanOrEqual(1);
  });

  it('handles run button click, respects permissions, and disables history without view permission', async () => {
    const user = userEvent.setup();
    const mockTriggerRun = jest.fn().mockResolvedValue({});
    jest.spyOn(usePipelinesHook, 'triggerPipelineRun').mockImplementation(mockTriggerRun);

    const pipelines = [createPipeline()];
    (usePipelinesHook.usePipelines as jest.Mock).mockReturnValue({
      pipelines,
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });

    // Click run with permissions
    const { unmount } = render(<PipelineList />);
    const runButton = screen.getByRole('button', { name: /run/i });
    await user.click(runButton);
    await waitFor(() => expect(mockTriggerRun).toHaveBeenCalledWith('test-dep-id'));
    unmount();

    // Run button disabled without run permission
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: (p: string) => p !== 'can_run_pipeline',
    });
    const { unmount: unmount2 } = render(<PipelineList />);
    const disabledRunButton = screen.getByRole('button', { name: /run/i });
    expect(disabledRunButton).toBeDisabled();
    unmount2();

    // History button disabled without view permission
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: (p: string) => p !== 'can_view_pipeline',
    });
    render(<PipelineList />);
    const historyButton = screen.getByRole('button', { name: /history/i });
    expect(historyButton).toBeDisabled();
  });
});

// ============ PipelineForm Tests ============

describe('PipelineForm', () => {
  const defaultTasks = [
    createTask(),
    createTask({ uuid: 'task-2', slug: 'dbt-run', command: 'dbt run', order: 5 }),
  ];
  const defaultConnections = [
    createConnection(),
    createConnection({ connectionId: 'conn-2', name: 'Connection 2' }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (usePipelinesHook.usePipeline as jest.Mock).mockReturnValue({
      pipeline: null,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });
    (usePipelinesHook.useTransformTasks as jest.Mock).mockReturnValue({
      tasks: defaultTasks,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });
    (usePipelinesHook.useConnections as jest.Mock).mockReturnValue({
      connections: defaultConnections,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });
    (usePipelinesHook.createPipeline as jest.Mock).mockResolvedValue({ name: 'New Pipeline' });
    (usePipelinesHook.updatePipeline as jest.Mock).mockResolvedValue({});
  });

  it('renders create mode with all sections, handles validation, loading, and cancel', async () => {
    const user = userEvent.setup();

    // Loading state
    (usePipelinesHook.useTransformTasks as jest.Mock).mockReturnValue({
      tasks: [],
      isLoading: true,
      isError: null,
      mutate: jest.fn(),
    });
    const { unmount } = render(<PipelineForm />);
    expect(screen.queryByRole('heading', { name: /create pipeline/i })).not.toBeInTheDocument();
    unmount();

    // Restore non-loading state
    (usePipelinesHook.useTransformTasks as jest.Mock).mockReturnValue({
      tasks: defaultTasks,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });

    render(<PipelineForm />);

    // All form sections present
    expect(screen.getByRole('heading', { name: /create pipeline/i })).toBeInTheDocument();
    expect(screen.getByText('Pipeline Details')).toBeInTheDocument();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Connections')).toBeInTheDocument();
    expect(screen.getByText('Transform Tasks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create pipeline/i })).toBeInTheDocument();
    expect(screen.queryByTestId('activeSwitch')).not.toBeInTheDocument();

    // Form input
    const nameInput = screen.getByTestId('name');
    await user.type(nameInput, 'My New Pipeline');
    expect(nameInput).toHaveValue('My New Pipeline');

    // Submit without schedule shows validation error
    await user.click(screen.getByRole('button', { name: /create pipeline/i }));
    expect(await screen.findByText('Schedule is required')).toBeInTheDocument();
    expect(usePipelinesHook.createPipeline).not.toHaveBeenCalled();

    // Cancel navigates back
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockPush).toHaveBeenCalledWith('/orchestrate');
  });

  it('renders edit mode with existing data and toggles simple/advanced task modes', async () => {
    const user = userEvent.setup();
    const existingPipeline: PipelineDetailResponse = {
      name: 'Existing Pipeline',
      cron: '0 9 * * *',
      isScheduleActive: true,
      connections: [{ id: 'conn-1', name: 'Connection 1', seq: 1 }],
      transformTasks: [
        { uuid: 'task-1', seq: 1 },
        { uuid: 'task-2', seq: 2 },
      ],
    };

    (usePipelinesHook.usePipeline as jest.Mock).mockReturnValue({
      pipeline: existingPipeline,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });

    render(<PipelineForm deploymentId="test-dep-id" />);

    // Edit mode renders correctly
    expect(screen.getByRole('heading', { name: /update pipeline/i })).toBeInTheDocument();
    expect(screen.getByTestId('activeSwitch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();

    await waitFor(() => {
      expect((screen.getByTestId('name') as HTMLInputElement).value).toBe('Existing Pipeline');
    });

    // Simple mode shows "Run all tasks" when tasks are aligned
    expect(screen.getByLabelText('Run all tasks')).toBeInTheDocument();

    // Switch to advanced
    await user.click(screen.getByText('Advanced'));
    await waitFor(() => {
      expect(screen.queryByLabelText('Run all tasks')).not.toBeInTheDocument();
    });

    // Switch back to simple
    await user.click(screen.getByText('Simple'));
    await waitFor(() => {
      expect(screen.getByLabelText('Run all tasks')).toBeInTheDocument();
    });
  });
});

// ============ PipelineForm Edit Mode Edge Cases ============

describe('PipelineForm - Edit Mode Edge Cases', () => {
  const systemTasks = [
    createTask({ uuid: 'task-1', slug: 'git-pull', command: 'git pull', seq: 1, order: 1 }),
    createTask({
      uuid: 'task-2',
      slug: 'dbt-run',
      command: 'dbt run',
      seq: 2,
      order: 5,
      pipeline_default: true,
    }),
    createTask({
      uuid: 'task-3',
      slug: 'dbt-test',
      command: 'dbt test',
      seq: 3,
      order: 6,
      pipeline_default: true,
    }),
  ];

  const defaultConnections = [
    createConnection({ connectionId: 'conn-1', name: 'Connection 1' }),
    createConnection({ connectionId: 'conn-2', name: 'Connection 2' }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (usePipelinesHook.useConnections as jest.Mock).mockReturnValue({
      connections: defaultConnections,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });
    (usePipelinesHook.createPipeline as jest.Mock).mockResolvedValue({ name: 'New Pipeline' });
    (usePipelinesHook.updatePipeline as jest.Mock).mockResolvedValue({});
  });

  it('populates form in simple mode when tasks align and switches to advanced when they do not', async () => {
    // Aligned tasks → simple mode
    const alignedPipeline: PipelineDetailResponse = {
      name: 'Aligned Pipeline',
      cron: '0 9 * * *',
      isScheduleActive: true,
      connections: [{ id: 'conn-1', name: 'Connection 1', seq: 1 }],
      transformTasks: [
        { uuid: 'task-1', seq: 1 },
        { uuid: 'task-2', seq: 2 },
        { uuid: 'task-3', seq: 3 },
      ],
    };

    (usePipelinesHook.usePipeline as jest.Mock).mockReturnValue({
      pipeline: alignedPipeline,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });
    (usePipelinesHook.useTransformTasks as jest.Mock).mockReturnValue({
      tasks: systemTasks,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });

    const { unmount } = render(<PipelineForm deploymentId="test-dep-id" />);

    await waitFor(() => {
      expect((screen.getByTestId('name') as HTMLInputElement).value).toBe('Aligned Pipeline');
    });
    expect(screen.getByLabelText('Run all tasks')).toBeInTheDocument();
    unmount();

    // Non-aligned tasks → advanced mode
    const customOrderPipeline: PipelineDetailResponse = {
      name: 'Custom Order Pipeline',
      cron: '0 14 * * *',
      isScheduleActive: false,
      connections: [{ id: 'conn-2', name: 'Connection 2', seq: 1 }],
      transformTasks: [
        { uuid: 'task-3', seq: 1 },
        { uuid: 'task-1', seq: 2 },
      ],
    };

    (usePipelinesHook.usePipeline as jest.Mock).mockReturnValue({
      pipeline: customOrderPipeline,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });

    render(<PipelineForm deploymentId="test-dep-id" />);

    await waitFor(() => {
      expect((screen.getByTestId('name') as HTMLInputElement).value).toBe('Custom Order Pipeline');
    });
    expect(screen.queryByLabelText('Run all tasks')).not.toBeInTheDocument();
  });

  it('handles dbt_cloud scenarios and missing task edge cases', async () => {
    // dbt_cloud: tasks available but pipeline has no transform tasks
    const dbtCloudPipeline: PipelineDetailResponse = {
      name: 'DBT Cloud Pipeline',
      cron: '30 10 * * 1,3,5',
      isScheduleActive: true,
      connections: [
        { id: 'conn-1', name: 'Connection 1', seq: 1 },
        { id: 'conn-2', name: 'Connection 2', seq: 2 },
      ],
      transformTasks: [],
    };

    (usePipelinesHook.usePipeline as jest.Mock).mockReturnValue({
      pipeline: dbtCloudPipeline,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });
    (usePipelinesHook.useTransformTasks as jest.Mock).mockReturnValue({
      tasks: systemTasks,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });

    const { unmount } = render(<PipelineForm deploymentId="dbt-cloud-dep" />);

    await waitFor(() => {
      expect((screen.getByTestId('name') as HTMLInputElement).value).toBe('DBT Cloud Pipeline');
    });
    expect(screen.getByTestId('activeSwitch')).toBeInTheDocument();
    expect(screen.getByLabelText('Run all tasks')).not.toBeChecked();
    unmount();

    // dbt_cloud: no tasks available at all
    const noTasksPipeline: PipelineDetailResponse = {
      name: 'DBT Cloud No Tasks',
      cron: null,
      isScheduleActive: false,
      connections: [{ id: 'conn-1', name: 'Connection 1', seq: 1 }],
      transformTasks: [],
    };

    (usePipelinesHook.usePipeline as jest.Mock).mockReturnValue({
      pipeline: noTasksPipeline,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });
    (usePipelinesHook.useTransformTasks as jest.Mock).mockReturnValue({
      tasks: [],
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });

    const { unmount: unmount2 } = render(<PipelineForm deploymentId="dbt-cloud-no-tasks" />);

    await waitFor(() => {
      expect((screen.getByTestId('name') as HTMLInputElement).value).toBe('DBT Cloud No Tasks');
    });
    expect(screen.getByTestId('activeSwitch')).toBeInTheDocument();
    unmount2();

    // Pipeline with saved tasks that no longer exist
    const missingTasksPipeline: PipelineDetailResponse = {
      name: 'Pipeline With Missing Tasks',
      cron: '0 8 * * *',
      isScheduleActive: true,
      connections: [{ id: 'conn-1', name: 'Connection 1', seq: 1 }],
      transformTasks: [
        { uuid: 'deleted-task-1', seq: 1 },
        { uuid: 'deleted-task-2', seq: 2 },
      ],
    };

    (usePipelinesHook.usePipeline as jest.Mock).mockReturnValue({
      pipeline: missingTasksPipeline,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });
    (usePipelinesHook.useTransformTasks as jest.Mock).mockReturnValue({
      tasks: [],
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });

    render(<PipelineForm deploymentId="missing-tasks-dep" />);

    await waitFor(() => {
      expect((screen.getByTestId('name') as HTMLInputElement).value).toBe(
        'Pipeline With Missing Tasks'
      );
    });
    expect(screen.getByRole('heading', { name: /update pipeline/i })).toBeInTheDocument();
  });

  it('filters tasks by pipeline_default and handles schedule status update failure', async () => {
    const user = userEvent.setup();

    // Task filtering by pipeline_default and generated_by
    const mixedTasks = [
      createTask({
        uuid: 'system-default',
        slug: 'git-pull',
        generated_by: 'system',
        pipeline_default: true,
      }),
      createTask({
        uuid: 'system-not-default',
        slug: 'dbt-clean',
        generated_by: 'system',
        pipeline_default: false,
      }),
      createTask({
        uuid: 'client-task',
        slug: 'custom',
        generated_by: 'client',
        pipeline_default: false,
      }),
    ];

    const filterPipeline: PipelineDetailResponse = {
      name: 'Mixed Tasks Pipeline',
      cron: '0 9 * * *',
      isScheduleActive: true,
      connections: [],
      transformTasks: [{ uuid: 'system-default', seq: 1 }],
    };

    (usePipelinesHook.usePipeline as jest.Mock).mockReturnValue({
      pipeline: filterPipeline,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });
    (usePipelinesHook.useTransformTasks as jest.Mock).mockReturnValue({
      tasks: mixedTasks,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });

    const { unmount } = render(<PipelineForm deploymentId="mixed-tasks-dep" />);

    await waitFor(() => {
      expect((screen.getByTestId('name') as HTMLInputElement).value).toBe('Mixed Tasks Pipeline');
    });
    expect(screen.getByLabelText('Run all tasks')).toBeInTheDocument();
    unmount();

    // Schedule status update failure
    const statusFailPipeline: PipelineDetailResponse = {
      name: 'Status Fail Pipeline',
      cron: '0 9 * * *',
      isScheduleActive: true,
      connections: [],
      transformTasks: [],
    };

    (usePipelinesHook.usePipeline as jest.Mock).mockReturnValue({
      pipeline: statusFailPipeline,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });
    (usePipelinesHook.useTransformTasks as jest.Mock).mockReturnValue({
      tasks: [],
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });
    (usePipelinesHook.useConnections as jest.Mock).mockReturnValue({
      connections: [],
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });
    (usePipelinesHook.updatePipeline as jest.Mock).mockResolvedValue({});
    (usePipelinesHook.setScheduleStatus as jest.Mock).mockRejectedValue(
      new Error('Status update failed')
    );

    render(<PipelineForm deploymentId="status-fail-dep" />);

    await waitFor(() => {
      expect(screen.getByTestId('name')).toHaveValue('Status Fail Pipeline');
    });

    await user.click(screen.getByTestId('activeSwitch'));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(usePipelinesHook.updatePipeline).toHaveBeenCalled();
    });
  });

  it('correctly handles manual schedule (null cron)', async () => {
    const pipeline: PipelineDetailResponse = {
      name: 'Manual Pipeline',
      cron: null,
      isScheduleActive: false,
      connections: [{ id: 'conn-1', name: 'Connection 1', seq: 1 }],
      transformTasks: [{ uuid: 'task-1', seq: 1 }],
    };

    (usePipelinesHook.usePipeline as jest.Mock).mockReturnValue({
      pipeline,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });
    (usePipelinesHook.useTransformTasks as jest.Mock).mockReturnValue({
      tasks: systemTasks,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });

    render(<PipelineForm deploymentId="manual-dep" />);

    await waitFor(() => {
      expect((screen.getByTestId('name') as HTMLInputElement).value).toBe('Manual Pipeline');
    });

    expect(screen.queryByTestId('cronTimeOfDay')).not.toBeInTheDocument();
  });
});

// ============ TaskSequence Tests ============

describe('TaskSequence', () => {
  const mockOnChange = jest.fn();
  const mockTasks = [
    createTask(),
    createTask({ uuid: 'task-2', slug: 'dbt-run', command: 'dbt run', order: 5 }),
    createTask({
      uuid: 'task-3',
      slug: 'custom',
      command: 'custom cmd',
      generated_by: 'client',
      pipeline_default: false,
    }),
    createTask({ uuid: 'task-4', slug: 'dbt-test', command: 'dbt test', order: 6 }),
  ];

  beforeEach(() => jest.clearAllMocks());

  it('renders task list with controls, handles remove and reset, and shows generated_by badges', async () => {
    const user = userEvent.setup();
    const selectedTasks = [mockTasks[0], mockTasks[1]];

    const { rerender } = render(
      <TaskSequence value={selectedTasks} onChange={mockOnChange} options={mockTasks} />
    );

    // Components and tasks rendered
    expect(screen.getByTestId('task-selector-input')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset to default/i })).toBeInTheDocument();
    expect(screen.getByText(/These are your transformation tasks/)).toBeInTheDocument();
    expect(screen.getByText('git pull')).toBeInTheDocument();
    expect(screen.getByText('dbt run')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getAllByText('system').length).toBe(2);

    // Remove task
    const removeButtons = screen.getAllByRole('button', { name: /remove task/i });
    await user.click(removeButtons[0]);
    expect(mockOnChange).toHaveBeenCalledWith([mockTasks[1]]);

    // Reset to default
    mockOnChange.mockClear();
    await user.click(screen.getByRole('button', { name: /reset to default/i }));
    expect(mockOnChange).toHaveBeenCalled();

    // Client task badge
    rerender(<TaskSequence value={[mockTasks[2]]} onChange={mockOnChange} options={mockTasks} />);
    expect(screen.getByText('client')).toBeInTheDocument();
    expect(screen.getByText('custom cmd')).toBeInTheDocument();
  });

  it('shows task slug when command is null and handles empty state', () => {
    const taskWithNoCommand = createTask({ uuid: 'task-no-cmd', slug: 'test-task', command: null });

    // Null command shows slug
    const { rerender } = render(
      <TaskSequence
        value={[taskWithNoCommand]}
        onChange={mockOnChange}
        options={[taskWithNoCommand]}
      />
    );
    expect(screen.getByText('test task')).toBeInTheDocument();

    // Empty state
    rerender(<TaskSequence value={[]} onChange={mockOnChange} options={mockTasks} />);
    expect(screen.getByTestId('task-selector-input')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove task/i })).not.toBeInTheDocument();
  });
});
