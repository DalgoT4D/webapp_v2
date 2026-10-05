'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react';
import type { DashboardComponentType, DashboardLayoutItem } from '@/types/dashboard';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { DASHBOARD_WIDGET_DRAG_START_EVENT } from '@/components/dashboard/widgets/text/text-element-unified';
import {
  GRID_GAP_PX,
  GRID_PADDING_PX,
  GRID_ROW_HEIGHT,
} from '@/components/dashboard/grid/grid-constants';
import {
  getHandoffPlaceholderStyle,
  isPointInsideRect,
  moveWidgetBetweenTabs,
  pointerToGridPosition,
} from '@/components/dashboard/tabs/cross-tab-drag';
import {
  getActiveEditorTab,
  type DashboardEditorState,
  type EditorSetState,
} from '@/components/dashboard/logic/editor-state';
import { useCanvasAutoscroll } from '@/components/dashboard/hooks/useCanvasAutoscroll';

/** Hovering a tab this long while dragging a widget hands the widget over to that tab. */
export const CROSS_TAB_HOVER_DELAY_MS = 500;

export interface CrossTabDragSession {
  componentId: string;
  componentType: DashboardComponentType;
  sourceTabId: string;
  hoverTabId: string | null;
  targetTabId: string | null;
  item: DashboardLayoutItem;
  clientX: number;
  clientY: number;
  targetPosition: { x: number; y: number } | null;
  phase: 'grid' | 'handoff';
}

export interface UseCrossTabDragOptions {
  dashboardId: number | undefined;
  stateRef: MutableRefObject<DashboardEditorState>;
  setState: EditorSetState;
  canvasRef: RefObject<HTMLDivElement | null>;
  dashboardContainerRef: RefObject<HTMLDivElement | null>;
  cols: number;
  actualContainerWidth: number;
  setDragPreviewTabId: (tabId: string | null) => void;
  /** A drag on the grid ended (not a hand-off). `releasedOverTab`: dropped on a tab before the dwell. */
  onGridDragStop: (layout: DashboardLayoutItem[], releasedOverTab: boolean) => void;
}

/**
 * Dragging widgets: on the grid (RGL), with edge autoscroll, and across tabs — hover a tab for
 * 500ms to hand the widget over, then drop it on the other tab's canvas. Moved verbatim from
 * dashboard-builder.tsx.
 */
export function useCrossTabDrag({
  dashboardId,
  stateRef,
  setState,
  canvasRef,
  dashboardContainerRef,
  cols,
  actualContainerWidth,
  setDragPreviewTabId,
  onGridDragStop,
}: UseCrossTabDragOptions) {
  // Track if we're currently dragging (set, not read — kept: each change re-renders the builder)
  const [, setIsDragging] = useState(false);
  const [draggedItem, setDraggedItem] = useState<DashboardLayoutItem | null>(null);
  const [crossTabDrag, setCrossTabDrag] = useState<CrossTabDragSession | null>(null);
  const crossTabDragRef = useRef<CrossTabDragSession | null>(null);
  const crossTabHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    crossTabDragRef.current = crossTabDrag;
  }, [crossTabDrag]);

  // IMPORTANT: Use refs for synchronous access in callbacks
  // React state updates are async, but react-grid-layout calls handlers synchronously
  const isDraggingRef = useRef(false);

  const { autoscrollPointerYRef, startAutoscroll, stopAutoscroll } = useCanvasAutoscroll(canvasRef);

  const clearCrossTabHoverTimer = useCallback(() => {
    if (crossTabHoverTimerRef.current) {
      clearTimeout(crossTabHoverTimerRef.current);
      crossTabHoverTimerRef.current = null;
    }
  }, []);

  // Prevent a pending tab-hover handoff from firing after the builder unmounts.
  useEffect(() => () => clearCrossTabHoverTimer(), [clearCrossTabHoverTimer]);

  const publishCrossTabDrag = useCallback((session: CrossTabDragSession | null) => {
    crossTabDragRef.current = session;
    setCrossTabDrag(session);
  }, []);

  const getTargetPosition = useCallback(
    (session: CrossTabDragSession, clientX: number, clientY: number) => {
      const container = dashboardContainerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return null;
      const rect = container.getBoundingClientRect();
      return pointerToGridPosition(clientX, clientY, session.item, {
        containerWidth: rect.width,
        containerLeft: rect.left,
        containerTop: rect.top,
        cols,
        rowHeight: GRID_ROW_HEIGHT,
        marginX: GRID_GAP_PX,
        marginY: GRID_GAP_PX,
        paddingX: GRID_PADDING_PX,
        paddingY: GRID_PADDING_PX,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable ref/setter passed as option; deps kept verbatim
    [cols]
  );

  const beginCrossTabHandoff = useCallback(
    (targetTabId: string) => {
      const session = crossTabDragRef.current;
      if (!session || session.phase !== 'grid' || session.sourceTabId === targetTabId) return;
      clearCrossTabHoverTimer();
      const next: CrossTabDragSession = {
        ...session,
        hoverTabId: targetTabId,
        targetTabId,
        targetPosition: null,
        phase: 'handoff',
      };
      // End RGL's source-grid gesture while that grid is still mounted. The physical
      // pointer remains down and the document-level handoff listeners take over on the
      // next render, but react-draggable can now remove its document listeners cleanly
      // instead of throwing "DraggableCore: Unmounted during event" on the final mouseup.
      publishCrossTabDrag(next);
      document.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          clientX: session.clientX,
          clientY: session.clientY,
        })
      );
      setDragPreviewTabId(targetTabId);
      autoscrollPointerYRef.current = session.clientY;
      startAutoscroll();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable ref/setter passed as option; deps kept verbatim
    [clearCrossTabHoverTimer, publishCrossTabDrag, startAutoscroll]
  );

  const updateCrossTabHover = useCallback(
    (clientX: number, clientY: number) => {
      const session = crossTabDragRef.current;
      if (!session || session.phase !== 'grid') return;

      const tabElement = document
        .elementsFromPoint(clientX, clientY)
        .map((element) => (element as HTMLElement).closest<HTMLElement>('[data-dashboard-tab-id]'))
        .find(Boolean);
      const hoverTabId = tabElement?.dataset.dashboardTabId || null;
      const validHoverTabId = hoverTabId && hoverTabId !== session.sourceTabId ? hoverTabId : null;

      if (session.hoverTabId === validHoverTabId) return;
      clearCrossTabHoverTimer();
      const next = { ...session, clientX, clientY, hoverTabId: validHoverTabId };
      publishCrossTabDrag(next);

      if (validHoverTabId) {
        crossTabHoverTimerRef.current = setTimeout(
          () => beginCrossTabHandoff(validHoverTabId),
          CROSS_TAB_HOVER_DELAY_MS
        );
      }
    },
    [beginCrossTabHandoff, clearCrossTabHoverTimer, publishCrossTabDrag]
  );

  const finishCrossTabDrag = useCallback(
    (commit: boolean) => {
      const session = crossTabDragRef.current;
      clearCrossTabHoverTimer();
      stopAutoscroll();

      if (commit && session?.phase === 'handoff' && session.targetTabId && session.targetPosition) {
        setState((prev) =>
          moveWidgetBetweenTabs(
            prev,
            {
              componentId: session.componentId,
              sourceTabId: session.sourceTabId,
              targetTabId: session.targetTabId!,
              ...session.targetPosition!,
            },
            cols
          )
        );
        trackEvent(ANALYTICS_EVENTS.DASHBOARD_WIDGET_MOVED_BETWEEN_TABS, {
          dashboard_id: dashboardId,
          element_type: session.componentType,
        });
      }

      setDragPreviewTabId(null);
      publishCrossTabDrag(null);
      isDraggingRef.current = false;
      setIsDragging(false);
      setDraggedItem(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable ref/setter passed as option; deps kept verbatim
    [clearCrossTabHoverTimer, cols, publishCrossTabDrag, setState, stopAutoscroll]
  );

  // Once the source grid unmounts, keep the gesture alive at document level.
  useEffect(() => {
    if (crossTabDrag?.phase !== 'handoff') return undefined;

    const initialPositionFrame = requestAnimationFrame(() => {
      const session = crossTabDragRef.current;
      if (!session || session.phase !== 'handoff') return;
      publishCrossTabDrag({
        ...session,
        targetPosition: getTargetPosition(session, session.clientX, session.clientY),
      });
    });

    const handleMouseMove = (event: MouseEvent) => {
      const session = crossTabDragRef.current;
      if (!session || session.phase !== 'handoff') return;
      autoscrollPointerYRef.current = event.clientY;
      publishCrossTabDrag({
        ...session,
        clientX: event.clientX,
        clientY: event.clientY,
        targetPosition: getTargetPosition(session, event.clientX, event.clientY),
      });
    };
    const handleCanvasScroll = () => {
      const session = crossTabDragRef.current;
      if (!session || session.phase !== 'handoff') return;
      publishCrossTabDrag({
        ...session,
        targetPosition: getTargetPosition(session, session.clientX, session.clientY),
      });
    };
    const handleMouseUp = (event: MouseEvent) => {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      const isInsideCanvas = isPointInsideRect(event.clientX, event.clientY, canvasRect);
      const session = crossTabDragRef.current;
      if (isInsideCanvas && session?.phase === 'handoff') {
        publishCrossTabDrag({
          ...session,
          clientX: event.clientX,
          clientY: event.clientY,
          targetPosition: getTargetPosition(session, event.clientX, event.clientY),
        });
      }
      finishCrossTabDrag(isInsideCanvas);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finishCrossTabDrag(false);
      }
    };
    const handleWindowBlur = () => finishCrossTabDrag(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleWindowBlur);
    const canvas = canvasRef.current;
    canvas?.addEventListener('scroll', handleCanvasScroll, { passive: true });
    return () => {
      cancelAnimationFrame(initialPositionFrame);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleWindowBlur);
      canvas?.removeEventListener('scroll', handleCanvasScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable ref/setter passed as option; deps kept verbatim
  }, [crossTabDrag?.phase, finishCrossTabDrag, getTargetPosition, publishCrossTabDrag]);

  // --- Drag handlers ------------------------------------------------------------------
  const handleDragStart = useCallback(
    (
      _layout: DashboardLayoutItem[],
      _oldItem: DashboardLayoutItem,
      newItem: DashboardLayoutItem,
      _placeholder: DashboardLayoutItem,
      event: MouseEvent
    ) => {
      document.dispatchEvent(
        new CustomEvent(DASHBOARD_WIDGET_DRAG_START_EVENT, {
          detail: { componentId: newItem.i },
        })
      );
      isDraggingRef.current = true;
      setIsDragging(true);
      setDraggedItem(newItem);
      const editorState = stateRef.current;
      const component = getActiveEditorTab(editorState).components[newItem.i];
      if (component) {
        publishCrossTabDrag({
          componentId: newItem.i,
          componentType: component.type,
          sourceTabId: editorState.activeTabId,
          hoverTabId: null,
          targetTabId: null,
          item: { ...newItem },
          clientX: event?.clientX || 0,
          clientY: event?.clientY || 0,
          targetPosition: null,
          phase: 'grid',
        });
      }
      startAutoscroll();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable ref/setter passed as option; deps kept verbatim
    [publishCrossTabDrag, startAutoscroll]
  );

  // Track the pointer Y so the autoscroll loop knows how close we are to an edge.
  const handleDrag = useCallback(
    (
      _layout: DashboardLayoutItem[],
      _oldItem: DashboardLayoutItem,
      _newItem: DashboardLayoutItem,
      _placeholder: DashboardLayoutItem,
      e: MouseEvent
    ) => {
      if (e && typeof e.clientY === 'number') {
        autoscrollPointerYRef.current = e.clientY;
        const session = crossTabDragRef.current;
        if (session?.phase === 'grid') {
          publishCrossTabDrag({ ...session, clientX: e.clientX, clientY: e.clientY });
          updateCrossTabHover(e.clientX, e.clientY);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable ref/setter passed as option; deps kept verbatim
    [publishCrossTabDrag, updateCrossTabHover]
  );

  // Handle drag stop - RGL returns the final, gravity-up-compacted layout. The builder's
  // handleGridDragStop (builder/useGridCommits.ts) commits it as one history entry. Each
  // widget keeps its own (x, y, w, h); nothing is re-derived from array order, which is
  // what made the old fluid model unpredictable (DALGO-1219).
  const handleDragStop = useCallback(
    (layout: DashboardLayoutItem[]) => {
      const session = crossTabDragRef.current;
      if (session?.phase === 'handoff') return;

      isDraggingRef.current = false;
      setIsDragging(false);
      setDraggedItem(null);
      clearCrossTabHoverTimer();
      publishCrossTabDrag(null);
      stopAutoscroll();

      // Releasing over a tab before the dwell completes cancels instead of committing
      // a surprising edge position back into the source grid (the caller checks this flag).
      onGridDragStop(layout, Boolean(session?.hoverTabId));
    },
    [clearCrossTabHoverTimer, onGridDragStop, publishCrossTabDrag, stopAutoscroll]
  );

  const handoffPlaceholderStyle =
    crossTabDrag?.phase === 'handoff' && crossTabDrag.targetPosition
      ? getHandoffPlaceholderStyle(
          crossTabDrag.item,
          crossTabDrag.targetPosition,
          actualContainerWidth,
          cols
        )
      : null;

  return {
    crossTabDrag,
    draggedItem,
    isDraggingRef,
    handleDragStart,
    handleDrag,
    handleDragStop,
    handoffPlaceholderStyle,
  };
}
