import useSWR from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type {
  Source,
  SourceDefinition,
  CreateSourcePayload,
  UpdateSourcePayload,
  SourceOAuthConsent,
  SourceOAuthPickerConfig,
  CreateOAuthSourcePayload,
  UpdateOAuthSourcePayload,
  CreateOAuthSourceResponse,
  ManagedServiceAccount,
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
  const { data, error, isLoading, mutate } = useSWR<Source>(
    sourceId ? `${'/api/airbyte/sources'}/${sourceId}` : null,
    apiGet,
    { revalidateOnFocus: false }
  );
  return { data, isLoading, isError: error, mutate };
}

/** MANAGED-SA bridge — the address users share their spreadsheet with, or null when the
 * deployment ships no key. Fixed per deployment, so fetched once and never revalidated. */
export function useManagedServiceAccount(enabled: boolean) {
  const { data, isLoading } = useSWR<ManagedServiceAccount>(
    enabled ? '/api/airbyte/sources/google_sheets/managed_service_account/' : null,
    apiGet,
    { revalidateOnFocus: false, revalidateIfStale: false, shouldRetryOnError: false }
  );
  return { managed: data ?? null, isLoading };
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

/** Start the OAuth flow (Variant A): Dalgo builds the Google consent URL and returns it.
 * `sourceName` is the source-definition NAME (e.g. "Google Sheets") — the OAuth registry
 * key. The frontend already has it from the same `useSourceDefinitions()` catalog it got
 * `sourceDefId` from; never hardcode it (use the definition's name, see
 * `custom/constants.ts`). The state nonce stays server-side; the browser only opens the
 * URL. */
export async function getSourceOAuthConsent(
  sourceDefId: string,
  sourceName: string
): Promise<SourceOAuthConsent> {
  return apiPost('/api/airbyte/sources/oauth/consent/', { sourceDefId, sourceName });
}

/** Fetch the Google Picker config for a `ref` this user owns: a short-lived Drive-scoped
 * access token plus the Picker's API key and app id.
 *
 * Needed because the `drive.file` scope grants only the files the user picks in Google's own
 * Picker, and the Picker runs client-side. POST, not GET — the ref is a credential and has no
 * business in a URL or an access log. */
export async function getSourceOAuthPickerConfig(
  sourceName: string,
  refreshTokenRef: string
): Promise<SourceOAuthPickerConfig> {
  return apiPost('/api/airbyte/sources/oauth/picker/', {
    sourceName,
    refresh_token_ref: refreshTokenRef,
  });
}

/** Create a NEW source from a redeemed OAuth `ref`: the backend redeems the ref, injects
 * the credentials server-side, and creates the source. Returns the saved source's id —
 * no credentials or tokens are returned to the browser. To re-authenticate an EXISTING
 * source, use `updateOAuthSource` instead — this always creates a new one. */
export async function createOAuthSource(
  payload: CreateOAuthSourcePayload
): Promise<CreateOAuthSourceResponse> {
  return apiPost('/api/airbyte/sources/oauth/create/', payload);
}

/** Re-authenticate an EXISTING source from a redeemed OAuth `ref`: same as create, but
 * updates the source named by `sourceId` in place instead of creating a new one. */
export async function updateOAuthSource(
  sourceId: string,
  payload: UpdateOAuthSourcePayload
): Promise<CreateOAuthSourceResponse> {
  return apiPut(`/api/airbyte/sources/oauth/${sourceId}`, payload);
}
