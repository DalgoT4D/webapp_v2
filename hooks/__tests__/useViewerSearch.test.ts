import { renderHook, act } from '@testing-library/react';
import { useViewerSearch } from '@/hooks/useViewerSearch';

describe('useViewerSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts with an empty query and no debounced value change yet', () => {
    const setPage = jest.fn();
    const { result } = renderHook(() => useViewerSearch({ setPage }));

    expect(result.current.searchQuery).toBe('');
    expect(result.current.debouncedSearch).toBe('');
  });

  it('updates searchQuery immediately on every keystroke, before the debounce settles', () => {
    const setPage = jest.fn();
    const { result } = renderHook(() => useViewerSearch({ setPage }));

    act(() => result.current.onSearchChange('a'));
    expect(result.current.searchQuery).toBe('a');
    expect(result.current.debouncedSearch).toBe('');

    act(() => result.current.onSearchChange('ab'));
    expect(result.current.searchQuery).toBe('ab');
    expect(result.current.debouncedSearch).toBe('');
  });

  it('only updates debouncedSearch after typing settles for the configured delay', () => {
    const setPage = jest.fn();
    const { result } = renderHook(() => useViewerSearch({ setPage }));

    act(() => result.current.onSearchChange('region'));
    act(() => {
      jest.advanceTimersByTime(799);
    });
    expect(result.current.debouncedSearch).toBe('');

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.debouncedSearch).toBe('region');
  });

  it('resets the page to 1 only once the debounced term actually changes, not per keystroke', () => {
    const setPage = jest.fn();
    const { result } = renderHook(() => useViewerSearch({ setPage }));
    setPage.mockClear(); // drop the initial mount-time call (page is already 1 by default)

    act(() => result.current.onSearchChange('r'));
    act(() => result.current.onSearchChange('re'));
    act(() => result.current.onSearchChange('reg'));
    expect(setPage).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(800);
    });
    expect(setPage).toHaveBeenCalledTimes(1);
    expect(setPage).toHaveBeenCalledWith(1);
  });

  it('debounces again for each further settled change, resetting the page each time', () => {
    const setPage = jest.fn();
    const { result } = renderHook(() => useViewerSearch({ setPage }));
    setPage.mockClear();

    act(() => result.current.onSearchChange('region'));
    act(() => {
      jest.advanceTimersByTime(800);
    });
    expect(setPage).toHaveBeenCalledTimes(1);

    act(() => result.current.onSearchChange('city'));
    act(() => {
      jest.advanceTimersByTime(800);
    });
    expect(setPage).toHaveBeenCalledTimes(2);
    expect(result.current.debouncedSearch).toBe('city');
  });

  it('clearing the search box back to empty debounces to empty and resets the page', () => {
    const setPage = jest.fn();
    const { result } = renderHook(() => useViewerSearch({ setPage }));

    act(() => result.current.onSearchChange('region'));
    act(() => {
      jest.advanceTimersByTime(800);
    });
    setPage.mockClear();

    act(() => result.current.onSearchChange(''));
    act(() => {
      jest.advanceTimersByTime(800);
    });
    expect(result.current.debouncedSearch).toBe('');
    expect(setPage).toHaveBeenCalledTimes(1);
    expect(setPage).toHaveBeenCalledWith(1);
  });
});
