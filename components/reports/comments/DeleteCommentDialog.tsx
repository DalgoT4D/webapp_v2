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

interface DeleteCommentDialogProps {
  commentId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** "Delete Comment" confirmation for one comment. */
export function DeleteCommentDialog({
  commentId,
  open,
  onOpenChange,
  onConfirm,
}: DeleteCommentDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Comment</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this comment? This change cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className="uppercase text-xs font-semibold"
            data-testid={`cancel-delete-btn-${commentId}`}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90 uppercase text-xs font-semibold"
            data-testid={`confirm-delete-btn-${commentId}`}
            onClick={onConfirm}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
