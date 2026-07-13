'use client';

import { useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { toast } from 'sonner';
import { deleteAlert, toggleAlert, useAlerts } from '@/hooks/api/useAlerts';
import { AlertWizardModal } from '@/components/alerts/AlertWizardModal';
import { CreateAlertTypeModal } from '@/components/alerts/CreateAlertTypeModal';
import { AlertsTable, AllAlertsEmptyState } from '@/components/alerts/AlertsTable';
import { AlertLogModal } from '@/components/alerts/AlertLogModal';
import { DocsLink } from '@/components/ui/docs-link';
import type { AlertListItem } from '@/types/alerts';
import { AlertType } from '@/types/alerts';
import { PERMISSIONS, useRbac } from '@/lib/rbac';

export default function AlertsPage() {
  const { hasPermission } = useRbac();
  const canCreate = hasPermission(PERMISSIONS.CAN_CREATE_ALERTS);
  const canEdit = hasPermission(PERMISSIONS.CAN_EDIT_ALERTS);
  const canDelete = hasPermission(PERMISSIONS.CAN_DELETE_ALERTS);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [createType, setCreateType] = useState<AlertType | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingAlert, setDeletingAlert] = useState<AlertListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [logModalAlert, setLogModalAlert] = useState<AlertListItem | null>(null);

  const {
    data: alerts,
    total,
    totalPages,
    isLoading,
    mutate,
  } = useAlerts({
    page: currentPage,
    pageSize,
  });

  const handleToggle = async (a: AlertListItem) => {
    try {
      await toggleAlert(a.id, !a.is_active);
      trackEvent(ANALYTICS_EVENTS.ALERT_TOGGLED, { enabled: !a.is_active });
      toast.success(a.is_active ? 'Alert disabled.' : 'Alert enabled.');
      mutate();
    } catch {
      toast.error("Couldn't update the alert. The row was reverted.");
    }
  };

  const handleDelete = async () => {
    if (!deletingAlert) return;
    setIsDeleting(true);
    try {
      await deleteAlert(deletingAlert.id);
      trackEvent(ANALYTICS_EVENTS.ALERT_DELETED);
      toast.success('Alert deleted.');
      setDeletingAlert(null);
      mutate();
    } catch (err) {
      const reason =
        (err as any)?.detail || (err as any)?.message || (err as any)?.error || 'try again';
      toast.error(`Couldn't delete the alert. ${reason}.`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div id="alerts-list-container" className="h-full flex flex-col">
      {/* Fixed Header */}
      <div id="alerts-header" className="flex-shrink-0 border-b bg-background">
        <div id="alerts-title-section" className="flex items-center justify-between mb-6 p-6 pb-0">
          <div>
            <DocsLink path="/alerts">
              <h1 className="text-3xl font-bold">Alerts</h1>
            </DocsLink>
            <p className="text-muted-foreground mt-1">
              Monitor your critical business metrics and set up automated notifications to stay
              ahead of anomalies.
            </p>
          </div>
          {canCreate && (
            <CreateAlertTypeModal onSelect={setCreateType}>
              <Button variant="primary" data-testid="create-alert-btn">
                <Plus className="w-4 h-4 mr-2" />
                CREATE ALERT
              </Button>
            </CreateAlertTypeModal>
          )}
        </div>
      </div>

      <div id="alerts-content-wrapper" className="flex-1 overflow-hidden px-6">
        <div id="alerts-scrollable-content" className="h-full overflow-y-auto py-4">
          <AlertsTable
            alerts={alerts}
            isLoading={isLoading}
            emptyState={
              <AllAlertsEmptyState canCreate={canCreate} onCreate={(t) => setCreateType(t)} />
            }
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={(a) => setEditingId(a.id)}
            onDelete={(a) => setDeletingAlert(a)}
            onToggle={handleToggle}
            onOpenLog={(a) => {
              trackEvent(ANALYTICS_EVENTS.ALERT_LOGS_VIEWED);
              setLogModalAlert(a);
            }}
          />
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="flex-shrink-0 border-t border-gray-100 bg-gray-50/30 py-3 px-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {total === 0
              ? '0–0 of 0'
              : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} of ${total}`}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Show</span>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => {
                  setPageSize(parseInt(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger
                  className="h-7 text-sm border-gray-200 bg-white"
                  style={{ width: '70px' }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-7 px-2 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600 px-3 py-1">
                {currentPage} of {totalPages || 1}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="h-7 px-2 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AlertWizardModal
        open={createType !== null}
        onOpenChange={(o) => !o && setCreateType(null)}
        onSuccess={() => mutate()}
        initial={createType ? { alertType: createType } : undefined}
      />

      <AlertWizardModal
        open={editingId !== null}
        onOpenChange={(o) => !o && setEditingId(null)}
        onSuccess={() => mutate()}
        alertId={editingId}
      />

      <AlertLogModal
        open={logModalAlert !== null}
        onOpenChange={(o) => !o && setLogModalAlert(null)}
        alertId={logModalAlert?.id ?? null}
        alertName={logModalAlert?.name}
      />

      <AlertDialog open={!!deletingAlert} onOpenChange={(o) => !o && setDeletingAlert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Alert &quot;{deletingAlert?.name}&quot;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Alert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
