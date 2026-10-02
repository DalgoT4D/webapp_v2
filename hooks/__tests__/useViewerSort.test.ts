import { renderHook, act } from '@testing-library/react';
import { useViewerSort } from '@/hooks/useViewerSort';

describe('useViewerSort', () => {
  it('falls back to savedSort when nothing has been clicked', () => {
    const setPage = jest.fn();
    const savedSort = [{ column: 'name', direction: 'asc' as const }];
    const { result } = renderHook(() => useViewerSort({ savedSort, setPage }));

    expect(result.current.effectiveSort).toEqual(savedSort);
  });

  it('cycles a fresh column asc -> desc -> clear, and resets the page on every click', () => {
    const setPage = jest.fn();
    const { result } = renderHook(() => useViewerSort({ setPage }));

    act(() => result.current.handleTableSort('amount'));
    expect(result.current.effectiveSort).toEqual([{ column: 'amount', direction: 'asc' }]);

    act(() => result.current.handleTableSort('amount'));
    expect(result.current.effectiveSort).toEqual([{ column: 'amount', direction: 'desc' }]);

    act(() => result.current.handleTableSort('amount'));
    expect(result.current.effectiveSort).toBeUndefined();

    expect(setPage).toHaveBeenCalledTimes(3);
    expect(setPage).toHaveBeenCalledWith(1);
  });

  it('clicking a different column starts a fresh cycle at asc, dropping the old one', () => {
    const setPage = jest.fn();
    const { result } = renderHook(() => useViewerSort({ setPage }));

    act(() => result.current.handleTableSort('a'));
    act(() => result.current.handleTableSort('a'));
    expect(result.current.effectiveSort).toEqual([{ column: 'a', direction: 'desc' }]);

    act(() => result.current.handleTableSort('b'));
    expect(result.current.effectiveSort).toEqual([{ column: 'b', direction: 'asc' }]);
  });

  it('continues the cycle from the saved default instead of getting stuck or restarting (the sort-cycle bug)', () => {
    // Regression guard, two versions of the bug:
    // v1: "next direction" was derived from the merged effectiveSort, which can't
    //   distinguish "no override, showing the saved default" from "override
    //   explicitly set to the same value". Clicking from a default of 'desc' cleared
    //   an already-absent override — a no-op — so the UI never moved again.
    // v2 (the fix's own bug): treating "clear" as merely viewerSort=null made the
    //   first click always jump back to 'asc', even when the display already showed
    //   'desc' (step 2 of the asc->desc->clear cycle) — it should advance to 'clear'
    //   next, not restart at step 1.
    // The real fix: "clear" must be its own distinct, always-effective state
    // (explicitly no sort) rather than merely "no override" — see SessionSort.
    const setPage = jest.fn();
    const savedSort = [{ column: 'x', direction: 'desc' as const }];
    const { result } = renderHook(() => useViewerSort({ savedSort, setPage }));

    // Before any click, effectiveSort reflects the saved default.
    expect(result.current.effectiveSort).toEqual(savedSort);

    // 1st click: display already shows 'desc' (step 2), so it advances to 'clear' —
    // a real, visible change to "no sort", not a no-op and not a restart at 'asc'.
    act(() => result.current.handleTableSort('x'));
    expect(result.current.effectiveSort).toBeUndefined();

    // 2nd click: 'clear' -> 'asc'.
    act(() => result.current.handleTableSort('x'));
    expect(result.current.effectiveSort).toEqual([{ column: 'x', direction: 'asc' }]);

    // 3rd click: 'asc' -> 'desc' (an explicit override now, not the default anymore).
    act(() => result.current.handleTableSort('x'));
    expect(result.current.effectiveSort).toEqual([{ column: 'x', direction: 'desc' }]);

    // 4th click: back to 'clear'. The cycle keeps moving indefinitely — not stuck.
    act(() => result.current.handleTableSort('x'));
    expect(result.current.effectiveSort).toBeUndefined();
  });

  it('clears a stale sort when clearSortIfColumnMissing is called without the sorted column', () => {
    const setPage = jest.fn();
    const { result } = renderHook(() => useViewerSort({ setPage }));

    act(() => result.current.handleTableSort('state'));
    expect(result.current.effectiveSort).toEqual([{ column: 'state', direction: 'asc' }]);

    // Drill-down moved to a level where only 'city' is returned — 'state' is gone.
    act(() => result.current.clearSortIfColumnMissing(['city']));

    expect(result.current.effectiveSort).toBeUndefined();
  });

  it('keeps the session sort when clearSortIfColumnMissing still includes it', () => {
    const setPage = jest.fn();
    const { result } = renderHook(() => useViewerSort({ setPage }));

    act(() => result.current.handleTableSort('region'));
    act(() => result.current.clearSortIfColumnMissing(['region', 'state', 'city']));

    expect(result.current.effectiveSort).toEqual([{ column: 'region', direction: 'asc' }]);
  });

  it('keeps a metric-column sort valid — the bug this hook must not reintroduce', () => {
    // Regression guard: an earlier version only checked dimension columns, so any
    // sort on a metric column (e.g. "SUM(cost_spent)") was wiped immediately since
    // metrics were never in that list. clearSortIfColumnMissing must be called with
    // the FULL returned column set (dimensions + metrics), and only clear when the
    // sorted column is truly absent from it.
    const setPage = jest.fn();
    const { result } = renderHook(() => useViewerSort({ setPage }));

    act(() => result.current.handleTableSort('SUM(cost_spent)'));
    act(() => result.current.handleTableSort('SUM(cost_spent)')); // -> desc
    act(() => result.current.clearSortIfColumnMissing(['name', 'attended', 'SUM(cost_spent)']));

    expect(result.current.effectiveSort).toEqual([
      { column: 'SUM(cost_spent)', direction: 'desc' },
    ]);
  });

  it('is a no-op when called with undefined columns (e.g. before the first fetch resolves)', () => {
    const setPage = jest.fn();
    const { result } = renderHook(() => useViewerSort({ setPage }));

    act(() => result.current.handleTableSort('region'));
    act(() => result.current.clearSortIfColumnMissing(undefined));

    expect(result.current.effectiveSort).toEqual([{ column: 'region', direction: 'asc' }]);
  });

  it('reconfiguring the saved sort overrides a leftover session click instead of being masked by it', () => {
    // Regression guard: a header click earlier in the same visit used to keep
    // winning over savedSort forever, since viewerSort only ever cleared via
    // another header click or a stale-column reset — never on savedSort itself
    // changing. That made the chart's own Sort Configuration UI look broken:
    // picking a new column/direction there had no visible effect.
    const setPage = jest.fn();
    const { result, rerender } = renderHook(
      ({ savedSort }) => useViewerSort({ savedSort, setPage }),
      { initialProps: { savedSort: [{ column: 'name', direction: 'asc' as const }] } }
    );

    // Viewer clicks a column header, creating a session-only override.
    act(() => result.current.handleTableSort('name'));
    expect(result.current.effectiveSort).toEqual([{ column: 'name', direction: 'desc' }]);

    // The chart's Sort Configuration UI reconfigures the saved sort to a
    // different column/direction — this must take effect immediately.
    rerender({ savedSort: [{ column: 'amount', direction: 'desc' as const }] });

    expect(result.current.effectiveSort).toEqual([{ column: 'amount', direction: 'desc' }]);
  });

  it('an unrelated re-render with the same savedSort content does not clear an active session click', () => {
    const setPage = jest.fn();
    const savedSortA = [{ column: 'name', direction: 'asc' as const }];
    const { result, rerender } = renderHook(
      ({ savedSort }) => useViewerSort({ savedSort, setPage }),
      { initialProps: { savedSort: savedSortA } }
    );

    act(() => result.current.handleTableSort('region'));
    expect(result.current.effectiveSort).toEqual([{ column: 'region', direction: 'asc' }]);

    // A new array reference with identical content (e.g. a parent re-render) —
    // not an actual reconfiguration — must not reset the session override.
    rerender({ savedSort: [{ column: 'name', direction: 'asc' as const }] });

    expect(result.current.effectiveSort).toEqual([{ column: 'region', direction: 'asc' }]);
  });
});
