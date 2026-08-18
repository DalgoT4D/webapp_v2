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
  StreamConfigTable: (props: Record<string, unknown>) => (
    <div data-testid="stream-config-table">
      <button
        type="button"
        onClick={() => (props.onConceptFocus as (concept: string) => void | undefined)?.('columns')}
      >
        Columns header
      </button>
    </div>
  ),
}));

jest.mock('../connection-help-panel', () => ({
  ConnectionHelpPanel: (props: Record<string, unknown>) => (
    <div data-testid="connection-help-panel">
      <span data-testid="active-help-concept">{String(props.activeConcept ?? '')}</span>
      <button type="button" onClick={props.onCollapse as () => void}>
        Collapse table settings help
      </button>
    </div>
  ),
}));

jest.mock('../hooks/useStreamConfig', () => ({
  useStreamConfig: (): Record<string, unknown> => ({
    streams: mockStreams,
    setStreams: jest.fn(),
    initializeStreams: jest.fn(),
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
    updateCastType: jest.fn(),
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
          streamNoun: 'Tables',
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

  it('shows connection-wide settings without an Advanced options toggle', () => {
    render(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="src-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.queryByTestId('advanced-options-toggle')).not.toBeInTheDocument();
    expect(screen.getByTestId('destination-schema-input')).toBeInTheDocument();
    expect(screen.getByTestId('normalize-toggle')).toBeInTheDocument();
  });

  it('shows the same connection-wide settings for a custom source', () => {
    render(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="gs-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.queryByTestId('advanced-options-toggle')).not.toBeInTheDocument();
    expect(screen.getByTestId('destination-schema-input')).toBeInTheDocument();
    expect(screen.getByTestId('normalize-toggle')).toBeInTheDocument();
  });

  it('briefly explains what normalization does', async () => {
    const user = userEvent.setup();
    render(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="src-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    await user.hover(
      screen.getByRole('button', {
        name: 'About Normalize data after sync',
      })
    );

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Renames columns to an SQL-compliant format.');
  });

  it('explains Destination Schema beside its right-aligned input', async () => {
    const user = userEvent.setup();
    render(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="src-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    await user.hover(screen.getByRole('button', { name: 'About Destination Schema' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'The warehouse folder where synced tables are created. Defaults to staging.'
    );
    expect(screen.getByTestId('destination-schema-input')).toHaveClass('w-48');
  });

  it('collapses help to a visible rail and reopens it when a table header is clicked', async () => {
    const user = userEvent.setup();
    mockStreams = [{ name: 'sheet1', selected: true }];
    render(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="src-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Collapse table settings help' }));
    expect(screen.queryByTestId('connection-help-panel')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open table settings help' })).toHaveTextContent(
      'What these options mean'
    );
    expect(screen.getByTestId('connection-help-expand-label')).not.toHaveClass(
      '[writing-mode:vertical-rl]'
    );

    await user.click(screen.getByRole('button', { name: 'Columns header' }));
    expect(screen.getByTestId('connection-help-panel')).toBeInTheDocument();
    expect(screen.getByTestId('active-help-concept')).toHaveTextContent('columns');
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
      streamNoun: 'Tables',
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

    const onHeaderInfoChange = jest.fn();
    render(
      <ConnectionFormBody
        mode={FormMode.EDIT}
        connectionId="c1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
        onHeaderInfoChange={onHeaderInfoChange}
      />
    );

    // Custom view active → identity moves to the header (reported via
    // onHeaderInfoChange) for every mode, so the body shows neither the source
    // chip nor the generic read-only source box.
    expect(screen.queryByTestId('connection-source-chip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('connection-source-name')).not.toBeInTheDocument();
    expect(screen.queryByTestId('advanced-options-toggle')).not.toBeInTheDocument();
    expect(screen.getByTestId('destination-schema-input')).toBeInTheDocument();
    expect(onHeaderInfoChange).toHaveBeenCalledWith({
      sourceName: 'My Sheet',
      streamNoun: 'Tables',
    });
  });
});
