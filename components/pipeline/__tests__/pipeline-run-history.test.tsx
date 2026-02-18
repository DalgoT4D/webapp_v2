/**
 * PipelineRunHistory Component Tests (Consolidated)
 *
 * Tests for run history modal, logs fetching, and AI summary functionality
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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

  it('handles closed, open, loading, and empty states with correct title and activity status', async () => {
    // Closed state
    const { rerender } = render(
      <PipelineRunHistory pipeline={mockPipeline} open={false} onOpenChange={mockOnOpenChange} />
    );
    expect(screen.queryByTestId('fullscreen-modal')).not.toBeInTheDocument();

    // Open state with title and subtitle
    rerender(
      <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
    );
    expect(screen.getByTestId('fullscreen-modal')).toBeInTheDocument();
    expect(screen.getByTestId('modal-title')).toHaveTextContent('Logs History');
    expect(screen.getByTestId('modal-subtitle')).toHaveTextContent('Test Pipeline');
    expect(screen.getByText('Active')).toBeInTheDocument();

    // Inactive pipeline shows Inactive
    const inactivePipeline = createMockPipeline({ status: false });
    rerender(
      <PipelineRunHistory pipeline={inactivePipeline} open={true} onOpenChange={mockOnOpenChange} />
    );
    expect(screen.getByText('Inactive')).toBeInTheDocument();

    // Loading state
    (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
      runs: [],
      isLoading: true,
      isError: null,
    });
    rerender(
      <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
    );
    expect(screen.queryByTestId('logs-table')).not.toBeInTheDocument();

    // Empty state (no runs, not loading)
    (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
      runs: [],
      isLoading: false,
      isError: null,
    });
    rerender(
      <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
    );
    await waitFor(() => {
      expect(screen.getByText('No run history')).toBeInTheDocument();
      expect(screen.getByText("This pipeline hasn't been run yet.")).toBeInTheDocument();
    });
  });

  it('displays runs with all status indicators and handles various task states', async () => {
    const mockRuns = [
      createMockDeploymentRun({ id: 'run-success', status: 'COMPLETED' }),
      createMockDeploymentRun({ id: 'run-failed', status: 'FAILED', state_name: 'Failed' }),
      createMockDeploymentRun({ id: 'run-crashed', status: 'CRASHED' }),
      createMockDeploymentRun({
        id: 'run-warning',
        status: 'FAILED',
        state_name: 'DBT_TEST_FAILED',
      }),
      createMockDeploymentRun({
        id: 'run-zero-time',
        runs: [
          {
            id: 'task-1',
            label: 'dbtjob-dbt-run',
            kind: 'task-run',
            start_time: '2025-05-21T10:00:00Z',
            end_time: '2025-05-21T10:01:00Z',
            state_type: 'COMPLETED',
            state_name: 'Completed',
            total_run_time: 0,
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
      expect(screen.getByTestId('runs-count')).toHaveTextContent('5');
      expect(screen.getByTestId('run-run-success')).toBeInTheDocument();
      expect(screen.getByTestId('run-run-failed')).toBeInTheDocument();
      expect(screen.getByTestId('run-run-crashed')).toBeInTheDocument();
      expect(screen.getByTestId('run-run-warning')).toBeInTheDocument();
      expect(screen.getByTestId('run-run-zero-time')).toBeInTheDocument();
    });
  });

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

  it('fetches logs with various response formats and handles errors', async () => {
    const user = userEvent.setup();
    const { toastError } = require('@/lib/toast');
    const mockRuns = [createMockDeploymentRun()];

    (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
      runs: mockRuns,
      isLoading: false,
      isError: null,
    });

    // Success with logs
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

    // Null logs response
    (usePipelinesHook.fetchFlowRunLogs as jest.Mock).mockResolvedValue({ logs: null });
    await user.click(screen.getByTestId('fetch-logs-btn'));
    await waitFor(() => {
      expect(usePipelinesHook.fetchFlowRunLogs).toHaveBeenCalledTimes(2);
    });

    // Error case
    (usePipelinesHook.fetchFlowRunLogs as jest.Mock).mockRejectedValue(new Error('Fetch failed'));
    await user.click(screen.getByTestId('fetch-logs-btn'));
    await waitFor(() => {
      expect(toastError.load).toHaveBeenCalledWith(expect.any(Error), 'logs');
    });
  });

  it('hides AI summary when disabled and manages dialog close/reopen state', async () => {
    const mockRuns = [createMockDeploymentRun()];

    (usePipelinesHook.usePipelineHistory as jest.Mock).mockReturnValue({
      runs: mockRuns,
      isLoading: false,
      isError: null,
    });

    // AI summary disabled
    const { rerender } = render(
      <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('logs-table')).toBeInTheDocument();
    });
    if (process.env.NEXT_PUBLIC_ENABLE_LOG_SUMMARIES === 'true') {
      expect(screen.queryByTestId('trigger-summary-btn')).toBeInTheDocument();
    } else {
      expect(screen.queryByTestId('trigger-summary-btn')).not.toBeInTheDocument();
    }

    // Dialog close/reopen
    rerender(
      <PipelineRunHistory pipeline={mockPipeline} open={false} onOpenChange={mockOnOpenChange} />
    );
    expect(screen.queryByTestId('logs-table')).not.toBeInTheDocument();

    rerender(
      <PipelineRunHistory pipeline={mockPipeline} open={true} onOpenChange={mockOnOpenChange} />
    );
    await waitFor(() => {
      expect(screen.getByTestId('logs-table')).toBeInTheDocument();
    });
  });
});
