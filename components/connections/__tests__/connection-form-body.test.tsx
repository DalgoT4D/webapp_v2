/**
 * Connection Form Body Tests
 *
 * ConnectionFormBody is the Dialog-free core of ConnectionForm, reused by the
 * add-source wizard's step 3 (source preset + locked, no picker).
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionFormBody } from '../connection-form-body';
import { FormMode } from '@/constants/connections';
import { createConnection, triggerSync } from '@/hooks/api/useConnections';
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

// Mutable so a test can simulate discovered streams (the settings split only
// appears once discovery returns rows). Prefixed `mock` for hoisting.
let mockStreams: unknown[] = [];
let mockHasSelectedStreams = false;
let mockStreamTableProps: Record<string, unknown> | null = null;
let mockSettingsPanelProps: Record<string, unknown> | null = null;

afterEach(() => {
  mockConnectionData = null;
  mockStreams = [];
  mockHasSelectedStreams = false;
  mockStreamTableProps = null;
  mockSettingsPanelProps = null;
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
  StreamConfigTable: (props: Record<string, unknown>) => {
    mockStreamTableProps = props;
    return (
      <button
        type="button"
        data-testid="stream-config-table"
        onClick={() => (props.onOpenSettings as (streamName: string) => void)('sheet1')}
      >
        Open settings
      </button>
    );
  },
}));

jest.mock('../stream-settings-panel', () => ({
  StreamSettingsPanel: (props: Record<string, unknown>) => {
    mockSettingsPanelProps = props;
    return (
      <button
        type="button"
        data-testid="stream-settings-panel"
        onClick={() => (props.onClose as () => void)()}
      >
        Close settings
      </button>
    );
  },
}));

jest.mock('../hooks/useStreamConfig', () => ({
  useStreamConfig: (): Record<string, unknown> => ({
    streams: mockStreams,
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
    hasSelectedStreams: mockHasSelectedStreams,
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

describe('ConnectionFormBody settings inspector + custom view', () => {
  it('shows the settings placeholder after streams are discovered', () => {
    const { rerender } = render(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="src-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.queryByTestId('stream-settings-placeholder')).not.toBeInTheDocument();

    mockStreams = [{ name: 'sheet1', selected: true, columns: [] }];
    rerender(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="src-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.getByTestId('stream-settings-placeholder')).toBeInTheDocument();
  });

  it('keeps Normalize visible and tucks Destination Schema under Advanced options', () => {
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
    expect(screen.getByTestId('normalize-toggle')).toBeInTheDocument();
    expect(screen.queryByTestId('destination-schema-input')).not.toBeInTheDocument();
  });

  it('uses the same connection-level disclosure for a custom source', () => {
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

  it('explains what normalization does and its sync impact', async () => {
    const user = userEvent.setup();
    render(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="src-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    const helpTrigger = screen.getByRole('button', {
      name: 'About Normalize data after sync',
    });
    await user.hover(helpTrigger);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(
      'Organizes the raw records copied from your source into structured warehouse tables'
    );
    expect(tooltip).toHaveTextContent('adds an extra processing step after each sync');
  });

  it('opens and closes one table settings panel from the streams table', async () => {
    const user = userEvent.setup();
    mockStreams = [{ name: 'sheet1', selected: true, columns: [] }];
    render(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="src-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByTestId('stream-settings-placeholder')).toBeInTheDocument();
    await user.click(screen.getByTestId('stream-config-table'));

    expect(screen.getByTestId('stream-settings-panel')).toBeInTheDocument();
    expect(mockSettingsPanelProps?.stream).toEqual(mockStreams[0]);

    await user.click(screen.getByTestId('stream-settings-panel'));
    expect(screen.getByTestId('stream-settings-placeholder')).toBeInTheDocument();
  });

  it('enables Cast to for Google Sheets only', async () => {
    const user = userEvent.setup();
    mockStreams = [{ name: 'sheet1', selected: true, columns: [] }];
    const { rerender } = render(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="gs-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    await user.click(screen.getByTestId('stream-config-table'));
    expect(mockSettingsPanelProps?.showCastColumn).toBe(true);
    expect(mockSettingsPanelProps?.showIncremental).toBe(false);

    mockSettingsPanelProps = null;
    rerender(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="kb-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(mockStreamTableProps).not.toBeNull();
    await user.click(screen.getByTestId('stream-config-table'));
    expect(mockSettingsPanelProps?.showCastColumn).toBe(false);
  });

  it('preserves Google Sheets column casts in the connection save payload', async () => {
    const user = userEvent.setup();
    mockHasSelectedStreams = true;
    mockStreams = [
      {
        name: 'sheet1',
        selected: true,
        supportsIncremental: false,
        syncMode: 'full_refresh',
        destinationSyncMode: 'overwrite',
        cursorField: '',
        primaryKey: [],
        columns: [
          {
            name: 'respondent_age',
            data_type: 'String',
            selected: true,
            cast_to_type: 'integer',
          },
          {
            name: 'respondent_name',
            data_type: 'String',
            selected: true,
            cast_to_type: null,
          },
        ],
      },
    ];
    jest.mocked(createConnection).mockResolvedValue({
      connectionId: 'connection-1',
      deploymentId: 'deployment-1',
    } as never);
    jest.mocked(triggerSync).mockResolvedValue(undefined as never);

    render(
      <ConnectionFormBody
        mode={FormMode.CREATE}
        presetSourceId="gs-1"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    await user.click(screen.getByTestId('save-connection-btn'));

    await waitFor(() => expect(createConnection).toHaveBeenCalledTimes(1));
    expect(jest.mocked(createConnection).mock.calls[0][0]).toMatchObject({
      post_sync_transform: {
        ops: [
          {
            type: 'cast',
            schema: 'staging',
            table: 'sheet1',
            config: { respondent_age: 'integer' },
          },
        ],
      },
    });
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
    expect(screen.getByTestId('advanced-options-toggle')).toBeInTheDocument();
    expect(onHeaderInfoChange).toHaveBeenCalledWith({
      sourceName: 'My Sheet',
      streamNoun: 'Tables',
    });
  });
});
