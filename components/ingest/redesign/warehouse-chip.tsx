'use client';

import Link from 'next/link';
import { Database, ChevronRight } from 'lucide-react';
import type { Warehouse } from '@/types/warehouse';

interface WarehouseChipProps {
  warehouse: Warehouse;
}

/**
 * Compact top-right chip showing the org's single warehouse. It links out to the
 * warehouse's home in Settings (Settings → Warehouse), where it can be viewed,
 * edited, or deleted — the warehouse is org infrastructure, not an ingest concern.
 */
export function WarehouseChip({ warehouse }: WarehouseChipProps) {
  return (
    <Link
      href="/settings/warehouse"
      className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-muted"
      data-testid="warehouse-chip"
    >
      <Database className="h-4 w-4 text-primary flex-shrink-0" />
      <span className="text-muted-foreground">Warehouse:</span>
      <span className="font-medium text-foreground max-w-[12rem] truncate">{warehouse.name}</span>
      <span className="uppercase text-muted-foreground">({warehouse.wtype})</span>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
    </Link>
  );
}
