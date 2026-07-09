/**
 * useIngestUiMode Hook Tests
 *
 * Tests the new/classic ingest UI toggle persisted in localStorage.
 */

import { renderHook, act } from '@testing-library/react';
import { useIngestUiMode, INGEST_UI_MODE_KEY } from '../useIngestUiMode';

describe('useIngestUiMode', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to "new" when nothing is stored', () => {
    const { result } = renderHook(() => useIngestUiMode());
    expect(result.current.mode).toBe('new');
  });

  it('reads a persisted "classic" choice from localStorage', () => {
    window.localStorage.setItem(INGEST_UI_MODE_KEY, 'classic');
    const { result } = renderHook(() => useIngestUiMode());
    expect(result.current.mode).toBe('classic');
  });

  it('persists a new choice to localStorage', () => {
    const { result } = renderHook(() => useIngestUiMode());
    act(() => {
      result.current.setMode('classic');
    });
    expect(result.current.mode).toBe('classic');
    expect(window.localStorage.getItem(INGEST_UI_MODE_KEY)).toBe('classic');
  });

  it('reads a persisted "rows" choice from localStorage', () => {
    window.localStorage.setItem(INGEST_UI_MODE_KEY, 'rows');
    const { result } = renderHook(() => useIngestUiMode());
    expect(result.current.mode).toBe('rows');
  });

  it('falls back to "new" for an unrecognized stored value', () => {
    window.localStorage.setItem(INGEST_UI_MODE_KEY, 'bogus');
    const { result } = renderHook(() => useIngestUiMode());
    expect(result.current.mode).toBe('new');
  });
});
