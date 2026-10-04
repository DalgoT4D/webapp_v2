import { act, renderHook } from '@testing-library/react';
import { useListSort } from '@/components/list-page/useListSort';
import { useDebouncedValue } from '@/components/list-page/useDebouncedValue';
import { useFilterPopovers } from '@/components/list-page/useFilterPopovers';

describe('useListSort', () => {
  it('starts on the given column, descending', () => {
    const { result } = renderHook(() => useListSort<'title' | 'updated_at'>('updated_at'));
    expect(result.current.sortBy).toBe('updated_at');
    expect(result.current.sortOrder).toBe('desc');
  });

  it('same column flips; a new column starts descending', () => {
    const { result } = renderHook(() => useListSort<'title' | 'updated_at'>('updated_at'));
    act(() => result.current.handleSort('updated_at'));
    expect(result.current.sortOrder).toBe('asc');
    act(() => result.current.handleSort('updated_at'));
    expect(result.current.sortOrder).toBe('desc');
    act(() => result.current.handleSort('title'));
    expect([result.current.sortBy, result.current.sortOrder]).toEqual(['title', 'desc']);
    act(() => result.current.handleSort('title'));
    expect([result.current.sortBy, result.current.sortOrder]).toEqual(['title', 'asc']);
    act(() => result.current.handleSort('updated_at'));
    expect([result.current.sortBy, result.current.sortOrder]).toEqual(['updated_at', 'desc']);
  });
});

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns the first value immediately and later values after the delay', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 400), {
      initialProps: { v: '' },
    });
    expect(result.current).toBe('');
    rerender({ v: 'Q1' });
    act(() => jest.advanceTimersByTime(399));
    expect(result.current).toBe('');
    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe('Q1');
  });

  it('the timer also runs on mount and calls onSettle (pinned: reports mount debounce resets the page)', () => {
    const onSettle = jest.fn();
    renderHook(() => useDebouncedValue('', 400, onSettle));
    expect(onSettle).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(400));
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it('each change restarts the timer; onSettle fires once for the final value', () => {
    const onSettle = jest.fn();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 400, onSettle), {
      initialProps: { v: '' },
    });
    act(() => jest.advanceTimersByTime(100));
    rerender({ v: 'a' });
    act(() => jest.advanceTimersByTime(200));
    rerender({ v: 'ab' });
    act(() => jest.advanceTimersByTime(399));
    expect(result.current).toBe('');
    expect(onSettle).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe('ab');
    expect(onSettle).toHaveBeenCalledTimes(1);
  });
});

describe('useFilterPopovers', () => {
  it('opens and closes one popover without touching the others', () => {
    const { result } = renderHook(() => useFilterPopovers({ name: false, date: false }));
    act(() => result.current.setFilterOpen('name', true));
    expect(result.current.openFilters).toEqual({ name: true, date: false });
    act(() => result.current.setFilterOpen('name', false));
    expect(result.current.openFilters).toEqual({ name: false, date: false });
  });
});
