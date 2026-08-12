import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StreamConfigTable } from '../stream-config-table';
import { DestinationSyncMode, SyncMode } from '@/constants/connections';
import type { SourceStream } from '@/types/connections';

const makeStream = (name: string, selected = true): SourceStream => ({
  name,
  selected,
  supportsIncremental: true,
  syncMode: SyncMode.FULL_REFRESH,
  destinationSyncMode: DestinationSyncMode.OVERWRITE,
  cursorField: '',
  primaryKey: [],
  columns: [{ name: 'col_a', data_type: 'string', selected: true, cast_to_type: null }],
  cursorFieldConfig: { sourceDefinedCursor: false, selected: [], all: [] },
  primaryKeyConfig: { sourceDefinedPrimaryKey: false, selected: [], all: [] },
});

const streams = [makeStream('form_one'), makeStream('form_two', false)];

const baseProps = {
  streams,
  filteredStreams: streams,
  allSelected: false,
  streamSearch: '',
  disabled: false,
  isSaving: false,
  activeStreamName: null as string | null,
  onStreamSearchChange: jest.fn(),
  onToggleAllStreams: jest.fn(),
  onToggleStream: jest.fn(),
  onOpenSettings: jest.fn(),
};

describe('StreamConfigTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps sync in the table and moves per-table options behind one settings action', () => {
    render(<StreamConfigTable {...baseProps} />);

    expect(screen.getByRole('columnheader', { name: 'Tables' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Sync' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Advanced settings' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Sync form_one' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open advanced settings for form_one' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Incremental')).not.toBeInTheDocument();
    expect(screen.queryByText('Destination')).not.toBeInTheDocument();
  });

  it('toggles sync for an individual table', async () => {
    const user = userEvent.setup();
    const onToggleStream = jest.fn();
    render(<StreamConfigTable {...baseProps} onToggleStream={onToggleStream} />);

    await user.click(screen.getByTestId('stream-toggle-form_one'));

    expect(onToggleStream).toHaveBeenCalledWith('form_one');
  });

  it('opens the selected table settings and highlights its row', async () => {
    const user = userEvent.setup();
    const onOpenSettings = jest.fn();
    const { rerender } = render(
      <StreamConfigTable {...baseProps} onOpenSettings={onOpenSettings} />
    );

    await user.click(screen.getByTestId('open-stream-settings-form_two'));
    expect(onOpenSettings).toHaveBeenCalledWith('form_two');

    rerender(
      <StreamConfigTable
        {...baseProps}
        activeStreamName="form_two"
        onOpenSettings={onOpenSettings}
      />
    );
    expect(screen.getByTestId('stream-row-form_two')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('open-stream-settings-form_two')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('shows high-volume table tools and toggles all streams', async () => {
    const user = userEvent.setup();
    const manyStreams = Array.from({ length: 6 }, (_, index) => makeStream(`form_${index}`));
    const onToggleAllStreams = jest.fn();
    render(
      <StreamConfigTable
        {...baseProps}
        streams={manyStreams}
        filteredStreams={manyStreams}
        allSelected
        onToggleAllStreams={onToggleAllStreams}
      />
    );

    expect(screen.getByTestId('stream-filter-input')).toBeInTheDocument();
    await user.click(screen.getByTestId('toggle-all-streams'));
    expect(onToggleAllStreams).toHaveBeenCalledWith(false);
  });

  it('supports source-specific table nouns', () => {
    render(<StreamConfigTable {...baseProps} streamNoun="Sheets" />);
    expect(screen.getByRole('columnheader', { name: 'Sheets' })).toBeInTheDocument();
    expect(screen.getByText('Select your sheets (1/2 selected)')).toBeInTheDocument();
  });

  it('keeps settings exploration available in read-only mode while disabling sync', () => {
    render(<StreamConfigTable {...baseProps} disabled />);
    expect(screen.getByTestId('stream-toggle-form_one')).toBeDisabled();
    expect(screen.getByTestId('open-stream-settings-form_one')).not.toBeDisabled();
  });
});
