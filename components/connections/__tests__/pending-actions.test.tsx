/**
 * Pending Actions Tests
 *
 * Tests for PendingActions component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PendingActions } from '../pending-actions';
import { LockStatus } from '@/constants/pipeline';
import { createMockConnection, createMockSchemaChange } from './connections-mock-data';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet } from '@/test-utils/api';

// ============ Mocks ============

jest.mock('../schema-change-form', () => ({
  SchemaChangeForm: () => <div data-testid="schema-change-form" />,
}));

// ============ PendingActions Tests ============

describe('PendingActions', () => {
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockResolvedValue([]);
  });

  it('renders nothing when there are no schema changes', async () => {
    const { container } = render(
      <TestWrapper>
        <PendingActions connections={[]} onSuccess={mockOnSuccess} />
      </TestWrapper>
    );
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('renders banner with count and expands on click to show changes', async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue([
      createMockSchemaChange(),
      createMockSchemaChange({ connection_id: 'conn-2' }),
    ]);

    render(
      <TestWrapper>
        <PendingActions
          connections={[
            createMockConnection({ connectionId: 'conn-1', name: 'My Connection' }),
            createMockConnection({ connectionId: 'conn-2', name: 'Analytics Sync' }),
          ]}
          onSuccess={mockOnSuccess}
        />
      </TestWrapper>
    );

    await waitFor(() => expect(screen.getByText('Pending Schema Changes (2)')).toBeInTheDocument());
    expect(screen.queryByTestId('schema-change-conn-1')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('pending-actions-toggle'));
    expect(screen.getByTestId('schema-change-conn-1')).toBeInTheDocument();
    expect(screen.getByTestId('schema-change-conn-2')).toBeInTheDocument();
  });

  it('shows Breaking badge for breaking changes and Updates badge otherwise', async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue([
      createMockSchemaChange({ connection_id: 'conn-1', change_type: 'breaking' }),
      createMockSchemaChange({ connection_id: 'conn-2', change_type: 'non_breaking' }),
    ]);

    render(
      <TestWrapper>
        <PendingActions
          connections={[
            createMockConnection({ connectionId: 'conn-1' }),
            createMockConnection({ connectionId: 'conn-2' }),
          ]}
          onSuccess={mockOnSuccess}
        />
      </TestWrapper>
    );

    await waitFor(() => expect(screen.getByText('Pending Schema Changes (2)')).toBeInTheDocument());
    await user.click(screen.getByTestId('pending-actions-toggle'));

    expect(screen.getByText('Breaking')).toBeInTheDocument();
    expect(screen.getByText('Updates')).toBeInTheDocument();
  });

  it('disables View button when connection is locked', async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue([createMockSchemaChange()]);

    render(
      <TestWrapper>
        <PendingActions
          connections={[
            createMockConnection({
              connectionId: 'conn-1',
              lock: { status: LockStatus.RUNNING, lockedAt: '', lockedBy: '', flowRunId: 'flow-1' },
            }),
          ]}
          onSuccess={mockOnSuccess}
        />
      </TestWrapper>
    );

    await waitFor(() => expect(screen.getByText('Pending Schema Changes (1)')).toBeInTheDocument());
    await user.click(screen.getByTestId('pending-actions-toggle'));

    await waitFor(() => {
      expect(screen.getByTestId('view-schema-change-conn-1')).toBeDisabled();
    });
  });

  it('opens SchemaChangeForm when View button is clicked', async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValue([createMockSchemaChange()]);

    render(
      <TestWrapper>
        <PendingActions connections={[createMockConnection()]} onSuccess={mockOnSuccess} />
      </TestWrapper>
    );

    await waitFor(() => expect(screen.getByText('Pending Schema Changes (1)')).toBeInTheDocument());
    await user.click(screen.getByTestId('pending-actions-toggle'));
    await waitFor(() =>
      expect(screen.getByTestId('view-schema-change-conn-1')).toBeInTheDocument()
    );
    await user.click(screen.getByTestId('view-schema-change-conn-1'));

    expect(screen.getByTestId('schema-change-form')).toBeInTheDocument();
  });
});
