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
import { deleteGroup, type UserGroup } from '@/hooks/api/useUserGroups';
import { toastSuccess, toastError } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

interface DeleteGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: UserGroup | null;
  onSuccess: () => void;
}

export function DeleteGroupDialog({
  open,
  onOpenChange,
  group,
  onSuccess,
}: DeleteGroupDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!group) return;
    setIsDeleting(true);
    try {
      await deleteGroup(group.id);
      trackEvent(ANALYTICS_EVENTS.GROUP_DELETED);
      toastSuccess.generic('Group deleted');
      onSuccess();
    } catch (error) {
      toastError.delete(error, group.name);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="delete-group-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete group</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{group?.name}</strong>? Deleting this group
            removes any access it was granted to dashboards, reports, and other resources. This
            can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="delete-group-cancel-btn" disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid="delete-group-confirm-btn"
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting…' : 'Delete group'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
