import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StreamSettingsPanel } from '../stream-settings-panel';
import { DestinationSyncMode, SyncMode } from '@/constants/connections';
import type { SourceStream } from '@/types/connections';

const stream: SourceStream = {
  name: 'survey_responses',
  selected: true,
  supportsIncremental: true,
  syncMode: SyncMode.INCREMENTAL,
  destinationSyncMode: DestinationSyncMode.APPEND_DEDUP,
  cursorField: 'submission_time',
  primaryKey: ['submission_id'],
  columns: [
    {
      name: 'submission_time',
      data_type: 'timestamp',
      selected: true,
      cast_to_type: null,
    },
    { name: 'submission_id', data_type: 'string', selected: true, cast_to_type: null },
    { name: 'respondent_age', data_type: 'string', selected: true, cast_to_type: null },
  ],
  cursorFieldConfig: {
    sourceDefinedCursor: false,
    selected: ['submission_time'],
    all: ['submission_time'],
  },
  primaryKeyConfig: {
    sourceDefinedPrimaryKey: false,
    selected: [['submission_id']],
    all: [['submission_id']],
  },
};

const baseProps = {
  stream,
  disabled: false,
  isSaving: false,
  columnsOpen: false,
  onClose: jest.fn(),
  onUpdateStreamSyncMode: jest.fn(),
  onUpdateStreamDestMode: jest.fn(),
  onUpdateStreamCursorField: jest.fn(),
  onUpdateStreamPrimaryKey: jest.fn(),
  onToggleColumns: jest.fn(),
  onToggleColumn: jest.fn(),
  onUpdateCastType: jest.fn(),
};

describe('StreamSettingsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows per-table controls with inline explanations and no duplicate sync control', () => {
    render(<StreamSettingsPanel {...baseProps} />);

    expect(screen.getByRole('heading', { name: 'Advanced settings' })).toBeInTheDocument();
    expect(screen.getByTestId('settings-stream-name')).toHaveTextContent('survey_responses');
    expect(screen.getByText('Incremental')).toBeInTheDocument();
    expect(screen.getByText('Destination')).toBeInTheDocument();
    expect(screen.getByText('Cursor field')).toBeInTheDocument();
    expect(screen.getByText('Primary key')).toBeInTheDocument();
    expect(
      screen.getByText('Only bring in records added or changed since the last sync.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Sync survey_responses' })).not.toBeInTheDocument();
  });

  it('expands Columns downward to show inclusion, name, and detected type', async () => {
    const user = userEvent.setup();
    const onToggleColumns = jest.fn();
    const { rerender } = render(
      <StreamSettingsPanel {...baseProps} onToggleColumns={onToggleColumns} />
    );

    const columnsButton = screen.getByTestId('toggle-stream-columns-survey_responses');
    expect(columnsButton).toHaveAttribute('aria-expanded', 'false');
    await user.click(columnsButton);
    expect(onToggleColumns).toHaveBeenCalledWith('survey_responses');

    rerender(<StreamSettingsPanel {...baseProps} columnsOpen onToggleColumns={onToggleColumns} />);
    expect(screen.getByRole('columnheader', { name: 'Include' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Column' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Type' })).toBeInTheDocument();
    expect(screen.getByText('respondent_age')).toBeInTheDocument();
    expect(screen.getAllByText('string')).toHaveLength(2);
  });

  it('shows Cast to only when the source supports ingest casting', () => {
    const { rerender } = render(<StreamSettingsPanel {...baseProps} columnsOpen />);
    expect(screen.queryByRole('columnheader', { name: 'Cast to' })).not.toBeInTheDocument();

    rerender(
      <StreamSettingsPanel
        {...baseProps}
        stream={{
          ...stream,
          supportsIncremental: false,
          syncMode: SyncMode.FULL_REFRESH,
          destinationSyncMode: DestinationSyncMode.OVERWRITE,
          cursorField: '',
          primaryKey: [],
        }}
        columnsOpen
        showIncremental={false}
        showCastColumn
        allowedDestModes={[DestinationSyncMode.OVERWRITE, DestinationSyncMode.APPEND]}
      />
    );

    expect(screen.getByRole('columnheader', { name: 'Cast to' })).toBeInTheDocument();
    expect(screen.getByTestId('cast-column-survey_responses-respondent_age')).toBeInTheDocument();
    expect(screen.queryByText('Incremental')).not.toBeInTheDocument();
    expect(screen.queryByText('Cursor field')).not.toBeInTheDocument();
    expect(screen.queryByText('Primary key')).not.toBeInTheDocument();
  });

  it('updates a Google Sheets cast target', async () => {
    const user = userEvent.setup();
    const onUpdateCastType = jest.fn();
    render(
      <StreamSettingsPanel
        {...baseProps}
        columnsOpen
        showCastColumn
        onUpdateCastType={onUpdateCastType}
      />
    );

    await user.click(screen.getByTestId('cast-column-survey_responses-respondent_age'));
    await user.click(screen.getByRole('option', { name: 'Integer' }));

    expect(onUpdateCastType).toHaveBeenCalledWith('survey_responses', 'respondent_age', 'integer');
  }, 15_000);

  it('keeps close available in view mode and disables every mutation control', () => {
    render(<StreamSettingsPanel {...baseProps} columnsOpen showCastColumn disabled />);

    expect(screen.getByTestId('close-stream-settings')).not.toBeDisabled();
    expect(screen.getByTestId('stream-incremental-survey_responses')).toBeDisabled();
    expect(screen.getByTestId('stream-destination-survey_responses')).toHaveAttribute(
      'data-disabled'
    );
    expect(screen.getByTestId('col-toggle-survey_responses-respondent_age')).toBeDisabled();
    expect(screen.getByTestId('cast-column-survey_responses-respondent_age')).toHaveAttribute(
      'data-disabled'
    );
  });
});
