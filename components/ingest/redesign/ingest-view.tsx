'use client';

import { useState } from 'react';
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
import { PERMISSIONS, useRbac } from '@/lib/rbac';

/**
 * The Ingest page: progressive-reveal (warehouse → source → connection) with
 * source-grouped connections in a side-by-side layout. The screen shown is a
 * pure function of what data exists (see selectIngestState).
 */
export function IngestView() {
  const warehouse = useWarehouse();
  const sources = useSources();
  const { hasPermission } = useRbac();
  const canCreateSource = hasPermission(PERMISSIONS.CAN_CREATE_SOURCE);

  // The "New Source" action lives in the page header (like the Charts page), so it
  // owns the wizard rather than SteadyView. SteadyView reads the same useSources
  // SWR cache, so it refreshes automatically when a source is created here.
  const [addSourceWizardOpen, setAddSourceWizardOpen] = useState(false);

  const state = selectIngestState(
    { data: warehouse.data, isLoading: warehouse.isLoading },
    { data: sources.data, isLoading: sources.isLoading }
  );

  return (
    <div className="h-full flex flex-col" data-testid="ingest-view">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="flex items-center justify-between mb-6 p-6 pb-0">
          <div>
            <div className="flex items-center gap-3">
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
              onClick={() => setAddSourceWizardOpen(true)}
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

        {state === 'NO_WAREHOUSE' && <EmptyWarehouseCard />}

        {state === 'NO_SOURCE' && <EmptySourceCard onCreated={() => sources.mutate()} />}

        {state === 'STEADY' && <SteadyView />}
      </div>

      {addSourceWizardOpen && (
        <AddSourceWizard
          open={addSourceWizardOpen}
          onClose={() => setAddSourceWizardOpen(false)}
          onComplete={() => {
            setAddSourceWizardOpen(false);
            sources.mutate();
          }}
        />
      )}
    </div>
  );
}
