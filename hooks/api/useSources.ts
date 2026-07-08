import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type {
  Source,
  SourceDefinition,
  CreateSourcePayload,
  UpdateSourcePayload,
  SourceOAuthConsent,
  CompleteSourceOAuthPayload,
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

// ============ Google OAuth (Sign in with Google) ============

/** Google Sheets source-definition id — the connector that supports "Sign in with Google" */
export const GOOGLE_SHEETS_SOURCE_DEFINITION_ID = '71607ba1-c0ac-4799-8049-7f4b90dd50f7';

/** Start the OAuth flow: get the Google consent URL + a state nonce to echo back */
export async function getSourceOAuthConsent(sourceDefId: string): Promise<SourceOAuthConsent> {
  return apiPost('/api/airbyte/sources/oauth/consent/', { sourceDefId });
}

/** Complete the OAuth flow: Airbyte exchanges the code and returns the source config fragment */
export async function completeSourceOAuth(
  payload: CompleteSourceOAuthPayload
): Promise<Record<string, unknown>> {
  return apiPost('/api/airbyte/sources/oauth/complete/', payload);
}
