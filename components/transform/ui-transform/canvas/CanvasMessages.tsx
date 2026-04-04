// components/transform/canvas/CanvasMessages.tsx
'use client';

import { Lock } from 'lucide-react';
import { useTransformStore } from '@/stores/transformStore';
import { cn } from '@/lib/utils';

export default function CanvasMessages() {
  const lockStatus = useTransformStore((s) => s.canvasLockStatus);

  // Only show lock status — unpublished changes and PAT messages are in the header
  if (!lockStatus?.is_locked || lockStatus?.locked_by_current_user) {
    return null;
  }

  return (
    <div className="absolute top-16 right-4 z-10" data-testid="canvas-messages">
      <div
        data-testid="canvas-message-lock-status"
        className={cn(
          'border rounded-lg px-3 py-2',
          'flex items-center gap-2',
          'shadow-sm max-w-[320px] min-w-fit',
          'text-xs font-medium',
          'animate-in slide-in-from-right-5 duration-300',
          'bg-red-50 border-red-400 text-red-700'
        )}
      >
        <Lock className="w-4 h-4 flex-shrink-0" />
        <span>
          Locked. In use by{' '}
          <span className="font-semibold">{lockStatus.locked_by || 'another user'}</span>
        </span>
      </div>
    </div>
  );
}
