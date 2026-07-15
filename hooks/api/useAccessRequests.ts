/**
 * useAccessRequests — the request-access flow (Milestone 9), sibling to
 * useResourceAccess.ts.
 *
 * Deliberately a separate file rather than folded into useResourceAccess.ts:
 * that file owns the People-with-access / General-access sections (grants +
 * general), which are a different mental model (an owner/editor managing who
 * has access) from this one (any org member asking for access, and an
 * owner/admin deciding on that ask). Contract verified against
 * ddpui/api/access_api.py + ddpui/schemas/access_schema.py on the paired
 * backend branch (see task-15 report for the verbatim JSON shape).
 */
import useSWR from 'swr';
import { apiGet, apiPost } from '@/lib/api';
import type { AccessLevel, ShareableResourceType } from './useResourceAccess';

// Mirrors AccessRequestCreate.note's max_length in ddpui/schemas/access_schema.py.
export const ACCESS_REQUEST_NOTE_MAX_LENGTH = 500;

export type AccessRequestStatus = 'pending' | 'approved' | 'declined' | 'expired';

// An OrgUser reference on an AccessRequest — the requester, or the decider
// once decided (mirrors RequesterOut in access_schema.py).
export interface AccessRequestPerson {
  orguser_id: number;
  email: string;
  name: string;
}

export interface AccessRequestItem {
  id: number;
  resource_type: ShareableResourceType;
  resource_id: string;
  requester: AccessRequestPerson;
  requested_permission: AccessLevel;
  note: string | null;
  status: AccessRequestStatus;
  decided_by: AccessRequestPerson | null;
  expires_at: string;
  created_at: string;
}

export interface AccessRequestListResult {
  incoming: AccessRequestItem[];
  outgoing: AccessRequestItem[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Exported so callers outside this hook (e.g. the Notifications page's
// actionable row, batch 2 / F6) can invalidate the share-modal's pending
// request list after deciding a request from elsewhere.
export const ACCESS_REQUESTS_KEY = '/api/access/requests/';

/**
 * The caller's access-request inbox. `incoming` = pending requests on
 * resources they can decide (owner/admin — server-filtered, no client-side
 * permission check needed to decide whether to show decision UI).
 * `outgoing` = the caller's own requests, any status.
 *
 * `enabled` gates the fetch (e.g. only while a modal is open, or only when
 * the viewer actually needs the pending-request check) — matches the
 * `useUserGroups(canShare)` lazy-fetch pattern elsewhere in this feature.
 */
export function useAccessRequests(enabled: boolean) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<AccessRequestListResult>>(
    enabled ? ACCESS_REQUESTS_KEY : null,
    apiGet,
    { revalidateOnFocus: false }
  );

  return {
    incoming: data?.data.incoming ?? [],
    outgoing: data?.data.outgoing ?? [],
    isLoading,
    isError: error,
    mutate,
  };
}

// ---- Mutation functions ----

export interface CreateAccessRequestPayload {
  requested_permission: AccessLevel;
  note?: string;
}

export async function createAccessRequest(
  rtype: ShareableResourceType,
  resourceId: number,
  payload: CreateAccessRequestPayload
): Promise<AccessRequestItem> {
  const response: ApiResponse<AccessRequestItem> = await apiPost(
    `/api/access/${rtype}/${resourceId}/requests/`,
    payload
  );
  return response.data;
}

/**
 * Omit `permission` to grant exactly what was requested. Passing a value
 * only ever downgrades (Edit ask -> View grant) — the backend 400s an
 * attempt to escalate above the original ask, so callers must cap the
 * choices they offer at `requested_permission`, not just the payload.
 */
export async function approveAccessRequest(
  requestId: number,
  permission?: AccessLevel
): Promise<AccessRequestItem> {
  const response: ApiResponse<AccessRequestItem> = await apiPost(
    `/api/access/requests/${requestId}/approve/`,
    permission ? { permission } : {}
  );
  return response.data;
}

export async function declineAccessRequest(requestId: number): Promise<AccessRequestItem> {
  const response: ApiResponse<AccessRequestItem> = await apiPost(
    `/api/access/requests/${requestId}/decline/`,
    {}
  );
  return response.data;
}
