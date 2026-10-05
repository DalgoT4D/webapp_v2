'use client';

import { useCallback, useState, type MutableRefObject } from 'react';
import type { DashboardLayoutItem } from '@/types/dashboard';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import {
  constrainLayoutItems,
  getActiveEditorTab,
  updateActiveEditorTab,
  type DashboardEditorState,
  type EditorSetState,
} from '@/components/dashboard/logic/editor-state';

/** The walkthrough's resize step ends with any committed drag or resize. */
function advanceWalkthroughAfterResize() {
  const walkthrough = useInsightWalkthroughStore.getState();
  if (walkthrough.active && walkthrough.stage === 'builder_resize') {
    walkthrough.advanceTo('builder_save');
  }
}

interface GridCommitsOptions {
  stateRef: MutableRefObject<DashboardEditorState>;
  setState: EditorSetState;
  isUndoRedoOperationRef: MutableRefObject<boolean>;
}

/**
 * Committing RGL's final layout after a drag or resize: one history entry, per-widget min sizes
 * reapplied, nothing committed during an undo/redo hold.
 */
export function useGridCommits({ stateRef, setState, isUndoRedoOperationRef }: GridCommitsOptions) {
  const [resizingItems, setResizingItems] = useState<Set<string>>(new Set());
  // Track if we're currently resizing (set, not read — kept)
  const [isResizing, setIsResizing] = useState(false);

  // Reapply per-component min-size constraints to a layout returned by RGL.
  const applyItemConstraints = useCallback(
    (items: DashboardLayoutItem[]): DashboardLayoutItem[] =>
      constrainLayoutItems(items, getActiveEditorTab(stateRef.current).components),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stateRef is a ref; same [] as before
    []
  );

  // A drag on the grid ended: commit RGL's final layout as one history entry.
  const handleGridDragStop = useCallback(
    (layout: DashboardLayoutItem[], releasedOverTab: boolean) => {
      // Releasing over a tab before the dwell completes cancels instead of committing
      // a surprising edge position back into the source grid.
      if (!releasedOverTab && !isUndoRedoOperationRef.current) {
        const next = applyItemConstraints(layout);
        setState((prev) => updateActiveEditorTab(prev, { layout_config: next }));
      }
      advanceWalkthroughAfterResize();
    },
    [applyItemConstraints, setState, isUndoRedoOperationRef]
  );

  // Handle resize start
  const handleResizeStart = useCallback(
    (
      _layout: DashboardLayoutItem[],
      _oldItem: DashboardLayoutItem,
      newItem: DashboardLayoutItem
    ) => {
      setResizingItems((prev) => new Set([...prev, newItem.i]));
      setIsResizing(true);
    },
    []
  );

  // Handle resize stop - RGL pushes overlapped neighbors down and compacts; commit the
  // final layout to history with min-size constraints reapplied. Live min-size enforcement
  // during the drag is handled natively by RGL via each item's minW/minH.
  const handleResizeStop = useCallback(
    (
      layout: DashboardLayoutItem[],
      _oldItem: DashboardLayoutItem,
      newItem: DashboardLayoutItem
    ) => {
      setResizingItems((prev) => {
        const next = new Set(prev);
        next.delete(newItem.i);
        return next;
      });
      setIsResizing(false);

      if (!isUndoRedoOperationRef.current) {
        const next = applyItemConstraints(layout);
        setState((prev) => updateActiveEditorTab(prev, { layout_config: next }));
      }

      advanceWalkthroughAfterResize();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same dependency list as before
    [setState, applyItemConstraints]
  );

  return { resizingItems, isResizing, handleGridDragStop, handleResizeStart, handleResizeStop };
}
