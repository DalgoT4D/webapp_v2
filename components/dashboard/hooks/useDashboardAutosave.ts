'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

/** Autosave waits this long after the last edit. */
export const AUTOSAVE_DEBOUNCE_MS = 5000;
/** Undo/redo hold autosave back this long (longer delay to prevent auto-save after undo/redo). */
export const HOLD_AFTER_UNDO_REDO_MS = 1000;

/**
 * Autosave for the dashboard builder (moved from dashboard-builder-v2.tsx).
 * Deliberately NOT tracked in analytics: autosave is time-triggered, not user intent, and
 * useDebounce seeds with its initial value so this effect also runs on mount — any event here
 * would log builder opens as edits. DASHBOARD_UPDATED fires only from the explicit Save /
 * Save-and-View buttons.
 * PINNED-BUGS: "Builder PUTs dashboard immediately on open (autosave on mount)"
 * PINNED-BUGS: "Autosave after Undo/Redo fires when the 1s hold lifts (not at the 5s debounce)"
 */
export function useDashboardAutosave<T>(
  dashboardId: number | undefined,
  state: T,
  save: () => void
) {
  // Track if we're in an undo/redo operation to prevent auto-save interference
  const [isUndoRedoOperation, setIsUndoRedoOperation] = useState(false);

  // Debounced state for auto-save (keep original 5-second delay for responsive auto-save)
  const debouncedState = useDebounce(state, AUTOSAVE_DEBOUNCE_MS);

  // Auto-save (but not during undo/redo operations).
  useEffect(() => {
    if (dashboardId && debouncedState && !isUndoRedoOperation) {
      save();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same dependency list as before
  }, [debouncedState, isUndoRedoOperation]);

  // Ref mirror for isUndoRedoOperation so the grid's *Stop handlers don't need it as a dep
  const isUndoRedoOperationRef = useRef(isUndoRedoOperation);
  useEffect(() => {
    isUndoRedoOperationRef.current = isUndoRedoOperation;
  }, [isUndoRedoOperation]);

  // Set flag after an undo/redo to prevent subsequent auto-save interference
  const holdAfterUndoRedo = useCallback(() => {
    setIsUndoRedoOperation(true);
    setTimeout(() => {
      setIsUndoRedoOperation(false);
    }, HOLD_AFTER_UNDO_REDO_MS);
  }, []);

  return { holdAfterUndoRedo, isUndoRedoOperationRef };
}
