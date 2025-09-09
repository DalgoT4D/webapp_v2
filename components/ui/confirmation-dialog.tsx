'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';

type DialogType = 'warning' | 'info' | 'success' | 'error';

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  type?: DialogType;
  onConfirm: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

const typeConfig = {
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-600',
    confirmVariant: 'destructive' as const,
  },
  info: {
    icon: Info,
    iconClass: 'text-blue-600',
    confirmVariant: 'default' as const,
  },
  success: {
    icon: CheckCircle,
    iconClass: 'text-green-600',
    confirmVariant: 'default' as const,
  },
  error: {
    icon: XCircle,
    iconClass: 'text-red-600',
    confirmVariant: 'destructive' as const,
  },
};

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmationDialogProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Icon className={`w-5 h-5 ${config.iconClass}`} />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2">{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="cancel"
            onClick={handleCancel}
            disabled={isLoading}
            className="font-medium uppercase"
          >
            {cancelText.toUpperCase()}
          </Button>
          <Button
            variant={config.confirmVariant}
            onClick={handleConfirm}
            disabled={isLoading}
            className="font-medium uppercase"
          >
            {isLoading ? 'LOADING...' : confirmText.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook for managing confirmation dialogs
export function useConfirmationDialog() {
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    type?: DialogType;
    onConfirm: () => void;
    onCancel?: () => void;
    isLoading?: boolean;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const confirm = (options: Omit<typeof dialogState, 'open'>) => {
    return new Promise<boolean>((resolve) => {
      setDialogState({
        ...options,
        open: true,
        onConfirm: () => {
          if (options.onConfirm) options.onConfirm();
          resolve(true);
        },
        onCancel: () => {
          if (options.onCancel) options.onCancel();
          resolve(false);
        },
      });
    });
  };

  const closeDialog = () => {
    setDialogState((prev) => ({ ...prev, open: false }));
  };

  const DialogComponent = () => <ConfirmationDialog {...dialogState} onOpenChange={closeDialog} />;

  return {
    confirm,
    DialogComponent,
    closeDialog,
  };
}
