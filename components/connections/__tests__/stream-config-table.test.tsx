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
  columns: [{ name: 'col_a', data_type: 'string', selected: true, cast_to_type: null }],
  cursorFieldConfig: { sourceDefinedCursor: false, selected: [], all: [] },
  primaryKeyConfig: { sourceDefinedPrimaryKey: false, selected: [], all: [] },
});

const unselectedStream = (name: string): SourceStream => ({
  ...stream(name, true),
  selected: false,
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
  onUpdateCastType: jest.fn(),
};

describe('StreamConfigTable progressive disclosure', () => {
  it('hides advanced columns when advancedOpen is false', () => {
    render(<StreamConfigTable {...baseProps} advancedOpen={false} onToggleAdvanced={jest.fn()} />);
    expect(screen.getByTestId('stream-toggle-form_one')).toBeInTheDocument();
    expect(screen.queryByTestId('stream-incremental-form_one')).not.toBeInTheDocument();
    expect(screen.queryByText('Columns')).not.toBeInTheDocument();
    expect(screen.queryByTestId('expand-columns-form_one')).not.toBeInTheDocument();
    expect(screen.getByTestId('advanced-streams-toggle')).toBeInTheDocument();
  });

  it('keeps Google Sheets columns accessible while advanced settings are closed', async () => {
    const user = userEvent.setup();
    const onConceptFocus = jest.fn();
    render(
      <StreamConfigTable
        {...baseProps}
        advancedOpen={false}
        showCastColumn
        showIncremental={false}
        onConceptFocus={onConceptFocus}
        onToggleAdvanced={jest.fn()}
      />
    );

    expect(screen.getByText('Columns')).toBeInTheDocument();
    expect(screen.getByTestId('expand-columns-form_one')).toBeInTheDocument();
    expect(screen.queryByText('Destination')).not.toBeInTheDocument();
    expect(screen.queryByText('Incremental?')).not.toBeInTheDocument();
    expect(screen.queryByText('Cursor Field')).not.toBeInTheDocument();
    expect(screen.queryByText('Primary Key')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('concept-header-columns'));
    expect(onConceptFocus).toHaveBeenCalledWith('columns');
  });

  it('shows Google Sheets column names, detected types, and casts while advanced is closed', () => {
    render(
      <StreamConfigTable
        {...baseProps}
        advancedOpen={false}
        showCastColumn
        showIncremental={false}
        expandedStreams={new Set(['form_one'])}
        onToggleAdvanced={jest.fn()}
      />
    );

    expect(screen.getByRole('columnheader', { name: 'Column' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Type' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Cast to' })).toBeInTheDocument();
    expect(screen.getByText('col_a')).toBeInTheDocument();
    expect(screen.getByText('string')).toBeInTheDocument();
    expect(screen.getByTestId('cast-type-form_one-col_a')).toBeInTheDocument();
    expect(screen.getByTestId('columns-detail-table-form_one')).toHaveClass(
      'w-[42rem]',
      'table-fixed'
    );
    expect(screen.getByRole('columnheader', { name: 'Type' })).toHaveClass('text-left');
  });

  it('shows an auto-expanded first table before it is selected, with mutations disabled', () => {
    const first = unselectedStream('form_one');
    render(
      <StreamConfigTable
        {...baseProps}
        streams={[first]}
        filteredStreams={[first]}
        allSelected={false}
        advancedOpen
        expandedStreams={new Set(['form_one'])}
        onToggleAdvanced={jest.fn()}
      />
    );

    expect(screen.getByTestId('expand-columns-form_one')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('col_a')).toBeInTheDocument();
    expect(screen.getByTestId('col-toggle-form_one-col_a')).toBeDisabled();
    expect(screen.getByTestId('columns-detail-table-form_one')).toHaveClass('w-[32rem]');
  });

  it('shows advanced columns when advancedOpen is true', () => {
    render(<StreamConfigTable {...baseProps} advancedOpen onToggleAdvanced={jest.fn()} />);
    expect(screen.getByTestId('stream-incremental-form_one')).toBeInTheDocument();
  });

  it('keeps the full advanced table readable inside a horizontal scroll region', () => {
    render(<StreamConfigTable {...baseProps} advancedOpen onToggleAdvanced={jest.fn()} />);

    expect(screen.getByRole('region', { name: 'Advanced per-table settings' })).toHaveClass(
      'overflow-x-auto'
    );
    expect(screen.getByTestId('streams-table')).toHaveClass('min-w-[1080px]');
  });

  it('uses a smaller horizontal scroll width for Google Sheets advanced settings', () => {
    render(
      <StreamConfigTable
        {...baseProps}
        advancedOpen
        showCastColumn
        showIncremental={false}
        onToggleAdvanced={jest.fn()}
      />
    );

    expect(screen.getByRole('region', { name: 'Advanced per-table settings' })).toHaveClass(
      'overflow-x-auto'
    );
    expect(screen.getByTestId('streams-table')).toHaveClass('min-w-[760px]');
    expect(screen.getByTestId('streams-table')).not.toHaveClass('min-w-[1080px]');
  });

  it('does not force a wide table when no crowded advanced columns are present', () => {
    render(
      <StreamConfigTable
        {...baseProps}
        advancedOpen
        showIncremental={false}
        onToggleAdvanced={jest.fn()}
      />
    );

    expect(screen.getByTestId('streams-table')).not.toHaveClass('min-w-[760px]');
    expect(screen.getByTestId('streams-table')).not.toHaveClass('min-w-[1080px]');
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

  it('hides Cursor Field and Primary Key when showIncremental is false, keeping Destination', () => {
    render(
      <StreamConfigTable
        {...baseProps}
        advancedOpen
        showIncremental={false}
        streamNoun="Sheets"
        onToggleAdvanced={jest.fn()}
      />
    );
    expect(screen.queryByText('Cursor Field')).not.toBeInTheDocument();
    expect(screen.queryByText('Primary Key')).not.toBeInTheDocument();
    expect(screen.getByText('Destination')).toBeInTheDocument();
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

    await user.click(screen.getByTestId('concept-header-sync'));
    expect(onConceptFocus).toHaveBeenCalledWith('sync');
  });

  it('renders the "Select your" heading using the given streamNoun', () => {
    render(
      <StreamConfigTable
        {...baseProps}
        streamNoun="Sheets"
        advancedOpen={false}
        onToggleAdvanced={jest.fn()}
      />
    );
    expect(screen.getByText(/Select your sheets/)).toBeInTheDocument();
  });
});
