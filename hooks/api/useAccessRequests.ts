/**
 * useAccessRequests — the request-access flow. Kept separate from
 * useResourceAccess.ts: managing who has access vs asking for access are
 * different mental models. Types mirror the backend's access_schema.py.
 */
import useSWR from 'swr';
import { apiGet, apiPost } from '@/lib/api';
import type { AccessLevel, ShareableResourceType } from './useResourceAccess';

// Mirrors AccessRequestCreate.note's max_length in ddpui/schemas/access_schema.py.
export const ACCESS_REQUEST_NOTE_MAX_LENGTH = 500;

export type AccessRequestStatus = 'pending' | 'approved' | 'declined' | 'expired';

// An OrgUser reference on an AccessRequest — the requester, or the decider.
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

// Exported so callers elsewhere (e.g. the Notifications page) can
// invalidate the pending-request list after deciding a request.
export const ACCESS_REQUESTS_KEY = '/api/access/requests/';

/**
 * The caller's access-request inbox. `incoming` = pending requests they can
 * decide (server-filtered); `outgoing` = their own requests, any status.
 * `enabled` gates the fetch (e.g. only while a modal is open).
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
 * Omit `permission` to grant exactly what was requested. A value may only
 * downgrade — the backend 400s an escalation above the original ask.
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
