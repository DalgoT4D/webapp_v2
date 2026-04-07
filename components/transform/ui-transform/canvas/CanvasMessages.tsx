// components/transform/canvas/CanvasMessages.tsx
'use client';

import { Key, Lock } from 'lucide-react';
import { useTransformStore } from '@/stores/transformStore';

interface CanvasMessagesProps {
  hasUnpublishedChanges?: boolean;
}

export default function CanvasMessages({ hasUnpublishedChanges = false }: CanvasMessagesProps) {
  const lockStatus = useTransformStore((s) => s.canvasLockStatus);
  const patRequired = useTransformStore((s) => s.patRequired);
  const isViewOnlyMode = useTransformStore((s) => s.isViewOnlyMode);
  const openPatModal = useTransformStore((s) => s.openPatModal);

  const showLock = lockStatus?.is_locked && !lockStatus?.locked_by_current_user;
  const showPat = patRequired && isViewOnlyMode;

  if (!showLock && !hasUnpublishedChanges && !showPat) {
    return null;
  }

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2" data-testid="canvas-messages">
      {showLock && (
        <div
          data-testid="canvas-message-lock-status"
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium shadow-sm max-w-[300px] min-w-fit"
          style={{
            backgroundColor: '#E0F2F1',
            borderColor: '#00897B',
            color: '#00897B',
          }}
        >
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span>
            Locked. In use by{' '}
            <span className="font-semibold">{lockStatus.locked_by || 'another user'}</span>
          </span>
        </div>
      )}

      {hasUnpublishedChanges && (
        <div
          data-testid="canvas-message-unpublished-changes"
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium shadow-sm max-w-[300px] min-w-fit"
          style={{
            backgroundColor: '#E0F2F1',
            borderColor: '#00897B',
            color: '#00897B',
          }}
        >
          <span>Unpublished Changes</span>
        </div>
      )}

      {showPat && (
        <div
          data-testid="canvas-message-pat-required"
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium shadow-sm max-w-[300px] min-w-fit"
          style={{
            backgroundColor: '#E0F2F1',
            borderColor: '#00897B',
            color: '#00897B',
          }}
        >
          <Key className="w-4 h-4 flex-shrink-0" />
          <span>
            Update key to make changes.{' '}
            <button
              onClick={() => openPatModal()}
              className="underline font-semibold cursor-pointer"
              style={{ color: '#00695C' }}
              data-testid="add-pat-link"
            >
              Add key here
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
