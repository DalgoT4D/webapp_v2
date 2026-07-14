'use client';

import { useEffect, useState } from 'react';
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
  type RemovalImpact,
} from '@/hooks/api/useAdminPortal';

interface RemoveUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: number;
  orgUser: AdminOrgUser | null;
  onSuccess: () => void;
}

/**
 * Remove a user from an org — a destructive, CASCADING action: it deletes the
 * dashboards and charts the user created (plan.md §4.6 / research §5).
 *
 * SAFETY GUARDRAIL (non-negotiable): when the dialog opens it fetches the real
 * removal-impact counts and shows them. The confirm button stays DISABLED until
 * those counts have loaded, and the remove handler refuses to proceed if the
 * impact is not present. The user can never delete content without first seeing
 * how much will be destroyed.
 */
export function RemoveUserDialog({
  open,
  onOpenChange,
  orgId,
  orgUser,
  onSuccess,
}: RemoveUserDialogProps) {
  const { removeUser } = useAdminOrgUserActions();

  const [impact, setImpact] = useState<RemovalImpact | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [impactError, setImpactError] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  // Fetch the impact every time the dialog opens for a user; reset when it closes.
  useEffect(() => {
    if (!open || !orgUser) {
      setImpact(null);
      setImpactError(false);
      return undefined;
    }

    let cancelled = false;
    setLoadingImpact(true);
    setImpactError(false);
    setImpact(null);

    getRemovalImpact(orgId, orgUser.orguser_id)
      .then((data) => {
        if (!cancelled) setImpact(data);
      })
      .catch(() => {
        if (!cancelled) setImpactError(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingImpact(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, orgId, orgUser]);

  const handleRemove = async () => {
    // Guardrail: never remove without the impact having been fetched and shown.
    if (!orgUser || impact === null) return;

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
  const canConfirm = impact !== null && !isRemoving;

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
                  Checking what will be deleted…
                </p>
              )}

              {impactError && (
                <p data-testid="removal-impact-error" className="text-sm text-destructive">
                  Couldn’t load the deletion impact. Close this dialog and try again — removal is
                  blocked until we can show you what will be deleted.
                </p>
              )}

              {impact !== null && (
                <div
                  data-testid="removal-impact-summary"
                  className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
                >
                  <p className="font-medium text-destructive">This will also permanently delete:</p>
                  <ul className="mt-1 list-disc pl-5">
                    <li data-testid="removal-impact-dashboards">
                      {impact.dashboards_deleted} dashboard
                      {impact.dashboards_deleted === 1 ? '' : 's'} they created
                    </li>
                    <li data-testid="removal-impact-charts">
                      {impact.charts_deleted} chart{impact.charts_deleted === 1 ? '' : 's'} they
                      created
                    </li>
                  </ul>
                  {impact.reports_orphaned > 0 && (
                    <p data-testid="removal-impact-reports" className="mt-1 text-muted-foreground">
                      {impact.reports_orphaned} report snapshot
                      {impact.reports_orphaned === 1 ? '' : 's'} will be kept but un-linked from
                      this user.
                    </p>
                  )}
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
