'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WarehouseFormBody } from '@/components/ingest/warehouse/warehouse-form-body';
import type { Warehouse } from '@/types/warehouse';

interface WarehouseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: Warehouse;
  isEditing?: boolean;
  onSuccess: () => void;
}

/**
 * Standalone Set-Up / Edit Warehouse dialog (Settings → Warehouse). A thin Dialog
 * wrapper around the shared WarehouseFormBody, which owns all the form state, the
 * connection check, and the create/update calls. The add-source wizard renders the
 * same body as its first step (no warehouse yet), so the two stay in sync.
 */
export function WarehouseForm({
  open,
  onOpenChange,
  warehouse,
  isEditing = false,
  onSuccess,
}: WarehouseFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden"
        preventOutsideClose
      >
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle>{isEditing ? 'Edit Warehouse' : 'Set Up Warehouse'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update your warehouse connection settings.'
              : 'Configure your data warehouse destination.'}
          </DialogDescription>
        </DialogHeader>

        <WarehouseFormBody
          warehouse={warehouse}
          isEditing={isEditing}
          onSuccess={onSuccess}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
