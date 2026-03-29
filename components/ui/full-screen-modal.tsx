'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FullScreenModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * FullScreenModal - A reusable full-screen modal component
 *
 * Features:
 * - Takes most of the viewport with margins (74px top, 24px sides, 22px bottom)
 * - Scrollable content area
 * - Sticky header with title and subtitle
 * - Close button in top-right
 *
 * Usage:
 * ```tsx
 * <FullScreenModal
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Logs History"
 *   subtitle={<span>Pipeline Name | Active</span>}
 * >
 *   <YourContent />
 * </FullScreenModal>
 * ```
 */
export function FullScreenModal({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
  className,
}: FullScreenModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Content - Full screen with margins */}
        <DialogPrimitive.Content
          className={cn(
            'fixed z-50 bg-white rounded-xl shadow-xl flex flex-col',
            'top-[74px] left-6 right-6 bottom-[22px]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'duration-200',
            className
          )}
        >
          {/* Header */}
          <div className="flex-shrink-0 px-7 py-5 border-b">
            <div className="flex items-start justify-between">
              <div>
                <DialogPrimitive.Title className="text-xl font-semibold text-gray-900">
                  {title}
                </DialogPrimitive.Title>
                {subtitle && <div className="text-sm text-gray-600 mt-1">{subtitle}</div>}
              </div>
              <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2">
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-auto">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
