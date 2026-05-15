/**
 * Schema Change Form Tests
 *
 * Tests for SchemaChangeForm component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SchemaChangeForm } from '../schema-change-form';
import * as useConnectionsHook from '@/hooks/api/useConnections';

// ============ Mocks ============

jest.mock('@/hooks/api/useConnections');

jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn(), created: jest.fn(), updated: jest.fn(), deleted: jest.fn() },
  toastError: { api: jest.fn(), save: jest.fn(), delete: jest.fn() },
}));

// ============ SchemaChangeForm Tests ============

describe('SchemaChangeForm', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  const defaultProps = {
    connectionId: 'conn-1',
    onClose: mockOnClose,
    onSuccess: mockOnSuccess,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // By default: catalog refresh returns a task_id, task not yet complete
    jest.spyOn(useConnectionsHook, 'refreshConnectionCatalog').mockResolvedValue({
      task_id: 'task-1',
    });
    jest.spyOn(useConnectionsHook, 'scheduleSchemaUpdate').mockResolvedValue(undefined);

    (useConnectionsHook.useTaskProgress as jest.Mock).mockReturnValue({
      progress: null,
      isComplete: false,
      isFailed: false,
      isLoading: true,
    });
  });

  it('shows loading state while catalog refresh task is in progress', async () => {
    render(<SchemaChangeForm {...defaultProps} />);
    // Spinner appears after refreshConnectionCatalog resolves and sets taskId
    await waitFor(() => {
      expect(screen.getByText('Refreshing schema...')).toBeInTheDocument();
    });
    expect(screen.getByTestId('accept-schema-changes-btn')).toBeDisabled();
  });

  it('shows no changes message when task completes with no transforms', () => {
    (useConnectionsHook.useTaskProgress as jest.Mock).mockReturnValue({
      progress: { status: 'completed', result: { catalogDiff: { transforms: [] } } },
      isComplete: true,
      isFailed: false,
      isLoading: false,
    });

    render(<SchemaChangeForm {...defaultProps} />);

    expect(screen.getByText('No schema changes detected.')).toBeInTheDocument();
    expect(screen.getByTestId('accept-schema-changes-btn')).toBeDisabled();
  });

  it('shows added and removed stream sections when task completes with transforms', () => {
    (useConnectionsHook.useTaskProgress as jest.Mock).mockReturnValue({
      progress: {
        status: 'completed',
        result: {
          catalogDiff: {
            transforms: [
              { transformType: 'add_stream', streamDescriptor: { name: 'new_table' } },
              { transformType: 'remove_stream', streamDescriptor: { name: 'old_table' } },
            ],
          },
        },
      },
      isComplete: true,
      isFailed: false,
      isLoading: false,
    });

    render(<SchemaChangeForm {...defaultProps} />);

    expect(screen.getByTestId('schema-section-added')).toBeInTheDocument();
    expect(screen.getByTestId('schema-section-removed')).toBeInTheDocument();
    expect(screen.getByText('new_table')).toBeInTheDocument();
    expect(screen.getByText('old_table')).toBeInTheDocument();
  });

  it('disables accept button and shows warning for breaking changes', () => {
    (useConnectionsHook.useTaskProgress as jest.Mock).mockReturnValue({
      progress: {
        status: 'completed',
        result: {
          schemaChange: 'breaking',
          catalogDiff: {
            transforms: [
              { transformType: 'remove_stream', streamDescriptor: { name: 'critical_table' } },
            ],
          },
        },
      },
      isComplete: true,
      isFailed: false,
      isLoading: false,
    });

    render(<SchemaChangeForm {...defaultProps} />);

    expect(screen.getByTestId('breaking-changes-warning')).toBeInTheDocument();
    expect(screen.getByTestId('accept-schema-changes-btn')).toBeDisabled();
  });

  it('calls scheduleSchemaUpdate and onSuccess when Accept is clicked', async () => {
    const user = userEvent.setup();
    const mockSchedule = jest
      .spyOn(useConnectionsHook, 'scheduleSchemaUpdate')
      .mockResolvedValue(undefined);
    const { toastSuccess } = jest.requireMock('@/lib/toast');

    (useConnectionsHook.useTaskProgress as jest.Mock).mockReturnValue({
      progress: {
        status: 'completed',
        result: {
          catalogDiff: {
            transforms: [{ transformType: 'add_stream', streamDescriptor: { name: 'new_table' } }],
          },
        },
      },
      isComplete: true,
      isFailed: false,
      isLoading: false,
    });

    render(<SchemaChangeForm {...defaultProps} />);

    await user.click(screen.getByTestId('accept-schema-changes-btn'));

    await waitFor(() => {
      expect(mockSchedule).toHaveBeenCalledWith('conn-1', expect.any(Object));
      expect(toastSuccess.generic).toHaveBeenCalledWith('Schema changes accepted');
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<SchemaChangeForm {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
