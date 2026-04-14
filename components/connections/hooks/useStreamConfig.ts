'use client';

import { useState, useMemo, useCallback } from 'react';
import { SyncMode, DestinationSyncMode } from '@/constants/connections';
import { toastError } from '@/lib/toast';
import type { SourceStream } from '@/types/connections';

// Manages stream selection, sync modes, columns, and filtering for connection setup
export function useStreamConfig() {
  const [streams, setStreams] = useState<SourceStream[]>([]);
  const [streamSearch, setStreamSearch] = useState('');
  const [incrementalAllStreams, setIncrementalAllStreams] = useState(false);
  const [expandedStreams, setExpandedStreams] = useState<Set<string>>(new Set());

  // Toggle a single stream's selection; resets sync/dest modes on deselect
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

  // Select or deselect all streams at once; resets modes on deselect
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

  // Set sync mode for a stream; enforces dest mode constraints (no overwrite with incremental)
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

  // Set destination sync mode; clears primary key if not append_dedup
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

  // Set cursor field for incremental sync; auto-selects the cursor column
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

  // Set primary key columns for dedup; auto-selects those columns
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

  // Toggle a column's selection; prevents deselecting cursor or primary key columns
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

  // Expand or collapse a stream's detail view
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

  // Bulk-toggle incremental sync for all streams; swaps dest modes accordingly
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

  // Alphabetically sorted streams filtered by search query
  const filteredStreams = useMemo(() => {
    const sorted = [...streams].sort((a, b) => a.name.localeCompare(b.name));
    if (!streamSearch.trim()) return sorted;
    const q = streamSearch.trim().toLowerCase();
    return sorted.filter((s) => s.name.toLowerCase().startsWith(q));
  }, [streams, streamSearch]);

  const allSelected = streams.length > 0 && streams.every((s) => s.selected);
  const hasSelectedStreams = streams.some((s) => s.selected);

  // True if any selected incremental stream is missing a cursor field
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
