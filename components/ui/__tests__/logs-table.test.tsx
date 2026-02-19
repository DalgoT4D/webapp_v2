/**
 * LogsTable Component Tests
 *
 * Tests for run highlight behavior (left accent border on expanded content)
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogsTable, type FlowRun } from '../logs-table';

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
  status: 'success',
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

describe('LogsTable - Flow run highlight on expand', () => {
  const mockFetchLogs = jest.fn().mockResolvedValue(['Log line 1', 'Log line 2']);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to get flow run row elements (skipping the header which also uses grid-cols-12)
  const getFlowRunRows = (container: HTMLElement) =>
    container.querySelectorAll('.space-y-2 > .grid.grid-cols-12');

  it('adds left accent border when logs are expanded', async () => {
    const user = userEvent.setup();
    const runs = [createFlowRun()];

    const { container } = render(<LogsTable runs={runs} onFetchLogs={mockFetchLogs} />);

    const flowRunRow = getFlowRunRows(container)[0];

    // Initially no accent border
    expect(flowRunRow).not.toHaveClass('border-l-4');
    expect(flowRunRow).not.toHaveClass('border-l-teal-500');

    // Click Logs button
    const logsButton = screen.getByRole('button', { name: /logs/i });
    await user.click(logsButton);

    // Should now have accent border
    await waitFor(() => {
      expect(flowRunRow).toHaveClass('border-l-4');
      expect(flowRunRow).toHaveClass('border-l-teal-500');
    });
  });

  it('removes left accent border when logs are collapsed', async () => {
    const user = userEvent.setup();
    const runs = [createFlowRun()];

    const { container } = render(<LogsTable runs={runs} onFetchLogs={mockFetchLogs} />);

    const logsButton = screen.getByRole('button', { name: /logs/i });

    // Expand
    await user.click(logsButton);
    const flowRunRow = getFlowRunRows(container)[0];
    await waitFor(() => {
      expect(flowRunRow).toHaveClass('border-l-4');
    });

    // Collapse
    await user.click(logsButton);
    await waitFor(() => {
      expect(flowRunRow).not.toHaveClass('border-l-4');
    });
  });

  it('keeps accent border when one of multiple tasks still has expanded logs', async () => {
    const user = userEvent.setup();
    const runs = [
      createFlowRun({
        tasks: [
          { id: 'task-1', label: 'dbt run', duration: 60, isFailed: false },
          { id: 'task-2', label: 'dbt test', duration: 30, isFailed: false },
        ],
      }),
    ];

    const { container } = render(<LogsTable runs={runs} onFetchLogs={mockFetchLogs} />);

    const logsButtons = screen.getAllByRole('button', { name: /logs/i });

    // Expand both tasks
    await user.click(logsButtons[0]);
    await user.click(logsButtons[1]);

    const flowRunRow = getFlowRunRows(container)[0];
    await waitFor(() => {
      expect(flowRunRow).toHaveClass('border-l-4');
    });

    // Collapse first task - accent should remain (second task still expanded)
    await user.click(logsButtons[0]);
    await waitFor(() => {
      expect(flowRunRow).toHaveClass('border-l-4');
      expect(flowRunRow).toHaveClass('border-l-teal-500');
    });

    // Collapse second task - accent should be removed
    await user.click(logsButtons[1]);
    await waitFor(() => {
      expect(flowRunRow).not.toHaveClass('border-l-4');
    });
  });

  it('highlights multiple flow runs independently', async () => {
    const user = userEvent.setup();
    const runs = [
      createFlowRun({ id: 'flow-1' }),
      createFlowRun({
        id: 'flow-2',
        date: '2025-01-14T10:30:00Z',
        tasks: [{ id: 'task-2', label: 'sync', duration: 45, isFailed: false }],
      }),
    ];

    const { container } = render(<LogsTable runs={runs} onFetchLogs={mockFetchLogs} />);

    const flowRunRows = getFlowRunRows(container);
    const logsButtons = screen.getAllByRole('button', { name: /logs/i });

    // Expand first flow run's task
    await user.click(logsButtons[0]);
    await waitFor(() => {
      expect(flowRunRows[0]).toHaveClass('border-l-4');
      expect(flowRunRows[1]).not.toHaveClass('border-l-4');
    });

    // Expand second flow run's task - both should be highlighted
    await user.click(logsButtons[1]);
    await waitFor(() => {
      expect(flowRunRows[0]).toHaveClass('border-l-4');
      expect(flowRunRows[1]).toHaveClass('border-l-4');
    });

    // Collapse first - only second should remain highlighted
    await user.click(logsButtons[0]);
    await waitFor(() => {
      expect(flowRunRows[0]).not.toHaveClass('border-l-4');
      expect(flowRunRows[1]).toHaveClass('border-l-4');
    });
  });
});
