import { useEffect, type RefObject } from 'react';
import { isPointInsideRect } from '@/components/dashboard/tabs/cross-tab-drag';
import type { CrossTabDragSession } from '@/components/dashboard/hooks/useCrossTabDrag';

interface HandoffPointerListenersOptions {
  phase: CrossTabDragSession['phase'] | undefined;
  crossTabDragRef: RefObject<CrossTabDragSession | null>;
  autoscrollPointerYRef: RefObject<number | null>;
  canvasRef: RefObject<HTMLDivElement | null>;
  getTargetPosition: (
    session: CrossTabDragSession,
    clientX: number,
    clientY: number
  ) => CrossTabDragSession['targetPosition'];
  publishCrossTabDrag: (session: CrossTabDragSession | null) => void;
  finishCrossTabDrag: (commit: boolean) => void;
}

/**
 * During a cross-tab hand-off the source grid is gone, so the gesture continues at document level:
 * pointer moves update the target cell, canvas scroll re-measures, mouseup inside the canvas commits,
 * Escape / window blur cancel. Moved verbatim from useCrossTabDrag.
 */
export function useHandoffPointerListeners({
  phase,
  crossTabDragRef,
  autoscrollPointerYRef,
  canvasRef,
  getTargetPosition,
  publishCrossTabDrag,
  finishCrossTabDrag,
}: HandoffPointerListenersOptions) {
  // Once the source grid unmounts, keep the gesture alive at document level.
  useEffect(() => {
    if (phase !== 'handoff') return undefined;

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
  }, [phase, finishCrossTabDrag, getTargetPosition, publishCrossTabDrag]);
}
