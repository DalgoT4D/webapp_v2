/**
 * Stream Selection Dialog Tests
 *
 * Tests for StreamSelectionDialog component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StreamSelectionDialog } from '../stream-selection-dialog';
import * as useConnectionsHook from '@/hooks/api/useConnections';
import { createMockConnection } from './connections-mock-data';

// ============ Mocks ============

jest.mock('@/hooks/api/useConnections');

// ============ Test Data ============

// Adapter: builds a connection with a populated syncCatalog from a streams list
const createConnectionWithStreams = (streams: { name: string; namespace?: string }[]) =>
  createMockConnection({
    clearConnDeploymentId: 'clear-deploy-1',
    syncCatalog: {
      streams: streams.map((s) => ({
        stream: {
          name: s.name,
          namespace: s.namespace,
          jsonSchema: {},
          supportedSyncModes: ['full_refresh'] as string[],
          sourceDefinedCursor: false,
          defaultCursorField: [] as string[],
          sourceDefinedPrimaryKey: [] as string[][],
        },
        config: {
          syncMode: 'full_refresh',
          destinationSyncMode: 'overwrite',
          cursorField: [] as string[],
          primaryKey: [] as string[][],
          selected: true,
          fieldSelectionEnabled: false,
          selectedFields: [] as string[],
        },
      })),
    },
  });

// ============ StreamSelectionDialog Tests ============

describe('StreamSelectionDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  const defaultProps = {
    connectionId: 'conn-1',
    onClose: mockOnClose,
    onConfirm: mockOnConfirm,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useConnectionsHook.useConnection as jest.Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: null,
    });
  });

  it('shows loading spinner while connection is fetching', () => {
    render(<StreamSelectionDialog {...defaultProps} />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders stream list from connection sync catalog', async () => {
    (useConnectionsHook.useConnection as jest.Mock).mockReturnValue({
      data: createConnectionWithStreams([{ name: 'orders' }, { name: 'customers' }]),
      isLoading: false,
      isError: null,
    });

    render(<StreamSelectionDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('orders')).toBeInTheDocument();
      expect(screen.getByText('customers')).toBeInTheDocument();
    });
  });

  it('confirm button is disabled until at least one stream is selected', async () => {
    (useConnectionsHook.useConnection as jest.Mock).mockReturnValue({
      data: createConnectionWithStreams([{ name: 'orders' }, { name: 'customers' }]),
      isLoading: false,
      isError: null,
    });

    render(<StreamSelectionDialog {...defaultProps} />);

    await waitFor(() => expect(screen.getByText('orders')).toBeInTheDocument());
    expect(screen.getByTestId('confirm-clear-streams')).toBeDisabled();
  });

  it('enables confirm button after toggling a stream on', async () => {
    const user = userEvent.setup();
    (useConnectionsHook.useConnection as jest.Mock).mockReturnValue({
      data: createConnectionWithStreams([{ name: 'orders' }]),
      isLoading: false,
      isError: null,
    });

    render(<StreamSelectionDialog {...defaultProps} />);

    await waitFor(() => expect(screen.getByText('orders')).toBeInTheDocument());
    await user.click(screen.getByTestId('clear-stream-::orders'));

    expect(screen.getByTestId('confirm-clear-streams')).not.toBeDisabled();
  });

  it('select all toggle enables all streams and confirm button', async () => {
    const user = userEvent.setup();
    (useConnectionsHook.useConnection as jest.Mock).mockReturnValue({
      data: createConnectionWithStreams([{ name: 'orders' }, { name: 'customers' }]),
      isLoading: false,
      isError: null,
    });

    render(<StreamSelectionDialog {...defaultProps} />);

    await waitFor(() => expect(screen.getByText('orders')).toBeInTheDocument());
    await user.click(screen.getByTestId('select-all-streams'));

    expect(screen.getByTestId('confirm-clear-streams')).not.toBeDisabled();
  });

  it('calls onConfirm with selected streams when confirm is clicked', async () => {
    const user = userEvent.setup();
    (useConnectionsHook.useConnection as jest.Mock).mockReturnValue({
      data: createConnectionWithStreams([{ name: 'orders' }]),
      isLoading: false,
      isError: null,
    });

    render(<StreamSelectionDialog {...defaultProps} />);

    await waitFor(() => expect(screen.getByText('orders')).toBeInTheDocument());
    await user.click(screen.getByTestId('clear-stream-::orders'));
    await user.click(screen.getByTestId('confirm-clear-streams'));

    expect(mockOnConfirm).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ streamName: 'orders', selected: true })])
    );
  });

  it('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    (useConnectionsHook.useConnection as jest.Mock).mockReturnValue({
      data: createConnectionWithStreams([{ name: 'orders' }]),
      isLoading: false,
      isError: null,
    });

    render(<StreamSelectionDialog {...defaultProps} />);

    await waitFor(() => expect(screen.getByText('orders')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
