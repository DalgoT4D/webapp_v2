/**
 * Connection Form Tests
 *
 * Tests for ConnectionForm component (create, edit, view modes)
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionForm } from '../connection-form';
import * as useConnectionsHook from '@/hooks/api/useConnections';
import * as useSourcesHook from '@/hooks/api/useSources';
import { FormMode } from '@/constants/connections';
import type { Connection } from '@/types/connections';

// ============ Mocks ============

jest.mock('@/hooks/api/useConnections');
jest.mock('@/hooks/api/useSources');

const mockUseBackendWebSocket = jest.fn(
  (_path: unknown, _options?: { onLoadingChange?: (v: boolean) => void }) => ({
    sendJsonMessage: jest.fn(),
    readyState: 1, // ReadyState.OPEN
    lastMessage: null as MessageEvent | null,
  })
);

jest.mock('@/hooks/useBackendWebSocket', () => ({
  useBackendWebSocket: (path: unknown, options: unknown) => mockUseBackendWebSocket(path, options),
}));

jest.mock('../stream-config-table', () => ({
  StreamConfigTable: () => <div data-testid="stream-config-table" />,
}));

jest.mock('../hooks/useStreamConfig', () => ({
  useStreamConfig: () => ({
    streams: [],
    setStreams: jest.fn(),
    streamSearch: '',
    setStreamSearch: jest.fn(),
    incrementalAllStreams: false,
    expandedStreams: new Set(),
    toggleStream: jest.fn(),
    toggleAllStreams: jest.fn(),
    updateStreamSyncMode: jest.fn(),
    updateStreamDestMode: jest.fn(),
    updateStreamCursorField: jest.fn(),
    updateStreamPrimaryKey: jest.fn(),
    toggleColumn: jest.fn(),
    toggleStreamExpand: jest.fn(),
    handleIncrementalAllToggle: jest.fn(),
    filteredStreams: [],
    allSelected: false,
    hasSelectedStreams: false,
  }),
}));

jest.mock('@/lib/toast', () => ({
  toastSuccess: { created: jest.fn(), updated: jest.fn(), deleted: jest.fn(), generic: jest.fn() },
  toastError: { save: jest.fn(), api: jest.fn(), delete: jest.fn() },
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
  destinationSchema: 'staging',
  resetConnDeploymentId: null,
  clearConnDeploymentId: null,
  queuedFlowRunWaitTime: null,
  blockId: 'block-1',
  ...overrides,
});

// ============ ConnectionForm Tests ============

describe('ConnectionForm', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useSourcesHook.useSources as jest.Mock).mockReturnValue({
      data: [
        { sourceId: 'src-1', name: 'Prod DB', sourceName: 'Postgres', connectionConfiguration: {} },
      ],
      isLoading: false,
      isError: null,
    });
    (useConnectionsHook.useConnection as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: null,
    });
  });

  it('renders create mode with correct title and disabled save button', () => {
    render(
      <ConnectionForm mode={FormMode.CREATE} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    expect(screen.getByText('New Connection')).toBeInTheDocument();
    expect(screen.getByTestId('save-connection-btn')).toBeDisabled();
  });

  it('renders edit mode with correct title and pre-filled name', async () => {
    (useConnectionsHook.useConnection as jest.Mock).mockReturnValue({
      data: createMockConnection(),
      isLoading: false,
      isError: null,
    });

    render(
      <ConnectionForm
        mode={FormMode.EDIT}
        connectionId="conn-1"
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Edit Connection')).toBeInTheDocument();
      expect(screen.getByTestId('connection-name-input')).toHaveValue('My Connection');
    });
  });

  it('renders view mode with correct title and no save/cancel footer', () => {
    (useConnectionsHook.useConnection as jest.Mock).mockReturnValue({
      data: createMockConnection(),
      isLoading: false,
      isError: null,
    });

    render(
      <ConnectionForm
        mode={FormMode.VIEW}
        connectionId="conn-1"
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('View Connection')).toBeInTheDocument();
    expect(screen.queryByTestId('save-connection-btn')).not.toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ConnectionForm mode={FormMode.CREATE} onClose={mockOnClose} onSuccess={mockOnSuccess} />
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
