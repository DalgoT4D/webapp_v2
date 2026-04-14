'use client';

import { useState, useMemo, useCallback } from 'react';
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWarehouse, deleteWarehouse } from '@/hooks/api/useWarehouse';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { WAREHOUSE_PERMISSIONS } from '@/constants/warehouse';
import { toastSuccess, toastError } from '@/lib/toast';
import { getWarehouseTableData } from './warehouse-table-data';
import { WarehouseForm } from './warehouse-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function WarehouseDisplay() {
  const { data: warehouse, isLoading, mutate } = useWarehouse();
  const { hasPermission } = useUserPermissions();

  const [formOpen, setFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const canCreate = hasPermission(WAREHOUSE_PERMISSIONS.CREATE);
  const canEdit = hasPermission(WAREHOUSE_PERMISSIONS.EDIT);
  const canDelete = hasPermission(WAREHOUSE_PERMISSIONS.DELETE);

  const isSuperAdmin = hasPermission('can_create_org');

  const tableData = useMemo(() => {
    if (!warehouse) return [];
    return getWarehouseTableData(warehouse, isSuperAdmin);
  }, [warehouse, isSuperAdmin]);

  const handleCreate = useCallback(() => {
    setIsEditing(false);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await deleteWarehouse();
      await mutate(undefined, { revalidate: true });
      toastSuccess.deleted('Warehouse');
      setDeleteDialogOpen(false);
    } catch (error) {
      toastError.delete(error, 'warehouse');
    } finally {
      setIsDeleting(false);
    }
  }, [mutate]);

  const handleFormSuccess = useCallback(() => {
    setFormOpen(false);
    mutate();
  }, [mutate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state — no warehouse configured
  if (!warehouse) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">No warehouse configured yet.</p>
        <Button
          variant="ghost"
          className="text-white hover:opacity-90 shadow-xs uppercase"
          style={{ backgroundColor: 'var(--primary)' }}
          onClick={handleCreate}
          disabled={!canCreate}
          data-testid="create-warehouse-btn"
        >
          <Plus className="h-4 w-4 mr-2" />
          Set Up Warehouse
        </Button>

        {formOpen && (
          <WarehouseForm open={formOpen} onOpenChange={setFormOpen} onSuccess={handleFormSuccess} />
        )}
      </div>
    );
  }

  // Display existing warehouse
  return (
    <div className="px-6 pt-6 pb-6 max-w-3xl">
      {/* Warehouse heading — name + icon */}
      <h2 className="text-3xl font-bold tracking-tight">{warehouse.name}</h2>
      {warehouse.icon && (
        <img
          src={warehouse.icon}
          alt={warehouse.wtype}
          className="h-20 w-20 mt-4"
          data-testid="warehouse-icon"
        />
      )}

      {/* Config table — card-style rows */}
      <div className="mt-6 space-y-2" data-testid="warehouse-config-table">
        {tableData.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-lg border bg-card px-5 py-3"
          >
            <span className="text-sm font-medium text-muted-foreground">{row.label}</span>
            <span className="text-sm text-right">
              {row.link ? (
                <a
                  href={row.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {row.value ?? '—'}
                </a>
              ) : (
                (row.value ?? '—')
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Action buttons at bottom */}
      <div className="flex gap-3 mt-6">
        <Button
          variant="outline"
          onClick={handleEdit}
          disabled={!canEdit}
          className="border-primary text-primary hover:bg-primary/5"
          data-testid="edit-warehouse-btn"
        >
          <Pencil className="h-4 w-4 mr-2" />
          EDIT
        </Button>
        <Button
          variant="destructive"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={!canDelete}
          data-testid="delete-warehouse-btn"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          DELETE WAREHOUSE
        </Button>
      </div>

      {/* Edit form dialog */}
      {formOpen && (
        <WarehouseForm
          open={formOpen}
          onOpenChange={setFormOpen}
          warehouse={warehouse}
          isEditing={isEditing}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Warehouse</DialogTitle>
            <DialogDescription>
              Deleting the warehouse will also delete all the connections, flows and the dbt repo.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
              data-testid="cancel-delete-btn"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              data-testid="confirm-delete-btn"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
