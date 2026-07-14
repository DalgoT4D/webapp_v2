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
import type { Connection } from '@/types/connections';

// ============ Mocks ============

jest.mock('@/hooks/api/useSources', () => ({
  useSources: () => ({
    data: [
      { sourceId: 'src-1', name: 'Attendance Sheet', sourceName: 'Postgres', icon: '' },
      { sourceId: 'gs-1', name: 'My Sheet', sourceName: 'Google Sheets', icon: '' },
      { sourceId: 'kb-1', name: 'My Kobo', sourceName: 'KoboToolbox', icon: '' },
    ],
  }),
}));

// Mutable so edit-mode tests can supply a connection. Prefixed `mock` so Jest's
// factory hoisting allows the reference.
let mockConnectionData: Connection | null = null;
jest.mock('@/hooks/api/useConnections', () => ({
  useConnection: () => ({ data: mockConnectionData }),
  createConnection: jest.fn(),
  updateConnection: jest.fn(),
  triggerSync: jest.fn(),
}));

// Mutable so a test can simulate discovered streams (the help panel + streams
// table only appear once discovery returns rows). Prefixed `mock` for hoisting.
let mockStreams: unknown[] = [];

afterEach(() => {
  mockConnectionData = null;
  mockStreams = [];
});

jest.mock('@/hooks/useBackendWebSocket', () => ({
  // readyState CLOSED so the auto-discovery effect doesn't latch isDiscovering
  // (the mock never delivers a "done" message). Tests drive streams directly via
  // mockStreams instead of the socket.
  useBackendWebSocket: () => ({
    sendJsonMessage: jest.fn(),
    readyState: 3, // ReadyState.CLOSED
    lastMessage: null as MessageEvent | null,
  }),
}));

jest.mock('../stream-config-table', () => ({
  StreamConfigTable: (_props: Record<string, unknown>) => <div data-testid="stream-config-table" />,
}));

jest.mock('../connection-help-panel', () => ({
  ConnectionHelpPanel: (_props: Record<string, unknown>) => (
    <div data-testid="connection-help-panel" />
  ),
}));

jest.mock('../hooks/useStreamConfig', () => ({
  useStreamConfig: (): Record<string, unknown> => ({
    streams: mockStreams,
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
    filteredStreams: mockStreams,
    allSelected: false,
    hasSelectedStreams: false,
  }),
}));

jest.mock('@/lib/toast', () => ({
  toastSuccess: { created: jest.fn(), updated: jest.fn(), deleted: jest.fn(), generic: jest.fn() },
  toastError: { save: jest.fn(), api: jest.fn(), delete: jest.fn() },
}));

jest.mock('@/lib/analytics', () => ({
  trackEvent: jest.fn(),
}));

jest.mock('@/components/ingest/sources/custom/registry', () => ({
  getCustomSource: (sourceName: string) => {
    if (sourceName === 'Google Sheets') {
      return {
        connectionView: {
          streamNoun: 'sheet',
          supportsIncremental: false,
          allowedDestModes: ['overwrite'],
        },
      };
    }
    return null;
  },
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

describe('ConnectionFormBody split help + custom view', () => {
  it('hides the help panel until streams are discovered, then shows it', () => {
    const { rerender } = render(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="src-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    // No streams yet → no empty docs column.
    expect(screen.queryByTestId('connection-help-panel')).not.toBeInTheDocument();

    // Discovery returns rows → panel appears.
    mockStreams = [{ name: 'sheet1', selected: true }];
    rerender(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="src-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.getByTestId('connection-help-panel')).toBeInTheDocument();
  });

  it('tucks schema + normalize under Advanced options for a generic source too', () => {
    render(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="src-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    // Every connection now uses the bottom Advanced-options section, collapsed.
    expect(screen.getByTestId('advanced-options-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('destination-schema-input')).not.toBeInTheDocument();
  });

  it('tucks schema + normalize under Advanced options for a custom source', () => {
    render(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="gs-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.getByTestId('advanced-options-toggle')).toBeInTheDocument();
    // collapsed by default
    expect(screen.queryByTestId('destination-schema-input')).not.toBeInTheDocument();
  });

  it('reports header info (not a body chip) for a custom source in create', () => {
    const onHeaderInfoChange = jest.fn();
    render(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="gs-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
        onHeaderInfoChange={onHeaderInfoChange}
      />
    );
    // In the wizard flow the success/identity copy moves to the modal header,
    // so the body no longer renders the chip.
    expect(screen.queryByTestId('connection-source-chip')).not.toBeInTheDocument();
    expect(onHeaderInfoChange).toHaveBeenCalledWith({
      sourceName: 'My Sheet',
      streamNoun: 'sheet',
    });
  });

  it('hides both the source chip and read-only Source box for a custom source in create', () => {
    render(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="gs-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    // Create flow: identity lives in the header, so neither the chip nor the
    // generic read-only source box appears in the body.
    expect(screen.queryByTestId('connection-source-chip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('connection-source-name')).not.toBeInTheDocument();
  });

  it('renders the custom view in edit mode even when the connection source name is empty', () => {
    // The single-connection GET returns a sparse source ({ id, name } only — no
    // sourceName/sourceId), so detection must fall back to the sources list by
    // the source's display name. 'My Sheet' is the gs-1 (Google Sheets) source.
    mockConnectionData = {
      name: 'akansha connection',
      connectionId: 'c1',
      source: { id: 'gs-1', name: 'My Sheet' },
      normalize: false,
      catalogId: 'cat-1',
      syncCatalog: { streams: [] },
    } as unknown as Connection;

    render(
      <ConnectionFormBody
        mode={FormMode.EDIT}
        connectionId="c1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    // Custom view active → chip shown, no generic read-only source box.
    expect(screen.getByTestId('connection-source-chip')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-options-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('connection-source-name')).not.toBeInTheDocument();
  });
});
