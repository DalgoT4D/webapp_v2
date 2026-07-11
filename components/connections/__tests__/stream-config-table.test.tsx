import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StreamConfigTable } from '../stream-config-table';
import { SyncMode, DestinationSyncMode } from '@/constants/connections';
import type { SourceStream } from '@/types/connections';

const stream = (name: string, supportsIncremental: boolean): SourceStream => ({
  name,
  selected: true,
  supportsIncremental,
  syncMode: SyncMode.FULL_REFRESH,
  destinationSyncMode: DestinationSyncMode.OVERWRITE,
  cursorField: '',
  primaryKey: [],
  columns: [{ name: 'col_a', data_type: 'string', selected: true }],
  cursorFieldConfig: { sourceDefinedCursor: false, selected: [], all: [] },
  primaryKeyConfig: { sourceDefinedPrimaryKey: false, selected: [], all: [] },
});

const baseProps = {
  streams: [stream('form_one', true)],
  filteredStreams: [stream('form_one', true)],
  allSelected: true,
  incrementalAllStreams: false,
  expandedStreams: new Set<string>(),
  streamSearch: '',
  disabled: false,
  isSaving: false,
  onStreamSearchChange: jest.fn(),
  onToggleAllStreams: jest.fn(),
  onIncrementalAllToggle: jest.fn(),
  onToggleStream: jest.fn(),
  onUpdateStreamSyncMode: jest.fn(),
  onUpdateStreamDestMode: jest.fn(),
  onUpdateStreamCursorField: jest.fn(),
  onUpdateStreamPrimaryKey: jest.fn(),
  onToggleStreamExpand: jest.fn(),
  onToggleColumn: jest.fn(),
};

describe('StreamConfigTable progressive disclosure', () => {
  it('hides advanced columns when advancedOpen is false', () => {
    render(<StreamConfigTable {...baseProps} advancedOpen={false} onToggleAdvanced={jest.fn()} />);
    expect(screen.getByTestId('stream-toggle-form_one')).toBeInTheDocument();
    expect(screen.queryByTestId('stream-incremental-form_one')).not.toBeInTheDocument();
    expect(screen.getByTestId('advanced-streams-toggle')).toBeInTheDocument();
  });

  it('shows advanced columns when advancedOpen is true', () => {
    render(<StreamConfigTable {...baseProps} advancedOpen onToggleAdvanced={jest.fn()} />);
    expect(screen.getByTestId('stream-incremental-form_one')).toBeInTheDocument();
  });

  it('uses the streamNoun for the column header', () => {
    render(
      <StreamConfigTable
        {...baseProps}
        advancedOpen
        streamNoun="Tabs"
        onToggleAdvanced={jest.fn()}
      />
    );
    expect(screen.getByText('Tabs')).toBeInTheDocument();
  });

  it('hides the Incremental column when showIncremental is false', () => {
    render(
      <StreamConfigTable
        {...baseProps}
        advancedOpen
        showIncremental={false}
        onToggleAdvanced={jest.fn()}
      />
    );
    expect(screen.queryByTestId('stream-incremental-form_one')).not.toBeInTheDocument();
  });

  it('omits dest modes not in allowedDestModes', () => {
    render(
      <StreamConfigTable
        {...baseProps}
        advancedOpen
        allowedDestModes={[DestinationSyncMode.OVERWRITE, DestinationSyncMode.APPEND]}
        onToggleAdvanced={jest.fn()}
      />
    );
    // The Append/Dedup item must not be in the rendered select content.
    expect(screen.queryByText('Append / Dedup')).not.toBeInTheDocument();
  });

  it('moves the help panel to a concept when its column header is clicked', async () => {
    const user = userEvent.setup();
    const onConceptFocus = jest.fn();
    render(
      <StreamConfigTable
        {...baseProps}
        advancedOpen
        onConceptFocus={onConceptFocus}
        onToggleAdvanced={jest.fn()}
      />
    );
    await user.click(screen.getByTestId('concept-header-cursor'));
    expect(onConceptFocus).toHaveBeenCalledWith('cursor');
  });

  it('renders the friendly help text and "Select your" heading for custom sources', () => {
    render(
      <StreamConfigTable
        {...baseProps}
        streamNoun="Sheets"
        helpText="All sheets are synced by default."
        advancedOpen={false}
        onToggleAdvanced={jest.fn()}
      />
    );
    expect(screen.getByText('All sheets are synced by default.')).toBeInTheDocument();
    expect(screen.getByText(/Select your sheets/)).toBeInTheDocument();
  });
});
