/**
 * DBTTaskList Tests
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DBTTaskList } from '../DBTTaskList';
import * as usePrefectTasksHook from '@/hooks/api/usePrefectTasks';
import * as usePermissionsHook from '@/hooks/api/usePermissions';
import { LockStatus } from '@/constants/pipeline';
import { createMockTask } from './transform-mock-data';

// ============ Mocks ============

jest.mock('@/hooks/api/usePrefectTasks');
jest.mock('@/hooks/api/usePermissions');

jest.mock('@/components/pipeline/log-card', () => ({
  LogCard: () => <div data-testid="log-card" />,
}));

jest.mock('@/lib/toast', () => ({
  toastSuccess: { deleted: jest.fn(), generic: jest.fn() },
  toastError: { api: jest.fn(), delete: jest.fn() },
}));

const defaultProps = {
  isAnyTaskLocked: false,
  onNewTask: jest.fn(),
  canCreateTask: true,
};

// ============ DBTTaskList Tests ============

describe('DBTTaskList', () => {
  const mockMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (usePrefectTasksHook.usePrefectTasks as jest.Mock).mockReturnValue({
      data: [],
      mutate: mockMutate,
    });

    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: (perm: string) => ['can_run_orgtask', 'can_delete_orgtask'].includes(perm),
    });

    jest.spyOn(usePrefectTasksHook, 'deletePrefectTask').mockResolvedValue(undefined);
  });

  it('shows empty state when no tasks are configured', () => {
    render(<DBTTaskList {...defaultProps} />);
    expect(screen.getByText('No DBT tasks configured')).toBeInTheDocument();
  });

  it('renders task rows with label and command', () => {
    (usePrefectTasksHook.usePrefectTasks as jest.Mock).mockReturnValue({
      data: [createMockTask()],
      mutate: mockMutate,
    });

    render(<DBTTaskList {...defaultProps} />);

    expect(screen.getByText('DBT Run')).toBeInTheDocument();
    expect(screen.getByText('dbt run')).toBeInTheDocument();
  });

  it('disables execute button when any task is locked', () => {
    (usePrefectTasksHook.usePrefectTasks as jest.Mock).mockReturnValue({
      data: [
        createMockTask(),
        createMockTask({
          uuid: 'task-2',
          lock: {
            status: LockStatus.RUNNING,
            lockedAt: '',
            lockedBy: 'user@test.com',
            flowRunId: 'flow-1',
            celeryTaskId: '',
          },
        }),
      ],
      mutate: mockMutate,
    });

    render(<DBTTaskList {...defaultProps} isAnyTaskLocked={true} />);

    expect(screen.getByTestId('run-task-task-1')).toBeDisabled();
  });

  it('disables New Task button when canCreateTask is false', () => {
    render(<DBTTaskList {...defaultProps} canCreateTask={false} />);
    expect(screen.getByTestId('new-task-btn')).toBeDisabled();
  });

  it('deletes task after confirming in the alert dialog', async () => {
    const user = userEvent.setup();
    const mockDelete = jest
      .spyOn(usePrefectTasksHook, 'deletePrefectTask')
      .mockResolvedValue(undefined);

    (usePrefectTasksHook.usePrefectTasks as jest.Mock).mockReturnValue({
      data: [createMockTask()],
      mutate: mockMutate,
    });

    render(<DBTTaskList {...defaultProps} />);

    await user.click(screen.getByTestId('task-menu-task-1'));
    await waitFor(() => expect(screen.getByTestId('delete-task-task-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('delete-task-task-1'));

    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('task-1');
      expect(mockMutate).toHaveBeenCalled();
    });
  });
});
