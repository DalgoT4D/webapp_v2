// Hooks for the KPI tracked layer (/api/kpis/) and the append-only
// KPIEntry timeline. Replaces what used to live under useMetrics.

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type {
  KPI,
  KPICreate,
  KPIUpdate,
  KPIDataPoint,
  KPIEntry,
  KPIEntryCreate,
  LatestKPIEntry,
} from '@/types/kpis';

const FETCH_ONCE = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
} as const;

const jsonFetcher = (url: string) => apiGet(url);

// ── KPI CRUD ────────────────────────────────────────────────────────────────

export function useKPIs() {
  return useSWR<KPI[]>('/api/kpis/', jsonFetcher, FETCH_ONCE);
}

export function useKPI(kpiId: number | null) {
  return useSWR<KPI>(kpiId ? `/api/kpis/${kpiId}/` : null, jsonFetcher, FETCH_ONCE);
}

export function useCreateKPI() {
  return useSWRMutation('/api/kpis/', (url: string, { arg }: { arg: KPICreate }) =>
    apiPost(url, arg)
  );
}

export function useUpdateKPI() {
  return useSWRMutation(
    '/api/kpis/',
    (url: string, { arg }: { arg: { id: number; data: KPIUpdate } }) =>
      apiPut(`${url}${arg.id}/`, arg.data)
  );
}

export function useDeleteKPI() {
  return useSWRMutation('/api/kpis/', (url: string, { arg }: { arg: number }) =>
    apiDelete(`${url}${arg}/`)
  );
}

// ── KPI live data (value + trend + RAG + period-over-period) ────────────────

export function useKPIsData(kpiIds: number[] | null) {
  const key =
    kpiIds && kpiIds.length > 0 ? ['/api/kpis/data/', [...kpiIds].sort().join(',')] : null;

  return useSWR<KPIDataPoint[]>(
    key,
    ([url]: [string, string]) => apiPost(url, { kpi_ids: kpiIds }),
    {
      ...FETCH_ONCE,
      dedupingInterval: 30000,
    }
  );
}

// ── KPI entries (annotations timeline) ──────────────────────────────────────

export function useKPIEntries(kpiId: number | null) {
  return useSWR<KPIEntry[]>(kpiId ? `/api/kpis/${kpiId}/entries/` : null, jsonFetcher, FETCH_ONCE);
}

export function useCreateKPIEntry(kpiId: number | null) {
  return useSWRMutation(
    kpiId ? `/api/kpis/${kpiId}/entries/` : null,
    (url: string, { arg }: { arg: KPIEntryCreate }) => apiPost(url, arg)
  );
}

export function useDeleteKPIEntry(kpiId: number | null) {
  return useSWRMutation(
    kpiId ? `/api/kpis/${kpiId}/entries/` : null,
    (url: string, { arg }: { arg: number }) => apiDelete(`/api/kpis/${kpiId}/entries/${arg}/`)
  );
}

export function useLatestKPIEntries(kpiIds: number[] | null) {
  const key =
    kpiIds && kpiIds.length > 0
      ? ['/api/kpis/latest-entries/', [...kpiIds].sort().join(',')]
      : null;

  return useSWR<LatestKPIEntry[]>(
    key,
    ([url]: [string, string]) => apiPost(url, { kpi_ids: kpiIds }),
    FETCH_ONCE
  );
}
