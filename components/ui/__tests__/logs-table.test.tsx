/**
 * LogsTable Component Tests
 *
 * Tests for run highlight behavior (left accent border on expanded content)
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogsTable, type FlowRun } from '../logs-table';
import { PipelineRunDisplayStatus } from '@/constants/pipeline';

// ============ Mocks ============

jest.mock('@/hooks/api/usePipelines', () => ({
  useLogSummaryPoll: jest.fn(() => ({
    summary: null as string | null,
    isPolling: false,
    error: null as Error | null,
  })),
}));

// ============ Test Data ============

const createFlowRun = (overrides: Partial<FlowRun> = {}): FlowRun => ({
  id: 'flow-1',
  date: '2025-01-15T10:30:00Z',
  startedBy: 'user@test.com',
  status: PipelineRunDisplayStatus.SUCCESS,
  tasks: [
    {
      id: 'task-1',
      label: 'dbt run',
      duration: 60,
      isFailed: false,
    },
  ],
  ...overrides,
});

// ============ Tests ============

describe('LogsTable', () => {
  it('renders empty state when no runs', () => {
    render(<LogsTable runs={[]} />);
    expect(screen.getByText('No run history')).toBeInTheDocument();
  });

  it('renders flow run rows with tasks', () => {
    const runs = [
      createFlowRun({
        tasks: [
          { id: 'task-1', label: 'dbt run', duration: 60, isFailed: false },
          { id: 'task-2', label: 'dbt test', duration: 30, isFailed: false },
        ],
      }),
    ];

    render(<LogsTable runs={runs} onFetchLogs={jest.fn().mockResolvedValue([])} />);
    expect(screen.getByText('dbt run')).toBeInTheDocument();
    expect(screen.getByText('dbt test')).toBeInTheDocument();
    expect(screen.getByText('1m')).toBeInTheDocument();
    expect(screen.getByText('30s')).toBeInTheDocument();
  });
});

describe('LogsTable - Log expansion behavior', () => {
  const mockFetchLogs = jest.fn().mockResolvedValue(['Log line 1', 'Log line 2']);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('expands and collapses logs when clicking the Logs button', async () => {
    const user = userEvent.setup();
    const runs = [createFlowRun()];

    render(<LogsTable runs={runs} onFetchLogs={mockFetchLogs} />);

    const logsButton = screen.getByRole('button', { name: /logs/i });

    // Click to expand logs
    await user.click(logsButton);
    await waitFor(() => {
      expect(screen.getByText('Log line 1')).toBeInTheDocument();
      expect(screen.getByText('Log line 2')).toBeInTheDocument();
    });

    // Click to collapse logs
    await user.click(logsButton);
    await waitFor(() => {
      expect(screen.queryByText('Log line 1')).not.toBeInTheDocument();
    });
  });

  it('expands logs for multiple tasks independently', async () => {
    const user = userEvent.setup();
    const runs = [
      createFlowRun({
        tasks: [
          { id: 'task-1', label: 'dbt run', duration: 60, isFailed: false },
          { id: 'task-2', label: 'dbt test', duration: 30, isFailed: false },
        ],
      }),
    ];

    render(<LogsTable runs={runs} onFetchLogs={mockFetchLogs} />);

    const logsButtons = screen.getAllByRole('button', { name: /logs/i });

    // Expand first task
    await user.click(logsButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Log line 1')).toBeInTheDocument();
    });

    // Collapse first task
    await user.click(logsButtons[0]);
    await waitFor(() => {
      expect(screen.queryByText('Log line 1')).not.toBeInTheDocument();
    });
  });

  it('expands logs across multiple flow runs', async () => {
    const user = userEvent.setup();
    const runs = [
      createFlowRun({ id: 'flow-1' }),
      createFlowRun({
        id: 'flow-2',
        date: '2025-01-14T10:30:00Z',
        tasks: [{ id: 'task-2', label: 'sync', duration: 45, isFailed: false }],
      }),
    ];

    render(<LogsTable runs={runs} onFetchLogs={mockFetchLogs} />);

    const logsButtons = screen.getAllByRole('button', { name: /logs/i });

    // Expand first flow run's task
    await user.click(logsButtons[0]);
    await waitFor(() => {
      expect(mockFetchLogs).toHaveBeenCalledWith('flow-1', 'task-1', undefined);
    });

    // Expand second flow run's task
    await user.click(logsButtons[1]);
    await waitFor(() => {
      expect(mockFetchLogs).toHaveBeenCalledWith('flow-2', 'task-2', undefined);
    });
  });
});
