import { useState, useCallback } from 'react';

export interface ViewerSortValue {
  column: string;
  direction: 'asc' | 'desc';
}

// Internal session state. `direction: null` means "explicitly cleared this session" —
// force no sort for this column, even if a saved default exists. That's deliberately
// different from the hook's own `viewerSort === null` ("no interaction yet, fall back
// to the saved default") — see the comment on handleTableSort for why the distinction
// is what makes the cycle actually work.
interface SessionSort {
  column: string;
  direction: 'asc' | 'desc' | null;
}

interface UseViewerSortOptions {
  /** The chart's saved default sort, used when there's no session-only override. */
  savedSort?: ViewerSortValue[] | null;
  /** Called after every sort change (including the reset below) so the caller
   * can reset its own page state back to 1. */
  setPage: (page: number) => void;
}

/**
 * Session-only column-header sort, shared across chart view/edit/configure/dashboard.
 * Overrides the chart's saved sort until cleared (3rd click, or a stale-column reset).
 */
export function useViewerSort({ savedSort, setPage }: UseViewerSortOptions) {
  const [viewerSort, setViewerSort] = useState<SessionSort | null>(null);

  // What's actually shown for `column` right now: the session override if it targets
  // this column (including an explicit "cleared" null), else the saved default, else
  // undefined (never sorted at all).
  const getCurrentDirection = useCallback(
    (column: string): 'asc' | 'desc' | null | undefined => {
      if (viewerSort && viewerSort.column === column) return viewerSort.direction;
      return savedSort?.find((s) => s.column === column)?.direction;
    },
    [viewerSort, savedSort]
  );

  // Cycles asc -> desc -> clear -> asc..., continuing from whatever direction is
  // CURRENTLY DISPLAYED for this column — whether that came from a session override
  // or the chart's saved default. E.g. if the saved default is desc, the very first
  // click moves to clear (not back to asc), matching what a 3-step cycle should do
  // from a state that's already on step 2.
  //
  // This only works safely because "clear" now means an explicit, always-distinct
  // state (SessionSort.direction: null → force no sort) rather than merely "no
  // override" (viewerSort === null). The earlier version conflated the two: clearing
  // an override that was already absent was a no-op, so once the display happened to
  // match the saved default, every subsequent click repeated the same no-op forever.
  const handleTableSort = useCallback(
    (column: string) => {
      const current = getCurrentDirection(column);
      const next = current === 'asc' ? 'desc' : current === 'desc' ? null : 'asc';
      setViewerSort({ column, direction: next });
      setPage(1);
    },
    [getCurrentDirection, setPage]
  );

  /**
   * Call with the columns the last successful fetch actually returned — dimensions
   * AND metrics together, e.g. `tableData?.columns`. Not taken as a hook option
   * directly: that data only exists after a fetch that itself depends on
   * `effectiveSort`, so the caller must invoke this once real columns are known
   * (typically from its own effect watching the fetched column list).
   *
   * Clears the session sort if its column isn't in that list — e.g. drill-down
   * moved to a different level, or the chart's dimensions/metrics were
   * reconfigured — instead of silently sending a sort for a column the query
   * no longer selects.
   */
  const clearSortIfColumnMissing = useCallback((validColumns?: string[]) => {
    setViewerSort((prev) =>
      prev && validColumns && !validColumns.includes(prev.column) ? null : prev
    );
  }, []);

  const effectiveSort = viewerSort
    ? viewerSort.direction
      ? [{ column: viewerSort.column, direction: viewerSort.direction }]
      : undefined // explicitly cleared this session — no sort, ignore the saved default
    : savedSort || undefined;

  return { effectiveSort, handleTableSort, clearSortIfColumnMissing };
}
