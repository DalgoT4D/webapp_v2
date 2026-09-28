import React from 'react';
import { act, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StreamConfigTable } from '../stream-config-table';
import { useStreamConfig } from '../hooks/useStreamConfig';
import { SyncMode, DestinationSyncMode } from '@/constants/connections';
import type { SourceStream } from '@/types/connections';
import { InsightWalkthroughCoachmark } from '@/components/onboarding/insight-walkthrough-coachmark';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';

jest.mock('next/navigation', () => ({ usePathname: () => window.location.pathname }));

const stream = (name: string, supportsIncremental: boolean): SourceStream => ({
  name,
  selected: true,
  supportsIncremental,
  syncMode: SyncMode.FULL_REFRESH,
  destinationSyncMode: DestinationSyncMode.OVERWRITE,
  cursorField: '',
  primaryKey: [],
  columns: [
    {
      name: 'col_a',
      data_type: 'String',
      selected: true,
      cast_to_type: null,
      type_confirmed: false,
    },
  ],
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
  onConfirmAllColumnTypes: jest.fn(),
};

function ConfirmationTable() {
  const config = useStreamConfig();
  const { initializeStreams } = config;
  React.useEffect(() => {
    initializeStreams([stream('form_one', false)], true);
  }, [initializeStreams]);
  return (
    <StreamConfigTable
      {...baseProps}
      streams={config.streams}
      filteredStreams={config.filteredStreams}
      expandedStreams={config.expandedStreams}
      onToggleStreamExpand={config.toggleStreamExpand}
      onToggleColumn={config.toggleColumn}
      onUpdateCastType={config.updateCastType}
      onConfirmAllColumnTypes={config.confirmAllColumnTypes}
      advancedOpen={false}
      showCastColumn
      showIncremental={false}
      onToggleAdvanced={jest.fn()}
    />
  );
}

describe('StreamConfigTable progressive disclosure', () => {
  it('retains column confirmation and selection when the walkthrough goes Back and Next', async () => {
    window.history.replaceState({}, '', '/ingest');
    const user = userEvent.setup();
    render(
      <>
        <ConfirmationTable />
        <button data-testid="save-connection-btn">Create connection</button>
        <InsightWalkthroughCoachmark />
      </>
    );
    await user.click(screen.getByTestId('confirm-all-column-types-form_one'));
    const table = screen.getByTestId('streams-table');
    act(() =>
      useInsightWalkthroughStore.setState({
        active: true,
        orgSlug: 'org-a',
        flow: 'insights',
        path: 'own_data',
        stage: 'own_data_connection_create',
        reviewReturnStage: null,
        suppressCoachmark: false,
        trackedConnectionId: null,
      })
    );
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    await waitFor(() =>
      expect(useInsightWalkthroughStore.getState().stage).toBe('own_data_streams_cast')
    );
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    expect(useInsightWalkthroughStore.getState().stage).toBe('own_data_connection_create');
    expect(screen.getByTestId('streams-table')).toBe(table);
    expect(screen.getByTestId('stream-toggle-form_one')).toBeChecked();
    expect(screen.getByTestId('confirm-all-column-types-form_one')).toHaveTextContent(
      'Column types confirmed'
    );
    expect(screen.getByTestId('cast-type-form_one-col_a')).toHaveTextContent('String');
    act(() =>
      useInsightWalkthroughStore.setState({ active: false, stage: null, reviewReturnStage: null })
    );
  });
  it('hides advanced columns when advancedOpen is false', () => {
    render(<StreamConfigTable {...baseProps} advancedOpen={false} onToggleAdvanced={jest.fn()} />);
    expect(screen.getByTestId('stream-toggle-form_one')).toBeInTheDocument();
    expect(screen.queryByTestId('stream-incremental-form_one')).not.toBeInTheDocument();
    expect(screen.queryByText('Columns')).not.toBeInTheDocument();
    expect(screen.queryByTestId('expand-columns-form_one')).not.toBeInTheDocument();
    expect(screen.getByTestId('advanced-streams-toggle')).toBeInTheDocument();
    expect(screen.queryByText('Needs confirmation')).not.toBeInTheDocument();
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
    expect(
      within(screen.getByTestId('stream-row-form_one')).getByText('Needs confirmation')
    ).toBeVisible();

    await user.click(screen.getByTestId('concept-header-columns'));
    expect(onConceptFocus).toHaveBeenCalledWith('columns');
  });

  it('shows a preselected Column type dropdown with only a table-level confirmation', () => {
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
    expect(screen.getByRole('columnheader', { name: 'Column type' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Confirm type/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Cast to' })).not.toBeInTheDocument();
    expect(screen.getByText('col_a')).toBeInTheDocument();
    expect(screen.getByTestId('cast-type-form_one-col_a')).toHaveTextContent('String');
    expect(screen.queryByRole('checkbox', { name: /Confirm column type/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('confirm-all-column-types-form_one')).toHaveTextContent(
      'Confirm column types'
    );
    expect(screen.getByTestId('columns-detail-table-form_one')).toHaveClass(
      'w-[32rem]',
      'table-fixed'
    );
    expect(screen.getByRole('columnheader', { name: 'Column type' })).toHaveClass('text-left');
  });
});

describe('StreamConfigTable confirmation', () => {
  it('keeps table confirmation visible when collapsed and resets it for a reselected column', async () => {
    const user = userEvent.setup();
    render(<ConfirmationTable />);

    await user.click(screen.getByRole('button', { name: 'Confirm column types' }));
    expect(screen.getByText('Types confirmed')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Column types confirmed' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Hide columns for form_one' }));
    expect(screen.queryByText('col_a')).not.toBeInTheDocument();
    expect(screen.getByText('Types confirmed')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Show columns for form_one' }));
    await user.click(screen.getByTestId('col-toggle-form_one-col_a'));
    await user.click(screen.getByTestId('col-toggle-form_one-col_a'));
    expect(screen.getByText('Needs confirmation')).toBeVisible();
    expect(screen.queryByText('Types confirmed')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm column types' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Confirm column types' }));
    expect(screen.getByText('Types confirmed')).toBeVisible();
  });

  it('shows a completed state once every selected type in a stream is confirmed', () => {
    const confirmed = stream('form_one', false);
    confirmed.columns[0].type_confirmed = true;

    render(
      <StreamConfigTable
        {...baseProps}
        streams={[confirmed]}
        filteredStreams={[confirmed]}
        advancedOpen={false}
        showCastColumn
        showIncremental={false}
        expandedStreams={new Set(['form_one'])}
        onToggleAdvanced={jest.fn()}
      />
    );

    expect(screen.getByTestId('confirm-all-column-types-form_one')).toHaveTextContent(
      'Column types confirmed'
    );
    expect(screen.getByTestId('confirm-all-column-types-form_one')).toBeDisabled();
  });
});

describe('StreamConfigTable table controls', () => {
  it('shows an auto-expanded first table before it is selected, with mutations disabled', () => {
    const first = unselectedStream('form_one');
    render(
      <StreamConfigTable
        {...baseProps}
        streams={[first]}
        filteredStreams={[first]}
        allSelected={false}
        advancedOpen
        showCastColumn
        expandedStreams={new Set(['form_one'])}
        onToggleAdvanced={jest.fn()}
      />
    );

    expect(screen.getByTestId('expand-columns-form_one')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('col_a')).toBeInTheDocument();
    expect(screen.getByTestId('col-toggle-form_one-col_a')).toBeDisabled();
    expect(screen.getByTestId('columns-detail-table-form_one')).toHaveClass('w-[32rem]');
    expect(screen.queryByText('Needs confirmation')).not.toBeInTheDocument();
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

  it('hides the scroll hint when there is only one stream', () => {
    render(<StreamConfigTable {...baseProps} advancedOpen={false} onToggleAdvanced={jest.fn()} />);
    expect(screen.queryByTestId('streams-scroll-hint')).not.toBeInTheDocument();
  });

  it('tells the user to scroll for the tables below the fold', () => {
    const streams = [
      stream('form_one', true),
      stream('form_two', true),
      stream('form_three', true),
    ];
    render(
      <StreamConfigTable
        {...baseProps}
        streams={streams}
        filteredStreams={streams}
        advancedOpen={false}
        onToggleAdvanced={jest.fn()}
      />
    );
    expect(screen.getByTestId('streams-scroll-hint')).toHaveTextContent('Scroll to see all tables');
  });

  it('uses the streamNoun in the scroll hint', () => {
    const streams = [stream('form_one', true), stream('form_two', true)];
    render(
      <StreamConfigTable
        {...baseProps}
        streams={streams}
        filteredStreams={streams}
        streamNoun="Sheets"
        advancedOpen={false}
        onToggleAdvanced={jest.fn()}
      />
    );
    expect(screen.getByTestId('streams-scroll-hint')).toHaveTextContent('Scroll to see all sheets');
  });
});
