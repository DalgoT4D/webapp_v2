/**
 * Connection Row Tests
 *
 * Tests for ConnectionRow component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table, TableBody } from '@/components/ui/table';
import { ConnectionRow } from '../connection-row';
import { LockStatus } from '@/constants/pipeline';
import { createMockConnection } from './connections-mock-data';

// ============ Mocks ============

jest.mock('@/hooks/useSyncLock', () => ({
  useSyncLock: () => ({
    tempSyncState: false,
    setTempSyncState: jest.fn(),
  }),
}));

jest.mock('@/assets/icons/connection', () => ({
  __esModule: true,
  default: () => <svg data-testid="connection-icon" />,
}));

jest.mock('@/components/pipeline/utils', () => ({
  lastRunTime: () => '2 hours ago',
  trimEmail: (e: string) => e,
}));

const defaultProps = {
  syncingIds: [],
  canSync: true,
  canEdit: true,
  canDelete: true,
  canReset: true,
  onSync: jest.fn(),
  onCancelSync: jest.fn(),
  onEdit: jest.fn(),
  onDelete: jest.fn(),
  onViewHistory: jest.fn(),
  onClearStreams: jest.fn(),
  onRefreshSchema: jest.fn(),
};

// ConnectionRow renders a <tr> so it needs a table wrapper
const renderRow = (conn: Connection, props = {}) =>
  render(
    <Table>
      <TableBody>
        <ConnectionRow conn={conn} {...defaultProps} {...props} />
      </TableBody>
    </Table>
  );

// ============ ConnectionRow Tests ============

describe('ConnectionRow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders connection name', () => {
    renderRow(createMockConnection());
    expect(screen.getByTestId('connection-name-conn-1')).toHaveTextContent('My Connection');
  });

  it('disables sync button when connection is syncing', () => {
    renderRow(createMockConnection(), { syncingIds: ['conn-1'] });
    expect(screen.getByTestId('sync-btn-conn-1')).toBeDisabled();
  });

  it('shows cancel button instead of sync button when lock is QUEUED', () => {
    renderRow(
      createMockConnection({
        lock: { status: LockStatus.QUEUED, lockedAt: '', lockedBy: '', flowRunId: 'flow-1' },
      })
    );
    expect(screen.queryByTestId('sync-btn-conn-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('cancel-sync-conn-1')).toBeInTheDocument();
  });

  it('hides sync and cancel buttons when canSync is false', () => {
    renderRow(createMockConnection(), { canSync: false });
    expect(screen.queryByTestId('sync-btn-conn-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cancel-sync-conn-1')).not.toBeInTheDocument();
  });

  it('shows View instead of Edit in dropdown when connection is locked', async () => {
    const user = userEvent.setup();
    renderRow(
      createMockConnection({
        lock: { status: LockStatus.RUNNING, lockedAt: '', lockedBy: '', flowRunId: 'flow-1' },
      })
    );

    await user.click(screen.getByTestId('connection-menu-conn-1'));
    await waitFor(() => {
      expect(screen.getByTestId('edit-connection-conn-1')).toHaveTextContent('View');
    });
  });

  it('calls onEdit when edit menu item is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = jest.fn();
    renderRow(createMockConnection(), { onEdit });

    await user.click(screen.getByTestId('connection-menu-conn-1'));
    await waitFor(() => expect(screen.getByTestId('edit-connection-conn-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('edit-connection-conn-1'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when delete menu item is clicked', async () => {
    const user = userEvent.setup();
    const onDelete = jest.fn();
    renderRow(createMockConnection(), { onDelete });

    await user.click(screen.getByTestId('connection-menu-conn-1'));
    await waitFor(() => expect(screen.getByTestId('delete-connection-conn-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('delete-connection-conn-1'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onViewHistory when history button is clicked', async () => {
    const user = userEvent.setup();
    const onViewHistory = jest.fn();
    renderRow(createMockConnection(), { onViewHistory });

    await user.click(screen.getByTestId('view-history-conn-1'));
    expect(onViewHistory).toHaveBeenCalledTimes(1);
  });
});
