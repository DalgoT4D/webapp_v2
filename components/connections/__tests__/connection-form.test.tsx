/**
 * Connection Form Tests
 *
 * Tests for ConnectionForm component (create, edit, view modes)
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionForm } from '../connection-form';
import { FormMode } from '@/constants/connections';
import { createMockConnection } from './connections-mock-data';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet } from '@/test-utils/api';

// ============ Mocks ============

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

// ============ ConnectionForm Tests ============

describe('ConnectionForm', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/api/airbyte/sources') {
        return Promise.resolve([
          {
            sourceId: 'src-1',
            name: 'Prod DB',
            sourceName: 'Postgres',
            connectionConfiguration: {},
          },
        ]);
      }
      return Promise.resolve(undefined);
    });
  });

  it('renders create mode with correct title and disabled save button', async () => {
    render(
      <TestWrapper>
        <ConnectionForm mode={FormMode.CREATE} onClose={mockOnClose} onSuccess={mockOnSuccess} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('New Connection')).toBeInTheDocument();
      expect(screen.getByTestId('save-connection-btn')).toBeDisabled();
    });
  });

  it('renders edit mode with correct title and pre-filled name', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/airbyte/v1/connections/'))
        return Promise.resolve(createMockConnection());
      if (url === '/api/airbyte/sources') return Promise.resolve([]);
      return Promise.resolve(undefined);
    });

    render(
      <TestWrapper>
        <ConnectionForm
          mode={FormMode.EDIT}
          connectionId="conn-1"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Edit Connection')).toBeInTheDocument();
      expect(screen.getByTestId('connection-name-input')).toHaveValue('My Connection');
    });
  });

  it('renders view mode with correct title and no save/cancel footer', async () => {
    mockApiGet.mockImplementation((url: string) => {
      if (url.includes('/api/airbyte/v1/connections/'))
        return Promise.resolve(createMockConnection());
      if (url === '/api/airbyte/sources') return Promise.resolve([]);
      return Promise.resolve(undefined);
    });

    render(
      <TestWrapper>
        <ConnectionForm
          mode={FormMode.VIEW}
          connectionId="conn-1"
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </TestWrapper>
    );

    await waitFor(() => expect(screen.getByText('View Connection')).toBeInTheDocument());
    expect(screen.queryByTestId('save-connection-btn')).not.toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <ConnectionForm mode={FormMode.CREATE} onClose={mockOnClose} onSuccess={mockOnSuccess} />
      </TestWrapper>
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
