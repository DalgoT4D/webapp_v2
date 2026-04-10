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
  LatestAnnotationEntry,
  MetricEntry,
  EntryCreate,
} from '@/types/metrics';

// ── Shared SWR config: fetch once on mount, only refetch on explicit mutate() ─
const FETCH_ONCE = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
} as const;

// ── Fetchers ────────────────────────────────────────────────────────────────

const metricsFetcher = (url: string) => apiGet(url);
const annotationsFetcher = (url: string) => apiGet(url);

// ── Metric Definitions ──────────────────────────────────────────────────────

export function useMetrics() {
  return useSWR<MetricDefinition[]>('/api/metrics/', metricsFetcher, FETCH_ONCE);
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
  // Use a stable key based on sorted IDs — spread to avoid mutating the original array
  const key =
    metricIds && metricIds.length > 0
      ? ['/api/metrics/data/', [...metricIds].sort().join(',')]
      : null;

  return useSWR<MetricDataPoint[]>(
    key,
    ([url]: [string, string]) => apiPost(url, { metric_ids: metricIds }),
    {
      ...FETCH_ONCE,
      dedupingInterval: 30000, // 30s cache — warehouse queries are expensive
    }
  );
}

// ── Annotations ─────────────────────────────────────────────────────────────

export function useAnnotations(metricId: number | null) {
  return useSWR<MetricAnnotation[]>(
    metricId ? `/api/metrics/${metricId}/annotations/` : null,
    annotationsFetcher,
    FETCH_ONCE
  );
}

export function useSaveAnnotation(metricId: number | null) {
  return useSWRMutation(
    metricId ? `/api/metrics/${metricId}/annotations/` : null,
    (url: string, { arg }: { arg: AnnotationCreate }) => apiPost(url, arg)
  );
}

export function useLatestAnnotations(metricIds: number[] | null) {
  const key =
    metricIds && metricIds.length > 0
      ? ['/api/metrics/latest-annotations/', [...metricIds].sort().join(',')]
      : null;

  return useSWR<LatestAnnotationEntry[]>(
    key,
    ([url]: [string, string]) => apiPost(url, { metric_ids: metricIds }),
    FETCH_ONCE
  );
}

// ── Metric Entries (timeline) ──────────────────────────────────────────────

export function useMetricEntries(metricId: number | null) {
  return useSWR<MetricEntry[]>(
    metricId ? `/api/metrics/${metricId}/entries/` : null,
    metricsFetcher,
    FETCH_ONCE
  );
}

export function useCreateEntry(metricId: number | null) {
  return useSWRMutation(
    metricId ? `/api/metrics/${metricId}/entries/` : null,
    (url: string, { arg }: { arg: EntryCreate }) => apiPost(url, arg)
  );
}

export function useDeleteEntry(metricId: number | null) {
  return useSWRMutation(
    metricId ? `/api/metrics/${metricId}/entries/` : null,
    (url: string, { arg }: { arg: number }) => apiDelete(`/api/metrics/${metricId}/entries/${arg}/`)
  );
}
