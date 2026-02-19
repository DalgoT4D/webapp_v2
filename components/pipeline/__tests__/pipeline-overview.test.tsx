/**
 * Pipeline Overview Components - Comprehensive Tests
 *
 * Tests for PipelineOverview, LogCard, LogSummaryCard, and LogSummaryBlock
 */

import React from 'react';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PipelineOverview } from '../pipeline-overview';
import { LogCard } from '../log-card';
import { LogSummaryCard, type LogSummary } from '../log-summary-card';
import { LogSummaryBlock } from '../log-summary-block';
import * as usePipelinesHook from '@/hooks/api/usePipelines';
import { DashboardPipeline, DashboardRun } from '@/types/pipeline';

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

const createLogSummary = (overrides: Partial<LogSummary> = {}): LogSummary => ({
  task_name: 'dbt run',
  status: 'success',
  pattern: 'Running dbt...',
  log_lines: ['Line 1', 'Line 2', 'Line 3'],
  passed: 10,
  errors: 0,
  skipped: 2,
  warnings: 1,
  tests: [],
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
    (usePipelinesHook.fetchFlowRunLogSummary as jest.Mock).mockResolvedValue([]);
  });

  it('renders loading skeleton, error state, and empty state correctly', () => {
    // Loading state
    (usePipelinesHook.usePipelineOverview as jest.Mock).mockReturnValue({
      pipelines: [],
      isLoading: true,
      isError: null,
      mutate: mockMutate,
    });

    const { unmount, container } = render(<PipelineOverview />);

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

    const { unmount: unmount2 } = render(<PipelineOverview />);
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

    render(<PipelineOverview />);
    expect(screen.getByText('Pipeline Overview')).toBeInTheDocument();
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

    render(<PipelineOverview />);

    // Header rendered
    expect(screen.getByText('Pipeline Overview')).toBeInTheDocument();

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
        status="success"
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
      <LogCard logs={sampleLogs} isLoading={false} status="success" />
    );

    // Header should have success background color
    let header = container.querySelector('.bg-\\[\\#00897B\\]');
    expect(header).toBeInTheDocument();
    unmount();

    // Failed status
    const { unmount: unmount2, container: container2 } = render(
      <LogCard logs={sampleLogs} isLoading={false} status="failed" />
    );

    header = container2.querySelector('.bg-\\[\\#C15E5E\\]');
    expect(header).toBeInTheDocument();
    unmount2();

    // DBT test failed status (warning color)
    const { container: container3 } = render(
      <LogCard logs={sampleLogs} isLoading={false} status="dbt_test_failed" />
    );

    header = container3.querySelector('.bg-\\[\\#df8e14\\]');
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

// ============ LogSummaryCard Tests ============

describe('LogSummaryCard', () => {
  it('renders all log summaries with correct task names and allows clicking logs button', async () => {
    const user = userEvent.setup();
    const mockSetLogs = jest.fn();

    const summaries: LogSummary[] = [
      createLogSummary({
        task_name: 'git pull',
        status: 'success',
        pattern: 'Pulling from origin...',
        log_lines: ['Cloning repo', 'Pull complete'],
      }),
      createLogSummary({
        task_name: 'dbt run',
        status: 'success',
        passed: 15,
        errors: 0,
        skipped: 3,
        warnings: 2,
        log_lines: ['Running models', 'Models complete'],
      }),
      createLogSummary({
        task_name: 'dbt test',
        status: 'failed',
        tests: [
          {
            pattern: 'test-summary',
            passed: 8,
            errors: 4,
            skipped: 1,
            warnings: 0,
          },
        ],
        log_lines: ['Running tests', 'Test failed: unique_check'],
      }),
      createLogSummary({
        task_name: 'sync connections',
        status: 'success',
        pattern: 'Syncing data...',
        log_lines: ['Sync started', 'Sync complete'],
      }),
    ];

    render(<LogSummaryCard logsummary={summaries} setLogsummaryLogs={mockSetLogs} />);

    // All task names are rendered
    expect(screen.getByText('git pull')).toBeInTheDocument();
    expect(screen.getByText('dbt run')).toBeInTheDocument();
    expect(screen.getByText('dbt test')).toBeInTheDocument();
    expect(screen.getByText('sync connections')).toBeInTheDocument();

    // Pattern shown for non-special tasks
    expect(screen.getByText('Pulling from origin...')).toBeInTheDocument();
    expect(screen.getByText('Syncing data...')).toBeInTheDocument();

    // DBT run stats
    expect(screen.getByText('15')).toBeInTheDocument(); // passed

    // DBT test stats (from test-summary) - use unique values
    expect(screen.getByText('8')).toBeInTheDocument(); // passed from test-summary
    expect(screen.getByText('4')).toBeInTheDocument(); // errors from test-summary

    // Click Logs button for each summary
    const logsButtons = screen.getAllByRole('button', { name: /logs/i });
    expect(logsButtons.length).toBe(4);

    // Click first logs button (git pull)
    await user.click(logsButtons[0]);
    expect(mockSetLogs).toHaveBeenCalledWith(['Cloning repo', 'Pull complete']);

    // Click second logs button (dbt run)
    await user.click(logsButtons[1]);
    expect(mockSetLogs).toHaveBeenCalledWith(['Running models', 'Models complete']);

    // Click third logs button (dbt test)
    await user.click(logsButtons[2]);
    expect(mockSetLogs).toHaveBeenCalledWith(['Running tests', 'Test failed: unique_check']);
  });
});

// ============ LogSummaryBlock Tests ============

describe('LogSummaryBlock', () => {
  const mockSetLogs = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders NameAndPatternBlock for regular success and failed tasks with correct border colors', async () => {
    const user = userEvent.setup();

    // Test 1: Regular success task (NameAndPatternBlock)
    const regularSuccessTask = createLogSummary({
      task_name: 'git pull',
      status: 'success',
      pattern: 'Pulling from main branch',
      log_lines: ['Log 1', 'Log 2'],
    });

    const { unmount, container } = render(
      <LogSummaryBlock logsummary={regularSuccessTask} setLogsummaryLogs={mockSetLogs} />
    );

    expect(screen.getByText('git pull')).toBeInTheDocument();
    expect(screen.getByText('Pulling from main branch')).toBeInTheDocument();
    // Success border color
    expect(container.querySelector('.border-\\[\\#00897B\\]')).toBeInTheDocument();

    const logsButton = screen.getByRole('button', { name: /logs/i });
    await user.click(logsButton);
    expect(mockSetLogs).toHaveBeenCalledWith(['Log 1', 'Log 2']);
    unmount();

    // Test 2: Regular failed task (NameAndPatternBlock with red border)
    const regularFailedTask = createLogSummary({
      task_name: 'sync',
      status: 'failed',
      pattern: 'Sync failed',
      log_lines: ['Error occurred'],
    });

    const { unmount: unmount2, container: container2 } = render(
      <LogSummaryBlock logsummary={regularFailedTask} setLogsummaryLogs={mockSetLogs} />
    );

    expect(screen.getByText('sync')).toBeInTheDocument();
    expect(screen.getByText('Sync failed')).toBeInTheDocument();
    // Failed border color
    expect(container2.querySelector('.border-\\[\\#C15E5E\\]')).toBeInTheDocument();
    unmount2();
  });

  it('renders DbtRunBlock with stats for successful dbt run tasks', () => {
    const dbtRunSuccess = createLogSummary({
      task_name: 'dbt run',
      status: 'success',
      passed: 25,
      errors: 1,
      skipped: 5,
      warnings: 3,
      log_lines: ['DBT run complete'],
    });

    const { unmount } = render(
      <LogSummaryBlock logsummary={dbtRunSuccess} setLogsummaryLogs={mockSetLogs} />
    );

    expect(screen.getByText('dbt run')).toBeInTheDocument();
    // Stats are displayed
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('passed')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('errors')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('skipped')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('warnings')).toBeInTheDocument();
    unmount();
  });

  it('renders DbtTestBlock with test-summary stats for failed dbt test tasks', () => {
    const dbtTestFailed = createLogSummary({
      task_name: 'dbt test',
      status: 'failed',
      tests: [
        {
          pattern: 'test-summary',
          passed: 10,
          errors: 3,
          skipped: 2,
          warnings: 1,
        },
        {
          pattern: 'other-test',
          passed: 5,
          errors: 0,
          skipped: 0,
          warnings: 0,
        },
      ],
      log_lines: ['Test failures'],
    });

    const { unmount, container } = render(
      <LogSummaryBlock logsummary={dbtTestFailed} setLogsummaryLogs={mockSetLogs} />
    );

    expect(screen.getByText('dbt test')).toBeInTheDocument();
    // Stats from test-summary pattern
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // errors
    expect(screen.getByText('2')).toBeInTheDocument(); // skipped
    // Failed border color
    expect(container.querySelector('.border-\\[\\#C15E5E\\]')).toBeInTheDocument();
    unmount();
  });

  it('renders empty container when dbt test failed has no test-summary pattern', () => {
    // When dbt test fails without test-summary, DbtTestBlock returns null
    // and since useSpecialHandling is true, NameAndPatternBlock won't render either
    const dbtTestNoSummary = createLogSummary({
      task_name: 'dbt test',
      status: 'failed',
      tests: [
        {
          pattern: 'not-test-summary',
          passed: 5,
          errors: 2,
          skipped: 0,
          warnings: 0,
        },
      ],
      log_lines: ['No summary'],
    });

    const { container, unmount } = render(
      <LogSummaryBlock logsummary={dbtTestNoSummary} setLogsummaryLogs={mockSetLogs} />
    );

    // Container exists with border
    expect(container.querySelector('.border-\\[\\#C15E5E\\]')).toBeInTheDocument();
    // No logs button because DbtTestBlock returned null
    expect(screen.queryByRole('button', { name: /logs/i })).not.toBeInTheDocument();
    unmount();
  });

  it('uses NameAndPatternBlock for failed dbt run tasks (not DbtRunBlock)', () => {
    // DbtRunBlock is only for successful dbt run, failed dbt run uses NameAndPatternBlock
    const dbtRunFailed = createLogSummary({
      task_name: 'dbt run',
      status: 'failed',
      passed: 10,
      errors: 5,
      skipped: 0,
      warnings: 0,
      pattern: 'DBT run failed',
      log_lines: ['Failed'],
    });

    const { unmount } = render(
      <LogSummaryBlock logsummary={dbtRunFailed} setLogsummaryLogs={mockSetLogs} />
    );

    // Should use NameAndPatternBlock since it's not success
    expect(screen.getByText('dbt run')).toBeInTheDocument();
    expect(screen.getByText('DBT run failed')).toBeInTheDocument();
    // Should NOT show stats (NameAndPatternBlock doesn't show them)
    expect(screen.queryByText('passed')).not.toBeInTheDocument();
    unmount();
  });

  it('handles edge cases: missing pattern, zero values in stats', () => {
    // Task without pattern
    const noPatternTask = createLogSummary({
      task_name: 'custom task',
      status: 'success',
      pattern: undefined,
      log_lines: ['Log'],
    });

    const { unmount } = render(
      <LogSummaryBlock logsummary={noPatternTask} setLogsummaryLogs={mockSetLogs} />
    );

    expect(screen.getByText('custom task')).toBeInTheDocument();
    // No pattern paragraph should be rendered
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
    unmount();

    // DBT run with zero values
    const zeroValuesTask = createLogSummary({
      task_name: 'dbt run',
      status: 'success',
      passed: 0,
      errors: 0,
      skipped: 0,
      warnings: 0,
      log_lines: [],
    });

    const { unmount: unmount2 } = render(
      <LogSummaryBlock logsummary={zeroValuesTask} setLogsummaryLogs={mockSetLogs} />
    );

    // Should show 0 for all stats
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBe(4); // passed, errors, skipped, warnings
    unmount2();
  });
});
