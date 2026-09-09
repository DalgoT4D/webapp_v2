import { act, renderHook } from '@testing-library/react';
import { DestinationSyncMode, SyncMode } from '@/constants/connections';
import type { SourceStream } from '@/types/connections';
import { useStreamConfig } from '../hooks/useStreamConfig';

const stream = (name: string): SourceStream => ({
  name,
  selected: true,
  supportsIncremental: false,
  syncMode: SyncMode.FULL_REFRESH,
  destinationSyncMode: DestinationSyncMode.OVERWRITE,
  cursorField: '',
  primaryKey: [],
  columns: [
    {
      name: 'id',
      data_type: 'String',
      selected: true,
      cast_to_type: null,
      type_confirmed: false,
    },
  ],
  cursorFieldConfig: { sourceDefinedCursor: false, selected: [], all: [] },
  primaryKeyConfig: { sourceDefinedPrimaryKey: false, selected: [], all: [] },
});

const unavailableStream = (name: string): SourceStream => ({
  ...stream(name),
  selected: false,
  columns: [],
});

describe('useStreamConfig initialization', () => {
  it('auto-expands only the first table shown after discovery', () => {
    const { result } = renderHook(() => useStreamConfig());

    act(() => result.current.initializeStreams([stream('zebra'), stream('alpha')], true));

    expect(result.current.filteredStreams.map((item) => item.name)).toEqual(['alpha', 'zebra']);
    expect(result.current.expandedStreams).toEqual(new Set(['alpha']));
  });

  it('keeps every table collapsed when first-table expansion is not requested', () => {
    const { result } = renderHook(() => useStreamConfig());

    act(() => result.current.initializeStreams([stream('alpha'), stream('zebra')]));

    expect(result.current.expandedStreams).toEqual(new Set());
  });

  it('expands the first visible table even when it is not selected yet', () => {
    const { result } = renderHook(() => useStreamConfig());

    act(() =>
      result.current.initializeStreams(
        [stream('zebra'), unavailableStream('alpha'), unavailableStream('beta')],
        true
      )
    );

    expect(result.current.filteredStreams.map((item) => item.name)).toEqual([
      'alpha',
      'beta',
      'zebra',
    ]);
    expect(result.current.expandedStreams).toEqual(new Set(['alpha']));
  });

  it('clears an old expansion when a different source is initialized', () => {
    const { result } = renderHook(() => useStreamConfig());
    act(() => result.current.initializeStreams([stream('alpha'), stream('zebra')], true));

    act(() => result.current.initializeStreams([]));

    expect(result.current.expandedStreams).toEqual(new Set());
  });
});

describe('useStreamConfig column type confirmation', () => {
  it('requires every selected column to be confirmed', () => {
    const { result } = renderHook(() => useStreamConfig());
    const twoColumns = stream('responses');
    twoColumns.columns.push({
      name: 'score',
      data_type: 'Integer',
      selected: true,
      cast_to_type: null,
      type_confirmed: false,
    });
    act(() => result.current.initializeStreams([twoColumns]));

    expect(result.current.allSelectedColumnTypesConfirmed).toBe(false);
    act(() => result.current.setColumnTypeConfirmed('responses', 'id', true));
    expect(result.current.allSelectedColumnTypesConfirmed).toBe(false);
    act(() => result.current.setColumnTypeConfirmed('responses', 'score', true));
    expect(result.current.allSelectedColumnTypesConfirmed).toBe(true);
  });

  it('confirms all selected columns for only the requested stream', () => {
    const { result } = renderHook(() => useStreamConfig());
    act(() => result.current.initializeStreams([stream('first'), stream('second')]));

    act(() => result.current.confirmAllColumnTypes('first'));

    expect(result.current.streams[0].columns[0].type_confirmed).toBe(true);
    expect(result.current.streams[1].columns[0].type_confirmed).toBe(false);
    expect(result.current.allSelectedColumnTypesConfirmed).toBe(false);
  });

  it('requires reconfirmation after the selected column type changes', () => {
    const { result } = renderHook(() => useStreamConfig());
    const confirmed = stream('responses');
    confirmed.columns[0].type_confirmed = true;
    act(() => result.current.initializeStreams([confirmed]));
    expect(result.current.allSelectedColumnTypesConfirmed).toBe(true);

    act(() => result.current.updateCastType('responses', 'id', 'integer'));

    expect(result.current.streams[0].columns[0]).toMatchObject({
      cast_to_type: 'integer',
      type_confirmed: false,
    });
    expect(result.current.allSelectedColumnTypesConfirmed).toBe(false);
  });

  it('does not require confirmation for columns that are not being ingested', () => {
    const { result } = renderHook(() => useStreamConfig());
    const partlySelected = stream('responses');
    partlySelected.columns.push({
      name: 'ignored',
      data_type: 'String',
      selected: false,
      cast_to_type: null,
      type_confirmed: false,
    });
    partlySelected.columns[0].type_confirmed = true;
    act(() => result.current.initializeStreams([partlySelected]));

    expect(result.current.allSelectedColumnTypesConfirmed).toBe(true);
  });
});
