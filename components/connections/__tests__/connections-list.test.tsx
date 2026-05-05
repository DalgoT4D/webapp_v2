/**
 * Connections List Tests
 *
 * Tests for ConnectionsList component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionsList } from '../connections-list';
import * as useConnectionsHook from '@/hooks/api/useConnections';
import * as usePermissionsHook from '@/hooks/api/usePermissions';
import { LockStatus } from '@/constants/pipeline';
import type { Connection } from '@/types/connections';

// ============ Mocks ============

jest.mock('@/hooks/api/useConnections');
jest.mock('@/hooks/api/usePermissions');

// ConnectionRow mock exposes onDelete and onEdit so ConnectionsList action handlers
// can be tested without needing the real row UI
jest.mock('../connection-row', () => ({
  ConnectionRow: ({
    conn,
    onDelete,
    onEdit,
  }: {
    conn: Connection;
    onDelete: () => void;
    onEdit: () => void;
  }) => (
    <tr data-testid={`connection-row-${conn.connectionId}`}>
      <td data-testid={`connection-name-${conn.connectionId}`}>{conn.name}</td>
      <td>{conn.source.sourceName}</td>
      <td>
        <button data-testid={`delete-btn-${conn.connectionId}`} onClick={onDelete}>
          Delete
        </button>
        <button data-testid={`edit-btn-${conn.connectionId}`} onClick={onEdit}>
          Edit
        </button>
      </td>
    </tr>
  ),
}));

jest.mock('../connection-form', () => ({
  ConnectionForm: ({ mode }: { mode: string }) => (
    <div data-testid="connection-form" data-mode={mode}>
      {mode === 'create'
        ? 'New Connection'
        : mode === 'view'
          ? 'View Connection'
          : 'Edit Connection'}
    </div>
  ),
}));

jest.mock('../connection-sync-history', () => ({
  ConnectionSyncHistory: () => <div data-testid="sync-history-dialog" />,
}));

jest.mock('../stream-selection-dialog', () => ({
  StreamSelectionDialog: () => <div data-testid="stream-selection-dialog" />,
}));

jest.mock('../schema-change-form', () => ({
  SchemaChangeForm: () => <div data-testid="schema-change-form" />,
}));

jest.mock('../pending-actions', () => ({
  PendingActions: () => null,
}));

jest.mock('@/components/ui/confirmation-dialog', () => ({
  useConfirmationDialog: () => ({
    confirm: jest.fn().mockResolvedValue(true),
    DialogComponent: (): null => null,
  }),
}));

jest.mock('@/lib/toast', () => ({
  toastSuccess: { deleted: jest.fn(), generic: jest.fn(), created: jest.fn(), updated: jest.fn() },
  toastError: { delete: jest.fn(), api: jest.fn(), save: jest.fn() },
}));

jest.mock('@/assets/icons/connection', () => ({
  __esModule: true,
  default: () => <svg data-testid="connection-icon" />,
}));

// ============ Test Data Factory ============

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

// ============ ConnectionsList Tests ============

describe('ConnectionsList', () => {
  const mockMutate = jest.fn();

  const mockConnections = (data: Connection[]) =>
    (useConnectionsHook.useConnectionsList as jest.Mock).mockReturnValue({
      data,
      isLoading: false,
      isError: null,
      mutate: mockMutate,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnections([]);
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: () => true,
    });
  });

  it('shows loading spinner while fetching connections', () => {
    (useConnectionsHook.useConnectionsList as jest.Mock).mockReturnValue({
      data: [],
      isLoading: true,
      isError: null,
      mutate: mockMutate,
    });

    render(<ConnectionsList />);

    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByTestId('connections-table')).not.toBeInTheDocument();
  });

  it('shows empty state; hides create button without create permission', () => {
    // With permission — button visible
    const { unmount } = render(<ConnectionsList />);
    expect(screen.getByTestId('connection-empty-state')).toBeInTheDocument();
    expect(screen.getByText('No connections yet')).toBeInTheDocument();
    unmount();

    // Without permission — create button hidden
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: (p: string) => p !== 'can_create_connection',
    });
    render(<ConnectionsList />);
    expect(screen.getByTestId('connection-empty-state')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /create your first connection/i })
    ).not.toBeInTheDocument();
  });

  it('renders connection rows sorted alphabetically', () => {
    mockConnections([
      createMockConnection({ connectionId: 'conn-z', name: 'Zebra Sync' }),
      createMockConnection({ connectionId: 'conn-a', name: 'Alpha Sync' }),
    ]);

    render(<ConnectionsList />);

    expect(screen.getByTestId('connections-table')).toBeInTheDocument();
    const rows = screen.getAllByTestId(/^connection-row-/);
    expect(rows[0]).toHaveAttribute('data-testid', 'connection-row-conn-a');
    expect(rows[1]).toHaveAttribute('data-testid', 'connection-row-conn-z');
  });

  it('filters connections by name via search', async () => {
    const user = userEvent.setup();
    mockConnections([
      createMockConnection({ connectionId: 'conn-1', name: 'Production Sync' }),
      createMockConnection({ connectionId: 'conn-2', name: 'Analytics Sync' }),
    ]);

    render(<ConnectionsList />);

    await user.type(screen.getByTestId('connection-search-input'), 'Production');
    expect(screen.getByTestId('connection-row-conn-1')).toBeInTheDocument();
    expect(screen.queryByTestId('connection-row-conn-2')).not.toBeInTheDocument();
  });

  it('filters connections by source name via search', async () => {
    const user = userEvent.setup();
    mockConnections([
      createMockConnection({
        connectionId: 'conn-1',
        name: 'Sync A',
        source: { sourceId: 'src-1', name: 'DB', sourceName: 'Postgres' },
      }),
      createMockConnection({
        connectionId: 'conn-2',
        name: 'Sync B',
        source: { sourceId: 'src-2', name: 'BQ', sourceName: 'BigQuery' },
      }),
    ]);

    render(<ConnectionsList />);

    await user.type(screen.getByTestId('connection-search-input'), 'BigQuery');
    expect(screen.queryByTestId('connection-row-conn-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('connection-row-conn-2')).toBeInTheDocument();
  });

  it('shows no-results message when search matches nothing', async () => {
    const user = userEvent.setup();
    mockConnections([createMockConnection()]);

    render(<ConnectionsList />);
    await user.type(screen.getByTestId('connection-search-input'), 'xyz-no-match');
    expect(screen.getByText(/No connections matching/)).toBeInTheDocument();
  });

  it('opens ConnectionForm in create mode when new connection button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConnectionsList />);

    await user.click(screen.getByTestId('create-connection-btn'));
    const form = screen.getByTestId('connection-form');
    expect(form).toBeInTheDocument();
    expect(form).toHaveAttribute('data-mode', 'create');
  });

  it('hides new connection button without create permission', () => {
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: (p: string) => p !== 'can_create_connection',
    });
    mockConnections([createMockConnection()]);

    render(<ConnectionsList />);
    expect(screen.queryByTestId('create-connection-btn')).not.toBeInTheDocument();
  });

  it('opens ConnectionForm in edit mode when edit is triggered', async () => {
    const user = userEvent.setup();
    mockConnections([createMockConnection()]);

    render(<ConnectionsList />);

    await user.click(screen.getByTestId('edit-btn-conn-1'));
    await waitFor(() => {
      expect(screen.getByTestId('connection-form')).toBeInTheDocument();
      expect(screen.getByText('Edit Connection')).toBeInTheDocument();
    });
  });

  it('opens ConnectionForm in view mode when connection is locked and edit is triggered', async () => {
    const user = userEvent.setup();
    mockConnections([
      createMockConnection({
        lock: {
          status: LockStatus.RUNNING,
          lockedAt: new Date().toISOString(),
          lockedBy: 'user@test.com',
          flowRunId: 'flow-1',
        },
      }),
    ]);

    render(<ConnectionsList />);

    await user.click(screen.getByTestId('edit-btn-conn-1'));
    await waitFor(() => {
      expect(screen.getByTestId('connection-form')).toBeInTheDocument();
      expect(screen.getByText('View Connection')).toBeInTheDocument();
    });
  });

  it('deletes connection after confirmation and shows success toast', async () => {
    const user = userEvent.setup();
    const mockDelete = jest
      .spyOn(useConnectionsHook, 'deleteConnection')
      .mockResolvedValue(undefined);
    const { toastSuccess } = jest.requireMock('@/lib/toast');

    mockConnections([createMockConnection()]);
    render(<ConnectionsList />);

    await user.click(screen.getByTestId('delete-btn-conn-1'));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('conn-1');
      expect(toastSuccess.deleted).toHaveBeenCalledWith('My Connection');
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  it('shows error toast and does not mutate when delete fails', async () => {
    const user = userEvent.setup();
    jest.spyOn(useConnectionsHook, 'deleteConnection').mockRejectedValue(new Error('Server error'));
    const { toastError } = jest.requireMock('@/lib/toast');

    mockConnections([createMockConnection()]);
    render(<ConnectionsList />);

    await user.click(screen.getByTestId('delete-btn-conn-1'));

    await waitFor(() => {
      expect(toastError.delete).toHaveBeenCalled();
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
