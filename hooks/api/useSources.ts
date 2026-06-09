import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type {
  Source,
  SourceDefinition,
  CreateSourcePayload,
  UpdateSourcePayload,
} from '@/types/source';
import type { ConnectionSpecification } from '@/components/connectors/types';

// ============ SWR Read Hooks ============

/** All sources for the current org. No polling — static list, refresh via mutate() */
export function useSources() {
  const { data, error, mutate, isLoading } = useSWR<Source[]>('/api/airbyte/sources', apiGet, {
    revalidateOnFocus: false,
  });
  return { data: data || [], isLoading, isError: error, mutate };
}

/** Available source type definitions */
export function useSourceDefinitions() {
  const { data, error, isLoading } = useSWR<SourceDefinition[]>(
    '/api/airbyte/source_definitions',
    apiGet,
    { revalidateOnFocus: false }
  );
  return { data: data || [], isLoading, isError: error };
}

/** Raw API response wraps the spec in a connectionSpecification key */
interface SpecResponse {
  connectionSpecification: ConnectionSpecification;
}

/** Unwrap the spec from the API response envelope */
function unwrapSpec(
  data: SpecResponse | ConnectionSpecification | undefined
): ConnectionSpecification | undefined {
  if (!data) return undefined;
  if ('connectionSpecification' in data) return data.connectionSpecification;
  return data;
}

/** Spec for a selected source definition (conditional fetch) */
export function useSourceSpec(sourceDefId: string | null) {
  const { data, error, isLoading } = useSWR<SpecResponse>(
    sourceDefId ? `${'/api/airbyte/source_definitions'}/${sourceDefId}/specifications` : null,
    apiGet,
    { revalidateOnFocus: false }
  );
  return { data: unwrapSpec(data), isLoading, isError: error };
}

/** Single source details for editing */
export function useSource(sourceId: string | null) {
  const { data, error, isLoading } = useSWR<Source>(
    sourceId ? `${'/api/airbyte/sources'}/${sourceId}` : null,
    apiGet,
    { revalidateOnFocus: false }
  );
  return { data, isLoading, isError: error };
}

// ============ Mutation Functions ============

export async function createSource(payload: CreateSourcePayload): Promise<Source> {
  return apiPost(`${'/api/airbyte/sources'}/`, payload);
}

export async function updateSource(
  sourceId: string,
  payload: UpdateSourcePayload
): Promise<Source> {
  return apiPut(`${'/api/airbyte/sources'}/${sourceId}`, payload);
}

export async function deleteSource(sourceId: string): Promise<void> {
  return apiDelete(`${'/api/airbyte/sources'}/${sourceId}`);
}
