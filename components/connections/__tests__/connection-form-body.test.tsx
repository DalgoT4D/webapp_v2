/**
 * Connection Form Body Tests
 *
 * ConnectionFormBody is the Dialog-free core of ConnectionForm, reused by the
 * add-source wizard's step 3 (source preset + locked, no picker).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionFormBody } from '../connection-form-body';
import { FormMode } from '@/constants/connections';

// ============ Mocks ============

jest.mock('@/hooks/api/useSources', () => ({
  useSources: () => ({ data: [{ sourceId: 'src-1', name: 'Attendance Sheet', icon: '' }] }),
}));

jest.mock('@/hooks/useBackendWebSocket', () => ({
  useBackendWebSocket: () => ({
    sendJsonMessage: jest.fn(),
    readyState: 1, // ReadyState.OPEN
    lastMessage: null as MessageEvent | null,
  }),
}));

jest.mock('../stream-config-table', () => ({
  StreamConfigTable: () => <div data-testid="stream-config-table" />,
}));

jest.mock('../hooks/useStreamConfig', () => ({
  useStreamConfig: (): Record<string, unknown> => ({
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

// ============ ConnectionFormBody Tests ============

describe('ConnectionFormBody', () => {
  it('locks the source (no picker) when presetSourceId is given', () => {
    render(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="src-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByText('Attendance Sheet')).toBeInTheDocument();
    expect(screen.queryByTestId('source-select')).not.toBeInTheDocument();
    expect(screen.queryByTestId('source-select-input')).not.toBeInTheDocument();
  });

  it('shows the source picker when presetSourceId is not given', () => {
    render(
      <ConnectionFormBody mode={FormMode.CREATE} onSuccess={jest.fn()} onCancel={jest.fn()} />
    );

    expect(screen.getByTestId('source-select-input')).toBeInTheDocument();
  });

  it('renders no Dialog wrapper and calls onCancel from the default footer', async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    render(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="src-1"
        onSuccess={jest.fn()}
        onCancel={onCancel}
      />
    );

    // No Dialog role — this renders as a plain body, not a modal.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders a custom footerSlot instead of the default footer buttons', () => {
    render(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="src-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
        footerSlot={<div data-testid="wizard-footer">Wizard footer</div>}
      />
    );

    expect(screen.getByTestId('wizard-footer')).toBeInTheDocument();
    expect(screen.queryByTestId('save-connection-btn')).not.toBeInTheDocument();
  });
});
