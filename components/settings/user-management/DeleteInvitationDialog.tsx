'use client';

import { useState } from 'react';
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
import { useInvitationActions } from '@/hooks/api/useUserManagement';

interface DeleteInvitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invitationId: number;
  onSuccess: () => void;
}

export function DeleteInvitationDialog({
  open,
  onOpenChange,
  invitationId,
  onSuccess,
}: DeleteInvitationDialogProps) {
  const { deleteInvitation } = useInvitationActions();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteInvitation(invitationId);
      onSuccess();
    } catch (error) {
      // Error is handled in the hook
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Invitation</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this invitation? This action cannot be undone and the
            invited user will no longer be able to join using this invitation.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete Invitation'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
