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
  getOrgDeletionImpact,
  useAdminOrgActions,
  type AdminOrg,
} from '@/hooks/api/useAdminPortal';
import { useImpactPreflight } from '@/components/admin/useImpactPreflight';

interface DeleteOrgDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  org: AdminOrg | null;
  onSuccess: () => void;
}

/**
 * Delete an organization — an irreversible, hard-CASCADE action: it wipes the
 * Airbyte workspace, Prefect pipelines, warehouse credentials, dbt/git setup, every
 * org user, and every dashboard/chart/report snapshot the org owns.
 *
 * SAFETY GUARDRAIL (non-negotiable): when the dialog opens it fetches the real
 * deletion-impact counts and shows them. The confirm button stays DISABLED until
 * those counts have loaded, and the delete handler refuses to proceed if the impact
 * is not present. The admin can never delete an org without first seeing how much
 * will be destroyed. That guarantee lives in useImpactPreflight, shared with
 * RemoveUserDialog.
 */
export function DeleteOrgDialog({ open, onOpenChange, org, onSuccess }: DeleteOrgDialogProps) {
  const { deleteOrg } = useAdminOrgActions();

  const [isDeleting, setIsDeleting] = useState(false);
  const {
    impact,
    isLoading: loadingImpact,
    isError: impactError,
    canConfirm: impactShown,
  } = useImpactPreflight(open, org, (target: AdminOrg) => getOrgDeletionImpact(target.id));

  const handleDelete = async () => {
    // Guardrail: never delete without the impact having been fetched and shown.
    if (!org || !impactShown) return;

    setIsDeleting(true);
    try {
      await deleteOrg(org.id);
      onSuccess();
    } catch {
      // toast surfaced in the hook
    } finally {
      setIsDeleting(false);
    }
  };

  // Confirm is only allowed once the counts are on screen.
  const canConfirm = impactShown && !isDeleting;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete organization</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Permanently delete <strong>{org?.name}</strong>? This cannot be undone — its Airbyte
                workspace, pipelines, warehouse connection, and dbt setup will all be torn down.
              </p>

              {loadingImpact && (
                <p
                  data-testid="org-deletion-impact-loading"
                  className="text-sm text-muted-foreground"
                >
                  Checking what this will affect…
                </p>
              )}

              {impactError && (
                <p data-testid="org-deletion-impact-error" className="text-sm text-destructive">
                  Couldn’t load the deletion impact. Close this dialog and try again — deletion is
                  blocked until we can show you what it will destroy.
                </p>
              )}

              {impact !== null && (
                <div
                  data-testid="org-deletion-impact-summary"
                  className="rounded-md border border-muted-foreground/30 bg-muted/40 p-3 text-sm"
                >
                  <p className="font-medium">This will permanently delete:</p>
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                    <li data-testid="org-deletion-impact-users">
                      {impact.user_count} user{impact.user_count === 1 ? '' : 's'}
                    </li>
                    <li data-testid="org-deletion-impact-warehouses">
                      {impact.warehouse_count} warehouse{impact.warehouse_count === 1 ? '' : 's'}
                    </li>
                    <li data-testid="org-deletion-impact-connections">
                      {impact.connection_count} connection{impact.connection_count === 1 ? '' : 's'}
                    </li>
                    <li data-testid="org-deletion-impact-pipelines">
                      {impact.pipeline_count} pipeline{impact.pipeline_count === 1 ? '' : 's'}
                    </li>
                    {impact.dashboard_count > 0 && (
                      <li data-testid="org-deletion-impact-dashboards">
                        {impact.dashboard_count} dashboard{impact.dashboard_count === 1 ? '' : 's'}
                      </li>
                    )}
                    {impact.chart_count > 0 && (
                      <li data-testid="org-deletion-impact-charts">
                        {impact.chart_count} chart{impact.chart_count === 1 ? '' : 's'}
                      </li>
                    )}
                    {impact.report_count > 0 && (
                      <li data-testid="org-deletion-impact-reports">
                        {impact.report_count} report snapshot{impact.report_count === 1 ? '' : 's'}
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!canConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="delete-org-confirm"
          >
            {isDeleting ? 'Deleting…' : 'Delete organization'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
