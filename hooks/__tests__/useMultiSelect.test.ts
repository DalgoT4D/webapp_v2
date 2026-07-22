/**
 * useMultiSelect — selection persists across pages and is capped so a bulk
 * POST can never exceed the backend's item limit.
 */
import { renderHook, act } from '@testing-library/react';
import { useMultiSelect } from '@/hooks/useMultiSelect';

describe('useMultiSelect', () => {
  it('starts with an empty selection', () => {
    const { result } = renderHook(() => useMultiSelect<number>());
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('toggle adds then removes an id', () => {
    const { result } = renderHook(() => useMultiSelect<number>());

    act(() => result.current.toggle(1));
    expect(result.current.selectedIds.has(1)).toBe(true);

    act(() => result.current.toggle(1));
    expect(result.current.selectedIds.has(1)).toBe(false);
  });

  it('selectPage unions the given ids into the existing selection', () => {
    const { result } = renderHook(() => useMultiSelect<number>());

    act(() => result.current.toggle(1));
    act(() => result.current.selectPage([2, 3]));

    expect([...result.current.selectedIds].sort()).toEqual([1, 2, 3]);
  });

  it('deselectPage removes only the given ids, keeping the rest of the selection', () => {
    const { result } = renderHook(() => useMultiSelect<number>());

    act(() => result.current.selectPage([1, 2, 3]));
    act(() => result.current.deselectPage([2]));

    expect([...result.current.selectedIds].sort()).toEqual([1, 3]);
  });

  it('clear empties the whole selection regardless of page', () => {
    const { result } = renderHook(() => useMultiSelect<number>());

    act(() => result.current.selectPage([1, 2, 3]));
    act(() => result.current.clear());

    expect(result.current.selectedIds.size).toBe(0);
  });

  it('caps the selection at the given max — toggle beyond the cap is a no-op', () => {
    const { result } = renderHook(() => useMultiSelect<number>(2));

    act(() => result.current.selectPage([1, 2]));
    expect(result.current.isAtCap).toBe(true);

    act(() => result.current.toggle(3));
    expect(result.current.selectedIds.has(3)).toBe(false);
    expect(result.current.selectedIds.size).toBe(2);
  });

  it('caps selectPage — only fills up to the remaining capacity', () => {
    const { result } = renderHook(() => useMultiSelect<number>(2));

    act(() => result.current.selectPage([1, 2, 3, 4]));

    expect(result.current.selectedIds.size).toBe(2);
    expect(result.current.isAtCap).toBe(true);
  });

  it('deselecting below the cap allows toggling again', () => {
    const { result } = renderHook(() => useMultiSelect<number>(2));

    act(() => result.current.selectPage([1, 2]));
    act(() => result.current.toggle(1)); // remove — back under cap
    expect(result.current.isAtCap).toBe(false);

    act(() => result.current.toggle(3));
    expect(result.current.selectedIds.has(3)).toBe(true);
  });
});
