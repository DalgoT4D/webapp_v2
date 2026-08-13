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
  columns: [{ name: 'id', data_type: 'string', selected: true, cast_to_type: null }],
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
