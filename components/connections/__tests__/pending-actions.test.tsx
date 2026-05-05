/**
 * Pending Actions Tests
 *
 * Tests for PendingActions component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PendingActions } from '../pending-actions';
import * as useConnectionsHook from '@/hooks/api/useConnections';
import { LockStatus } from '@/constants/pipeline';
import type { Connection, SchemaChange } from '@/types/connections';

// ============ Mocks ============

jest.mock('@/hooks/api/useConnections');

jest.mock('../schema-change-form', () => ({
  SchemaChangeForm: () => <div data-testid="schema-change-form" />,
}));

// ============ Test Data ============

const createMockConnection = (overrides: Partial<Connection> = {}): Connection => ({
  connectionId: 'conn-1',
  name: 'My Connection',
  deploymentId: 'deploy-1',
  catalogId: 'catalog-1',
  source: { sourceId: 'src-1', name: 'Prod DB', sourceName: 'Postgres' },
  destination: { destinationId: 'dest-1', name: 'Warehouse', destinationName: 'BigQuery' },
  lock: null,
  lastRun: null,
  normalize: false,
  status: 'active',
  syncCatalog: { streams: [] },
  resetConnDeploymentId: null,
  clearConnDeploymentId: null,
  queuedFlowRunWaitTime: null,
  blockId: 'block-1',
  ...overrides,
});

const createMockSchemaChange = (overrides: Partial<SchemaChange> = {}): SchemaChange => ({
  connection_id: 'conn-1',
  change_type: 'non_breaking',
  ...overrides,
});

// ============ PendingActions Tests ============

describe('PendingActions', () => {
  const mockMutate = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useConnectionsHook.useSchemaChanges as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      mutate: mockMutate,
    });
  });

  it('renders nothing when there are no schema changes', () => {
    const { container } = render(<PendingActions connections={[]} onSuccess={mockOnSuccess} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders banner with count and expands on click to show changes', async () => {
    const user = userEvent.setup();
    (useConnectionsHook.useSchemaChanges as jest.Mock).mockReturnValue({
      data: [createMockSchemaChange(), createMockSchemaChange({ connection_id: 'conn-2' })],
      isLoading: false,
      mutate: mockMutate,
    });

    render(
      <PendingActions
        connections={[
          createMockConnection({ connectionId: 'conn-1', name: 'My Connection' }),
          createMockConnection({ connectionId: 'conn-2', name: 'Analytics Sync' }),
        ]}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('Pending Schema Changes (2)')).toBeInTheDocument();
    // List hidden before expand
    expect(screen.queryByTestId('schema-change-conn-1')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('pending-actions-toggle'));
    expect(screen.getByTestId('schema-change-conn-1')).toBeInTheDocument();
    expect(screen.getByTestId('schema-change-conn-2')).toBeInTheDocument();
  });

  it('shows Breaking badge for breaking changes and Updates badge otherwise', async () => {
    const user = userEvent.setup();
    (useConnectionsHook.useSchemaChanges as jest.Mock).mockReturnValue({
      data: [
        createMockSchemaChange({ connection_id: 'conn-1', change_type: 'breaking' }),
        createMockSchemaChange({ connection_id: 'conn-2', change_type: 'non_breaking' }),
      ],
      isLoading: false,
      mutate: mockMutate,
    });

    render(
      <PendingActions
        connections={[
          createMockConnection({ connectionId: 'conn-1' }),
          createMockConnection({ connectionId: 'conn-2' }),
        ]}
        onSuccess={mockOnSuccess}
      />
    );

    await user.click(screen.getByTestId('pending-actions-toggle'));

    expect(screen.getByText('Breaking')).toBeInTheDocument();
    expect(screen.getByText('Updates')).toBeInTheDocument();
  });

  it('disables View button when connection is locked', async () => {
    const user = userEvent.setup();
    (useConnectionsHook.useSchemaChanges as jest.Mock).mockReturnValue({
      data: [createMockSchemaChange()],
      isLoading: false,
      mutate: mockMutate,
    });

    render(
      <PendingActions
        connections={[
          createMockConnection({
            connectionId: 'conn-1',
            lock: { status: LockStatus.RUNNING, lockedAt: '', lockedBy: '', flowRunId: 'flow-1' },
          }),
        ]}
        onSuccess={mockOnSuccess}
      />
    );

    await user.click(screen.getByTestId('pending-actions-toggle'));

    await waitFor(() => {
      expect(screen.getByTestId('view-schema-change-conn-1')).toBeDisabled();
    });
  });

  it('opens SchemaChangeForm when View button is clicked', async () => {
    const user = userEvent.setup();
    (useConnectionsHook.useSchemaChanges as jest.Mock).mockReturnValue({
      data: [createMockSchemaChange()],
      isLoading: false,
      mutate: mockMutate,
    });

    render(<PendingActions connections={[createMockConnection()]} onSuccess={mockOnSuccess} />);

    await user.click(screen.getByTestId('pending-actions-toggle'));
    await waitFor(() =>
      expect(screen.getByTestId('view-schema-change-conn-1')).toBeInTheDocument()
    );
    await user.click(screen.getByTestId('view-schema-change-conn-1'));

    expect(screen.getByTestId('schema-change-form')).toBeInTheDocument();
  });
});
