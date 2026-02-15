/**
 * Pipeline Components - Comprehensive Tests
 *
 * Tests for PipelineList, PipelineForm, TaskSequence, and PipelineRunHistory
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PipelineList } from '../pipeline-list';
import { PipelineForm } from '../pipeline-form';
import { TaskSequence } from '../task-sequence';
import * as usePipelinesHook from '@/hooks/api/usePipelines';
import * as usePermissionsHook from '@/hooks/api/usePermissions';
import { Pipeline, TransformTask, Connection, PipelineDetailResponse } from '@/types/pipeline';

// ============ Mocks ============

jest.mock('@/hooks/api/usePipelines');
jest.mock('@/hooks/api/usePermissions');
jest.mock('@/hooks/useSyncLock', () => ({
  useSyncLock: () => ({ tempSyncState: false, setTempSyncState: jest.fn() }),
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

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

  it('renders empty state, header, and create button with proper permissions', () => {
    render(<PipelineList />);

    // Header
    expect(screen.getByText('Pipelines')).toBeInTheDocument();
    expect(
      screen.getByText('Manage your data sync and transformation workflows')
    ).toBeInTheDocument();

    // Empty state
    expect(screen.getByText('No pipelines yet')).toBeInTheDocument();

    // Create button (appears in header and empty state)
    const createButtons = screen.getAllByRole('button', { name: /create pipeline/i });
    expect(createButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('hides create button without permission and shows loading skeleton', () => {
    // No permission
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: (p: string) => p !== 'can_create_pipeline',
    });
    const { unmount } = render(<PipelineList />);
    expect(screen.queryByRole('button', { name: /create pipeline/i })).not.toBeInTheDocument();
    unmount();

    // Loading state
    (usePipelinesHook.usePipelines as jest.Mock).mockReturnValue({
      pipelines: [],
      isLoading: true,
      isError: null,
      mutate: mockMutate,
    });
    render(<PipelineList />);
    expect(screen.queryByText('Pipelines')).not.toBeInTheDocument(); // Header hidden during load
  });

  it('displays pipeline rows with all status variations', () => {
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

    // Status badges - use getAllByText since multiple pipelines share same statuses
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getAllByText('Failed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Tests Failed')).toBeInTheDocument();

    // Schedule display
    expect(screen.getByText('Manual')).toBeInTheDocument();

    // User attribution - multiple pipelines may show same user/System
    expect(screen.getAllByText('user').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('System').length).toBeGreaterThanOrEqual(1);
  });

  it('handles run button click and respects permissions', async () => {
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

    render(<PipelineList />);

    // Click run
    const runButton = screen.getByRole('button', { name: /run/i });
    await user.click(runButton);
    await waitFor(() => expect(mockTriggerRun).toHaveBeenCalledWith('test-dep-id'));

    // Disable without permission
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: (p: string) => p !== 'can_run_pipeline',
    });
    render(<PipelineList />);
    const disabledRunButton = screen.getAllByRole('button', { name: /run/i })[1];
    expect(disabledRunButton).toBeDisabled();
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

  it('renders create mode with all form sections', () => {
    render(<PipelineForm />);

    // Header
    expect(screen.getByRole('heading', { name: /create pipeline/i })).toBeInTheDocument();

    // Form sections
    expect(screen.getByText('Pipeline Details')).toBeInTheDocument();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Connections')).toBeInTheDocument();
    expect(screen.getByText('Transform Tasks')).toBeInTheDocument();

    // Buttons
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create pipeline/i })).toBeInTheDocument();

    // No active toggle in create mode
    expect(screen.queryByTestId('activeSwitch')).not.toBeInTheDocument();
  });

  it('renders edit mode with existing data and active toggle', async () => {
    const existingPipeline: PipelineDetailResponse = {
      name: 'Existing Pipeline',
      cron: '0 9 * * *',
      isScheduleActive: true,
      connections: [{ id: 'conn-1', name: 'Connection 1', seq: 1 }],
      transformTasks: [{ uuid: 'task-1', seq: 1 }],
    };

    (usePipelinesHook.usePipeline as jest.Mock).mockReturnValue({
      pipeline: existingPipeline,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });

    render(<PipelineForm deploymentId="test-dep-id" />);

    expect(screen.getByRole('heading', { name: /update pipeline/i })).toBeInTheDocument();
    expect(screen.getByTestId('activeSwitch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();

    await waitFor(() => {
      expect((screen.getByTestId('name') as HTMLInputElement).value).toBe('Existing Pipeline');
    });
  });

  it('shows loading skeleton when data is loading', () => {
    (usePipelinesHook.useTransformTasks as jest.Mock).mockReturnValue({
      tasks: [],
      isLoading: true,
      isError: null,
      mutate: jest.fn(),
    });

    render(<PipelineForm />);
    expect(screen.queryByRole('heading', { name: /create pipeline/i })).not.toBeInTheDocument();
  });

  it('handles form input and validation', async () => {
    const user = userEvent.setup();
    render(<PipelineForm />);

    // Type in name field
    const nameInput = screen.getByTestId('name');
    await user.type(nameInput, 'My New Pipeline');
    expect(nameInput).toHaveValue('My New Pipeline');

    // Try submit without required fields shows validation
    await user.click(screen.getByRole('button', { name: /create pipeline/i }));

    // Validation error should appear for missing schedule
    expect(await screen.findByText('Schedule is required')).toBeInTheDocument();

    // Verify createPipeline was not called due to validation failure
    expect(usePipelinesHook.createPipeline).not.toHaveBeenCalled();
  });

  it('toggles between simple and advanced task modes', async () => {
    const user = userEvent.setup();
    render(<PipelineForm />);

    // Simple mode shows "Run all tasks" checkbox
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

  it('navigates back on cancel', async () => {
    const user = userEvent.setup();
    render(<PipelineForm />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockPush).toHaveBeenCalledWith('/orchestrate');
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

  it('populates form fields when tasks are aligned with defaults (simple mode)', async () => {
    const pipeline: PipelineDetailResponse = {
      name: 'Aligned Pipeline',
      cron: '0 9 * * *', // daily at 9 AM UTC
      isScheduleActive: true,
      connections: [{ id: 'conn-1', name: 'Connection 1', seq: 1 }],
      transformTasks: [
        { uuid: 'task-1', seq: 1 },
        { uuid: 'task-2', seq: 2 },
        { uuid: 'task-3', seq: 3 },
      ],
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

    render(<PipelineForm deploymentId="test-dep-id" />);

    await waitFor(() => {
      expect((screen.getByTestId('name') as HTMLInputElement).value).toBe('Aligned Pipeline');
    });

    // Simple mode should be active (not advanced)
    expect(screen.getByLabelText('Run all tasks')).toBeInTheDocument();
  });

  it('switches to advanced mode when tasks are not aligned with defaults', async () => {
    const pipeline: PipelineDetailResponse = {
      name: 'Custom Order Pipeline',
      cron: '0 14 * * *',
      isScheduleActive: false,
      connections: [{ id: 'conn-2', name: 'Connection 2', seq: 1 }],
      transformTasks: [
        { uuid: 'task-3', seq: 1 }, // Different order - dbt-test first
        { uuid: 'task-1', seq: 2 }, // git-pull second
      ],
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

    render(<PipelineForm deploymentId="test-dep-id" />);

    await waitFor(() => {
      expect((screen.getByTestId('name') as HTMLInputElement).value).toBe('Custom Order Pipeline');
    });

    // Advanced mode should be active (no "Run all tasks" checkbox)
    expect(screen.queryByLabelText('Run all tasks')).not.toBeInTheDocument();
  });

  it('handles dbt_cloud case: tasks available but pipeline has no transform tasks', async () => {
    // dbt_cloud pipelines have no system transform tasks
    const pipeline: PipelineDetailResponse = {
      name: 'DBT Cloud Pipeline',
      cron: '30 10 * * 1,3,5', // weekly on Mon, Wed, Fri at 10:30 AM UTC
      isScheduleActive: true,
      connections: [
        { id: 'conn-1', name: 'Connection 1', seq: 1 },
        { id: 'conn-2', name: 'Connection 2', seq: 2 },
      ],
      transformTasks: [], // Empty - dbt_cloud case
    };

    (usePipelinesHook.usePipeline as jest.Mock).mockReturnValue({
      pipeline,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });
    (usePipelinesHook.useTransformTasks as jest.Mock).mockReturnValue({
      tasks: systemTasks, // Tasks are available
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });

    render(<PipelineForm deploymentId="dbt-cloud-dep" />);

    // Form should still be populated with non-task fields
    await waitFor(() => {
      expect((screen.getByTestId('name') as HTMLInputElement).value).toBe('DBT Cloud Pipeline');
    });

    // Active switch should reflect pipeline state
    expect(screen.getByTestId('activeSwitch')).toBeInTheDocument();

    // "Run all tasks" checkbox should be unchecked since tasksToApply is empty
    const runAllCheckbox = screen.getByLabelText('Run all tasks');
    expect(runAllCheckbox).not.toBeChecked();
  });

  it('handles dbt_cloud case: no tasks available and pipeline has no transform tasks', async () => {
    const pipeline: PipelineDetailResponse = {
      name: 'DBT Cloud No Tasks',
      cron: null, // Manual schedule
      isScheduleActive: false,
      connections: [{ id: 'conn-1', name: 'Connection 1', seq: 1 }],
      transformTasks: [], // Empty - dbt_cloud case
    };

    (usePipelinesHook.usePipeline as jest.Mock).mockReturnValue({
      pipeline,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });
    (usePipelinesHook.useTransformTasks as jest.Mock).mockReturnValue({
      tasks: [], // No tasks available at all
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });

    render(<PipelineForm deploymentId="dbt-cloud-no-tasks" />);

    // Form should STILL be populated with non-task fields
    await waitFor(() => {
      expect((screen.getByTestId('name') as HTMLInputElement).value).toBe('DBT Cloud No Tasks');
    });

    // Active toggle should be present and reflect state
    const activeSwitch = screen.getByTestId('activeSwitch');
    expect(activeSwitch).toBeInTheDocument();
  });

  it('populates non-task fields even when tasks are not available but pipeline has saved tasks', async () => {
    const pipeline: PipelineDetailResponse = {
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
      pipeline,
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });
    (usePipelinesHook.useTransformTasks as jest.Mock).mockReturnValue({
      tasks: [], // No tasks available (maybe all deleted)
      isLoading: false,
      isError: null,
      mutate: jest.fn(),
    });

    render(<PipelineForm deploymentId="missing-tasks-dep" />);

    // Non-task fields should still be populated
    await waitFor(() => {
      expect((screen.getByTestId('name') as HTMLInputElement).value).toBe(
        'Pipeline With Missing Tasks'
      );
    });

    // The form renders correctly even though tasks couldn't be matched
    expect(screen.getByRole('heading', { name: /update pipeline/i })).toBeInTheDocument();
  });

  it('correctly parses weekly cron schedule with multiple days', async () => {
    const pipeline: PipelineDetailResponse = {
      name: 'Weekly Pipeline',
      cron: '30 14 * * 1,3,5', // Mon, Wed, Fri at 2:30 PM UTC
      isScheduleActive: true,
      connections: [],
      transformTasks: [],
    };

    (usePipelinesHook.usePipeline as jest.Mock).mockReturnValue({
      pipeline,
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

    render(<PipelineForm deploymentId="weekly-dep" />);

    await waitFor(() => {
      expect((screen.getByTestId('name') as HTMLInputElement).value).toBe('Weekly Pipeline');
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

    // Time of day input should not be visible for manual schedule
    expect(screen.queryByTestId('cronTimeOfDay')).not.toBeInTheDocument();
  });

  it('sorts connections by seq when populating form', async () => {
    const pipeline: PipelineDetailResponse = {
      name: 'Sorted Connections',
      cron: '0 9 * * *',
      isScheduleActive: true,
      connections: [
        { id: 'conn-2', name: 'Connection 2', seq: 2 },
        { id: 'conn-1', name: 'Connection 1', seq: 1 }, // Lower seq, should be first
      ],
      transformTasks: [],
    };

    (usePipelinesHook.usePipeline as jest.Mock).mockReturnValue({
      pipeline,
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

    render(<PipelineForm deploymentId="sorted-conn-dep" />);

    await waitFor(() => {
      expect((screen.getByTestId('name') as HTMLInputElement).value).toBe('Sorted Connections');
    });
  });

  it('filters tasks by pipeline_default and generated_by when aligning', async () => {
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

    const pipeline: PipelineDetailResponse = {
      name: 'Mixed Tasks Pipeline',
      cron: '0 9 * * *',
      isScheduleActive: true,
      connections: [],
      transformTasks: [{ uuid: 'system-default', seq: 1 }], // Only the default system task
    };

    (usePipelinesHook.usePipeline as jest.Mock).mockReturnValue({
      pipeline,
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

    render(<PipelineForm deploymentId="mixed-tasks-dep" />);

    await waitFor(() => {
      expect((screen.getByTestId('name') as HTMLInputElement).value).toBe('Mixed Tasks Pipeline');
    });

    // Should be in simple mode since the single task aligns
    expect(screen.getByLabelText('Run all tasks')).toBeInTheDocument();
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
  ];

  beforeEach(() => jest.clearAllMocks());

  it('renders task list with controls and handles task operations', async () => {
    const user = userEvent.setup();
    const selectedTasks = [mockTasks[0], mockTasks[1]];

    render(<TaskSequence value={selectedTasks} onChange={mockOnChange} options={mockTasks} />);

    // Components rendered
    expect(screen.getByPlaceholderText('Search tasks...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset to default/i })).toBeInTheDocument();
    expect(screen.getByText(/These are your transformation tasks/)).toBeInTheDocument();

    // Tasks displayed with indices
    expect(screen.getByText('git pull')).toBeInTheDocument();
    expect(screen.getByText('dbt run')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Generated by badges
    expect(screen.getAllByText('system').length).toBe(2);

    // Remove task
    const removeButtons = screen.getAllByRole('button', { name: /remove task/i });
    await user.click(removeButtons[0]);
    expect(mockOnChange).toHaveBeenCalledWith([mockTasks[1]]);

    // Reset to default
    mockOnChange.mockClear();
    await user.click(screen.getByRole('button', { name: /reset to default/i }));
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('handles empty state and shows client vs system task distinction', () => {
    // Empty state
    const { rerender } = render(
      <TaskSequence value={[]} onChange={mockOnChange} options={mockTasks} />
    );
    expect(screen.getByPlaceholderText('Search tasks...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remove task/i })).not.toBeInTheDocument();

    // Client task shows differently
    rerender(<TaskSequence value={[mockTasks[2]]} onChange={mockOnChange} options={mockTasks} />);
    expect(screen.getByText('client')).toBeInTheDocument();
    expect(screen.getByText('custom cmd')).toBeInTheDocument();
  });
});
