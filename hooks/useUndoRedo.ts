import { useState, useCallback } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

/**
 * Hook for managing undo/redo functionality
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

  const setState = useCallback(
    (newState: T) => {
      setHistory((prev) => ({
        past: [...prev.past.slice(-maxHistory + 1), prev.present],
        present: newState,
        future: [],
      }));
    },
    [maxHistory]
  );

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;

      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, prev.past.length - 1);

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

      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const reset = useCallback(
    (newInitialState?: T) => {
      setHistory({
        past: [],
        present: newInitialState || initialState,
        future: [],
      });
    },
    [initialState]
  );

  return {
    state: history.present,
    setState,
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
