'use client';

import Link from 'next/link';
import { Database } from 'lucide-react';
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
      className="group inline-flex items-center gap-1.5 text-sm leading-none cursor-pointer"
      data-testid="warehouse-chip"
    >
      <Database className="h-4 w-4 text-primary flex-shrink-0" />
      <span className="text-muted-foreground group-hover:underline">
        Warehouse (<span className="capitalize">{warehouse.wtype}</span>):
      </span>
      <span className="font-medium text-foreground max-w-[12rem] truncate group-hover:underline">
        {warehouse.name}
      </span>
    </Link>
  );
}
