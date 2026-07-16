'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { DocsLink } from '@/components/ui/docs-link';
import { Button } from '@/components/ui/button';
import { EmptyWarehouseCard } from '@/components/ingest/redesign/empty-warehouse-card';
import { EmptySourceCard } from '@/components/ingest/redesign/empty-source-card';
import { WarehouseChip } from '@/components/ingest/redesign/warehouse-chip';
import { SteadyView } from '@/components/ingest/redesign/steady-view';
import { selectIngestState } from '@/components/ingest/redesign/state';
import { AddSourceWizard } from '@/components/ingest/sources/wizard/AddSourceWizard';
import { useWarehouse } from '@/hooks/api/useWarehouse';
import { useSources } from '@/hooks/api/useSources';
import { useConnectionsList } from '@/hooks/api/useConnections';
import { PERMISSIONS, useRbac } from '@/lib/rbac';

/**
 * The Ingest page: progressive-reveal (warehouse → source → connection) with
 * source-grouped connections in a side-by-side layout. The screen shown is a
 * pure function of what data exists (see selectIngestState).
 */
export function IngestView() {
  const warehouse = useWarehouse();
  const sources = useSources();
  // SteadyView reads the same connections SWR cache, so revalidating it here (on
  // wizard completion) makes the new connection appear instead of the empty state.
  const { mutate: mutateConnections } = useConnectionsList();
  const { hasPermission } = useRbac();
  const canCreateSource = hasPermission(PERMISSIONS.CAN_CREATE_SOURCE);
  const canCreateWarehouse = hasPermission(PERMISSIONS.CAN_CREATE_WAREHOUSE);

  // The "New Source" action lives in the page header (like the Charts page), so it
  // owns the wizard rather than SteadyView. SteadyView reads the same useSources
  // SWR cache, so it refreshes automatically when a source is created here.
  const [wizardOpen, setWizardOpen] = useState(false);
  // Frozen when the wizard opens so revalidating the warehouse mid-flow (after step 1)
  // doesn't drop the wizard from 4 steps to 3.
  const [wizardNeedsWarehouse, setWizardNeedsWarehouse] = useState(false);

  const state = selectIngestState(
    { data: warehouse.data, isLoading: warehouse.isLoading },
    { data: sources.data, isLoading: sources.isLoading }
  );

  // First-time users (no warehouse) land straight in the wizard at its warehouse
  // step — no intermediate button. Auto-open once per mount; if they close it the
  // card behind stays and can re-open it (see openWarehouseWizard).
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (state === 'NO_WAREHOUSE' && canCreateWarehouse && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setWizardNeedsWarehouse(true);
      setWizardOpen(true);
    }
  }, [state, canCreateWarehouse]);

  const openWarehouseWizard = () => {
    setWizardNeedsWarehouse(true);
    setWizardOpen(true);
  };
  const openSourceWizard = () => {
    setWizardNeedsWarehouse(false);
    setWizardOpen(true);
  };

  return (
    <div className="h-full flex flex-col" data-testid="ingest-view">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="flex items-center justify-between mb-6 p-6 pb-0">
          <div>
            <div className="flex items-baseline gap-3">
              <DocsLink path="/data/ingest">
                <h1 className="text-3xl font-bold">Ingest</h1>
              </DocsLink>
              {warehouse.data && <WarehouseChip warehouse={warehouse.data} />}
            </div>
            <p className="text-muted-foreground mt-1">
              Bring your data into Dalgo — set up a warehouse, add sources, then sync connections
            </p>
          </div>
          {warehouse.data && canCreateSource && (
            <Button
              variant="primary"
              className="uppercase"
              onClick={openSourceWizard}
              data-testid="new-source-btn"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Source
            </Button>
          )}
        </div>
      </div>

      {/* Content — pure function of state */}
      <div className="flex-1 min-h-0 overflow-y-auto" data-testid="ingest-view-body">
        {state === 'LOADING' && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {state === 'NO_WAREHOUSE' && <EmptyWarehouseCard onSetUp={openWarehouseWizard} />}

        {state === 'NO_SOURCE' && <EmptySourceCard onAddSource={openSourceWizard} />}

        {state === 'STEADY' && <SteadyView />}
      </div>

      {wizardOpen && (
        <AddSourceWizard
          open={wizardOpen}
          needsWarehouse={wizardNeedsWarehouse}
          onClose={() => {
            setWizardOpen(false);
            // Revalidate on close (not mid-flow) so the ingest state — and the card
            // behind the dialog — only changes once the wizard is gone. A warehouse
            // may have been created even if no source was.
            warehouse.mutate();
            sources.mutate();
          }}
          onComplete={() => {
            setWizardOpen(false);
            warehouse.mutate();
            sources.mutate();
            mutateConnections();
          }}
        />
      )}
    </div>
  );
}
