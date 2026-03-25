import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type {
  MetricDefinition,
  MetricCreate,
  MetricUpdate,
  MetricDataPoint,
  MetricAnnotation,
  AnnotationCreate,
} from '@/types/metrics';

// ── Fetchers ────────────────────────────────────────────────────────────────

const metricsFetcher = (url: string) => apiGet(url);
const annotationsFetcher = (url: string) => apiGet(url);

// ── Metric Definitions ──────────────────────────────────────────────────────

export function useMetrics() {
  return useSWR<MetricDefinition[]>('/api/metrics/', metricsFetcher);
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

// ── Metric Data (live warehouse values) ─────────────────────────────────────

export function useMetricsData(metricIds: number[] | null) {
  // Use a stable key based on sorted IDs
  const key =
    metricIds && metricIds.length > 0 ? ['/api/metrics/data/', metricIds.sort().join(',')] : null;

  return useSWR<MetricDataPoint[]>(
    key,
    ([url]: [string, string]) => apiPost(url, { metric_ids: metricIds }),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000, // 30s cache — warehouse queries are expensive
    }
  );
}

// ── Annotations ─────────────────────────────────────────────────────────────

export function useAnnotations(metricId: number | null) {
  return useSWR<MetricAnnotation[]>(
    metricId ? `/api/metrics/${metricId}/annotations/` : null,
    annotationsFetcher
  );
}

export function useSaveAnnotation(metricId: number | null) {
  return useSWRMutation(
    metricId ? `/api/metrics/${metricId}/annotations/` : null,
    (url: string, { arg }: { arg: AnnotationCreate }) => apiPost(url, arg)
  );
}
