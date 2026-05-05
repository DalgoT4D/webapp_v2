/**
 * CreateTaskDialog Tests
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateTaskDialog } from '../CreateTaskDialog';
import * as useTaskTemplatesHook from '@/hooks/api/useTaskTemplates';

// ============ Mocks ============

jest.mock('@/hooks/api/useTaskTemplates');

jest.mock('@/components/ui/combobox', () => ({
  Combobox: () => <div data-testid="flags-combobox" />,
}));

jest.mock('@/lib/toast', () => ({
  toastSuccess: { created: jest.fn() },
  toastError: { api: jest.fn(), create: jest.fn() },
}));

// ============ CreateTaskDialog Tests ============

describe('CreateTaskDialog', () => {
  const mockOnOpenChange = jest.fn();
  const mockOnSuccess = jest.fn();

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    onSuccess: mockOnSuccess,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useTaskTemplatesHook.useTaskTemplates as jest.Mock).mockReturnValue({
      data: [
        { slug: 'dbt-run' },
        { slug: 'dbt-test' },
        { slug: 'git-pull' }, // should be filtered out
        { slug: 'dbt-clean' }, // should be filtered out
      ],
      isLoading: false,
    });

    (useTaskTemplatesHook.useTaskConfig as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
    });

    jest.spyOn(useTaskTemplatesHook, 'createCustomTask').mockResolvedValue(undefined);
  });

  it('does not render dialog content when open is false', () => {
    render(<CreateTaskDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Add a new org task')).not.toBeInTheDocument();
  });

  it('shows task templates in select but excludes git-pull and dbt-clean', async () => {
    const user = userEvent.setup();
    render(<CreateTaskDialog {...defaultProps} />);

    await user.click(screen.getByTestId('selecttask'));

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'dbt-run' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'dbt-test' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'git-pull' })).not.toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'dbt-clean' })).not.toBeInTheDocument();
    });
  });

  it('calls onOpenChange when cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<CreateTaskDialog {...defaultProps} />);

    await user.click(screen.getByTestId('cancel-btn'));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls createCustomTask with correct payload and fires onSuccess on submit', async () => {
    const user = userEvent.setup();
    const mockCreate = jest
      .spyOn(useTaskTemplatesHook, 'createCustomTask')
      .mockResolvedValue(undefined);

    render(<CreateTaskDialog {...defaultProps} />);

    // Select a task
    await user.click(screen.getByTestId('selecttask'));
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'dbt-run' })).toBeInTheDocument()
    );
    await user.click(screen.getByRole('option', { name: 'dbt-run' }));

    await user.click(screen.getByTestId('save-task-btn'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ task_slug: 'dbt-run' }));
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });
  });
});
