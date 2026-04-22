// Hooks for the Metric primitive library (/api/metrics/).
//
// Batch 2 rewires this to the new primitive API. The KPI tracked layer that
// used to live here has moved to `useKPIs.ts`. The dedicated library UI lands
// in Batch 5; for now these hooks power inline "pick a saved Metric" flows
// in the chart builder and KPI/alert forms.

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type {
  Metric,
  MetricCreate,
  MetricUpdate,
  MetricDetail,
  MetricDataPoint,
  MetricReferences,
  ValidateSqlRequest,
  ValidateSqlResponse,
} from '@/types/metrics';

const FETCH_ONCE = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
} as const;

const jsonFetcher = (url: string) => apiGet(url);

// ── Metric CRUD ─────────────────────────────────────────────────────────────

export function useMetrics() {
  return useSWR<Metric[]>('/api/metrics/', jsonFetcher, FETCH_ONCE);
}

export function useMetric(metricId: number | null) {
  return useSWR<MetricDetail>(
    metricId ? `/api/metrics/${metricId}/` : null,
    jsonFetcher,
    FETCH_ONCE
  );
}

export function useMetricReferences(metricId: number | null) {
  return useSWR<MetricReferences>(
    metricId ? `/api/metrics/${metricId}/references/` : null,
    jsonFetcher,
    FETCH_ONCE
  );
}

export function useCreateMetric() {
  return useSWRMutation('/api/metrics/', (url: string, { arg }: { arg: MetricCreate }) =>
    apiPost(url, arg)
  );
}

export function useUpdateMetric() {
  return useSWRMutation(
    '/api/metrics/',
    (url: string, { arg }: { arg: { id: number; data: MetricUpdate } }) =>
      apiPut(`${url}${arg.id}/`, arg.data)
  );
}

export function useDeleteMetric() {
  return useSWRMutation('/api/metrics/', (url: string, { arg }: { arg: number }) =>
    apiDelete(`${url}${arg}/`)
  );
}

// ── Metric live data (current value + optional trend, no RAG) ───────────────

export function useMetricsData(metricIds: number[] | null, includeTrend = false) {
  const key =
    metricIds && metricIds.length > 0
      ? ['/api/metrics/data/', [...metricIds].sort().join(','), includeTrend]
      : null;

  return useSWR<MetricDataPoint[]>(
    key,
    ([url]: [string, string, boolean]) =>
      apiPost(url, { metric_ids: metricIds, include_trend: includeTrend }),
    {
      ...FETCH_ONCE,
      dedupingInterval: 30000,
    }
  );
}

// ── Calculated-SQL validator (pre-save dry-run) ─────────────────────────────

export function useValidateMetricSql() {
  return useSWRMutation(
    '/api/metrics/validate-sql/',
    (url: string, { arg }: { arg: ValidateSqlRequest }) =>
      apiPost(url, arg) as Promise<ValidateSqlResponse>
  );
}
