import type { Warehouse } from '@/types/warehouse';
import type { Source } from '@/types/source';

export type IngestState = 'LOADING' | 'ERROR' | 'NO_WAREHOUSE' | 'NO_SOURCE' | 'STEADY';

interface WarehouseSlice {
  data: Warehouse | undefined;
  isLoading: boolean;
  isError?: unknown;
}

interface SourcesSlice {
  data: Source[];
  isLoading: boolean;
  isError?: unknown;
}

/**
 * The screen the redesigned Ingest page shows is a pure function of what data
 * exists. This drives the progressive reveal: warehouse first, then source,
 * then the steady source-grouped view.
 *
 * ERROR is checked BEFORE the emptiness checks and is not optional: a failed fetch
 * leaves SWR at data:undefined / isLoading:false, which is indistinguishable from a
 * genuinely empty org unless the error is consulted. Reading a failed
 * /organizations/warehouses call as NO_WAREHOUSE told orgs that DO have a warehouse to
 * go set one up — and since that endpoint makes a live Airbyte call per warehouse
 * server-side, a single Airbyte hiccup was enough to trigger it. Only a successful
 * response with zero warehouses may produce NO_WAREHOUSE.
 */
export function selectIngestState(warehouse: WarehouseSlice, sources: SourcesSlice): IngestState {
  if (warehouse.isLoading || sources.isLoading) return 'LOADING';
  if (warehouse.isError || sources.isError) return 'ERROR';
  if (warehouse.data === undefined) return 'NO_WAREHOUSE';
  if (sources.data.length === 0) return 'NO_SOURCE';
  return 'STEADY';
}
