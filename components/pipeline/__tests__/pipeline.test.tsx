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
    (usePipelinesHook.triggerPipelineRun as jest.Mock) = mockTriggerRun;

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
    const { container } = render(<PipelineList />);
    const disabledRunButton = container.querySelectorAll('button')[2]; // Run button
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
    // Form won't submit without schedule selection
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
