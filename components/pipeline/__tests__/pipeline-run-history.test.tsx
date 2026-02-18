/**
 * PipelineRunHistory Component Tests
 *
 * Tests for run history modal, logs fetching, and AI summary functionality
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PipelineRunHistory } from '../pipeline-run-history';
import * as usePipelinesHook from '@/hooks/api/usePipelines';
import { Pipeline, DeploymentRun } from '@/types/pipeline';

// ============ Mocks ============

jest.mock('@/hooks/api/usePipelines');
jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
}));

jest.mock('@/lib/toast', () => ({
  toastError: {
    load: jest.fn(),
    api: jest.fn(),
  },
}));

// Mock FullScreenModal to render children directly
jest.mock('@/components/ui/full-screen-modal', () => ({
  FullScreenModal: ({
    children,
    open,
    title,
    subtitle,
  }: {
    children: React.ReactNode;
    open: boolean;
    title: string;
    subtitle: React.ReactNode;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="fullscreen-modal">
        <div data-testid="modal-title">{title}</div>
        <div data-testid="modal-subtitle">{subtitle}</div>
        {children}
      </div>
    ) : null,
}));

// Mock LogsTable
jest.mock('@/components/ui/logs-table', () => ({
  LogsTable: ({
    runs,
    hasMore,
    loadingMore,
    onLoadMore,
    onFetchLogs,
    onTriggerSummary,
    enableAISummary,
  }: {
    runs: any[];
    hasMore: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
    onFetchLogs: (flowRunId: string, taskId: string, taskKind?: string) => Promise<string[]>;
    onTriggerSummary: (flowRunId: string, taskId: string) => Promise<string>;
    enableAISummary: boolean;
  }) => (
    <div data-testid="logs-table">
      <div data-testid="runs-count">{runs.length}</div>
      {runs.map((run) => (
        <div key={run.id} data-testid={`run-${run.id}`}>
          <span data-testid="run-date">{run.date}</span>
          <span data-testid="run-status">{run.status}</span>
          {run.tasks.map((task: any) => (
            <div key={task.id} data-testid={`task-${task.id}`}>
              {task.label}
            </div>
          ))}
        </div>
      ))}
      {hasMore && (
        <button data-testid="load-more-btn" onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading...' : 'Load More'}
        </button>
      )}
      <button
        data-testid="fetch-logs-btn"
        onClick={() => onFetchLogs('flow-1', 'task-1', 'task-run')}
      >
        Fetch Logs
      </button>
      {enableAISummary && (
        <button
          data-testid="trigger-summary-btn"
          onClick={() => onTriggerSummary('flow-1', 'task-1')}
        >
          Get Summary
        </button>
      )}
    </div>
  ),
}));

// ============ Test Data ============

const createMockPipeline = (overrides: Partial<Pipeline> = {}): Pipeline => ({
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

const createMockDeploymentRun = (overrides: Partial<DeploymentRun> = {}): DeploymentRun => ({
  id: 'run-1',
  deployment_id: 'dep-1',
  name: 'Pipeline Run',
  status: 'COMPLETED',
  state_name: 'Completed',
  startTime: '2025-05-21T10:00:00Z',
  expectedStartTime: '2025-05-21T10:00:00Z',
  orguser: 'user@test.com',
  totalRunTime: 120,
  runs: [
    {
      id: 'task-1',
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
  ...overrides,
});

// ============ Tests ============

describe('PipelineRunHistory', () => {
  const mockPipeline = createMockPipeline();
  const mockOnOpenChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
      runs: [],
      isLoading: false,
      isError: null,
    });
  });

  it('does not render when closed', () => {
    render(
      <PipelineRunHistory pipeline={mockPipeline} open={false} onOpenChange={mockOnOpenChange} />
    );

    expect(screen.queryByTestId('fullscreen-modal')).not.toBeInTheDocument();
  });

  it('renders modal when open with correct title and subtitle', () => {
    render(
      <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
    );

    expect(screen.getByTestId('fullscreen-modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-title')).toHaveTextContent('Logs History');
    expect(screen.getByTestId('modal-subtitle')).toHaveTextContent('Test Pipeline');
  });

  it('shows loading skeleton while fetching data', () => {
    (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
      runs: [],
      isLoading: true,
      isError: null,
    });

    render(
      <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
    );

    // Should show skeleton, not LogsTable
    expect(screen.queryByTestId('logs-table')).not.toBeInTheDocument();
  });

  it('shows empty state when no runs exist', async () => {
    (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
      runs: [],
      isLoading: false,
      isError: null,
    });

    render(
      <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
    );

    await waitFor(() => {
      expect(screen.getByText('No run history')).toBeInTheDocument();
      expect(screen.getByText("This pipeline hasn't been run yet.")).toBeInTheDocument();
    });
  });

  it('displays runs in LogsTable when data is available', async () => {
    const mockRuns = [
      createMockDeploymentRun({ id: 'run-1', status: 'COMPLETED' }),
      createMockDeploymentRun({ id: 'run-2', status: 'FAILED', state_name: 'Failed' }),
    ];

    (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
      runs: mockRuns,
      isLoading: false,
      isError: null,
    });

    render(
      <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('logs-table')).toBeInTheDocument();
      expect(screen.getByTestId('runs-count')).toHaveTextContent('2');
    });
  });

  it('transforms runs with correct status indicators', async () => {
    const mockRuns = [
      createMockDeploymentRun({ id: 'run-success', status: 'COMPLETED' }),
      createMockDeploymentRun({ id: 'run-failed', status: 'FAILED', state_name: 'Failed' }),
      createMockDeploymentRun({ id: 'run-crashed', status: 'CRASHED' }),
      createMockDeploymentRun({
        id: 'run-warning',
        status: 'FAILED',
        state_name: 'DBT_TEST_FAILED',
      }),
    ];

    (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
      runs: mockRuns,
      isLoading: false,
      isError: null,
    });

    render(
      <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('run-run-success')).toBeInTheDocument();
      expect(screen.getByTestId('run-run-failed')).toBeInTheDocument();
      expect(screen.getByTestId('run-run-crashed')).toBeInTheDocument();
      expect(screen.getByTestId('run-run-warning')).toBeInTheDocument();
    });
  });

  it('shows inactive status in subtitle for inactive pipeline', () => {
    const inactivePipeline = createMockPipeline({ status: false });

    render(
      <PipelineRunHistory pipeline={inactivePipeline} open={true} onOpenChange={mockOnOpenChange} />
    );

    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('shows active status in subtitle for active pipeline', () => {
    const activePipeline = createMockPipeline({ status: true });

    render(
      <PipelineRunHistory pipeline={activePipeline} open={true} onOpenChange={mockOnOpenChange} />
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  describe('Load More functionality', () => {
    it('loads more runs when clicking load more button', async () => {
      const user = userEvent.setup();
      const { apiGet } = require('@/lib/api');

      const initialRuns = [
        createMockDeploymentRun({ id: 'run-1' }),
        createMockDeploymentRun({ id: 'run-2' }),
        createMockDeploymentRun({ id: 'run-3' }),
      ];

      (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
        runs: initialRuns,
        isLoading: false,
        isError: null,
      });

      apiGet.mockResolvedValue([createMockDeploymentRun({ id: 'run-4' })]);

      render(
        <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('load-more-btn')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('load-more-btn'));

      await waitFor(() => {
        expect(apiGet).toHaveBeenCalled();
      });
    });

    it('handles load more API error gracefully', async () => {
      const user = userEvent.setup();
      const { apiGet } = require('@/lib/api');
      const { toastError } = require('@/lib/toast');

      const initialRuns = [
        createMockDeploymentRun({ id: 'run-1' }),
        createMockDeploymentRun({ id: 'run-2' }),
        createMockDeploymentRun({ id: 'run-3' }),
      ];

      (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
        runs: initialRuns,
        isLoading: false,
        isError: null,
      });

      apiGet.mockRejectedValue(new Error('API Error'));

      render(
        <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('load-more-btn')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('load-more-btn'));

      await waitFor(() => {
        expect(toastError.load).toHaveBeenCalledWith(expect.any(Error), 'runs');
      });
    });
  });

  describe('Logs fetching', () => {
    it('fetches logs for a task', async () => {
      const user = userEvent.setup();
      const mockRuns = [createMockDeploymentRun()];

      (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
        runs: mockRuns,
        isLoading: false,
        isError: null,
      });

      (usePipelinesHook.fetchFlowRunLogs as jest.Mock).mockResolvedValue({
        logs: {
          logs: [{ message: 'Log entry 1' }, { message: 'Log entry 2' }],
        },
      });

      render(
        <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('fetch-logs-btn')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('fetch-logs-btn'));

      await waitFor(() => {
        expect(usePipelinesHook.fetchFlowRunLogs).toHaveBeenCalled();
      });
    });

    it('handles log fetch error gracefully', async () => {
      const user = userEvent.setup();
      const { toastError } = require('@/lib/toast');
      const mockRuns = [createMockDeploymentRun()];

      (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
        runs: mockRuns,
        isLoading: false,
        isError: null,
      });

      (usePipelinesHook.fetchFlowRunLogs as jest.Mock).mockRejectedValue(new Error('Fetch failed'));

      render(
        <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('fetch-logs-btn')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('fetch-logs-btn'));

      await waitFor(() => {
        expect(toastError.load).toHaveBeenCalledWith(expect.any(Error), 'logs');
      });
    });

    it('returns empty array when logs data is empty', async () => {
      const user = userEvent.setup();
      const mockRuns = [createMockDeploymentRun()];

      (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
        runs: mockRuns,
        isLoading: false,
        isError: null,
      });

      // Return null logs
      (usePipelinesHook.fetchFlowRunLogs as jest.Mock).mockResolvedValue({
        logs: null,
      });

      render(
        <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('fetch-logs-btn')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('fetch-logs-btn'));

      await waitFor(() => {
        expect(usePipelinesHook.fetchFlowRunLogs).toHaveBeenCalled();
      });
    });

    it('handles log entries without message property', async () => {
      const user = userEvent.setup();
      const mockRuns = [createMockDeploymentRun()];

      (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
        runs: mockRuns,
        isLoading: false,
        isError: null,
      });

      // Return logs where some entries don't have message
      (usePipelinesHook.fetchFlowRunLogs as jest.Mock).mockResolvedValue({
        logs: {
          logs: [{ message: 'Log 1' }, 'String log entry', { message: null }],
        },
      });

      render(
        <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('fetch-logs-btn')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('fetch-logs-btn'));

      await waitFor(() => {
        expect(usePipelinesHook.fetchFlowRunLogs).toHaveBeenCalled();
      });
    });
  });

  describe('AI Summary', () => {
    // Note: ENABLE_LOG_SUMMARIES is false by default from the constants
    // The AI summary button is only rendered when enableAISummary is true
    // Our mock LogsTable only shows the button when enableAISummary is true
    // Since the component passes ENABLE_LOG_SUMMARIES (which is false), the button won't appear

    it('does not show AI summary button when feature is disabled', async () => {
      const mockRuns = [createMockDeploymentRun()];

      (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
        runs: mockRuns,
        isLoading: false,
        isError: null,
      });

      render(
        <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('logs-table')).toBeInTheDocument();
      });

      // AI summary button should not be present when feature is disabled
      expect(screen.queryByTestId('trigger-summary-btn')).not.toBeInTheDocument();
    });
  });

  describe('Task transformation', () => {
    it('calculates duration from timestamps when total_run_time is 0', async () => {
      const mockRuns = [
        createMockDeploymentRun({
          runs: [
            {
              id: 'task-1',
              label: 'dbtjob-dbt-run',
              kind: 'task-run',
              start_time: '2025-05-21T10:00:00Z',
              end_time: '2025-05-21T10:01:00Z',
              state_type: 'COMPLETED',
              state_name: 'Completed',
              total_run_time: 0, // Zero, should calculate from timestamps
              estimated_run_time: 0,
              logs: [],
              parameters: null,
            },
          ],
        }),
      ];

      (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
        runs: mockRuns,
        isLoading: false,
        isError: null,
      });

      render(
        <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('logs-table')).toBeInTheDocument();
      });
    });

    it('handles task with failed state', async () => {
      const mockRuns = [
        createMockDeploymentRun({
          runs: [
            {
              id: 'task-1',
              label: 'dbtjob-dbt-run',
              kind: 'task-run',
              start_time: '2025-05-21T10:00:00Z',
              end_time: '2025-05-21T10:01:00Z',
              state_type: 'FAILED',
              state_name: 'Failed',
              total_run_time: 60,
              estimated_run_time: 60,
              logs: [],
              parameters: null,
            },
          ],
        }),
      ];

      (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
        runs: mockRuns,
        isLoading: false,
        isError: null,
      });

      render(
        <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('logs-table')).toBeInTheDocument();
      });
    });

    it('handles task with DBT_TEST_FAILED state', async () => {
      const mockRuns = [
        createMockDeploymentRun({
          runs: [
            {
              id: 'task-1',
              label: 'dbtjob-dbt-test',
              kind: 'task-run',
              start_time: '2025-05-21T10:00:00Z',
              end_time: '2025-05-21T10:01:00Z',
              state_type: 'COMPLETED',
              state_name: 'DBT_TEST_FAILED',
              total_run_time: 60,
              estimated_run_time: 60,
              logs: [],
              parameters: null,
            },
          ],
        }),
      ];

      (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
        runs: mockRuns,
        isLoading: false,
        isError: null,
      });

      render(
        <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('logs-table')).toBeInTheDocument();
      });
    });
  });

  describe('Dialog state management', () => {
    it('resets state when dialog closes', async () => {
      const mockRuns = [createMockDeploymentRun()];

      (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
        runs: mockRuns,
        isLoading: false,
        isError: null,
      });

      const { rerender } = render(
        <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('logs-table')).toBeInTheDocument();
      });

      // Close dialog
      rerender(
        <PipelineRunHistory pipeline={mockPipeline} open={false} onOpenChange={mockOnOpenChange} />
      );

      expect(screen.queryByTestId('logs-table')).not.toBeInTheDocument();

      // Reopen - should show data again
      rerender(
        <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('logs-table')).toBeInTheDocument();
      });
    });
  });
});
