import { act, renderHook } from '@testing-library/react';
import {
  AUTOSAVE_DEBOUNCE_MS,
  HOLD_AFTER_UNDO_REDO_MS,
  useDashboardAutosave,
} from '@/components/dashboard/hooks/useDashboardAutosave';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

// No default parameter: setup(undefined) must really pass undefined.
function setup(dashboardId: number | undefined) {
  const save = jest.fn();
  const hook = renderHook(({ state }) => useDashboardAutosave(dashboardId, state, save), {
    initialProps: { state: { n: 0 } },
  });
  return { save, ...hook };
}

describe('useDashboardAutosave', () => {
  it('saves on mount (pinned)', () => {
    // PINNED-BUGS: "Builder PUTs dashboard immediately on open (autosave on mount)"
    const { save } = setup(7);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('saves 5 s after the last change', () => {
    const { save, rerender } = setup(7);
    rerender({ state: { n: 1 } });
    act(() => jest.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - 1));
    expect(save).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(1));
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('an undo hold: saves when the hold lifts, then again at 5 s (pinned)', () => {
    // PINNED-BUGS: "Autosave after Undo/Redo fires when the 1s hold lifts (not at the 5s debounce)"
    const { save, rerender, result } = setup(7);
    act(() => result.current.holdAfterUndoRedo());
    rerender({ state: { n: 1 } });
    expect(result.current.isUndoRedoOperationRef.current).toBe(true);
    act(() => jest.advanceTimersByTime(HOLD_AFTER_UNDO_REDO_MS - 1));
    expect(save).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(1));
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.isUndoRedoOperationRef.current).toBe(false);
    act(() => jest.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - HOLD_AFTER_UNDO_REDO_MS));
    expect(save).toHaveBeenCalledTimes(3);
  });

  it('no dashboard id: never saves', () => {
    const { save, rerender } = setup(undefined);
    rerender({ state: { n: 1 } });
    act(() => jest.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS));
    expect(save).not.toHaveBeenCalled();
  });
});
