'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { Plus, ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
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
import { useResourceAccess, type BulkAccessResponse } from '@/hooks/api/useResourceAccess';
import { AlertWizardModal } from '@/components/alerts/AlertWizardModal';
import { CreateAlertTypeModal } from '@/components/alerts/CreateAlertTypeModal';
import { AlertsTable, AllAlertsEmptyState } from '@/components/alerts/AlertsTable';
import { AlertLogModal } from '@/components/alerts/AlertLogModal';
import { RequestAccessScreen } from '@/components/sharing/request-access-screen';
import { ShareModal } from '@/components/ui/share-modal';
import { BulkShareDialog } from '@/components/sharing/bulk-share-dialog';
import { useMultiSelect, MAX_BULK_SELECTION } from '@/hooks/useMultiSelect';
import { DocsLink } from '@/components/ui/docs-link';
import type { AlertListItem } from '@/types/alerts';
import type { ShareStatus } from '@/types/reports';
import { AlertType } from '@/types/alerts';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import { getApiErrorStatus } from '@/lib/utils';

// Alerts have no public-link concept (public_link=False in the rtype
// registry — ShareModal already hides that section via the capabilities
// flag). getShareStatus/updateSharing are still required props on
// ShareModal (called unconditionally on open); these stubs never hit a
// real endpoint since the section they'd back is never rendered for alerts.
async function getAlertShareStatus(): Promise<ShareStatus> {
  return { is_public: false, public_access_count: 0 };
}
async function updateAlertSharing(): Promise<ShareStatus> {
  return { is_public: false, public_access_count: 0 };
}

export default function AlertsPage() {
  const { hasPermission } = useRbac();
  const canCreate = hasPermission(PERMISSIONS.CAN_CREATE_ALERTS);
  const canEdit = hasPermission(PERMISSIONS.CAN_EDIT_ALERTS);
  const canDelete = hasPermission(PERMISSIONS.CAN_DELETE_ALERTS);
  const canShareAlerts = hasPermission(PERMISSIONS.CAN_SHARE_ALERTS);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [createType, setCreateType] = useState<AlertType | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingAlert, setDeletingAlert] = useState<AlertListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [logModalAlert, setLogModalAlert] = useState<AlertListItem | null>(null);

  // Per-item Share (task-17f, cross-task gap closure) — one shared ShareModal
  // instance for the whole table, matching dashboard-list-v2.tsx's pattern.
  const [sharingAlert, setSharingAlert] = useState<AlertListItem | null>(null);

  // Bulk-selection bar (task-17f, Milestone 10) — persists across pagination,
  // capped at 100 (BULK_MAX_ITEMS) via useMultiSelect.
  const {
    selectedIds: selectedAlertIds,
    toggle: toggleAlertSelection,
    selectPage: selectAlertPage,
    deselectPage: deselectAlertPage,
    remove: removeAppliedAlertIds,
    clear: clearAlertSelection,
  } = useMultiSelect<number>();
  const [bulkShareOpen, setBulkShareOpen] = useState(false);

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

  // Selection persists across pagination, so the bar's count must be the
  // TRUE cross-page total (selectedAlertIds.size) — never a page-local
  // "N of {alerts.length}" denominator, which contradicts the (unchecked)
  // visible checkboxes as soon as the user pages away (finding 1).
  const selectedOnPageCount = useMemo(
    () => alerts.filter((a) => selectedAlertIds.has(a.id)).length,
    [alerts, selectedAlertIds]
  );
  const selectedOffPageCount = selectedAlertIds.size - selectedOnPageCount;

  const bulkShareItems = useMemo(
    () => Array.from(selectedAlertIds, (id) => ({ rtype: 'alert' as const, id: String(id) })),
    [selectedAlertIds]
  );

  const handleBulkApplied = useCallback(
    (response: BulkAccessResponse) => {
      const appliedIds = response.applied
        .filter((item) => item.rtype === 'alert')
        .map((item) => Number(item.id));
      removeAppliedAlertIds(appliedIds);
      mutate();
    },
    [removeAppliedAlertIds, mutate]
  );

  // Deep-link from an access-request/notification email: /alerts?alertId={id}
  // (Task 13's build_alert_url). The alerts list is already resolver-scoped
  // (accessible_filter), so an alert the viewer can see just needs
  // highlighting on whichever page it lands on; one the viewer CANNOT see
  // never appears in that list at all, but a fetch keyed to it individually
  // still 403s — the same generic access-overview endpoint every detail page
  // uses — so that's the seam this checks to offer the request-access flow.
  const searchParams = useSearchParams();
  const alertIdParam = searchParams.get('alertId');
  const deepLinkedAlertId = alertIdParam ? Number(alertIdParam) : null;
  const { isError: deepLinkAccessError } = useResourceAccess(
    deepLinkedAlertId ? 'alert' : null,
    deepLinkedAlertId
  );

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

  if (deepLinkedAlertId && getApiErrorStatus(deepLinkAccessError) === 403) {
    return (
      <RequestAccessScreen rtype="alert" resourceId={deepLinkedAlertId} resourceLabel="alert" />
    );
  }

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

        {/* Bulk-selection bar (task-17f) — appears once >=1 row is selected */}
        {canShareAlerts && selectedAlertIds.size > 0 && (
          <div
            data-testid="alert-bulk-share-bar"
            className="mx-6 mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-900">
                {selectedAlertIds.size} selected
                {selectedOffPageCount > 0 && ` · ${selectedOffPageCount} on other pages`}
                {selectedAlertIds.size >= MAX_BULK_SELECTION && ' (maximum 100 reached)'}
              </span>
              <div className="flex gap-2">
                <Button
                  data-testid="alert-bulk-select-all-btn"
                  variant="outline"
                  size="sm"
                  onClick={() => selectAlertPage(alerts.map((a) => a.id))}
                  disabled={alerts.every((a) => selectedAlertIds.has(a.id))}
                >
                  Select All
                </Button>
                <Button
                  data-testid="alert-bulk-clear-btn"
                  variant="outline"
                  size="sm"
                  onClick={clearAlertSelection}
                >
                  Clear
                </Button>
              </div>
            </div>
            <Button
              data-testid="alert-bulk-share-btn"
              variant="primary"
              size="sm"
              onClick={() => setBulkShareOpen(true)}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        )}
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
            highlightAlertId={alertIdParam}
            canShare={canShareAlerts}
            onShare={(a) => setSharingAlert(a)}
            selectedIds={selectedAlertIds}
            onToggleSelect={toggleAlertSelection}
            onSelectAllVisible={selectAlertPage}
            onDeselectAllVisible={deselectAlertPage}
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

      {/* Per-item Share (task-17f, cross-task gap closure) — the modal's
          capability flags already omit the public-link section for alerts;
          no alert-specific conditionals live in ShareModal itself. */}
      {sharingAlert && (
        <ShareModal
          entityId={sharingAlert.id}
          entityLabel="Alert"
          entityType="alert"
          isOpen={sharingAlert !== null}
          onClose={() => setSharingAlert(null)}
          getShareStatus={getAlertShareStatus}
          updateSharing={updateAlertSharing}
        />
      )}

      {/* Bulk Share Dialog (task-17f) — no public-link action (alert is
          public_link=False; the backend would skip every item). */}
      {bulkShareOpen && (
        <BulkShareDialog
          entityType="alert"
          entityLabel="alerts"
          items={bulkShareItems}
          isOpen={bulkShareOpen}
          onClose={() => setBulkShareOpen(false)}
          onApplied={handleBulkApplied}
          allowPublicLink={false}
        />
      )}
    </div>
  );
}
