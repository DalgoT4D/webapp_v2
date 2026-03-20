/**
 * Pipeline Overview Components - Comprehensive Tests
 *
 * Tests for PipelineOverview and LogCard
 */

import React from 'react';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestWrapper } from '@/test-utils/render';
import { PipelineOverview } from '../pipeline-overview';
import { LogCard } from '@/components/pipeline/log-card';
import * as usePipelinesHook from '@/hooks/api/usePipelines';
import { DashboardPipeline, DashboardRun } from '@/types/pipeline';
import { PipelineRunDisplayStatus } from '@/constants/pipeline';

// ============ Mocks ============

jest.mock('@/hooks/api/usePipelines');
jest.mock('@/lib/toast', () => ({
  toastError: { load: jest.fn() },
}));

// Mock ECharts
jest.mock('echarts', () => ({
  init: jest.fn(() => ({
    setOption: jest.fn(),
    on: jest.fn(),
    dispose: jest.fn(),
    resize: jest.fn(),
  })),
}));

// Mock date-fns format for consistent test output
jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'),
  formatDistanceToNow: jest.fn(() => '5 minutes ago'),
  format: jest.fn((date, formatStr) => {
    if (formatStr === 'MMM d, yyyy HH:mm') return 'Jan 15, 2025 10:30';
    if (formatStr === 'yyyy-MM-dd HH:mm:ss') return '2025-01-15 10:30:00';
    return '2025-01-15';
  }),
}));

// ============ Test Data Factories ============

const createDashboardRun = (overrides: Partial<DashboardRun> = {}): DashboardRun => ({
  id: 'run-1',
  name: 'test-run',
  status: 'COMPLETED',
  state_name: 'Completed',
  startTime: '2025-01-15T10:30:00Z',
  totalRunTime: 120,
  ...overrides,
});

const createDashboardPipeline = (
  overrides: Partial<DashboardPipeline> = {}
): DashboardPipeline => ({
  id: 'pipeline-1',
  deploymentName: 'test-pipeline',
  name: 'Test Pipeline',
  status: 'active',
  lock: false,
  runs: [createDashboardRun()],
  lastRun: { startTime: '2025-01-15T10:30:00Z' },
  ...overrides,
});

// ============ PipelineOverview Tests ============

describe('PipelineOverview', () => {
  const mockMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (usePipelinesHook.usePipelineOverview as jest.Mock).mockReturnValue({
      pipelines: [],
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });
    (usePipelinesHook.fetchFlowRunLogs as jest.Mock).mockResolvedValue({
      logs: { logs: [] },
    });
  });

  it('renders loading skeleton, error state, and empty state correctly', () => {
    // Loading state
    (usePipelinesHook.usePipelineOverview as jest.Mock).mockReturnValue({
      pipelines: [],
      isLoading: true,
      isError: null,
      mutate: mockMutate,
    });

    const { unmount, container } = render(
      <TestWrapper>
        <PipelineOverview />
      </TestWrapper>
    );

    // Should show skeleton loader with animate-pulse
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    // Header should be a skeleton div, not the actual text
    expect(screen.queryByText('Pipeline Overview')).not.toBeInTheDocument();
    unmount();

    // Error state
    (usePipelinesHook.usePipelineOverview as jest.Mock).mockReturnValue({
      pipelines: [],
      isLoading: false,
      isError: new Error('Failed to fetch'),
      mutate: mockMutate,
    });

    const { unmount: unmount2 } = render(
      <TestWrapper>
        <PipelineOverview />
      </TestWrapper>
    );
    expect(screen.getByText('Failed to load pipelines')).toBeInTheDocument();
    expect(screen.getByText('Please try refreshing the page.')).toBeInTheDocument();
    unmount2();

    // Empty state (no pipelines)
    (usePipelinesHook.usePipelineOverview as jest.Mock).mockReturnValue({
      pipelines: [],
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });

    render(
      <TestWrapper>
        <PipelineOverview />
      </TestWrapper>
    );
    expect(screen.getByText('No pipelines available')).toBeInTheDocument();
    expect(
      screen.getByText('Create a pipeline in the Orchestrate section to see run history here.')
    ).toBeInTheDocument();
  });

  it('renders pipeline cards with run statistics, status icons, and scale toggle', async () => {
    const user = userEvent.setup();

    const pipelines: DashboardPipeline[] = [
      createDashboardPipeline({
        name: 'Success Pipeline',
        deploymentName: 'success-pipeline',
        runs: [
          createDashboardRun({ status: 'COMPLETED', state_name: 'Completed' }),
          createDashboardRun({ id: 'run-2', status: 'COMPLETED', state_name: 'Completed' }),
          createDashboardRun({ id: 'run-3', status: 'FAILED', state_name: 'Failed' }),
        ],
      }),
      createDashboardPipeline({
        id: 'pipeline-2',
        name: 'Running Pipeline',
        deploymentName: 'running-pipeline',
        lock: true, // Currently running
        runs: [createDashboardRun({ status: 'COMPLETED' })],
      }),
      createDashboardPipeline({
        id: 'pipeline-3',
        name: 'Failed Pipeline',
        deploymentName: 'failed-pipeline',
        runs: [createDashboardRun({ status: 'FAILED', state_name: 'Failed' })],
      }),
      createDashboardPipeline({
        id: 'pipeline-4',
        name: 'DBT Test Failed Pipeline',
        deploymentName: 'dbt-failed-pipeline',
        runs: [createDashboardRun({ status: 'COMPLETED', state_name: 'DBT_TEST_FAILED' })],
      }),
      createDashboardPipeline({
        id: 'pipeline-5',
        name: 'No Runs Pipeline',
        deploymentName: 'no-runs-pipeline',
        runs: [],
      }),
    ];

    (usePipelinesHook.usePipelineOverview as jest.Mock).mockReturnValue({
      pipelines,
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });

    render(
      <TestWrapper>
        <PipelineOverview />
      </TestWrapper>
    );

    // All pipeline names as headers
    expect(screen.getByText('Success Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Running Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Failed Pipeline')).toBeInTheDocument();
    expect(screen.getByText('DBT Test Failed Pipeline')).toBeInTheDocument();
    expect(screen.getByText('No Runs Pipeline')).toBeInTheDocument();

    // Success pipeline: 2/3 successful runs
    expect(screen.getByText('2/3 successful runs')).toBeInTheDocument();
    expect(screen.getByText('Last 3 runs')).toBeInTheDocument();
    // Multiple pipelines have "last run performed" text
    expect(screen.getAllByText(/last run performed 5 minutes ago/).length).toBeGreaterThan(0);

    // Running pipeline shows "Currently running"
    expect(screen.getByText('Currently running')).toBeInTheDocument();

    // Pipeline with no runs shows empty message
    expect(screen.getByText('No runs found for this pipeline')).toBeInTheDocument();

    // Scale to runtime checkbox - one per pipeline with runs (4 pipelines have runs)
    const scaleCheckboxes = screen.getAllByLabelText('Scale height to runtimes');
    expect(scaleCheckboxes.length).toBe(4);

    // All checkboxes should be checked by default
    scaleCheckboxes.forEach((checkbox) => {
      expect(checkbox).toBeChecked();
    });

    // Toggle scale for first pipeline
    await user.click(scaleCheckboxes[0]);
    expect(scaleCheckboxes[0]).not.toBeChecked();

    // Other checkboxes should still be checked (independent state)
    expect(scaleCheckboxes[1]).toBeChecked();
    expect(scaleCheckboxes[2]).toBeChecked();
    expect(scaleCheckboxes[3]).toBeChecked();

    // Toggle back
    await user.click(scaleCheckboxes[0]);
    expect(scaleCheckboxes[0]).toBeChecked();
  });
});

// ============ LogCard Tests ============

describe('LogCard', () => {
  it('handles all display states: loading, empty, with logs, and expanded/collapsed states', async () => {
    const user = userEvent.setup();
    const mockOnClose = jest.fn();
    const mockOnFetchMore = jest.fn();

    // Loading state with no logs yet
    const { unmount, rerender } = render(
      <LogCard logs={[]} isLoading={true} onClose={mockOnClose} title="Test Logs" />
    );

    expect(screen.getByText('Test Logs')).toBeInTheDocument();
    expect(screen.getByText('Loading logs...')).toBeInTheDocument();

    // Empty state after loading
    rerender(<LogCard logs={[]} isLoading={false} onClose={mockOnClose} title="Empty Logs" />);

    expect(screen.getByText('Empty Logs')).toBeInTheDocument();
    expect(screen.getByText('No logs available')).toBeInTheDocument();

    // With logs
    const sampleLogs = ['First log line', 'Second log line', 'Third log line'];
    rerender(
      <LogCard
        logs={sampleLogs}
        isLoading={false}
        hasMore={true}
        onFetchMore={mockOnFetchMore}
        onClose={mockOnClose}
        title="Pipeline Logs"
        status={PipelineRunDisplayStatus.SUCCESS}
      />
    );

    // Logs are displayed
    expect(screen.getByText('Pipeline Logs')).toBeInTheDocument();
    sampleLogs.forEach((log) => {
      expect(screen.getByText(log)).toBeInTheDocument();
    });

    // Fetch more button is visible
    const fetchMoreButton = screen.getByRole('button', { name: /fetch more/i });
    expect(fetchMoreButton).toBeInTheDocument();
    await user.click(fetchMoreButton);
    expect(mockOnFetchMore).toHaveBeenCalledTimes(1);

    // Collapse logs
    const collapseButton = screen.getByRole('button', { name: /collapse logs/i });
    await user.click(collapseButton);

    // Content should be hidden
    expect(screen.queryByText('First log line')).not.toBeInTheDocument();

    // Expand again
    const expandButton = screen.getByRole('button', { name: /expand logs/i });
    await user.click(expandButton);
    expect(screen.getByText('First log line')).toBeInTheDocument();

    // Close button works
    const closeButton = screen.getByRole('button', { name: /close logs/i });
    await user.click(closeButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('applies correct status-based styling for success, failed, and dbt_test_failed states', () => {
    const sampleLogs = ['Test log'];

    // Success status
    const { unmount, rerender, container } = render(
      <LogCard logs={sampleLogs} isLoading={false} status={PipelineRunDisplayStatus.SUCCESS} />
    );

    // Header should have success background color
    let header = container.querySelector('.bg-primary');
    expect(header).toBeInTheDocument();
    unmount();

    // Failed status
    const { unmount: unmount2, container: container2 } = render(
      <LogCard logs={sampleLogs} isLoading={false} status={PipelineRunDisplayStatus.FAILED} />
    );

    header = container2.querySelector('.bg-failed');
    expect(header).toBeInTheDocument();
    unmount2();

    // DBT test failed status (warning color)
    const { container: container3 } = render(
      <LogCard logs={sampleLogs} isLoading={false} status={PipelineRunDisplayStatus.WARNING} />
    );

    header = container3.querySelector('.bg-warning');
    expect(header).toBeInTheDocument();
  });

  it('shows loading state in fetch more button and handles disabled state correctly', async () => {
    const user = userEvent.setup();
    const mockOnFetchMore = jest.fn();

    // With hasMore and loading
    const { rerender } = render(
      <LogCard
        logs={['Log 1', 'Log 2']}
        isLoading={true}
        hasMore={true}
        onFetchMore={mockOnFetchMore}
      />
    );

    // Button should show "Loading..." and be disabled
    const loadingButton = screen.getByRole('button', { name: /loading/i });
    expect(loadingButton).toBeDisabled();

    // Without hasMore - no fetch more button
    rerender(
      <LogCard
        logs={['Log 1', 'Log 2']}
        isLoading={false}
        hasMore={false}
        onFetchMore={mockOnFetchMore}
      />
    );

    expect(screen.queryByRole('button', { name: /fetch more/i })).not.toBeInTheDocument();

    // With hasMore but no onFetchMore - no button
    rerender(<LogCard logs={['Log 1', 'Log 2']} isLoading={false} hasMore={true} />);

    expect(screen.queryByRole('button', { name: /fetch more/i })).not.toBeInTheDocument();
  });

  it('does not show close button when onClose is not provided', () => {
    render(<LogCard logs={['Test']} isLoading={false} />);

    expect(screen.queryByRole('button', { name: /close logs/i })).not.toBeInTheDocument();
    // Collapse button should still work
    expect(screen.getByRole('button', { name: /collapse logs/i })).toBeInTheDocument();
  });
});
