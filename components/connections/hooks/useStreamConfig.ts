'use client';

import { useState, useMemo, useCallback } from 'react';
import { SyncMode, DestinationSyncMode } from '@/constants/connections';
import { toastError } from '@/lib/toast';
import type { SourceStream } from '@/types/connections';

export function useStreamConfig() {
  const [streams, setStreams] = useState<SourceStream[]>([]);
  const [streamSearch, setStreamSearch] = useState('');
  const [incrementalAllStreams, setIncrementalAllStreams] = useState(false);
  const [expandedStreams, setExpandedStreams] = useState<Set<string>>(new Set());

  const toggleStream = useCallback(
    (streamName: string) => {
      setStreams((prev) =>
        prev.map((s) => {
          if (s.name !== streamName) return s;
          const nowSelected = !s.selected;
          if (nowSelected) {
            // When selecting while incrementalAllStreams is active, set incremental
            if (incrementalAllStreams) {
              return { ...s, selected: true, syncMode: SyncMode.INCREMENTAL };
            }
            return { ...s, selected: true };
          }
          // When deselecting, reset syncMode and destMode like v1
          return {
            ...s,
            selected: false,
            syncMode: s.syncMode === SyncMode.INCREMENTAL ? SyncMode.FULL_REFRESH : s.syncMode,
            destinationSyncMode:
              s.destinationSyncMode !== DestinationSyncMode.OVERWRITE
                ? DestinationSyncMode.OVERWRITE
                : s.destinationSyncMode,
          };
        })
      );
      setExpandedStreams((prev) => {
        const next = new Set(prev);
        // Only collapse when deselecting
        const stream = streams.find((s) => s.name === streamName);
        if (stream?.selected) {
          next.delete(streamName);
        }
        return next;
      });
    },
    [incrementalAllStreams, streams]
  );

  const toggleAllStreams = useCallback((selected: boolean) => {
    if (!selected) {
      setIncrementalAllStreams(false);
    }
    setStreams((prev) =>
      prev.map((s) => {
        if (selected) return { ...s, selected: true };
        return {
          ...s,
          selected: false,
          syncMode: s.syncMode === SyncMode.INCREMENTAL ? SyncMode.FULL_REFRESH : s.syncMode,
          destinationSyncMode:
            s.destinationSyncMode !== DestinationSyncMode.OVERWRITE
              ? DestinationSyncMode.OVERWRITE
              : s.destinationSyncMode,
        };
      })
    );
  }, []);

  const updateStreamSyncMode = useCallback((streamName: string, syncMode: string) => {
    setStreams((prev) =>
      prev.map((s) => {
        if (s.name !== streamName) return s;
        if (syncMode === SyncMode.INCREMENTAL) {
          let destMode = s.destinationSyncMode;
          if (destMode === DestinationSyncMode.OVERWRITE) {
            toastError.api('Cannot use Overwrite when sync mode is incremental');
            destMode = DestinationSyncMode.APPEND_DEDUP;
          }
          return { ...s, syncMode, destinationSyncMode: destMode };
        }
        return {
          ...s,
          syncMode,
          destinationSyncMode: DestinationSyncMode.OVERWRITE,
          cursorField: '',
          primaryKey: [],
        };
      })
    );
  }, []);

  const updateStreamDestMode = useCallback((streamName: string, destinationSyncMode: string) => {
    setStreams((prev) =>
      prev.map((s) => {
        if (s.name !== streamName) return s;
        if (destinationSyncMode !== DestinationSyncMode.APPEND_DEDUP) {
          return { ...s, destinationSyncMode, primaryKey: [] };
        }
        return { ...s, destinationSyncMode };
      })
    );
  }, []);

  const updateStreamCursorField = useCallback((streamName: string, cursorField: string) => {
    setStreams((prev) =>
      prev.map((s) => {
        if (s.name !== streamName) return s;
        const columns = s.columns.map((c) =>
          c.name === cursorField ? { ...c, selected: true } : c
        );
        return { ...s, cursorField, columns };
      })
    );
  }, []);

  const updateStreamPrimaryKey = useCallback((streamName: string, primaryKey: string[]) => {
    setStreams((prev) =>
      prev.map((s) => {
        if (s.name !== streamName) return s;
        const pkSet = new Set(primaryKey);
        const columns = s.columns.map((c) => (pkSet.has(c.name) ? { ...c, selected: true } : c));
        return { ...s, primaryKey, columns };
      })
    );
  }, []);

  const toggleColumn = useCallback((streamName: string, columnName: string) => {
    setStreams((prev) =>
      prev.map((s) => {
        if (s.name !== streamName) return s;
        const isCursorField = s.cursorField === columnName;
        const isPrimaryKey = s.primaryKey?.includes(columnName);
        if (isCursorField || isPrimaryKey) return s;

        return {
          ...s,
          columns: s.columns.map((c) =>
            c.name === columnName ? { ...c, selected: !c.selected } : c
          ),
        };
      })
    );
  }, []);

  const toggleStreamExpand = useCallback((streamName: string) => {
    setExpandedStreams((prev) => {
      const next = new Set(prev);
      if (next.has(streamName)) {
        next.delete(streamName);
      } else {
        next.add(streamName);
      }
      return next;
    });
  }, []);

  const handleIncrementalAllToggle = useCallback((checked: boolean) => {
    setIncrementalAllStreams(checked);
    if (checked) {
      setStreams((prev) => {
        const hasOverwrite = prev.some(
          (s) => s.destinationSyncMode === DestinationSyncMode.OVERWRITE
        );
        if (hasOverwrite) {
          toastError.api('Cannot use Overwrite when sync mode is incremental');
        }
        return prev.map((s) => {
          const destMode =
            s.destinationSyncMode === DestinationSyncMode.OVERWRITE
              ? DestinationSyncMode.APPEND_DEDUP
              : s.destinationSyncMode;
          return {
            ...s,
            syncMode: SyncMode.INCREMENTAL,
            destinationSyncMode: destMode,
          };
        });
      });
    } else {
      setStreams((prev) =>
        prev.map((s) => ({
          ...s,
          syncMode: SyncMode.FULL_REFRESH,
          destinationSyncMode:
            s.destinationSyncMode !== DestinationSyncMode.OVERWRITE
              ? DestinationSyncMode.OVERWRITE
              : s.destinationSyncMode,
        }))
      );
    }
  }, []);

  const filteredStreams = useMemo(() => {
    const sorted = [...streams].sort((a, b) => a.name.localeCompare(b.name));
    if (!streamSearch.trim()) return sorted;
    const q = streamSearch.trim().toLowerCase();
    return sorted.filter((s) => s.name.toLowerCase().startsWith(q));
  }, [streams, streamSearch]);

  const allSelected = streams.length > 0 && streams.every((s) => s.selected);
  const hasSelectedStreams = streams.some((s) => s.selected);

  const isAnyCursorAbsent = useMemo(
    () =>
      filteredStreams
        .filter((s) => s.selected && s.supportsIncremental)
        .some((s) => !s.cursorField),
    [filteredStreams]
  );

  return {
    streams,
    setStreams,
    streamSearch,
    setStreamSearch,
    incrementalAllStreams,
    expandedStreams,
    toggleStream,
    toggleAllStreams,
    updateStreamSyncMode,
    updateStreamDestMode,
    updateStreamCursorField,
    updateStreamPrimaryKey,
    toggleColumn,
    toggleStreamExpand,
    handleIncrementalAllToggle,
    filteredStreams,
    allSelected,
    hasSelectedStreams,
    isAnyCursorAbsent,
  };
}
