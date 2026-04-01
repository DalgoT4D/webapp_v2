// components/transform/canvas/CanvasMessages.tsx
'use client';

import { Lock, AlertCircle, Key } from 'lucide-react';
import { useTransformStore } from '@/stores/transformStore';
import { cn } from '@/lib/utils';

interface CanvasMessage {
  id: string;
  content: React.ReactNode;
  icon?: React.ReactNode;
  variant?: 'info' | 'warning' | 'lock';
}

interface CanvasMessagesProps {
  /** Whether there are unpublished changes */
  hasUnpublishedChanges?: boolean;
}

export default function CanvasMessages({ hasUnpublishedChanges = false }: CanvasMessagesProps) {
  const lockStatus = useTransformStore((s) => s.canvasLockStatus);
  const isViewOnlyMode = useTransformStore((s) => s.isViewOnlyMode);
  const patRequired = useTransformStore((s) => s.patRequired);
  const openPatModal = useTransformStore((s) => s.openPatModal);

  // Build messages array
  const messages: CanvasMessage[] = [];

  // Lock status message - show when locked by another user
  if (lockStatus?.is_locked && !lockStatus?.locked_by_current_user) {
    messages.push({
      id: 'lock-status',
      variant: 'lock',
      icon: <Lock className="w-4 h-4 flex-shrink-0" />,
      content: (
        <span>
          Locked. In use by{' '}
          <span className="font-semibold">{lockStatus.locked_by || 'another user'}</span>
        </span>
      ),
    });
  }

  // Unpublished changes message
  if (hasUnpublishedChanges) {
    messages.push({
      id: 'unpublished-changes',
      variant: 'warning',
      icon: <AlertCircle className="w-4 h-4 flex-shrink-0" />,
      content: <span>You have unpublished changes</span>,
    });
  }

  // PAT required message
  if (patRequired && isViewOnlyMode) {
    messages.push({
      id: 'pat-required',
      variant: 'info',
      icon: <Key className="w-4 h-4 flex-shrink-0" />,
      content: (
        <span>
          Update key to make changes.{' '}
          <button
            onClick={() => openPatModal()}
            className="underline font-semibold hover:text-teal-800 transition-colors cursor-pointer"
            data-testid="add-pat-link"
          >
            Add key here
          </button>
        </span>
      ),
    });
  }

  if (messages.length === 0) {
    return null;
  }

  const getVariantStyles = (variant: CanvasMessage['variant']) => {
    switch (variant) {
      case 'lock':
        return 'bg-red-50 border-red-400 text-red-700';
      case 'warning':
        return 'bg-yellow-50 border-yellow-400 text-yellow-700';
      case 'info':
      default:
        return 'bg-teal-50 border-teal-500 text-teal-700';
    }
  };

  return (
    <div className="absolute top-16 right-4 z-10 flex flex-col gap-2" data-testid="canvas-messages">
      {messages.map((message) => (
        <div
          key={message.id}
          data-testid={`canvas-message-${message.id}`}
          className={cn(
            'border rounded-lg px-3 py-2',
            'flex items-center gap-2',
            'shadow-sm max-w-[320px] min-w-fit',
            'text-xs font-medium',
            'animate-in slide-in-from-right-5 duration-300',
            getVariantStyles(message.variant)
          )}
        >
          {message.icon}
          {message.content}
        </div>
      ))}
    </div>
  );
}
