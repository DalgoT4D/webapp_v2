'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeleteTabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteTabDialog({ open, onOpenChange, onConfirm }: DeleteTabDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="delete-tab-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Tab</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this Tab? This change cannot be undone and you will lose
            progress on this tab.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="delete-tab-cancel-btn">CANCEL</AlertDialogCancel>
          <AlertDialogAction
            data-testid="delete-tab-confirm-btn"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-white"
            onClick={onConfirm}
          >
            DELETE
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
