'use client';

import { useState } from 'react';
import { Database, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import { WarehouseForm } from '@/components/ingest/warehouse/warehouse-form';
import { IpWhitelistBanner } from '@/components/ingest/redesign/ip-whitelist-banner';

interface EmptyWarehouseCardProps {
  onCreated: () => void;
}

/**
 * Step 1 of the progressive reveal: the org has no warehouse. Shows a single
 * explanatory card with one action — set up the warehouse — plus the IP
 * whitelist banner needed for setup.
 */
export function EmptyWarehouseCard({ onCreated }: EmptyWarehouseCardProps) {
  const { hasPermission } = useRbac();
  const canCreate = hasPermission(PERMISSIONS.CAN_CREATE_WAREHOUSE);
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-full px-6 py-12"
      data-testid="ingest-empty-warehouse"
    >
      <div className="w-full max-w-md flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Database className="h-8 w-8 text-primary" />
        </div>
        <h2 className="mt-6 text-2xl font-bold text-foreground">Set up your warehouse</h2>
        <p className="mt-2 text-base text-muted-foreground">
          A warehouse is where all your data lands. Set this up once — before adding any sources or
          connections.
        </p>
        <Button
          variant="primary"
          className="uppercase mt-6"
          onClick={() => setFormOpen(true)}
          disabled={!canCreate}
          data-testid="setup-warehouse-btn"
        >
          <Plus className="h-4 w-4 mr-2" />
          Set Up Warehouse
        </Button>
        {!canCreate && (
          <p className="mt-3 text-sm text-muted-foreground">
            You don&apos;t have permission to set up a warehouse. Ask an admin.
          </p>
        )}

        <div className="mt-10 w-full">
          <IpWhitelistBanner />
        </div>
      </div>

      {formOpen && (
        <WarehouseForm
          open={formOpen}
          onOpenChange={setFormOpen}
          onSuccess={() => {
            setFormOpen(false);
            onCreated();
          }}
        />
      )}
    </div>
  );
}
