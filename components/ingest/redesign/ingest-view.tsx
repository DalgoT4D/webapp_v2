'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Loader2, Plus } from 'lucide-react';
import { DocsLink } from '@/components/ui/docs-link';
import { Button } from '@/components/ui/button';
import { EmptyWarehouseCard } from '@/components/ingest/redesign/empty-warehouse-card';
import { EmptySourceCard } from '@/components/ingest/redesign/empty-source-card';
import { IngestErrorCard } from '@/components/ingest/redesign/ingest-error-card';
import { SteadyView } from '@/components/ingest/redesign/steady-view';
import { selectIngestState } from '@/components/ingest/redesign/state';
import { AddSourceWizard } from '@/components/ingest/sources/wizard/AddSourceWizard';
import { useWarehouse } from '@/hooks/api/useWarehouse';
import { useSources } from '@/hooks/api/useSources';
import { useConnectionsList } from '@/hooks/api/useConnections';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import {
  isWizardCoachedStage,
  PICK_SOURCE_REWIND_STAGES,
} from '@/components/onboarding/insight-walkthrough-constants';
import type { Warehouse } from '@/types/warehouse';

/**
 * Compact top-right chip showing the org's single warehouse. It links out to the
 * warehouse's home in Settings (Settings → Warehouse), where it can be viewed,
 * edited, or deleted — the warehouse is org infrastructure, not an ingest concern.
 */
function WarehouseChip({ warehouse }: { warehouse: Warehouse }) {
  return (
    <Link
      href="/settings/warehouse"
      className="group inline-flex items-center gap-1.5 text-sm leading-none cursor-pointer"
      data-testid="warehouse-chip"
    >
      <span className="text-muted-foreground group-hover:underline">
        Warehouse (<span className="capitalize">{warehouse.wtype}</span>):
      </span>
      <span className="font-medium text-foreground max-w-[12rem] truncate group-hover:underline">
        {warehouse.name}
      </span>
    </Link>
  );
}

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
    { data: warehouse.data, isLoading: warehouse.isLoading, isError: warehouse.isError },
    { data: sources.data, isLoading: sources.isLoading, isError: sources.isError }
  );

  // First-time users (no warehouse) land straight in the wizard at its warehouse
  // step — no intermediate button. Auto-open once per mount; if they close it the
  // card behind stays and can re-open it (see openWarehouseWizard).
  //
  // NO_WAREHOUSE now means "the server answered, and the org has no warehouse" — a failed
  // fetch lands on ERROR instead (see selectIngestState). Without that split, the 5s gaps
  // between SWR's error retries read as NO_WAREHOUSE and auto-opened this wizard on orgs
  // that already had a warehouse.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (state === 'NO_WAREHOUSE' && canCreateWarehouse && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setWizardNeedsWarehouse(true);
      setWizardOpen(true);
    }
  }, [state, canCreateWarehouse]);

  // The "Connect your data" coachmark points at the New Source button — hide it once the
  // wizard itself is open, same pattern as the KPI/chart selector modals in
  // dashboard-builder-v2.tsx, so the coachmark doesn't sit awkwardly behind the wizard's own
  // dialog overlay. The pick-a-source stages are the exception: their target IS inside the
  // wizard, so suppressing them would mean they never showed at all.
  //
  // `walkthroughStage` is SUBSCRIBED rather than read via getState(): the move onto a
  // pick-a-source stage comes from SelectSourceStep mounting, i.e. after wizardOpen has
  // already flipped. With wizardOpen as the only dependency this effect would latch
  // suppressed:true and never re-run, and the card inside would never get coached.
  const walkthroughStage = useInsightWalkthroughStore((s) => s.stage);
  useEffect(() => {
    useInsightWalkthroughStore
      .getState()
      .setSuppressCoachmark(wizardOpen && !isWizardCoachedStage(walkthroughStage));
  }, [wizardOpen, walkthroughStage]);

  /**
   * Leaving the wizard without a connection strands a pick-a-source stage on a card that no
   * longer exists — the coachmark would sit waiting on a selector that can't reappear until
   * the wizard is opened again. Put the walkthrough back on the New Source button so it can.
   *
   * Runs on completion too, not just dismissal: the wizard can finish having created only a
   * source (its connection step is cancellable), and this fork needs a CONNECTION — that's
   * what the sync checkpoint in tour-gate.tsx watches.
   */
  const rewindWalkthroughIfNoConnection = () => {
    const { stage, trackedConnectionId, advanceTo } = useInsightWalkthroughStore.getState();
    if (trackedConnectionId || !stage) return;
    const rewindTo = PICK_SOURCE_REWIND_STAGES[stage];
    if (rewindTo) advanceTo(rewindTo);
  };

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

        {state === 'ERROR' && (
          <IngestErrorCard
            onRetry={() => {
              warehouse.mutate();
              sources.mutate();
            }}
          />
        )}

        {state === 'NO_WAREHOUSE' && <EmptyWarehouseCard onSetUp={openWarehouseWizard} />}

        {state === 'NO_SOURCE' && <EmptySourceCard onAddSource={openSourceWizard} />}

        {state === 'STEADY' && <SteadyView />}
      </div>

      {wizardOpen && (
        <AddSourceWizard
          open={wizardOpen}
          needsWarehouse={wizardNeedsWarehouse}
          // Live signal, unlike the frozen needsWarehouse above: if a warehouse turns up while
          // the wizard is sitting on its warehouse step (a retried fetch finally landing after
          // a failed one), the wizard drops that step instead of asking for a warehouse the
          // org already has.
          warehouseExists={warehouse.data !== undefined}
          onClose={() => {
            setWizardOpen(false);
            rewindWalkthroughIfNoConnection();
            // Revalidate on close (not mid-flow) so the ingest state — and the card
            // behind the dialog — only changes once the wizard is gone. A warehouse
            // may have been created even if no source was.
            warehouse.mutate();
            sources.mutate();
          }}
          onComplete={() => {
            setWizardOpen(false);
            rewindWalkthroughIfNoConnection();
            warehouse.mutate();
            sources.mutate();
            mutateConnections();
          }}
        />
      )}
    </div>
  );
}
