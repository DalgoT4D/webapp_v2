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
import {
  getRemovalImpact,
  useAdminOrgUserActions,
  type AdminOrgUser,
} from '@/hooks/api/useAdminPortal';
import { useImpactPreflight } from '@/components/admin/useImpactPreflight';

interface RemoveUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: number;
  orgUser: AdminOrgUser | null;
  onSuccess: () => void;
}

/**
 * Remove a user from an org — destructive, but ORPHANING rather than deleting: the
 * dashboards / charts / report snapshots they created are KEPT, with created_by set
 * to NULL (Access Control v2 switched dashboards and charts from CASCADE to SET_NULL;
 * reports already were). See plan.md §4.6 / research §5, and the counts rendered below.
 *
 * SAFETY GUARDRAIL (non-negotiable): when the dialog opens it fetches the real
 * removal-impact counts and shows them. The confirm button stays DISABLED until
 * those counts have loaded, and the remove handler refuses to proceed if the impact
 * is not present. The admin can never remove a user without first seeing what it
 * affects. That guarantee lives in useImpactPreflight, shared with DeleteOrgDialog.
 */
export function RemoveUserDialog({
  open,
  onOpenChange,
  orgId,
  orgUser,
  onSuccess,
}: RemoveUserDialogProps) {
  const { removeUser } = useAdminOrgUserActions();

  const [isRemoving, setIsRemoving] = useState(false);
  const {
    impact,
    isLoading: loadingImpact,
    isError: impactError,
    canConfirm: impactShown,
  } = useImpactPreflight(open, orgUser, (target: AdminOrgUser) =>
    getRemovalImpact(orgId, target.orguser_id)
  );

  const handleRemove = async () => {
    // Guardrail: never remove without the impact having been fetched and shown.
    if (!orgUser || !impactShown) return;

    setIsRemoving(true);
    try {
      await removeUser(orgId, orgUser.orguser_id);
      onSuccess();
    } catch {
      // toast surfaced in the hook
    } finally {
      setIsRemoving(false);
    }
  };

  // Confirm is only allowed once the counts are on screen.
  const canConfirm = impactShown && !isRemoving;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove user</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Remove <strong>{orgUser?.email}</strong> from this organization? They will need to
                be invited again to rejoin.
              </p>

              {loadingImpact && (
                <p data-testid="removal-impact-loading" className="text-sm text-muted-foreground">
                  Checking what this will affect…
                </p>
              )}

              {impactError && (
                <p data-testid="removal-impact-error" className="text-sm text-destructive">
                  Couldn’t load the removal impact. Close this dialog and try again — removal is
                  blocked until we can show you what it will affect.
                </p>
              )}

              {impact !== null && (
                <div
                  data-testid="removal-impact-summary"
                  className="rounded-md border border-muted-foreground/30 bg-muted/40 p-3 text-sm"
                >
                  <p className="font-medium">
                    Their content will be kept — only the creator link is removed from:
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                    <li data-testid="removal-impact-dashboards">
                      {impact.dashboards_orphaned} dashboard
                      {impact.dashboards_orphaned === 1 ? '' : 's'} they created
                    </li>
                    <li data-testid="removal-impact-charts">
                      {impact.charts_orphaned} chart{impact.charts_orphaned === 1 ? '' : 's'} they
                      created
                    </li>
                    {impact.reports_orphaned > 0 && (
                      <li data-testid="removal-impact-reports">
                        {impact.reports_orphaned} report snapshot
                        {impact.reports_orphaned === 1 ? '' : 's'} they created
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemove}
            disabled={!canConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="remove-user-confirm"
          >
            {isRemoving ? 'Removing…' : 'Remove user'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
