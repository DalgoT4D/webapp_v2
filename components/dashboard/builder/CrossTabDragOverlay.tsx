'use client';

import { createPortal } from 'react-dom';
import type { CrossTabDragSession } from '@/components/dashboard/hooks/useCrossTabDrag';

/** "Move <type> to this tab" label that follows the pointer during a cross-tab hand-off. */
export function CrossTabDragOverlay({ session }: { session: CrossTabDragSession | null }) {
  if (session?.phase !== 'handoff' || typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="pointer-events-none fixed z-[10000] -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-blue-500 bg-blue-50/95 px-3 py-2 text-sm font-medium text-blue-700 shadow-xl"
      style={{ left: session.clientX, top: session.clientY }}
      data-testid="cross-tab-drag-overlay"
    >
      Move {session.componentType} to this tab
    </div>,
    document.body
  );
}
