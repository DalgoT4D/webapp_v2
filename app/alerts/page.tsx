'use client';

import { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import {
  AlertsTable,
  AllAlertsEmptyState,
  FiringEmptyState,
} from '@/components/alerts/AlertsTable';
import { AlertLogModal } from '@/components/alerts/AlertLogModal';
import type { AlertListItem } from '@/types/alerts';
import { ALERT_PERMISSIONS } from '@/types/alerts';
import { useUserPermissions } from '@/hooks/api/usePermissions';

export default function AlertsPage() {
  const { hasPermission } = useUserPermissions();
  const canCreate = hasPermission(ALERT_PERMISSIONS.create);
  const canEdit = hasPermission(ALERT_PERMISSIONS.edit);
  const canDelete = hasPermission(ALERT_PERMISSIONS.delete);

  const [tab, setTab] = useState<'all' | 'firing'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [createOpen, setCreateOpen] = useState(false);
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
    fired: tab === 'firing' ? true : undefined,
  });

  const handleToggle = async (a: AlertListItem) => {
    try {
      await toggleAlert(a.id, !a.is_active);
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

  const totalForActiveTab = total;
  const totalPagesForActiveTab = totalPages;

  return (
    <div id="alerts-list-container" className="h-full flex flex-col">
      {/* Fixed Header */}
      <div id="alerts-header" className="flex-shrink-0 border-b bg-background">
        <div id="alerts-title-section" className="flex items-center justify-between p-6 pb-4">
          <div>
            <h1 className="text-3xl font-bold">Alerts</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitor your critical business metrics and set up automated notifications to stay
              ahead of anomalies.
            </p>
          </div>
          {canCreate && (
            <Button
              variant="ghost"
              className="text-white hover:opacity-90 shadow-xs"
              style={{ backgroundColor: 'var(--primary)' }}
              onClick={() => setCreateOpen(true)}
              data-testid="create-alert-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Alert
            </Button>
          )}
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as 'all' | 'firing');
          setCurrentPage(1);
        }}
        className="flex-1 flex flex-col min-h-0"
      >
        {/* Tabs row — full width with bottom border, like the header */}
        <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50/30 px-6">
          <TabsList className="h-auto w-fit justify-start gap-6 rounded-none bg-transparent p-0">
            <TabsTrigger
              value="all"
              data-testid="tab-all"
              className="relative h-auto cursor-pointer rounded-none border-0 bg-transparent px-0 pb-3 pt-2 text-base font-medium text-gray-500 shadow-none transition-colors hover:text-gray-900 data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:shadow-none after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent hover:after:bg-gray-300 data-[state=active]:[color:var(--primary)] data-[state=active]:after:[background-color:var(--primary)]"
            >
              All Alerts
            </TabsTrigger>
            <TabsTrigger
              value="firing"
              data-testid="tab-firing"
              className="relative h-auto cursor-pointer rounded-none border-0 bg-transparent px-0 pb-3 pt-2 text-base font-medium text-gray-500 shadow-none transition-colors hover:text-gray-900 data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:shadow-none after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent hover:after:bg-gray-300 data-[state=active]:[color:var(--primary)] data-[state=active]:after:[background-color:var(--primary)]"
            >
              Firing
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Scrollable Content */}
        <div id="alerts-content-wrapper" className="flex-1 overflow-hidden px-6">
          <div id="alerts-scrollable-content" className="h-full overflow-y-auto py-4">
            {/* Same table for both tabs — switching tabs refetches with `fired` filter. */}
            <TabsContent value={tab} forceMount className="mt-0">
              <AlertsTable
                alerts={alerts}
                isLoading={isLoading}
                emptyState={
                  tab === 'firing' ? (
                    <FiringEmptyState />
                  ) : (
                    <AllAlertsEmptyState
                      canCreate={canCreate}
                      onCreate={() => setCreateOpen(true)}
                    />
                  )
                }
                canEdit={canEdit}
                canDelete={canDelete}
                onEdit={(a) => setEditingId(a.id)}
                onDelete={(a) => setDeletingAlert(a)}
                onToggle={handleToggle}
                onOpenLog={(a) => setLogModalAlert(a)}
              />
            </TabsContent>
          </div>
        </div>
      </Tabs>

      {/* Pagination Footer */}
      <div className="flex-shrink-0 border-t border-gray-100 bg-gray-50/30 py-3 px-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {totalForActiveTab === 0
              ? '0–0 of 0'
              : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, totalForActiveTab)} of ${totalForActiveTab}`}
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
                {currentPage} of {totalPagesForActiveTab || 1}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= totalPagesForActiveTab}
                className="h-7 px-2 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AlertWizardModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => mutate()}
        initial={{ alertType: 'standalone' }}
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
