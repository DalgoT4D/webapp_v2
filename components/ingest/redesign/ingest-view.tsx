'use client';

import { Loader2 } from 'lucide-react';
import { DocsLink } from '@/components/ui/docs-link';
import { IngestUiToggle } from '@/components/ingest/redesign/ingest-ui-toggle';
import { EmptyWarehouseCard } from '@/components/ingest/redesign/empty-warehouse-card';
import { EmptySourceCard } from '@/components/ingest/redesign/empty-source-card';
import { WarehouseChip } from '@/components/ingest/redesign/warehouse-chip';
import { SteadyView } from '@/components/ingest/redesign/steady-view';
import { selectIngestState } from '@/components/ingest/redesign/state';
import { useWarehouse } from '@/hooks/api/useWarehouse';
import { useSources } from '@/hooks/api/useSources';
import type { IngestUiMode } from '@/hooks/useIngestUiMode';

interface IngestViewProps {
  mode: IngestUiMode;
  onModeChange: (mode: IngestUiMode) => void;
}

/**
 * Redesigned Ingest page: progressive-reveal (warehouse → source → connection)
 * with source-grouped connections. The screen shown is a pure function of what
 * data exists (see selectIngestState).
 */
export function IngestView({ mode, onModeChange }: IngestViewProps) {
  const warehouse = useWarehouse();
  const sources = useSources();

  const state = selectIngestState(
    { data: warehouse.data, isLoading: warehouse.isLoading },
    { data: sources.data, isLoading: sources.isLoading }
  );

  return (
    <div className="h-full flex flex-col" data-testid="ingest-view">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="flex items-start justify-between p-6">
          <div>
            <DocsLink path="/data/ingest">
              <h1 className="text-3xl font-bold">Ingest</h1>
            </DocsLink>
            <p className="text-muted-foreground mt-1">
              Bring your data into Dalgo — set up a warehouse, add sources, then sync connections
            </p>
          </div>
          <div className="flex items-center gap-3">
            {warehouse.data && <WarehouseChip warehouse={warehouse.data} />}
            <IngestUiToggle mode={mode} onChange={onModeChange} />
          </div>
        </div>
      </div>

      {/* Content — pure function of state */}
      <div className="flex-1 min-h-0 overflow-y-auto" data-testid="ingest-view-body">
        {state === 'LOADING' && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {state === 'NO_WAREHOUSE' && <EmptyWarehouseCard onCreated={() => warehouse.mutate()} />}

        {state === 'NO_SOURCE' && <EmptySourceCard onCreated={() => sources.mutate()} />}

        {state === 'STEADY' && <SteadyView layout={mode === 'rows' ? 'rows' : 'accordion'} />}
      </div>
    </div>
  );
}
