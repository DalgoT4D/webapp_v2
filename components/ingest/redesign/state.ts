import type { Warehouse } from '@/types/warehouse';
import type { Source } from '@/types/source';

export type IngestState = 'LOADING' | 'NO_WAREHOUSE' | 'NO_SOURCE' | 'STEADY';

interface WarehouseSlice {
  data: Warehouse | undefined;
  isLoading: boolean;
}

interface SourcesSlice {
  data: Source[];
  isLoading: boolean;
}

/**
 * The screen the redesigned Ingest page shows is a pure function of what data
 * exists. This drives the progressive reveal: warehouse first, then source,
 * then the steady source-grouped view.
 */
export function selectIngestState(warehouse: WarehouseSlice, sources: SourcesSlice): IngestState {
  if (warehouse.isLoading || sources.isLoading) return 'LOADING';
  if (warehouse.data === undefined) return 'NO_WAREHOUSE';
  if (sources.data.length === 0) return 'NO_SOURCE';
  return 'STEADY';
}
