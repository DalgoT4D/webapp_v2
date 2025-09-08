import { useState, useCallback, useRef } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

/**
 * Hook for managing undo/redo functionality with deep comparison
 * @param initialState - Initial state value
 * @param maxHistory - Maximum number of history items to keep (default: 20)
 * @returns Object with state, setState, undo, redo functions and status flags
 */
export function useUndoRedo<T>(initialState: T, maxHistory: number = 20) {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  // Track the last saved state to prevent duplicate saves
  const lastSavedStateRef = useRef<string>(JSON.stringify(initialState));

  const setState = useCallback(
    (newState: T | ((prevState: T) => T)) => {
      setHistory((prev) => {
        // Handle function updates
        const resolvedState =
          typeof newState === 'function'
            ? (newState as (prevState: T) => T)(prev.present)
            : newState;

        // Deep comparison to check if state actually changed
        const newStateStr = JSON.stringify(resolvedState);
        const currentStateStr = JSON.stringify(prev.present);

        // If state hasn't changed, don't add to history
        if (newStateStr === currentStateStr) {
          return prev;
        }

        // Update last saved state
        lastSavedStateRef.current = newStateStr;

        // Add to history
        return {
          past: [...prev.past.slice(-maxHistory + 1), prev.present],
          present: resolvedState,
          future: [], // Clear future when new state is set
        };
      });
    },
    [maxHistory]
  );

  // Method to update state without adding to history (for transient updates like dragging)
  const setStateWithoutHistory = useCallback((newState: T | ((prevState: T) => T)) => {
    setHistory((prev) => {
      // Handle function updates
      const resolvedState =
        typeof newState === 'function' ? (newState as (prevState: T) => T)(prev.present) : newState;

      // Just update present without modifying history
      return {
        ...prev,
        present: resolvedState,
      };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;

      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, prev.past.length - 1);

      // Update last saved state ref
      lastSavedStateRef.current = JSON.stringify(previous);

      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;

      const next = prev.future[0];
      const newFuture = prev.future.slice(1);

      // Update last saved state ref
      lastSavedStateRef.current = JSON.stringify(next);

      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const reset = useCallback(
    (newInitialState?: T) => {
      const resetState = newInitialState || initialState;
      lastSavedStateRef.current = JSON.stringify(resetState);
      setHistory({
        past: [],
        present: resetState,
        future: [],
      });
    },
    [initialState]
  );

  return {
    state: history.present,
    setState,
    setStateWithoutHistory,
    undo,
    redo,
    reset,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    history: {
      past: history.past.length,
      future: history.future.length,
    },
  };
}
