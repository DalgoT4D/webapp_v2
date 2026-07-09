'use client';

import { useState } from 'react';
import { Database, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { WarehouseDisplay } from '@/components/ingest/warehouse/warehouse-display';
import type { Warehouse } from '@/types/warehouse';

interface WarehouseChipProps {
  warehouse: Warehouse;
}

/**
 * Compact top-right chip showing the org's single warehouse. Clicking it opens
 * the full warehouse panel (config table, edit, delete, IP banner) — the same
 * surface the classic "Your Warehouse" tab showed — inside a dialog.
 */
export function WarehouseChip({ warehouse }: WarehouseChipProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-muted cursor-pointer"
        data-testid="warehouse-chip"
      >
        <Database className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="font-medium text-foreground max-w-[12rem] truncate">{warehouse.name}</span>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {warehouse.wtype}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-2xl max-h-[85vh] overflow-y-auto p-0"
          data-testid="warehouse-panel-dialog"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Warehouse settings</DialogTitle>
          </DialogHeader>
          <WarehouseDisplay />
        </DialogContent>
      </Dialog>
    </>
  );
}
