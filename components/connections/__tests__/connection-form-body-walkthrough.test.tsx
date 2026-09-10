/**
 * The add-source wizard's step 3 handing over to the onboarding walkthrough.
 *
 * Two decisions live in ConnectionFormBody and nowhere else: every source enters the
 * select-data coachmarks (the form looks the same whatever was picked), and the cast coachmark
 * is stepped over where casting isn't offered.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { ConnectionFormBody } from '../connection-form-body';
import { FormMode } from '@/constants/connections';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import type { WalkthroughStage } from '@/components/onboarding/insight-walkthrough-constants';

jest.mock('@/hooks/api/useSources', () => ({
  useSources: () => ({
    data: [
      { sourceId: 'pg-1', name: 'Attendance DB', sourceName: 'Postgres', icon: '' },
      { sourceId: 'gs-1', name: 'My Sheet', sourceName: 'Google Sheets', icon: '' },
    ],
  }),
}));

jest.mock('@/hooks/api/useConnections', () => ({
  useConnection: (): { data: null } => ({ data: null }),
  createConnection: jest.fn(),
  updateConnection: jest.fn(),
  triggerSync: jest.fn(),
}));

jest.mock('@/hooks/useBackendWebSocket', () => ({
  useBackendWebSocket: () => ({
    sendJsonMessage: jest.fn(),
    readyState: 3,
    lastMessage: null as MessageEvent | null,
  }),
}));

jest.mock('../stream-config-table', () => ({
  StreamConfigTable: () => <div data-testid="stream-config-table" />,
}));

jest.mock('../connection-help-panel', () => ({
  ConnectionHelpPanel: () => <div data-testid="connection-help-panel" />,
}));

// Mutable so a test can render the form before and after discovery returns. `mock`-prefixed
// for Jest's factory hoisting.
let mockStreams: unknown[] = [{ name: 'pivottest' }];

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

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

jest.mock('@/components/ingest/sources/custom/registry', () => ({
  getCustomSource: (): null => null,
}));

/** `sourceId` decides the source name, which is what gates casting. */
function renderBody(sourceId: string, mode: FormMode = FormMode.CREATE) {
  return render(
    <ConnectionFormBody
      mode={mode}
      presetSourceId={sourceId}
      onSuccess={jest.fn()}
      onCancel={jest.fn()}
    />
  );
}

function setStage(stage: WalkthroughStage | null, active = true) {
  useInsightWalkthroughStore.setState({
    active,
    stage,
    path: 'own_data',
    flow: 'insights',
    orgSlug: 'org-a',
  });
}

const stage = () => useInsightWalkthroughStore.getState().stage;

describe('ConnectionFormBody handing over to the walkthrough', () => {
  beforeEach(() => {
    mockStreams = [{ name: 'pivottest' }];
    setStage(null, false);
  });

  it('holds off until stream discovery has returned something to point at', () => {
    // Regression: both coachmarks here point into the streams table, which does not exist
    // while discovery is running. Entering early let each stage time out and hop, so the user
    // saw neither Got it and landed on "click Create".
    mockStreams = [];
    setStage('own_data_config_next');

    renderBody('gs-1');

    expect(stage()).toBe('own_data_config_next');
  });

  it('starts the select-data coachmarks for a Google Sheets run', () => {
    setStage('own_data_config_next');

    renderBody('gs-1');

    expect(stage()).toBe('own_data_streams_scroll');
  });

  it('catches up a source that skipped the configure coachmarks entirely', () => {
    // Postgres never entered the Google-Sheets-only configure stages, so it arrives here still
    // on the picker's Next stage. This form is source-agnostic, so it gets coached all the same.
    setStage('own_data_source_next');

    renderBody('pg-1');

    expect(stage()).toBe('own_data_streams_scroll');
  });

  it('steps over the cast coachmark where casting is not offered', () => {
    // The cast column renders for Google Sheets alone. Left in place, that stage would wait on
    // a dropdown the table never draws.
    setStage('own_data_streams_cast');

    renderBody('pg-1');

    expect(stage()).toBe('own_data_connection_create');
  });

  it('keeps the cast coachmark for a source that can cast', () => {
    setStage('own_data_streams_cast');

    renderBody('gs-1');

    expect(stage()).toBe('own_data_streams_cast');
  });

  it('leaves an edit of an existing connection out of the walkthrough', () => {
    // Editing is the user's own business; advancing a half-finished run off the back of it
    // would move them somewhere they never went.
    setStage('own_data_source_next');

    renderBody('gs-1', FormMode.EDIT);

    expect(stage()).toBe('own_data_source_next');
  });

  it('does nothing when no walkthrough is running', () => {
    setStage('own_data_source_next', false);

    renderBody('gs-1');

    expect(stage()).toBe('own_data_source_next');
  });
});
