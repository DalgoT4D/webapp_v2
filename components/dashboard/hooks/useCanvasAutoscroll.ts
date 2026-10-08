'use client';

import { useCallback, useEffect, useRef, type RefObject } from 'react';

// Autoscroll while dragging near a canvas edge (DALGO-1219: drag bottom→top must reach the top).
// Distance from the edge (px) at which autoscroll engages.
export const AUTOSCROLL_EDGE_PX = 60;
// Max scroll speed (px/frame), capped to prevent runaway scroll. Spec: ~30px/frame.
export const AUTOSCROLL_MAX_SPEED_PX = 30;

/**
 * RGL has no native autoscroll. Scroll the canvas when the pointer nears its top/bottom
 * edge so a widget can be dragged from the bottom of a tall dashboard up to the top
 * (DALGO-1219 bug #2). Velocity is proportional to edge proximity, capped per frame.
 * Callers write the pointer's clientY into autoscrollPointerYRef while dragging.
 */
export function useCanvasAutoscroll(canvasRef: RefObject<HTMLDivElement | null>) {
  const autoscrollPointerYRef = useRef<number | null>(null);
  const autoscrollRafRef = useRef<number | null>(null);

  const runAutoscroll = useCallback(() => {
    const canvas = canvasRef.current;
    const pointerY = autoscrollPointerYRef.current;
    if (canvas && pointerY !== null) {
      const rect = canvas.getBoundingClientRect();
      const distTop = pointerY - rect.top;
      const distBottom = rect.bottom - pointerY;
      let dy = 0;
      if (distTop < AUTOSCROLL_EDGE_PX) {
        const intensity = Math.min(
          1,
          Math.max(0, (AUTOSCROLL_EDGE_PX - distTop) / AUTOSCROLL_EDGE_PX)
        );
        dy = -intensity * AUTOSCROLL_MAX_SPEED_PX;
      } else if (distBottom < AUTOSCROLL_EDGE_PX) {
        const intensity = Math.min(
          1,
          Math.max(0, (AUTOSCROLL_EDGE_PX - distBottom) / AUTOSCROLL_EDGE_PX)
        );
        dy = intensity * AUTOSCROLL_MAX_SPEED_PX;
      }
      if (dy !== 0) canvas.scrollTop += dy;
    }
    autoscrollRafRef.current = requestAnimationFrame(runAutoscroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- canvasRef is a ref; same [] as before
  }, []);

  const startAutoscroll = useCallback(() => {
    if (autoscrollRafRef.current === null) {
      autoscrollRafRef.current = requestAnimationFrame(runAutoscroll);
    }
  }, [runAutoscroll]);

  const stopAutoscroll = useCallback(() => {
    if (autoscrollRafRef.current !== null) {
      cancelAnimationFrame(autoscrollRafRef.current);
      autoscrollRafRef.current = null;
    }
    autoscrollPointerYRef.current = null;
  }, []);

  // Stop autoscroll if the component unmounts mid-drag
  useEffect(() => () => stopAutoscroll(), [stopAutoscroll]);

  return { autoscrollPointerYRef, startAutoscroll, stopAutoscroll };
}
